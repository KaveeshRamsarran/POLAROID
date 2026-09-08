export class Soundscape {
  constructor() {
    this.ctx = null;
    this.masterVolume = 0.7;
    this.musicVolume = 0.35;
    this.effectsVolume = 0.75;
    this.active = false;
  }
  start() {
    if (this.ctx) {
      this.ctx.resume();
      this.active = true;
      return;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    this.ctx = new Audio();
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
    const rain = c.createBufferSource();
    rain.buffer = this.buffer;
    rain.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 800;
    const gain = c.createGain();
    gain.gain.value = 0.32;
    rain.connect(filter);
    filter.connect(gain);
    gain.connect(this.fx);
    rain.start();
    this.drone = c.createGain();
    this.drone.gain.value = 0.02;
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
      this.master.gain.setTargetAtTime(settings.master, t, 0.1);
      this.music.gain.setTargetAtTime(settings.music, t, 0.1);
      this.fx.gain.setTargetAtTime(settings.effects, t, 0.1);
    }
  }
  pause(paused) {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(
      paused ? this.masterVolume * 0.15 : this.masterVolume,
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
  foot(position, wood = false, sprint = false) {
    this.noise(0.14, sprint ? 0.16 : 0.07, wood ? 350 : 1200, position);
    this.tone(wood ? 83 : 115, 0.1, 0.025, position, "sine", 45);
  }
  creak(position) {
    this.tone(180, 0.8, 0.035, position, "triangle", 75);
    this.noise(0.4, 0.055, 1700, position, 0.3);
  }
  door(position) {
    this.creak(position);
    this.noise(0.25, 0.13, 350, position, 0.15);
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
      0.018 + tension * 0.09,
      this.ctx.currentTime,
      0.8,
    );
  }
}
