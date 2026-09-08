import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { newStory } from "../src/cinema/logic.js";
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(60000);
await page.addInitScript(() => {
  const s = sessionStorage.getItem("cinema.photo.fixture");
  if (s) {
    localStorage.setItem("polaroid.last-showing.v1", s);
    sessionStorage.removeItem("cinema.photo.fixture");
  }
});
await page.goto(base + "/?chapter=last-showing");
async function load(s) {
  await page.evaluate(
    (s) => sessionStorage.setItem("cinema.photo.fixture", JSON.stringify(s)),
    s,
  );
  await page.reload();
  await page.click("#enter-story");
  await page.waitForFunction(() => window.cinemaDiagnostics.mode === "playing");
}
try {
  let s = newStory();
  s.items = { splice: true, ticket: true };
  s.events = { firstJam: true, jamRepaired: true };
  s.checkpoint = { x: 0, z: 8, yaw: 0, pitch: 0 };
  await load(s);
  await page.keyboard.press("c");
  await page.waitForFunction(
    () => window.cinemaDiagnostics.state.events.impossible,
  );
  assert.equal(
    (await page.evaluate(() => window.cinemaDiagnostics)).state.photos.length,
    2,
  );
  await page.waitForFunction(() => window.cinemaDiagnostics.develop === 0);
  await page.keyboard.press("r");
  await page.screenshot({ path: "artifacts/cinema-impossible.png" });
  s = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("polaroid.last-showing.v1")),
  );
  await load(s);
  await page.keyboard.press("c");
  await page.waitForFunction(
    () => window.cinemaDiagnostics.state.photos.length === 3,
  );
  assert.equal(
    (await page.evaluate(() => window.cinemaDiagnostics)).state.photos.filter(
      (p) => p.caption.startsWith("An impossible"),
    ).length,
    1,
  );
  s = newStory();
  s.items = { reference: true };
  s.events = { jamRepaired: true };
  s.reels.push("incident");
  s.activeReel = "incident";
  s.checkpoint = { x: -11.6, z: -18, yaw: Math.PI / 2, pitch: -0.062 };
  await page.evaluate(() =>
    localStorage.setItem(
      "polaroid.settings.v1",
      JSON.stringify({ quality: "low", subtitles: false }),
    ),
  );
  await load(s);
  await page.keyboard.press("c");
  await page.waitForFunction(
    () => window.cinemaDiagnostics.state.evidence.doorway,
  );
  assert.equal(
    (await page.evaluate(() => window.cinemaDiagnostics)).state.photos[0].reel,
    "incident",
  );
  s = newStory();
  s.items = { ticket: true };
  s.events = {
    released: true,
    climax: true,
    jamRepaired: true,
    firstJam: true,
  };
  s.doors.exit = true;
  s.evidence.doorway = "fixture";
  s.patron = { x: -17, z: -18, awakened: true, distance: 30 };
  s.reels.push("complete");
  s.activeReel = "complete";
  s.checkpoint = { x: -11.6, z: -18, yaw: Math.PI / 2, pitch: -0.054 };
  await load(s);
  await page.keyboard.press("c");
  await page.waitForFunction(
    () => window.cinemaDiagnostics.state.evidence.final,
  );
  await page.keyboard.press("q");
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.cinemaDiagnostics.state.completed);
  await page.keyboard.up("w");
  await page.screenshot({ path: "artifacts/cinema-ending.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: impossible exposure renders once, reduced effects preserve photographic clues, final rendered print and keyboard exit.",
  );
} finally {
  await browser.close();
}
