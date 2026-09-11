// The portable NSIS wrapper does not forward Electron's inspector pipe, so
// attach to its local Chromium port instead of using Playwright's Electron loader.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const server = createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const profile = await mkdtemp(path.resolve("artifacts/portable-profile-"));
const env = { ...process.env, POLAROID_TEST_PROFILE: profile };
delete env.ELECTRON_RUN_AS_NODE;
const executable = path.resolve("release/POLAROID-1.0.0-Windows-Portable.exe");
const child = spawn(
  executable,
  [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1"],
  { env, stdio: "ignore", windowsHide: false },
);
let browser;
try {
  const started = Date.now();
  while (!browser && Date.now() - started < 60000) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
        timeout: 1000,
      });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  assert(browser, "Portable application must launch its bundled runtime");
  const page = browser.contexts()[0].pages()[0];
  page.setDefaultTimeout(60000);
  await page.locator(".chapter-grid").waitFor();
  assert.equal(await page.locator(".chapter-card").count(), 3);
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  console.log("Portable menu loaded from", page.url());
  await page.locator('.chapter-card.vacancy a[href*="play=new"]').click();
  await page.click("#enter-vacancy");
  await page.waitForFunction(
    () => window.vacancyDiagnostics?.mode === "playing",
  );
  await page.keyboard.press("c");
  await page.waitForFunction(
    () => window.vacancyDiagnostics.state.photos.length === 1,
  );
  await page.keyboard.press("p");
  await page.click("#stories");
  await page.locator(".chapter-grid").waitFor();
  assert(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("polaroid.vacancy.v1")).photos
          .length === 1,
    ),
  );
  await page.screenshot({ path: "artifacts/portable-menu.png" });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  await page.click("#desktop-quit").catch(() => {});
  await Promise.race([
    exited,
    new Promise((_resolve, reject) =>
      setTimeout(
        () => reject(new Error("Portable wrapper did not exit")),
        15000,
      ).unref(),
    ),
  ]);
  console.log(
    "PASS: portable executable extracts, launches offline, plays Vacancy, saves a real print and exits normally.",
  );
} finally {
  for (const context of browser?.contexts() || [])
    for (const page of context.pages())
      await page.evaluate(() => window.polaroidDesktop?.quit()).catch(() => {});
  await browser?.close().catch(() => {});
  if (child.exitCode === null) child.kill();
}
