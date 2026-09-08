# POLAROID — The Last Showing

Chapter 02 lives in the same application as Blackwood House. Open POLAROID, choose a story, then enter it to enable mouse capture and audio. Either chapter can be started independently. The pause menu returns to story selection.

Bellwether Cinema, November 1998. A temporary worker photographs damaged equipment and clears a closing checklist. The printer issues an admission for a screening nobody has booked. A patron appears in the developing print.

## Playing

Use the familiar camera, viewfinder, flashlight, movement and journal controls. Camera film is limited; the survey case at the lobby counter supplies eight emergency exposures when fewer than four remain. Ordinary, non-evidence prints can be discarded from the journal.

The manager's recording and closing book introduce the building. Read the row letters on the side walls and seat numbers on the chair backs. The archive is reached through the west service passage; the projection booth is upstairs on the east side of the lobby. Seats face the screen. The booth window looks across the auditorium.

The projector has five states: running, stopped, exhausted, jammed, and power unavailable. Its mechanical loop plays only while running. Reels warn at 35 seconds. A jam requires a four-second repair beside the equipment and a separate motor restart. Rewinding takes five seconds and stops the motor. A tripped service breaker restores power; the motor must still be restarted upstairs.

After the first discovery, the patron moves only in the silence. Restarting the motor holds its existing position. It can follow aisles, corridors and stairs and open the unlocked booth door. Its footsteps originate at its position. The initial seated figure is visible only in photographs; an awakened patron becomes physically visible at close range.

Projector controls, physical documents and held-print inspection do **not** pause the story. Escape/P, the pause button and the journal pause timers and movement. Leaving the browser tab also pauses. A restored checkpoint gives an 18-second grace period; the first scripted jam provides its own distant starting position.

The 20–35 minute duration is a design target. Automated verification does not establish first-play duration, scare effectiveness, or speaker/headphone balance.

## Spoiler walkthrough

1. Listen to the lobby recording; catalogue the belongings at concessions; photograph the torn cushion on D3 from its front and the equipment in the booth; inspect the sealed service exit; sort archive cans.
2. Collect the new ticket from the lobby printer. Photograph F8 with the opening reel running. Examine the coat that appears. Return to the booth, repair the loose film loop, and restart the motor.
3. Photograph the patron under both the 1959 Opening Night and 1979 Reopening reels. Other audience members belong to their own screenings. The recurring patron remains where projection arrested it.
4. Read the maintenance record and incident report in the archive. Examine the old survey print in the service passage. Load and start the incomplete 1978 reel.
5. Photograph the sealed wall from the brass survey mark. Photograph Ada from the auditorium's front service opening, then enter backstage and look at her hand from the side. It holds a service key, not a film can.
6. Photograph the screen when the repeating archive leader shows **SPLICE 17**. The frame remains visible for four seconds each fourteen-second cycle. It repeats if missed.
7. The recurring ticket identifies seat **08**. The splice reference is **17**. The filing note specifies seat first, splice second. Enter **0817** on the archive drawer and collect the missing section.
8. Assemble the reel at the booth bench and start the complete screening. It runs for 150 seconds. Leave the booth, photograph the complete evacuation memory in the backstage service passage, and release the revealed service exit. If projection expires before the latch opens, return and rewind; the story remains recoverable.
9. The released patron follows the real route outside. Photograph it through the open service exit, then step onto the exterior landing. The chapter is marked completed. Return to POLAROID's story selection.

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

The chapters share the supplied recorded camera shutter and concrete footstep recording. Cinema carpet footsteps filter the recording; stairs use its metallic voicing. The projector loop and short mechanisms are synthesized mechanical sounds without a continuous static layer. The fictional manager's local WAV was generated with the installed Windows speech voice. Chapter-selection images are screenshots rendered from the game, generated by `scripts/chapter-art.mjs`.

## Verification commands

Run `npm test`, `npm run build`, then serve the build with `node play.mjs 3001`.

```sh
node scripts/cinema.mjs http://127.0.0.1:3001
node scripts/cinema-systems.mjs http://127.0.0.1:3001
node scripts/cinema-routes.mjs http://127.0.0.1:3001
node scripts/cinema-photos.mjs http://127.0.0.1:3001
node scripts/anthology.mjs http://127.0.0.1:3001
node scripts/progression.mjs http://127.0.0.1:3001
node scripts/death.mjs http://127.0.0.1:3001
```

The cinema progression script uses isolated saved-checkpoint position fixtures between real interactions and real rendered photographic captures. It verifies the full puzzle/ending chain; it is not an uninterrupted human walk. Route and threat tests separately cover physical navigation, stairs, closed doors, pause, failure and recovery. Existing Blackwood browser tests now explicitly select its chapter route.
