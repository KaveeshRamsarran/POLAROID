// Rebuild the desktop icon from POLAROID's existing vector identity.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 256, height: 256 },
    deviceScaleFactor: 1,
  });
  const svg = await readFile("favicon.svg", "utf8");
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:256px;height:256px}</style>${svg}`,
  );
  const png = await page.screenshot({ omitBackground: true });
  await writeFile("desktop/icon.png", png);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  await writeFile("desktop/icon.ico", Buffer.concat([header, png]));
} finally {
  await browser.close();
}
