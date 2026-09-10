import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { newStory } from "../src/vacancy/logic.js";
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(90000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const diag = () => page.evaluate(() => vacancyDiagnostics);
async function look(yaw, pitch = 0) {
  const d = await diag();
  await page.evaluate(
    ({ dx, dy }) => {
      if (!document.pointerLockElement)
        document
          .querySelector("#world")
          .dispatchEvent(
            new MouseEvent("mousedown", { button: 0, bubbles: true }),
          );
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          movementX: dx,
          movementY: dy,
          bubbles: true,
        }),
      );
    },
    { dx: (d.player.yaw - yaw) / 0.002, dy: (d.player.pitch - pitch) / 0.002 },
  );
}
async function walk(x, z) {
  for (let i = 0; i < 35; i++) {
    const d = await diag(),
      dx = x - d.player.x,
      dz = z - d.player.z;
    if (Math.hypot(dx, dz) < 0.2) return;
    assert.equal(d.mode, "playing", "The route must remain escapable");
    await look(Math.atan2(-dx, -dz));
    await page.keyboard.down("Shift");
    await page.keyboard.down("w");
    await page.waitForTimeout(Math.min(240, (Math.hypot(dx, dz) / 4.3) * 1000));
    await page.keyboard.up("w");
    await page.keyboard.up("Shift");
  }
  throw new Error(
    `Blocked while walking toward ${x}, ${z}: ${JSON.stringify((await diag()).player)}`,
  );
}
try {
  await page.goto(base);
  await page.click("#fullscreen-button");
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.click("#fullscreen-button");
  await page.waitForFunction(() => !document.fullscreenElement);
  const s = newStory();
  s.items = {
    roomKey: true,
    called: true,
    family: true,
    key: true,
    page: true,
  };
  s.evidence = { suitcase: "p1", laundry: "p2", pool: "p3", doorway: "p4" };
  s.doors.room6 = true;
  s.checkpoint = { x: 6.6, z: -12, yaw: -Math.PI / 2, pitch: 0 };
  await page.evaluate(
    (s) => localStorage.setItem("polaroid.vacancy.v1", JSON.stringify(s)),
    s,
  );
  await page.goto(base + "/?chapter=vacancy&play=continue");
  await page.click("#enter-vacancy");
  await page.keyboard.press("e");
  assert((await diag()).state.doors.room7);
  // No further checkpoint repositioning: walk through the real room and out.
  await walk(8.8, -12);
  await walk(10.9, -11.35);
  await look(Math.atan2(-(11.5 - 10.9), -(-10.25 + 11.35)), -0.45);
  await page.screenshot({ path: "artifacts/vacancy-writing-desk.png" });
  await page.keyboard.press("e");
  await page.locator("#panel-close").waitFor();
  assert(
    (await diag()).state.items.locket,
    "The visible letter must advance the chapter",
  );
  await page.click("#panel-close");
  for (const [x, z] of [
    [9.6, -12.05],
    [8.8, -12],
    [7.25, -12],
    [5, -11.3],
    [5, -7.5],
    [-4.5, -7.5],
    [-4.5, 4],
    [-0.5, 13],
    [0.5, 16],
  ])
    await walk(x, z);
  assert((await diag()).state.events.departure);
  const d = await diag(),
    t = d.targets.final;
  await look(
    Math.atan2(d.player.x - t.x, d.player.z - t.z),
    Math.atan2(
      t.y - d.player.y,
      Math.hypot(t.x - d.player.x, t.z - d.player.z),
    ),
  );
  await page.keyboard.press("c");
  await page.waitForFunction(() => !!vacancyDiagnostics.state.evidence.final);
  await page.waitForFunction(() => vacancyDiagnostics.develop === 0);
  await page.screenshot({ path: "artifacts/vacancy-polished-final.png" });
  await look(-Math.PI / 2, -0.3);
  await page.keyboard.press("e");
  await page.locator("#ending-stories").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: fullscreen enter/exit, continuous Room 7 doorway-to-desk-to-car walk, final photograph and ending",
  );
} catch (e) {
  console.log(await diag().catch(() => null));
  await page.screenshot({ path: "artifacts/vacancy-polish-failure.png" });
  throw e;
} finally {
  await browser.close();
}
