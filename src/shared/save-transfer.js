export const SAVE_LABELS = Object.freeze({
  "polaroid.save.v1": "Blackwood House",
  "polaroid.last-showing.v1": "The Last Showing",
  "polaroid.vacancy.v1": "Vacancy",
  "polaroid.settings.v1": "Shared settings",
  "polaroid.completed.v1": "Blackwood completion record",
});
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function validateTree(value, depth = 0) {
  if (depth > 32) throw new Error("This save is nested too deeply.");
  if (typeof value === "string" && /[<>"`]/.test(value))
    throw new Error("This save contains unsupported text.");
  if (value && typeof value === "object")
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        throw new Error("This save contains unsupported fields.");
      validateTree(child, depth + 1);
    }
}
export function parseBackup(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > MAX_BACKUP_BYTES
  )
    throw new Error("Choose a POLAROID backup smaller than 16 MB.");
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (
    backup?.format !== "polaroid-backup" ||
    backup.version !== 1 ||
    !record(backup.saves)
  )
    throw new Error(
      "Choose a file created with POLAROID’s Export saves button.",
    );
  const entries = Object.entries(backup.saves);
  if (
    !entries.length ||
    entries.some(([key]) => !Object.hasOwn(SAVE_LABELS, key))
  )
    throw new Error(
      "This backup has no supported saves or includes unknown entries.",
    );
  for (const [key, value] of entries) {
    if (!record(value)) throw new Error("A save entry is damaged.");
    validateTree(value);
    if (key.includes("settings")) {
      const numbers = {
        sensitivity: [0.2, 2],
        master: [0, 1],
        music: [0, 1],
        effects: [0, 1],
        brightness: [0.2, 2],
        fov: [40, 120],
        shake: [0, 1],
      };
      for (const [setting, v] of Object.entries(value)) {
        if (Object.hasOwn(numbers, setting)) {
          if (
            !Number.isFinite(v) ||
            v < numbers[setting][0] ||
            v > numbers[setting][1]
          )
            throw new Error("This backup contains an invalid setting.");
        } else if (setting === "quality") {
          if (!["high", "low"].includes(v))
            throw new Error("Unsupported graphics setting.");
        } else if (
          !["retroEffects", "subtitles", "blur", "visualWarnings"].includes(
            setting,
          ) ||
          typeof v !== "boolean"
        )
          throw new Error("Unsupported setting in this backup.");
      }
    }
    if (
      key.includes("completed") &&
      Object.entries(value).some(
        ([name, complete]) =>
          name !== "blackwood" || typeof complete !== "boolean",
      )
    )
      throw new Error("Invalid completion record.");
    if (!key.includes("settings") && !key.includes("completed")) {
      if (
        value.version !== 1 ||
        !record(value.checkpoint) ||
        !Number.isFinite(value.checkpoint.x) ||
        !Number.isFinite(value.checkpoint.z) ||
        !Array.isArray(value.photos) ||
        !record(value.evidence)
      )
        throw new Error(
          "A chapter save is damaged or uses an unsupported version.",
        );
    }
  }
  return backup;
}
export function exportBackup(storage) {
  const saves = {};
  for (const key of Object.keys(SAVE_LABELS)) {
    const text = storage.getItem(key);
    if (text !== null) saves[key] = JSON.parse(text);
  }
  return JSON.stringify({
    format: "polaroid-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    saves,
  });
}
export function importBackup(
  storage,
  backup,
  selected = Object.keys(backup.saves),
) {
  // Validate the entire file before touching any existing chapter.
  const valid = parseBackup(JSON.stringify(backup));
  const keys = [...new Set(selected)];
  if (!keys.length || keys.some((key) => !Object.hasOwn(valid.saves, key)))
    throw new Error("Select at least one entry in this backup.");
  const previous = keys.map((key) => [key, storage.getItem(key)]);
  try {
    // Release replaced photos first so a full profile can restore its own backup.
    for (const key of keys) storage.removeItem(key);
    for (const key of keys)
      storage.setItem(key, JSON.stringify(valid.saves[key]));
  } catch {
    for (const key of keys) storage.removeItem(key);
    for (const [key, value] of previous)
      if (value !== null) storage.setItem(key, value);
    throw new Error(
      "There is not enough save space. Your existing saves have been restored. Import fewer chapters at once.",
    );
  }
}
