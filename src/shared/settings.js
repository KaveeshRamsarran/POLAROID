export const SETTINGS_KEY = "polaroid.settings.v1";
export function readSettings() {
  const defaults = {
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
    visualWarnings: true,
  };
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"),
    };
  } catch {
    return defaults;
  }
}
