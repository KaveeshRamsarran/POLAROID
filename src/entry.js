import { SETTINGS_KEY, readSettings } from "./shared/settings.js";
import "./style.css";
import "./anthology.css";
import "./presentation.css";
import "./shared/fullscreen.js";
import { preloadPbr } from "./shared/pbr.js";
import { openSaveMenu } from "./shared/save-menu.js";
const chapter = new URLSearchParams(location.search).get("chapter");
if (["blackwood", "last-showing", "vacancy"].includes(chapter))
  await preloadPbr();
if (chapter === "blackwood") await import("./main.js");
else if (chapter === "last-showing") await import("./cinema/game.js");
else if (chapter === "vacancy") await import("./vacancy/game.js");
else {
  const read = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };
  const blackwood = read("polaroid.save.v1"),
    cinema = read("polaroid.last-showing.v1"),
    vacancy = read("polaroid.vacancy.v1");
  const complete = read("polaroid.completed.v1") || {};
  document.querySelector("#menu").hidden = true;
  document.querySelector("#loading").hidden = true;
  const screen = document.createElement("main");
  screen.className = "anthology";
  screen.innerHTML = `<div class="menu-backgrounds" aria-hidden="true"><img data-background="blackwood" class="active" src="/chapter-art/blackwood.jpg" alt=""><img data-background="cinema" src="/chapter-art/cinema.jpg" alt=""></div><div class="menu-shade"></div><header><a class="brand" href="./">STILL / HERE</a><span>AN ANTHOLOGY OF IMPOSSIBLE PHOTOGRAPHS</span></header><section class="anthology-title"><div class="eyebrow">A PSYCHOLOGICAL HORROR EXPERIENCE</div><h1>POLAROID</h1><p>Some things only exist<br>in photographs.</p><div class="menu-rule"></div><span id="menu-location">BLACKWOOD HOUSE / OCTOBER 1997</span></section><section class="chapter-grid" aria-label="Choose a story"><div class="eyebrow">SELECT A STORY</div>
<article class="chapter-card blackwood selected" data-chapter="blackwood"><button class="chapter-name" aria-pressed="true"><small>CHAPTER 01</small><h2>BLACKWOOD HOUSE</h2></button><p>Return to the house that remembers you.</p><small class="chapter-progress">${complete.blackwood ? "STORY COMPLETED" : blackwood ? "SAVED STORY / " + Object.keys(blackwood.evidence || {}).length + " OF 4 MEMORIES" : "YOUR STORY BEGINS HERE"}</small><div class="chapter-actions"><a href="?chapter=blackwood&play=new">NEW STORY &#8599;</a>${blackwood ? '<a href="?chapter=blackwood&play=continue">CONTINUE &#8594;</a>' : "<button disabled>CONTINUE</button>"}</div></article>
<article class="chapter-card cinema" data-chapter="cinema"><button class="chapter-name" aria-pressed="false"><small>CHAPTER 02</small><h2>THE LAST SHOWING</h2></button><p>A closing shift. An empty cinema. One last patron.</p><small class="chapter-progress">${cinema?.completed ? "STORY COMPLETED" : cinema ? "SAVED STORY" : "BELLWETHER CINEMA / ADMIT ONE"}</small><div class="chapter-actions"><a href="?chapter=last-showing&play=new">NEW STORY &#8599;</a>${cinema && !cinema.completed ? '<a href="?chapter=last-showing&play=continue">CONTINUE &#8594;</a>' : "<button disabled>CONTINUE</button>"}</div></article></section><footer><span>HEADPHONES RECOMMENDED</span><span><button id="anthology-settings">SETTINGS</button> / <button id="anthology-credits">CREDITS</button></span></footer>`;
  document.body.append(screen);
  const savesButton = document.createElement("button");
  savesButton.id = "anthology-saves";
  savesButton.textContent = "SAVES";
  savesButton.onclick = () => openSaveMenu(anthologyPanel);
  screen.querySelector("footer > span:last-child").prepend(savesButton, " / ");
  if (window.polaroidDesktop) {
    const quitButton = document.createElement("button");
    quitButton.textContent = "QUIT GAME";
    quitButton.id = "desktop-quit";
    quitButton.onclick = () => window.polaroidDesktop.quit();
    screen.querySelector("footer > span:last-child").append(" / ", quitButton);
  }
  const motelBackground = document.createElement("img");
  motelBackground.dataset.background = "vacancy";
  motelBackground.src = "/chapter-art/vacancy.jpg";
  motelBackground.alt = "";
  screen.querySelector(".menu-backgrounds").append(motelBackground);
  const motelRow = document.createElement("article");
  motelRow.className = "chapter-card vacancy";
  motelRow.dataset.chapter = "vacancy";
  motelRow.innerHTML = `<button class="chapter-name" aria-pressed="false"><small>CHAPTER 03</small><h2>VACANCY</h2></button><p>A roadside motel. A family photograph. A room that disappeared.</p><small class="chapter-progress">${vacancy?.completed ? "STORY COMPLETED" : vacancy ? "SAVED STORY / " + Object.keys(vacancy.evidence || {}).length + " PRINTED DETAILS" : "BRIAR GLEN / YOUR ROOM IS READY"}</small><div class="chapter-actions"><a href="?chapter=vacancy&play=new">NEW STORY &#8599;</a>${vacancy && !vacancy.completed ? '<a href="?chapter=vacancy&play=continue">CONTINUE &#8594;</a>' : "<button disabled>CONTINUE</button>"}</div>`;
  screen.querySelector(".chapter-grid").append(motelRow);
  function selectChapter(id) {
    screen
      .querySelectorAll("[data-background]")
      .forEach((image) =>
        image.classList.toggle("active", image.dataset.background === id),
      );
    screen.querySelectorAll("[data-chapter]").forEach((row) => {
      const selected = row.dataset.chapter === id;
      row.classList.toggle("selected", selected);
      row
        .querySelector(".chapter-name")
        .setAttribute("aria-pressed", String(selected));
    });
    document.querySelector("#menu-location").textContent =
      id === "vacancy"
        ? "BRIAR GLEN MOTOR LODGE / NOVEMBER 1999"
        : id === "cinema"
          ? "BELLWETHER CINEMA / DECEMBER 1998"
          : "BLACKWOOD HOUSE / OCTOBER 1997";
  }
  screen.querySelectorAll("[data-chapter]").forEach((row) => {
    row.addEventListener("pointerenter", () =>
      selectChapter(row.dataset.chapter),
    );
    row.addEventListener("focusin", () => selectChapter(row.dataset.chapter));
    row.querySelector(".chapter-name").onclick = () =>
      selectChapter(row.dataset.chapter);
  });
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
        '<label class="setting">ANALOG PICTURE<input data-setting="retroEffects" type="checkbox" ' +
        (settings.retroEffects !== false ? "checked" : "") +
        '></label><label class="setting">GRAPHICS<select data-setting="quality"><option value="high">High</option><option value="low">Reduced effects</option></select></label><p>Settings are shared by all chapters.</p>',
    );
    document.querySelector('[data-setting="quality"]').value = settings.quality;
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
        }),
    );
  };
  document.querySelector("#anthology-credits").onclick = () =>
    anthologyPanel(
      "STILL / HERE",
      "<p>POLAROID<br>Blackwood House / The Last Showing / Vacancy</p><p>Built with Three.js. Original worlds, camera, character models and portrait artwork. Surface maps include ambientCG materials by Lennart Demes, used under CC0. Shutter and concrete footstep recordings were supplied for POLAROID. The cinema manager is a fictional message voiced using Windows speech synthesis.</p><p>Bellwether Cinema, Briar Glen Motor Lodge and their characters are fictional.</p>",
    );
  screen.querySelectorAll('a[href*="play=new"]').forEach((link) =>
    link.addEventListener("click", (event) => {
      const exists = link.href.includes("blackwood")
        ? blackwood
        : link.href.includes("vacancy")
          ? vacancy
          : cinema;
      if (
        exists &&
        !confirm(
          "Start this story again? Its previous save will be replaced. Your other chapters are unaffected.",
        )
      )
        event.preventDefault();
    }),
  );
}
