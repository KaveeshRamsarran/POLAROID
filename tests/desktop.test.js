import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import {
  exportBackup,
  parseBackup,
  importBackup,
} from "../src/shared/save-transfer.js";
import { newStory as cinema } from "../src/cinema/logic.js";
import { newStory as vacancy } from "../src/vacancy/logic.js";
import { newState } from "../src/logic.js";
const { assetPath, isGameURL } = createRequire(import.meta.url)(
  "../desktop/paths.cjs",
);
const root = path.resolve("dist");
test("desktop protocol confines decoded paths and origins to bundled assets", () => {
  assert.equal(
    assetPath(root, "polaroid://game/?chapter=vacancy"),
    path.join(root, "index.html"),
  );
  assert.equal(
    assetPath(root, "polaroid://game/assets/test.js"),
    path.join(root, "assets/test.js"),
  );
  for (const value of [
    "https://game/",
    "polaroid://evil/",
    "polaroid://game:8000/",
    "polaroid://user@game/",
    "polaroid://game/%2e%2e%2fpackage.json",
    "polaroid://game/..%5cpackage.json",
    "polaroid://game/C%3a/windows",
    "polaroid://game/%00",
    "polaroid://game/%zz",
  ])
    assert.equal(assetPath(root, value), null, value);
  assert(!isGameURL("file:///etc/passwd"));
});
function storage(entries = []) {
  const data = new Map(entries);
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
test("desktop transfer preserves all three original save schemas and photographs", () => {
  const source = storage();
  for (const [key, state] of [
    ["polaroid.save.v1", newState()],
    ["polaroid.last-showing.v1", cinema()],
    ["polaroid.vacancy.v1", vacancy()],
  ]) {
    state.photos.push({
      image: "data:image/jpeg;base64,YWJjZA==",
      title: "A memory",
    });
    source.setItem(key, JSON.stringify(state));
  }
  const backup = parseBackup(exportBackup(source)),
    target = storage();
  importBackup(target, backup);
  for (const key of Object.keys(backup.saves))
    assert.equal(target.getItem(key), source.getItem(key));
});
test("selective restore keeps other chapters and unknown browser storage intact", () => {
  const target = storage([
    ["polaroid.save.v1", "original"],
    ["unrelated", "untouched"],
  ]);
  importBackup(
    target,
    {
      format: "polaroid-backup",
      version: 1,
      saves: {
        "polaroid.vacancy.v1": vacancy(),
        "polaroid.save.v1": newState(),
      },
    },
    ["polaroid.vacancy.v1"],
  );
  assert.equal(target.getItem("polaroid.save.v1"), "original");
  assert.equal(target.getItem("unrelated"), "untouched");
});
test("malformed, newer and injected backups are rejected before any save changes", () => {
  for (const saves of [
    { unknown: {} },
    { "polaroid.vacancy.v1": { version: 2 } },
    {
      "polaroid.save.v1": {
        ...newState(),
        photos: [{ title: "<img onerror=alert(1)>" }],
      },
    },
    JSON.parse('{"polaroid.settings.v1":{"__proto__":{}}}'),
  ]) {
    const target = storage([["polaroid.save.v1", "original"]]);
    assert.throws(() =>
      importBackup(target, { format: "polaroid-backup", version: 1, saves }),
    );
    assert.equal(target.getItem("polaroid.save.v1"), "original");
  }
});
test("quota failure restores every replaced save", () => {
  const target = storage([
    ["polaroid.save.v1", "old"],
    ["polaroid.vacancy.v1", "motel"],
  ]);
  const write = target.setItem;
  target.setItem = (key, value) => {
    if (value.length > 10) throw new Error("QuotaExceededError");
    write(key, value);
  };
  assert.throws(() =>
    importBackup(target, {
      format: "polaroid-backup",
      version: 1,
      saves: {
        "polaroid.save.v1": newState(),
        "polaroid.vacancy.v1": vacancy(),
      },
    }),
  );
  assert.equal(target.getItem("polaroid.save.v1"), "old");
  assert.equal(target.getItem("polaroid.vacancy.v1"), "motel");
});
