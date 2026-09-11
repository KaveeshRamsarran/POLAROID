import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { newState } from "../src/logic.js";
import { newStory as cinema } from "../src/cinema/logic.js";
import { newStory as vacancy } from "../src/vacancy/logic.js";
import { parseBackup } from "../src/shared/save-transfer.js";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto(process.argv[2] || "http://127.0.0.1:3001");
  const saves = {
    "polaroid.save.v1": newState(),
    "polaroid.last-showing.v1": cinema(),
    "polaroid.vacancy.v1": vacancy(),
  };
  await page.evaluate((saves) => {
    for (const [key, value] of Object.entries(saves))
      localStorage.setItem(key, JSON.stringify(value));
  }, saves);
  await page.reload();
  await page.click("#anthology-saves");
  const downloaded = page.waitForEvent("download");
  await page.click("#export-saves");
  const download = await downloaded;
  await download.saveAs("artifacts/browser-save-backup.json");
  const backup = parseBackup(
    await readFile("artifacts/browser-save-backup.json", "utf8"),
  );
  assert.deepEqual(backup.saves, saves);
  await page.evaluate(() => {
    localStorage.removeItem("polaroid.last-showing.v1");
    localStorage.setItem(
      "polaroid.settings.v1",
      JSON.stringify({ effects: 0.2 }),
    );
  });
  await page.setInputFiles("#save-file", "artifacts/browser-save-backup.json");
  await page.locator('#save-preview input[value="polaroid.save.v1"]').uncheck();
  await page
    .locator('#save-preview input[value="polaroid.vacancy.v1"]')
    .uncheck();
  await page.getByText("RESTORE SELECTED SAVES", { exact: true }).click();
  await page.locator(".chapter-grid").waitFor();
  assert.equal(
    await page.locator('.chapter-card.cinema a[href*="continue"]').count(),
    1,
  );
  assert.deepEqual(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("polaroid.last-showing.v1")),
    ),
    saves["polaroid.last-showing.v1"],
  );
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("polaroid.settings.v1")).effects,
    ),
    0.2,
  );
  await page.click("#anthology-saves");
  await page.screenshot({ path: "artifacts/save-transfer-menu.png" });
  console.log(
    "PASS: browser backup download, selective restore and independent settings.",
  );
} finally {
  await browser.close();
}
