// SFX manager — Web Audio API based. Generates synthetic sounds procedurally
// (no external audio assets required for MVP). Each sound is a short procedural
// burst built from oscillators + noise + envelopes — gives wide variety without
// shipping audio files.
//
// Usage: sfx.play("shoot.single") / sfx.play("explosion.medium")

const RATE = 48000;

class SfxManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._enabled = true;
    this._volume = 0.6;
    this._unlockBound = false;
    this._cache = new Map(); // name -> AudioBuffer
  }

  _ensureContext() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._volume;
    this.master.connect(this.ctx.destination);
  }

  // Must be called from a user gesture
  unlock() {
    this._ensureContext();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  setEnabled(v) { this._enabled = !!v; }
  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this._volume;
  }

  play(name, opts = {}) {
    if (!this._enabled) return;
    this._ensureContext();
    if (!this.ctx) return;
    const buf = this._getBuffer(name);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (opts.detune) src.detune.value = opts.detune;
    if (opts.playbackRate) src.playbackRate.value = opts.playbackRate;
    const gain = this.ctx.createGain();
    gain.gain.value = opts.volume ?? 1;
    src.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  _getBuffer(name) {
    if (this._cache.has(name)) return this._cache.get(name);
    const buf = this._synth(name);
    if (buf) this._cache.set(name, buf);
    return buf;
  }

  _synth(name) {
    const ctx = this.ctx;
    if (!ctx) return null;
    const recipe = RECIPES[name];
    if (!recipe) return null;
    const length = Math.ceil(RATE * recipe.duration);
    const buffer = ctx.createBuffer(1, length, RATE);
    const data = buffer.getChannelData(0);
    recipe.render(data, RATE);
    return buffer;
  }
}

// ---- Synth helpers ----
function adsr(t, attack, decay, sustain, release, total) {
  if (t < attack) return t / attack;
  if (t < attack + decay) return 1 - (1 - sustain) * (t - attack) / decay;
  if (t < total - release) return sustain;
  if (t < total) return sustain * (1 - (t - (total - release)) / release);
  return 0;
}
function noise() { return Math.random() * 2 - 1; }

