# POLAROID — Vacancy

Chapter 03 takes place at the fictional Briar Glen Motor Lodge in November 1999. Lena Ellis stops for the night after a flooded bridge interrupts her drive home. She is carrying her late father's instant camera. The clerk has already written her name in the register.

## Playing

Select **VACANCY** from the right-hand story list. Hovering or focusing the chapter previews its rendered motel photograph. New Story replaces only Vacancy's progress; Continue restores its own checkpoint. Neither earlier chapter needs to be completed.

Use POLAROID's familiar controls: WASD to walk, mouse or arrows to look, E to interact, C to photograph, right mouse for the viewfinder, F for the flashlight, Shift to run, Ctrl/X to crouch, R to inspect the held print, Q to put it away, and J to open the journal. H repeats the current objective. Esc/P pauses; the pause menu returns to story selection.

The current objective gives one concrete task. Photographs develop over three active seconds. A camera prompt appears when the relevant subject is properly framed and visible. Each clue has a distinct place: a bed, lost-property shelf, diving board, painted wall and final view of the upstairs rooms. The supplied 1974 family print is a separate keepsake, rendered from the chapter's characters; evidence photographs always capture the player's actual scene and viewpoint.

## The motel

Reception and its laundry occupy the low wing on the left. An exterior staircase leads to the upper walkway and Rooms 5 and 6. A connecting bathroom passage provides a second way through those rooms. Room 7 is concealed until its photographic discovery. Ground-floor Rooms 1–4 are visibly closed for the season and are decorative frontage, not additional puzzle rooms.

The courtyard contains Lena's car, marked parking spaces, a drained pool, diving board, outdoor chairs and the lodge sign. Worn cream plaster, dark timber doors, faded green fabric, framed landscapes, brass hardware, warm lamps and cold exterior light use the same material and model vocabulary as the other chapters. The camera, sculpted hand, human character construction, travel-driven gait and restrained analog presentation are shared. The chapter uses original procedural geometry, existing POLAROID facial textures and a new rendered menu image; no outside game's assets were imported.

## Camera and danger rules

- The camera reveals memories associated with the Ellis family's last stay. No reel selection or photograph-placement ritual is needed.
- Evidence requires the correct story stage, distance, framing, facing direction and an unobstructed view. Pressing C through a wall still spends film and produces a real photograph, but awards no clue.
- The night clerk begins his rounds after the laundry discovery. His keys identify his position. He follows valid corridors and stairs, investigates nearby running, and pursues a visible player after a warning.
- Walls and closed doors break sight. The clerk remembers the last sighting or sound rather than tracking an unseen player perfectly. If his route crosses an unlocked closed door, he knocks and waits before opening it.
- A nearby, visible clerk caught in the camera frame is dazzled for four active seconds. The flash is an escape opportunity, not a reset to his starting position.
- Reading a physical note or inspecting a held print leaves the night active. The journal, settings and pause menu freeze it.
- Spare film is available on the reception counter. The supply remains usable when film reaches zero. Death recovery preserves discoveries, gives at least four exposures, moves the clerk back to reception and provides eighteen seconds of grace.

## Spoiler walkthrough

