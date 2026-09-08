import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() =>
  window.addEventListener("beforeunload", (e) => e.stopImmediatePropagation(), {
    capture: true,
  }),
);
async function checkpoint(x, z, yaw, patch = {}) {
  await page.evaluate(
    ({ x, z, yaw, patch }) => {
      const s = JSON.parse(localStorage.getItem("polaroid.save.v1"));
      Object.assign(s, patch);
      s.checkpoint = { x, z, yaw };
      localStorage.setItem("polaroid.save.v1", JSON.stringify(s));
    },
    { x, z, yaw, patch },
  );
  await page.reload();
  await page.locator("#loading").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "02 CONTINUE" }).click();
}
async function down(pitch) {
  await page.keyboard.down("ArrowDown");
  await page.waitForFunction(
    (pitch) => window.polaroidDiagnostics.pitch < pitch,
    pitch,
  );
  await page.keyboard.up("ArrowDown");
}
try {
  await page.goto(process.argv[2] || "http://127.0.0.1:3000");
  await page.locator("#loading").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "03 SETTINGS" }).click();
  await page.getByLabel("Master volume").fill("0.25");
  await page.getByLabel("Graphics quality").selectOption("medium");
  await page.getByRole("button", { name: "ESC / CLOSE" }).click();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("polaroid.settings.v1")).master,
    ),
    0.25,
  );
  await page.getByRole("button", { name: "01 NEW GAME" }).click();
  await checkpoint(-3.2, 7, 0);
  await page.keyboard.press("e");
  assert.match(await page.locator("#stance").innerText(), /HIDDEN/);
  await page.screenshot({ path: "artifacts/hiding.png" });
  await page.keyboard.press("e");
  assert.doesNotMatch(await page.locator("#stance").innerText(), /HIDDEN/);
  console.log("Hiding and exit passed");
  await checkpoint(5.7, 11.8, 0);
  await down(-0.42);
  await page.keyboard.press("e");
  assert.equal(
    (await page.evaluate(() => window.polaroidDiagnostics)).film,
    12,
  );
  console.log("Film pickup passed");
  await checkpoint(0.75, 12.4, Math.PI, { film: 0 });
  await down(-0.78);
  await page.keyboard.press("e");
  assert.equal((await page.evaluate(() => window.polaroidDiagnostics)).film, 4);
  console.log("Emergency film recovery passed");
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "SAVE & RETURN TO MENU" }).click();
  await page.reload();
  await page.locator("#loading").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "02 CONTINUE" }).click();
  assert.equal((await page.evaluate(() => window.polaroidDiagnostics)).film, 4);
  console.log("Save/reload passed");
  const samples = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const t = [];
        let last = performance.now();
        function tick(now) {
          t.push(now - last);
          last = now;
          if (t.length < 120) requestAnimationFrame(tick);
          else resolve(t.slice(10));
        }
        requestAnimationFrame(tick);
      }),
  );
  samples.sort((a, b) => a - b);
  console.log(
    "Frame timings",
    JSON.stringify({
      medianMs: samples[Math.floor(samples.length * 0.5)],
      p95Ms: samples[Math.floor(samples.length * 0.95)],
    }),
  );
  assert.deepEqual(errors, []);
  console.log("SYSTEMS PASSED");
} catch (e) {
  console.log(await page.evaluate(() => window.polaroidDiagnostics));
  console.log(await page.locator("#interaction").innerText());
  await page.screenshot({ path: "artifacts/systems-failure.png" });
  throw e;
} finally {
  await browser.close();
}
