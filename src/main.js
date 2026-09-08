import "./style.css";
import * as THREE from "three";
import { buildWorld } from "./world.js";
import { Soundscape } from "./audio.js";
import {
  clamp,
  distance,
  floorAt,
  regionAt,
  blocked,
  lineOfSight,
  evidenceDefs,
  newState,
  objectiveFor,
  canCapture,
  normalizeSave,
  ObserverAI,
  placePhoto,
  seededRandom,
} from "./logic.js";

const $ = (id) => document.getElementById(id),
  canvas = $("world"),
  scene = new THREE.Scene();
scene.background = new THREE.Color("#08120e");
scene.fog = new THREE.FogExp2("#13251c", 0.029);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
} catch (e) {
  $("loading").innerHTML =
    '<div class="loading-brand">POLAROID</div><p>WebGL is unavailable. Please open the game in a desktop browser with hardware acceleration.</p>';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.info.autoReset = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
const camera = new THREE.PerspectiveCamera(
  67,
  innerWidth / innerHeight,
  0.035,
  85,
);
camera.rotation.order = "YXZ";
scene.add(camera);
const world = buildWorld(scene);
const weaponScene = new THREE.Scene(),
  weaponCamera = new THREE.PerspectiveCamera(
    67,
    innerWidth / innerHeight,
    0.01,
    4,
  );
weaponScene.add(weaponCamera);
weaponScene.add(new THREE.HemisphereLight(0xb6c6ac, 0x151c14, 1.2));
const weaponLamp = new THREE.DirectionalLight(0xd0dfb9, 1.2);
weaponLamp.position.set(-1, 2, 1);
weaponScene.add(weaponLamp);
const cameraModel = world.makeCamera(weaponCamera);
cameraModel.scale.setScalar(0.72);
cameraModel.visible = false;
const flashlight = new THREE.SpotLight(
  0xe4eed0,
  32,
  18,
  Math.PI * 0.24,
  0.65,
  1.5,
);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.bias = -0.0004;
flashlight.shadow.normalBias = 0.04;
flashlight.shadow.camera.near = 0.2;
scene.add(flashlight, flashlight.target);
const fillLight = new THREE.PointLight(0xd9e5bc, 1.2, 3, 2);
scene.add(fillLight);
const flashLight = new THREE.PointLight(0xe4f2dc, 0, 19, 1.5);
scene.add(flashLight);
const audio = new Soundscape(),
  SAVE = "polaroid.save.v1",
  SETTINGS = "polaroid.settings.v1";
let settings = {
  sensitivity: 1,
  master: 0.65,
  music: 0.35,
  effects: 0.8,
  brightness: 1.2,
  fov: 67,
  quality: "high",
  shake: 0.35,
  subtitles: true,
  blur: false,
};
try {
  settings = {
    ...settings,
    ...JSON.parse(localStorage.getItem(SETTINGS) || "{}"),
  };
} catch {}
let state = newState(),
  rng = seededRandom(state.seed),
  ai = new ObserverAI(world.solids, rng),
  mode = "menu",
  screenName = "",
  started = false,
  pointerLocked = false,
  dragging = false,
  lookYaw = 0,
  lookPitch = 0,
  player = { x: 0, y: 1.64, z: 11 },
  velocity = { x: 0, z: 0 },
  keys = {},
  lightOn = true,
  crouched = false,
  hidden = false,
  hideSpot = null,
  photoBusy = false,
  photoTimer = 0,
  photoAge = 0,
  photoData = null,
  photoInspected = false,
  aiming = false,
  near = null,
  power = true,
  grace = 20,
  time = 0,
  stepTimer = 0,
  scareTimer = 20,
  stormTimer = 8,
  storm = 0,
  subtitleTimer = 0,
  objectiveTimer = 0,
  heartbeat = 0,
  shotStage = 0,
  session = 0,
  endingTimer = 0,
  finalGrace = 0,
  filmSign = null;
const pictureCanvas = document.createElement("canvas");
pictureCanvas.width = pictureCanvas.height = 600;
const pictureCtx = pictureCanvas.getContext("2d");
function readSave() {
  try {
    return normalizeSave(JSON.parse(localStorage.getItem(SAVE) || "null"));
  } catch {
    return null;
  }
}
function save() {
  if (!started || state.escaped) return;
  try {
    localStorage.setItem(SAVE, JSON.stringify(state));
    $("continue").disabled = false;
    $("save-label").textContent = "MEMORY FOUND";
  } catch {
    subtitle(
      "Memory storage is full. Your progress remains available for this session.",
      4,
    );
  }
}
function checkpoint(at) {
  state.checkpoint = at || { x: player.x, z: player.z, yaw: lookYaw };
  save();
}
function subtitle(text, seconds = 5) {
  $("subtitle").textContent = settings.subtitles ? text : "";
  subtitleTimer = seconds;
  $("subtitle").style.opacity = "1";
}
function objective() {
  $("objective").textContent = objectiveFor(state);
  $("objective").style.opacity = "1";
  objectiveTimer = 9;
}
function applySettings() {
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  weaponCamera.fov = settings.fov;
  weaponCamera.updateProjectionMatrix();
  renderer.toneMappingExposure = settings.brightness;
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      settings.quality === "low"
        ? 1
        : settings.quality === "medium"
          ? 1.25
          : 1.5,
    ),
  );
  renderer.shadowMap.enabled = settings.quality !== "low";
  audio.set(settings);
}
applySettings();
function updateHud() {
  const n = Object.keys(state.evidence).length;
  $("film").textContent = String(state.film).padStart(2, "0");
  $("evidence-count").textContent = `${n} / 4`;
  $("battery").textContent = lightOn
    ? "▰".repeat(Math.max(1, Math.ceil(state.battery / 25))) +
      "▱".repeat(Math.max(0, 4 - Math.ceil(state.battery / 25)))
    : "LIGHT OFF";
  $("phase").textContent = state.ritualComplete
    ? "04 / ESCAPE"
    : n >= 2
      ? "03 / THE HUNT"
      : n
        ? "02 / INVESTIGATION"
        : "01 / DISCOVERY";
  document.body.classList.toggle("is-hidden", hidden);
  $("stance").textContent = hidden
    ? "HIDDEN · E TO LEAVE"
    : crouched
      ? "CROUCHED"
      : "";
}
function requestLock() {
  canvas.focus();
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
    try {
      const p = canvas.requestPointerLock();
      if (p?.catch)
        p.catch(() => {
          subtitle(
            "Drag to look, or use the arrow keys. C takes a photograph.",
            4,
          );
        });
    } catch {}
  }
}
document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (!pointerLocked && mode === "playing" && !photoInspected) {
    openPause();
  }
});
function releaseMouse() {
  if (document.pointerLockElement) document.exitPointerLock();
  keys = {};
  dragging = false;
}
function startGame(useSave = false) {
  session++;
  const saved = useSave ? readSave() || (started ? state : null) : null;
  state = saved || newState();
  rng = seededRandom(state.seed);
  ai = new ObserverAI(world.solids, rng);
  started = true;
  mode = "playing";
  screenName = "";
  power = !state.ritualComplete;
  world.setCode(state.code);
  player.x = state.checkpoint.x;
  player.z = state.checkpoint.z;
  player.y = (floorAt(player.x, player.z) ?? 0) + 1.64;
  lookYaw = state.checkpoint.yaw || 0;
  lookPitch = 0;
  camera.position.set(player.x, player.y, player.z);
  camera.rotation.set(0, lookYaw, 0, "YXZ");
  velocity = { x: 0, z: 0 };
  hidden = false;
  crouched = false;
  grace = 22;
  finalGrace = state.ritualComplete ? 32 : 0;
  photoBusy = false;
  photoTimer = 0;
  photoAge = 0;
  aiming = false;
  photoInspected = false;
  lightOn = true;
  scareTimer = 20;
  time = 0;
  state.battery = Math.max(25, state.battery);
  for (const d of world.doors) {
    d.open = 0;
    d.target = 0;
  }
  for (const item of world.interactables) {
    if (item.mesh) item.mesh.visible = !state.picked.includes(item.id);
    if (item.mesh?.userData.label)
      item.mesh.userData.label.visible = item.mesh.visible;
  }
  for (let i = 0; i < 4; i++) {
    const id = state.ritual[i];
    if (id && state.evidence[id]) world.setFrame(i, state.evidence[id].image);
    else if (world.frames[i].mesh) world.frames[i].mesh.visible = false;
  }
  $("menu").hidden = true;
  $("overlay").hidden = true;
  $("hud").hidden = false;
  $("photo-held").hidden = true;
  $("viewfinder").hidden = true;
  cameraModel.visible = true;
  $("control-hint").style.opacity = "1";
  audio.start();
  audio.pause(false);
  applySettings();
  updateHud();
  objective();
  subtitle(
    saved ? "I remember this part." : "Mara? … I know I came here for someone.",
    5,
  );
  requestLock();
  if (!saved) checkpoint();
}
function resume() {
  mode = "playing";
  screenName = "";
  $("overlay").hidden = true;
  $("hud").hidden = false;
  audio.pause(false);
  requestLock();
}
function overlay(name, html) {
  mode = "overlay";
  screenName = name;
  $("overlay").hidden = false;
  $("overlay-content").innerHTML = html;
  releaseMouse();
  audio.pause(true);
}
function panel(
  title,
  body,
  narrow = true,
  kicker = "POLAROID / BLACKWOOD HOUSE",
) {
  return `<div class="panel ${narrow ? "narrow" : ""}"><div class="panel-header"><div><div class="eyebrow">${kicker}</div><h2>${title}</h2></div><button class="close-button" id="panel-close">ESC / CLOSE</button></div>${body}</div>`;
}
function bindClose(fn) {
  $("panel-close")?.addEventListener(
    "click",
    fn || (() => (started ? resume() : backMenu())),
  );
}
function backMenu() {
  document.body.classList.remove("is-hidden");
  mode = "menu";
  screenName = "";
  $("menu").hidden = false;
  $("overlay").hidden = true;
  $("hud").hidden = true;
  $("photo-held").hidden = true;
  cameraModel.visible = false;
  releaseMouse();
  audio.pause(true);
  if (started) save();
  $("continue").disabled = !readSave() && !started;
  $("save-label").textContent = $("continue").disabled
    ? "NO SAVED MEMORY"
    : "MEMORY FOUND";
}
function openPause() {
  if (mode !== "playing") return;
  overlay(
    "pause",
    panel(
      "A MOMENT OF STILLNESS",
      `<p class="small">${objectiveFor(state)}</p><button class="panel-button" id="resume">CONTINUE ↗</button><button class="panel-button" id="pause-settings">SETTINGS</button><button class="panel-button" id="controls">CONTROLS</button><button class="panel-button" id="save-exit">SAVE & RETURN TO MENU</button>`,
    ),
  );
  $("resume").onclick = resume;
  $("pause-settings").onclick = () => openSettings(true);
  $("controls").onclick = openControls;
  $("save-exit").onclick = () => {
    checkpoint();
    backMenu();
  };
  bindClose(resume);
}
function openControls() {
  overlay(
    "controls",
    panel(
      "HOW TO REMAIN",
      `<p class="small">W A S D — Move<br>Mouse — Look (drag if mouse capture is unavailable)<br>Arrow keys — Look without a mouse<br>Shift — Sprint · Ctrl / X — Crouch<br>E — Open, read, collect, hide<br>C / Left click — Take a photograph<br>Right mouse — Hold viewfinder<br>F — Toggle flashlight<br>R — Inspect photograph · Q — Put it away<br>J / Tab — Journal · Esc / P — Pause</p><p>Photographs reveal what your eyes cannot. The shutter also tells it where you are.</p><p class="small">Break its line of sight. Walk quietly. Hide in a wardrobe. Photograph the Observer to repel it. A film tin at the front entrance provides emergency exposures when you run out.</p>`,
    ),
  );
  bindClose(() => {
    mode = "playing";
    openPause();
  });
}
function openSettings(fromPause = false) {
  overlay(
    "settings",
    panel(
      "SETTINGS",
      `<div class="settings-list">${[
        ["sensitivity", "Mouse sensitivity", 0.2, 2, 0.1],
        ["master", "Master volume", 0, 1, 0.05],
        ["music", "Ambient music", 0, 1, 0.05],
        ["effects", "Sound effects", 0, 1, 0.05],
        ["brightness", "Brightness", 0.7, 2, 0.05],
        ["fov", "Field of view", 55, 90, 1],
        ["shake", "Camera movement", 0, 1, 0.05],
      ]
        .map(
          ([id, name, min, max, step]) =>
            `<label class="setting">${name}<input id="set-${id}" aria-label="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[id]}"></label>`,
        )
        .join(
          "",
        )}<label class="setting">Graphics quality<select id="set-quality" aria-label="Graphics quality">${["low", "medium", "high"].map((v) => `<option value="${v}" ${settings.quality === v ? "selected" : ""}>${v.toUpperCase()}</option>`).join("")}</select></label><label class="setting">Subtitles<input type="checkbox" id="set-subtitles" ${settings.subtitles ? "checked" : ""}></label><label class="setting">Motion softness<input type="checkbox" id="set-blur" ${settings.blur ? "checked" : ""}></label></div><p class="small">Adjust brightness until you can distinguish the corridor from its shadows. Changes are saved automatically.</p>`,
    ),
  );
  for (const id of Object.keys(settings)) {
    $(`set-${id}`)?.addEventListener("input", (e) => {
      settings[id] =
        e.target.type === "checkbox"
          ? e.target.checked
          : e.target.tagName === "SELECT"
            ? e.target.value
            : Number(e.target.value);
      applySettings();
      try {
        localStorage.setItem(SETTINGS, JSON.stringify(settings));
      } catch {}
    });
  }
  bindClose(() => {
    if (fromPause) {
      mode = "playing";
      openPause();
    } else backMenu();
  });
}
function openCredits() {
  overlay(
    "credits",
    panel(
      "STILL / HERE",
      `<p>An interactive ghost story about the things we choose to remember.</p><p class="small">POLAROID<br>Original game, environments, procedural materials & synthesized spatial sound.<br><br>3D rendering — Three.js (MIT)<br>Built with Vite (MIT)<br><br>Visual direction inspired by your reference: damp green walls, exposed utility pipes, exhausted fluorescent light.<br><br>A fictional story. No affiliation with Polaroid Corporation.</p><button id="credits-play" class="filled-button">ENTER THE HOUSE ↗</button>`,
    ),
  );
  $("credits-play").onclick = () => startGame();
  bindClose(backMenu);
}
function journal(tab = "evidence") {
  const n = Object.keys(state.evidence).length;
  let content = "";
  if (tab === "evidence")
    content = `<div class="photo-grid">${evidenceDefs.map((d) => (state.evidence[d.id] ? `<button class="journal-photo" data-photo="${d.id}"><img src="${state.evidence[d.id].image}" alt="${d.name}"><b>${d.symbol} / ${d.name}</b><small>${d.room}</small></button>` : `<div class="empty-photo">${d.symbol} / UNDEVELOPED</div>`)).join("")}</div><p class="small">${n} OF 4 MEMORIES RECOVERED<br>${objectiveFor(state)}</p>`;
  if (tab === "clues")
    content =
      evidenceDefs
        .filter((d) => state.evidence[d.id])
        .map(
          (d) =>
            `<div class="story-entry"><strong>${d.room}</strong><p>${d.note}${d.id === "writing" ? ` The attic combination is ${state.code}.` : ""}</p></div>`,
        )
        .join("") ||
      "<p>The house has not told you anything yet. Find the empty frame in the study.</p>";
  if (tab === "story")
    content = `<p>My sister Mara disappeared here. The camera was in my hand when I woke up.</p>${evidenceDefs
      .filter((d) => state.evidence[d.id])
      .map(
        (d) =>
          `<div class="story-entry"><strong>${d.name}</strong><p>${d.story}</p></div>`,
      )
      .join("")}${state.notes.map((n) => `<p>${n}</p>`).join("")}`;
  if (tab === "photos")
    content = `<div class="photo-grid">${state.photos
      .slice(-12)
      .map(
        (p, i) =>
          `<button class="journal-photo" data-exposure="${state.photos.length - Math.min(state.photos.length, 12) + i}"><img src="${p.image}" alt="Exposure ${p.number}"><b>EXPOSURE ${String(p.number).padStart(2, "0")}</b><small>${p.room}</small></button>`,
      )
      .join("")}</div>`;
  overlay(
    "journal",
    panel(
      "FIELD NOTES",
      `<nav class="journal-tabs">${[
        ["evidence", "EVIDENCE"],
        ["clues", "CLUES"],
        ["story", "STORY"],
        ["photos", "PHOTOGRAPHS"],
      ]
        .map(
          ([id, label]) =>
            `<button data-tab="${id}" class="${id === tab ? "active" : ""}">${label}</button>`,
        )
        .join("")}</nav>${content}`,
      false,
      "MARA BLACKWOOD / PERSONAL ARCHIVE",
    ),
  );
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => (b.onclick = () => journal(b.dataset.tab)));
  document
    .querySelectorAll("[data-photo]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          inspectJournal(state.evidence[b.dataset.photo], b.dataset.photo)),
    );
  document
    .querySelectorAll("[data-exposure]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          inspectJournal(state.photos[Number(b.dataset.exposure)])),
    );
  bindClose(resume);
}
function inspectJournal(p, id) {
  const d = evidenceDefs.find((d) => d.id === id);
  overlay(
    "photo",
    panel(
      d?.name || "EXPOSURE",
      `<div class="print ending-photo"><div class="photo-window"><img src="${p.image}" alt="Developed photograph"></div><div class="print-caption">${d?.room || p.room}</div></div><p>${d?.note || "What did the camera see?"}</p>${id === "writing" ? `<p class="small">ATTIC COMBINATION: ${state.code}</p>` : ""}`,
    ),
  );
  bindClose(() => journal());
}
function findInteractable() {
  if (hidden) return { type: "leave", label: "Leave hiding place" };
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  let best = null,
    bestScore = 99;
  for (const i of world.interactables) {
    if (i.type === "film" && state.picked.includes(i.id)) continue;
    if (i.type === "key" && (!state.evidence.mirror || state.key)) continue;
    const d = camera.position.distanceTo(i.position),
      v = i.position.clone().sub(camera.position).normalize(),
      dot = v.dot(forward);
    const limit = i.type === "evidence" ? 5.8 : i.type === "ritual" ? 3.5 : 2.6;
    if (d > limit || dot < (i.type === "evidence" ? 0.91 : 0.72)) continue;
    const end = i.position
      .clone()
      .lerp(
        camera.position,
        i.type === "hide" ? Math.min(0.6, 0.75 / d) : 0.06,
      );
    if (!lineOfSight(player, end, world.solids) && i.type !== "door") continue;
    const score = d + (1 - dot) * 5;
    if (score < bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}
function interactionText(i) {
  if (!i) return "";
  if (i.type === "evidence")
    return `C  /  ${state.evidence[i.id] ? "Memory recorded" : "Something feels wrong here. Take a photograph."}`;
  if (i.type === "door") {
    if (i.door.locked === "exit")
      return `E  /  ${state.ritualComplete ? (state.finalPhoto ? "Leave the house" : "Front door · one last photograph") : "Front entrance · locked"}`;
    if (i.door.locked === "attic" && !state.atticUnlocked)
      return "E  /  Attic combination lock";
    if (i.door.locked === "basement" && !state.key)
      return "E  /  Cellar · a brass key is needed";
    return `E  /  ${i.door.target ? "Close" : "Open"} ${i.label.toLowerCase()}`;
  }
  return `E  /  ${i.label}`;
}
function interact() {
  if (mode !== "playing") return;
  const i = findInteractable();
  if (!i) return;
  if (i.type === "leave") {
    hidden = false;
    lightOn = true;
    updateHud();
    subtitle("Listen before you move.", 2);
    return;
  }
  if (i.type === "door") {
    const d = i.door;
    if (d.locked === "attic" && !state.atticUnlocked) {
      openLock();
      return;
    }
    if (d.locked === "basement" && !state.key) {
      subtitle("A brass key. The mirror might know where it is.");
      return;
    }
    if (d.locked === "exit") {
      if (!state.ritualComplete) {
        subtitle("The lock will not turn. Something holds it from inside.");
        return;
      }
      if (!state.finalPhoto) {
        subtitle("One last photograph. Face the door.");
        return;
      }
      d.target = 1;
      audio.door({ ...d.position, y: 1 });
      subtitle("The rain. The air. Keep moving.", 4);
      return;
    }
    d.target = d.target ? 0 : 1;
    audio.door({ ...d.position, y: d.y + 1 });
    ai.hear(player, 8, Object.keys(state.evidence).length);
    return;
  }
  if (i.type === "film") {
    state.film += 4;
    state.battery = Math.min(100, state.battery + 20);
    state.picked.push(i.id);
    i.mesh.visible = false;
    if (i.mesh.userData.label) i.mesh.userData.label.visible = false;
    audio.tone(460, 0.15, 0.08);
    subtitle("Four exposures. A little more time.", 3);
    save();
  }
  if (i.type === "reserve") {
    if (state.film <= 0) {
      state.film = 4;
      audio.tone(360, 0.2, 0.08);
      subtitle("A sealed emergency pack. Four exposures.", 4);
      save();
    } else
      subtitle("A sealed film tin. Save it for when the camera is empty.", 4);
  }
  if (i.type === "key") {
    state.key = true;
    i.mesh.visible = false;
    subtitle("The brass key. The cellar is beyond the washroom.", 5);
    audio.tone(900, 0.35, 0.06);
    checkpoint();
  }
  if (i.type === "hide") {
    hidden = true;
    hideSpot = { ...player };
    lightOn = false;
    velocity = { x: 0, z: 0 };
    subtitle("Stay still. Keep the light off.", 4);
  }
  if (i.type === "switch") {
    power = !power;
    audio.tone(180, 0.06, 0.09);
  }
  if (i.type === "note") {
    overlay("note", panel(i.title, `<p>${i.text}</p>`));
    if (!state.notes.includes(i.text)) state.notes.push(i.text);
    bindClose(resume);
    save();
  }
  if (i.type === "frame") openFrame(i.index);
  if (i.type === "ritual") {
    if (state.ritualComplete) {
      subtitle("Go. The front entrance.", 3);
      return;
    }
    if (state.ritual.every((v, i) => v === evidenceDefs[i].id)) {
      beginRitual();
    } else
      subtitle(
        "Promise. Mother. Child. Witness. Four memories, in that order.",
        6,
      );
  }
  if (i.type === "evidence") takePhoto();
  updateHud();
}
function openLock() {
  overlay(
    "lock",
    panel(
      "THE ATTIC",
      `<p>Four worn brass dials. A faint inscription: “The study remembers.”</p><form id="lock-form" class="lock-form"><input id="code-input" aria-label="Four-digit combination" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" placeholder="····" required><button class="filled-button" type="submit">UNLOCK</button></form><p id="lock-result" class="small">${state.evidence.writing ? "The combination is recorded in your journal." : "Perhaps a photograph would reveal more."}</p>`,
    ),
  );
  $("lock-form").onsubmit = (e) => {
    e.preventDefault();
    if ($("code-input").value === state.code) {
      state.atticUnlocked = true;
      world.doors.find((d) => d.locked === "attic").target = 1;
      checkpoint();
      resume();
      subtitle("The lock gives. Something shifts in the attic.", 5);
      audio.door({ x: 0, y: 4.6, z: -29 });
      objective();
    } else {
      $("lock-result").textContent =
        "The dials resist. Look at the study photograph.";
      audio.tone(85, 0.4, 0.09);
    }
  };
  bindClose(resume);
}
function openFrame(index) {
  overlay(
    "frame",
    panel(
      `FRAME ${["I", "II", "III", "IV"][index]}`,
      `<p class="small">PROMISE → MOTHER → CHILD → WITNESS</p><div class="photo-grid">${
        evidenceDefs
          .filter((d) => state.evidence[d.id])
          .map(
            (d) =>
              `<button class="journal-photo" data-place="${d.id}"><img src="${state.evidence[d.id].image}" alt="${d.name}"><b>${d.symbol} / ${d.name}</b></button>`,
          )
          .join("") || "<p>You have no evidence photographs yet.</p>"
      }</div>`,
      false,
      "RETURN WHAT WAS TAKEN",
    ),
  );
  document.querySelectorAll("[data-place]").forEach(
    (b) =>
      (b.onclick = () => {
        placePhoto(state, index, b.dataset.place);
        world.setFrame(index, state.evidence[b.dataset.place].image);
        checkpoint();
        resume();
        audio.tone(190 + index * 65, 0.7, 0.05);
        subtitle(
          state.ritual.every((v, i) => v === evidenceDefs[i].id)
            ? "The four frames answer. Stand inside the circle."
            : "The photograph settles into the frame.",
          4,
        );
      }),
  );
  bindClose(resume);
}
function beginRitual() {
  state.ritualComplete = true;
  power = false;
  lightOn = true;
  state.film = Math.max(2, state.film);
  grace = 10;
  finalGrace = 40;
  ai.position = { x: 26, z: -19 };
  ai.change("RETREATING", 8);
  ai.path = [];
  checkpoint({ x: 18, z: -14, yaw: Math.PI / 2 });
  audio.thunder();
  storm = 1;
  subtitle("The house lets out a breath. Then every light dies. Run.", 6);
  objective();
  updateHud();
}
function takePhoto() {
  if (mode !== "playing" || photoBusy || hidden) return;
  if (state.film <= 0) {
    subtitle(
      "No film. Check the rooms, or the emergency tin at the front entrance.",
      5,
    );
    audio.tone(90, 0.1, 0.05);
    return;
  }
  photoBusy = true;
  shotStage = 1;
  photoTimer = 0.42;
  aiming = true;
  $("viewfinder").hidden = false;
  $("photo-held").hidden = true;
  audio.tone(900, 0.12, 0.018, null, "sine", 1100);
}
function capture() {
  state.film--;
  state.shots++;
  const n = Object.keys(state.evidence).length;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const captured = evidenceDefs.filter(
    (d) =>
      !state.evidence[d.id] &&
      canCapture(d, camera.position, forward, world.solids),
  );
  const observerSeen = canCapture(
    {
      x: ai.position.x,
      y: (floorAt(ai.position.x, ai.position.z) ?? 0) + 1.4,
      z: ai.position.z,
    },
    camera.position,
    forward,
    world.solids,
  );
  const final =
    state.ritualComplete &&
    distance(player, { x: 0, z: 14 }) < 4 &&
    forward.z > 0.5;
  const observerPosition = world.observer.position.clone(),
    captureRotation = camera.rotation.clone();
  world.photoOnly.forEach((m) => (m.visible = true));
  if (n === 0) {
    const falseGhost = world.photoOnly[2];
    falseGhost.position.z = Math.min(7, -5 + state.shots * 2);
  }
  world.observer.visible = true;
  if (final) {
    world.observer.position.set(
      player.x - forward.x * 1.9,
      player.y - 1.64,
      player.z - forward.z * 1.9,
    );
    world.observer.rotation.y = Math.atan2(
      player.x - world.observer.position.x,
      player.z - world.observer.position.z,
    );
    camera.rotation.y += Math.PI;
  }
  cameraModel.visible = false;
  flashLight.position.copy(camera.position);
  flashLight.intensity = 90;
  renderer.render(scene, camera);
  const size = Math.min(canvas.width, canvas.height),
    sx = (canvas.width - size) / 2,
    sy = (canvas.height - size) / 2;
  pictureCtx.drawImage(canvas, sx, sy, size, size, 0, 0, 600, 600);
  const gradient = pictureCtx.createRadialGradient(
    300,
    270,
    130,
    300,
    300,
    420,
  );
  gradient.addColorStop(0, "#13271b00");
  gradient.addColorStop(1, "#031007aa");
  pictureCtx.fillStyle = gradient;
  pictureCtx.fillRect(0, 0, 600, 600);
  const image = pictureCanvas.toDataURL("image/jpeg", 0.78);
  photoData = {
    image,
    number: state.shots,
    room: regionAt(player.x, player.z)?.name || "UNKNOWN",
    captured: captured.map((d) => d.id),
    observerSeen,
    final,
  };
  state.photos.push({ image, number: state.shots, room: photoData.room });
  if (state.photos.length > 12) state.photos.shift();
  world.photoOnly.forEach((m) => (m.visible = false));
  camera.rotation.copy(captureRotation);
  world.observer.position.copy(observerPosition);
  world.observer.visible = false;
  cameraModel.visible = true;
  flashLight.intensity = 65;
  world.observer.visible = false;
  audio.shutter();
  $("flash").style.opacity = ".88";
  shotStage = 2;
  photoTimer = 0.2;
  photoAge = 0;
  updateHud();
  ai.hear(player, 45, n);
  if (observerSeen && n >= 1) {
    ai.materialize = 0.25;
    if (rng() > 0.3 || ai.state === "CHASING") ai.repel();
    else ai.hear(player, 50, n);
  }
  if (n === 0) subtitle("The shutter is much louder than I remembered.", 3);
}
function showPrint() {
  aiming = false;
  $("viewfinder").hidden = true;
  $("photo-image").src = photoData.image;
  $("photo-title").textContent =
    `EXPOSURE ${String(photoData.number).padStart(2, "0")}`;
  $("photo-note").textContent = "DEVELOPING · HOLD STILL";
  $("develop-layer").style.transition = "none";
  $("develop-layer").style.opacity = "1";
  $("photo-held").classList.remove("inspected");
  $("photo-held").hidden = false;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      $("develop-layer").style.transition = "opacity 4s ease-in-out";
      $("develop-layer").style.opacity = "0";
    }),
  );
  shotStage = 3;
  photoTimer = 4;
}
function develop() {
  for (const id of photoData.captured) {
    const d = evidenceDefs.find((d) => d.id === id);
    state.evidence[id] = {
      image: photoData.image,
      number: photoData.number,
      room: d.room,
    };
    $("photo-title").textContent = `${d.symbol} / ${d.name}`;
    $("photo-note").textContent = "EVIDENCE SAVED TO JOURNAL";
    subtitle(
      id === "writing"
        ? `There are numbers in the photograph. ${state.code}. The attic.`
        : d.note,
      7,
    );
    grace = Math.max(grace, 9);
    checkpoint();
    objective();
    audio.tone(480, 1.2, 0.022, null, "sine", 240);
  }
  if (!photoData.captured.length) {
    $("photo-note").textContent = photoData.observerSeen
      ? "IT WAS THERE."
      : "FILED IN YOUR JOURNAL";
    if (photoData.observerSeen)
      subtitle("It was right there. I could not see it.", 5);
  }
  if (photoData.final) {
    state.finalPhoto = true;
    finalGrace = 12;
    subtitle("Do not turn around. The door is open.", 5);
    checkpoint();
    objective();
  }
  photoBusy = false;
  shotStage = 0;
  photoAge = 0;
  updateHud();
  save();
}
function die() {
  if (mode !== "playing") return;
  world.observer.visible = true;
  audio.noise(1.2, 0.35, 500);
  $("danger").style.opacity = "1";
  overlay(
    "death",
    panel(
      "THE IMAGE REMAINS",
      `<p>You looked for too long.</p><p class="small">Your evidence is safe. Break line of sight, hide in a wardrobe, or photograph the Observer to push it back.</p><button id="retry" class="filled-button">RETURN TO LAST MEMORY ↗</button>`,
    ),
  );
  $("retry").onclick = () => {
    $("danger").style.opacity = "0";
    startGame(true);
  };
  bindClose(() => {
    $("danger").style.opacity = "0";
    backMenu();
  });
}
function finish() {
  state.escaped = true;
  mode = "ending";
  endingTimer = 0;
  releaseMouse();
  $("hud").hidden = true;
  $("photo-held").hidden = true;
  cameraModel.visible = false;
  audio.pause(true);
  $("flash").style.opacity = "0";
  $("danger").style.opacity = "0";
  const savedPosition = camera.position.clone(),
    savedRotation = camera.rotation.clone();
  world.selfPortrait.visible = true;
  world.selfPortrait.position.set(0.65, 0, 18.1);
  world.selfPortrait.rotation.y = Math.PI;
  world.observer.visible = true;
  world.observer.position.set(0.1, 0, 16.3);
  world.observer.rotation.y = 0;
  camera.position.set(0, 1.7, 22.5);
  camera.lookAt(0, 1.4, 16);
  flashLight.position.copy(camera.position);
  flashLight.intensity = 24;
  world.update(0, time, camera.position, true, 0);
  renderer.render(scene, camera);
  const crop = Math.min(canvas.width, canvas.height);
  pictureCtx.drawImage(
    canvas,
    (canvas.width - crop) / 2,
    (canvas.height - crop) / 2,
    crop,
    crop,
    0,
    0,
    600,
    600,
  );
  const endingImage = pictureCanvas.toDataURL("image/jpeg", 0.85);
  world.selfPortrait.visible = false;
  world.observer.visible = false;
  flashLight.intensity = 0;
  camera.position.copy(savedPosition);
  camera.rotation.copy(savedRotation);
  overlay(
    "ending",
    `<div class="panel narrow" style="text-align:center"><div class="eyebrow" style="justify-content:center">OUTSIDE / 02:47 AM</div><div class="print ending-photo final-develop"><div class="photo-window"><img src="${endingImage}" alt="The last photograph. The Observer is still there."></div><div class="print-caption">YOU BROUGHT IT WITH YOU.</div></div><h2 class="ending-title">POLAROID</h2><p>The rain has stopped.<br>Something behind you has not.</p><p class="small">${state.shots} EXPOSURES · FOUR MEMORIES · ${Math.floor(state.elapsed / 60)} MINUTES<br>THANK YOU FOR PLAYING</p><button class="filled-button" id="ending-menu">RETURN TO MENU</button></div>`,
  );
  $("ending-menu").onclick = backMenu;
  if (audio.ctx)
    audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.4);
}
function processPhoto(dt) {
  if (photoBusy && mode === "playing") {
    photoTimer -= dt;
    if (photoTimer <= 0) {
      if (shotStage === 1) capture();
      else if (shotStage === 2) showPrint();
      else if (shotStage === 3) develop();
    }
  }
  if (!photoBusy && !$("photo-held").hidden) {
    photoAge += dt;
    if (photoAge > 12 && !photoInspected) $("photo-held").hidden = true;
  }
  if (flashLight.intensity > 0)
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 240);
  const opacity = Number($("flash").style.opacity || 0);
  if (opacity > 0)
    $("flash").style.opacity = String(Math.max(0, opacity - dt * 4));
}
function movePlayer(dt) {
  const turn = 1.45 * dt;
  lookYaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * turn;
  lookPitch = clamp(
    lookPitch + ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * turn,
    -1.35,
    1.35,
  );
  let mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0),
    mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const len = Math.hypot(mx, mz);
  if (len) {
    mx /= len;
    mz /= len;
  }
  const sprint =
      (keys.ShiftLeft || keys.ShiftRight) && !crouched && len > 0 && !hidden,
    speed = hidden ? 0 : crouched ? 1.1 : sprint ? 4.3 : 2.35;
  const vx = (mx * Math.cos(lookYaw) - mz * Math.sin(lookYaw)) * speed,
    vz = (-mx * Math.sin(lookYaw) - mz * Math.cos(lookYaw)) * speed;
  velocity.x = THREE.MathUtils.damp(velocity.x, vx, 13, dt);
  velocity.z = THREE.MathUtils.damp(velocity.z, vz, 13, dt);
  const nx = player.x + velocity.x * dt,
    nz = player.z + velocity.z * dt;
  if (!blocked(nx, player.z, world.solids, 0.23)) player.x = nx;
  else velocity.x = 0;
  if (!blocked(player.x, nz, world.solids, 0.23)) player.z = nz;
  else velocity.z = 0;
  const moving = Math.hypot(velocity.x, velocity.z) > 0.2;
  const floor = floorAt(player.x, player.z) ?? 0;
  player.y = THREE.MathUtils.damp(
    player.y,
    floor + (crouched ? 1.06 : 1.64),
    14,
    dt,
  );
  camera.position.set(
    player.x,
    player.y +
      (moving
        ? Math.sin(time * (sprint ? 13 : 8)) * 0.018 * settings.shake
        : Math.sin(time * 1.6) * 0.003),
    player.z,
  );
  camera.rotation.set(lookPitch, lookYaw, 0, "YXZ");
  stepTimer -= dt;
  if (moving && stepTimer <= 0) {
    audio.foot(player, floor > 0, sprint);
    stepTimer = crouched ? 0.7 : sprint ? 0.31 : 0.48;
  }
  if (settings.blur)
    canvas.style.filter = moving && sprint ? "blur(.3px)" : "none";
  else canvas.style.filter = "none";
  const bob = moving ? Math.sin(time * 8) * 0.009 * settings.shake : 0;
  cameraModel.position.y = THREE.MathUtils.damp(
    cameraModel.position.y,
    aiming ? -0.13 : -0.26 + bob,
    8,
    dt,
  );
  cameraModel.position.x = THREE.MathUtils.damp(
    cameraModel.position.x,
    aiming ? 0.07 : 0.28,
    8,
    dt,
  );
  cameraModel.rotation.z = -0.05 + Math.sin(time * 3) * 0.008 * settings.shake;
  cameraModel.visible = !hidden && !photoInspected;
  return sprint;
}
function updatePlaying(dt) {
  time += dt;
  state.elapsed += dt;
  grace = Math.max(0, grace - dt);
  finalGrace = Math.max(0, finalGrace - dt);
  const sprint = movePlayer(dt);
  if (state.finalPhoto && player.z > 20) {
    finish();
    return;
  }
  const n = Object.keys(state.evidence).length;
  const result = ai.update(dt, player, n, state.ritualComplete, hidden, sprint);
  if (result.caught && grace <= 0 && finalGrace <= 0) {
    die();
    return;
  }
  if (
    hidden &&
    distance(ai.position, player) < 1.8 &&
    ai.state === "CHASING" &&
    grace <= 0
  ) {
    subtitle("It saw you enter. The wardrobe will not hold.", 3);
    hidden = false;
    grace = 3;
  }
  world.observer.position.set(
    ai.position.x,
    floorAt(ai.position.x, ai.position.z) ?? 0,
    ai.position.z,
  );
  world.observer.rotation.y = Math.atan2(
    player.x - ai.position.x,
    player.z - ai.position.z,
  );
  world.observer.rotation.z = Math.sin(time * 2.5) * 0.035;
  world.observer.userData.walking = ai.path.length > 0;
  world.observer.visible =
    n >= 2 &&
    (ai.state === "CHASING" ||
      (storm > 0.5 && state.ritualComplete) ||
      ai.materialize > 0);
  $("danger").style.opacity = String(result.warning * 0.48);
  audio.update(player, lookYaw, result.warning);
  heartbeat -= dt;
  if (heartbeat <= 0 && result.warning > 0.35) {
    audio.pulse(result.warning * 0.12);
    heartbeat = 1.4 - result.warning * 0.55;
  }
  if (lightOn) {
    state.battery = Math.max(15, state.battery - dt * 0.025);
  } else state.battery = Math.min(100, state.battery + dt * 0.2);
  near = findInteractable();
  $("interaction").textContent = interactionText(near);
  $("room-name").textContent =
    regionAt(player.x, player.z)?.name || "BLACKWOOD HOUSE";
  if (state.elapsed > 35) $("control-hint").style.opacity = ".25";
  subtitleTimer -= dt;
  if (subtitleTimer <= 0) $("subtitle").style.opacity = "0";
  objectiveTimer -= dt;
  if (objectiveTimer <= 0) $("objective").style.opacity = "0";
  scareTimer -= dt;
  if (scareTimer <= 0) {
    const source = {
      x: ai.position.x,
      y: (floorAt(ai.position.x, ai.position.z) ?? 0) + 1,
      z: ai.position.z,
    };
    const event = Math.floor(rng() * 4);
    if (event === 0) {
      audio.creak(source);
      subtitle("[ A floorboard creaks nearby. ]", 3);
    } else if (event === 1) {
      audio.whisper(source);
      if (result.distance < 9)
        subtitle("[ Slow breathing, somewhere close. ]", 3);
    } else if (event === 2) {
      const d = world.doors.filter(
        (d) =>
          !d.locked &&
          d.target &&
          distance(d.position, player) > 3 &&
          distance(d.position, player) < 13,
      )[0];
      if (d) {
        d.target = 0;
        audio.door({ ...d.position, y: 1 });
        subtitle("[ A door closes. ]", 3);
      }
    } else {
      audio.noise(0.4, 0.14, 600, source);
      subtitle("[ Something falls in another room. ]", 3);
    }
    scareTimer = 22 + rng() * 28;
  }
  stormTimer -= dt;
  if (stormTimer <= 0) {
    storm = 1;
    audio.thunder();
    stormTimer = 19 + rng() * 25;
  }
  updateHud();
  processPhoto(dt);
}
function updateLights(dt) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  flashlight.position
    .copy(camera.position)
    .add(new THREE.Vector3(0.13, -0.15, 0).applyEuler(camera.rotation));
  flashlight.target.position.copy(camera.position).addScaledVector(forward, 10);
  const batteryScale = 0.6 + state.battery / 250;
  flashlight.intensity =
    mode === "menu"
      ? 0
      : lightOn && !hidden
        ? 32 *
          batteryScale *
          (ai.state === "CHASING" && Math.sin(time * 36) > 0.85 ? 0.35 : 1)
        : 0;
  fillLight.position.copy(camera.position);
  fillLight.intensity = mode === "menu" ? 0 : lightOn && !hidden ? 1.4 : 0.45;
  storm = Math.max(0, storm - dt * 1.5);
  world.update(
    dt,
    time,
    camera.position,
    mode === "menu" ? true : power,
    storm,
  );
}
let previous = performance.now(),
  fpsSamples = [],
  lastSecond = 0;
