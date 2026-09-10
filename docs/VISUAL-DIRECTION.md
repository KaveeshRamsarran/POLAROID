# POLAROID visual direction

The anthology shares a grounded late-1990s horror look: cool night air, warm
practical lighting, restrained contrast and worn domestic surfaces. Fears to
Fathom was the supplied mood reference. No assets or logos from that game are
included. Blackwood remains an old home, Bellwether a burgundy and brass cinema,
and Briar Glen a weathered roadside motel.

## Surfaces and rendering

Six locally bundled ambientCG CC0 materials supply 1024px colour, OpenGL normal
and roughness channels. See [asset provenance](../public/textures/pbr/LICENSE.txt).
Plaster, timber floors and asphalt use the source albedo. Patterned wallpaper,
rugs, bedcovers, upholstery and painted siding retain their authored colours
and patterns with added surface relief. Images are decoded before construction;
missing maps fall back to the procedural surfaces. No runtime CDN is required.
Shader variants for the normal scene and hidden photographic figures are prepared
during loading, and texture uploads are warmed before play.

The analog pass grades shadows cool and practical highlights warm, with slight
edge fringing and highlight spill. Grain opacity is 0.008, and the interface and
inspected prints stay outside the effect. Reduced effects or disabling Analog
picture keeps photographic puzzle layers available.

Night scenery uses instanced cutout foliage and a continuous directional cloud
shader. Motels have warm curtained windows with mullions. The existing playable
boundaries and doorways are retained.

## Figures and animation

Cinema and motel figures share shaped facial geometry with the existing original
portrait textures, fitted jackets, tapered folded sleeves, shirt cuffs, detailed
hands and footwear. Rigid mesh batching keeps elbows, knees, heads and hands
independently articulated. The patron's photographed watch remains its own mesh.
Walking uses travel distance, knee and ankle articulation, stair height and
actual foot contacts; still figures settle into restrained breathing. The
Observer keeps its separate distorted posture and threat behaviour.

The shared camera retains the sculpted continuous grip. A damped handheld pose
eases aiming, walking and the shutter in Chapters 02 and 03. Camera-movement
settings suppress sway and bob. A paused character cannot generate footfalls.

## Frame budget

All chapters use bounded rendering resolution and adapt after sustained load:
high up to 1080px high, medium 900px, reduced 720px, with a 1.25 pixel-ratio cap.
Resolution can fall to 65% of that budget; sustained spare capacity restores it
gradually. Pause, loading gaps and tab stalls do not drive adaptation. HUD and
prints keep their native display resolution.

The cinema and house limit nearby point lights to six; static geometry and rigid
actor parts are merged without merging moving joints, interactive doors or clue
layers. Automatic canvas antialiasing and persistent drawing buffers are disabled;
the analog target provides two-sample antialiasing. Photos are captured directly
after rendering their actual scene. Performance figures and testing limits are
recorded in [VALIDATION](../VALIDATION.md).
