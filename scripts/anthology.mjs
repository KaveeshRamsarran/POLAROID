import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(60000);
try {
  await page.goto(base);
  await page.locator(".chapter-grid").waitFor();
  assert.equal(await page.locator(".chapter-card").count(), 3);
  await page.locator(".chapter-card.vacancy").hover();
  assert.equal(
    await page.locator('[data-background="vacancy"]').getAttribute("class"),
    "active",
  );
  await page.waitForTimeout(850);
  await page.screenshot({ path: "artifacts/anthology-vacancy.png" });
  await page.locator(".chapter-card.cinema").hover();
  assert.equal(
    await page.locator('[data-background="cinema"]').getAttribute("class"),
    "active",
  );
  await page.waitForTimeout(850);
  await page.screenshot({ path: "artifacts/anthology-cinema.png" });
  await page.locator(".chapter-card.blackwood .chapter-name").focus();
  assert.equal(
    await page.locator('[data-background="blackwood"]').getAttribute("class"),
    "active",
  );
  await page.waitForTimeout(850);
  await page.screenshot({ path: "artifacts/anthology.png" });
  await page.click("#anthology-settings");
  await page.locator('[data-setting="effects"]').fill("0.45");
  await page.click("#anthology-close");
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("polaroid.settings.v1")).effects,
    ),
    0.45,
  );
  await page.locator('.chapter-card.blackwood a[href*="play=new"]').click();
  await page.click("#enter-blackwood");
  await page.waitForFunction(
    () => window.polaroidDiagnostics.mode === "playing",
  );
  await page.keyboard.press("p");
  await page.click("#save-exit");
  await page.locator(".chapter-grid").waitFor();
  const house = await page.evaluate(() =>
    localStorage.getItem("polaroid.save.v1"),
  );
  assert(house);
  assert.equal(
    await page.evaluate(() => typeof window.polaroidDiagnostics),
    "undefined",
  );
  await page.locator('.chapter-card.cinema a[href*="play=new"]').click();
  await page.click("#enter-story");
  await page.waitForFunction(() => window.cinemaDiagnostics.mode === "playing");
  await page.keyboard.press("c");
  await page.waitForFunction(
    () => window.cinemaDiagnostics.state.photos.length === 1,
  );
  await page.keyboard.press("Escape");
  await page.click("#stories");
  await page.locator(".chapter-grid").waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("polaroid.save.v1")),
    house,
  );
  const cinema = await page.evaluate(() =>
    localStorage.getItem("polaroid.last-showing.v1"),
  );
  assert(cinema);
  await page
    .locator('.chapter-card.blackwood a[href*="play=continue"]')
    .click();
  await page.click("#enter-blackwood");
  await page.waitForFunction(
    () => window.polaroidDiagnostics.mode === "playing",
  );
  assert.equal(
    (await page.evaluate(() => window.polaroidDiagnostics)).film,
    JSON.parse(house).film,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("polaroid.last-showing.v1")),
    cinema,
  );
  await page.keyboard.press("p");
  await page.click("#save-exit");
  await page.locator(".chapter-grid").waitFor();
  await page.locator('.chapter-card.cinema a[href*="play=continue"]').click();
  await page.click("#enter-story");
  await page.waitForFunction(() => window.cinemaDiagnostics.mode === "playing");
  assert.equal(
    (await page.evaluate(() => window.cinemaDiagnostics)).state.photos.length,
    1,
  );
  await page.keyboard.press("Escape");
  await page.click("#stories");
  await page.locator(".chapter-grid").waitFor();
  const previous = await page.evaluate(() => [
    localStorage.getItem("polaroid.save.v1"),
    localStorage.getItem("polaroid.last-showing.v1"),
  ]);
  await page.locator('.chapter-card.vacancy a[href*="play=new"]').click();
  await page.click("#enter-vacancy");
  await page.waitForFunction(() => vacancyDiagnostics.mode === "playing");
  await page.keyboard.press("c");
  await page.waitForFunction(
    () => vacancyDiagnostics.state.photos.length === 1,
  );
  await page.keyboard.press("p");
  await page.click("#stories");
  await page.locator(".chapter-grid").waitFor();
  assert.equal(
    await page.evaluate(() => typeof window.vacancyDiagnostics),
    "undefined",
  );
  assert.deepEqual(
    await page.evaluate(() => [
      localStorage.getItem("polaroid.save.v1"),
      localStorage.getItem("polaroid.last-showing.v1"),
    ]),
    previous,
  );
  await page.locator('.chapter-card.vacancy a[href*="play=continue"]').click();
  await page.click("#enter-vacancy");
  await page.waitForFunction(() => vacancyDiagnostics.mode === "playing");
  assert.equal(
    (await page.evaluate(() => vacancyDiagnostics)).state.photos.length,
    1,
  );
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("polaroid.settings.v1")).effects,
    ),
    0.45,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: all three anthology launch/continue paths, shared settings, legacy save compatibility, independent photos and scene teardown.",
  );
} finally {
  await browser.close();
}
