const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("polaroidDesktop", {
  fullscreen: () => ipcRenderer.invoke("desktop:fullscreen", false),
  toggleFullscreen: () => ipcRenderer.invoke("desktop:fullscreen", true),
  onFullscreenChanged: (callback) => {
    const handler = (_event, active) => callback(active);
    ipcRenderer.on("desktop:fullscreen-changed", handler);
    return () =>
      ipcRenderer.removeListener("desktop:fullscreen-changed", handler);
  },
  quit: () => ipcRenderer.invoke("desktop:quit"),
});
