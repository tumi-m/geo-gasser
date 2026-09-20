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
  | "click";

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private unlocked = false;
  private drone: OscillatorNode | null = null;
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

  startAmbience() {
    if (!this.ctx || !this.music || this.drone) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 72;
    g.gain.value = 0.03;
    osc.connect(g);
    g.connect(this.music);
    osc.start();
    this.drone = osc;
  }

  stopAmbience() {
    try {
      this.drone?.stop();
    } catch {
      /* already stopped */
    }
    this.drone = null;
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
      case "lose":
        beep(392, 0.18, "sine", 0.08);
        beep(311, 0.28, "sine", 0.08, t + 0.16);
        break;
    }
  }
}

export const audio = new AudioManager();
