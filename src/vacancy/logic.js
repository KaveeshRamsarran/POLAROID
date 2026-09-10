export const SAVE_KEY = "polaroid.vacancy.v1";
export const REGIONS = [
  { name: "Motel stairs", x1: -6, x2: -3, z1: -6, z2: 3, ramp: true },
  { name: "Upper walkway", x1: -6, x2: 14, z1: -9, z2: -6, y: 3.1 },
  { name: "Room 5", x1: -6, x2: 2, z1: -15, z2: -9, y: 3.1 },
  { name: "Room 6", x1: 2, x2: 8, z1: -15, z2: -9, y: 3.1 },
  { name: "Room 7", x1: 8, x2: 14, z1: -15, z2: -9, y: 3.1 },
  { name: "Reception", x1: -14, x2: -6, z1: 5, z2: 14, y: 0 },
  { name: "Laundry", x1: -14, x2: -6, z1: -5, z2: 5, y: 0 },
  { name: "Courtyard", x1: -6, x2: 14, z1: -6, z2: 20, y: 0 },
];
export function regionAt(x, z) {
  return REGIONS.find((r) => x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2);
}
export function floorAt(x, z) {
  const r = regionAt(x, z);
  return r ? (r.ramp ? ((3 - z) / 9) * 3.1 : r.y) : null;
}
export const EVIDENCE = {
  suitcase: "Room 6 / her suitcase was here",
  laundry: "Laundry / the name that washed away",
  pool: "Pool / the key below the diving board",
  doorway: "Room 7 / the door under the paint",
  final: "Briar Glen / someone remembers you",
};
export const RECORDS = {
  welcome: {
    title: "THE NIGHT REGISTER",
    text: "BRIAR GLEN MOTOR LODGE · 14 NOVEMBER 1999\nThe clerk's pen is already resting beside your name. ELLIS. ROOM 6.\n\n“Your father preferred the upstairs rooms. Quiet at this time of year.”\n\nYou have not told him your father's name.",
  },
  phone: {
    title: "A CALL HOME",
    text: "The line connects to your brother, Daniel.\n\n“Briar Glen? Dad wouldn't even drive that road. Just get some sleep, Lena. Call me when the bridge opens.”\n\nA second receiver lifts somewhere in the building. The line goes dead.",
  },
  family: {
    title: "SUMMER, 1974",
    text: "Your father beside the motel pool. You, no older than four, holding his sleeve. A woman stands beside you, pale and difficult to make out in the faded print.\n\nOn the back, in your father's handwriting:\n“Lena and Evelyn. The night before.”\n\nYou were told your mother left before that holiday. Photograph the bed with his camera. There is a scuff beneath it, as if something heavy was dragged away.",
  },
  wash: {
    title: "THE LOST-PROPERTY BOOK",
    text: "19 AUGUST 1974 · PALE BLUE SUITCASE\nMrs Evelyn Ellis asked us to keep it dry. Her little girl was asleep upstairs.\n\n20 AUGUST · Owner unknown. No matching room.\n21 AUGUST · Empty case. Discard.\n\nA later hand has added: “Don't wash the labels. They're the first things to go.”",
  },
  register: {
    title: "THE MISSING PAGE",
    text: "19 AUGUST 1974\n6 · Arthur Ellis. Lena Ellis.\n7 · Evelyn Ellis.\n\nSomeone has pressed so hard beneath Evelyn's name that the paper is nearly torn:\n“Keep one thing with her name on it. I can still remember if I read it aloud.”\n\nOn the reverse is your father's unfinished letter: “I came back. Three times. Each time there were only six rooms.”",
  },
  message: {
    title: "FOR LENA",
    text: "Lena,\n\nIf you're reading this, Arthur got you out. Please don't hate him. The place takes the little things first. The shape of a face. The sound of a name. He was forgetting me while I was holding his hand.\n\nI tried to follow you, but every door led back here. This is a memory, love. It can't go home with you.\n\nTake my locket. Your picture is inside. Remember me as your mother, not as the woman who left.\n\nEvelyn.",
  },
  rules: {
    title: "NIGHT PORTER'S ROUND",
    text: "RECEPTION → LAUNDRY → UPSTAIRS → POOL\n\nGuest rooms are private. Close the door behind you. A knock is a courtesy, not permission.\n\nSomeone has written under the rota:\n“He hears running. He cannot see through the walls. Wait behind a closed door until the keys pass.”",
  },
};
export function newStory() {
  return {
    version: 1,
    checkpoint: { x: -0.5, z: 16, yaw: 0.9, pitch: 0 },
    film: 12,
    photos: [],
    evidence: {},
    items: {},
    events: {},
    records: {},
    doors: {
      reception: true,
      laundry: true,
      room5: false,
      room6: false,
      room7: false,
      connecting: true,
    },
    clerk: {
      x: -11,
      z: 10.9,
      mode: "waiting",
      patrol: 0,
      seen: 0,
      lost: 0,
      stunned: 0,
      warned: false,
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
    "items",
    "events",
    "records",
    "doors",
    "clerk",
  ])
    s[k] = { ...s[k], ...(raw[k] || {}) };
  for (const k of ["x", "z", "yaw", "pitch"])
    if (!Number.isFinite(s.checkpoint[k]))
      s.checkpoint[k] = newStory().checkpoint[k];
  if (floorAt(s.checkpoint.x, s.checkpoint.z) === null)
    s.checkpoint = newStory().checkpoint;
  for (const k of ["x", "z", "patrol", "seen", "lost", "stunned"])
    if (!Number.isFinite(s.clerk[k])) s.clerk[k] = newStory().clerk[k];
  if (floorAt(s.clerk.x, s.clerk.z) === null)
    Object.assign(s.clerk, newStory().clerk);
  if (
    !["waiting", "patrol", "investigate", "chase", "stunned"].includes(
      s.clerk.mode,
    )
  )
    s.clerk.mode = "patrol";
  s.film = Math.max(0, Math.min(30, Number(raw.film) || 0));
  s.photos = Array.isArray(raw.photos)
    ? raw.photos.filter((p) => typeof p.image === "string").slice(-20)
    : [];
  s.elapsed = Math.max(0, Number(raw.elapsed) || 0);
  s.completed = !!raw.completed;
  return s;
}
export function objective(s) {
  if (s.completed) return "Evelyn Ellis. Your mother. Remembered.";
  if (s.events.departure)
    return s.evidence.final
      ? "Get into your car (E). Take her name home."
      : "From beside your car, photograph the upstairs rooms (C).";
  if (s.items.locket)
    return "Leave Room 7. Reach your car in the courtyard. Walk quietly; listen for keys.";
  if (s.doors.room7)
    return "Room 7: read FOR LENA and take the locket on the lit writing desk by the window (E).";
  if (s.evidence.doorway)
    return "Use Evelyn's key on the revealed door in Room 6 (E).";
  if (s.items.page)
    return "Return to Room 6. Photograph the faded rectangle on its right-hand wall (C).";
  if (s.items.key)
    return "Find the loose 1974 register page on the reception desk (E).";
  if (s.evidence.pool)
    return "Take the brass key from the pool's diving board (E).";
  if (s.evidence.laundry)
    return "Photograph the old diving board at the far side of the drained pool (C).";
  if (s.evidence.suitcase)
    return "Go to the laundry downstairs. Photograph the lost-property shelf (C).";
  if (s.items.family)
    return "Photograph the bed in Room 6 (C). Watch the print develop.";
  if (s.items.called)
    return "Look at the old family photograph on the bedside table (E).";
  if (s.items.bag)
    return "Use the telephone on the bedside table to call home (E).";
  if (s.items.roomKey)
    return "Take your bag upstairs. Open Room 6 and set it on the luggage stand (E).";
  return "Ring the bell on the reception counter (E). The entrance is left of your car.";
}
export function photoAvailable(s, id) {
  return (
    {
      suitcase: !!s.items.family,
      laundry: !!s.evidence.suitcase,
      pool: !!s.evidence.laundry,
      doorway: !!s.items.page,
      final: !!s.events.departure,
    }[id] || false
  );
}
export function keepPhoto(s, photo) {
  s.photos.push(photo);
  photo.evidence.forEach((id) => (s.evidence[id] = photo.id));
  // Keep the latest exposure of every clue, even after many ordinary photos
  // or repeated attempts. Duplicate clue exposures may be retired safely.
  while (s.photos.length > 20) {
    const n = s.photos.findIndex((p) =>
      p.evidence.every((id) => s.evidence[id] !== p.id),
    );
    if (n < 0) break;
    s.photos.splice(n, 1);
  }
}
export function canCapture({
  available,
  framed,
  visible,
  facing = true,
  distance,
  maxDistance = 10,
}) {
  return (
    available &&
    framed &&
    visible &&
    facing &&
    distance > 0.35 &&
    distance < maxDistance
  );
}
export function doorUnlocked(s, id) {
  if (id === "room5") return !!s.events.awake;
  if (id === "room6") return !!s.items.roomKey;
  if (id === "room7") return !!(s.evidence.doorway && s.items.key);
  return true;
}
export const PATROL = [
  { x: -10, z: 10.7 },
  { x: -9, z: 0 },
  { x: -4.5, z: 4 },
  { x: -4.5, z: -7.5 },
  { x: 5, z: -7.5 },
  { x: 12, z: -7.5 },
  { x: -4.5, z: -7.5 },
  { x: -4.5, z: 4 },
  { x: 12, z: 11 },
  { x: 0, z: 13 },
];
// Threat timing has no connection to developing prints: only a real pause
// freezes it. Noise, sight and the patrol route determine its destination.
export function tickClerk(
  s,
  dt,
  {
    paused = false,
    grace = 0,
    sees = false,
    hears = false,
    distance = Infinity,
  } = {},
) {
  if (paused || s.completed || !s.events.awake || s.events.departure) return;
  const c = s.clerk;
  if (grace > 0) {
    c.seen = 0;
    return;
  }
  if (c.stunned > 0) {
    c.stunned = Math.max(0, c.stunned - dt);
    c.mode = c.stunned > 0 ? "stunned" : "investigate";
    return;
  }
  if (c.mode === "waiting") c.mode = "patrol";
  c.seen = sees ? Math.min(3, c.seen + dt) : Math.max(0, c.seen - dt * 0.6);
  if (sees || hears) c.lost = 0;
  else c.lost += dt;
  if (c.seen > 1.6) c.mode = "chase";
  else if (hears && c.mode !== "chase") c.mode = "investigate";
  if (c.lost > 9 && (c.mode === "chase" || c.mode === "investigate")) {
    c.mode = "patrol";
    c.seen = 0;
  }
  return c.mode === "chase" && sees && distance < 0.85 ? "caught" : undefined;
}
export function dazzle(s, visible, distance, framed) {
  if (
    !s.events.awake ||
    s.events.departure ||
    !visible ||
    !framed ||
    distance > 8 ||
    s.clerk.stunned > 0
  )
    return false;
  s.clerk.stunned = 4;
  s.clerk.seen = 0;
  s.clerk.mode = "stunned";
  return true;
}
export function recover(s) {
  s.film = Math.max(4, s.film);
  Object.assign(s.clerk, {
    x: -11,
    z: 10.9,
    mode: s.events.awake ? "patrol" : "waiting",
    seen: 0,
    lost: 0,
    stunned: 0,
  });
  return s;
}
