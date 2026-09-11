const {
  app,
  BrowserWindow,
  Menu,
  protocol,
  net,
  session,
  ipcMain,
  dialog,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { isGameURL, assetPath } = require("./paths.cjs");

app.setName("POLAROID");
app.setPath(
  "userData",
  process.env.POLAROID_TEST_PROFILE ||
    path.join(app.getPath("appData"), "POLAROID"),
);
protocol.registerSchemesAsPrivileged([
  {
    scheme: "polaroid",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);
const testing = !!process.env.POLAROID_TEST_PROFILE;
let window;
if (!testing && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      app.setAppUserModelId("com.stillhere.polaroid");
      Menu.setApplicationMenu(null);
      const root = path.join(app.getAppPath(), "dist");
      protocol.handle("polaroid", async (request) => {
        const file = assetPath(root, request.url);
        if (!file || !["GET", "HEAD"].includes(request.method))
          return new Response("Not found", { status: 404 });
        try {
          const response = await net.fetch(pathToFileURL(file).href);
          const headers = new Headers(response.headers);
          headers.set(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'",
          );
          headers.set("X-Content-Type-Options", "nosniff");
          return new Response(
            request.method === "HEAD" ? null : response.body,
            { status: response.status, headers },
          );
        } catch {
          return new Response("Not found", { status: 404 });
        }
      });
      // The bundled game is completely offline; no renderer request can leave it.
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
        (_details, callback) => callback({ cancel: true }),
      );
      const allowed = (permission, origin) =>
        isGameURL(origin) && ["pointerLock", "fullscreen"].includes(permission);
      session.defaultSession.setPermissionRequestHandler(
        (contents, permission, callback) =>
          callback(allowed(permission, contents?.getURL())),
      );
      session.defaultSession.setPermissionCheckHandler(
        (_contents, permission, origin) => allowed(permission, origin),
      );
      window = new BrowserWindow({
        title: "POLAROID",
        width: 1440,
        height: 900,
        minWidth: 960,
        minHeight: 600,
        backgroundColor: "#101510",
        show: false,
        autoHideMenuBar: true,
        icon: path.join(__dirname, "icon.png"),
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          webSecurity: true,
          devTools: testing || !app.isPackaged,
        },
      });
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, url) => {
        if (!isGameURL(url)) event.preventDefault();
      });
      window.webContents.on("will-redirect", (event, url) => {
        if (!isGameURL(url)) event.preventDefault();
      });
      window.webContents.on("will-attach-webview", (event) =>
        event.preventDefault(),
      );
      const trusted = (event) =>
        event.sender === window.webContents &&
        event.senderFrame === window.webContents.mainFrame &&
        isGameURL(event.senderFrame.url);
      const toggleFullscreen = () => {
        const active = !window.isFullScreen();
        window.setFullScreen(active);
        window.webContents.send("desktop:fullscreen-changed", active);
        return active;
      };
      ipcMain.handle("desktop:fullscreen", (event, toggle) => {
        if (!trusted(event)) throw new Error("Unavailable");
        if (toggle === true) return toggleFullscreen();
        return window.isFullScreen();
      });
      ipcMain.handle("desktop:quit", (event) => {
        if (trusted(event)) window.close();
      });
      for (const event of ["enter-full-screen", "leave-full-screen"])
        window.on(event, () =>
          window.webContents.send(
            "desktop:fullscreen-changed",
            window.isFullScreen(),
          ),
        );
      window.webContents.on("before-input-event", (event, input) => {
        if (
          input.type === "keyDown" &&
          !input.isAutoRepeat &&
          (input.key === "F11" || (input.alt && input.key === "Enter"))
        ) {
          event.preventDefault();
          toggleFullscreen();
        }
      });
      window.once("ready-to-show", () => {
        if (!process.env.POLAROID_TEST_HIDDEN) window.show();
      });
      window.on("closed", () => {
        window = null;
      });
      await window.loadURL("polaroid://game/");
      // Also show after navigation: custom protocols do not always emit the
      // first-paint event on Windows before a hidden window is made visible.
      if (!process.env.POLAROID_TEST_HIDDEN) window.show();
    })
    .catch((error) => {
      dialog.showErrorBox("POLAROID could not start", error.message);
      app.quit();
    });
  // Existing chapter beforeunload handlers save before the window is destroyed.
  app.on("window-all-closed", () => {
    session.defaultSession.flushStorageData();
    app.quit();
  });
}
