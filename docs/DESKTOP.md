# POLAROID for Windows

The Electron edition contains the same three playable chapters and local assets as the browser game. It runs offline in its own window. Players do not need Node.js, Chrome, a web server or a separate download of the assets.

## Play

Use either build from `release/`:

- **POLAROID-1.0.0-Windows-Portable.exe**: double-click to play without installing. Initial startup includes extraction of the bundled runtime.
- **POLAROID-1.0.0-Windows-Setup.exe**: install for your Windows account, choose a location, and launch from the desktop or Start menu shortcut.

These builds target Windows x64. Keep hardware acceleration available and use **Reduced effects** in Settings if your GPU struggles. The app retains the browser version's adaptive resolution and rendering optimizations. Performance still depends on hardware.

Use the fullscreen button, **F11**, or **Alt+Enter** to toggle fullscreen. **Esc/P** pauses gameplay. Return to story selection from the pause menu; **Quit game** closes the desktop application. Closing the window also invokes the existing chapter save handler.

The current builds are unsigned; Windows may show an unrecognized-publisher prompt. Public releases can be code-signed when a publisher certificate is available. No auto-updater or network dependency is included.

## Save progress and move browser saves

The app uses a stable `polaroid://game/` origin with its own profile at **`%APPDATA%\POLAROID`**. Saves and photographs persist between launches and updates. Portable and installed copies use this same Windows account profile; "portable" means no installation, not that saves travel beside the executable. Uninstalling does not deliberately remove this profile.

Browser progress stays in its original browser profile and is not read automatically. To transfer it:

1. Open the updated browser game at the **same address, port and browser profile** you previously used (for example `http://127.0.0.1:3001`).
2. In story selection choose **Saves → Export saves**, and keep the downloaded JSON file.
3. Open the desktop game. Choose **Saves → Import saves** and select that file.
4. Review the chapter/settings entries, uncheck anything you want to keep unchanged, then choose **Restore selected saves**.

Export works in the desktop edition too. Back up the destination first if you want to retain both versions of its progress. Only selected entries are replaced. Invalid files are rejected before writing; a storage-space failure restores the replaced entries. Photographs are included, with a 16 MB import limit. The existing `polaroid.save.v1`, `polaroid.last-showing.v1`, `polaroid.vacancy.v1`, settings and completion keys are unchanged.

## Develop and build

Use Node.js **22.12+** (24 recommended). From the repository:

```sh
npm ci
npm exec -- install-electron --no
npm run desktop
```

The runtime installer downloads Electron if needed. `npm run desktop` builds the browser assets and launches the desktop shell. The browser's `npm run dev`, `npm run build`, `node play.mjs` and `Start-Polaroid.cmd` still work.

```sh
npm run desktop:pack
npm run desktop:dist
```

`desktop:pack` creates `release/win-unpacked/POLAROID.exe` for testing. `desktop:dist` creates both the portable executable and NSIS installer, with publishing explicitly disabled. The first packaging run needs internet access for Electron and Windows packaging helpers; playing does not. Run Windows packaging on Windows.

The build includes only `dist/`, the desktop shell and application metadata in an ASAR archive. Source tests and development dependencies are excluded. Release executables are ignored by Git; distribute them as downloadable release assets rather than adding binaries over 100 MB to repository history. No release is uploaded by these commands.

## Verification

```sh
npm test
npm run build
npm run test:desktop
node scripts/desktop.mjs release/win-unpacked/POLAROID.exe
node scripts/portable.mjs
node scripts/save-transfer.mjs http://127.0.0.1:3001
```

Desktop tests use separate profiles under ignored `artifacts/`, not your game saves. They open the actual app window and exercise all chapters, pointer lock, captures, fullscreen, save isolation, export/import and persistence across native close/relaunch. Measurements and screenshots are written to `artifacts/`. Existing browser gameplay regressions remain available.

The portable test attaches to a temporary loopback debugging port because its extraction wrapper does not forward the Electron inspector pipe. Normal player launches do not enable that port. The NSIS installer is built alongside the tested portable and unpacked application; installation/uninstallation on a clean Windows machine still needs a release check.

## Desktop boundaries

The renderer is sandboxed with context isolation and no Node integration. A custom protocol serves bundled files with path validation and a content security policy. External web requests, popups and navigation are blocked. The preload exposes only fullscreen state/toggle and quit; IPC checks its sender. File import/export requires the player's explicit file-selection/download gesture. Application icons derive from the existing POLAROID favicon; Electron's runtime licenses remain in the packaged distribution.
