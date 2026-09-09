import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { newStory, floorAt } from "../src/cinema/logic.js";
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(60000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.addInitScript(() => {
  const s = sessionStorage.getItem("expansion.fixture");
  if (s) {
    localStorage.setItem("polaroid.last-showing.v1", s);
    sessionStorage.removeItem("expansion.fixture");
  }
});
const d = () => page.evaluate(() => window.cinemaDiagnostics);
let saved = newStory();
async function load(x, z, tx, ty, tz, patch = {}) {
  saved = {
    ...saved,
    ...patch,
    checkpoint: {
      x,
      z,
      yaw: Math.atan2(x - tx, z - tz),
      pitch: Math.atan2(
        ty - (floorAt(x, z) + 1.64),
        Math.hypot(x - tx, z - tz),
      ),
    },
  };
  await page.evaluate(
    (s) => sessionStorage.setItem("expansion.fixture", JSON.stringify(s)),
    saved,
  );
  await page.reload();
  await page.click("#enter-story");
  await page.waitForFunction(() => window.cinemaDiagnostics.mode === "playing");
  await page.waitForTimeout(500);
}
try {
  await page.goto(base + "/?chapter=last-showing");
  await load(8, 13, 10, 1.1, 13);
  const bounds = (await d()).architecture;
  for (const b of bounds.filter((b) => b.name.startsWith("lobby-dado"))) {
    const [lo, hi] = b.min[0] < 0 ? [10, 12] : [12, 14];
    assert(
      b.max[2] <= lo || b.min[2] >= hi,
      "Dado geometry must stop at lobby door reveals",
    );
  }
  const backing = bounds.find((b) => b.name === "service-sign-backing");
  const sign = bounds.find((b) => b.name === "service-direction-sign");
  assert(
    Math.abs(backing.max[0] + 10.11) < 0.02,
    "Backing touches the passage wall",
  );
  assert(
    Math.abs(sign.min[0] - backing.min[0]) < 0.02,
    "Lettering lies on backing",
  );
  await page.screenshot({ path: "artifacts/cinema-clear-stairs.png" });
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.cinemaDiagnostics.player.x > 10.4);
  await page.keyboard.up("w");
  await load(-8, 11, -10, 1.1, 11);
  await page.screenshot({ path: "artifacts/cinema-clear-staff.png" });
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.cinemaDiagnostics.player.x < -10.4);
  await page.keyboard.up("w");
  await load(-12, -0.8, -10.18, 2.3, -3);
  await page.screenshot({ path: "artifacts/cinema-mounted-sign.png" });
  for (const [id, x, z] of [
    ["closing", -2.8, 19.4],
    ["register", -6.6, 19.4],
    ["booth", 15.5, -6.6],
    ["letter", -16.95, -0.55],
    ["witness", -11.6, -15],
  ]) {
    const t = (await d()).interactions.find((t) => t.id === "lore:" + id);
    await load(x, z, t.x, t.y, t.z);
    await page.keyboard.press("e");
    assert((await d()).state.lore[id], "Record reachable: " + id);
    assert.equal(
      (await d()).mode,
      "playing",
      "Physical records keep gameplay active",
    );
    await page.click("#panel-close");
    saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("polaroid.last-showing.v1")),
    );
    console.log("record", id);
  }
  await page.keyboard.press("j");
  assert.equal(await page.locator(".lore-journal details").count(), 5);
  await page
    .locator(".lore-journal summary")
    .filter({ hasText: "SOMEONE STILL CALLS" })
    .click();
  await page.screenshot({ path: "artifacts/cinema-lore-journal.png" });
  await page.click("#panel-close");
  // The new cuff detail is a genuine viewpoint-dependent photographic clue.
  const s = newStory();
  s.items.ticket = true;
  s.events.jamRepaired = true;
  s.evidence.first = "old";
  s.patron = { x: 12, z: -3.1, awakened: true, distance: 3 };
  saved = s;
  await load(11.8, -4.8, 12, 4.7, -3.1);
  const wrist = (await d()).targets.watch;
  await load(11.8, -4.8, wrist.x, wrist.y, wrist.z);
  assert((await d()).targets.watch.eligible, "Cuff visible from the front");
  await page.keyboard.press("c");
  assert((await d()).state.evidence.watch);
  await page.waitForFunction(() => window.cinemaDiagnostics.develop <= 0);
  await page.screenshot({ path: "artifacts/cinema-cuff-print.png" });
  await load(12, -1.5, wrist.x, wrist.y, wrist.z);
  assert.equal(
    (await d()).targets.watch.eligible,
    false,
    "Back of sleeve cannot award the watch clue",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: clear lobby openings, mounted sign geometry, five reachable saved records, journal, and actual cuff-photo framing.",
  );
} finally {
  await browser.close();
}
