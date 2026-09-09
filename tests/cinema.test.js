import test from "node:test";
import assert from "node:assert/strict";
import { discoveredLore, LORE } from "../src/cinema/lore.js";
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
  objective,
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
test("optional lore survives old saves without changing puzzle progression", () => {
  const old = newStory();
  delete old.lore;
  old.items.coat = true;
  old.items.records = true;
  old.tasks.belongings = true;
  const restored = restoreStory(old);
  assert.deepEqual(discoveredLore(restored), ["coat", "belongings", "records"]);
  const before = objective(restored);
  for (const id of Object.keys(LORE)) restored.lore[id] = true;
  assert.equal(objective(restored), before);
  assert.equal(investigationComplete(restored), false);
  const saved = restoreStory(JSON.parse(JSON.stringify(restored)));
  assert.equal(discoveredLore(saved).length, Object.keys(LORE).length);
  assert.deepEqual(newStory().lore, {});
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
test("simplified story requires three survey tasks and two photo clues, without optional puzzles", () => {
  const s = newStory();
  assert.equal(openingComplete(s), false);
  for (const k of ["message", "seats", "equipment"]) s.tasks[k] = true;
  assert.equal(openingComplete(s), true);
  for (const k of ["doorway", "ada"]) s.evidence[k] = "photo";
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

test("open door leaves still block their occupied space", () => {
  const doors = { auditorium: false };
  const nav = navigation(
    [
      {
        x1: -1.3,
        x2: 1.3,
        z1: 3.95,
        z2: 4.05,
        y1: 0,
        y2: 2.4,
        door: "auditorium",
      },
      {
        x1: -1.35,
        x2: -1.25,
        z1: 4,
        z2: 5.3,
        y1: 0,
        y2: 2.4,
        door: "auditorium",
        openLeaf: true,
      },
    ],
    doors,
  );
  assert(nav.blocked(0, 4));
  assert.equal(nav.blocked(-1.3, 4.7), false);
  doors.auditorium = true;
  assert.equal(nav.blocked(0, 4), false);
  assert(nav.blocked(-1.3, 4.7));
});

test("older chapter progress gains new doors and follows the simpler objective", () => {
  const old = newStory();
  old.doors = { booth: false, exit: false };
  old.reels = ["opening", "return", "incident"];
  old.activeReel = "incident";
  old.events.jamRepaired = true;
  old.items.reference = true;
  old.evidence = {
    opening: "old-print",
    return: "another-print",
    doorway: "door",
    ada: "key",
  };
  const restored = restoreStory(old);
  assert.equal(restored.doors.booth, false);
  assert.equal(restored.doors.archive, true);
  assert.deepEqual(restored.evidence, old.evidence);
  assert.match(objective(restored), /drawer labelled A. BELL/);
  assert.equal(floorAt(0, 21), 0);
});
