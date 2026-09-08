# Validation

- Production build: passed (`npm run build`).
- Unit tests: 12 passed, covering levels, collision, sight lines, photographic targeting, pathfinding, doors, AI memory, retreat, reaching a detected player, ritual ordering, save restoration, and objectives.
- Browser smoke test: passed; title screen, start, actual photo capture/development, film consumption, and journal; no browser runtime errors.
- Browser systems test: passed; settings persistence, wardrobe entry/exit, film pickup, zero-film emergency recovery, and save/reload.
- Browser progression test: passed; all areas connected by navigable routes, keyboard movement, door opening and collision, four real evidence captures, wrong/correct attic codes, the cellar key, all four ritual frames, blackout, final photograph, walking through the entrance, and ending. This test uses fixture checkpoints between room interactions; it is not a timed uninterrupted human playthrough.
- Browser chase/recovery test: passed; sprint noise, visible pursuit, death after the warning/grace period, and checkpoint restoration preserving evidence.
- Visual review: live menu, first-person hallway, developed photograph, study, mirror, nursery, attic, ritual chamber, hiding, and ending.
- Polish regression: all seven chairs point toward their tables; no overlapping parallel wall volumes; nine rays looking back from both ascending stair flights hit the enclosure; both flights remain clear with doors open; locked attic/cellar openings cannot be bypassed at their edges.
- Audio regression: OfflineAudioContext renders confirm exactly silent idle output, distinct audible wood/tile/concrete/metal footsteps, quieter crouch steps, and silent tails after each finite sound. The continuous noise loop was removed. Sound quality has not been evaluated on the user's speakers.
- Updated visual review: enclosed attic stairwell looking back, dining room chair orientation and wood/plaster materials, and the Observer's revised face and silhouette. Dedicated scene fixtures use extra review lighting to reveal geometry; these are not screenshots of a live chase.

Tests used isolated headless Chrome profiles on this Windows host. A short 1280×800 medium-quality sample measured approximately 10.0 ms median and 10.1 ms p95 frame intervals. This is a local sample, not a cross-hardware performance guarantee. The requested 25–45-minute first-play duration has not been established by human playtesting.

Evidence screenshots are available in `artifacts/`. Test commands and controls are documented in `README.md`.
