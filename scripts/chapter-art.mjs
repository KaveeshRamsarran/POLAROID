import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { newStory } from "../src/cinema/logic.js";
const base = process.argv[2] || "http://127.0.0.1:3001";
const chapter = process.argv[3]; // Optional: refresh one chapter without changing the other.
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await fs.mkdir("public/chapter-art", { recursive: true });
try {
  if (!chapter || chapter === "last-showing") {
    const s = newStory();
    s.checkpoint = { x: 0, z: 2, yaw: 0, pitch: -0.09 };
    await page.addInitScript(
      (save) =>
        localStorage.setItem("polaroid.last-showing.v1", JSON.stringify(save)),
      s,
    );
    await page.goto(base + "/?chapter=last-showing");
    await page.click("#enter-story");
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      document.querySelector("#hud").hidden = true;
      document.querySelector("#subtitle").style.display = "none";
      document.querySelector(".projector-status").style.display = "none";
    });
    await page.screenshot({
      path: "public/chapter-art/cinema.jpg",
      type: "jpeg",
      quality: 90,
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });
  }
  if (!chapter || chapter === "blackwood") {
    await page.goto(base + "/?chapter=blackwood");
    await page.locator("#loading").waitFor({ state: "hidden", timeout: 60000 });
    await page.click("#new-game");
    await page.waitForTimeout(1500);
    await fs.mkdir("artifacts", { recursive: true });
    await page.screenshot({ path: "artifacts/blackwood-home.png" });
    await page.evaluate(
      () => (document.querySelector("#hud").style.display = "none"),
    );
    await page.screenshot({
      path: "public/chapter-art/blackwood.jpg",
      type: "jpeg",
      quality: 90,
      clip: { x: 0, y: 75, width: 1440, height: 550 },
    });
  }
} finally {
  await browser.close();
}
console.log("Rendered chapter artwork saved.");
