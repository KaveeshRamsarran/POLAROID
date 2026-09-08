import { regionAt, seededRandom, tiledRooms, boardedRooms } from "./logic.js";
import shutterUrl from "./sfx/camera-shutter.mp3";
import footstepUrl from "./sfx/footstep-concrete.mp3";

export function footSurface(x, z) {
  const room = regionAt(x, z);
  if (room?.ramp) return "metal";
  if (tiledRooms.includes(room?.name)) return "tile";
  if (room?.y > 0 || boardedRooms.includes(room?.name)) return "wood";
  return "concrete";
}

// A single concrete walk recording carries every floor. Playback rate and one
// filter give each surface its own voice; concrete plays the sample untouched.
export const surfaceVoice = {
  concrete: { rate: 1, level: 1, filter: null },
  wood: {
    rate: 0.93,
    level: 1.08,
    filter: { type: "lowpass", frequency: 2050, Q: 0.85 },
  },
  tile: {
    rate: 1.15,
    level: 0.92,
    filter: { type: "highshelf", frequency: 3100, gain: 7.5 },
  },
  metal: {
    rate: 1.04,
    level: 1,
    filter: { type: "peaking", frequency: 1720, Q: 3.4, gain: 10 },
  },
};

// Finite heel / sole / toe impacts, with different resonances for each surface.
// These play until the recording decodes, and stay as the fallback if it cannot
// be fetched at all.
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

const STEP_LEAD = 0.002, // transient kept at the very front of each slice
  STEP_LIMIT = 0.5, // hard cap, so one step can never run into the next
  STEP_FADE = 0.035, // taper to true silence, leaving no tail behind
  STEP_VARIANTS = 16;

// The supplied walk is a continuous stride, so split it on its impacts. A step
// then plays once per footfall instead of looping a whole walk cycle.
export function sliceSteps(context, recording) {
  const rate = recording.sampleRate,
    channels = recording.numberOfChannels;
  const mono = new Float32Array(recording.length);
  for (let channel = 0; channel < channels; channel++) {
    const data = recording.getChannelData(channel);
    for (let i = 0; i < mono.length; i++) mono[i] += data[i] / channels;
  }
  // Peak-following envelope: instant attack, 4 ms release.
  const release = Math.exp(-1 / (rate * 0.004)),
    envelope = new Float32Array(mono.length);
  let level = 0,
    peak = 0;
  for (let i = 0; i < mono.length; i++) {
    level = Math.max(Math.abs(mono[i]), level * release);
    envelope[i] = level;
    if (level > peak) peak = level;
  }
  if (!peak) return null;
  const loud = peak * 0.22,
    quiet = peak * 0.06,
    gap = Math.round(rate * 0.11);
  // An impact is only counted once the envelope has fallen quiet again, so a
  // long decay cannot register as a second footfall.
  const onsets = [];
  let armed = true;
  for (let i = 0; i < envelope.length; i++) {
    if (armed && envelope[i] >= loud) {
      onsets.push(i);
      armed = false;
    } else if (
      !armed &&
      envelope[i] < quiet &&
      i - onsets[onsets.length - 1] > gap
    )
      armed = true;
  }
  const lead = Math.round(rate * STEP_LEAD),
    limit = Math.round(rate * STEP_LIMIT),
    fade = Math.round(rate * STEP_FADE),
    rise = Math.max(1, Math.round(rate * 0.001)),
    normalise = 0.92 / peak,
    shortest = rate * 0.03;
  const steps = [];
  for (let n = 0; n < onsets.length && steps.length < STEP_VARIANTS; n++) {
    const start = Math.max(0, onsets[n] - lead);
    let end = Math.min(
      mono.length,
      onsets[n + 1] ?? mono.length,
      start + limit,
    );
    while (end > start + fade && envelope[end - 1] < quiet * 0.5) end--;
    const length = end - start;
    if (length < shortest) continue;
    const step = context.createBuffer(1, length, rate),
      data = step.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const left = length - i;
      data[i] =
        mono[start + i] *
        normalise *
        Math.min(1, i / rise) *
        (left >= fade ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * left) / fade));
    }
    steps.push(step);
  }
  return steps.length ? steps : null;
}

