# POLAROID

![POLAROID — Blackwood House](artifacts/menu.png)

A playable first-person psychological horror game built for desktop browsers. Its visual direction follows the supplied reference: damp green walls, exposed pipes, rusted doors, worn surfaces, cold fluorescent lighting, and deep shadows.

## Play

The supplied standalone build can be started with **Start-Polaroid.cmd** on Windows, or `node play.mjs` on any platform with Node.js installed. Open **http://127.0.0.1:3000**. The standalone build needs no package installation.

Requires Node.js 22.12+ (Node.js 24 recommended) and a desktop browser with WebGL and hardware acceleration.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:3000**. Click **New Game** to enable sound and mouse capture. When browser mouse capture is unavailable, drag to look or use the arrow keys. All game assets are local; gameplay makes no network requests.

```sh
npm run build
npm run preview
```

The production build is in `dist/`. Serve that directory over HTTP; opening `index.html` directly as a file will not load its modules.

## Controls

| Action                    | Input                               |
| ------------------------- | ----------------------------------- |
| Move                      | W A S D                             |
| Look                      | Mouse, drag, or arrow keys          |
| Sprint                    | Hold Shift                          |
| Crouch                    | Ctrl or X                           |
| Open, collect, read, hide | E                                   |
| Photograph                | C or left click with mouse captured |
| Viewfinder                | Hold right mouse                    |
| Flashlight                | F                                   |
| Inspect / tilt held print | R / mouse                           |
| Put print away            | Q                                   |
| Journal                   | J or Tab                            |
| Recall objective          | H                                   |
| Pause                     | Esc or P                            |

## What is playable

- A connected house of twenty areas: a central hall with six rooms off it, a west wing of conservatory, library and laundry, an east wing of parlour and gallery, two upstairs bedrooms with a guest room and bathroom behind them, working staircases, an attic, a basement workshop, ritual chamber and cold store, and an exterior porch. Room loops offer alternate escape routes.
- Real scene photographs with a four-second development period, hidden supernatural figures, an inspectable physical print, and a persistent photograph journal.
- Four evidence photographs, a randomized attic combination, a hidden cellar key, four ritual frames, a blackout, a hunted return to the entrance, the final photograph, and a walkable escape into the storm.
- An Observer with dormant, watching, investigating, searching, stalking, chasing, and retreating states. It uses spatial routes, obstruction-aware vision, sound events, last-known-position memory, and a detection warning before catching the player.
- Physical doors, light switches, hiding wardrobes, sprinting, crouching, a forgiving flashlight battery, eight starting exposures, seven film packs, and an emergency film reserve.
- A recorded camera shutter and recorded footsteps, synthesized positional sound elsewhere, storm lighting, rain, environmental disturbances with cooldowns, animated curtains and candle flames, procedural materials, and a modeled handheld camera.
- Separate colour, normal, and roughness textures for worn plaster, floorboards, glazed tile, bare concrete, metal, fabric, and skin: staggered boards with their own grain and knots, bevelled tiles with grout and crazing, troweled concrete with hairline cracks, and plaster with damp streaks. Wall, board, tile, and concrete maps are 1024², and lights occasionally fail.
- Furniture that sits where furniture sits: wardrobes, couches, dressers, bookcases, shelving, radiators and beds set flush against their walls and turned to face into the room. Rooms are dressed with armchairs, sideboards, hearths, plants, crates, trunks, tubs and framed photographs.
- Interior doors at a believable 1.05 m with lapped casings, wider 1.15 m leaves on the entrance, attic and cellar, and open 1.5 m archways between paired rooms.
- Enclosed stairwells, corrected wall joins and trim, fitted locked door openings, and chairs facing their tables.
- Quiet exploration without looping static, surface-specific footsteps cut from a single concrete walk recording and voiced per floor, quieter crouching, heavier running, mechanical door sounds, short room reflections, and positional Observer breathing and steps muffled through walls.
- Checkpoints after evidence, keys, puzzle progress, and ritual steps. Journal images and settings persist in browser local storage.
- Unlettered doors and a continuous sculpted camera-holding hand with five tapered digits, nails, knuckle detail, skin variation, and a fitted sleeve cuff.
- An articulated Observer gait driven by actual travel, with bending knees and elbows, foot lift and placement, body sway, smooth turns, idle transitions, a faster chase stride, and footsteps triggered by foot contact.

This is a compact browser interpretation of the brief. Environments and characters use procedural geometry and materials; the camera shutter and footsteps are supplied recordings and the rest of the audio is synthesized. The hand is procedurally sculpted and the Observer uses an articulated joint hierarchy. It does not include scanned photorealistic assets, motion-capture animation, or a verified 25–45-minute first-play duration. Additional clock puzzles and the full list of optional room types are not implemented.

## Verification

```sh
npm test
npm run test:smoke
npm run test:systems
npm run test:progression
npm run test:death
npm run test:polish
npm run test:characters
```

Browser tests require the development server and an installed Google Chrome. They create isolated browser profiles and do not use or modify your normal browser data.

The character test also requires Vite. It checks the actual hand and Observer joint hierarchies, door lettering removal, foot clearance, walking/chase contacts, and settling to idle; it saves hand close-ups and walking poses to `artifacts/`.

Pass an alternate server URL after `--`, for example `npm run test:polish -- http://127.0.0.1:3102`. The polish test needs the Vite development server: it builds an isolated scene to check chair orientation, overlapping walls, stair enclosure sightlines, clear stair routes, and locked door openings. Offline Web Audio rendering verifies that both recordings decode, that the walk recording splits into separate footfalls, and that footstep surfaces stay audible and distinct, with reduced crouch volume and silence at idle and after sound effects end. Its review screenshots are in `artifacts/polish-*.png`.

The unit suite checks stairs, collision, sight lines, photographic targeting, paths around obstacles, doors, AI memory and retreat, ritual order, saves, and objectives. Browser tests check rendering, camera development, actual keyboard movement, doors, hiding, film recovery, settings, persistence, all four evidence captures, the lock, key, ritual, exterior escape, and checkpoint recovery after death. The progression suite uses fixture checkpoints between rooms to test the complete chain without a long traversal; a separate route check verifies connectivity to all areas.

Screenshots are saved to `artifacts/`. Performance samples are local test measurements, not a guarantee across hardware.

## Source

- `src/main.js`: renderer, controls, camera capture, menus, journal, progression, saves.
- `src/world.js`: architecture, geometry, procedural materials, lighting, and environmental details.
- `src/hand.js`: continuous hand surface, grip anatomy, nails, folds, and sleeve.
- `src/observer-animation.js`: travel-driven walking, leg inverse kinematics, turning, and foot contacts.
- `src/materials.js`: procedural colour, normal, and roughness maps for plaster, boards, tile, concrete, metal, fabric and skin, tiling seamlessly at three world units.
- `src/logic.js`: navigation, collision, evidence rules, state, and Observer AI.
- `src/audio.js`: Web Audio spatial effects and ambience, recorded-sample loading, and footstep slicing.
- `src/sfx/`: the supplied camera shutter and concrete walk recordings.
- `src/style.css`: title screen, HUD, printed photographs, and journal.

Three.js is distributed under the MIT license. Vite and Playwright are development dependencies. POLAROID is a fictional game project and is not affiliated with Polaroid Corporation.

Original ideas for subsequent episodes are in [the anthology concept notes](docs/ANTHOLOGY.md).
