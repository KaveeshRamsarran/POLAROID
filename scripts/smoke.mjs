import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
await fs.mkdir("artifacts", { recursive: true });
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
await page.goto((process.argv[2] || "http://127.0.0.1:3000") + "?chapter=blackwood");
await page.locator("#loading").waitFor({ state: "hidden", timeout: 30000 });
await page.screenshot({ path: "artifacts/menu.png" });
console.log("menu", await page.evaluate(() => window.polaroidDiagnostics));
await page.getByRole("button", { name: "01 NEW GAME" }).click();
await page.waitForTimeout(1500);
console.log("started", await page.evaluate(() => window.polaroidDiagnostics));
await page.screenshot({ path: "artifacts/gameplay.png" });
await page.keyboard.press("c");
await page.waitForFunction(
  () =>
    window.polaroidDiagnostics.film === 7 &&
    !window.polaroidDiagnostics.photoBusy,
  {},
  { timeout: 90000 },
);
console.log("photo", await page.evaluate(() => window.polaroidDiagnostics));
await page.screenshot({ path: "artifacts/photo.png" });
await page.keyboard.press("j");
console.log("journal", await page.locator("#overlay").innerText());
console.log("errors", errors);
await browser.close();
if (errors.length) process.exitCode = 1;
