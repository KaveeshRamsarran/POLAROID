import * as THREE from "three";
import { createFrameBudget } from "./render-budget.js";

// Scene-only treatment: HUD, clues and photograph inspection stay legible.
// A small HDR target keeps soft highlights without clipping lamp emissions.
export function createAnalogPresentation(renderer) {
  const budget = createFrameBudget();
  let settingsState = {},
    lastRatio = 0;
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    samples: 2,
  });
  const size = new THREE.Vector2();
  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      picture: { value: target.texture },
      resolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `
      uniform sampler2D picture;
      uniform vec2 resolution;
      varying vec2 vUv;
      #include <common>
      void main() {
        vec2 pixel=1.0/resolution;
        vec2 centre=vUv-.5;
        float edge=smoothstep(.12,.5,length(centre));
        vec2 fringe=vec2(pixel.x*.32*edge,0.);
        vec3 colour=texture2D(picture,vUv).rgb;
        colour.r=mix(colour.r,texture2D(picture,vUv+fringe).r,.35);
        colour.b=mix(colour.b,texture2D(picture,vUv-fringe).b,.35);
        vec3 halo=vec3(0.);
        halo+=max(texture2D(picture,vUv+vec2(pixel.x*2.,0.)).rgb-1.1,0.);
        halo+=max(texture2D(picture,vUv-vec2(pixel.x*2.,0.)).rgb-1.1,0.);
        halo+=max(texture2D(picture,vUv+vec2(0.,pixel.y*2.)).rgb-1.1,0.);
        halo+=max(texture2D(picture,vUv-vec2(0.,pixel.y*2.)).rgb-1.1,0.);
        colour+=halo*.012;
        float luma=dot(colour,vec3(.2126,.7152,.0722));
        colour=mix(vec3(luma),colour,.82);
        colour*=mix(vec3(.87,.96,1.10),vec3(1.055,1.015,.93),smoothstep(.04,.65,luma));
        gl_FragColor=vec4(colour,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        // A small cool lift keeps unlit spaces readable without brightening lamps.
        gl_FragColor.rgb+=vec3(.003,.004,.006)*(1.-smoothstep(.0,.25,luma));
      }`,
  });
  const screen = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  screen.add(quad);
  const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let enabled = true;
  function configure(settings) {
    settingsState = settings;
    budget.reset();
    lastRatio = 0;
    enabled = settings.quality !== "low" && settings.retroEffects !== false;
    document.body.classList.toggle("analog-picture", enabled);
    const grain = document.querySelector("#grain");
    if (grain) grain.style.opacity = enabled ? ".008" : "0";
  }
  function adapt(milliseconds, active = true) {
    const scale = budget.sample(milliseconds, active);
    const cap =
      settingsState.quality === "low"
        ? 720
        : settingsState.quality === "high"
          ? 1080
          : 900;
    const ratio = Math.min(devicePixelRatio, 1.25, cap / innerHeight) * scale;
    if (Math.abs(ratio - lastRatio) > 0.005) {
      renderer.setPixelRatio(ratio);
      lastRatio = ratio;
    }
    return { scale, ratio };
  }
  function render(scene, camera, weaponScene, weaponCamera) {
    const previousTarget = renderer.getRenderTarget();
    const previousClear = renderer.autoClear;
    if (enabled) {
      renderer.getDrawingBufferSize(size);
      const scale = Math.min(
        1,
        (settingsState.quality === "high" ? 1080 : 900) / size.y,
      );
      const width = Math.max(1, Math.round(size.x * scale)),
        height = Math.max(1, Math.round(size.y * scale));
      if (target.width !== width || target.height !== height) {
        target.setSize(width, height);
        material.uniforms.resolution.value.set(width, height);
      }
      renderer.setRenderTarget(target);
    }
    renderer.autoClear = true;
    renderer.render(scene, camera);
    if (weaponScene) {
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(weaponScene, weaponCamera);
    }
    if (enabled) {
      renderer.setRenderTarget(previousTarget);
      renderer.autoClear = true;
      renderer.render(screen, screenCamera);
    }
    renderer.autoClear = previousClear;
  }
  async function prepare(scene, camera, weaponScene, weaponCamera) {
    // Compile even hidden photographic figures during loading, for both the
    // direct capture and graded presentation paths. Avoid a first-flash stall.
    const previousTarget = renderer.getRenderTarget();
    for (const destination of enabled ? [null, target] : [null]) {
      renderer.setRenderTarget(destination);
      await renderer.compileAsync(scene, camera);
      await renderer.compileAsync(weaponScene, weaponCamera);
    }
    renderer.setRenderTarget(previousTarget);
    const textures = new Set();
    for (const root of [scene, weaponScene])
      root.traverse((object) => {
        for (const mat of Array.isArray(object.material)
          ? object.material
          : [object.material])
          if (mat)
            for (const value of Object.values(mat))
              if (value?.isTexture && value.image) textures.add(value);
      });
    textures.forEach((texture) => renderer.initTexture(texture));
  }
  return {
    configure,
    adapt,
    prepare,
    render,
    dispose() {
      target.dispose();
      quad.geometry.dispose();
      material.dispose();
      screen.clear();
    },
  };
}
