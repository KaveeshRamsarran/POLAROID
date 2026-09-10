import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { newStory } from "../src/cinema/logic.js";
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
async function readable() {
  await page.waitForTimeout(300);
  const bright = await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 40;
    const ctx = c.getContext("2d");
    ctx.drawImage(document.querySelector("#world"), 0, 0, 64, 40);
    const pixels = ctx.getImageData(0, 0, 64, 40).data;
    let lit = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 30) lit++;
    return lit;
  });
  assert(
    bright > 150,
    "The presented scene must contain visible geometry, not a blank shader output",
  );
  assert.match(
    await page
      .locator("#subtitle")
      .evaluate((e) => getComputedStyle(e).fontFamily),
    /Arial/,
  );
}
try {
  await page.goto(base);
  await page.locator(".chapter-card.cinema").hover();
  await page.waitForTimeout(900);
  await page.screenshot({ path: "artifacts/analog-menu.png" });
  const s = newStory();
  s.checkpoint = { x: 11, z: -5, yaw: 0.9, pitch: -0.2 };
  s.items = { ticket: true };
  s.events = { jamRepaired: true };
  s.patron = { x: 12.5, z: -3.5, awakened: true, distance: 3 };
  await page.evaluate(
    (s) => localStorage.setItem("polaroid.last-showing.v1", JSON.stringify(s)),
    s,
  );
  await page.goto(base + "/?chapter=last-showing");
  await page.click("#enter-story");
  await readable();
  assert(
    await page
      .locator("body")
      .evaluate((e) => e.classList.contains("analog-picture")),
  );
  await page.screenshot({ path: "artifacts/analog-cinema.png" });
  await page.keyboard.press("Escape");
  await page.click("#stories");
  const portrait = newStory();
  portrait.checkpoint = {
    x: 11.8,
    z: -4.8,
    yaw: Math.atan2(-0.2, -1.7),
    pitch: 0.04,
  };
  portrait.items = { ticket: true };
  portrait.events = { jamRepaired: true };
  portrait.patron = { x: 12, z: -3.1, awakened: true, distance: 3 };
  await page.evaluate(
    (s) => localStorage.setItem("polaroid.last-showing.v1", JSON.stringify(s)),
    portrait,
  );
  await page.goto(base + "/?chapter=last-showing");
  await page.click("#enter-story");
  await readable();
  await page.screenshot({ path: "artifacts/analog-patron.png" });
  await page.keyboard.press("Escape");
  await page.click("#stories");
  await page.click("#anthology-settings");
  await page.locator('[data-setting="retroEffects"]').uncheck();
  await page.click("#anthology-close");
  await page.goto(base + "/?chapter=blackwood&play=new");
  await page.click("#enter-blackwood");
  await page.waitForFunction(
    () => window.polaroidDiagnostics.mode === "playing",
  );
  await readable();
  assert.equal(
    await page
      .locator("body")
      .evaluate((e) => e.classList.contains("analog-picture")),
    false,
  );
  await page.keyboard.press("p");
  await page.click("#save-exit");
  await page.click("#anthology-settings");
  await page.locator('[data-setting="retroEffects"]').check();
  await page.click("#anthology-close");
  await page.goto(base + "/?chapter=blackwood&play=continue");
  await page.click("#enter-blackwood");
  await page.waitForFunction(
    () => window.polaroidDiagnostics.mode === "playing",
  );
  await readable();
  assert(
    await page
      .locator("body")
      .evaluate((e) => e.classList.contains("analog-picture")),
  );
  await page.screenshot({ path: "artifacts/analog-blackwood.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: scene pixels and shader compilation, typography, both chapters, and shared analog-effect toggle.",
  );
} finally {
  await browser.close();
}
