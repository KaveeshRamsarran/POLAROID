import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

// Run alone: concurrent headless games distort frame-time measurements.
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const results = [];
try {
  for (const [chapter, button, diagnostic] of [
    ["blackwood", "#enter-blackwood", "polaroidDiagnostics"],
    ["last-showing", "#enter-story", "cinemaDiagnostics"],
    ["vacancy", "#enter-vacancy", "vacancyDiagnostics"],
  ]) {
    for (const quality of ["high", "low"]) {
      const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
        }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.addInitScript((quality) => {
        localStorage.setItem(
          "polaroid.settings.v1",
          JSON.stringify({ quality }),
        );
        window.measuredDraws = 0;
        for (const Type of [WebGLRenderingContext, WebGL2RenderingContext])
          for (const name of [
            "drawArrays",
            "drawElements",
            "drawArraysInstanced",
            "drawElementsInstanced",
          ]) {
            const original = Type.prototype[name];
            if (!original) continue;
            Type.prototype[name] = function (...args) {
              window.measuredDraws++;
              return original.apply(this, args);
            };
          }
      }, quality);
      const start = Date.now();
      await page.goto(base + "/?chapter=" + chapter + "&play=new");
      await page.locator(button).waitFor({ timeout: 60000 });
      const loadMs = Date.now() - start;
      await page.click(button);
      await page.waitForFunction(
        (name) => window[name]?.mode === "playing",
        diagnostic,
      );
      await page.waitForTimeout(5000);
      await page.keyboard.down("ArrowRight");
      const measured = await page.evaluate(async () => {
        const samples = [],
          before = window.measuredDraws;
        let previous = await new Promise(requestAnimationFrame);
        for (let i = 0; i < 300; i++) {
          const now = await new Promise(requestAnimationFrame);
          samples.push(now - previous);
          previous = now;
        }
        samples.sort((a, b) => a - b);
        const canvas = document.querySelector("#world"),
          gl = canvas.getContext("webgl2"),
          debug = gl.getExtension("WEBGL_debug_renderer_info");
        return {
          medianMs: samples[150],
          p95Ms: samples[285],
          maxMs: samples[299],
          drawsPerFrame: (window.measuredDraws - before) / 300,
          renderSize: [canvas.width, canvas.height],
          gpu: debug
            ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER),
        };
      });
      await page.keyboard.up("ArrowRight");
      assert.deepEqual(errors, []);
      assert(measured.drawsPerFrame > 0);
      assert(measured.renderSize[1] <= 1080);
      const row = { chapter, quality, loadMs, ...measured };
      results.push(row);
      console.log(JSON.stringify(row));
      await context.close();
    }
  }
  await fs.writeFile(
    "artifacts/presentation-performance.json",
    JSON.stringify(
      {
        viewport: [1440, 900],
        method:
          "300 warmed RAF intervals while turning, isolated headless Chrome, per chapter and quality",
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
