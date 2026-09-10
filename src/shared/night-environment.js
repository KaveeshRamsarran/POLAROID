import * as THREE from "three";
import { seededRandom } from "../logic.js";

// Distant foliage uses crossed cutout cards, instanced in two draws. Small
// irregular needles keep the skyline organic without individual branch meshes.
export function nightEnvironment(
  scene,
  { centre = [0, 5], radius = 29, count = 60, arc = Math.PI * 2 } = {},
) {
  const random = seededRandom(9417),
    canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const c = canvas.getContext("2d");
  c.lineCap = "round";
  for (let branch = 0; branch < 105; branch++) {
    const y = 65 + branch * 7.3,
      reach = (y / 1024) * (170 + random() * 60);
    const side = branch % 2 ? 1 : -1;
    const endX = 256 + side * reach,
      endY = y + 15 + random() * 36;
    c.strokeStyle = "#788878";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(256, y - 14);
    c.lineTo(endX, endY);
    c.stroke();
    for (let needle = 0; needle < 65; needle++) {
      const f = random(),
        x = 256 + side * reach * f,
        by = y - 14 + (endY - y + 14) * f;
      const fan = 10 + (1 - f) * 28,
        shade = 95 + Math.floor(random() * 70);
      c.strokeStyle =
        "rgb(" + shade * 0.9 + "," + shade + "," + shade * 0.88 + ")";
      c.lineWidth = 1.8 + random() * 1.8;
      c.beginPath();
      c.moveTo(x, by);
      c.lineTo(x + side * (8 + random() * 20), by - fan * random());
      c.stroke();
      c.beginPath();
      c.moveTo(x, by);
      c.lineTo(x + side * 12, by + fan * 0.45);
      c.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const vertices = [],
    uv = [];
  for (const angle of [0, Math.PI / 2]) {
    const dx = Math.cos(angle) * 0.27,
      dz = Math.sin(angle) * 0.27;
    vertices.push(
      -dx,
      0,
      -dz,
      dx,
      0,
      dz,
      dx,
      1,
      dz,
      -dx,
      0,
      -dz,
      dx,
      1,
      dz,
      -dx,
      1,
      -dz,
    );
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: "#56645b",
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 1,
  });
  const crowns = new THREE.InstancedMesh(geometry, material, count);
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.004, 0.013, 1, 5),
    new THREE.MeshStandardMaterial({ color: "#302c28", roughness: 1 }),
    count,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * arc + random() * 0.1,
      r = radius + random() * 15,
      h = 8 + random() * 11;
    dummy.position.set(
      centre[0] + Math.cos(angle) * r,
      -1,
      centre[1] + Math.sin(angle) * r,
    );
    dummy.rotation.y = random() * Math.PI;
    dummy.scale.set(h * (0.7 + random() * 0.5), h, h);
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
    dummy.scale.y = h * 0.88;
    dummy.position.y = h * 0.44 - 1;
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crowns.setColorAt(i, new THREE.Color().setScalar(0.65 + random() * 0.35));
  }
  crowns.name = "distant-woodland";
  scene.add(crowns, trunks);
  // Directional noise avoids stretched UVs, a visible sphere grid or tiled clouds.
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { skyTint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader:
      "varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
      varying vec3 direction; uniform vec3 skyTint;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 d=normalize(direction),p=d*vec3(4.,8.,4.);float cloud=0.,a=.5;
        for(int i=0;i<4;i++){cloud+=noise(p)*a;p=p*2.03+17.3;a*=.5;}
        vec3 colour=mix(vec3(.011,.019,.03),vec3(.004,.008,.016),smoothstep(0.,.9,d.y));
        colour+=vec3(.009,.011,.013)*smoothstep(.38,.78,cloud);
        colour+=(hash(vec3(gl_FragCoord.xy,1.))-.5)*.0006;
        gl_FragColor=vec4(colour*skyTint,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  skyMaterial.color = skyMaterial.uniforms.skyTint.value;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(75, 24, 12), skyMaterial);
  sky.position.set(centre[0], 0, centre[1]);
  sky.renderOrder = -100;
  sky.name = "night-clouds";
  scene.add(sky);
  return { crowns, trunks, sky };
}
