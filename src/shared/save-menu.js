import {
  SAVE_LABELS,
  MAX_BACKUP_BYTES,
  exportBackup,
  parseBackup,
  importBackup,
} from "./save-transfer.js";

export function openSaveMenu(panel) {
  panel(
    "YOUR SAVES",
    `<p>Bring your browser progress into the desktop game, or keep a backup of your stories and photographs.</p><p>In the version with your progress, choose <b>Export saves</b>. Open this screen in the other version and choose <b>Import saves</b>.</p><div class="save-transfer-actions"><button id="export-saves" class="filled-button">EXPORT SAVES</button><button id="choose-saves">IMPORT SAVES</button></div><input id="save-file" type="file" accept=".json,application/json" hidden><div id="save-preview"></div><p id="save-status" role="status" aria-live="polite"></p>`,
  );
  const status = document.querySelector("#save-status");
  document.querySelector("#export-saves").onclick = () => {
    try {
      const text = exportBackup(localStorage);
      if (!Object.keys(JSON.parse(text).saves).length) {
        status.textContent = "There are no saves to export yet.";
        return;
      }
      const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `POLAROID-saves-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent =
        "Save backup requested. Keep the downloaded JSON file to import it later.";
    } catch {
      status.textContent =
        "A stored save could not be read. Your current saves have not changed.";
    }
  };
  const file = document.querySelector("#save-file");
  document.querySelector("#choose-saves").onclick = () => file.click();
  file.onchange = async () => {
    const preview = document.querySelector("#save-preview");
    preview.replaceChildren();
    status.textContent = "";
    try {
      if (!file.files[0]) return;
      if (file.files[0].size > MAX_BACKUP_BYTES)
        throw new Error("Choose a backup smaller than 16 MB.");
      const backup = parseBackup(await file.files[0].text());
      const notice = document.createElement("p");
      notice.textContent =
        "Choose what to restore. Checked entries replace the corresponding progress here. Export your current saves first if you want to keep both versions.";
      preview.append(notice);
      const choices = Object.keys(backup.saves).map((key) => {
        const label = document.createElement("label");
        label.className = "setting";
        label.textContent = `${SAVE_LABELS[key]}${localStorage.getItem(key) ? " (replace existing)" : " (new)"} `;
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = true;
        input.value = key;
        label.append(input);
        preview.append(label);
        return input;
      });
      const restore = document.createElement("button");
      restore.className = "filled-button";
      restore.textContent = "RESTORE SELECTED SAVES";
      restore.onclick = () => {
        try {
          importBackup(
            localStorage,
            backup,
            choices
              .filter((input) => input.checked)
              .map((input) => input.value),
          );
          location.reload();
        } catch (error) {
          status.textContent = error.message;
        }
      };
      preview.append(restore);
    } catch (error) {
      status.textContent = error.message;
    }
    file.value = "";
  };
}
