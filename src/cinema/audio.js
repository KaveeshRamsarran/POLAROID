import { Soundscape } from "../audio.js";
import managerUrl from "./sfx/manager.wav";
export class CinemaSound extends Soundscape {
  async load() {
    await super.load();
    try {
      const response = await fetch(managerUrl);
      this.managerSample = await this.ctx.decodeAudioData(
        await response.arrayBuffer(),
      );
    } catch (error) {
      console.warn("Manager recording unavailable", error);
    }
  }
  start() {
    super.start();
    if (!this.ctx || this.motor) return;
    const c = this.ctx,
      buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
      samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const t = i / c.sampleRate,
        p = (t * 24) % 1;
      samples[i] =
        0.17 * Math.sin(t * 2 * Math.PI * 48) +
        0.055 * Math.sin(t * 2 * Math.PI * 96) +
        0.16 * Math.exp(-p * 38) * Math.sin(p * 90);
    }
    this.motor = c.createBufferSource();
    this.motor.buffer = buffer;
    this.motor.loop = true;
    this.motorGain = c.createGain();
    this.motorGain.gain.value = 0;
    this.motor.connect(this.motorGain);
    this.motorPan = this.outlet({ x: 13.3, y: 4.95, z: -4.5 });
    this.motorPan.refDistance = 7;
    this.motorPan.rolloffFactor = 0.6;
    this.motorGain.connect(this.motorPan);
    this.motor.start();
  }
  projector(status, remaining, paused) {
    if (!this.ctx || !this.motor) return;
    const t = this.ctx.currentTime;
    this.motorGain.gain.setTargetAtTime(
      status === "running" && !paused ? 0.65 : 0,
      t,
      0.035,
    );
    this.motor.playbackRate.setTargetAtTime(remaining < 35 ? 0.94 : 1, t, 0.15);
  }
  carpet(position, sprint = false) {
    if (!this.ctx) return;
    const s = this.step("concrete", this.stepIndex++);
    this.playBuffer(s.buffer, sprint ? 0.38 : 0.25, position, 0.94, {
      type: "lowpass",
      frequency: 950,
      Q: 0.6,
    });
  }
  mechanism(position, kind = "seat") {
    this.tone(
      kind === "door" ? 95 : 310,
      0.4,
      0.15,
      position,
      "triangle",
      kind === "door" ? 47 : 75,
    );
    this.noise(0.09, 0.16, 1900, position, 0.12);
  }
  manager() {
    if (this.managerSample)
      this.playBuffer(this.managerSample, 0.85, { x: -5.5, y: 1.3, z: 20.8 });
  }
  dispose() {
    this.motor?.stop();
    this.ctx?.close();
    this.ctx = null;
  }
}
