import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { newStory } from "../src/vacancy/logic.js";
const base = process.argv[2] || "http://127.0.0.1:3102";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await fs.mkdir("artifacts", { recursive: true });
const views = {
  courtyard: [-0.5, 16, 0.05, -0.03],
  reception: [-8, 12, 1.15, -0.07],
  laundry: [-9, 2.7, -0.65, -0.05],
  room: [5, -10.6, 0, -0.12],
  walkway: [-3.8, -7.4, -1.57, -0.07],
};
try {
  for (const [name, [x, z, yaw, pitch]] of Object.entries(views)) {
    const s = newStory();
    s.checkpoint = { x, z, yaw, pitch };
    s.items = { roomKey: true, bag: true, called: true, family: true };
    s.doors.room6 = true;
    await page.addInitScript(
      (s) => localStorage.setItem("polaroid.vacancy.v1", JSON.stringify(s)),
      s,
    );
    await page.goto(base + "/?chapter=vacancy");
    await page.locator("#enter-vacancy").waitFor({ timeout: 60000 });
    await page.click("#enter-vacancy");
    await page.waitForFunction(
      () =>
        vacancyDiagnostics.state.elapsed > 1.5 &&
        Number(document.querySelector("#flash").style.opacity) === 0,
    );
    console.log(
      name,
      await page.evaluate(() => ({
        p: vacancyDiagnostics.player,
        targets: vacancyDiagnostics.targets,
        memory: vacancyDiagnostics.renderer,
      })),
    );
    await page.screenshot({ path: `artifacts/vacancy-${name}.png` });
    if (name === "courtyard" && !process.argv.includes("--no-art")) {
      await page.evaluate(() => {
        document.querySelector("#hud").hidden = true;
        document.querySelector(".vacancy-warning").hidden = true;
      });
      await fs.mkdir("public/chapter-art", { recursive: true });
      await page.screenshot({
        path: "public/chapter-art/vacancy.jpg",
        type: "jpeg",
        quality: 90,
        clip: { x: 0, y: 50, width: 1440, height: 540 },
      });
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