// Each recipe writes a Float32Array buffer.
const RECIPES = {
  // ===== Player shooting =====
  "shoot.single": {
    duration: 0.10,
    render(d, rate) {
      const dur = 0.10;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.001, 0.04, 0.3, 0.05, dur);
        const f = 1200 - t * 800;
        d[i] = Math.sin(2 * Math.PI * f * t) * env * 0.55;
      }
    },
  },
  "shoot.double": {
    duration: 0.12,
    render(d, rate) {
      const dur = 0.12;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.001, 0.05, 0.3, 0.06, dur);
        const f = 900 - t * 500;
        d[i] = (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * (f * 1.5) * t) * 0.4) * env * 0.4;
      }
    },
  },
  "shoot.triple": {
    duration: 0.14,
    render(d, rate) {
      const dur = 0.14;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.002, 0.06, 0.3, 0.07, dur);
        d[i] = (Math.sin(2 * Math.PI * 700 * t) + 0.6 * Math.sin(2 * Math.PI * 1100 * t) + 0.3 * noise()) * env * 0.4;
      }
    },
  },
  "shoot.laser": {
    duration: 0.22,
    render(d, rate) {
      const dur = 0.22;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.005, 0.05, 0.6, 0.10, dur);
        const f = 1800 + Math.sin(t * 80) * 200;
        d[i] = Math.sin(2 * Math.PI * f * t) * env * 0.45;
      }
    },
  },
  "shoot.super": {
    duration: 0.30,
    render(d, rate) {
      const dur = 0.30;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.01, 0.08, 0.7, 0.10, dur);
        const f = 2200 - t * 1200;
        d[i] = (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.6 + 0.3 * noise()) * env * 0.4;
      }
    },
  },

  // ===== Enemy shooting =====
  "enemy.shoot": {
    duration: 0.12,
    render(d, rate) {
      const dur = 0.12;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.003, 0.04, 0.4, 0.06, dur);
        const f = 500 - t * 200;
        d[i] = (Math.sin(2 * Math.PI * f * t) + 0.3 * noise()) * env * 0.35;
      }
    },
  },

  // ===== Explosions =====
  "explosion.small": {
    duration: 0.30,
    render(d, rate) {
      const dur = 0.30;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.005, 0.10, 0.2, 0.18, dur);
        d[i] = (noise() * 0.8 + Math.sin(2 * Math.PI * 80 * t) * 0.3) * env * 0.6;
      }
    },
  },
  "explosion.medium": {
    duration: 0.50,
    render(d, rate) {
      const dur = 0.50;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.01, 0.20, 0.2, 0.20, dur);
        const lf = 60 - t * 30;
        d[i] = (noise() * 0.7 + Math.sin(2 * Math.PI * lf * t) * 0.5) * env * 0.7;
      }
    },
  },
  "explosion.big": {
    duration: 0.85,
    render(d, rate) {
      const dur = 0.85;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.01, 0.30, 0.3, 0.35, dur);
        const lf = 40 - t * 20;
        d[i] = (noise() * 0.7 + Math.sin(2 * Math.PI * lf * t) * 0.6) * env * 0.85;
      }
    },
  },

  // ===== Hit / damage =====
  "hit.enemy": {
    duration: 0.08,
    render(d, rate) {
      const dur = 0.08;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.001, 0.03, 0.2, 0.04, dur);
        d[i] = (noise() * 0.7 + Math.sin(2 * Math.PI * 250 * t) * 0.4) * env * 0.45;
      }
    },
  },
  "hit.player": {
    duration: 0.40,
    render(d, rate) {
      const dur = 0.40;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.005, 0.10, 0.4, 0.25, dur);
        d[i] = (noise() * 0.8 + Math.sin(2 * Math.PI * 110 * t) * 0.5) * env * 0.7;
      }
    },
  },

  // ===== UI / events =====
  "answer.correct": {
    duration: 0.45,
    render(d, rate) {
      const dur = 0.45;
      const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const seg = Math.floor(t / 0.13);
        const f = notes[Math.min(seg, notes.length - 1)] || 0;
        const env = Math.exp(-((t % 0.13) - 0.02) * 12) * (t < dur ? 1 : 0);
        d[i] = Math.sin(2 * Math.PI * f * t) * env * 0.4;
      }
    },
  },
  "answer.wrong": {
    duration: 0.35,
    render(d, rate) {
      const dur = 0.35;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.005, 0.08, 0.5, 0.20, dur);
        const f = 180 - t * 60;
        d[i] = (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 1.05 * t)) * env * 0.5;
      }
    },
  },
  "xp.collect": {
    duration: 0.18,
    render(d, rate) {
      const dur = 0.18;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.002, 0.03, 0.4, 0.10, dur);
        const f = 800 + t * 1600;
        d[i] = Math.sin(2 * Math.PI * f * t) * env * 0.4;
      }
    },
  },
  "powerup.weapon": {
    duration: 0.55,
    render(d, rate) {
      const dur = 0.55;
      const notes = [440, 554.37, 659.25, 880];
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const seg = Math.floor(t / 0.13);
        const f = notes[Math.min(seg, notes.length - 1)] || 0;
        const phase = (t % 0.13);
        const env = Math.exp(-phase * 10);
        d[i] = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t)) * env * 0.4;
      }
    },
  },
  "level.complete": {
    duration: 0.80,
    render(d, rate) {
      const dur = 0.80;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const seg = Math.floor(t / 0.18);
        const f = notes[Math.min(seg, notes.length - 1)] || 0;
        const phase = (t % 0.18);
        const env = Math.exp(-phase * 6);
        d[i] = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t)) * env * 0.45;
      }
    },
  },
  "boss.appear": {
    duration: 1.20,
    render(d, rate) {
      const dur = 1.20;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.01, 0.20, 0.7, 0.40, dur);
        const f = 60 + Math.sin(t * 8) * 30;
        d[i] = (Math.sin(2 * Math.PI * f * t) + 0.3 * noise() * (1 - t / dur)) * env * 0.7;
      }
    },
  },
  "wave.start": {
    duration: 0.30,
    render(d, rate) {
      const dur = 0.30;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.005, 0.05, 0.6, 0.15, dur);
        const f = 220 + t * 600;
        d[i] = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 1.5 * t)) * env * 0.4;
      }
    },
  },
  "ui.click": {
    duration: 0.06,
    render(d, rate) {
      const dur = 0.06;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.001, 0.02, 0.0, 0.03, dur);
        d[i] = Math.sin(2 * Math.PI * 1400 * t) * env * 0.35;
      }
    },
  },
  "ui.hover": {
    duration: 0.04,
    render(d, rate) {
      const dur = 0.04;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.001, 0.01, 0.0, 0.02, dur);
        d[i] = Math.sin(2 * Math.PI * 2200 * t) * env * 0.2;
      }
    },
  },
  "ui.back": {
    duration: 0.10,
    render(d, rate) {
      const dur = 0.10;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.002, 0.03, 0.0, 0.06, dur);
        d[i] = Math.sin(2 * Math.PI * (900 - t * 600) * t) * env * 0.3;
      }
    },
  },
  "asteroid.spawn": {
    duration: 0.35,
    render(d, rate) {
      const dur = 0.35;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.01, 0.15, 0.4, 0.15, dur);
        d[i] = (noise() * 0.4 + Math.sin(2 * Math.PI * (140 + Math.sin(t * 10) * 30) * t) * 0.5) * env * 0.45;
      }
    },
  },
  "asteroid.shatter": {
    duration: 0.45,
    render(d, rate) {
      const dur = 0.45;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.005, 0.20, 0.2, 0.20, dur);
        d[i] = (noise() * 0.85 + Math.sin(2 * Math.PI * 90 * t) * 0.3) * env * 0.65;
      }
    },
  },
  "midtest.fanfare": {
    duration: 1.40,
    render(d, rate) {
      const dur = 1.40;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const seg = Math.floor(t / 0.22);
        const f = notes[Math.min(seg, notes.length - 1)] || 0;
        const phase = (t % 0.22);
        const env = Math.exp(-phase * 5);
        d[i] = (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2 * t)) * env * 0.5;
      }
    },
  },
  "alert": {
    duration: 0.60,
    render(d, rate) {
      const dur = 0.60;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.005, 0.05, 0.7, 0.30, dur);
        const beat = (Math.floor(t * 8) % 2) ? 880 : 659.25;
        d[i] = Math.sin(2 * Math.PI * beat * t) * env * 0.45;
      }
    },
  },
  "shield.up": {
    duration: 0.45,
    render(d, rate) {
      const dur = 0.45;
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const env = adsr(t, 0.005, 0.10, 0.6, 0.20, dur);
        const f = 600 + Math.sin(t * 25) * 200;
        d[i] = Math.sin(2 * Math.PI * f * t) * env * 0.35;
      }
    },
  },
  "game.over": {
    duration: 1.50,
    render(d, rate) {
      const dur = 1.50;
      const notes = [523.25, 392.00, 329.63, 261.63];
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const seg = Math.floor(t / 0.30);
        const f = notes[Math.min(seg, notes.length - 1)] || 0;
        const phase = (t % 0.30);
        const env = Math.exp(-phase * 4);
        d[i] = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 0.5 * t)) * env * 0.55;
      }
    },
  },
};

export const sfx = new SfxManager();
