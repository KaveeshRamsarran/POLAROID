import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.addInitScript(() => {
    window.drawCount = 0;
    for (const Context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const name of ["drawArrays", "drawElements"]) {
        const original = Context.prototype[name];
        Context.prototype[name] = function (...args) {
          window.drawCount++;
          return original.apply(this, args);
        };
      }
    }
  });
  await page.goto(base + "/?chapter=vacancy&play=new");
  await page.click("#enter-vacancy");
  await page.waitForTimeout(2500);
  const result = await page.evaluate(async () => {
    const times = [],
      start = window.drawCount;
    let last = await new Promise(requestAnimationFrame);
    for (let i = 0; i < 150; i++) {
      const now = await new Promise(requestAnimationFrame);
      times.push(now - last);
      last = now;
    }
    times.sort((a, b) => a - b);
    return {
      median: times[75],
      p95: times[142],
      drawsPerFrame: (window.drawCount - start) / 150,
    };
  });
  // A route to the upper landing includes the full outside staircase.
  const route = await page.evaluate(() => {
    const times = [];
    let nodes = 0;
    for (let i = 0; i < 8; i++) {
      const start = performance.now();
      nodes = vacancyNavigation.path(
        { x: -0.5, z: 16 },
        { x: 5, z: -7.5 },
      ).length;
      times.push(performance.now() - start);
    }
    return { nodes, milliseconds: times };
  });
  assert(route.nodes > 0, "The performance route must reach the upper floor");
  await fs.writeFile(
    "artifacts/vacancy-after-perf.json",
    JSON.stringify({ ...result, route }, null, 2),
  );
  console.log(JSON.stringify({ ...result, route }));
} finally {
  await browser.close();
}