function animate(now) {
  renderer.info.reset();
  requestAnimationFrame(animate);
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (mode === "menu") {
    time += dt;
    camera.position.set(-0.6 + Math.sin(time * 0.07) * 0.13, 1.62, 12);
    camera.rotation.set(-0.025, 0.06 + Math.sin(time * 0.07) * 0.04, 0, "YXZ");
    world.observer.visible = false;
    cameraModel.visible = false;
  } else if (mode === "playing") updatePlaying(dt);
  updateLights(dt);
  renderer.render(scene, camera);
  if (cameraModel.visible) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(weaponScene, weaponCamera);
    renderer.autoClear = true;
  }
  if (now - lastSecond > 1000) {
    document.documentElement.dataset.fps = String(Math.round(1 / dt));
    lastSecond = now;
  }
}
$("new-game").onclick = () => startGame(false);
$("continue").onclick = () => startGame(true);
$("settings-open").onclick = () => openSettings(false);
$("credits-open").onclick = openCredits;
$("pause-button").onclick = openPause;
$("journal-button").onclick = () => journal();
$("continue").disabled = !readSave();
if (readSave()) $("save-label").textContent = "MEMORY FOUND";
window.addEventListener("keydown", (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLSelectElement
  ) {
    if (e.code === "Escape") {
      e.preventDefault();
      $("panel-close")?.click();
    }
    return;
  }
  if (
    [
      "Tab",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
    ].includes(e.code)
  )
    e.preventDefault();
  if (e.repeat) {
    keys[e.code] = true;
    return;
  }
  keys[e.code] = true;
  if (e.code === "Escape" || e.code === "KeyP") {
    if (mode === "playing") {
      openPause();
    } else if (screenName === "pause") resume();
    else $("panel-close")?.click();
    return;
  }
  if (mode !== "playing") return;
  if (e.code === "KeyE") interact();
  if (e.code === "KeyC") takePhoto();
  if (e.code === "KeyF") {
    lightOn = !lightOn;
    audio.tone(230, 0.05, 0.025);
    updateHud();
  }
  if (
    e.code === "ControlLeft" ||
    e.code === "ControlRight" ||
    e.code === "KeyX"
  ) {
    crouched = !crouched;
    updateHud();
  }
  if (e.code === "KeyJ" || e.code === "Tab") journal();
  if (e.code === "KeyQ") {
    if (!photoBusy) {
      $("photo-held").hidden = true;
      photoInspected = false;
      $("photo-held").classList.remove("inspected");
    }
  }
  if (e.code === "KeyR" && !$("photo-held").hidden) {
    photoInspected = !photoInspected;
    $("photo-held").classList.toggle("inspected", photoInspected);
  }
  if (e.code === "KeyH") objective();
});
window.addEventListener("keyup", (e) => (keys[e.code] = false));
window.addEventListener("blur", () => {
  keys = {};
  if (mode === "playing") openPause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode === "playing") openPause();
});
canvas.addEventListener("mousedown", (e) => {
  if (mode !== "playing") return;
  if (e.button === 2) {
    aiming = true;
    $("viewfinder").hidden = false;
  }
  if (e.button === 0) {
    if (pointerLocked) takePhoto();
    else {
      dragging = true;
      canvas.focus();
    }
  }
});
window.addEventListener("mouseup", (e) => {
  dragging = false;
  if (e.button === 2 && !photoBusy) {
    aiming = false;
    $("viewfinder").hidden = true;
  }
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("mousemove", (e) => {
  if (mode !== "playing" || (!pointerLocked && !dragging)) return;
  lookYaw -= e.movementX * 0.002 * settings.sensitivity;
  lookPitch = clamp(
    lookPitch - e.movementY * 0.002 * settings.sensitivity,
    -1.35,
    1.35,
  );
  if (photoInspected)
    $("photo-held").style.transform =
      `rotate(${clamp(e.movementX, -5, 5) - 2}deg)`;
});
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  weaponCamera.aspect = camera.aspect;
  weaponCamera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
window.addEventListener("beforeunload", () => {
  if (started && !state.escaped) save();
});
world.setCode(state.code);
requestAnimationFrame(animate);
setTimeout(() => {
  $("loading").style.opacity = "0";
  setTimeout(() => ($("loading").hidden = true), 700);
}, 600);
// Diagnostics expose read-only snapshots; no gameplay cheats are enabled in production.
Object.defineProperty(window, "polaroidDiagnostics", {
  get: () => ({
    mode,
    room: regionAt(player.x, player.z)?.name,
    position: { ...player },
    yaw: lookYaw,
    pitch: lookPitch,
    film: state.film,
    evidence: Object.keys(state.evidence),
    ai: ai.state,
    aiPosition: { ...ai.position },
    photoBusy,
    shotStage,
    ritual: [...state.ritual],
    ritualComplete: state.ritualComplete,
    finalPhoto: state.finalPhoto,
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
  }),
});

Object.defineProperty(window, "polaroidNavigation", {
  get: () =>
    world.solids.map(({ door, ...b }) => ({
      ...b,
      door: door ? { open: door.open } : undefined,
    })),
});
