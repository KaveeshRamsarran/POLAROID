import { regionAt, seededRandom } from "./logic.js";

export function footSurface(x, z) {
  const room = regionAt(x, z);
  if (room?.ramp) return "metal";
  if (
    room?.y > 0 ||
    ["LIVING ROOM", "STUDY", "DINING ROOM", "FRONT PORCH"].includes(room?.name)
  )
    return "wood";
  if (["KITCHEN", "WASHROOM"].includes(room?.name)) return "tile";
  return "concrete";
}

// Finite heel / sole / toe impacts, with different resonances for each surface.
export function footBuffer(context, material, variant = 0) {
  const parameters = {
    wood: [112, 238, 0.13, 1800],
    tile: [210, 690, 0.055, 4700],
    concrete: [84, 173, 0.065, 2600],
    metal: [183, 517, 0.23, 3600],
  };
  const [low, high, decay, cutoff] =
    parameters[material] || parameters.concrete;
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * 0.48),
    context.sampleRate,
  );
  const data = buffer.getChannelData(0),
    random = seededRandom(821 + variant * 97 + low);
  const pitch = 0.94 + variant * 0.023;
  let filtered = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / context.sampleRate;
    filtered +=
      (random() * 2 - 1 - filtered) *
      Math.min(1, (cutoff / context.sampleRate) * 5);
    let sample = 0;
    for (const [delay, strength] of [
      [0, 1],
      [0.067 + variant * 0.003, 0.42],
    ]) {
      const u = t - delay;
      if (u < 0) continue;
      const attack = Math.min(1, u / 0.002);
      sample +=
        strength *
        attack *
        (Math.sin(2 * Math.PI * low * pitch * u) * Math.exp(-u / decay) * 0.46 +
          Math.sin(2 * Math.PI * high * pitch * u) *
            Math.exp(-u / (decay * 0.55)) *
            0.14 +
          filtered * Math.exp(-u / 0.032) * 0.36);
    }
    data[i] = sample * Math.min(1, (0.48 - t) / 0.025);
  }
  return buffer;
}

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.masterVolume = 0.7;
    this.musicVolume = 0.35;
    this.effectsVolume = 0.75;
    this.active = false;
  }
  start(context) {
    if (this.ctx) {
      this.ctx.resume();
      this.active = true;
      return;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    this.ctx = context || new Audio();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.masterVolume;
    this.master.connect(c.destination);
    this.fx = c.createGain();
    this.fx.gain.value = this.effectsVolume;
    this.fx.connect(this.master);
    this.music = c.createGain();
    this.music.gain.value = this.musicVolume;
    this.music.connect(this.master);
    this.buffer = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
    const data = this.buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.025) / 1.025;
      data[i] = brown * 4;
    }
    this.steps = Object.fromEntries(
      ["wood", "tile", "concrete", "metal"].map((material) => [
        material,
        Array.from({ length: 4 }, (_, i) => footBuffer(c, material, i)),
      ]),
    );
    this.stepIndex = 0;
    // Short room reflections are excited only by an actual sound, never a noise loop.
    const impulse = c.createBuffer(2, c.sampleRate * 0.42, c.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const samples = impulse.getChannelData(channel);
      for (let i = 0; i < samples.length; i++)
        samples[i] =
          (Math.random() * 2 - 1) * Math.exp((-i / c.sampleRate) * 18) * 0.3;
    }
    const reverb = c.createConvolver(),
      wet = c.createGain();
    reverb.buffer = impulse;
    wet.gain.value = 0.075;
    this.fx.connect(reverb);
    reverb.connect(wet);
    wet.connect(this.master);
    this.drone = c.createGain();
    this.drone.gain.value = 0;
    this.drone.connect(this.music);
    for (const f of [43, 58.6, 87.3]) {
      const o = c.createOscillator();
      o.frequency.value = f;
      o.type = "sine";
      o.connect(this.drone);
      o.start();
    }
    this.active = true;
  }
  set(settings) {
    this.masterVolume = settings.master;
    this.musicVolume = settings.music;
    this.effectsVolume = settings.effects;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(
        this.paused ? 0 : settings.master,
        t,
        0.1,
      );
      this.music.gain.setTargetAtTime(settings.music, t, 0.1);
      this.fx.gain.setTargetAtTime(settings.effects, t, 0.1);
    }
  }
  pause(paused) {
    this.paused = paused;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(
      paused ? 0 : this.masterVolume,
      this.ctx.currentTime,
      0.3,
    );
  }
  outlet(position) {
    if (!position) return this.fx;
    const p = this.ctx.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = 1.5;
    p.maxDistance = 35;
    p.rolloffFactor = 1;
    p.positionX.value = position.x;
    p.positionY.value = position.y ?? 1;
    p.positionZ.value = position.z;
    p.connect(this.fx);
    return p;
  }
  noise(duration, volume, frequency = 500, position, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx,
      t = c.currentTime + delay,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain(),
      out = this.outlet(position);
    s.buffer = this.buffer;
    f.type = "lowpass";
    f.frequency.value = frequency;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.002, volume), t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.start(t, Math.random());
    s.stop(t + duration);
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
      if (out !== this.fx) out.disconnect();
    };
  }
  tone(
    freq,
    duration,
    volume = 0.1,
    position,
    type = "sine",
    end = freq,
    delay = 0,
  ) {
    if (!this.ctx) return;
    const c = this.ctx,
      t = c.currentTime + delay,
      o = c.createOscillator(),
      g = c.createGain(),
      out = this.outlet(position);
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + duration);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.002, volume), t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      if (out !== this.fx) out.disconnect();
    };
  }
  shutter() {
    this.noise(0.075, 0.8, 11000);
    this.tone(720, 0.09, 0.16, null, "square", 140);
    this.noise(0.12, 0.3, 6500, null, 0.12);
    this.tone(165, 0.8, 0.035, null, "sawtooth", 125, 0.18);
  }
  playBuffer(buffer, volume, position, rate = 1) {
    if (!this.ctx) return;
    const source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain(),
      out = this.outlet(position);
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(out);
    source.start();
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (out !== this.fx) out.disconnect();
    };
  }
  foot(position, material = "concrete", sprint = false, crouched = false) {
    if (!this.ctx) return;
    const index = this.stepIndex++;
    const side = index % 2 ? -0.12 : 0.12,
      yaw = this.yaw || 0;
    const source = {
      ...position,
      x: position.x + Math.cos(yaw) * side,
      z: position.z - Math.sin(yaw) * side,
    };
    this.playBuffer(
      this.steps[material][index % 4],
      crouched ? 0.12 : sprint ? 0.56 : 0.34,
      source,
      sprint ? 1.07 : 1,
    );
  }
  creak(position) {
    this.tone(180, 0.8, 0.035, position, "triangle", 75);
    this.noise(0.4, 0.055, 1700, position, 0.3);
  }
  door(position, opening = true) {
    this.noise(0.045, 0.24, 5800, position);
    this.tone(680, 0.07, 0.035, position, "triangle", 320);
    this.creak(position);
    this.noise(
      opening ? 0.12 : 0.27,
      opening ? 0.09 : 0.27,
      800,
      position,
      0.38,
    );
    if (!opening) this.tone(76, 0.23, 0.18, position, "sine", 42, 0.38);
  }
  entity(dt, position, enabled, chasing, occluded) {
    if (!this.ctx) return;
    const previous = this.entityPosition;
    this.entityPosition = { ...position };
    this.breathTimer = (this.breathTimer ?? 2) - dt;
    if (!enabled) {
      this.entityDistance = 0;
      return;
    }
    const moved = previous
      ? Math.hypot(position.x - previous.x, position.z - previous.z)
      : 0;
    this.entityDistance = (this.entityDistance ?? 0) + (moved < 1 ? moved : 0);
    const level = occluded ? 0.24 : 1;
    if (this.entityDistance > (chasing ? 0.85 : 0.65)) {
      this.entityDistance = 0;
      this.playBuffer(
        this.steps.wood[
          (this.entityStepIndex = (this.entityStepIndex ?? 0) + 1) % 4
        ],
        0.55 * level,
        { ...position, y: position.y - 1.1 },
        0.7,
      );
      this.noise(0.18, 0.09 * level, 700, position, 0.06);
    }
    if (this.breathTimer <= 0) {
      this.breathTimer = chasing ? 1.7 : 3.8 + Math.random() * 2;
      this.noise(0.48, 0.12 * level, 850, position);
      this.tone(54, 0.7, 0.035 * level, position, "triangle", 37, 0.1);
      this.noise(0.65, 0.055 * level, 1500, position, 0.65);
    }
  }
  thunder() {
    this.noise(3.5, 0.6, 350);
    this.noise(1, 0.22, 1100, null, 0.1);
  }
  whisper(position) {
    this.noise(1.9, 0.09, 2400, position);
    this.tone(350, 1.4, 0.006, position, "sine", 110);
  }
  pulse(volume = 0.12) {
    this.tone(52, 0.3, volume);
    this.tone(46, 0.28, volume * 0.65, null, "sine", 36, 0.19);
  }
  update(player, yaw, tension) {
    this.yaw = yaw;
    if (!this.ctx) return;
    const l = this.ctx.listener;
    for (const [k, v] of Object.entries({
      positionX: player.x,
      positionY: player.y,
      positionZ: player.z,
      forwardX: -Math.sin(yaw),
      forwardY: 0,
      forwardZ: -Math.cos(yaw),
      upX: 0,
      upY: 1,
      upZ: 0,
    })) {
      if (l[k]) l[k].value = v;
    }
    this.drone.gain.setTargetAtTime(
      Math.max(0, tension - 0.25) * 0.065,
      this.ctx.currentTime,
      0.8,
    );
  }
}
