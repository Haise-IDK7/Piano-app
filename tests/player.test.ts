import { describe, expect, it, vi } from 'vitest';
import { Player, type Feedback, type PlayerConfig } from '../src/engine/player';
import { parseText } from '../src/engine/textFormat';
import type { Synth } from '../src/engine/synth';
import type { Stats } from '../src/engine/matcher';

const fakeSynth = { noteOn: vi.fn(), noteOff: vi.fn(), allOff: vi.fn(), click: vi.fn(), resume: vi.fn() } as unknown as Synth;
const base: PlayerConfig = {
  mode: 'wait', speed: 1, hands: { R: true, L: true }, autoplayOther: true, loop: null, metronome: false, latency: 0,
  octaveTolerant: false, window: 0.2, errorPolicy: 'continue', repeatAfter: 2, ladder: false, muted: false,
};
const song = parseText('bpm: 60\nD: C4 D4 E4 F4 G4 A4 B4 C5\nI: C3:4 G3:4').song;

function make(cfg: Partial<PlayerConfig>) {
  const fb: Feedback[] = [];
  let done: Stats | null = null;
  const p = new Player(song, { ...base, ...cfg }, fakeSynth, { onFinish: (s) => { done = s; }, onFeedback: (f) => fb.push(f) });
  const run = (sec: number) => { for (let i = 0; i < sec * 50; i++) p.update(0.02); };
  return { p, fb, run, done: () => done };
}

describe('Player', () => {
  it('modo espera: se detiene en cada nota hasta acertarla', () => {
    const { p, run, done } = make({ hands: { R: true, L: false } });
    p.play();
    run(5);
    expect(p.time).toBeCloseTo(0, 5); // esperando el primer Do
    p.noteOn(62); // error
    p.noteOn(60);
    run(5);
    expect(p.time).toBeCloseTo(1, 5);
    for (const m of [62, 64, 65, 67, 69, 71, 72]) { p.noteOn(m); run(1.2); }
    run(2);
    expect(done()).not.toBeNull();
    expect(done()!.hits).toBe(8);
    expect(done()!.accuracy).toBeCloseTo(7 / 8);
  });
  it('la otra mano suena sola y se silencia con micrófono sin audífonos', () => {
    (fakeSynth.noteOn as ReturnType<typeof vi.fn>).mockClear();
    const a = make({ mode: 'realtime', hands: { R: true, L: false } });
    a.p.play(); a.run(4);
    expect((fakeSynth.noteOn as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual([48]);
    (fakeSynth.noteOn as ReturnType<typeof vi.fn>).mockClear();
    const b = make({ mode: 'realtime', hands: { R: true, L: false }, muted: true });
    b.p.play(); b.run(4);
    expect(fakeSynth.noteOn).not.toHaveBeenCalled();
  });
  it('tiempo real: omite notas y termina con estadísticas', () => {
    const { p, run, done, fb } = make({ mode: 'realtime', hands: { R: true, L: false } });
    p.play();
    run(1.5); // preroll → t≈0
    p.noteOn(60);
    run(12);
    expect(done()!.hits).toBe(1);
    expect(done()!.misses).toBe(7);
    expect(fb.filter((f) => f.kind === 'miss').length).toBe(7);
  });
  it('política "repetir sección" rebobina tras N errores', () => {
    const { p, run, fb } = make({ mode: 'realtime', errorPolicy: 'repeat', repeatAfter: 2, hands: { R: true, L: false } });
    p.play();
    run(4.5);
    expect(fb.some((f) => f.kind === 'rewind')).toBe(true);
    expect(p.time).toBeLessThan(1);
  });
  it('bucle con escalera de tempo sube la velocidad tras una pasada limpia', () => {
    const { p, run, fb } = make({ hands: { R: true, L: false }, loop: { start: 0, end: 4 }, ladder: true, speed: 0.5 });
    p.play();
    for (const m of [60, 62, 64, 65]) { run(3); p.noteOn(m); }
    run(4);
    const loop = fb.find((f) => f.kind === 'loop');
    expect(loop && loop.kind === 'loop' && loop.speed).toBeCloseTo(0.6);
    expect(p.matcher.current()?.time).toBe(0);
  });
  it('micrófono: un acierto avanza y rearma el siguiente evento', () => {
    const { p, run } = make({ hands: { R: true, L: false } });
    const tracker = { setExpected: vi.fn() };
    p.play(); run(2);
    const out = { level: 0.1, active: true, onset: false, heard: null, hit: false, wrong: null };
    p.micOutput(out, tracker as never, 0);
    expect(tracker.setExpected.mock.calls.at(-1)![0]).toEqual([60]);
    p.micOutput({ ...out, hit: true }, tracker as never, 10);
    expect(tracker.setExpected.mock.calls.at(-1)![0]).toEqual([62]);
    p.micOutput({ ...out, wrong: 70 }, tracker as never, 20);
    expect(p.matcher.stats().wrong).toBe(1);
  });
});
