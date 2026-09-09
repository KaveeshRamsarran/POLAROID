import { Soundscape } from "../audio.js";
export class MotelSound extends Soundscape {
  bell(position) {
    this.tone(1120, 0.8, 0.24, position, "sine", 1110);
    this.tone(1710, 0.5, 0.07, position, "sine", 1680);
  }
  keys(position) {
    this.tone(1640, 0.14, 0.13, position, "triangle", 900);
    this.tone(2230, 0.1, 0.055, position, "sine", 1750);
  }
  door(position) {
    this.tone(97, 0.24, 0.15, position, "triangle", 48);
    this.noise(0.07, 0.1, 1700, position, 0.1);
  }
  carpet(position, sprint, crouch) {
    if (!this.ctx) return;
    const s = this.step("wood", this.stepIndex++);
    this.playBuffer(
      s.buffer,
      crouch ? 0.12 : sprint ? 0.38 : 0.24,
      position,
      0.95,
      { type: "lowpass", frequency: 1000, Q: 0.5 },
    );
  }
  phone(position) {
    this.tone(350, 0.6, 0.075, position, "sine", 350);
    this.tone(440, 0.6, 0.07, position, "sine", 440);
  }
  ambience(position, t) {
    // Discrete drips and occasional distant thunder; no continuous noise bed.
    if (!this.ctx) return;
    if (t > (this.nextDrip || 0)) {
      this.nextDrip = t + 6.5;
      this.tone(730, 0.045, 0.035, { x: -4, y: 1, z: 7 }, "sine", 380);
    }
    if (t > (this.nextThunder || 35)) {
      this.nextThunder = t + 48;
      this.noise(1.6, 0.055, 110, { x: 17, y: 8, z: 16 }, 0.8);
    }
  }
  dispose() {
    this.ctx?.close();
    this.ctx = null;
  }
}
