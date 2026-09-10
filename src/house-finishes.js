import * as THREE from "three";
import { seededRandom } from "./logic.js";
import { applyPbr } from "./shared/pbr.js";

// Blackwood's domestic finishes are local to this chapter. Canvas artwork stays
// crisp in actual scene photographs and does not depend on external assets.
function surface(draw, size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d"), size);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 16;
  return map;
}

function age(ctx, size, seed, strength = 0.06) {
  const random = seededRandom(seed);
  for (let i = 0; i < 10000; i++) {
    ctx.fillStyle = `rgba(${i % 2 ? "255,237,207" : "43,30,21"},${random() * strength})`;
    ctx.fillRect(
      random() * size,
      random() * size,
      1 + random() * 3,
      1 + random() * 5,
    );
  }
  for (let i = 0; i < 26; i++) {
    const x = random() * size,
      y = random() * size;
    const stain = ctx.createRadialGradient(x, y, 0, x, y, 40 + random() * 130);
    stain.addColorStop(0, "rgba(79,54,29,.14)");
    stain.addColorStop(1, "rgba(79,54,29,0)");
    ctx.fillStyle = stain;
    ctx.fillRect(0, 0, size, size);
  }
}

export function createHouseFinishes() {
  const plaster = new THREE.MeshStandardMaterial({
    map: surface((c, s) => {
      c.fillStyle = "#c4b69e";
      c.fillRect(0, 0, s, s);
      age(c, s, 814);
    }),
    roughness: 0.96,
  });
  const wallpaper = new THREE.MeshStandardMaterial({
    map: surface((c, s) => {
      c.fillStyle = "#b7a483";
      c.fillRect(0, 0, s, s);
      // A quiet repeating botanical print, with narrow paper-roll seams.
      for (let row = -1; row < 9; row++)
        for (let col = -1; col < 9; col++) {
          const x = col * 128 + (row % 2) * 64,
            y = row * 128;
          c.save();
          c.translate(x, y);
          c.strokeStyle = "rgba(92,80,54,.32)";
          c.fillStyle = "rgba(103,89,62,.23)";
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(0, 47);
          c.bezierCurveTo(-13, 13, 14, -13, 0, -49);
          c.stroke();
          for (const side of [-1, 1])
            for (let i = 0; i < 3; i++) {
              c.save();
              c.translate(side * (10 + i * 2), 25 - i * 22);
              c.rotate(side * 0.7);
              c.beginPath();
              c.ellipse(0, 0, 7, 15, 0, 0, Math.PI * 2);
              c.fill();
              c.stroke();
              c.restore();
            }
          c.beginPath();
          c.ellipse(0, -43, 6, 10, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      c.fillStyle = "rgba(76,58,34,.09)";
      for (let x = 0; x < s; x += 256) c.fillRect(x, 0, 1, s);
      age(c, s, 419, 0.09);
    }),
    roughness: 0.94,
    normalMap: null,
  });
  const joinery = new THREE.MeshStandardMaterial({
    map: surface((c, s) => {
      c.fillStyle = "#705039";
      c.fillRect(0, 0, s, s);
      for (let i = 0; i < 500; i++) {
        c.strokeStyle = `rgba(${i % 3 ? "34,19,12" : "186,142,91"},.12)`;
        c.lineWidth = i % 3 ? 1 : 2;
        c.beginPath();
        for (let y = 0; y <= s; y += 8) {
          const x = (i * s) / 500 + Math.sin(y * 0.009 + i * 0.7) * 3;
          if (!y) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
      }
      age(c, s, 83, 0.09);
    }),
    roughness: 0.67,
  });
  const trim = plaster.clone();
  trim.color.set("#e8d9bc");
  trim.roughness = 0.78;
  const rug = new THREE.MeshStandardMaterial({
    map: surface((c, s) => {
      c.fillStyle = "#58312c";
      c.fillRect(0, 0, s, s);
      for (const [inset, color, width] of [
        [28, "#a79061", 12],
        [47, "#302f27", 18],
        [71, "#9b7951", 4],
      ]) {
        c.strokeStyle = color;
        c.lineWidth = width;
        c.strokeRect(inset, inset, s - inset * 2, s - inset * 2);
      }
      for (let y = 130; y < s - 80; y += 128)
        for (let x = 130; x < s - 80; x += 128) {
          c.save();
          c.translate(x, y);
          c.rotate(Math.PI / 4);
          c.fillStyle = "#8c6b49";
          c.fillRect(-22, -22, 44, 44);
          c.fillStyle = "#403c2f";
          c.fillRect(-14, -14, 28, 28);
          c.fillStyle = "#ac9165";
          c.fillRect(-4, -4, 8, 8);
          c.restore();
        }
      c.fillStyle = "rgba(198,173,132,.09)";
      for (let y = 0; y < s; y += 3) c.fillRect(0, y, s, 1);
      age(c, s, 771, 0.25);
    }),
    roughness: 1,
  });
  applyPbr(plaster, "Plaster001", { color: "#c5baa7", normal: 0.24 });
  applyPbr(wallpaper, "Wallpaper001A", {
    albedo: false,
    color: "#ddd1bc",
    normal: 0.2,
  });
  applyPbr(joinery, "Wood066", {
    albedo: false,
    color: "#d9c9b5",
    normal: 0.1,
    roughness: 0.82,
  });
  applyPbr(trim, "Plaster001", {
    color: "#d8cbb2",
    normal: 0.12,
    roughness: 0.75,
  });
  applyPbr(rug, "Fabric030", { albedo: false, normal: 0.2 });
  return { plaster, wallpaper, joinery, trim, rug };
}

export function createHousePicture(caption) {
  return surface((c, s) => {
    const random = seededRandom(
      [...caption].reduce((n, a) => n + a.charCodeAt(0), 9),
    );
    c.fillStyle = "#b1a488";
    c.fillRect(0, 0, s, s);
    const sky = c.createLinearGradient(0, 80, 0, 620);
    sky.addColorStop(0, "#697474");
    sky.addColorStop(1, "#b6a88a");
    c.fillStyle = sky;
    c.fillRect(60, 60, s - 120, s - 160);
    for (let layer = 0; layer < 3; layer++) {
      c.fillStyle = ["#777864", "#62694e", "#474e39"][layer];
      c.beginPath();
      c.moveTo(60, 560 + layer * 110);
      for (let x = 60; x <= s - 60; x += 20)
        c.lineTo(x, 570 + layer * 100 + Math.sin(x * 0.006 + layer * 2) * 60);
      c.lineTo(s - 60, s - 100);
      c.lineTo(60, s - 100);
      c.fill();
    }
    for (let i = 0; i < 12; i++) {
      const x = 90 + random() * (s - 180),
        y = 540 + random() * 230,
        h = 85 + random() * 100;
      c.strokeStyle = "#383a2c";
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(x, y + 70);
      c.lineTo(x, y - h);
      c.stroke();
      for (let j = 0; j < 8; j++) {
        c.fillStyle = j % 2 ? "rgba(72,75,44,.65)" : "rgba(100,95,56,.65)";
        c.beginPath();
        c.ellipse(
          x + (random() - 0.5) * 80,
          y - h + random() * 75,
          25 + random() * 25,
          23 + random() * 25,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
    age(c, s, 103, 0.25);
    c.fillStyle = "#584d3a";
    c.font = "22px Georgia";
    c.textAlign = "center";
    c.fillText(caption.replaceAll("\n", " · "), s / 2, s - 42);
  });
}
