export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function seededRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const regions = [
  { name: "ENTRANCE HALL", x1: -2.2, x2: 2.2, z1: -17, z2: 14, y: 0 },
  { name: "LIVING ROOM", x1: -10, x2: -2.2, z1: 4, z2: 14, y: 0 },
  { name: "STUDY", x1: -10, x2: -2.2, z1: -6, z2: 4, y: 0 },
  { name: "STORAGE", x1: -10, x2: -2.2, z1: -17, z2: -6, y: 0 },
  { name: "KITCHEN", x1: 2.2, x2: 10, z1: 4, z2: 14, y: 0 },
  { name: "DINING ROOM", x1: 2.2, x2: 10, z1: -6, z2: 4, y: 0 },
  { name: "WASHROOM", x1: 2.2, x2: 10, z1: -17, z2: -6, y: 0 },
  { name: "STAIRCASE", x1: -2.2, x2: 2.2, z1: -23, z2: -17, y: 0, ramp: "up" },
  { name: "UPPER LANDING", x1: -2.2, x2: 2.2, z1: -29, z2: -23, y: 3.6 },
  { name: "NURSERY", x1: -10, x2: -2.2, z1: -29, z2: -18, y: 3.6 },
  { name: "MASTER BEDROOM", x1: 2.2, x2: 10, z1: -29, z2: -18, y: 3.6 },
  {
    name: "ATTIC STAIRS",
    x1: -2.2,
    x2: 2.2,
    z1: -35,
    z2: -29,
    y: 3.6,
    ramp: "attic",
  },
  { name: "ATTIC", x1: -6, x2: 6, z1: -43, z2: -35, y: 6.8 },
  {
    name: "BASEMENT STAIRS",
    x1: 10,
    x2: 16,
    z1: -16,
    z2: -12,
    y: 0,
    ramp: "down",
  },
  { name: "RITUAL CHAMBER", x1: 16, x2: 28, z1: -22, z2: -6, y: -3.6 },
  { name: "FRONT PORCH", x1: -5, x2: 5, z1: 14, z2: 24, y: 0 },
];
export function regionAt(x, z) {
  return regions.find((r) => x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2);
}
export function floorAt(x, z) {
  const r = regionAt(x, z);
  if (!r) return null;
  if (r.ramp === "up") return ((-z - 17) / 6) * 3.6;
  if (r.ramp === "attic") return 3.6 + ((-z - 29) / 6) * 3.2;
  if (r.ramp === "down") return (-(x - 10) / 6) * 3.6;
  return r.y;
}
export function blocked(x, z, solids, radius = 0.22, ignoreDoors = false) {
  if (floorAt(x, z) === null) return true;
  return solids.some(
    (b) =>
      !(ignoreDoors && b.door) &&
      (!b.door || b.door.open < 0.72) &&
      x > b.x1 - radius &&
      x < b.x2 + radius &&
      z > b.z1 - radius &&
      z < b.z2 + radius,
  );
}
export function lineOfSight(a, b, solids) {
  const d = distance(a, b),
    n = Math.ceil(d / 0.13),
    ay = a.y ?? (floorAt(a.x, a.z) ?? 0) + 1.45,
    by = b.y ?? (floorAt(b.x, b.z) ?? 0) + 1.45;
  for (let i = 1; i < n; i++) {
    const t = i / n,
      x = a.x + (b.x - a.x) * t,
      z = a.z + (b.z - a.z) * t,
      y = ay + (by - ay) * t;
    if (
      solids.some(
        (s) =>
          (!s.door || s.door.open < 0.72) &&
          x > s.x1 &&
          x < s.x2 &&
          z > s.z1 &&
          z < s.z2 &&
          y > (s.y1 ?? -100) &&
          y < (s.y2 ?? 100),
      )
    )
      return false;
  }
  return true;
}
// A compact grid supplies routes through doors and around furniture, without tracking the player.
export function findPath(from, to, solids, step = 0.8) {
  const key = (x, z) => `${x},${z}`,
    snap = (v) => Math.round(v / step),
    sx = snap(from.x),
    sz = snap(from.z),
    tx = snap(to.x),
    tz = snap(to.z);
  const queue = [[sx, sz]],
    seen = new Set([key(sx, sz)]),
    parents = new Map();
  let end = null;
  for (let i = 0; i < queue.length && i < 5000; i++) {
    const [x, z] = queue[i];
    if (Math.abs(x - tx) + Math.abs(z - tz) <= 1) {
      end = [x, z];
      break;
    }
    for (const [dx, dz] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        k = key(nx, nz);
      if (seen.has(k) || blocked(nx * step, nz * step, solids, 0.16, true))
        continue;
      seen.add(k);
      parents.set(k, [x, z]);
      queue.push([nx, nz]);
    }
  }
  if (!end) return [];
  const path = [];
  while (end[0] !== sx || end[1] !== sz) {
    path.push({ x: end[0] * step, z: end[1] * step });
    end = parents.get(key(...end));
    if (!end) break;
  }
  path.reverse();
  if (
    !blocked(to.x, to.z, solids, 0.16, true) &&
    lineOfSight(path.at(-1) || from, to, solids)
  ) {
    path.push({ x: to.x, z: to.z });
  }
  return path;
}
export const evidenceDefs = [
  {
    id: "writing",
    name: "THE PROMISE",
    room: "STUDY",
    symbol: "I",
    x: -9.72,
    y: 1.7,
    z: -1,
    look: "The empty frame above the study desk.",
    note: "Mara wrote the attic combination where only the camera could see it.",
    story:
      "“I came for my sister. He had already photographed her. Four images to bring her back. Four images to let him in.”",
  },
  {
    id: "mirror",
    name: "THE MOTHER",
    room: "WASHROOM",
    symbol: "II",
    x: 7,
    y: 1.6,
    z: -16.7,
    look: "The mirror above the washroom sink.",
    note: "A woman in the glass. Her hand points beneath the sink.",
    story:
      "“She hid the brass key under the basin. The cellar was never meant to be opened again.”",
  },
  {
    id: "child",
    name: "THE CHILD",
    room: "NURSERY",
    symbol: "III",
    x: -7,
    y: 4.9,
    z: -26,
    look: "The small bed in the upstairs nursery.",
    note: "A child waits beside the bed. The outline is made of light.",
    story:
      "“He said if I stood very still, the camera would keep me forever. I want to go home.”",
  },
  {
    id: "family",
    name: "THE WITNESS",
    room: "ATTIC",
    symbol: "IV",
    x: 0,
    y: 8.1,
    z: -42.6,
    look: "The family portrait at the far end of the attic.",
    note: "Mara is in the photograph. So is the camera I am holding.",
    story:
      "“You did not come here to find me. You came back because you had forgotten what you did. Put us in the frames. Then run.”",
  },
];
export function newState(seed = Date.now() >>> 0) {
  const random = seededRandom(seed);
  return {
    version: 1,
    seed,
    film: 8,
    battery: 100,
    evidence: {},
    photos: [],
    notes: [],
    key: false,
    atticUnlocked: false,
    ritual: [null, null, null, null],
    ritualComplete: false,
    finalPhoto: false,
    escaped: false,
    shots: 0,
    elapsed: 0,
    code: String(1000 + Math.floor(random() * 9000)),
    picked: [],
    checkpoint: { x: 0, z: 11, yaw: 0 },
    hintIndex: 0,
  };
}
export function objectiveFor(s) {
  if (s.ritualComplete)
    return s.finalPhoto
      ? "The front door is open. Leave."
      : "Return to the front door. Take one last photograph.";
  if (Object.keys(s.evidence).length === 4)
    return "Take the four photographs to the basement. Place them in order.";
  if (!s.evidence.writing)
    return "Mara left a message in the study. Photograph the empty frame.";
  if (!s.evidence.mirror)
    return "Find the washroom mirror. Trust the photograph.";
  if (!s.evidence.child)
    return "There is a child upstairs. Photograph the nursery bed.";
  if (!s.atticUnlocked) return "Use the study photograph to unlock the attic.";
  return "Find the family portrait in the attic.";
}
export function canCapture(target, position, forward, solids) {
  const dx = target.x - position.x,
    dy = target.y - position.y,
    dz = target.z - position.z,
    d = Math.hypot(dx, dy, dz);
  return (
    d < 10 &&
    d > 0.5 &&
    (dx * forward.x + dy * forward.y + dz * forward.z) / d > 0.84 &&
    lineOfSight(position, target, solids)
  );
}
export function placePhoto(state, index, id) {
  if (!state.evidence[id]) return false;
  state.ritual[index] = id;
  return state.ritual.every((v, i) => v === evidenceDefs[i].id);
}
export function normalizeSave(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Number.isFinite(value.seed) ||
    !value.checkpoint ||
    !Number.isFinite(value.checkpoint.x) ||
    !Number.isFinite(value.checkpoint.z) ||
    !value.evidence ||
    !Array.isArray(value.photos) ||
    !Array.isArray(value.ritual)
  )
    return null;
  return {
    ...newState(value.seed),
    ...value,
    film: clamp(Number(value.film) || 0, 0, 99),
    battery: clamp(Number(value.battery) || 100, 15, 100),
  };
}

