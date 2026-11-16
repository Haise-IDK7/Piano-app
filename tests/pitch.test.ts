import { describe, expect, it } from 'vitest';
import { FRAME, MicTracker } from '../src/engine/pitch';
import { midiToFreq } from '../src/engine/theory';

const SR = 48000;
const HOP = 1200; // 25 ms

interface Tone { midi: number; start: number; dur: number; amp?: number }

/** Sintetiza notas tipo teclado: armónicos, ataque rápido, caída y ruido de fondo. */
function synth(tones: Tone[], seconds: number, noise = 0.0008): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (let i = 0; i < out.length; i++) out[i] = rnd() * noise;
  for (const t of tones) {
    const f = midiToFreq(t.midi);
    const a = t.amp ?? 0.15;
    const i0 = Math.round(t.start * SR), i1 = Math.min(out.length, Math.round((t.start + t.dur + 0.08) * SR));
    for (let i = i0; i < i1; i++) {
      const x = (i - i0) / SR;
      const att = Math.min(1, x / 0.008);
      const rel = x > t.dur ? Math.max(0, 1 - (x - t.dur) / 0.08) : 1;
      const env = att * Math.exp(-x * 2.5) * rel;
      let s = 0;
      for (let h = 1; h <= 6; h++) s += Math.sin(2 * Math.PI * f * h * x) / (h * h * 0.6 + 0.4);
      out[i] += a * env * s;
    }
  }
  return out;
}

/** Recorre el audio como lo haría el micrófono; `expect` da las notas esperadas tras cada acierto. */
function run(audio: Float32Array, sequence: number[][], opts = { sensitivity: 0.5, octaveTolerant: true, chordTolerance: false }) {
  const tr = new MicTracker(SR, opts);
  const frame = new Float32Array(FRAME);
  const hits: number[] = [], wrongs: number[] = [], heard = new Set<number>();
  let idx = 0;
  tr.setExpected(sequence[0] ?? null, 0, 0);
  for (let pos = 0; pos + HOP <= audio.length; pos += HOP) {
    frame.copyWithin(0, HOP);
    frame.set(audio.subarray(pos, pos + HOP), FRAME - HOP);
    const t = ((pos + HOP) / SR) * 1000;
    const o = tr.process(frame, t);
    if (o.heard !== null) heard.add(o.heard);
    if (o.wrong !== null) wrongs.push(o.wrong);
    if (o.hit) {
      hits.push(t / 1000);
      idx++;
      tr.setExpected(sequence[idx] ?? null, idx, t);
    }
  }
  return { hits, wrongs, heard };
}

describe('MicTracker (audio sintetizado)', () => {
  it('reconoce una melodía nota a nota', () => {
    const mel = [60, 62, 64, 65, 67, 72, 55, 48];
    const audio = synth(mel.map((midi, i) => ({ midi, start: 0.3 + i * 0.5, dur: 0.35 })), 5);
    const r = run(audio, mel.map((m) => [m]), { sensitivity: 0.5, octaveTolerant: false, chordTolerance: false });
    expect(r.hits.length).toBe(mel.length);
    expect(r.wrongs).toEqual([]);
    r.hits.forEach((t, i) => { expect(t).toBeGreaterThan(0.3 + i * 0.5); expect(t).toBeLessThan(0.3 + i * 0.5 + 0.3); });
  });
  it('nota equivocada: marca error y no da acierto', () => {
    const r = run(synth([{ midi: 62, start: 0.3, dur: 0.5 }], 1.2), [[60]]);
    expect(r.hits).toEqual([]);
    expect(r.wrongs).toEqual([62]);
  });
  it('no confunde una quinta por armónicos (se espera Sol, suena Do)', () => {
    const r = run(synth([{ midi: 60, start: 0.3, dur: 0.6 }], 1.3), [[67]]);
    expect(r.hits).toEqual([]);
  });
  it('tolerancia de octava: Do5 vale por Do4', () => {
    expect(run(synth([{ midi: 72, start: 0.3, dur: 0.5 }], 1.2), [[60]]).hits.length).toBe(1);
    const strict = { sensitivity: 0.5, octaveTolerant: false, chordTolerance: false };
    expect(run(synth([{ midi: 72, start: 0.3, dur: 0.5 }], 1.2), [[60]], strict).hits.length).toBe(0);
  });
  it('nota repetida: exige un ataque nuevo', () => {
    const one = run(synth([{ midi: 64, start: 0.3, dur: 1.2 }], 2), [[64], [64]]);
    expect(one.hits.length).toBe(1); // una nota larga no vale por dos
    const two = run(synth([{ midi: 64, start: 0.3, dur: 0.3 }, { midi: 64, start: 0.8, dur: 0.3 }], 1.6), [[64], [64]]);
    expect(two.hits.length).toBe(2);
  });
  it('acordes: tríada completa sí, nota suelta no', () => {
    const chord = [60, 64, 67];
    const full = synth(chord.map((midi) => ({ midi, start: 0.3, dur: 0.7, amp: 0.1 })), 1.4);
    expect(run(full, [chord]).hits.length).toBe(1);
    expect(run(synth([{ midi: 60, start: 0.3, dur: 0.7 }], 1.4), [chord]).hits.length).toBe(0);
    const wrongChord = synth([60, 65, 69].map((midi) => ({ midi, start: 0.3, dur: 0.7, amp: 0.1 })), 1.4);
    expect(run(wrongChord, [chord]).hits.length).toBe(0);
  });
  it('acorde grave de mano izquierda (Do3-Mi3-Sol3) y dos manos', () => {
    const low = [48, 52, 55];
    expect(run(synth(low.map((midi) => ({ midi, start: 0.3, dur: 0.9, amp: 0.1 })), 1.6), [low]).hits.length).toBe(1);
    const both = [48, 64];
    expect(run(synth(both.map((midi) => ({ midi, start: 0.3, dur: 0.9, amp: 0.1 })), 1.6), [both]).hits.length).toBe(1);
    expect(run(synth([{ midi: 64, start: 0.3, dur: 0.9 }], 1.6), [both]).hits.length).toBe(0);
  });
  it('el ruido de fondo no produce nada', () => {
    const r = run(synth([], 2, 0.003), [[60]]);
    expect(r.hits).toEqual([]);
    expect(r.wrongs).toEqual([]);
    expect(r.heard.size).toBe(0);
  });
});
