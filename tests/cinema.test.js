import test from "node:test";
import assert from "node:assert/strict";
import {
  newStory,
  restoreStory,
  changeReel,
  tickProjector,
  canPatronMove,
  canRegisterPhoto,
  openingComplete,
  investigationComplete,
  SAVE_KEY,
  floorAt,
  navigation,
} from "../src/cinema/logic.js";
test("cinema saves are versioned and independent of Blackwood", () => {
  assert.notEqual(SAVE_KEY, "polaroid.save.v1");
  const a = newStory(),
    b = newStory();
  a.photos.push({ id: "a" });
  assert.equal(b.photos.length, 0);
  assert.equal(restoreStory({ version: 2 }), null);
  assert.deepEqual(restoreStory(a).checkpoint, a.checkpoint);
});
test("pause freezes projector and threat, including exhausted reels", () => {
  const s = newStory();
  s.patron.awakened = true;
  const before = structuredClone(s);
  tickProjector(s, 60, true);
  assert.deepEqual(s, before);
  s.projector.status = "exhausted";
  assert.equal(canPatronMove(s, true), false);
  assert.equal(canPatronMove(s, false), true);
  assert.equal(canPatronMove(s, false, 1), false);
});
test("running arrests patron where it stands; reel changes do not reset it", () => {
  const s = newStory();
  s.patron = { x: -12, z: 4, awakened: true, distance: 20 };
  s.reels.push("return");
  assert.equal(canPatronMove(s), false);
  const position = structuredClone(s.patron);
  assert.equal(changeReel(s, "return"), true);
  assert.equal(canPatronMove(s), true);
  assert.deepEqual(s.patron, position);
  s.projector.status = "running";
  tickProjector(s, 12);
  assert.deepEqual(s.patron, position);
});
test("warnings cross their threshold once, exhaustion stops transport", () => {
  const s = newStory();
  s.projector.remaining = 36;
  assert.deepEqual(tickProjector(s, 2), ["warning"]);
  assert.deepEqual(tickProjector(s, 10), []);
  assert.deepEqual(tickProjector(s, 50), ["exhausted"]);
  assert.equal(s.projector.status, "exhausted");
  assert.deepEqual(tickProjector(s, 10), []);
});
test("jam and power block reel changes until repaired", () => {
  const s = newStory();
  s.reels.push("incident");
  for (const status of ["jammed", "power"]) {
    s.projector.status = status;
    assert.equal(changeReel(s, "incident"), false);
  }
  s.projector.status = "stopped";
  assert.equal(changeReel(s, "incident"), true);
});
test("photographic clues require reel, viewpoint, framing, distance and visibility", () => {
  const valid = {
    reel: "incident",
    requiredReel: "incident",
    visible: true,
    framed: true,
    distance: 4,
    viewpoint: true,
  };
  assert.equal(canRegisterPhoto(valid), true);
  for (const change of [
    { reel: "opening" },
    { visible: false },
    { framed: false },
    { distance: 40 },
    { viewpoint: false },
  ])
    assert.equal(canRegisterPhoto({ ...valid, ...change }), false);
});
test("story gates require actual checklist and independent photographic puzzles", () => {
  const s = newStory();
  assert.equal(openingComplete(s), false);
  for (const k of [
    "message",
    "seats",
    "equipment",
    "exits",
    "sorted",
    "belongings",
  ])
    s.tasks[k] = true;
  assert.equal(openingComplete(s), true);
  for (const k of ["opening", "return", "doorway", "ada", "frame"])
    s.evidence[k] = "photo";
  assert.equal(investigationComplete(s), false);
  s.items.splice = true;
  assert.equal(investigationComplete(s), true);
});
test("stairs connect both heights and navigation respects closed routes", () => {
  assert.equal(floorAt(12, 12), 0);
  assert.equal(floorAt(12, 0), 3.6);
  assert.equal(floorAt(12, -3), 3.6);
  const doors = { exit: false },
    nav = navigation(
      [{ x1: -14.1, x2: -13.9, z1: -19, z2: -17, y1: 0, y2: 3, door: "exit" }],
      doors,
    );
  assert.equal(nav.blocked(-14, -18), true);
  doors.exit = true;
  assert.equal(nav.blocked(-14, -18), false);
});
test("swept clearance rejects the narrow backstage corner a sampled ray misses", () => {
  const nav = navigation(
    [{ x1: -10.11, x2: -9.89, z1: -21, z2: 10, y1: 0, y2: 6.2 }],
    {},
  );
  assert.equal(
    nav.clear({ x: -9.5, z: -21 }, { x: -10, z: -21.5 }, 0.22, true),
    false,
  );
  const route = nav.path({ x: -9.5, z: -21 }, { x: -12, z: -22 });
  assert(route.length > 0);
  let previous = { x: -9.5, z: -21 };
  for (const point of route) {
    assert(nav.clear(previous, point, 0.22, true));
    previous = point;
  }
});
