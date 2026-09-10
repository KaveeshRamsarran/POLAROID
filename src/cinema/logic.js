export const SAVE_KEY = "polaroid.last-showing.v1";
export const REELS = {
  opening: { name: "1959 / OPENING NIGHT", seconds: 420 },
  return: { name: "1979 / REOPENING", seconds: 420 },
  incident: { name: "1978 / INCIDENT REEL", seconds: 420 },
  complete: { name: "1978 / THE LAST SHOWING", seconds: 180 },
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
  watch: "F8 / pale stitches, a worn watch strap",
};
export function newStory() {
  return {
    version: 1,
    checkpoint: { x: 0, z: 18, yaw: 0, pitch: 0 },
    film: 12,
    photos: [],
    evidence: {},
    tasks: {},
    items: {},
    events: {},
    lore: {},
    reels: ["opening"],
    activeReel: "opening",
    projector: { status: "running", remaining: 420 },
    patron: { x: 6.5, z: -2, awakened: false, distance: 0 },
    doors: {
      booth: true,
      auditorium: true,
      archive: true,
      backstage: true,
      service: true,
      exit: false,
    },
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
    "lore",
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
  return ["message", "seats", "equipment"].every((k) => s.tasks[k]);
}
export function investigationComplete(s) {
  return !!(s.evidence.doorway && s.evidence.ada && s.items.splice);
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
export function tickInterruptions(
  s,
  dt,
  { paused = false, grace = 0, safe = true, random = Math.random } = {},
) {
  if (paused || s.completed || grace > 0) return [];
  const p = s.projector;
  if (
    !s.events.jamRepaired ||
    s.events.climax ||
    s.events.released ||
    p.status !== "running"
  ) {
    p.faultIn = null;
    p.faultWarning = false;
    return [];
  }
  // A fresh interval follows each restart. Save the chosen interval so loading
  // does not reroll it. Introductory work and the final escape are protected.
  if (!Number.isFinite(p.faultIn)) p.faultIn = 85 + random() * 70;
  p.faultIn = Math.max(0, p.faultIn - dt);
  if (!safe && p.faultIn <= 12) {
    p.faultIn = 12;
    return [];
  }
  if (p.faultIn <= 12 && !p.faultWarning) {
    p.faultIn = 12;
    p.faultWarning = true;
    return ["slip-warning"];
  }
  if (p.faultIn === 0) {
    p.status = "stopped";
    p.faultWarning = false;
    p.faultIn = null;
    p.slips = (p.slips || 0) + 1;
    return ["slipped"];
  }
  return [];
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
    return s.evidence.final
      ? "Walk through the open service exit."
      : "Wait for the patron to step outside. Photograph the open exit (C).";
  if (s.events.climax)
    return s.projector.status === "running"
      ? "Go downstairs to the service passage. Open the exit (E) before the film ends."
      : "Restart the complete reel at the projector upstairs.";
  if (s.projector.status === "jammed")
    return "Go to the projector upstairs. Press E, then REPAIR & RESTART.";
  if (s.projector.status === "power")
    return "Reset the breaker at the end of the service passage, then restart the projector.";
  if (investigationComplete(s))
    return "Return to the upstairs booth. Assemble the film at the workbench (E).";
  if (s.events.jamRepaired) {
    if (!s.reels.includes("incident") || !s.items.reference)
      return "Collect the 1978 reel from the archive table. Follow STAFF ONLY, then FILM ARCHIVE.";
    if (s.activeReel !== "incident")
      return "Return to the upstairs projector. Select PLAY: INCIDENT REEL.";
    if (s.projector.status !== "running")
      return "Restart or rewind the projector upstairs. The patron moves when it is silent.";
    if (!s.evidence.doorway)
      return "In the service passage, photograph the painted-over exit beside the red EXIT sign (C).";
    if (!s.evidence.ada)
      return "Go through the BACKSTAGE door beside the screen. Photograph Ada from the side to see her key (C).";
    return "Take the missing film from the drawer labelled A. BELL at the back of the archive (E).";
  }
  if (s.items.coat)
    return "Check the projector upstairs. The film sounds loose.";
  if (s.evidence.first) return "Go to row F, seat 8. Check the coat (E).";
  if (s.items.ticket) return "Enter SCREEN ONE. Photograph row F, seat 8 (C).";
  if (openingComplete(s))
    return "Collect the new ticket from the printer at the lobby counter (E).";
  if (!s.tasks.message)
    return "Listen to the recorder at the lobby ticket counter (E).";
  if (!s.tasks.seats)
    return "Enter SCREEN ONE. Find row D, seat 3 and photograph its torn cushion (C).";
  return "Follow PROJECTION UPSTAIRS. Photograph the projector (C).";
}

// The plan is also the navigation surface. No overlapping floors or abstract
// shortcuts: the booth is reached by this staircase in both player and AI paths.
export const REGIONS = [
  { name: "Lobby", x1: -10, x2: 10, z1: 4, z2: 22, y: 0 },
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
  function inactive(box, planning) {
    if (!box.door) return false;
    if (box.openLeaf) return !doors[box.door];
    return !!doors[box.door] || (planning && box.door !== "exit");
  }
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
        !inactive(b, planning) &&
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
      if (inactive(box, planning)) continue;
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
