import { createAnalogPresentation } from "../shared/analog-presentation.js";
import * as THREE from "three";
import { buildCinema } from "./world.js";
import { CinemaSound } from "./audio.js";
import {
  SAVE_KEY,
  REELS,
  EVIDENCE,
  newStory,
  restoreStory,
  openingComplete,
  investigationComplete,
  changeReel,
  tickProjector,
  canPatronMove,
  canRegisterPhoto,
  objective,
  floorAt,
  regionAt,
} from "./logic.js";
import {
  SETTINGS_KEY,
  readSettings,
  createRenderer,
  movementIntent,
  photograph,
  releaseScene,
} from "../shared/runtime.js";

const $ = (s) => document.querySelector(s),
  canvas = $("#world");
document.body.classList.add("cinema-game");
document.title = "POLAROID — The Last Showing";
canvas.setAttribute("aria-label", "First-person view of Bellwether Cinema");
$("#menu").hidden = true;
let settings = readSettings(),
  state = newStory(),
  mode = "launch",
  physical = null,
  started = false,
  grace = 0,
  held = null,
  develop = 0,
  subtitleUntil = 0,
  shotCooldown = 0,
  stepTimer = 0,
  route = [],
  routeTimer = 0,
  routeGoal = null,
  lastPatronStep = 0,
  repair = null,
  disposed = false;
const keys = {},
  player = { x: 0, z: 11, yaw: 0, pitch: 0 },
  scene = new THREE.Scene();
