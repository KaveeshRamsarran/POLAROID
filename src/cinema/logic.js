export const SAVE_KEY = "polaroid.last-showing.v1";
export const REELS = {
  opening: { name: "1959 / OPENING NIGHT", seconds: 300 },
  return: { name: "1979 / REOPENING", seconds: 300 },
  incident: { name: "1978 / INCOMPLETE", seconds: 300 },
  complete: { name: "1978 / THE LAST SHOWING", seconds: 150 },
};
export const EVIDENCE = {
  seats: "Catalogue / torn upholstery",
  equipment: "Catalogue / projector and transport",
  first: "F8 / an unprinted name",
  moved: "The aisle / it has moved",
  opening: "1959 / the same patron",
  return: "1979 / the same patron",
  doorway: "A doorway under the paint",
  figure: "Ada / something in her hand",
  ada: "Ada / a service key, not a film can",
  frame: "Splice reference / 17",
  evacuation: "The part they cut away",
  final: "One admission. One departure.",
};
export function newStory() {
  return {
    version: 1,
    checkpoint: { x: 0, z: 11, yaw: 0, pitch: 0 },
    film: 12,
    photos: [],
    evidence: {},
    tasks: {},
    items: {},
    events: {},
    reels: ["opening"],
    activeReel: "opening",
    projector: { status: "running", remaining: 300 },
    patron: { x: 6.5, z: -2, awakened: false, distance: 0 },
    doors: { booth: true, exit: false },
    elapsed: 0,
    completed: false,
  };
}
export function restoreStory(raw) {
  if (!raw || raw.version !== 1) return null;
  const s = newStory();
  for (const k of [
    "checkpoint",
    "evidence",
    "tasks",
    "items",
    "events",
    "projector",
    "patron",
    "doors",
  ])
    s[k] = { ...s[k], ...(raw[k] || {}) };
  s.film = Math.max(0, Math.min(30, Number(raw.film) || 0));
  s.photos = Array.isArray(raw.photos) ? raw.photos.slice(-20) : [];
  s.reels = Array.isArray(raw.reels)
    ? raw.reels.filter((k) => REELS[k])
    : ["opening"];
  if (!s.reels.includes("opening")) s.reels.unshift("opening");
  s.activeReel = s.reels.includes(raw.activeReel) ? raw.activeReel : "opening";
  if (
    !["running", "stopped", "exhausted", "jammed", "power"].includes(
      s.projector.status,
    )
  )
    s.projector.status = "stopped";
  s.projector.remaining = Math.max(
    0,
    Math.min(REELS[s.activeReel].seconds, Number(s.projector.remaining) || 0),
  );
  for (const [o, fields] of [
    [s.checkpoint, ["x", "z", "yaw", "pitch"]],
    [s.patron, ["x", "z", "distance"]],
  ])
    for (const f of fields)
      if (!Number.isFinite(o[f]))
        o[f] = newStory()[o === s.patron ? "patron" : "checkpoint"][f];
  s.elapsed = Math.max(0, Number(raw.elapsed) || 0);
  s.completed = !!raw.completed;
  return s;
}
export function openingComplete(s) {
  return [
    "message",
    "seats",
    "equipment",
    "exits",
    "sorted",
    "belongings",
  ].every((k) => s.tasks[k]);
}
export function investigationComplete(s) {
  return (
    ["opening", "return", "doorway", "ada", "frame"].every(
      (k) => s.evidence[k],
    ) && !!s.items.splice
  );
}
export function changeReel(s, id) {
  if (
    !s.reels.includes(id) ||
    s.projector.status === "power" ||
    s.projector.status === "jammed"
  )
    return false;
  s.activeReel = id;
  s.projector.status = "stopped";
  s.projector.remaining = REELS[id].seconds;
  return true;
}
export function tickProjector(s, dt, paused = false) {
  if (paused || s.completed) return [];
  const events = [];
  s.elapsed += dt;
  if (s.projector.status === "running") {
    const old = s.projector.remaining;
    s.projector.remaining = Math.max(0, old - dt);
    if (old > 35 && s.projector.remaining <= 35) events.push("warning");
    if (s.projector.remaining === 0) {
      s.projector.status = "exhausted";
      events.push("exhausted");
    }
  }
  return events;
}
export function canPatronMove(s, paused = false, grace = 0) {
  return (
    !paused &&
    !s.completed &&
    s.patron.awakened &&
    !s.events.released &&
    s.projector.status !== "running" &&
    grace <= 0
  );
}
export function canRegisterPhoto({
  reel,
  requiredReel,
  visible,
  framed,
  distance,
  maxDistance = 22,
  viewpoint = true,
}) {
  return (
    (!requiredReel || requiredReel === reel) &&
    visible &&
    framed &&
    distance <= maxDistance &&
    distance > 0.35 &&
    viewpoint
  );
}
export function objective(s) {
  if (s.events.released)
    return "Photograph the open service exit. Then step outside.";
  if (s.activeReel === "complete" && s.projector.status === "running")
    return s.evidence.evacuation
      ? "The complete screening is running. Open the service exit before the reel ends."
      : "Photograph the complete evacuation memory in the backstage service passage, then open the exit.";
  if (investigationComplete(s))
    return "Assemble the missing section at the projection bench.";
  if (s.evidence.ada && s.evidence.doorway && s.evidence.frame)
    return "Find the archive drawer: seat number first, splice number second.";
  if (s.evidence.opening && s.evidence.return)
    return "Compare the 1978 memories: the service wall, Ada’s hand, and the repeating splice frame.";
  if (s.events.jamRepaired)
    return "Photograph the patron under both Opening Night and Reopening. Change reels in the booth.";
  if (s.projector.status === "jammed")
    return "Return to the booth. Lift the film loop, then restart the motor. It moves in the silence.";
  if (s.items.coat)
    return "Check the projector in the booth. The film is starting to slap.";
  if (s.evidence.first) return "Look beneath the folded coat at F8.";
  if (s.items.ticket)
    return "Photograph row F, seat 8 while the opening reel runs.";
  if (openingComplete(s))
    return "The ticket printer is running. Return to the lobby counter.";
  return "Finish the closing checklist. The journal keeps your tasks and photographs.";
}

