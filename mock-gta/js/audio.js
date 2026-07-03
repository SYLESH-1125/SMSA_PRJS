'use strict';
/* ================= WebAudio synth — zero asset sound ================= */
const AUD = {
  ctx: null, master: null, muted: false,
  engOsc: null, engGain: null, engFilt: null,
  skidGain: null, sirenGain: null, sirenOsc: null,
  sirenTimer: 0, sirenHigh: false,
  noiseBuf: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      const len = (this.ctx.sampleRate * 1.2) | 0;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      // engine hum
      this.engOsc = this.ctx.createOscillator();
      this.engOsc.type = 'sawtooth';
      this.engOsc.frequency.value = 70;
      this.engFilt = this.ctx.createBiquadFilter();
      this.engFilt.type = 'lowpass';
      this.engFilt.frequency.value = 420;
      this.engGain = this.ctx.createGain();
      this.engGain.gain.value = 0;
      this.engOsc.connect(this.engFilt); this.engFilt.connect(this.engGain);
      this.engGain.connect(this.master); this.engOsc.start();

      // tyre screech (looped noise through bandpass)
      const sk = this.ctx.createBufferSource();
      sk.buffer = this.noiseBuf; sk.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 1.2;
      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.value = 0;
      sk.connect(bp); bp.connect(this.skidGain);
      this.skidGain.connect(this.master); sk.start();

      // police siren (two-tone)
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 690;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master); this.sirenOsc.start();
    } catch (e) { this.ctx = null; }
  },

  setMute(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; },

  engine(on, ratio) {
    if (!this.ctx) return;
    this.engGain.gain.setTargetAtTime(on ? 0.10 : 0, this.ctx.currentTime, 0.08);
    this.engOsc.frequency.setTargetAtTime(60 + ratio * 150, this.ctx.currentTime, 0.05);
    this.engFilt.frequency.setTargetAtTime(300 + ratio * 900, this.ctx.currentTime, 0.06);
  },
  skid(on) {
    if (!this.ctx) return;
    this.skidGain.gain.setTargetAtTime(on ? 0.12 : 0, this.ctx.currentTime, 0.05);
  },
  siren(on, dt) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.15);
    if (on) {
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 0.42;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 880 : 640, this.ctx.currentTime, 0.07);
      }
    }
  },

  burst(dur, freq, gain) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.02);
  },
  tone(freq, dur, delay, type, gain) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    const t = this.ctx.currentTime + (delay || 0);
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  shot()   { this.burst(0.13, 2400, 0.32); },
  crash(v) { this.burst(0.25, 900, clamp(v, 0.08, 0.5)); },
  boom() {
    if (!this.ctx) return;
    this.burst(0.7, 220, 0.9);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.75);
  },
  blip()   { this.tone(880, 0.07); this.tone(1420, 0.12, 0.06); },
  jingle() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, i * 0.11, 'triangle', 0.2)); },
  sad()    { [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, i * 0.16, 'triangle', 0.18)); },
  horn()   { this.tone(300, 0.35, 0, 'square', 0.1); this.tone(375, 0.35, 0, 'square', 0.1); },
};
