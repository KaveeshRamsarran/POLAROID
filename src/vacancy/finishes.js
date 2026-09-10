import * as THREE from "three";
import { seededRandom } from "../logic.js";

export function motelFinishes() {
  const random = seededRandom(197411);
  function surface(base, paint, bump = 0.012) {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 20000; i++) {
      g.fillStyle = random() > 0.5 ? "#ffffff09" : "#1b1c1510";
      g.fillRect(
        random() * 512,
        random() * 512,
        1 + random() * 2,
        1 + random() * 2,
      );
    }
    paint(g);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    return new THREE.MeshStandardMaterial({
      map,
      roughness: 0.93,
      bumpMap: map,
      bumpScale: bump,
    });
  }
  const plaster = surface("#b8ad93", (g) => {
    for (let i = 0; i < 45; i++) {
      g.strokeStyle = "#554f4210";
      g.lineWidth = 0.5;
      const x = random() * 512,
        y = random() * 512;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + random() * 7, y + 15 + random() * 45);
      g.stroke();
    }
  });
  const wallpaper = surface(
    "#c2b79c",
    (g) => {
      for (let x = 0; x < 512; x += 64) {
        g.fillStyle = "#736f5220";
        g.fillRect(x, 0, 17, 512);
        g.fillStyle = "#efe4bc45";
        g.fillRect(x + 20, 0, 2, 512);
        for (let y = 20; y < 512; y += 64) {
          g.strokeStyle = "#6e705139";
          g.lineWidth = 1;
          g.beginPath();
          g.ellipse(x + 8, y, 4, 9, 0.5, 0, Math.PI * 2);
          g.stroke();
        }
      }
    },
    0.005,
  );
  const carpet = surface(
    "#414a3d",
    (g) => {
      for (let x = 0; x < 512; x += 32)
        for (let y = 0; y < 512; y += 32) {
          g.strokeStyle = "#8b805449";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x + 16, y + 4);
          g.lineTo(x + 28, y + 16);
          g.lineTo(x + 16, y + 28);
          g.lineTo(x + 4, y + 16);
          g.closePath();
          g.stroke();
        }
      for (let y = 0; y < 512; y += 3) {
        g.fillStyle = "#00000012";
        g.fillRect(0, y, 512, 1);
      }
    },
    0.008,
  );
  const asphalt = surface(
    "#484b47",
    (g) => {
      for (let i = 0; i < 3500; i++) {
        g.fillStyle = random() > 0.6 ? "#acaaa426" : "#171b1829";
        g.fillRect(random() * 512, random() * 512, 2, 2);
      }
      g.strokeStyle = "#161b1745";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(30, 0);
      g.lineTo(42, 87);
      g.lineTo(27, 139);
      g.lineTo(43, 196);
      g.stroke();
    },
    0.014,
  );
  const siding = surface("#72857e", (g) => {
    for (let y = 0; y < 512; y += 64) {
      g.fillStyle = "#192d3048";
      g.fillRect(0, y, 512, 4);
      g.fillStyle = "#dedcc02b";
      g.fillRect(0, y + 5, 512, 2);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = "#242c291b";
        g.fillRect(random() * 512, y + random() * 64, 10 + random() * 40, 0.5);
      }
    }
  });
  const poolTile = surface("#8fada7", (g) => {
    for (let x = 0; x < 512; x += 32)
      for (let y = 0; y < 512; y += 32) {
        g.fillStyle = random() > 0.86 ? "#445e5460" : "#d6d0af20";
        g.fillRect(x + 2, y + 2, 28, 28);
        g.strokeStyle = "#596b6280";
        g.lineWidth = 2;
        g.strokeRect(x, y, 32, 32);
      }
  });
  const blanket = surface(
    "#6a7565",
    (g) => {
      for (let y = 0; y < 512; y += 5) {
        g.fillStyle = y % 10 ? "#d4ceaa15" : "#252f2929";
        g.fillRect(0, y, 512, 1);
      }
      for (const y of [32, 45, 466, 479]) {
        g.fillStyle = "#b8a77985";
        g.fillRect(0, y, 512, 5);
      }
    },
    0.006,
  );
  return { plaster, wallpaper, carpet, asphalt, siding, poolTile, blanket };
}
