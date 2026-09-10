import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createFrameBudget } from "../src/shared/render-budget.js";
import { batchRigidParts, batchStaticScene } from "../src/shared/batching.js";
import { updateCameraPose } from "../src/shared/camera-motion.js";
import { updateObserverAnimation } from "../src/observer-animation.js";
import { preloadPbr, pbrSurface } from "../src/shared/pbr.js";

test("material instances share pixel storage without sharing texture transforms", async () => {
  const original = globalThis.Image;
  globalThis.Image = class {
    async decode() {}
  };
  try {
    await preloadPbr();
    const wall = pbrSurface("Plaster001"),
      ceiling = pbrSurface("Plaster001");
    assert.equal(wall.map.source, ceiling.map.source);
    assert.notEqual(wall.map, ceiling.map);
    wall.map.repeat.set(4, 2);
    assert.deepEqual(ceiling.map.repeat.toArray(), [1, 1]);
    assert.equal(wall.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(wall.normalMap.colorSpace, THREE.NoColorSpace);
    assert.equal(pbrSurface("missing"), null);
  } finally {
    if (original) globalThis.Image = original;
    else delete globalThis.Image;
  }
});

test("sustained load lowers resolution with a floor; brief stalls and pause do not", () => {
  const b = createFrameBudget();
  for (let i = 0; i < 1000; i++) b.sample(500);
  for (let i = 0; i < 1000; i++) b.sample(35, false);
  assert.equal(b.scale, 1);
  for (let i = 0; i < 1800; i++) b.sample(30);
  assert.equal(b.scale, 0.65);
  for (let i = 0; i < 400; i++) b.sample(10);
  assert(
    b.scale < 1,
    "Recovery needs sustained spare capacity, not a brief quiet view",
  );
  for (let i = 0; i < 7000; i++) b.sample(10);
  assert.equal(b.scale, 1);
});

test("rigid batching retains articulated joints and independently photographed props", () => {
  const actor = new THREE.Group(),
    hand = new THREE.Group(),
    material = new THREE.MeshBasicMaterial();
  actor.add(hand);
  hand.position.set(1, 2, 0);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), material);
    m.position.x = i * 0.1;
    hand.add(m);
  }
  const watch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), material);
  watch.userData.keepMesh = true;
  hand.add(watch);
  batchRigidParts(actor);
  assert.equal(watch.parent, hand);
  assert.equal(hand.children.length, 2);
  actor.updateMatrixWorld(true);
  const before = watch.getWorldPosition(new THREE.Vector3());
  hand.position.x += 1;
  actor.updateMatrixWorld(true);
  assert.equal(watch.getWorldPosition(new THREE.Vector3()).x, before.x + 1);
  const scene = new THREE.Scene();
  actor.userData.limbs = [];
  scene.add(actor);
  batchStaticScene(scene);
  assert.equal(watch.parent, hand);
});

test("handheld aiming eases without snaps, and reduced movement disables sway", () => {
  const m = new THREE.Group();
  m.position.set(0.28, -0.28, -0.53);
  m.rotation.set(-0.13, -0.18, -0.05);
  updateCameraPose(m, 1 / 60, { aim: true, shake: 0 });
  assert(m.position.x > 0.2 && m.position.x < 0.28);
  const still = m.position.clone();
  updateCameraPose(m, 0, { aim: false });
  assert(m.position.equals(still));
  for (let i = 0; i < 120; i++)
    updateCameraPose(m, 1 / 60, {
      aim: true,
      moving: true,
      shake: 0,
      time: i / 60,
    });
  assert(Math.abs(m.position.x - 0.2) < 0.00001);
  assert(Math.abs(m.position.y + 0.18) < 0.00001);
  assert.equal(m.rotation.z, -0.05);
});

test("paused character updates preserve pose and footstep count even after restoration", () => {
  const actor = new THREE.Group();
  actor.userData.body = new THREE.Group();
  actor.userData.head = new THREE.Group();
  actor.userData.limbs = [];
  actor.userData.head.rotation.z = 0.22;
  actor.userData.footfallCount = 4;
  updateObserverAnimation(actor, 0, 100, { x: 10, z: 0 }, () => 0);
  actor.position.z = 12;
  updateObserverAnimation(actor, 0, 200, { x: 10, z: 0 }, () => 0);
  assert.equal(actor.userData.head.rotation.z, 0.22);
  assert.equal(actor.userData.footfallCount, 4);
  updateObserverAnimation(actor, 1 / 60, 200, { x: 10, z: 0 }, () => 0);
  assert.equal(
    actor.userData.gait.speed,
    0,
    "Restored position must not be treated as a walking stride",
  );
});
