import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { floorAt } from "../src/vacancy/logic.js";
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.setDefaultTimeout(60000);
await page.addInitScript(() =>
  window.addEventListener("beforeunload", (e) => e.stopImmediatePropagation(), {
    capture: true,
  }),
);
const diag = () => page.evaluate(() => vacancyDiagnostics);
async function enter() {
  await page.locator("#enter-vacancy").waitFor();
  await page.click("#enter-vacancy");
  await page.waitForFunction(() => vacancyDiagnostics.mode === "playing");
}
async function aim(x, z, id, photo = false, patch = {}) {
  const d = await diag(),
    t = photo ? d.targets[id] : d.interactions.find((t) => t.id === id);
  assert(t, `No target ${id}`);
  const dx = t.x - x,
    dz = t.z - z,
    dy = t.y - (floorAt(x, z) + 1.64);
  await page.evaluate(
    ({ x, z, yaw, pitch, patch }) => {
      const s = JSON.parse(localStorage.getItem("polaroid.vacancy.v1"));
      Object.assign(s, patch);
      s.checkpoint = { x, z, yaw, pitch };
      localStorage.setItem("polaroid.vacancy.v1", JSON.stringify(s));
    },
    {
      x,
      z,
      yaw: Math.atan2(-dx, -dz),
      pitch: Math.atan2(dy, Math.hypot(dx, dz)),
      patch,
    },
  );
  await page.reload();
  await enter();
  const after = await diag();
  assert(
    Math.hypot(after.player.x - x, after.player.z - z) < 0.1,
    `Blocked checkpoint ${id}: ${JSON.stringify(after.player)}`,
  );
}
async function use(x, z, id, field) {
  await aim(x, z, id);
  await page.keyboard.press("e");
  await page.waitForTimeout(80);
  if (field)
    assert(
      (await diag()).state.items[field],
      `Interaction ${id} failed: ${await page.locator("#interaction").textContent()}`,
    );
  if (await page.locator("#panel-close").isVisible())
    await page.click("#panel-close");
  console.log("INTERACT", id);
}
async function shoot(x, z, id) {
  await aim(x, z, id, true);
  assert((await diag()).targets[id].eligible, `Clue not eligible: ${id}`);
  await page.keyboard.press("c");
  await page.waitForFunction(
    (id) => !!vacancyDiagnostics.state.evidence[id],
    id,
  );
  await page.waitForFunction(() => vacancyDiagnostics.develop === 0);
  assert((await diag()).state.photos.at(-1).imageLength > 10000);
  await page.screenshot({ path: `artifacts/vacancy-print-${id}.png` });
  console.log("CAPTURE", id);
}
try {
  await fs.mkdir("artifacts", { recursive: true });
  await page.goto(base + "/?chapter=vacancy&play=new");
  await enter();
  // Test traversable routes using the actual generated collision world.
  for (const target of [
    { x: -9.5, z: 10 },
    { x: -9, z: 2 },
    { x: -4.5, z: -7.5 },
  ]) {
    assert(
      await page.evaluate(
        (t) => vacancyNavigation.path({ x: -0.5, z: 16 }, t).length,
        target,
      ),
      `No route to ${JSON.stringify(target)}`,
    );
  }
  await use(-9.5, 9.8, "bell", "roomKey");
  await aim(5, -7.6, "door:room6");
  await page.keyboard.press("e");
  assert((await diag()).state.doors.room6);
  await page.keyboard.down("w");
  await page.waitForTimeout(950);
  await page.keyboard.up("w");
  assert(
    (await diag()).player.z < -9,
    "Must walk through the actual room doorway",
  );
  await use(3.3, -11, "bag", "bag");
  await use(6.7, -12.4, "phone", "called");
  await use(6.7, -12.4, "family", "family");
  await shoot(4.5, -10.2, "suitcase");
  await shoot(-7.4, 2.2, "laundry");
  await shoot(6, -1.7, "pool");
  await use(6, -1.5, "key", "key");
  await use(-11, 9.6, "page", "page");
  await shoot(6, -12, "doorway");
  await aim(6.6, -12, "door:room7");
  await page.keyboard.press("e");
  assert((await diag()).state.doors.room7);
  await use(12.7, -12.3, "locket", "locket");
  await aim(0.5, 16, "car");
  await page.keyboard.press("e");
  assert((await diag()).state.events.departure);
  await shoot(0.5, 15.6, "final");
  await page.keyboard.press("q");
  await aim(0.5, 16, "car");
  await page.keyboard.press("e");
  await page.locator("#ending-stories").waitFor();
  assert((await diag()).state.completed);
  await page.screenshot({ path: "artifacts/vacancy-ending.png" });
  await page.click("#ending-stories");
  await page.locator(".chapter-card.vacancy").waitFor();
  assert.match(
    await page.locator(".chapter-card.vacancy").textContent(),
    /STORY COMPLETED/,
  );
  assert.deepEqual(errors, []);
  console.log("VACANCY FULL PROGRESSION PASSED");
} catch (e) {
  console.log(await diag().catch(() => null));
  await page.screenshot({ path: "artifacts/vacancy-failure.png" });
  throw e;
} finally {
  await browser.close();
}