// The plan is also the navigation surface. No overlapping floors or abstract
// shortcuts: the booth is reached by this staircase in both player and AI paths.
export const REGIONS = [
  { name: "Lobby", x1: -10, x2: 10, z1: 4, z2: 14, y: 0 },
  { name: "Auditorium", x1: -10, x2: 10, z1: -20, z2: 4, y: 0 },
  { name: "Service passage", x1: -14, x2: -10, z1: -24, z2: 14, y: 0 },
  { name: "Backstage", x1: -10, x2: 10, z1: -24, z2: -20, y: 0 },
  { name: "Film archive", x1: -22, x2: -14, z1: -10, z2: 2, y: 0 },
  { name: "Stair landing", x1: 10, x2: 14, z1: 12, z2: 14, y: 0 },
  { name: "Booth stairs", x1: 10, x2: 14, z1: 0, z2: 12, ramp: true },
  { name: "Projection booth", x1: 10, x2: 18, z1: -9, z2: 0, y: 3.6 },
  { name: "Outside", x1: -20, x2: -14, z1: -22, z2: -14, y: 0 },
];
export function regionAt(x, z) {
  return REGIONS.find((r) => x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2);
}
export function floorAt(x, z) {
  const r = regionAt(x, z);
  return r ? (r.ramp ? 3.6 * (1 - z / 12) : r.y) : null;
}
export function navigation(solids, doors) {
  function blocked(x, z, r = 0.23, planning = false) {
    const y = floorAt(x, z);
    if (y === null) return true;
    for (const [dx, dz] of [
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
    ])
      if (floorAt(x + dx, z + dz) === null) return true;
    return solids.some(
      (b) =>
        !(b.door && (doors[b.door] || (planning && b.door === "booth"))) &&
        y + 1.5 > b.y1 &&
        y + 0.1 < b.y2 &&
        x > b.x1 - r &&
        x < b.x2 + r &&
        z > b.z1 - r &&
        z < b.z2 + r,
    );
  }
  function clear(a, b, r = 0.23, planning = false) {
    const d = Math.hypot(b.x - a.x, b.z - a.z),
      n = Math.ceil(d / 0.18);
    for (let i = 0; i <= n; i++)
      if (
        blocked(
          a.x + ((b.x - a.x) * i) / (n || 1),
          a.z + ((b.z - a.z) * i) / (n || 1),
          r,
          planning,
        )
      )
        return false;
    // Sampled walks alone miss a thin diagonal intersection at a wall corner.
    // Sweep the navigation radius against every wall's expanded rectangle.
    for (const box of solids) {
      if (box.door && (doors[box.door] || (planning && box.door === "booth")))
        continue;
      let enter = 0,
        leave = 1,
        hit = true;
      for (const axis of ["x", "z"]) {
        const delta = b[axis] - a[axis],
          lo = box[axis + "1"] - r,
          hi = box[axis + "2"] + r;
        if (Math.abs(delta) < 1e-8) {
          if (a[axis] <= lo || a[axis] >= hi) {
            hit = false;
            break;
          }
        } else {
          let t0 = (lo - a[axis]) / delta,
            t1 = (hi - a[axis]) / delta;
          if (t0 > t1) [t0, t1] = [t1, t0];
          enter = Math.max(enter, t0);
          leave = Math.min(leave, t1);
          if (enter >= leave) {
            hit = false;
            break;
          }
        }
      }
      if (hit) {
        const t = (enter + leave) / 2,
          y = floorAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
        if (y !== null && y + 1.5 > box.y1 && y + 0.1 < box.y2) return false;
      }
    }
    return true;
  }
  function path(a, b) {
    if (clear(a, b, 0.22, true)) return [{ x: b.x, z: b.z }];
    const step = 0.5,
      key = (x, z) => `${x},${z}`,
      start = { x: Math.round(a.x / step), z: Math.round(a.z / step) },
      goal = { x: Math.round(b.x / step), z: Math.round(b.z / step) };
    const q = [start],
      seen = new Map([[key(start.x, start.z), null]]);
    let end = null;
    for (let cursor = 0; cursor < q.length && cursor < 18000; cursor++) {
      const n = q[cursor];
      if (
        Math.hypot(n.x - goal.x, n.z - goal.z) <= 1 &&
        clear({ x: n.x * step, z: n.z * step }, b, 0.22, true)
      ) {
        end = n;
        break;
      }
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        const p = { x: n.x + dx, z: n.z + dz },
          k = key(p.x, p.z);
        if (
          seen.has(k) ||
          !clear(
            { x: n.x * step, z: n.z * step },
            { x: p.x * step, z: p.z * step },
            0.22,
            true,
          )
        )
          continue;
        seen.set(k, n);
        q.push(p);
      }
    }
    if (!end) return [];
    const out = [{ x: b.x, z: b.z }];
    while (end) {
      out.push({ x: end.x * step, z: end.z * step });
      end = seen.get(key(end.x, end.z));
    }
    out.reverse();
    return out;
  }
  return { blocked, clear, path };
}