export class ObserverAI {
  constructor(solids, random = Math.random) {
    this.solids = solids;
    this.random = random;
    this.position = { x: 0, z: -15 };
    this.state = "DORMANT";
    this.timer = 0;
    this.path = [];
    this.target = null;
    this.lastKnown = null;
    this.warning = 0;
    this.repath = 0;
    this.visits = new Map();
    this.noises = [];
    this.detectedFor = 0;
    this.materialize = 0;
    this.hearCooldown = 0;
  }
  hear(position, loudness, progress) {
    if (
      distance(position, this.position) > loudness ||
      progress < 1 ||
      this.state === "RETREATING"
    )
      return;
    this.lastKnown = { x: position.x, z: position.z };
    this.noises.push({ ...this.lastKnown, time: this.timer });
    this.noises = this.noises.slice(-6);
    if (this.state !== "CHASING") {
      this.change("INVESTIGATING", 6);
      this.route(this.lastKnown);
    }
  }
  route(target) {
    this.target = { ...target };
    this.path = findPath(this.position, target, this.solids);
    this.repath = 1.2;
  }
  change(state, duration) {
    this.state = state;
    this.timer = duration;
    this.detectedFor = 0;
  }
  repel() {
    this.change("RETREATING", 9);
    const options = [
      { x: -7, z: 10 },
      { x: 7, z: -1 },
      { x: 0, z: -26 },
    ];
    options.sort(
      (a, b) => distance(b, this.position) - distance(a, this.position),
    );
    this.route(options[0]);
    this.warning = 0;
  }
  update(dt, player, progress, final, hidden, sprinting) {
    this.timer -= dt;
    this.repath -= dt;
    this.materialize = Math.max(0, this.materialize - dt);
    this.hearCooldown -= dt;
    const d = distance(this.position, player),
      los =
        d < 12 &&
        Math.abs(
          (floorAt(this.position.x, this.position.z) ?? 0) -
            (floorAt(player.x, player.z) ?? 0),
        ) < 2.8 &&
        lineOfSight(this.position, player, this.solids);
    if (sprinting && this.hearCooldown <= 0) {
      this.hear(player, 13, progress);
      this.hearCooldown = 1.4;
    }
    if (progress === 0) {
      this.state = "DORMANT";
      return { caught: false, distance: d, warning: 0 };
    }
    if (this.state === "DORMANT") {
      this.change("WATCHING", 22);
      this.route({ x: 0, z: -14 });
    }
    const visible =
      los &&
      !hidden &&
      (final ||
        this.materialize > 0 ||
        this.state === "CHASING" ||
        ((this.state === "INVESTIGATING" || this.state === "SEARCHING") &&
          d < 6));
    if (visible && progress >= 2 && this.state !== "RETREATING") {
      this.detectedFor += dt;
      if (this.detectedFor > 1.3 && this.state !== "CHASING") {
        this.change("CHASING", 7);
        this.warning = 1.8;
      }
    } else this.detectedFor = Math.max(0, this.detectedFor - dt * 0.6);
    if (this.state === "CHASING") {
      if (visible) {
        this.lastKnown = { x: player.x, z: player.z };
        this.timer = 6;
        if (this.repath <= 0) this.route(this.lastKnown);
      }
      if (!visible && this.timer <= 0) {
        this.change("SEARCHING", 12);
        this.route(this.lastKnown || this.position);
      }
    } else if (
      this.state === "INVESTIGATING" &&
      (this.path.length === 0 || this.timer <= 0)
    ) {
      this.change("SEARCHING", 12);
      this.route(this.searchPoint());
    } else if (this.state === "SEARCHING") {
      if (this.path.length === 0 && this.repath <= 0)
        this.route(this.searchPoint());
      if (this.timer <= 0) {
        this.change("STALKING", 22);
        this.route(this.searchPoint(8));
      }
    } else if (this.state === "WATCHING" && this.timer <= 0) {
      this.change("STALKING", 20);
      this.route(this.searchPoint(9));
    } else if (this.state === "STALKING" && this.timer <= 0) {
      this.change("WATCHING", 18);
      this.route(this.searchPoint(10));
    } else if (this.state === "RETREATING" && this.timer <= 0) {
      this.change("WATCHING", 18);
    }
    if (
      final &&
      this.state !== "CHASING" &&
      this.state !== "RETREATING" &&
      this.timer <= 5
    ) {
      this.materialize = 4;
      if (this.lastKnown && this.path.length === 0) this.route(this.lastKnown);
    }
    const speed =
      this.state === "CHASING"
        ? final
          ? 3.2
          : 2.8
        : this.state === "RETREATING"
          ? 3
          : this.state === "WATCHING"
            ? 0.55
            : 1.15;
    if (this.path.length) {
      const p = this.path[0],
        dx = p.x - this.position.x,
        dz = p.z - this.position.z,
        n = Math.hypot(dx, dz);
      if (n < 0.13) this.path.shift();
      else {
        const move = Math.min(n, dt * speed);
        this.position.x += (dx / n) * move;
        this.position.z += (dz / n) * move;
      }
      for (const b of this.solids)
        if (b.door && distance(this.position, b.door.position) < 1.4)
          b.door.target = 1;
    }
    if (this.state === "CHASING") this.warning = Math.max(0, this.warning - dt);
    return {
      caught:
        this.state === "CHASING" &&
        d < 0.7 &&
        los &&
        !hidden &&
        this.warning === 0,
      distance: d,
      warning: this.state === "CHASING" ? 1 : clamp((7 - d) / 7, 0, 0.75),
    };
  }
  searchPoint(radius = 5) {
    const origin = this.lastKnown || this.position;
    for (let i = 0; i < 20; i++) {
      const p = {
        x: origin.x + (this.random() - 0.5) * radius * 2,
        z: origin.z + (this.random() - 0.5) * radius * 2,
      };
      if (!blocked(p.x, p.z, this.solids, 0.35, true)) return p;
    }
    return { x: 0, z: -8 };
  }
}
