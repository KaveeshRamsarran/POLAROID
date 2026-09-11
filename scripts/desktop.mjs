import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseBackup } from "../src/shared/save-transfer.js";

await mkdir("artifacts", { recursive: true });
const profile = await mkdtemp(path.resolve("artifacts/desktop-profile-"));
const executablePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : undefined;
const environment = { ...process.env, POLAROID_TEST_PROFILE: profile };
delete environment.ELECTRON_RUN_AS_NODE;
const launch = () =>
  electron.launch({
    ...(executablePath ? { executablePath, args: [] } : { args: ["."] }),
    env: environment,
    timeout: 60000,
  });
const keys = [
  "polaroid.save.v1",
  "polaroid.last-showing.v1",
  "polaroid.vacancy.v1",
];
let app = await launch();
const errors = [],
  timings = [];
const setup = async () => {
  const page = await app.firstWindow();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.locator(".chapter-grid").waitFor();
  console.log("Desktop menu loaded.");
  return page;
};
try {
  let page = await setup();
  assert.equal(await page.locator(".chapter-card").count(), 3);
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  assert.equal(await page.evaluate(() => typeof window.process), "undefined");
  assert.equal(
    await app.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()
          .sandbox,
    ),
    true,
  );
  console.log("Checking fullscreen.");
  await page.click("#fullscreen-button");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#fullscreen-button")
        .getAttribute("aria-pressed") === "true",
  );
  assert(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isFullScreen(),
    ),
  );
  console.log("Entered fullscreen.");
  await app.evaluate(({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    BrowserWindow.getAllWindows()[0].focus();
    contents.sendInputEvent({ type: "keyDown", keyCode: "F11" });
    contents.sendInputEvent({ type: "keyUp", keyCode: "F11" });
  });
  console.log(
    "Native shortcut sent.",
    await app.evaluate(({ BrowserWindow }) => ({
      fullscreen: BrowserWindow.getAllWindows()[0].isFullScreen(),
      visible: BrowserWindow.getAllWindows()[0].isVisible(),
      focused: BrowserWindow.getAllWindows()[0].isFocused(),
    })),
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector("#fullscreen-button")
        .getAttribute("aria-pressed") === "false",
  );
  console.log("Fullscreen passed.");
  await page.click("#anthology-settings");
  await page.locator('[data-setting="effects"]').fill("0.45");
  await page.click("#anthology-close");
  for (const [chapter, enter, diagnostic, pause, stories] of [
    ["blackwood", "#enter-blackwood", "polaroidDiagnostics", "p", "#save-exit"],
    ["cinema", "#enter-story", "cinemaDiagnostics", "Escape", "#stories"],
    ["vacancy", "#enter-vacancy", "vacancyDiagnostics", "p", "#stories"],
  ]) {
    console.log("Testing chapter:", chapter);
    const prior = await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      keys,
    );
    await page.locator(`.chapter-card.${chapter} a[href*="play=new"]`).click();
    await page.click(enter);
    await page.waitForFunction(
      (key) => window[key]?.mode === "playing",
      diagnostic,
    );
    // Actual pointer lock, scene capture and GPU frame delivery in the app.
    await page
      .locator("#world")
      .click({ position: { x: 700, y: 350 }, force: true });
    await page.waitForFunction(() => !!document.pointerLockElement);
    await page.keyboard.press("c");
    await page.waitForFunction(() =>
      document.querySelector("#photo-image")?.src.startsWith("data:image/"),
    );
    await page.waitForTimeout(2200);
    const sample = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let previous;
          const samples = [];
          function frame(time) {
            if (previous) samples.push(time - previous);
            previous = time;
            if (samples.length < 120) requestAnimationFrame(frame);
            else {
              samples.sort((a, b) => a - b);
              resolve({ median: samples[60], p95: samples[114] });
            }
          }
          requestAnimationFrame(frame);
        }),
    );
    const renderer = await page.evaluate(() => {
      const gl = document.querySelector("#world").getContext("webgl2");
      if (!gl || gl.isContextLost())
        throw new Error("WebGL context unavailable");
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return info
        ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
    });
    const gpu = await app.evaluate(({ app }) => app.getGPUFeatureStatus());
    timings.push({ chapter, renderer, gpu, ...sample });
    console.log("Rendered:", chapter, renderer, sample);
    await page.keyboard.press(pause);
    await page.screenshot({ path: `artifacts/desktop-${chapter}.png` });
    await page.click(stories);
    await page.locator(".chapter-grid").waitFor();
    const current = await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      keys,
    );
    const index = ["blackwood", "cinema", "vacancy"].indexOf(chapter);
    assert(current[index]);
    keys.forEach((_key, i) => {
      if (i !== index) assert.equal(current[i], prior[i]);
    });
    assert.equal(
      await page.evaluate((key) => typeof window[key], diagnostic),
      "undefined",
    );
  }
  const saved = await page.evaluate(
    (keys) => keys.map((key) => localStorage.getItem(key)),
    keys,
  );
  // Export/import uses the same UI as the browser; file access requires a gesture.
  const backupPath = path.resolve("artifacts/desktop-save-backup.json");
  await app.evaluate(({ session }, backupPath) => {
    globalThis.__downloadComplete = new Promise((resolve) => {
      session.defaultSession.once("will-download", (_event, item) => {
        item.setSavePath(backupPath);
        item.once("done", (_event, state) => resolve(state));
      });
    });
  }, backupPath);
  await page.click("#anthology-saves");
  await page.click("#export-saves");
  console.log("Export requested.");
  assert.equal(
    await app.evaluate(() => globalThis.__downloadComplete),
    "completed",
  );
  const backup = parseBackup(await readFile(backupPath, "utf8"));
  for (const key of [...keys, "polaroid.settings.v1"])
    assert(backup.saves[key]);
  await page.setInputFiles("#save-file", backupPath);
  await page.getByText("RESTORE SELECTED SAVES", { exact: true }).click();
  await page.locator(".chapter-grid").waitFor();
  assert.deepEqual(
    await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      keys,
    ),
    saved,
  );
  await page.screenshot({ path: "artifacts/desktop-menu.png" });
  // Native close exercises the chapters' existing unload save path.
  await page.locator('.chapter-card.vacancy a[href*="play=continue"]').click();
  await page.click("#enter-vacancy");
  await page.waitForFunction(
    () => window.vacancyDiagnostics?.mode === "playing",
  );
  await page.keyboard.press("c");
  await page.waitForFunction(
    () => window.vacancyDiagnostics.state.photos.length >= 2,
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close(),
  );
  await app.close();
  app = await launch();
  page = await setup();
  const restored = await page.evaluate(
    (keys) => keys.map((key) => JSON.parse(localStorage.getItem(key))),
    keys,
  );
  assert(
    restored[2].photos.length >= 2,
    "closing the native window persists the latest photograph",
  );
  assert.equal(restored[0].film, JSON.parse(saved[0]).film);
  assert.equal(restored[1].photos.length, JSON.parse(saved[1]).photos.length);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("polaroid.settings.v1")).effects,
    ),
    0.45,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/desktop-validation.json",
    JSON.stringify(
      {
        executablePath: executablePath || "development Electron",
        timings,
        checks:
          "three chapters, offline assets, sandbox, fullscreen, pointer lock, actual photos, independent saves, export/import, native close and restart persistence",
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: Electron desktop launch, all chapters, actual photographs, save transfer, restart persistence, fullscreen and GPU rendering.",
    JSON.stringify(timings),
  );
} catch (error) {
  console.error("Desktop verification failed:", error);
  throw error;
} finally {
  await app.close().catch(() => {});
}
