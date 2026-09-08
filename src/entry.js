import { SETTINGS_KEY, readSettings } from "./shared/settings.js";
import "./style.css";
import "./anthology.css";
const chapter = new URLSearchParams(location.search).get("chapter");
if (chapter === "blackwood") await import("./main.js");
else if (chapter === "last-showing") await import("./cinema/game.js");
else {
  const read = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };
  const blackwood = read("polaroid.save.v1"),
    cinema = read("polaroid.last-showing.v1");
  const complete = read("polaroid.completed.v1") || {};
  document.querySelector("#menu").hidden = true;
  document.querySelector("#loading").hidden = true;
  const screen = document.createElement("main");
  screen.className = "anthology";
  screen.innerHTML = `<header><a class="brand" href="./">◉ STILL / HERE</a><span>AN ANTHOLOGY OF IMPOSSIBLE PHOTOGRAPHS</span></header><div class="anthology-title"><div class="eyebrow">CHOOSE A MEMORY</div><h1>POLAROID</h1><p>Different places. Familiar darkness.<br>Some things only exist in photographs.</p></div><section class="chapter-grid" aria-label="Choose a story">
  <article class="chapter-card blackwood"><div class="chapter-art"><img src="/chapter-art/blackwood.jpg" alt="The deserted green hallway of Blackwood House"><span>01 / OCTOBER 1997</span></div><div class="chapter-copy"><div class="eyebrow">CHAPTER 01</div><h2>BLACKWOOD HOUSE</h2><p>Return to the house that remembers you. Four photographs. One way out.</p><small>${complete.blackwood ? "STORY COMPLETED" : blackwood ? `${Object.keys(blackwood.evidence || {}).length} / 4 MEMORIES RECOVERED` : "AN UNDEVELOPED MEMORY"}</small><div class="chapter-actions"><a class="filled-button" href="?chapter=blackwood&play=new">NEW STORY ↗</a>${blackwood ? '<a href="?chapter=blackwood&play=continue">CONTINUE →</a>' : '<button disabled class="muted" title="No saved story">CONTINUE</button>'}</div></div></article>
  <article class="chapter-card cinema"><div class="chapter-art"><img src="/chapter-art/cinema.jpg" alt="Empty burgundy seats beneath a cinema projection beam"><span>02 / NOVEMBER 1998</span></div><div class="chapter-copy"><div class="eyebrow">CHAPTER 02</div><h2>THE LAST SHOWING</h2><p>Catalogue a cinema before its final closure. Someone is still waiting for the film to end.</p><small>${cinema?.completed ? "STORY COMPLETED" : cinema ? `${Object.keys(cinema.evidence || {}).length} PHOTOGRAPHIC DISCOVERIES` : "BELLWETHER CINEMA / ADMIT ONE"}</small><div class="chapter-actions"><a class="filled-button" href="?chapter=last-showing&play=new">NEW STORY ↗</a>${cinema && !cinema.completed ? '<a href="?chapter=last-showing&play=continue">CONTINUE →</a>' : '<button disabled class="muted" title="No unfinished story">CONTINUE</button>'}</div></div></article></section><footer><span>HEADPHONES RECOMMENDED</span><span>Your stories are saved separately. Settings follow you.</span><span><button id="anthology-settings">SETTINGS</button> / <button id="anthology-credits">CREDITS</button></span></footer>`;
  document.body.append(screen);
  function anthologyPanel(title, body) {
    const overlay = document.querySelector("#overlay");
    overlay.hidden = false;
    overlay.style.zIndex = "12";
    document.querySelector("#overlay-content").innerHTML =
      '<div class="panel narrow"><div class="eyebrow">POLAROID / ANTHOLOGY</div><h2>' +
      title +
      "</h2>" +
      body +
      '<button id="anthology-close" class="filled-button">BACK TO STORIES</button></div>';
    document.querySelector("#anthology-close").onclick = () =>
      (overlay.hidden = true);
  }
  document.querySelector("#anthology-settings").onclick = () => {
    const settings = readSettings();
    anthologyPanel(
      "SETTINGS",
      ["master", "music", "effects", "sensitivity", "brightness"]
        .map(
          (key) =>
            '<label class="setting">' +
            key.toUpperCase() +
            '<input data-setting="' +
            key +
            '" type="range" min="' +
            (["sensitivity", "brightness"].includes(key) ? ".2" : "0") +
            '" max="' +
            (["sensitivity", "brightness"].includes(key) ? "2" : "1") +
            '" step=".05" value="' +
            settings[key] +
            '"></label>',
        )
        .join("") +
        '<label class="setting">GRAPHICS<select data-setting="quality"><option value="high">High</option><option value="low">Reduced effects</option></select></label><p>Settings are shared by both chapters.</p>',
    );
    document.querySelector('[data-setting="quality"]').value = settings.quality;
    document.querySelectorAll("[data-setting]").forEach(
      (input) =>
        (input.oninput = () => {
          settings[input.dataset.setting] =
            input.type === "range" ? Number(input.value) : input.value;
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        }),
    );
  };
  document.querySelector("#anthology-credits").onclick = () =>
    anthologyPanel(
      "STILL / HERE",
      "<p>POLAROID<br>Blackwood House / The Last Showing</p><p>Built with Three.js. Worlds, materials, camera and character models are created within the game. Shutter and concrete footstep recordings were supplied for POLAROID. The cinema manager is a fictional message voiced using Windows speech synthesis.</p><p>Bellwether Cinema and its characters are fictional.</p>",
    );
  screen.querySelectorAll('a[href*="play=new"]').forEach((link) =>
    link.addEventListener("click", (event) => {
      const exists = link.href.includes("blackwood") ? blackwood : cinema;
      if (
        exists &&
        !confirm(
          "Start this story again? Its previous save will be replaced. Your other chapter is unaffected.",
        )
      )
        event.preventDefault();
    }),
  );
}
