import type { GameSettings } from "./settings.ts";

type SfxName =
  | "start"
  | "tick"
  | "urgent"
  | "pin"
  | "lock"
  | "whoosh"
  | "tickScore"
  | "bullseye"
  | "win"
  | "lose"
  | "roundWin"
  | "roundLose"
  | "click";

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private unlocked = false;
  private ambience: { bed: GainNode; sources: AudioScheduledSourceNode[] } | null = null;
  private settings: GameSettings | null = null;

  unlock() {
    if (typeof window === "undefined") return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
    this.applySettings();
  }

  setSettings(settings: GameSettings) {
    this.settings = settings;
    this.applySettings();
  }

  private applySettings() {
    if (!this.ctx || !this.master || !this.music || !this.sfx || !this.settings) return;
    const mute = this.settings.muted ? 0 : 1;
    const curve = (v: number) => v * v;
    this.master.gain.setTargetAtTime(curve(this.settings.master) * mute, this.ctx.currentTime, 0.02);
    this.music.gain.setTargetAtTime(curve(this.settings.music), this.ctx.currentTime, 0.02);
    this.sfx.gain.setTargetAtTime(curve(this.settings.sfx), this.ctx.currentTime, 0.02);
  }

  /**
   * The Atmosphere bed under a round: wind (looped noise through a slowly
   * sweeping band-pass) over a quiet low pad that breathes. It fades in and
   * out rather than cutting, and runs through the `music` bus, so the
   * Atmosphere slider and mute control it.
   */
  startAmbience() {
    if (!this.unlocked) this.unlock();
    if (!this.ctx || !this.music || this.ambience) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const bed = ctx.createGain();
    bed.gain.setValueAtTime(0.0001, t);
    bed.gain.exponentialRampToValueAtTime(1, t + 1.6);
    bed.connect(this.music);
    const sources: AudioScheduledSourceNode[] = [];

    // Wind: four seconds of noise, looped, band-passed around 420Hz; a slow
    // LFO sweeps the band so it gusts instead of hissing.
    const len = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < len; i++) {
      brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = brown * 3.2;
    }
    const wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 420;
    band.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.62;
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.07;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 260;
    gust.connect(gustDepth).connect(band.frequency);
    wind.connect(band).connect(windGain).connect(bed);
    sources.push(wind, gust);

    // Pad: a low open fifth, gently detuned, swelling on a slow LFO.
    const pad = ctx.createGain();
    pad.gain.value = 0.06;
    const breathe = ctx.createOscillator();
    breathe.frequency.value = 0.045;
    const breatheDepth = ctx.createGain();
    breatheDepth.gain.value = 0.03;
    breathe.connect(breatheDepth).connect(pad.gain);
    const warm = ctx.createBiquadFilter();
    warm.type = "lowpass";
    warm.frequency.value = 900;
    for (const [freq, detune] of [
      [110, -6],
      [164.81, 5],
      [220, 3],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(warm);
      sources.push(osc);
    }
    warm.connect(pad).connect(bed);
    sources.push(breathe);

    sources.forEach((src) => src.start(t));
    this.ambience = { bed, sources };
  }

  stopAmbience() {
    const amb = this.ambience;
    if (!amb || !this.ctx) return;
    this.ambience = null;
    const t = this.ctx.currentTime;
    amb.bed.gain.cancelScheduledValues(t);
    amb.bed.gain.setValueAtTime(Math.max(0.0001, amb.bed.gain.value), t);
    amb.bed.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    for (const src of amb.sources) {
      try {
        src.stop(t + 1);
      } catch {
        /* already stopped */
      }
    }
    window.setTimeout(() => amb.bed.disconnect(), 1200);
  }

  /** Whether the Atmosphere bed is playing (for tests and the settings UI). */
  get ambiencePlaying(): boolean {
    return this.ambience !== null;
  }

  play(name: SfxName) {
    if (!this.unlocked) this.unlock();
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const beep = (freq: number, dur: number, type: OscillatorType = "sine", gain = 0.12, at = t) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g);
      g.connect(this.sfx!);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    };
    const noise = (dur: number, gain = 0.08, at = t) => {
      const buffer = this.ctx!.createBuffer(1, this.ctx!.sampleRate * dur, this.ctx!.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx!.createBufferSource();
      src.buffer = buffer;
      const g = this.ctx!.createGain();
      const f = this.ctx!.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 800;
      g.gain.setValueAtTime(gain, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.sfx!);
      src.start(at);
    };
    switch (name) {
      case "click":
        beep(420, 0.04, "triangle", 0.05);
        break;
      case "start":
        beep(330, 0.12, "triangle", 0.1);
        beep(494, 0.18, "triangle", 0.1, t + 0.1);
        break;
      case "tick":
        beep(880, 0.03, "square", 0.03);
        break;
      case "urgent":
        beep(1240, 0.05, "square", 0.05);
        break;
      case "pin":
        noise(0.06, 0.06);
        beep(220, 0.1, "sine", 0.08);
        break;
      case "lock":
        beep(392, 0.1, "triangle", 0.1);
        beep(523, 0.16, "triangle", 0.1, t + 0.08);
        break;
      case "whoosh":
        noise(0.35, 0.1);
        break;
      case "tickScore":
        beep(700 + Math.random() * 80, 0.04, "square", 0.04);
        break;
      case "bullseye":
        beep(523, 0.12, "triangle", 0.12);
        beep(659, 0.16, "triangle", 0.1, t + 0.08);
        beep(784, 0.22, "triangle", 0.1, t + 0.16);
        break;
      case "win":
        beep(523, 0.14, "triangle", 0.1);
        beep(659, 0.14, "triangle", 0.1, t + 0.12);
        beep(784, 0.14, "triangle", 0.1, t + 0.24);
        beep(1046, 0.28, "triangle", 0.12, t + 0.36);
        break;
      case "roundWin":
        beep(659, 0.1, "triangle", 0.1);
        beep(988, 0.22, "triangle", 0.11, t + 0.09);
        break;
      case "roundLose":
        beep(440, 0.12, "sine", 0.07);
        beep(370, 0.2, "sine", 0.06, t + 0.1);
        break;
      case "lose":
        beep(392, 0.18, "sine", 0.08);
        beep(311, 0.28, "sine", 0.08, t + 0.16);
        break;
    }
  }
}

export const audio = new AudioManager();

// Dev builds only: lets browser tests read what is playing.
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (window as unknown as { __atlasAudio?: AudioManager }).__atlasAudio = audio;
}