1. Enter reception and ring the counter bell. The clerk gives you Room 6. His familiarity with your father is the first inconsistency.
2. Go upstairs, open Room 6, set your bag on the luggage stand and call Daniel from the bedside telephone. Examine the old family photograph beside it.
3. Photograph the bed. The developed print reveals Evelyn's pale blue suitcase. Your father had told you she left before this holiday.
4. Return downstairs and enter the laundry through reception. Photograph the lost-property shelf. Its tag and the preserved ledger connect Evelyn to Room 7 and the pool. Her name disappears from later entries. The clerk starts his rounds.
5. Photograph the diving board from the far side of the drained pool. A room key appears in the memory and then becomes collectable on the board.
6. Take the key and read the loose 1974 page on the reception counter. Arthur and Lena were in Room 6; Evelyn was in Room 7. Arthur returned repeatedly, but could no longer find the seventh room.
7. Return to Room 6 and photograph the faded rectangle on its right-hand wall. The concealed door becomes visible. Open it with Evelyn's key.
8. Go to the lit writing desk beside Room 7's window. Press E on the letter marked FOR LENA to read it and take Evelyn's locket. The motel was erasing her from memory. Arthur got Lena out while he was forgetting the woman beside him. Evelyn's remaining presence cannot leave with you, but her name and keepsake can.
9. Return to your car, using closed doors, the connecting route and a flash if needed. Upon reaching the car, the night begins to lift. Photograph the upstairs rooms: Evelyn is now visible in the print, watching you leave.
10. Get into the car. Lena calls Daniel and tells him their mother's name. The chapter ends on the final photograph and the unsettling memory of the register, which contained Lena's name before she arrived. Return to POLAROID to see Vacancy marked completed.

The porter's route notice and lost-property book can also be read directly. Discovered records and photographic clues remain in the chapter journal.

## Integration and saves

| Data             | Storage key                            |
| ---------------- | -------------------------------------- |
| Blackwood House  | `polaroid.save.v1` — unchanged         |
| The Last Showing | `polaroid.last-showing.v1` — unchanged |
| Vacancy          | `polaroid.vacancy.v1`, version 1       |
| Shared settings  | `polaroid.settings.v1`                 |

Vacancy saves checkpoint position and view, film, photographs, evidence, items, read records, door states, clerk state, elapsed active time, one-time events and completion. Discoveries and pause/exit create checkpoints. Invalid positions fall back to a safe arrival point. Completing or restarting Vacancy does not write either earlier chapter's save.

Chapter routing remains in `src/entry.js`. Vacancy's world, logic, game loop, sound extensions and small style overrides live in `src/vacancy/`. `src/shared/navigation.js` contains swept collision and route finding with chapter-supplied floors, obstacles and door rules. Cinema's character factory accepts an optional floor function; its existing default is unchanged. Chapter navigation unloads the previous document, disposes scenes/renderers and closes audio.

Important dialogue is presented as readable, persistent text with contextual telephone and mechanical effects. It is not a fully voiced performance. Recorded shutter and footfalls are reused, with softened room footsteps, positional keys, discrete drips and occasional thunder. There is no continuous static bed. Effects, music, volume, sensitivity and graphics settings remain shared.

## Verification and limits

Run `npm test`, `npm run test:vacancy`, `npm run test:vacancy-systems`, `npm run test:vacancy-polish` and `npm run test:anthology`. Browser commands accept a server URL after `--` and use isolated Chrome profiles. The progression test uses checkpoint fixtures between real interactions and scene captures. The polish test starts at Room 7's door, then continuously walks to the letter, back through Room 6, downstairs and to the car, takes the final photograph and reaches the ending without further checkpoint repositioning. It also checks fullscreen entry and exit. These do not establish uninterrupted first-play duration or human scare pacing.

The motel polish adds striped wallpaper, woven carpet and bedcovers, finer asphalt, faded siding and aged pool tile. Guest rooms have televisions, dressers, hanging coats, shoes, towels and bathroom fittings. Reception has key hooks, notices, plants and a clock; the laundry and courtyard have additional working details, fences, gutters, window boxes and pool furniture. Doorways and the escape route remain clear.

Rigid meshes are batched without removing articulated joints, settled doors no longer rebuild collision bounds each frame, and A\* limits route-search work. Six nearby lights and a 900-pixel scene-height cap (720 with reduced effects) bound rendering cost while keeping interface text at native resolution. Photographs synchronize the latest mouse input before validating and rendering their viewpoint. Existing version-1 saves remain usable, including saves made inside Room 7.

`scripts/vacancy-review.mjs` creates environmental review screenshots and refreshes the chapter's menu photograph against Vite. Do not run it while other development-server tests are active: updating the artwork can trigger Vite reloads.
