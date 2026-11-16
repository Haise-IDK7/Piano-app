// Sonido de piano sintetizado con Web Audio (sin muestras externas) y metrónomo.
import { midiToFreq } from './theory';

interface Voice { gain: GainNode; oscs: OscillatorNode[] }

export class Synth {
  readonly ctx: AudioContext;
  private master: GainNode;
  private voices = new Map<number, Voice>();

  constructor(ctx?: AudioContext) {
    this.ctx = ctx ?? new AudioContext({ latencyHint: 'interactive' });
    const comp = this.ctx.createDynamicsCompressor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(comp).connect(this.ctx.destination);
  }

  resume(): void { if (this.ctx.state !== 'running') void this.ctx.resume(); }
  setVolume(v: number): void { this.master.gain.value = Math.max(0, Math.min(1, v)); }

  noteOn(midi: number, dur?: number, vel = 0.7): void {
    this.resume();
    this.noteOff(midi, 0.03);
    const t = this.ctx.currentTime;
    const f = midiToFreq(midi);
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(9000, 1200 + f * 5);
    const decay = Math.max(0.6, 3.2 - (midi - 36) * 0.035);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(vel * 0.18, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    const oscs: OscillatorNode[] = [];
    const parts: [OscillatorType, number, number][] = [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 3, 0.12], ['sine', 4, 0.05]];
    for (const [type, mult, amp] of parts) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = f * mult;
      g.gain.value = amp;
      o.connect(g).connect(filter);
      o.start(t);
      o.stop(t + decay + 0.1);
      oscs.push(o);
    }
    filter.connect(gain).connect(this.master);
    const voice = { gain, oscs };
    this.voices.set(midi, voice);
    oscs[0].onended = () => { if (this.voices.get(midi) === voice) this.voices.delete(midi); gain.disconnect(); };
    if (dur !== undefined) this.noteOff(midi, 0.12, t + Math.max(0.05, dur));
  }

  noteOff(midi: number, release = 0.12, at?: number): void {
    const v = this.voices.get(midi);
    if (!v) return;
    const t = at ?? this.ctx.currentTime;
    try {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0.0001, t, release / 3);
      for (const o of v.oscs) o.stop(t + release + 0.05);
    } catch { /* la voz ya terminó */ }
    if (at === undefined) this.voices.delete(midi);
  }

  allOff(): void { for (const m of [...this.voices.keys()]) this.noteOff(m, 0.05); }

  click(accent = false): void {
    this.resume();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = accent ? 1500 : 1000;
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.06);
  }
}
