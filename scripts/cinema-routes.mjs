import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(
  (process.argv[2] || "http://127.0.0.1:3001") +
    "/?chapter=last-showing&play=new",
);
await page.click("#enter-story");
const routes = await page.evaluate(() => {
  const places = {
    ticketCounter: { x: -5.5, z: 19 },
    concessions: { x: 6.7, z: 16.9 },
    lounge: { x: -5.7, z: 16.5 },
    booth: { x: 12, z: -2 },
    archive: { x: -18, z: -2 },
    backstage: { x: -7, z: -22 },
    exit: { x: -12, z: -18 },
    seats: { x: -3.9, z: -7.5 },
    coat: { x: 6.5, z: -0.7 },
  };
  return Object.fromEntries(
    Object.entries(places).map(([id, to]) => {
      const path = window.cinemaNavigation.path({ x: 0, z: 18 }, to);
      return [
        id,
        {
          length: path.length,
          end: path.at(-1),
          blocked: path.filter((p) => window.cinemaNavigation.blocked(p.x, p.z))
            .length,
        },
      ];
    }),
  );
});
console.log(routes);
for (const [id, r] of Object.entries(routes)) {
  assert(r.length, id + " unreachable");
  assert.equal(r.blocked, 0, id + " path crosses solids");
}
await browser.close();
