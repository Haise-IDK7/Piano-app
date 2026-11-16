// Formato interno de canción (SongDoc) y utilidades de arreglo.
export type Hand = 'R' | 'L';

export interface Note { midi: number; start: number; dur: number; hand: Hand }
export interface Section { name: string; start: number; end: number }

export interface SongDoc {
  id: string;
  title: string;
  composer?: string;
  source: 'builtin' | 'midi' | 'musicxml' | 'text' | 'json';
  difficulty: number; // 1..10
  bpm: number;
  beatsPerBar: number;
  notes: Note[];
  sections: Section[];
  duration: number;
  tags?: string[];
}

export interface NoteEvent { index: number; time: number; notes: Note[] }

/** Agrupa las notas que empiezan (casi) a la vez en eventos: nota suelta o acorde. */
export function buildEvents(notes: Note[], hands: { R: boolean; L: boolean }, eps = 0.03): NoteEvent[] {
  const active = notes.filter((n) => hands[n.hand]).sort((a, b) => a.start - b.start || a.midi - b.midi);
  const events: NoteEvent[] = [];
  for (const n of active) {
    const last = events[events.length - 1];
    if (last && n.start - last.time <= eps) {
      if (!last.notes.some((x) => x.midi === n.midi)) last.notes.push(n);
    } else events.push({ index: events.length, time: n.start, notes: [n] });
  }
  return events;
}

export function autoSections(duration: number, bpm: number, beatsPerBar: number, barsPer = 4): Section[] {
  const len = (60 / bpm) * beatsPerBar * barsPer;
  if (!(len > 0) || duration <= 0) return [{ name: '1', start: 0, end: duration }];
  const out: Section[] = [];
  let count = Math.max(1, Math.ceil(duration / len - 0.25));
  if (count > 40) { count = 40; }
  const step = count === 40 ? duration / 40 : len;
  for (let i = 0; i < count; i++) {
    out.push({ name: String(i + 1), start: i * step, end: i === count - 1 ? duration : (i + 1) * step });
  }
  return out;
}

export function finalizeSong(p: Omit<SongDoc, 'duration' | 'sections'> & { sections?: Section[] }): SongDoc {
  const notes = p.notes
    .filter((n) => n.dur > 0 && n.midi >= 0 && n.midi <= 127)
    .sort((a, b) => a.start - b.start || a.midi - b.midi);
  // Quitar silencio inicial
  const t0 = notes.length ? notes[0].start : 0;
  if (t0 > 0.05) for (const n of notes) n.start -= t0;
  const duration = notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0);
  return {
    ...p,
    notes,
    duration,
    sections: p.sections?.length ? p.sections : autoSections(duration, p.bpm, p.beatsPerBar),
  };
}

/** Separa por punto de división (por defecto Do central): >= split → derecha. */
export function splitHands(notes: Note[], split = 60): Note[] {
  return notes.map((n) => ({ ...n, hand: n.midi >= split ? 'R' : 'L' }));
}

/**
 * Ajusta las notas al rango [lo, hi] del teclado: primero transpone cada mano
 * por octavas completas (la que deja menos notas fuera) y después pliega las
 * notas que aún queden fuera.
 */
export function fitToRange(notes: Note[], lo: number, hi: number): Note[] {
  const out: Note[] = [];
  for (const hand of ['R', 'L'] as Hand[]) {
    const hs = notes.filter((n) => n.hand === hand);
    if (!hs.length) continue;
    let best = 0, bestOut = Infinity;
    for (const shift of [0, 12, -12, 24, -24, 36, -36]) {
      const outside = hs.filter((n) => n.midi + shift < lo || n.midi + shift > hi).length;
      if (outside < bestOut) { bestOut = outside; best = shift; }
    }
    for (const n of hs) {
      let m = n.midi + best;
      while (m < lo) m += 12;
      while (m > hi) m -= 12;
      out.push({ ...n, midi: m });
    }
  }
  return out.sort((a, b) => a.start - b.start || a.midi - b.midi);
}

export function songRange(notes: Note[]): [number, number] {
  let lo = 127, hi = 0;
  for (const n of notes) { if (n.midi < lo) lo = n.midi; if (n.midi > hi) hi = n.midi; }
  return notes.length ? [lo, hi] : [60, 72];
}

export const newId = () => `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
