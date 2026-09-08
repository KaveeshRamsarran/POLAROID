import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { newState } from "../src/logic.js";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const s = newState(7);
s.checkpoint = { x: 0, z: -13, yaw: 0 };
s.evidence = { writing: { image: "" }, mirror: { image: "" } };
await page.addInitScript(
  (s) => localStorage.setItem("polaroid.save.v1", JSON.stringify(s)),
  s,
);
try {
  await page.goto((process.argv[2] || "http://127.0.0.1:3000") + "?chapter=blackwood");
  await page.locator("#loading").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "02 CONTINUE" }).click();
  await page.keyboard.down("Shift");
  await page.keyboard.down("w");
  await page.waitForFunction(
    () =>
      window.polaroidDiagnostics.ai === "INVESTIGATING" ||
      window.polaroidDiagnostics.ai === "CHASING",
  );
  await page.keyboard.up("w");
  await page.keyboard.up("Shift");
  await page.waitForFunction(() => window.polaroidDiagnostics.ai === "CHASING");
  await page.screenshot({ path: "artifacts/observer.png" });
  await page
    .getByRole("button", { name: "RETURN TO LAST MEMORY" })
    .waitFor({ state: "visible", timeout: 45000 });
  await page.screenshot({ path: "artifacts/death.png" });
  await page.getByRole("button", { name: "RETURN TO LAST MEMORY" }).click();
  assert.equal(
    (await page.evaluate(() => window.polaroidDiagnostics)).mode,
    "playing",
  );
  assert.equal(
    (await page.evaluate(() => window.polaroidDiagnostics)).evidence.length,
    2,
  );
  console.log("CHASE, DEATH AND CHECKPOINT RECOVERY PASSED");
} catch (error) {
  console.log(await page.evaluate(() => window.polaroidDiagnostics));
  await page.screenshot({ path: "artifacts/death-test-failure.png" });
  throw error;
} finally {
  await browser.close();
}
