import * as THREE from "three";
import { buildMotel } from "./world.js";
import { MotelSound } from "./audio.js";
import {
  SAVE_KEY,
  EVIDENCE,
  RECORDS,
  PATROL,
  newStory,
  restoreStory,
  objective,
  floorAt,
  regionAt,
  photoAvailable,
  keepPhoto,
  canCapture,
  doorUnlocked,
  tickClerk,
  dazzle,
  recover,
} from "./logic.js";
import {
  createRenderer,
  movementIntent,
  photograph,
  releaseScene,
  readSettings,
  SETTINGS_KEY,
} from "../shared/runtime.js";
import { createAnalogPresentation } from "../shared/analog-presentation.js";
import { routeApproaches } from "../shared/navigation.js";
import "./vacancy.css";

const $ = (s) => document.querySelector(s),
  canvas = $("#world");
document.body.classList.add("vacancy-game");
document.title = "POLAROID — Vacancy";
canvas.setAttribute(
  "aria-label",
  "First-person view of Briar Glen Motor Lodge",
);
$("#menu").hidden = true;
let settings = readSettings(),
  state = newStory(),
  mode = "launch",
  started = false,
  disposed = false,
  physical = false,
  held = null,
  develop = 0,
  shotCooldown = 0,
  subtitleUntil = 0,
  grace = 0,
  route = [],
  routeTimer = 0,
  stepTimer = 0,
  lastKeySound = 0,
  doorWait = null,
  inspecting = false;
const keys = {},
  player = { ...state.checkpoint },
  scene = new THREE.Scene();
scene.background = new THREE.Color("#0c151a");
scene.fog = new THREE.FogExp2("#10202a", 0.017);
const camera = new THREE.PerspectiveCamera(
  settings.fov,
  innerWidth / innerHeight,
  0.035,
  95,
);
camera.rotation.order = "YXZ";
scene.add(camera);
const renderer = createRenderer(canvas),
  presentation = createAnalogPresentation(renderer),
  world = buildMotel(scene, () => state),
  audio = new MotelSound();
const weaponScene = new THREE.Scene(),
  weaponCamera = new THREE.PerspectiveCamera(
    67,
    innerWidth / innerHeight,
    0.015,
    4,
  );