scene.background = new THREE.Color("#101110");
scene.fog = new THREE.FogExp2("#151513", 0.014);
const camera = new THREE.PerspectiveCamera(
  settings.fov,
  innerWidth / innerHeight,
  0.035,
  75,
);
camera.rotation.order = "YXZ";
const renderer = createRenderer(canvas),
  presentation = createAnalogPresentation(renderer),
  world = buildCinema(scene, state),
  audio = new CinemaSound();
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
const flashlight = new THREE.SpotLight("#efdfb7", 18, 22, 0.65, 0.65, 1.5);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.bias = -0.0003;
flashlight.shadow.normalBias = 0.015;
flashlight.shadow.camera.near = 0.15;
flashlight.shadow.camera.far = 22;
flashlight.position.set(0, 0, 0);
flashlight.target.position.set(0, 0, -5);
camera.add(flashlight, flashlight.target);
scene.add(camera);
const status = document.createElement("div");
status.className = "projector-status";
status.hidden = true;
document.body.append(status);
const listeners = [];
function on(target, event, fn, options) {
  target.addEventListener(event, fn, options);
  listeners.push(() => target.removeEventListener(event, fn, options));
}
function applySettings() {
  presentation.configure(settings);
  renderer.shadowMap.enabled = settings.quality !== "low";
  audio.set(settings);
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, settings.quality === "low" ? 1 : 1.5),
  );
  renderer.toneMappingExposure = settings.brightness;
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
}
applySettings();
{
  const portrait = new THREE.PerspectiveCamera(34, 1.1 / 0.8, 0.035, 20);
  portrait.position.set(-8.8, 1.45, -21.8);
  portrait.lookAt(-7, 1.45, -21.8);
  world.update(
    { ...state, activeReel: "incident", events: { jamRepaired: true } },
    0,
    0,
    player,
    true,
  );
  renderer.render(scene, portrait);
  const print = document.createElement("canvas");
  print.width = 440;
  print.height = 320;
  const ctx = print.getContext("2d");
  const crop = Math.min(canvas.width / 1.375, canvas.height);
  ctx.drawImage(
    canvas,
    (canvas.width - crop * 1.375) / 2,
    (canvas.height - crop) / 2,
    crop * 1.375,
    crop,
    0,
    0,
    440,
    320,
  );
  ctx.strokeStyle = "#232322";
  ctx.lineWidth = 6;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.moveTo(175 + i * 8, 60);
    ctx.lineTo(230 + i * 3, 155);
    ctx.stroke();
  }
  ctx.fillStyle = "#b9ad8f";
  ctx.fillRect(0, 275, 440, 45);
  ctx.fillStyle = "#313830";
  ctx.font = "18px monospace";
  ctx.fillText("STAFF / A. BELL / 1978", 35, 302);
  const tex = new THREE.CanvasTexture(print);
  tex.colorSpace = THREE.SRGBColorSpace;
  world.staffPhoto.material.map = tex;
  world.staffPhoto.material.needsUpdate = true;
  world.update(state, 0, 0, player, false);
}
function subtitle(text, seconds = 7, critical = false) {
  if (!settings.subtitles && !critical) return;
  $("#subtitle").textContent = text;
  subtitleUntil = state.elapsed + seconds;
}
function save(checkpoint = true) {
  if (!started || mode === "dead") return;
  if (checkpoint) state.checkpoint = { ...player };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    subtitle(
      "Storage is full. Delete unneeded prints in the journal, then save again.",
      10,
      true,
    );
  }
}
function milestone(text) {
  subtitle(text, 8, true);
  save();
}
function lock() {
  const request = canvas.requestPointerLock?.();
  request?.catch?.(() =>
    subtitle(
      "Drag to look, or use the arrow keys. C takes a photograph.",
      7,
      true,
    ),
  );
  audio.ctx?.resume();
}
function panel(title, html, buttons = [], pause = false) {
  physical = pause ? null : title;
  if (pause) {
    mode = "paused";
    audio.pause(true);
    audio.ctx?.suspend();
  }
  $("#overlay").hidden = false;
  $("#overlay-content").innerHTML =
    `<div class="eyebrow">POLAROID / THE LAST SHOWING</div><h2>${title}</h2>${html}<p id="physical-warning" role="status" style="color:#d7a27f"></p><div class="cinema-controls">${buttons.map((b) => `<button id="${b.id}" ${b.disabled ? "disabled" : ""}>${b.label}</button>`).join("")}<button id="panel-close">${pause ? "RESUME" : "PUT AWAY"}</button></div>`;
  document.exitPointerLock?.();
  for (const b of buttons) $("#" + b.id).onclick = b.action;
  $("#panel-close").onclick = closePanel;
}
function closePanel() {
  physical = null;
  $("#overlay").hidden = true;
  if (mode === "paused") mode = "playing";
  audio.pause(false);
  audio.ctx?.resume();
  lock();
}
function pause() {
  if (mode !== "playing") return;
  save();
  panel(
    "A MOMENT OF STILLNESS",
    "<p>The projector and the patron are paused.</p>",
    [
      { id: "resume", label: "RESUME", action: closePanel },
      { id: "journal-pause", label: "JOURNAL", action: journal },
      { id: "settings-pause", label: "SETTINGS", action: settingsPanel },
      {
        id: "stories",
        label: "SAVE & STORY SELECTION",
        action: () => {
          save();
          location.href = "./";
        },
      },
    ],
    true,
  );
}
function settingsPanel() {
  panel(
    "SETTINGS",
    `<div class="cinema-note">${[
      ["master", "Master volume", 0, 1, 0.05],
      ["music", "Music", 0, 1, 0.05],
      ["effects", "Effects", 0, 1, 0.05],
      ["sensitivity", "Mouse sensitivity", 0.2, 2.5, 0.1],
      ["brightness", "Brightness", 0.6, 2, 0.1],
      ["fov", "Field of view", 55, 90, 1],
    ]
      .map(
        ([id, label, min, max, step]) =>
          `<label style="display:block;margin:12px 0">${label} <input data-setting="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[id]}"></label>`,
      )
      .join(
        "",
      )}<label>Graphics <select data-setting="quality"><option value="high">High</option><option value="low">Reduced effects</option></select></label><p><label><input type="checkbox" data-setting="retroEffects" ${settings.retroEffects !== false ? "checked" : ""}> Analog picture</label></p><p><label><input type="checkbox" data-setting="subtitles" ${settings.subtitles ? "checked" : ""}> Subtitles</label></p><p><label><input type="checkbox" data-setting="visualWarnings" ${settings.visualWarnings ? "checked" : ""}> Visual projector warnings</label></p></div>`,
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
  const tasks = {
    message: "Listen to the manager’s recording / lobby counter",
    seats: "Photograph torn seat D3 / auditorium",
    equipment: "Photograph the projector / upstairs booth",
  };
  panel(
    "CHECKLIST & PHOTOS",
    `<p class="cinema-note">${objective(state)}</p><div class="cinema-note">${Object.entries(
      tasks,
    )
      .map(
        ([id, label]) => `<div>${state.tasks[id] ? "✓" : "□"} ${label}</div>`,
      )
      .join(
        "",
      )}</div>${state.items.ticket ? '<p class="cinema-note">SCREEN ONE · ROW F · SEAT 8 · ADMIT ONE</p>' : ""}${state.items.records ? '<p class="cinema-note">Maintenance: the service leaf binds against stored cabinets. The manager declined clearance before the 1978 screening. Separately stored film: drawer A. BELL. Incident report: “Projectionist absent.” The next page has been removed.</p>' : ""}${state.items.reference ? `<img style="width:180px;border:10px solid #d8d0b5" src="${state.items.referenceImage || ""}" alt="1978 survey photograph"><p class="cinema-note">Survey print: stand on the brass square in the service passage, facing the sealed wall. The 1978 reel remembers an opening beneath the paint.</p>` : ""}<div class="cinema-journal">${state.photos.map((p) => `<figure><img src="${p.image}" alt="${p.caption}"><figcaption>${p.caption}<br>${REELS[p.reel]?.name || ""}</figcaption>${p.evidence.length ? "" : `<button data-delete="${p.id}">DISCARD PRINT</button>`}</figure>`).join("")}</div>`,
    [],
    true,
  );
  document.querySelectorAll("[data-delete]").forEach(
    (button) =>
      (button.onclick = () => {
        state.photos = state.photos.filter(
          (p) => p.id !== button.dataset.delete,
        );
        save(false);
        journal();
      }),
  );
}
function projectorPanel() {
  const names = {
    running: "RUNNING",
    stopped: "STOPPED",
    jammed: "JAMMED — LOOP TOO TIGHT",
    exhausted: "REEL EXHAUSTED",
    power: "POWER UNAVAILABLE",
  };
  panel(
    "THE PROJECTOR",
    `<p class="cinema-note">${names[state.projector.status]}<br>${REELS[state.activeReel].name}</p><p class="cinema-timer" id="live-timer"></p><p>Projector running: the patron stays still. Projector silent: it can move. Reel changes take three seconds and restart automatically. Stay nearby.</p><div class="cinema-reel">${state.reels.map((id) => `<button data-reel="${id}" ${id === state.activeReel ? 'class="selected"' : ""}>PLAY: ${id === "incident" ? "INCIDENT REEL" : REELS[id].name}</button>`).join(" ")}</div>`,
    [
      {
        id: "motor",
        label:
          state.projector.status === "running" ? "STOP MOTOR" : "START MOTOR",
        disabled: ["jammed", "power"].includes(state.projector.status),
        action: () => {
          if (state.projector.status === "running") {
            state.projector.status = "stopped";
            audio.mechanism({ x: 13.3, y: 4.9, z: -4.5 });
          } else if (state.projector.remaining > 0) {
            state.projector.status = "running";
            subtitle("The motor catches. The footsteps stop.", 5, true);
            save();
          } else
            subtitle(
              "The reel is spent. Rewind or load another reel.",
              6,
              true,
            );
          projectorPanel();
        },
      },
      {
        id: "rewind",
        label: "REWIND & RESTART / 5 SECONDS",
        disabled: ["jammed", "power"].includes(state.projector.status),
        action: () => {
          state.projector.status = "stopped";
          repair = { kind: "rewind", remaining: 5 };
          closePanel();
          subtitle(
            "Rewinding. Stay beside the projector for five seconds.",
            6,
            true,
          );
        },
      },
      {
        id: "unjam",
        label: "REPAIR & RESTART / 4 SECONDS",
        disabled: state.projector.status !== "jammed",
        action: () => {
          repair = { kind: "jam", remaining: 4 };
          closePanel();
          subtitle("Lift the loop clear of the sprocket. Hold here.", 5, true);
        },
      },
    ].filter((control) => !control.disabled),
  );
  document.querySelectorAll("[data-reel]").forEach(
    (button) =>
      (button.onclick = () => {
        if (changeReel(state, button.dataset.reel)) {
          audio.mechanism({ x: 13.3, y: 4.9, z: -4.5 });
          repair = { kind: "load", remaining: 3 };
          closePanel();
          subtitle(
            "Loading film. Stay here for three seconds; the motor will restart.",
            5,
            true,
          );
        } else
          subtitle(
            "Restore power or clear the loop before changing reels.",
            6,
            true,
          );
      }),
  );
}
function interact(id) {
  if (id.startsWith("door:")) {
    const key = id.slice(5),
      door = world.doors.find((d) => d.id === key);
    state.doors[key] = !state.doors[key];
    audio.mechanism({ x: door.x, y: door.y + 1, z: door.z }, "door");
    save();
    return;
  }
  if (id === "projector") {
    projectorPanel();
    return;
  }
  if (id === "message") {
    state.tasks.message = true;
    audio.manager();
    panel(
      "MANAGER / 11:08 PM",
      '<p class="cinema-note">Thanks for covering tonight. First, photograph the torn cushion in row D, seat 3. Then photograph the projector upstairs. That is all I need for the survey. The camera and spare film are here on the counter. Keep the projector running while you work. Lock up before midnight.</p>',
    );
    save();
  }
  if (id === "film") {
    if (state.film < 4) {
      state.film = 8;
      milestone(
        "An emergency pack. Eight exposures. There are more in the survey case.",
      );
    } else
      subtitle(
        "Keep this supply here. Return when fewer than four exposures remain.",
        6,
        true,
      );
  }
  if (id === "belongings") {
    state.tasks.belongings = true;
    milestone(
      "A child’s glove. Three umbrellas. No names. Bagged for collection.",
    );
  }
  if (id === "sorted") {
    state.tasks.sorted = true;
    if (!state.reels.includes("incident")) state.reels.push("incident");
    state.items.records = true;
    state.items.reference = true;
    if (!state.items.referenceImage) state.items.referenceImage = surveyPrint();
    panel(
      "THE 1978 REEL",
      '<p class="cinema-note">A labelled reel, an old survey photograph, and a maintenance note.</p><p>The exit was blocked on the night of the incident. Ada Bell was blamed for leaving her post. This reel may reveal what happened.</p><p><strong>Next: take this reel upstairs and select PLAY: INCIDENT REEL.</strong> Then photograph the painted-over service exit and Ada backstage. The survey print is in your journal.</p>',
    );
    save();
  }
  if (id === "records") {
    state.items.records = true;
    panel(
      "TWO ACCOUNTS",
      '<p class="cinema-note">MAINTENANCE / 14 NOVEMBER 1978<br>Service leaf binds against stored cabinets. Clearance requested. Manager declined: “After the late show.”</p><p class="cinema-note">INCIDENT / 15 NOVEMBER 1978<br>“Projectionist Ada Bell absent from post. Evacuation delayed.”<br>The signature page and witness account are missing.</p><p class="cinema-note">FILM STORAGE<br>The removed section is in the drawer marked A. BELL. Photograph the service exit and Ada before taking it.</p>',
    );
    save();
  }
  if (id === "reference") {
    state.items.reference = true;
    if (!state.items.referenceImage) state.items.referenceImage = surveyPrint();
    panel(
      "THE SURVEY PRINT",
      `<img style="width:230px;float:left;margin:0 24px 18px 0;border:12px solid #d8d0b5" src="${state.items.referenceImage}" alt="The old survey viewpoint and service door"><p class="cinema-note">A dated survey print shows a brass square beside the service wall. A doorway is visible between the electrical trunking and a hairline crack. The same brass square remains under your feet.</p><p>Stand on the square, face the sealed wall, and photograph it under the 1978 reel. The print is kept in your journal.</p>`,
    );
    save();
  }
  if (id === "exits") {
    state.tasks.exits = true;
    milestone(
      "The service exit has been painted over. There is a handle under the panel. Marked for the survey.",
    );
  }
  if (id === "ticket" && state.events.ticket && !state.items.ticket) {
    state.items.ticket = true;
    panel(
      "ADMIT ONE",
      '<p class="cinema-note" style="text-align:center;letter-spacing:4px">SCREEN ONE<br>ROW F<br>SEAT 8<br><br>ADMIT ONE</p><p>No show is scheduled. The auditorium should be empty.</p>',
    );
    save();
  }
  if (id === "coat" && state.evidence.first && !state.items.coat) {
    state.items.coat = true;
    milestone(
      "The coat is still warm. A ticket stub is sewn into the lining: F8. The projector begins to slap.",
    );
    audio.mechanism({ x: 6.5, y: 0.6, z: -2 });
  }
  if (id === "boothDoor") {
    state.doors.booth = !state.doors.booth;
    audio.mechanism({ x: 12, y: 4.5, z: 0 }, "door");
    save();
  }
  if (id === "drawer") {
    if (state.evidence.doorway && state.evidence.ada) {
      state.items.splice = true;
      audio.mechanism({ x: -18, y: 0.8, z: -9 });
      milestone(
        "You found the missing film. Take it to the workbench in the upstairs booth.",
      );
    } else
      panel(
        "A. BELL / REMOVED FILM",
        "<p>The label reads SERVICE ROUTE. First photograph the painted-over exit and Ada backstage with the 1978 reel running. Those two photographs will explain where this film belongs.</p>",
      );
  }
  if (id === "assemble") {
    if (investigationComplete(state)) {
      if (!state.reels.includes("complete")) state.reels.push("complete");
      changeReel(state, "complete");
      state.events.climax = true;
      grace = 12;
      save();
      panel(
        "THE COMPLETE REEL",
        '<p class="cinema-note">The missing section fits. Ada was opening a service route while someone held the auditorium doors shut.</p><p>You have three minutes. Start the film, go downstairs through STAFF ONLY, and open the service exit. If the reel ends, return to the projector and rewind it.</p>',
        [
          {
            id: "final-start",
            label: "START THE LAST SHOWING",
            action: () => {
              state.projector.status = "running";
              closePanel();
              milestone("The last showing. Let them leave.");
            },
          },
        ],
      );
    } else
      subtitle(
        "Find the missing film in the archive first. Your journal shows the next step.",
        8,
        true,
      );
  }
  if (id === "breaker") {
    if (state.projector.status === "power") {
      state.projector.status = "stopped";
      milestone("Power restored. Restart the projector upstairs.");
    } else
      subtitle("The service breaker is seated. The supply is stable.", 4, true);
  }
  if (id === "exit") {
    if (
      state.activeReel === "complete" &&
      state.projector.status === "running" &&
      state.evidence.doorway
    ) {
      state.doors.exit = true;
      state.events.released = true;
      route = [];
      audio.mechanism({ x: -14, y: 1, z: -18 }, "door");
      milestone(
        "The door gives. For the first time, the route is clear. Photograph the open exit.",
      );
    } else if (state.evidence.doorway)
      subtitle(
        "The latch is caught in the unfinished memory. Complete the screening first.",
        7,
        true,
      );
    else interact("exits");
  }
}
function interactTarget() {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  return world.interactions
    .filter((t) => {
      if (
        (t.id === "ticket" && (!state.events.ticket || state.items.ticket)) ||
        (t.id === "coat" && (!state.evidence.first || state.items.coat)) ||
        (t.id === "exit" && !state.evidence.doorway) ||
        (t.id === "exits" && state.evidence.doorway)
      )
        return false;
      const v = t.position.clone().sub(camera.position),
        d = v.length();
      const door =
        t.id === "boothDoor"
          ? "booth"
          : t.id.startsWith("door:")
            ? t.id.slice(5)
            : t.id === "exit"
              ? "exit"
              : null;
      return (
        d < t.range &&
        v.normalize().dot(direction) > 0.35 &&
        visible(t.position, 0.12, door)
      );
    })
    .sort(
      (a, b) =>
        a.position.distanceTo(camera.position) -
        b.position.distanceTo(camera.position),
    )[0];
}
const ray = new THREE.Raycaster();
function visible(position, tolerance = 0.2, interactionDoor = null) {
  const v = position.clone().sub(camera.position),
    d = v.length();
  ray.set(camera.position, v.normalize());
  ray.far = Math.max(0, d - tolerance);
  return !ray.intersectObjects(
    // A door's handle/leaf must not hide its own interaction point. Other
    // doors and walls still occlude it; photographic checks skip nothing.
    world.occluders.filter(
      (o) =>
        o.visible &&
        (!interactionDoor || o.userData.interactionDoor !== interactionDoor),
    ),
    false,
  ).length;
}
function eligible(id) {
  const t = world.targets[id],
    ndc = t.position.clone().project(camera),
    distance = t.position.distanceTo(camera.position);
  return canRegisterPhoto({
    reel: state.activeReel,
    requiredReel: t.requiredReel,
    visible: visible(t.position),
    framed:
      ndc.z > -1 &&
      ndc.z < 1 &&
      Math.abs(ndc.x) < 0.82 / Math.max(1, camera.aspect) &&
      Math.abs(ndc.y) < 0.82,
    distance,
    maxDistance: t.maxDistance,
    viewpoint:
      !t.view ||
      Math.hypot(player.x - t.view.x, player.z - t.view.z) < t.view.radius,
  });
}
function surveyPrint() {
  const survey = camera.clone();
  survey.position.set(-11.6, 1.64, -18);
  survey.lookAt(-14, 1.5, -18);
  world.update(
    {
      ...state,
      activeReel: "incident",
      projector: { status: "running", remaining: 1 },
      events: { ...state.events, jamRepaired: true },
      evidence: { ...state.evidence, doorway: "survey" },
    },
    0,
    state.elapsed,
    player,
    true,
  );
  renderer.clear();
  renderer.render(scene, survey);
  const image = photograph(canvas, 400);
  world.update(state, 0, state.elapsed, player, false);
  return image;
}
function impossiblePrint() {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();
  const behind = camera.position.clone().addScaledVector(direction, -1.2);
  if (
    world.nav.blocked(behind.x, behind.z, 0.2) ||
    !world.nav.clear(player, { x: behind.x, z: behind.z }, 0.15)
  )
    return;
  const witness = camera.clone();
  witness.position.copy(behind);
  witness.lookAt(camera.position.clone().addScaledVector(direction, 4));
  world.echo.position.set(player.x, floorAt(player.x, player.z), player.z);
  world.echo.rotation.y = player.yaw + Math.PI;
  world.echo.visible = true;
  renderer.clear();
  renderer.render(scene, witness);
  const image = photograph(canvas);
  world.echo.visible = false;
  const p = {
    id: "impossible-" + Date.now(),
    image,
    reel: state.activeReel,
    evidence: [],
    caption: "An impossible exposure / you are now part of the screening",
  };
  state.photos.push(p);
  state.events.impossible = true;
  held = p;
  develop = 2.7;
  $("#photo-held").hidden = false;
  $("#photo-image").src = image;
  $("#develop-layer").style.opacity = "1";
  subtitle(
    "The print shows the back of your head. This viewpoint was never yours. The building is keeping you in its screening.",
    10,
    true,
  );
  save();
}
function capture() {
  if (mode !== "playing" || physical || shotCooldown > 0) return;
  if (state.film === 0) {
    subtitle(
      "No film. The survey case at the lobby counter has an emergency supply.",
      8,
      true,
    );
    return;
  }
  state.film--;
  shotCooldown = 2.2;
  world.update(state, 0, state.elapsed, player, true);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const ids = [];
  for (const id of ["seats", "equipment"])
    if (eligible(id)) {
      ids.push(id);
      state.tasks[id] = true;
    }
  if (
    state.items.ticket &&
    state.projector.status === "running" &&
    eligible("patron")
  ) {
    if (!state.evidence.first) ids.push("first");
    if (state.events.jamRepaired) {
      if (Math.hypot(state.patron.x - 6.5, state.patron.z + 2) > 1)
        ids.push("moved");
      if (["opening", "return"].includes(state.activeReel))
        ids.push(state.activeReel);
    }
  }
  if (state.projector.status === "running" && state.events.jamRepaired) {
    if (state.items.reference && eligible("doorway")) ids.push("doorway");
    if (eligible("figure")) ids.push("figure");
    if (eligible("ada")) ids.push("ada");
    if (
      state.activeReel === "incident" &&
      state.elapsed % 14 > 10 &&
      eligible("frame")
    )
      ids.push("frame");
    if (eligible("evacuation")) ids.push("evacuation");
  }
  if (
    state.events.released &&
    Math.hypot(state.patron.x + 17, state.patron.z + 18) < 0.6 &&
    eligible("final")
  )
    ids.push("final");
  // The only exceptional exposure is late, optional, non-evidence, and labelled.
  // All puzzle images below render this camera and the active memory layer.
  renderer.clear();
  renderer.render(scene, camera);
  const image = photograph(canvas);
  world.update(state, 0, state.elapsed, player, false);
  audio.shutter();
  $("#flash").style.opacity = settings.quality === "low" ? ".2" : ".65";
  setTimeout(() => ($("#flash").style.opacity = "0"), 80);
  const fresh = ids.filter((id) => !state.evidence[id]),
    id = `p${Date.now()}-${state.photos.length}`;
  const photo = {
    id,
    image,
    reel: state.activeReel,
    evidence: ids,
    caption: ids.length
      ? ids.map((k) => EVIDENCE[k]).join(" / ")
      : "Bellwether / an unclaimed moment",
  };
  state.photos.push(photo);
  while (state.photos.length > 20) {
    const disposable = state.photos.findIndex((p) => !p.evidence.length);
    if (disposable < 0) break;
    state.photos.splice(disposable, 1);
  }
  for (const key of ids) state.evidence[key] = id;
  held = photo;
  develop = 2.7;
  $("#photo-held").hidden = false;
  $("#photo-held").classList.remove("inspecting");
  $("#photo-image").src = image;
  $("#develop-layer").style.opacity = "1";
  $("#photo-title").textContent = "DEVELOPING";
  $("#photo-note").textContent = "THE STORY CONTINUES WHILE YOU LOOK";
  if (fresh.includes("first"))
    subtitle("Something is forming in the print. Row F. Seat 8.", 7, true);
  else if (fresh.includes("figure") && !fresh.includes("ada"))
    subtitle(
      "Ada is beside the service passage. From here, the object in her hand could be a film can. Look from the side.",
      9,
      true,
    );
  else if (fresh.includes("ada"))
    subtitle(
      "That is a service key in Ada’s hand. She was leading people away from the screen.",
      9,
      true,
    );
  else if (fresh.includes("doorway"))
    subtitle("A door under the paint. The handle is real.", 7, true);
  else if (fresh.includes("frame"))
    subtitle(
      "An old splice mark. This is an extra photograph; your checklist shows what you need next.",
      7,
      true,
    );
  else if (fresh.length)
    subtitle("A new detail has been kept in the journal.", 5, true);
  else
    subtitle(
      "Photo saved. Check the objective for what to photograph next.",
      5,
    );
  if (
    state.items.splice &&
    !state.events.impossible &&
    !state.events.climax &&
    ids.length === 0
  )
    impossiblePrint();
  save();
}
function die() {
  mode = "dead";
  repair = null;
  audio.projector("stopped", 0, true);
  audio.pause(true);
  audio.ctx?.suspend();
  document.exitPointerLock?.();
  $("#overlay").hidden = false;
  $("#overlay-content").innerHTML =
    '<div class="eyebrow">THE FILM HAS STOPPED</div><h2>AN EMPTY SEAT</h2><p>You hear the last footstep beside you.</p><div class="cinema-controls"><button id="retry">CONTINUE FROM CHECKPOINT</button><button id="dead-stories">STORY SELECTION</button></div>';
  $("#retry").onclick = () => load(true);
  $("#dead-stories").onclick = () => (location.href = "./");
}
function finish() {
  state.completed = true;
  save();
  mode = "ending";
  audio.pause(true);
  document.exitPointerLock?.();
  $("#overlay").hidden = false;
  $("#overlay-content").innerHTML =
    `<div class="eyebrow">CHAPTER 02 / COMPLETED</div><h2>THE LAST SHOWING</h2><figure style="float:right;width:240px;padding:12px;background:#d4ceb8;margin:0 0 20px 25px"><img style="width:100%" src="${state.photos.find((p) => p.id === state.evidence.final)?.image || ""}" alt="The final photograph: a patron outside the open exit"><figcaption style="font:11px monospace;color:#3d4237;margin-top:10px">ONE ADMISSION. ONE DEPARTURE.</figcaption></figure><p class="cinema-note">The complete reel showed Ada Bell opening the service passage. The stored cabinets, the delay, the people following her: all of it was missing from the report.</p><p class="cinema-note">You leave the survey envelope with the photographs inside.<br>There is one extra ticket in your pocket.<br><br>ADMIT ONE. The corner has been torn off.</p><div class="cinema-controls"><button id="ending-stories">RETURN TO POLAROID</button></div>`;
  $("#ending-stories").onclick = () => (location.href = "./");
}
function load(useSave) {
  let saved = null;
  try {
    saved = restoreStory(JSON.parse(localStorage.getItem(SAVE_KEY) || "null"));
  } catch {}
  state = useSave && saved && !saved.completed ? saved : newStory();
  Object.assign(player, state.checkpoint);
  world.nav = navigationProxy();
  started = true;
  mode = "playing";
  physical = null;
  held = null;
  repair = null;
  route = [];
  routeTimer = 0;
  grace = useSave ? 18 : 0;
  $("#overlay").hidden = true;
  $("#photo-held").hidden = true;
  $("#hud").hidden = false;
  status.hidden = false;
  $("#loading").hidden = true;
  document.querySelector(".story-launch")?.remove();
  audio.start();
  audio.pause(false);
  audio.set(settings);
  if (world.nav.blocked(player.x, player.z)) {
    player.x = 0;
    player.z = 11;
  }
  save(false);
  lock();
  subtitle(
    useSave
      ? "Checkpoint restored. Eighteen seconds to find your bearings."
      : "Bellwether Cinema. November 1998. The recorder is on the ticket counter.",
    8,
    true,
  );
}
// World navigation refers to the live door object. Replacing a save must keep
// those references synchronized rather than retaining doors from a prior run.
const originalNavigation = world.nav;
function navigationProxy() {
  const original = originalNavigation;
  return {
    blocked: (x, z, r, p) => {
      syncDoors();
      return original.blocked(x, z, r, p);
    },
    clear: (a, b, r, p) => {
      syncDoors();
      return original.clear(a, b, r, p);
    },
    path: (a, b) => {
      syncDoors();
      return original.path(a, b);
    },
  };
}
const worldDoorState = state.doors;
function syncDoors() {
  Object.assign(worldDoorState, state.doors);
}
function threat(dt) {
  const moving = canPatronMove(state, mode !== "playing", grace),
    released = state.events.released;
  if (!moving && !released) {
    route = [];
    return;
  }
  const destination = released ? { x: -17, z: -18 } : player;
  routeTimer -= dt;
  if (
    !route.length ||
    (routeTimer <= 0 &&
      (!routeGoal ||
        Math.hypot(destination.x - routeGoal.x, destination.z - routeGoal.z) >
          1))
  ) {
    route = world.nav.path(state.patron, destination);
    routeGoal = { x: destination.x, z: destination.z };
    routeTimer = 1.8;
  }
  let remaining = dt * (released ? 0.95 : state.events.climax ? 1.45 : 1.05);
  while (remaining > 0 && route.length) {
    const next = route[0],
      dx = next.x - state.patron.x,
      dz = next.z - state.patron.z,
      d = Math.hypot(dx, dz);
    if (d < 0.001) {
      route.shift();
      continue;
    }
    for (const door of world.doors) {
      if (
        door.id !== "exit" &&
        !state.doors[door.id] &&
        Math.hypot(state.patron.x - door.x, state.patron.z - door.z) < 1.4
      ) {
        state.doors[door.id] = true;
        syncDoors();
        audio.mechanism({ x: door.x, y: door.y + 1, z: door.z }, "door");
        subtitle("A door opens in the silence.", 5);
      }
    }
    const move = Math.min(remaining, d),
      nx = state.patron.x + (dx / d) * move,
      nz = state.patron.z + (dz / d) * move;
    if (world.nav.blocked(nx, nz, 0.2)) {
      route = [];
      break;
    }
    state.patron.x = nx;
    state.patron.z = nz;
    state.patron.distance += move;
    world.patron.rotation.y = Math.atan2(dx, dz);
    remaining -= move;
  }
  const distance = Math.hypot(
      state.patron.x - player.x,
      state.patron.z - player.z,
    ),
    height = Math.abs(
      (floorAt(state.patron.x, state.patron.z) || 0) -
        (floorAt(player.x, player.z) || 0),
    );
  if (
    !released &&
    grace <= 0 &&
    distance < 0.8 &&
    height < 1 &&
    world.nav.clear(state.patron, player, 0.1)
  )
    die();
  const steps = world.patron.userData.footfallCount || 0;
  if (steps !== lastPatronStep) {
    lastPatronStep = steps;
    const position = {
      x: state.patron.x,
      y: floorAt(state.patron.x, state.patron.z),
      z: state.patron.z,
    };
    if (regionAt(position.x, position.z)?.ramp)
      audio.foot(position, "metal", false, false);
    else audio.carpet(position);
    if (distance < 12) subtitle("Footsteps. Closer than the projector.", 3);
  }
}
function storyEvents(dt) {
  if (openingComplete(state) && !state.events.ticket) {
    state.events.ticket = true;
    state.projector.remaining = Math.max(150, state.projector.remaining);
    audio.mechanism({ x: -3.3, y: 1.2, z: 11 });
    milestone("A ticket prints in the empty lobby.");
  }
  if (
    state.items.coat &&
    !state.events.firstJam &&
    regionAt(player.x, player.z)?.name === "Projection booth"
  ) {
    state.events.firstJam = true;
    state.projector.status = "jammed";
    if (!state.patron.awakened) {
      state.patron.awakened = true;
      state.patron.z = -1.08;
    }
    grace = 0;
    audio.mechanism({ x: 6.5, y: 0.6, z: -2 });
    milestone(
      "The motor dies. A seat folds up. Lift the loose film loop, then restart the motor.",
    );
  }
  if (
    state.evidence.first &&
    state.projector.status !== "running" &&
    !state.patron.awakened
  ) {
    state.patron.awakened = true;
    state.patron.z = -1.08;
  }
  if (
    state.evidence.doorway &&
    state.evidence.ada &&
    !state.events.audienceTurn
  ) {
    state.events.audienceTurn = true;
    milestone(
      "The audience turns toward you. Ada was helping them leave. The removed film is in the archive drawer marked A. BELL.",
    );
  }
  if (
    state.events.jamRepaired &&
    !state.events.boothClosed &&
    player.z > 3 &&
    player.x < 10
  ) {
    state.events.boothClosed = true;
    state.doors.booth = false;
    audio.mechanism({ x: 12, y: 4.8, z: 0 }, "door");
    milestone("Upstairs, the booth door closes. It is not locked.");
  }
  if (repair) {
    if (Math.hypot(player.x - 13.3, player.z + 3.6) > 3) {
      repair = null;
      subtitle(
        "The film loop slips. Stay beside the projector to finish.",
        5,
        true,
      );
    } else {
      repair.remaining -= dt;
      if (repair.remaining <= 0) {
        if (repair.kind === "jam") {
          state.projector.status = "running";
          state.events.jamRepaired = true;
          state.projector.remaining = Math.max(state.projector.remaining, 300);
          milestone(
            "The motor restarts. It moved while the film was stopped. Collect the 1978 reel from the archive.",
          );
        } else {
          state.projector.remaining = REELS[state.activeReel].seconds;
          state.projector.status = "running";
          milestone("The projector is running. The patron has stopped.");
        }
        repair = null;
      }
    }
  }
  if (state.events.released && state.evidence.final && player.x < -15) finish();
}
function move(dt) {
  player.yaw +=
    ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * dt * 1.45;
  player.pitch = THREE.MathUtils.clamp(
    player.pitch +
      ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * dt * 1.45,
    -1.35,
    1.35,
  );
  const crouch = !!(keys.ControlLeft || keys.ControlRight || keys.KeyX),
    motion = movementIntent(keys, player.yaw, crouch);
  if (physical) return;
  const nx = player.x + motion.vx * dt,
    nz = player.z + motion.vz * dt;
  let moved = false;
  if (!world.nav.blocked(nx, player.z)) {
    moved |= Math.abs(nx - player.x) > 0.001;
    player.x = nx;
  }
  if (!world.nav.blocked(player.x, nz)) {
    moved |= Math.abs(nz - player.z) > 0.001;
    player.z = nz;
  }
  if (moved) {
    stepTimer -= dt;
    if (stepTimer <= 0) {
      const position = {
        x: player.x,
        y: floorAt(player.x, player.z),
        z: player.z,
      };
      if (regionAt(player.x, player.z)?.ramp)
        audio.foot(position, "metal", motion.sprint, crouch);
      else if (
        ["Service passage", "Backstage", "Film archive"].includes(
          regionAt(player.x, player.z)?.name,
        )
      )
        audio.foot(position, "concrete", motion.sprint, crouch);
      else audio.carpet(position, motion.sprint);
      stepTimer = motion.sprint ? 0.31 : crouch ? 0.7 : 0.48;
    }
  }
  camera.position.set(
    player.x,
    (floorAt(player.x, player.z) || 0) +
      (crouch ? 1.08 : 1.64) +
      (moved ? Math.sin(state.elapsed * 12) * 0.015 : 0),
    player.z,
  );
  camera.rotation.set(player.pitch, player.yaw, 0);
  const aim = !!keys.MouseRight;
  $("#viewfinder").hidden = !aim;
  cameraModel.position.set(aim ? 0.2 : 0.28, aim ? -0.18 : -0.28, -0.53);
  cameraModel.rotation.z =
    -0.05 + (moved ? Math.sin(state.elapsed * 6) * 0.009 : 0);
}
function hud() {
  $("#phase").textContent = state.events.climax
    ? "04 / THE LAST SHOWING"
    : state.events.jamRepaired
      ? "03 / INVESTIGATION"
      : state.items.ticket
        ? "02 / ADMIT ONE"
        : "01 / CLOSING TIME";
  $("#room-name").textContent =
    regionAt(player.x, player.z)?.name.toUpperCase() || "";
  $("#objective").textContent = objective(state);
  $("#film").textContent = String(state.film).padStart(2, "0");
  $("#evidence-count").textContent =
    `${Object.keys(state.evidence).length} PRINTED DETAILS`;
  $("#battery").textContent = "";
  const proximity =
    state.patron.awakened &&
    !state.events.released &&
    state.projector.status !== "running"
      ? Math.max(
          0,
          1 -
            Math.hypot(state.patron.x - player.x, state.patron.z - player.z) /
              6,
        )
      : 0;
  $("#danger").style.opacity = String(
    mode === "playing" ? proximity * 0.55 : 0,
  );
  const warning =
    state.projector.status !== "running" || state.projector.remaining < 35;
  status.classList.toggle("danger", warning);
  status.hidden = !started || (!settings.visualWarnings && warning);
  status.innerHTML = `PROJECTOR / ${state.projector.status === "power" ? "POWER UNAVAILABLE" : state.projector.status.toUpperCase()}<br>${REELS[state.activeReel].name}<br>${state.projector.status === "running" ? `${Math.ceil(state.projector.remaining)} SEC REMAINING` : state.patron.awakened ? "LISTEN FOR FOOTSTEPS" : ""}`;
  if ($("#physical-warning"))
    $("#physical-warning").textContent =
      mode === "playing" && state.projector.status !== "running"
        ? "THE PROJECTOR IS SILENT. This is not a pause."
        : mode === "playing" && state.projector.remaining < 35
          ? "THE REEL IS APPROACHING ITS END."
          : "";
  if ($("#live-timer"))
    $("#live-timer").textContent =
      `${Math.ceil(state.projector.remaining)} seconds · ${state.projector.status.toUpperCase()}${repair ? " · WORK IN PROGRESS" : ""}`;
  const target = mode === "playing" && !physical ? interactTarget() : null;
  let photoHint = "";
  if (mode === "playing" && !physical) {
    const next = !state.tasks.seats
      ? ["seats", "Photograph the torn cushion"]
      : !state.tasks.equipment
        ? ["equipment", "Photograph the projector"]
        : state.items.ticket && !state.evidence.first
          ? ["patron", "Photograph seat F8"]
          : state.activeReel === "incident" &&
              state.projector.status === "running" &&
              state.events.jamRepaired
            ? !state.evidence.doorway
              ? ["doorway", "Photograph the painted-over exit"]
              : !state.evidence.ada
                ? ["ada", "Photograph the service key in Ada's hand"]
                : null
            : null;
    if (next && eligible(next[0])) photoHint = "[ C ] " + next[1];
  }
  $("#interaction").textContent =
    photoHint || (target ? "[ E ] " + target.label : "");
  if (state.elapsed > subtitleUntil) $("#subtitle").textContent = "";
  if (held) {
    $("#develop-layer").style.opacity = String(Math.max(0, develop / 2.7));
    if (develop <= 0) {
      $("#photo-title").textContent = held.caption;
      $("#photo-note").textContent = "R INSPECT · Q PUT AWAY · J JOURNAL";
    }
  }
}
function frame(now) {
  if (disposed) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === "playing") {
    grace = Math.max(0, grace - dt);
    shotCooldown = Math.max(0, shotCooldown - dt);
    develop = Math.max(0, develop - dt);
    for (const e of tickProjector(state, dt)) {
      if (e === "warning") {
        audio.tone(
          240,
          0.6,
          0.1,
          { x: 13.3, y: 4.9, z: -4.5 },
          "triangle",
          170,
        );
        subtitle("The reel flutters. Thirty-five seconds remain.", 7, true);
      } else subtitle("The reel runs out. The motor falls silent.", 6, true);
    }
    move(dt);
    storyEvents(dt);
    threat(dt);
    world.update(state, dt, state.elapsed, player, false);
    audio.update(
      { x: player.x, y: camera.position.y, z: player.z },
      player.yaw,
      0,
    );
  } else world.update(state, 0, state.elapsed, player, false);
  audio.projector(
    state.projector.status,
    state.projector.remaining,
    mode !== "playing",
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
let last = performance.now();
camera.position.set(0, 1.64, 11);
requestAnimationFrame(frame);
on(window, "keydown", (event) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
  if (event.repeat) return;
  keys[event.code] = true;
  if (
    ["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      event.code,
    )
  )
    event.preventDefault();
  if (event.code === "Escape" || event.code === "KeyP") {
    event.preventDefault();
    if (mode === "paused") closePanel();
    else if (physical) closePanel();
    else pause();
  }
  if (mode !== "playing") return;
  if (event.code === "KeyE" && !physical) {
    const t = interactTarget();
    if (t) interact(t.id);
  }
  if (event.code === "KeyC") capture();
  if (event.code === "KeyJ" || event.code === "Tab") journal();
  if (event.code === "KeyH") subtitle(objective(state), 8, true);
  if (event.code === "KeyF") flashlight.visible = !flashlight.visible;
  if (event.code === "KeyQ") {
    held = null;
    $("#photo-held").hidden = true;
  }
  if (event.code === "KeyR" && held)
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
Object.defineProperty(window, "cinemaDiagnostics", {
  get: () => ({
    mode,
    physical,
    player: { ...player, y: camera.position.y },
    state: JSON.parse(
      JSON.stringify({
        ...state,
        items: {
          ...state.items,
          referenceImage: state.items.referenceImage
            ? "[survey image]"
            : undefined,
        },
        photos: state.photos.map(({ image, ...p }) => ({
          ...p,
          imageLength: image.length,
        })),
      }),
    ),
    grace,
    repair,
    develop,
    patronVisible: world.patron.visible,
    footfalls: world.patron.userData.footfallCount || 0,
    motorGain: audio.motorGain?.gain.value,
    targets: Object.fromEntries(
      Object.entries(world.targets).map(([id, t]) => [
        id,
        {
          x: t.position.x,
          y: t.position.y,
          z: t.position.z,
          eligible: eligible(id),
        },
      ]),
    ),
    interactions: world.interactions.map((t) => ({
      id: t.id,
      x: t.position.x,
      y: t.position.y,
      z: t.position.z,
    })),
    renderer: renderer.info.memory,
  }),
});
Object.defineProperty(window, "cinemaNavigation", {
  value: Object.freeze({
    path: (a, b) => world.nav.path(a, b),
    blocked: (x, z) => world.nav.blocked(x, z),
    floorAt,
  }),
});
const launch = document.createElement("div");
launch.className = "story-launch";
launch.innerHTML =
  '<div class="launch-inner"><div class="eyebrow">POLAROID / CHAPTER 02</div><h1>THE LAST SHOWING</h1><p>Bellwether Cinema, November 1998.<br>One closing shift. A camera. An empty screen.</p><button id="enter-story" class="filled-button">ENTER BELLWETHER →</button><p style="font:12px/1.8 monospace">WASD move · Mouse look · E interact<br>C photograph · Right mouse viewfinder · F light<br>J journal · R inspect print · Escape pause</p><a href="./">BACK TO STORIES</a></div>';
document.body.append(launch);
$("#loading").hidden = true;
$("#enter-story").onclick = () => {
  const params = new URLSearchParams(location.search);
  load(params.get("play") !== "new");
  params.delete("play");
  history.replaceState(null, "", `?${params}`);
};