// One fetch per file, shared by every context. decodeAudioData takes ownership
// of its input, so each decode works on its own copy.
const downloads = new Map();
function decode(context, url) {
  if (!downloads.has(url))
    downloads.set(
      url,
      fetch(url).then((response) => {
        if (!response.ok) throw new Error(`${url} returned ${response.status}`);
        return response.arrayBuffer();
      }),
    );
  return downloads
    .get(url)
    .then((data) => context.decodeAudioData(data.slice(0)));
}

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.masterVolume = 0.7;
    this.musicVolume = 0.35;
    this.effectsVolume = 0.75;
    this.active = false;
    this.shutterSample = null;
    this.stepSamples = null;
    this.ready = Promise.resolve();
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
    this.ready = this.load();
  }
  // The recorded shutter and footsteps take over as soon as they decode. A
  // failed fetch is not fatal: the synthesized sounds simply stay in place.
  async load() {
    const c = this.ctx;
    const [shutter, walk] = await Promise.allSettled([
      decode(c, shutterUrl),
      decode(c, footstepUrl),
    ]);
    if (this.ctx !== c) return;
    if (shutter.status === "fulfilled") this.shutterSample = shutter.value;
    else
      console.warn("POLAROID: shutter recording unavailable.", shutter.reason);
    if (walk.status === "fulfilled")
      this.stepSamples = sliceSteps(c, walk.value);
    else console.warn("POLAROID: footstep recording unavailable.", walk.reason);
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
    // The recording is the whole sound; the synthesized shutter stands in only
    // while it is still decoding.
    if (this.shutterSample) return this.playBuffer(this.shutterSample, 0.85);
    this.noise(0.075, 0.8, 11000);
    this.tone(720, 0.09, 0.16, null, "square", 140);
    this.noise(0.12, 0.3, 6500, null, 0.12);
    this.tone(165, 0.8, 0.035, null, "sawtooth", 125, 0.18);
  }
  playBuffer(buffer, volume, position, rate = 1, shape = null) {
    if (!this.ctx || !buffer) return;
    const source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain(),
      out = this.outlet(position),
      filter = shape ? this.ctx.createBiquadFilter() : null;
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = volume;
    if (filter) {
      filter.type = shape.type;
      filter.frequency.value = shape.frequency;
      if (shape.Q !== undefined) filter.Q.value = shape.Q;
      if (shape.gain !== undefined) filter.gain.value = shape.gain;
      source.connect(filter);
      filter.connect(gain);
    } else source.connect(gain);
    gain.connect(out);
    source.start();
    source.onended = () => {
      source.disconnect();
      filter?.disconnect();
      gain.disconnect();
      if (out !== this.fx) out.disconnect();
    };
  }
  // A recorded impact voiced for the surface underfoot, or the synthesized one
  // until the recording is ready.
  step(material, index) {
    if (this.stepSamples)
      return {
        buffer: this.stepSamples[index % this.stepSamples.length],
        ...(surfaceVoice[material] || surfaceVoice.concrete),
      };
    return {
      buffer: this.steps[material][index % 4],
      rate: 1,
      level: 1,
      filter: null,
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
    const step = this.step(material, index);
    this.playBuffer(
      step.buffer,
      (crouched ? 0.12 : sprint ? 0.56 : 0.34) * step.level,
      source,
      step.rate * (sprint ? 1.07 : 1),
      step.filter,
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
      // Its tread is the same recording, slowed and dulled into something heavier.
      const step = this.step(
        "wood",
        (this.entityStepIndex = (this.entityStepIndex ?? 0) + 1),
      );
      this.playBuffer(
        step.buffer,
        0.55 * level * step.level,
        { ...position, y: position.y - 1.1 },
        step.rate * 0.7,
        step.filter,
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