weaponScene.add(new THREE.HemisphereLight("#e8dcc3", "#443c2e", 2.3));
const cameraModel = world.makeCamera(weaponScene);
cameraModel.scale.setScalar(0.72);
const flashlight = new THREE.SpotLight("#efdfc1", 20, 22, 0.65, 0.65, 1.5);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.bias = -0.0003;
flashlight.shadow.normalBias = 0.015;
flashlight.target.position.set(0, 0, -5);
camera.add(flashlight, flashlight.target);
const warning = document.createElement("div");
warning.className = "vacancy-warning";
warning.setAttribute("role", "status");
document.body.append(warning);
const listeners = [];
function on(target, event, fn, options) {
  target.addEventListener(event, fn, options);
  listeners.push(() => target.removeEventListener(event, fn, options));
}
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function applySettings() {
  presentation.configure(settings);
  audio.set(settings);
  renderer.shadowMap.enabled = settings.quality !== "low";
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, settings.quality === "low" ? 1 : 1.5),
  );
  renderer.toneMappingExposure = settings.brightness;
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
}
await world.ready;
applySettings();
// The family keepsake is a real, separately staged 1974 photograph. It is
// supplied story material, never substituted for a player's evidence exposure.
{
  world.update(state, 0, 0, player, false);
  const portrait = new THREE.PerspectiveCamera(45, 1, 0.035, 40);
  portrait.position.set(5, 1.6, 5);
  portrait.lookAt(6.5, 1, -0.5);
  const oldMother = world.mother.position.clone();
  world.mother.position.set(7.2, 0, -0.5);
  for (const actor of [world.father, world.mother, world.child]) {
    actor.visible = true;
    actor.rotation.y = 0;
  }
  const fill = new THREE.HemisphereLight(0xe9d5ac, 0x7c8068, 3);
  scene.add(fill);
  renderer.render(scene, portrait);
  const image = photograph(canvas, 400),
    texture = new THREE.TextureLoader().load(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  world.familyPhoto.material.map.dispose();
  world.familyPhoto.material.map = texture;
  world.familyPhoto.userData.image = image;
  world.mother.position.copy(oldMother);
  world.mother.rotation.y = 0;
  for (const actor of [world.father, world.mother, world.child])
    actor.visible = false;
  scene.remove(fill);
  fill.dispose();
}
function subtitle(text, seconds = 7, critical = false) {
  if (!settings.subtitles && !critical) return;
  $("#subtitle").textContent = text;
  subtitleUntil = state.elapsed + seconds;
}
function save(checkpoint = true) {
  if (!started || mode === "dead") return;
  if (checkpoint && !world.nav.blocked(player.x, player.z))
    state.checkpoint = { ...player };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    subtitle(
      "Storage is full. Discard extra prints in the journal to make room.",
      10,
      true,
    );
  }
}
function lock() {
  canvas
    .requestPointerLock?.()
    ?.catch?.(() =>
      subtitle(
        "Drag to look, or use the arrow keys. C takes a photograph.",
        6,
        true,
      ),
    );
  audio.ctx?.resume();
}
function panel(title, body, buttons = [], paused = false) {
  physical = !paused;
  if (paused) {
    mode = "paused";
    audio.pause(true);
    audio.ctx?.suspend();
  }
  $("#overlay").hidden = false;
  $("#overlay-content").innerHTML =
    `<div class="eyebrow">POLAROID / VACANCY</div><h2>${title}</h2>${body}${paused ? "" : '<p class="vacancy-live">You can still hear the building. Reading does not pause the night.</p>'}<div class="cinema-controls">${buttons.map((b) => `<button id="${b.id}">${b.label}</button>`).join("")}<button id="panel-close">${paused ? "RESUME" : "PUT AWAY"}</button></div>`;
  document.exitPointerLock?.();
  buttons.forEach((b) => ($("#" + b.id).onclick = b.action));
  $("#panel-close").onclick = closePanel;
}
function closePanel() {
  physical = false;
  if (mode === "paused") mode = "playing";
  $("#overlay").hidden = true;
  audio.pause(false);
  audio.ctx?.resume();
  lock();
}
function pause() {
  if (mode !== "playing") return;
  save();
  panel(
    "PAUSED",
    `<p>${objective(state)}</p>`,
    [
      { id: "journal-open", label: "JOURNAL", action: journal },
      { id: "settings-open-vacancy", label: "SETTINGS", action: settingsPanel },
      {
        id: "stories",
        label: "STORY SELECTION",
        action: () => {
          save();
          location.href = "./";
        },
      },
    ],
    true,
  );
}
function readRecord(id) {
  state.records[id] = true;
  save();
  const r = RECORDS[id];
  panel(
    r.title,
    `${id === "family" ? `<img class="vacancy-keepsake" src="${world.familyPhoto.userData.image}" alt="The Ellis family beside the motel pool in 1974">` : ""}<p class="vacancy-letter">${escapeHTML(r.text)}</p>`,
  );
}
function settingsPanel() {
  panel(
    "SETTINGS",
    [
      ["master", "Master volume", 0, 1, 0.05],
      ["music", "Music", 0, 1, 0.05],
      ["effects", "Effects", 0, 1, 0.05],
      ["sensitivity", "Mouse sensitivity", 0.2, 2.5, 0.1],
      ["brightness", "Brightness", 0.6, 2, 0.1],
      ["fov", "Field of view", 55, 90, 1],
    ]
      .map(
        ([key, name, min, max, step]) =>
          `<label class="setting">${name}<input data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}"></label>`,
      )
      .join("") +
      `<label class="setting">Graphics<select data-setting="quality"><option value="high">High</option><option value="low">Reduced effects</option></select></label>` +
      [
        ["retroEffects", "Analog picture"],
        ["subtitles", "Subtitles"],
        ["visualWarnings", "Visual danger cues"],
      ]
        .map(
          ([key, name]) =>
            `<label class="setting">${name}<input data-setting="${key}" type="checkbox" ${settings[key] !== false ? "checked" : ""}></label>`,
        )
        .join(""),
    [],
    true,
  );
  $('[data-setting="quality"]').value = settings.quality;
  document.querySelectorAll("[data-setting]").forEach(
    (input) =>
      (input.oninput = () => {
        settings[input.dataset.setting] =
          input.type === "checkbox"
            ? input.checked
            : input.type === "range"
              ? Number(input.value)
              : input.value;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        applySettings();
      }),
  );
}
function journal() {
  panel(
    "PHOTOGRAPHS & NOTES",
    `<p>${objective(state)}</p><p class="small">Photographs show what occupied this place during your family's last night here. A flash can briefly dazzle the clerk if you frame him nearby.</p><div class="lore-journal">${Object.keys(
      state.records,
    )
      .filter((id) => RECORDS[id])
      .map(
        (id) =>
          `<details><summary>${RECORDS[id].title}</summary><p class="vacancy-letter">${escapeHTML(RECORDS[id].text)}</p></details>`,
      )
      .join(
        "",
      )}</div><div class="cinema-journal">${state.photos.map((p) => `<figure><button data-print="${p.id}"><img src="${p.image}" alt="${escapeHTML(p.caption)}"></button><figcaption>${escapeHTML(p.caption)}</figcaption>${p.evidence.length ? "" : `<button data-delete="${p.id}">DISCARD PRINT</button>`}</figure>`).join("")}</div>`,
    [],
    true,
  );
  document.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = () => {
        state.photos = state.photos.filter((p) => p.id !== b.dataset.delete);
        save(false);
        journal();
      }),
  );
  document.querySelectorAll("[data-print]").forEach(
    (b) =>
      (b.onclick = () => {
        held = state.photos.find((p) => p.id === b.dataset.print);
        develop = 0;
        showPrint();
        closePanel();
        $("#photo-held").classList.add("inspecting");
      }),
  );
}
function interact(id) {
  if (id.startsWith("door:")) {
    const key = id.slice(5);
    if (!doorUnlocked(state, key)) {
      subtitle(
        key === "room7"
          ? "There is only paint here. Your father's photograph remembers a door."
          : key === "room5"
            ? "A television plays inside. The door is locked."
            : "The room key is waiting at reception.",
        6,
        true,
      );
      return;
    }
    state.doors[key] = !state.doors[key];
    world.syncDoors();
    audio.door(world.interactions.find((t) => t.id === id).position);
    save();
    return;
  }
  if (id === "bell") {
    audio.bell({ x: -9.5, y: 1.17, z: 8 });
    state.items.roomKey = true;
    state.records.welcome = true;
    readRecord("welcome");
  }
  if (id === "bag") {
    state.items.bag = true;
    subtitle(
      "Your father's camera is still in the bag. The telephone should work.",
      7,
      true,
    );
    save();
  }
  if (id === "phone") {
    audio.phone({ x: 6.7, y: 3.8, z: -13.65 });
    state.items.called = true;
    readRecord("phone");
  }
  if (id === "family") {
    state.items.family = true;
    readRecord("family");
  }
  if (id === "wash") readRecord("wash");
  if (id === "rules") readRecord("rules");
  if (id === "key") {
    state.items.key = true;
    subtitle(
      "A brass 7. A tiny tag: EVELYN ELLIS. There must be a matching entry in reception.",
      8,
      true,
    );
    save();
  }
  if (id === "page") {
    state.items.page = true;
    readRecord("register");
  }
  if (id === "locket") {
    state.items.locket = true;
    state.events.awake = true;
    state.events.escape = true;
    // Preserve the clerk's actual location; do not teleport him onto the route.
    grace = Math.max(grace, 8);
    readRecord("message");
  }
  if (id === "film") {
    if (state.film >= 12) {
      subtitle(
        "You have enough film for now. The box will stay here.",
        5,
        true,
      );
      return;
    }
    state.film = Math.min(16, state.film + 6);
    subtitle("Six exposures. There is another packet if you need it.", 5, true);
    save();
  }
  if (id === "car") {
    if (!state.items.locket) {
      subtitle(
        state.items.roomKey
          ? "The bridge is still closed. Your room is upstairs."
          : "The engine ticks as it cools. Ring the bell at reception.",
        6,
        true,
      );
      return;
    }
    if (!state.events.departure) {
      state.events.departure = true;
      state.clerk.seen = 0;
      state.clerk.mode = "waiting";
      state.clerk.x = -11;
      state.clerk.z = 10.9;
      grace = 30;
      subtitle(
        "The keys stop. Dawn is breaking. Before you leave, photograph the upstairs rooms.",
        10,
        true,
      );
      save();
      return;
    }
    if (state.evidence.final) finish();
    else subtitle(objective(state), 7, true);
  }
}
const ray = new THREE.Raycaster();
function visible(
  position,
  tolerance = 0.12,
  ignoreDoor = null,
  origin = camera.position,
) {
  const delta = position.clone().sub(origin);
  ray.set(origin, delta.clone().normalize());
  ray.far = Math.max(0, delta.length() - tolerance);
  return !ray.intersectObjects(
    world.occluders.filter((o) => {
      for (let p = o; p; p = p.parent) if (!p.visible) return false;
      return !ignoreDoor || o.userData.interactionDoor !== ignoreDoor;
    }),
    false,
  ).length;
}
function framed(position, margin = 0.82) {
  const p = position.clone().project(camera);
  return (
    p.z > -1 &&
    p.z < 1 &&
    Math.abs(p.x) < margin / Math.max(1, camera.aspect) &&
    Math.abs(p.y) < margin
  );
}
function eligible(id) {
  const t = world.targets[id];
  return canCapture({
    available: photoAvailable(state, id),
    framed: framed(t.position),
    visible: visible(t.position),
    facing:
      !t.facing ||
      t.facing.dot(camera.position.clone().sub(t.position).normalize()) > 0.12,
    distance: t.position.distanceTo(camera.position),
    maxDistance: t.maxDistance,
  });
}
function interactionTarget() {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  return world.interactions
    .filter((t) => {
      if (t.when && !t.when(state)) return false;
      if (t.id === "door:room7" && !state.evidence.doorway) return false;
      const delta = t.position.clone().sub(camera.position);
      return (
        delta.length() < t.range &&
        delta.normalize().dot(forward) > 0.35 &&
        visible(t.position, 0.14, t.door)
      );
    })
    .sort((a, b) => {
      const score = (t) => {
        const d = t.position.clone().sub(camera.position);
        return d.length() + (1 - d.normalize().dot(forward)) * 5;
      };
      return score(a) - score(b);
    })[0];
}
function showPrint() {
  $("#photo-held").hidden = false;
  $("#photo-held").classList.remove("inspecting");
  $("#photo-image").src = held.image;
  $("#photo-title").textContent = develop > 0 ? "DEVELOPING" : held.caption;
  $("#photo-note").textContent = "R INSPECT · Q PUT AWAY · J JOURNAL";
}
function capture() {
  if (mode !== "playing" || physical || shotCooldown > 0) return;
  if (!state.film) {
    subtitle(
      "No film. There is an emergency box on the reception counter.",
      8,
      true,
    );
    return;
  }
  state.film--;
  shotCooldown = 3;
  world.update(state, 0, state.elapsed, player, true);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const ids = Object.keys(EVIDENCE).filter(eligible);
  const clerkHead = world.clerk.position
    .clone()
    .add(new THREE.Vector3(0, 1.55, 0));
  const dazzled = dazzle(
    state,
    visible(clerkHead),
    clerkHead.distanceTo(camera.position),
    framed(clerkHead),
  );
  renderer.clear();
  renderer.render(scene, camera);
  const image = photograph(canvas);
  world.update(state, 0, state.elapsed, player, false);
  audio.shutter();
  const fresh = ids.filter((id) => !state.evidence[id]);
  held = {
    id: `p${Date.now()}-${state.photos.length}`,
    image,
    evidence: ids,
    caption: ids.length
      ? ids.map((id) => EVIDENCE[id]).join(" / ")
      : dazzled
        ? "The night clerk / caught in the flash"
        : "Briar Glen / the night you came back",
  };
  keepPhoto(state, held);
  develop = 3;
  showPrint();
  $("#flash").style.opacity = settings.quality === "low" ? ".18" : ".55";
  if (fresh.includes("suitcase")) {
    state.events.firstPrint = true;
    subtitle(
      "A blue suitcase develops beneath the bed. Your mother's initials. The label says LOST PROPERTY.",
      10,
      true,
    );
  } else if (fresh.includes("laundry")) {
    state.events.awake = true;
    state.clerk.mode = "patrol";
    state.records.wash = true;
    grace = 12;
    subtitle(
      "The label reads EVELYN ELLIS. ROOM 7. POOL. Outside, the clerk begins his round. Listen for his keys.",
      11,
      true,
    );
  } else if (fresh.includes("pool"))
    subtitle(
      "The print shows a room key on the diving board. When you look up, the key is really there.",
      9,
      true,
    );
  else if (fresh.includes("doorway"))
    subtitle(
      "The paint gives way to a door. Seven. Your mother's room was beside yours all along.",
      9,
      true,
    );
  else if (fresh.includes("final"))
    subtitle(
      "She is standing outside Room 7. Not waiting to be collected. Watching you leave.",
      10,
      true,
    );
  else if (dazzled)
    subtitle("He covers his eyes. Four seconds. Move.", 4, true);
  else
    subtitle("Print saved. Check the journal for what to photograph next.", 5);
  save();
}
function threat(dt) {
  const c = state.clerk,
    eye = world.clerk.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
    distance = eye.distanceTo(camera.position);
  const sees =
    distance < 11 &&
    Math.abs(eye.y - camera.position.y) < 2.2 &&
    visible(camera.position, 0.15, null, eye);
  const sprint = !!(
    (keys.ShiftLeft || keys.ShiftRight) &&
    (keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD)
  );
  const hears = sprint && distance < 6;
  const result = tickClerk(state, dt, { grace, sees, hears, distance });
  if (result === "caught") {
    die();
    return;
  }
  if (
    !state.events.awake ||
    state.events.departure ||
    grace > 0 ||
    c.stunned > 0
  )
    return;
  if (sees || hears) c.goal = { x: player.x, z: player.z };
  if (c.seen > 0.3 && !c.warned) {
    c.warned = true;
    subtitle(
      "The keys stop. “You should be in your room.” Break his view; close a door behind you.",
      8,
      true,
    );
  }
  if (c.mode === "patrol") c.warned = false;
  const goal =
    c.mode === "patrol"
      ? PATROL[c.patrol % PATROL.length]
      : c.goal || PATROL[c.patrol % PATROL.length];
  if (Math.hypot(c.x - goal.x, c.z - goal.z) < 0.45) {
    if (c.mode === "patrol") c.patrol = (c.patrol + 1) % PATROL.length;
    else if (!sees) c.lost += dt;
    route = [];
    routeTimer = 0;
    return;
  }
  routeTimer -= dt;
  if (routeTimer <= 0) {
    route = world.nav.path(c, goal);
    routeTimer = 1.5;
  }
  for (const d of world.doors) {
    if (
      state.doors[d.id] ||
      !doorUnlocked(state, d.id) ||
      Math.abs(floorAt(c.x, c.z) - d.group.position.y) > 1 ||
      Math.hypot(c.x - d.group.position.x, c.z - d.group.position.z) > 1.3
    )
      continue;
    if (!routeApproaches(c, route, d.group.position)) continue;
    if (!doorWait || doorWait.id !== d.id) {
      doorWait = { id: d.id, remaining: 2.8 };
      audio.door(d.group.position);
      if (distance < 10)
        subtitle("A knock. His hand finds the handle.", 4, true);
    }
    doorWait.remaining -= dt;
    if (doorWait.remaining > 0) return;
    state.doors[d.id] = true;
    world.syncDoors();
    doorWait = null;
    routeTimer = 0;
  }
  while (route.length && Math.hypot(route[0].x - c.x, route[0].z - c.z) < 0.2)
    route.shift();
  if (route.length) {
    const next = route[0],
      d = Math.hypot(next.x - c.x, next.z - c.z),
      step = Math.min(d, dt * (c.mode === "chase" ? 2.65 : 1.12));
    const p = {
      x: c.x + ((next.x - c.x) / d) * step,
      z: c.z + ((next.z - c.z) / d) * step,
    };
    if (world.nav.clear(c, p, 0.21)) {
      c.x = p.x;
      c.z = p.z;
    } else routeTimer = 0;
  }
  if (state.elapsed - lastKeySound > 2.5) {
    lastKeySound = state.elapsed;
    audio.keys({ x: c.x, y: eye.y, z: c.z });
  }
  const steps = world.clerk.userData.footfallCount || 0;
  if (steps > (c.lastFootfall || 0)) {
    c.lastFootfall = steps;
    audio.foot(
      { x: c.x, y: floorAt(c.x, c.z), z: c.z },
      "concrete",
      c.mode === "chase",
      false,
    );
  }
}
function die() {
  mode = "dead";
  physical = false;
  audio.pause(true);
  audio.ctx?.suspend();
  document.exitPointerLock?.();
  $("#overlay").hidden = false;
  $("#overlay-content").innerHTML =
    '<div class="eyebrow">ANOTHER EMPTY ROOM</div><h2>NO RECORD OF YOU</h2><p>The clerk closes the register. For a moment, even your name sounds unfamiliar.</p><div class="cinema-controls"><button id="retry">RETURN TO LAST MEMORY</button><button id="dead-stories">STORY SELECTION</button></div>';
  $("#retry").onclick = () => load(true, true);
  $("#dead-stories").onclick = () => (location.href = "./");
}
function finish() {
  state.completed = true;
  save();
  mode = "ending";
  physical = false;
  audio.pause(true);
  audio.ctx?.suspend();
  document.exitPointerLock?.();
  const final = state.photos.find((p) => p.id === state.evidence.final);
  $("#overlay").hidden = false;
  $("#overlay-content").innerHTML =
    `<div class="eyebrow">CHAPTER 03 / COMPLETED</div><h2>VACANCY</h2><img class="vacancy-keepsake" src="${final?.image || ""}" alt="Evelyn watching you leave from outside Room 7"><p class="vacancy-letter">You call Daniel from the first open service station.\n\n“Our mother's name was Evelyn,” you say. “She didn't leave us.”\n\nInside the locket is a photograph of you, aged four. On the back are two words: MY LENA.\n\nYou keep the final print on the passenger seat. Your mother stands in the morning light. You remember the open register on the reception desk. Your name was already there.\n\nELLIS. ROOM 6.</p><button id="ending-stories" class="filled-button">RETURN TO POLAROID</button>`;
  $("#ending-stories").onclick = () => (location.href = "./");
}
function load(useSave, retry = false) {
  let saved;
  try {
    saved = restoreStory(JSON.parse(localStorage.getItem(SAVE_KEY) || "null"));
  } catch {}
  state = useSave && saved && !saved.completed ? saved : newStory();
  if (retry) recover(state);
  scene.fog.color.set(state.events.departure ? "#53636a" : "#10202a");
  scene.background.copy(scene.fog.color);
  Object.assign(player, state.checkpoint);
  world.syncDoors();
  if (world.nav.blocked(player.x, player.z)) {
    Object.assign(player, newStory().checkpoint);
  }
  mode = "playing";
  started = true;
  physical = false;
  held = null;
  route = [];
  routeTimer = 0;
  doorWait = null;
  develop = 0;
  shotCooldown = 0;
  grace = useSave ? 18 : 0;
  for (const k of Object.keys(keys)) keys[k] = false;
  $("#overlay").hidden = true;
  $("#photo-held").hidden = true;
  $("#hud").hidden = false;
  $("#loading").hidden = true;
  document.querySelector(".story-launch")?.remove();
  audio.start();
  audio.pause(false);
  audio.set(settings);
  audio.ctx?.resume();
  move(0);
  save(false);
  lock();
  subtitle(
    useSave
      ? "Memory restored. Eighteen seconds to find your bearings."
      : "Briar Glen. November 1999. The bridge is flooded. Reception is still lit.",
    9,
    true,
  );
}
function move(dt) {
  if (!physical) {
    player.yaw +=
      ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * dt * 1.45;
    player.pitch = THREE.MathUtils.clamp(
      player.pitch +
        ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * dt * 1.45,
      -1.35,
      1.35,
    );
  }
  const crouch = !!(keys.ControlLeft || keys.ControlRight || keys.KeyX),
    motion = movementIntent(keys, player.yaw, crouch, physical);
  const old = { x: player.x, z: player.z },
    nx = player.x + motion.vx * dt,
    nz = player.z + motion.vz * dt;
  if (!world.nav.blocked(nx, player.z)) player.x = nx;
  if (!world.nav.blocked(player.x, nz)) player.z = nz;
  const moved = Math.hypot(old.x - player.x, old.z - player.z) > 0.0005;
  if (moved) {
    stepTimer -= dt;
    if (stepTimer <= 0) {
      const p = { x: player.x, y: floorAt(player.x, player.z), z: player.z },
        region = regionAt(player.x, player.z);
      if (region?.name.startsWith("Room"))
        audio.carpet(p, motion.sprint, crouch);
      else
        audio.foot(
          p,
          region?.ramp
            ? "metal"
            : region?.name === "Laundry"
              ? "tile"
              : "concrete",
          motion.sprint,
          crouch,
        );
      stepTimer = motion.sprint ? 0.31 : crouch ? 0.7 : 0.48;
    }
  }
  camera.position.set(
    player.x,
    (floorAt(player.x, player.z) || 0) +
      (crouch ? 1.08 : 1.64) +
      (moved ? Math.sin(state.elapsed * 12) * 0.012 : 0),
    player.z,
  );
  camera.rotation.set(player.pitch, player.yaw, 0);
  camera.updateMatrixWorld(true);
  const aim = !!keys.MouseRight;
  $("#viewfinder").hidden = !aim;
  cameraModel.position.set(aim ? 0.2 : 0.28, aim ? -0.18 : -0.28, -0.53);
  cameraModel.rotation.z =
    -0.05 + (moved ? Math.sin(state.elapsed * 6) * 0.009 : 0);
}
function hud() {
  $("#phase").textContent = state.items.locket
    ? "04 / REMEMBER HER"
    : state.events.awake
      ? "03 / NO RECORD"
      : state.items.family
        ? "02 / THE NIGHT BEFORE"
        : "01 / CHECKING IN";
  $("#room-name").textContent =
    regionAt(player.x, player.z)?.name.toUpperCase() || "";
  $("#objective").textContent = objective(state);
  $("#film").textContent = String(state.film).padStart(2, "0");
  $("#evidence-count").textContent =
    `${Object.keys(state.evidence).length} PRINTED DETAILS`;
  $("#battery").textContent = "";
  const danger =
    mode === "playing" &&
    state.clerk.mode === "chase" &&
    !state.events.departure;
  $("#danger").style.opacity = danger ? ".3" : "0";
  warning.hidden = !started || !settings.visualWarnings;
  warning.textContent =
    state.clerk.stunned > 0
      ? "FLASH / MOVE NOW"
      : danger
        ? "HE CAN SEE YOU / BREAK SIGHT"
        : state.clerk.seen > 0.3
          ? "THE KEYS HAVE STOPPED"
          : grace > 0 && state.events.awake
            ? "A MOMENT TO FIND YOUR BEARINGS"
            : "";
  let prompt = "";
  if (mode === "playing" && !physical) {
    const next = Object.keys(EVIDENCE).find(
      (id) => !state.evidence[id] && eligible(id),
    );
    const t = interactionTarget();
    prompt = next
      ? "[ C ] " +
        {
          suitcase: "Photograph the bed",
          laundry: "Photograph the lost-property shelf",
          pool: "Photograph the diving board",
          doorway: "Photograph the painted wall",
          final: "Photograph the upstairs rooms",
        }[next]
      : t
        ? "[ E ] " + t.label
        : "";
  }
  $("#interaction").textContent = prompt;
  if (state.elapsed > subtitleUntil) $("#subtitle").textContent = "";
  if (held) {
    $("#develop-layer").style.opacity = String(Math.max(0, develop / 3));
    if (develop <= 0) $("#photo-title").textContent = held.caption;
  }
}
function storyEvents() {
  if (
    state.evidence.suitcase &&
    !state.events.doorKnock &&
    regionAt(player.x, player.z)?.name === "Upper walkway"
  ) {
    state.events.doorKnock = true;
    audio.door({ x: 5, y: 4.2, z: -9 });
    subtitle(
      "A television switches off behind you. Someone tries the handle of Room 6.",
      7,
      true,
    );
    save();
  }
  if (
    state.items.locket &&
    !state.events.departure &&
    Math.hypot(player.x - 0.5, player.z - 16) < 2.2
  )
    interact("car");
  if (state.events.departure) {
    scene.fog.color.lerp(new THREE.Color("#53636a"), 0.004);
    scene.background.copy(scene.fog.color);
  }
}
let last = performance.now();
function frame(now) {
  if (disposed) return;
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  if (mode === "playing") {
    state.elapsed += dt;
    grace = Math.max(0, grace - dt);
    develop = Math.max(0, develop - dt);
    shotCooldown = Math.max(0, shotCooldown - dt);
    move(dt);
    threat(dt);
    storyEvents();
    world.update(state, dt, state.elapsed, player, false);
    audio.update(
      { x: player.x, y: camera.position.y, z: player.z },
      player.yaw,
      0,
    );
    audio.ambience(player, state.elapsed);
  } else world.update(state, 0, state.elapsed, player, false);
  $("#flash").style.opacity = String(
    Math.max(0, Number($("#flash").style.opacity || 0) - dt * 4),
  );
  presentation.render(
    scene,
    camera,
    started ? weaponScene : null,
    weaponCamera,
  );
  hud();
  requestAnimationFrame(frame);
}
on(window, "keydown", (e) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (e.repeat) return;
  keys[e.code] = true;
  if (
    [
      "Tab",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Escape",
    ].includes(e.code)
  )
    e.preventDefault();
  if (e.code === "Escape" || e.code === "KeyP") {
    if (physical || mode === "paused") closePanel();
    else pause();
    return;
  }
  if (mode !== "playing") return;
  if (e.code === "KeyE" && !physical) {
    const t = interactionTarget();
    if (t) interact(t.id);
  }
  if (e.code === "KeyC") capture();
  if (e.code === "KeyJ" || e.code === "Tab") journal();
  if (e.code === "KeyH") subtitle(objective(state), 8, true);
  if (e.code === "KeyF") flashlight.visible = !flashlight.visible;
  if (e.code === "KeyQ") {
    held = null;
    $("#photo-held").hidden = true;
  }
  if (e.code === "KeyR" && held)
    $("#photo-held").classList.toggle("inspecting");
});
on(window, "keyup", (e) => (keys[e.code] = false));
on(window, "mousemove", (e) => {
  if (
    (document.pointerLockElement === canvas || keys.DragLook) &&
    mode === "playing" &&
    !physical
  ) {
    player.yaw -= e.movementX * 0.002 * settings.sensitivity;
    player.pitch = THREE.MathUtils.clamp(
      player.pitch - e.movementY * 0.002 * settings.sensitivity,
      -1.35,
      1.35,
    );
  }
});
on(canvas, "mousedown", (e) => {
  if (e.button === 2) keys.MouseRight = true;
  if (e.button === 0 && mode === "playing") {
    if (document.pointerLockElement !== canvas) {
      keys.DragLook = true;
      lock();
    } else capture();
  }
});
on(window, "mouseup", (e) => {
  if (e.button === 2) keys.MouseRight = false;
  if (e.button === 0) keys.DragLook = false;
});
on(canvas, "contextmenu", (e) => e.preventDefault());
on(document, "pointerlockchange", () => {
  if (document.pointerLockElement !== canvas && mode === "playing" && !physical)
    pause();
});
on(window, "blur", () => {
  for (const k of Object.keys(keys)) keys[k] = false;
  if (mode === "playing") pause();
});
on(document, "visibilitychange", () => {
  if (document.hidden && mode === "playing") pause();
});
on(window, "resize", () => {
  camera.aspect = weaponCamera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  weaponCamera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
on(window, "beforeunload", () => save());
on(window, "pagehide", () => {
  disposed = true;
  audio.dispose();
  releaseScene(scene);
  releaseScene(weaponScene);
  presentation.dispose();
  renderer.dispose();
  listeners.forEach((off) => off());
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted) location.reload();
});
$("#pause-button").onclick = pause;
$("#journal-button").onclick = journal;
Object.defineProperty(window, "vacancyDiagnostics", {
  get: () => ({
    mode,
    physical,
    grace,
    develop,
    player: { ...player, y: camera.position.y },
    state: {
      ...state,
      photos: state.photos.map(({ image, ...p }) => ({
        ...p,
        imageLength: image.length,
      })),
    },
    targets: Object.fromEntries(
      Object.entries(world.targets).map(([id, t]) => [
        id,
        { ...t.position, eligible: eligible(id) },
      ]),
    ),
    interactions: world.interactions.map((t) => ({ id: t.id, ...t.position })),
    footfalls: world.clerk.userData.footfallCount || 0,
    objective: objective(state),
    renderer: renderer.info.memory,
  }),
});
Object.defineProperty(window, "vacancyNavigation", {
  value: Object.freeze({
    path: (a, b) => world.nav.path(a, b),
    blocked: (x, z) => world.nav.blocked(x, z),
    floorAt,
  }),
});
const launch = document.createElement("div");
launch.className = "story-launch";
launch.innerHTML =
  '<div class="launch-inner"><div class="eyebrow">POLAROID / CHAPTER 03</div><h1>VACANCY</h1><p>Briar Glen Motor Lodge. November 1999.<br>Your room has been ready for years.</p><button id="enter-vacancy" class="filled-button">CHECK IN →</button><p class="small">WASD move · Mouse look · E interact<br>C photograph · Right mouse viewfinder · F light<br>J journal · R inspect print · Escape pause</p><a href="./">BACK TO STORIES</a></div>';
document.body.append(launch);
$("#loading").hidden = true;
$("#enter-vacancy").onclick = () => {
  const params = new URLSearchParams(location.search);
  load(params.get("play") !== "new");
  params.delete("play");
  history.replaceState(null, "", `?${params}`);
};
move(0);
requestAnimationFrame(frame);
