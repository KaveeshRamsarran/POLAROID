import test from "node:test";
import assert from "node:assert/strict";
import {
  newStory,
  restoreStory,
  SAVE_KEY,
  objective,
  floorAt,
  photoAvailable,
  keepPhoto,
  canCapture,
  doorUnlocked,
  tickClerk,
  dazzle,
  recover,
} from "../src/vacancy/logic.js";
import { createNavigation, routeApproaches } from "../src/shared/navigation.js";

test("retaking clues cannot overflow the journal or evict a unique memory", () => {
  const s = newStory();
  keepPhoto(s, {
    id: "original",
    image: "data:image/jpeg;base64,old",
    evidence: ["laundry"],
  });
  for (let i = 0; i < 60; i++)
    keepPhoto(s, {
      id: "retake" + i,
      image: "data:image/jpeg;base64,new",
      evidence: ["suitcase"],
    });
  assert.equal(s.photos.length, 20);
  assert(s.photos.some((p) => p.id === "original"));
  assert.equal(s.evidence.suitcase, "retake59");
  assert(restoreStory(s).photos.some((p) => p.id === s.evidence.laundry));
});

test("a direct route still encounters a door between its endpoints", () => {
  assert(routeApproaches({ x: 0, z: 0 }, [{ x: 0, z: 10 }], { x: 0, z: 5 }));
  assert(!routeApproaches({ x: 2, z: 0 }, [{ x: 2, z: 10 }], { x: 0, z: 5 }));
});
test("Vacancy has independent versioned progress and preserves photographs", () => {
  const s = newStory();
  s.evidence.suitcase = "p1";
  s.photos = [
    { id: "p1", image: "data:image/jpeg;base64,test", evidence: ["suitcase"] },
  ];
  s.records.family = true;
  const r = restoreStory(JSON.parse(JSON.stringify(s)));
  assert.equal(SAVE_KEY, "polaroid.vacancy.v1");
  assert.deepEqual(r.photos, s.photos);
  assert.equal(r.records.family, true);
  assert.equal(restoreStory({ version: 2 }), null);
});
test("motel stairs continuously connect the courtyard to the upper walkway", () => {
  assert.equal(floorAt(-4.5, 3), 0);
  assert.equal(floorAt(-4.5, -6), 3.1);
  assert.equal(floorAt(5, -7.5), 3.1);
  assert.equal(floorAt(5, -12), 3.1);
  assert.equal(floorAt(-40, 5), null);
  const nav = createNavigation({ solids: [], doors: {}, floorAt });
  assert.equal(
    nav.blocked(5, -5.9),
    true,
    "Cannot step directly up to balcony",
  );
  assert.equal(nav.blocked(-4.5, -5.9), false);
});
test("ordinary tasks and photo clues lead to one actionable objective", () => {
  const s = newStory();
  assert.match(objective(s), /bell/);
  s.items.roomKey = true;
  s.items.bag = true;
  s.items.called = true;
  s.items.family = true;
  assert.match(objective(s), /bed/);
  assert.equal(photoAvailable(s, "suitcase"), true);
  assert.equal(photoAvailable(s, "doorway"), false);
  s.items.page = true;
  assert.equal(photoAvailable(s, "doorway"), true);
  assert.equal(doorUnlocked(s, "room7"), false);
  s.evidence.doorway = "p";
  s.items.key = true;
  assert.equal(doorUnlocked(s, "room7"), true);
});
test("photographic evidence rejects obstructed, unframed and distant scenes", () => {
  const shot = { available: true, framed: true, visible: true, distance: 3 };
  assert.equal(canCapture(shot), true);
  for (const patch of [
    { available: false },
    { framed: false },
    { visible: false },
    { facing: false },
    { distance: 20 },
  ])
    assert.equal(canCapture({ ...shot, ...patch }), false);
});
test("clerk gives warning time, pauses exactly and loses an unseen player", () => {
  const s = newStory();
  s.events.awake = true;
  tickClerk(s, 1, { sees: true, distance: 2 });
  assert.notEqual(s.clerk.mode, "chase");
  const before = JSON.stringify(s);
  tickClerk(s, 10, { paused: true, sees: true });
  assert.equal(JSON.stringify(s), before);
  tickClerk(s, 1, { sees: true, distance: 2 });
  assert.equal(s.clerk.mode, "chase");
  assert.equal(tickClerk(s, 0.1, { sees: true, distance: 0.5 }), "caught");
  tickClerk(s, 10, { sees: false });
  assert.equal(s.clerk.mode, "patrol");
});
test("a flash needs the clerk in frame and buys four active seconds", () => {
  const s = newStory();
  s.events.awake = true;
  assert.equal(dazzle(s, false, 3, true), false);
  assert.equal(dazzle(s, true, 12, true), false);
  assert.equal(dazzle(s, true, 3, true), true);
  tickClerk(s, 8, { paused: true });
  assert.equal(s.clerk.stunned, 4);
  tickClerk(s, 4);
  assert.equal(s.clerk.stunned, 0);
});
test("checkpoint recovery keeps evidence and supplies a fair escape window", () => {
  const s = newStory();
  s.film = 0;
  s.evidence.pool = "p";
  s.items.key = true;
  s.clerk.mode = "chase";
  recover(s);
  assert.equal(s.film, 4);
  assert.equal(s.evidence.pool, "p");
  assert.equal(s.items.key, true);
  assert.equal(s.clerk.seen, 0);
  assert.equal(s.clerk.x, -11);
});
test("shared navigation respects closed doors and swept wall corners", () => {
  const doors = { room: true };
  const solids = [
    { x1: 1, x2: 1.2, z1: -1, z2: 1, y1: 0, y2: 3 },
    { x1: 3, x2: 3.1, z1: -2, z2: 2, y1: 0, y2: 3, door: "room" },
  ];
  const nav = createNavigation({
    solids,
    doors,
    floorAt: (x, z) => (Math.abs(x) < 10 && Math.abs(z) < 10 ? 0 : null),
  });
  assert.equal(nav.clear({ x: 0, z: 0 }, { x: 2, z: 0 }), false);
  assert.equal(nav.blocked(3, 0), false);
  doors.room = false;
  assert.equal(nav.blocked(3, 0), true);
});

test("cached patrol routes refresh when a door locks or its open leaf moves", () => {
  const doors = { room: false };
  let unlocked = true;
  const leaf = {
    x1: 9,
    x2: 9.1,
    z1: -3,
    z2: 3,
    y1: 0,
    y2: 3,
    door: "room",
    openLeaf: true,
  };
  const nav = createNavigation({
    solids: [
      { x1: 1, x2: 1.2, z1: -1, z2: 1, y1: 0, y2: 3 },
      { x1: 3, x2: 3.1, z1: -3, z2: 3, y1: 0, y2: 3, door: "room" },
      leaf,
    ],
    doors,
    canOpen: () => unlocked,
    floorAt: (x, z) => (x > -1 && x < 6 && Math.abs(z) < 3 ? 0 : null),
  });
  const start = { x: 0, z: 0 },
    end = { x: 5, z: 0 };
  assert(nav.path(start, end).length);
  assert(nav.path(start, end).length);
  unlocked = false;
  assert.equal(nav.path(start, end).length, 0);
  doors.room = true;
  assert(nav.path(start, end).length);
  leaf.x1 = 3;
  leaf.x2 = 3.1;
  assert.equal(nav.path(start, end).length, 0);
});
