// One control across the anthology and all chapters. Fullscreen requires a
// direct player gesture; changing chapters never enters it automatically.
const button = document.createElement("button");
button.id = "fullscreen-button";
button.type = "button";
document.body.append(button);
function refresh() {
  const active = !!document.fullscreenElement;
  button.textContent = active ? "↙ EXIT FULLSCREEN" : "↗ FULLSCREEN";
  button.setAttribute(
    "aria-label",
    active ? "Exit fullscreen" : "Enter fullscreen",
  );
  button.setAttribute("aria-pressed", String(active));
  button.disabled = !document.fullscreenEnabled;
  button.title = document.fullscreenEnabled
    ? ""
    : "Fullscreen is unavailable in this browser";
}
button.onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    button.title =
      "Could not enter fullscreen. You can also use your browser’s F11 shortcut.";
  }
  refresh();
};
document.addEventListener("fullscreenchange", refresh);
refresh();
