import test from "node:test";
import assert from "node:assert/strict";
import {
  newState,
  normalizeSave,
  ObserverAI,
  findPath,
  lineOfSight,
  blocked,
  floorAt,
  canCapture,
  evidenceDefs,
  placePhoto,
  seededRandom,
  objectiveFor,
} from "../src/logic.js";
test("levels have continuous stairs and playable floors", () => {
  assert.equal(floorAt(0, -17), 0);
  assert.equal(floorAt(0, -20), 1.8);
  assert.equal(floorAt(0, -23), 3.6);
  assert.equal(floorAt(0, -32), 5.2);
  assert.ok(Math.abs(floorAt(0, -35) - 6.8) < 1e-9);
  assert.equal(floorAt(13, -14), -1.8);
  assert.equal(floorAt(20, -14), -3.6);
  assert.equal(floorAt(200, 200), null);
});
test("seed creates reproducible four-digit puzzle codes", () => {
  const a = newState(17),
    b = newState(17);
  assert.equal(a.code, b.code);
  assert.match(a.code, /^[0-9]{4}$/);
  assert.equal(a.film, 8);
  assert.deepEqual(a.ritual, [null, null, null, null]);
});
test("walls occlude vision; tables do not hide eye-level clues", () => {
  const a = { x: 0, y: 1.64, z: 8 },
    b = { x: 0, y: 1.7, z: 2 },
    wall = { x1: -2, x2: 2, z1: 4, z2: 4.2, y1: 0, y2: 3 };
  assert.equal(lineOfSight(a, b, [wall]), false);
  assert.equal(lineOfSight(a, b, [{ ...wall, y2: 1 }]), true);
  assert.equal(lineOfSight(a, b, [{ ...wall, door: { open: 1 } }]), true);
});
test("photographs require aim, distance and unobstructed view", () => {
  const p = { x: 0, y: 1.64, z: 10 },
    f = { x: 0, y: 0, z: -1 },
    target = { x: 0, y: 1.6, z: 3 };
  assert.equal(canCapture(target, p, f, []), true);
  assert.equal(canCapture({ ...target, x: 8 }, p, f, []), false);
  assert.equal(canCapture({ ...target, z: -5 }, p, f, []), false);
  assert.equal(
    canCapture(target, p, f, [{ x1: -2, x2: 2, z1: 6, z2: 7 }]),
    false,
  );
});
test("pathfinding routes around solid obstacles", () => {
  const solids = [{ x1: -0.5, x2: 0.5, z1: 3, z2: 6 }],
    path = findPath({ x: 0, z: 8 }, { x: 0, z: 1 }, solids);
  assert.ok(path.length > 0);
  assert.ok(path.some((p) => Math.abs(p.x) > 0.5));
  for (const p of path)
    assert.equal(blocked(p.x, p.z, solids, 0.15, true), false);
});
test("doors block player until open but AI can plan a door route", () => {
  const door = { open: 0 },
    solids = [{ x1: -2.2, x2: 2.2, z1: 4, z2: 4.2, door }];
  assert.equal(blocked(0, 4.1, solids), true);
  assert.ok(findPath({ x: 0, z: 8 }, { x: 0, z: 1 }, solids).length);
  door.open = 1;
  assert.equal(blocked(0, 4.1, solids), false);
});
test("Observer remembers noise without perfect player knowledge", () => {
  const ai = new ObserverAI([], seededRandom(1));
  ai.position = { x: 0, z: 0 };
  ai.hear({ x: 0, z: 8 }, 20, 2);
  assert.equal(ai.state, "INVESTIGATING");
  assert.deepEqual(ai.lastKnown, { x: 0, z: 8 });
  ai.update(0.1, { x: 8, y: 1.6, z: 12 }, 2, false, true, false);
  assert.deepEqual(ai.lastKnown, { x: 0, z: 8 });
});
test("Observer is harmless during discovery and retreats from photographs", () => {
  const ai = new ObserverAI([]);
  ai.position = { x: 0, z: 9 };
  for (let i = 0; i < 30; i++)
    assert.equal(
      ai.update(0.1, { x: 0, z: 9 }, 0, false, false, false).caught,
      false,
    );
  ai.repel();
  assert.equal(ai.state, "RETREATING");
  assert.ok(ai.path.length);
});
test("ritual needs owned evidence in the correct order", () => {
  const s = newState();
  assert.equal(placePhoto(s, 0, "writing"), false);
  for (const d of evidenceDefs) s.evidence[d.id] = { image: "test" };
  for (let i = 0; i < 3; i++)
    assert.equal(placePhoto(s, i, evidenceDefs[i].id), false);
  assert.equal(placePhoto(s, 3, "family"), true);
  assert.equal(placePhoto(s, 0, "family"), false);
});
test("save serialization preserves checkpoint and progression", () => {
  const s = newState(9);
  s.evidence.writing = { image: "x" };
  s.atticUnlocked = true;
  s.checkpoint = { x: 0, z: -26, yaw: 2 };
  const restored = normalizeSave(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.atticUnlocked, true);
  assert.deepEqual(restored.checkpoint, s.checkpoint);
  assert.deepEqual(restored.evidence, s.evidence);
  assert.equal(normalizeSave({ version: 9 }), null);
});
test("objectives guide the story through final escape", () => {
  const s = newState();
  assert.match(objectiveFor(s), /study/);
  for (const d of evidenceDefs) s.evidence[d.id] = {};
  assert.match(objectiveFor(s), /basement/);
  s.ritualComplete = true;
  assert.match(objectiveFor(s), /last photograph/);
  s.finalPhoto = true;
  assert.match(objectiveFor(s), /Leave/);
});
test("a detected stationary player can be reached after the chase warning", () => {
  const ai = new ObserverAI([], seededRandom(19));
  ai.position = { x: 0, z: -15 };
  const player = { x: 0, z: -13.17, y: 1.64 };
  ai.hear(player, 20, 2);
  let caught = false;
  for (let i = 0; i < 400; i++)
    caught ||= ai.update(0.1, player, 2, false, false, false).caught;
  assert.equal(caught, true);
});
