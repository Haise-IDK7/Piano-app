// Motor de escucha por micrófono.
//  - Nota suelta: método McLeod (pitchy).
//  - Detección dirigida: en vez de transcribir, comprueba en el espectro si
//    suenan las notas concretas que la app espera (sirve para acordes).
//  - Ataques (onsets) por salto de energía, para no contar dos veces una nota.
// Es TypeScript puro: recibe ventanas de audio (Float32Array) y devuelve hechos.
import { PitchDetector } from 'pitchy';
import { magnitudeSpectrum } from './fft';
import { freqToMidi, midiToFreq, pc } from './theory';

export const FRAME = 16384; // ventana larga (resolución en graves)
const SHORT = 8192; // ventana corta (rapidez)
const MONO = 4096;
const SEMI = Math.pow(2, 1 / 12);

export interface TrackerOptions { sensitivity: number; octaveTolerant: boolean; chordTolerance: boolean }

export interface TrackerOutput {
  level: number; // RMS reciente (para el medidor)
  active: boolean; // hay sonido por encima del umbral
  onset: boolean;
  heard: number | null; // nota suelta detectada con claridad (MIDI)
  hit: boolean; // las notas esperadas suenan → evento acertado
  wrong: number | null; // se esperaba 1 nota y sonó claramente otra
}

class Spectrum {
  private short: Float32Array;
  private long: Float32Array;
  private maxShort = 0;
  private maxLong = 0;
  constructor(frame: Float32Array, private sr: number, private absFloor: number, private rel: number) {
    this.short = magnitudeSpectrum(frame, FRAME - SHORT, SHORT);
    this.long = magnitudeSpectrum(frame, 0, FRAME);
    const lim = (n: number) => [Math.floor((50 * n) / sr), Math.min(n / 2 - 1, Math.ceil((5000 * n) / sr))];
    let [a, b] = lim(SHORT);
    for (let i = a; i <= b; i++) if (this.short[i] > this.maxShort) this.maxShort = this.short[i];
    [a, b] = lim(FRAME);
    for (let i = a; i <= b; i++) if (this.long[i] > this.maxLong) this.maxLong = this.long[i];
  }
  /** ¿Cuántos bins separan a f de su semitono vecino? */
  private semiBins(f: number, n: number) { return (f * (SEMI - 1) * n) / this.sr; }
  private peak(f: number, mags: Float32Array, n: number): number {
    const c = (f * n) / this.sr;
    const w = Math.max(1, c * (Math.pow(2, 0.4 / 12) - 1));
    let m = 0;
    for (let i = Math.max(1, Math.round(c - w)); i <= Math.min(mags.length - 1, Math.round(c + w)); i++) if (mags[i] > m) m = mags[i];
    return m;
  }
  /** Hay un pico claro en f: fuerte y mayor que sus semitonos vecinos. */
  peakOK(f: number): boolean {
    if (f > this.sr / 2.2) return false;
    let mags: Float32Array, n: number, max: number;
    if (this.semiBins(f, SHORT) >= 3) { mags = this.short; n = SHORT; max = this.maxShort; }
    else if (this.semiBins(f, FRAME) >= 3) { mags = this.long; n = FRAME; max = this.maxLong; }
    else return false;
    const p = this.peak(f, mags, n);
    if (p < this.absFloor || p < this.rel * max) return false;
    return p > 1.25 * Math.max(this.peak(f * SEMI, mags, n), this.peak(f / SEMI, mags, n));
  }
  /** ¿Suena la nota `midi`? Fundamental, o (en graves) al menos dos armónicos. */
  present(midi: number): boolean {
    const f0 = midiToFreq(midi);
    if (this.peakOK(f0)) return true;
    if (f0 < 200) {
      let k = 0;
      for (const h of [2, 3, 4]) if (this.peakOK(f0 * h)) k++;
      return k >= 2;
    }
    return false;
  }
}

export class MicTracker {
  private detector = PitchDetector.forFloat32Array(MONO);
  private rmsHist: number[] = [];
  private lastOnset = -1e9;
  private ignoreOnsetUntil = -1e9;
  private expected: number[] | null = null;
  private token: unknown = undefined;
  private onsetSinceArm = false;
  private absentSinceArm = false;
  private satCount = 0;
  private monoMidi = -1;
  private monoCount = 0;
  private wrongLatch = false;
  private hitLatch = false;

  constructor(private sampleRate: number, public opts: TrackerOptions) {}

