# POLAROID — The Last Showing

Chapter 02 lives in the same application as Blackwood House. Open POLAROID, choose a story, then enter it to enable mouse capture and audio. Either chapter can be started independently. The pause menu returns to story selection.

Bellwether Cinema, December 1998. A temporary worker photographs damaged equipment and clears a closing checklist. The printer issues an admission for a screening nobody has booked. A patron appears in the developing print.

## Playing

Use the familiar camera, viewfinder, flashlight, movement and journal controls. Camera film is limited; the survey case at the lobby counter supplies eight emergency exposures when fewer than four remain. Ordinary, non-evidence prints can be discarded from the journal.

The manager's recording and checklist introduce the building. Read the row letters on the side walls and seat numbers on the chair backs. The enlarged foyer separates ticketing, a furnished waiting area and concessions. Hinged double doors lead to the auditorium; labelled staff doors connect the other routes. The archive is reached through the west service passage; the projection booth is upstairs on the east side of the lobby. Seats face the screen. The booth window looks across the auditorium.

The projector has five states: running, stopped, exhausted, jammed, and power unavailable. Its mechanical loop plays only while running. Reels warn at 35 seconds. A jam takes four seconds to repair and automatically restarts the motor. Loading a reel takes three seconds; rewinding takes five. Stay beside the projector until it restarts. A tripped service breaker restores power; the motor must still be restarted upstairs.

After the first discovery, the patron moves only in the silence. Restarting the motor holds its existing position. It can follow aisles, corridors and stairs and open unlocked internal doors. Its footsteps originate at its position. The initial seated figure is visible only in photographs; an awakened patron becomes physically visible at close range.

Projector controls, physical documents and held-print inspection do **not** pause the story. Escape/P, the pause button and the journal pause timers and movement. Leaving the browser tab also pauses. A restored checkpoint gives an 18-second grace period; the first scripted jam provides its own distant starting position.

The 20–35 minute duration is a design target. Automated verification does not establish first-play duration, scare effectiveness, or speaker/headphone balance.

## Spoiler walkthrough

### The people Bellwether remembers

The optional records connect the patron with Thomas Avery, a Friday regular who reserved F8 and the neighbouring seat for his daughter Ruth. He repaired the foyer clock and wore a coat with pale stitching at the right cuff. During the 1978 incident, Ada led Ruth through the service passage; Avery returned for the people still waiting for the film to restart. Ruth survived and continued asking for his belongings. The recurring patron retains the same repair across memory layers, although the game leaves the exact nature of that recurrence unresolved.

The physical records include the closing notice and reservation book on the lobby counter, lost property at concessions, Ada's shift book on the upstairs workbench, Ruth's letter at the archive table, and a witness copy on the passage maintenance board. Collected text is preserved under **Found records** in the journal. The coat and incident records from existing saves appear there automatically. A close, correctly framed photograph of the patron's visible watch and cuff adds another optional detail.

These discoveries add context without introducing extra locks, combinations or mandatory errands. The core route below still works without them. Reading a physical document remains active gameplay; the journal pauses it.

### Main route

1. Listen to the recorder at the ticket counter. Photograph the torn cushion on D3 from the front, then photograph the projector upstairs. The journal lists only these three survey tasks.
2. Take the ticket from the lobby printer. Photograph F8 while the opening reel runs. Inspect the coat, return upstairs, and choose REPAIR & RESTART. The patron moves during the silence and stops wherever it is when projection resumes.
3. Follow STAFF ONLY from the lobby to FILM ARCHIVE. Collect the 1978 reel, survey print and records together at the archive table. Return upstairs and select PLAY: INCIDENT REEL.
4. Take two clue photographs with that reel running: the painted-over exit beside the red EXIT sign in the service passage, and Ada's key from beside her in BACKSTAGE. The viewfinder and a C prompt help confirm clear framing; walls and closed doors still block evidence.
5. Take the missing section from the drawer labelled A. BELL at the back of the archive. There is no number code. Comparing other reels and catching the splice leader are optional details, not gates.
6. Assemble the film at the upstairs workbench. Start the complete screening, then go downstairs through STAFF ONLY and open the service exit within three minutes. No extra evacuation photograph is required. Rewind upstairs if needed.
7. Wait for the patron to walk outside, photograph it through the open exit, and step out. Return to POLAROID with this chapter marked completed.

