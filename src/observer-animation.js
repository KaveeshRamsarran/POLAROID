import * as THREE from "three";

const { clamp, damp, smoothstep } = THREE.MathUtils;
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// Solve a leg in its sagittal plane, retaining the modeled rest angles.
export function solveLeg(forward, drop, upper = 0.43417, lower = 0.41437) {
  const reach = clamp(Math.hypot(forward, drop), 0.08, upper + lower - 0.003);
  const aim = Math.atan2(forward, drop);
  const bend = Math.acos(
    clamp(
      (upper * upper + reach * reach - lower * lower) / (2 * upper * reach),
      -1,
      1,
    ),
  );
  const thigh = aim + bend;
  const kneeForward = Math.sin(thigh) * upper,
    kneeDrop = Math.cos(thigh) * upper;
  const shin = Math.atan2(
    Math.sin(aim) * reach - kneeForward,
    Math.cos(aim) * reach - kneeDrop,
  );
  const hip = 0.13864 - thigh;
  const knee = -0.14531 - hip - shin;
  return { hip, knee, ankle: -hip - knee };
}

export function updateObserverAnimation(actor, dt, time, player, floorAt) {
  const data = actor.userData;
  const state = (data.gait ||= {
    last: actor.position.clone(),
    phase: 0,
    blend: 0,
    speed: 0,
    contacts: [true, true],
  });
  const dx = actor.position.x - state.last.x,
    dz = actor.position.z - state.last.z;
  const moved = Math.hypot(dx, dz);
  const teleport = moved > 0.6;
  const speed = dt > 0 && !teleport ? moved / dt : 0;
  state.last.copy(actor.position);
  state.speed = damp(state.speed, speed, 7, dt);
  state.blend = damp(state.blend, speed > 0.04 ? 1 : 0, 10, dt);
  data.walking = speed > 0.04;
  const chase = smoothstep(state.speed, 1.3, 2.5);
  const stride = 0.5 + chase * 0.18,
    stance = 0.62 - chase * 0.07;
  if (moved > 0.00001 && !teleport) {
    state.phase += ((moved * stance) / stride) * Math.PI * 2;
    const heading = Math.atan2(dx, dz);
    actor.rotation.y +=
      angleDelta(actor.rotation.y, heading) * (1 - Math.exp(-dt * 8));
  }
  const blend = state.blend,
    cycle = state.phase / (2 * Math.PI);
  const bob =
    blend * (-0.055 - chase * 0.025 + Math.cos(state.phase * 2) * 0.012);
  data.body.position.y = bob;
  data.body.rotation.z = Math.sin(state.phase) * 0.017 * blend;
  data.body.rotation.x = 0.025 + chase * 0.07 * blend;
  for (const limb of data.limbs) {
    const phase = state.phase + (limb.side > 0 ? Math.PI : 0);
    if (limb.type === "arm") {
      limb.mesh.rotation.x = Math.sin(phase) * (0.22 + chase * 0.18) * blend;
      limb.mesh.rotation.z =
        limb.side * (0.035 + Math.sin(time * 1.1 + limb.side) * 0.012);
      limb.joint.rotation.x =
        -0.14 - Math.max(0, -Math.sin(phase)) * (0.19 + chase * 0.2) * blend;
      continue;
    }
    const q = (cycle + (limb.side > 0 ? 0.5 : 0)) % 1;
    const contact = q < stance;
    const index = limb.side > 0 ? 1 : 0;
    if (contact && !state.contacts[index] && blend > 0.5 && !teleport)
      data.footfallCount = (data.footfallCount || 0) + 1;
    state.contacts[index] = contact;
    const swing = clamp((q - stance) / (1 - stance), 0, 1);
    const forward =
      (contact
        ? stride * (0.5 - q / stance)
        : stride * (-0.5 + swing * swing * (3 - 2 * swing))) * blend;
    const lift = Math.sin(swing * Math.PI) * (0.105 + chase * 0.06) * blend;
    const localX = limb.side * 0.15 * actor.scale.x;
    const worldX =
      actor.position.x +
      Math.cos(actor.rotation.y) * localX +
      Math.sin(actor.rotation.y) * forward;
    const worldZ =
      actor.position.z -
      Math.sin(actor.rotation.y) * localX +
      Math.cos(actor.rotation.y) * forward;
    const ground = floorAt(worldX, worldZ) ?? actor.position.y;
    const rise = clamp(
      (ground - actor.position.y) / actor.scale.y,
      -0.18,
      0.22,
    );
    limb.mesh.position.y = 0.93 + bob;
    const pose = solveLeg(forward, 0.84 + bob - rise - lift);
    limb.mesh.rotation.x = pose.hip;
    limb.joint.rotation.x = pose.knee;
    limb.foot.rotation.x =
      pose.ankle +
      (contact
        ? Math.max(0, q / stance - 0.8) * 0.5
        : Math.sin(swing * Math.PI) * 0.14) *
        blend;
  }
  const target = Math.atan2(
    player.x - actor.position.x,
    player.z - actor.position.z,
  );
  data.head.rotation.y = damp(
    data.head.rotation.y,
    clamp(angleDelta(actor.rotation.y, target), -0.65, 0.65),
    4,
    dt,
  );
  data.head.rotation.z =
    -0.24 +
    Math.sin(time * 0.71) * 0.025 -
    Math.sin(state.phase) * 0.02 * blend;
  data.head.rotation.x = 0.1 + Math.sin(time * 1.7) * 0.02;
}