  /** Indica qué notas se esperan ahora. Un token nuevo = evento nuevo. */
  setExpected(midis: number[] | null, token: unknown, tMs = 0): void {
    if (token === this.token && midis !== null) return;
    this.token = token;
    this.expected = midis && midis.length ? midis : null;
    this.onsetSinceArm = false;
    this.absentSinceArm = false;
    this.satCount = 0;
    this.wrongLatch = false;
    this.hitLatch = false;
    this.ignoreOnsetUntil = tMs + 110;
  }

  get gate(): number {
    const s = Math.min(1, Math.max(0, this.opts.sensitivity));
    const minGate = 0.012 * (1 - s) * (1 - s) + 0.0015;
    let floor = Infinity;
    for (const v of this.rmsHist) if (v < floor) floor = v;
    if (!isFinite(floor)) floor = 0;
    return Math.max(minGate, 3 * Math.min(0.02, floor));
  }

  process(frame: Float32Array, tMs: number): TrackerOutput {
    let sum = 0;
    for (let i = FRAME - 1024; i < FRAME; i++) sum += frame[i] * frame[i];
    const rms = Math.sqrt(sum / 1024);
    const gate = this.gate;
    let prevMin = Infinity;
    for (let i = Math.max(0, this.rmsHist.length - 6); i < this.rmsHist.length; i++) prevMin = Math.min(prevMin, this.rmsHist[i]);
    if (!isFinite(prevMin)) prevMin = 0;
    const prevRms = this.rmsHist.length ? this.rmsHist[this.rmsHist.length - 1] : 0;
    this.rmsHist.push(rms);
    if (this.rmsHist.length > 120) this.rmsHist.shift();

    const out: TrackerOutput = { level: rms, active: rms > gate, onset: false, heard: null, hit: false, wrong: null };
    if (rms > gate && rms > 1.6 * prevMin + gate * 0.2 && rms > 1.25 * prevRms && tMs - this.lastOnset > 90) {
      this.lastOnset = tMs;
      if (tMs >= this.ignoreOnsetUntil) {
        out.onset = true;
        this.onsetSinceArm = true;
        this.wrongLatch = false;
      }
    }
    if (!out.active) {
      this.satCount = 0;
      this.monoCount = 0;
      this.monoMidi = -1;
      if (this.expected) this.absentSinceArm = true;
      return out;
    }

    // Nota suelta
    const [hz, clarity] = this.detector.findPitch(frame.subarray(FRAME - MONO), this.sampleRate);
    let monoNow = -1;
    if (clarity >= 0.9 && hz > 27 && hz < 4300) monoNow = Math.round(freqToMidi(hz));
    if (monoNow >= 0 && monoNow === this.monoMidi) this.monoCount++;
    else { this.monoMidi = monoNow; this.monoCount = monoNow >= 0 ? 1 : 0; }
    if (this.monoCount >= 2) out.heard = this.monoMidi;

    const exp = this.expected;
    if (!exp || this.hitLatch) return out;

    const s = Math.min(1, Math.max(0, this.opts.sensitivity));
    const spec = new Spectrum(frame, this.sampleRate, gate * 0.3, 0.2 - 0.16 * s);
    const same = (a: number, b: number) => (this.opts.octaveTolerant ? pc(a) === pc(b) : a === b);
    let satisfied: boolean;
    if (exp.length === 1) {
      const monoMatch = out.heard !== null && same(out.heard, exp[0]);
      const monoDiff = monoNow >= 0 && !same(monoNow, exp[0]);
      satisfied = monoMatch || (spec.present(exp[0]) && !monoDiff);
      if (out.heard !== null && this.monoCount >= 3 && !same(out.heard, exp[0]) && this.onsetSinceArm && !this.wrongLatch) {
        out.wrong = out.heard;
        this.wrongLatch = true;
        this.onsetSinceArm = false;
      }
    } else {
      let count = 0;
      for (const m of exp) if (spec.present(m)) count++;
      const need = this.opts.chordTolerance && exp.length >= 3 ? exp.length - 1 : exp.length;
      satisfied = count >= need;
    }
    if (satisfied) this.satCount++;
    else { this.satCount = 0; this.absentSinceArm = true; }
    if (satisfied && this.satCount >= 2 && (this.onsetSinceArm || this.absentSinceArm)) {
      out.hit = true;
      this.hitLatch = true; // un acierto por evento; hace falta setExpected para rearmar
    }
    return out;
  }
}