An optional late non-evidence exposure after finding the splice can show the back of the player's head. It is explicitly labelled as an impossible exposure: the building is now preserving the worker in its screening. It grants no puzzle evidence. Ordinary photographs always render the player's camera and the active memory layer.

## Save and integration contract

| Data                        | Browser storage key                                     |
| --------------------------- | ------------------------------------------------------- |
| Blackwood House             | `polaroid.save.v1` — unchanged schema and normalization |
| The Last Showing            | `polaroid.last-showing.v1` — schema version 1           |
| Shared settings             | `polaroid.settings.v1`                                  |
| Blackwood completion marker | `polaroid.completed.v1`                                 |

Cinema saves contain the checkpoint, film, actual JPEG prints, evidence references, owned reels, active reel, remaining projector time, projector state, patron position/progression, important doors, checklist, collected items, elapsed story time and one-shot event flags. New Story resets only the selected chapter. Completing a chapter does not reset the other.

Chapter selection routes through `src/entry.js`. Each chapter loads its own module and navigates back through the same document/application. Document navigation plus `pagehide` disposal releases the old renderer, scene resources and audio context. Browser-back restoration reloads disposed scenes. No second application or second renderer remains running behind selection.

Shared modules provide materials, camera and hand, model helpers, terrain-aware character gait, renderer setup and settings. Blackwood's world, puzzles, Observer AI and save normalization remain chapter-local. The cinema has separate world construction, pure projector/story/navigation rules, audio and gameplay orchestration in `src/cinema/`.

Photographic evidence checks active reel, the square capture frame, range, target viewpoint where relevant, and raycast occlusion by walls, doors and seats. The screen clue also checks its visible frame interval. Memory figures are rendered into the scene for the exposure, then hidden again. Saved prints are captured pixels, not generic clue images.

## Audio and artwork

The chapters share the supplied recorded camera shutter and concrete footstep recording. Cinema carpet footsteps filter the recording; stairs use its metallic voicing. The projector loop and short mechanisms are synthesized mechanical sounds without a continuous static layer. The fictional manager's local WAV was generated with the installed Windows speech voice. Chapter-selection images are screenshots rendered from the game, generated by `scripts/chapter-art.mjs`. The full-screen menu lists the two stories on the right; hover, keyboard focus or a tap changes its background. Grain opacity is 0.015 on high and zero with reduced effects.

## Verification commands

Run `npm test`, `npm run build`, then serve the build with `node play.mjs 3001`.

```sh
node scripts/cinema.mjs http://127.0.0.1:3001
node scripts/cinema-systems.mjs http://127.0.0.1:3001
node scripts/cinema-routes.mjs http://127.0.0.1:3001
node scripts/cinema-presentation.mjs http://127.0.0.1:3001
node scripts/cinema-photos.mjs http://127.0.0.1:3001
node scripts/cinema-expansion.mjs http://127.0.0.1:3001
node scripts/anthology.mjs http://127.0.0.1:3001
node scripts/progression.mjs http://127.0.0.1:3001
node scripts/death.mjs http://127.0.0.1:3001
```

The cinema progression script uses isolated saved-checkpoint position fixtures between real interactions and real rendered photographic captures. It verifies the full puzzle/ending chain; it is not an uninterrupted human walk. Route and threat tests separately cover physical navigation, stairs, closed doors, pause, failure and recovery. Existing Blackwood browser tests now explicitly select its chapter route.
