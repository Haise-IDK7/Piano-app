// Teoría musical básica: nombres de notas, frecuencias y acordes.
export type Notation = 'latin' | 'english';

const LATIN = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const ENGLISH = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK = [false, true, false, true, false, false, true, false, true, false, true, false];

export const pc = (midi: number) => ((midi % 12) + 12) % 12;
export const isBlack = (midi: number) => BLACK[pc(midi)];
export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1; // Do4 = 60 = Do central

export function midiToName(midi: number, notation: Notation = 'latin', withOctave = false): string {
  const name = (notation === 'latin' ? LATIN : ENGLISH)[pc(midi)];
  return withOctave ? `${name}${octaveOf(midi)}` : name;
}

export const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
export const freqToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);

const STEP: Record<string, number> = {
  do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11,
  c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
};

export interface ParsedName { pc: number; octave: number | null }

/** Acepta "Do", "Re#", "Sib4", "C4", "F#3", "Bb"… Devuelve null si no es una nota. */
export function parseNoteName(raw: string): ParsedName | null {
  const m = /^(do|re|mi|fa|sol|la|si|[a-g])(#|♯|b|♭)?(-?\d)?$/i.exec(raw.trim());
  if (!m) return null;
  let p = STEP[m[1].toLowerCase()];
  if (m[2] === '#' || m[2] === '♯') p += 1;
  else if (m[2]) p -= 1;
  return { pc: ((p % 12) + 12) % 12, octave: m[3] !== undefined ? parseInt(m[3], 10) : null };
}

export const pcOctToMidi = (pitchClass: number, octave: number) => 12 * (octave + 1) + pitchClass;

export const CHORD_TYPES: { id: string; label: string; suffix: string; intervals: number[] }[] = [
  { id: 'maj', label: 'Mayor', suffix: '', intervals: [0, 4, 7] },
  { id: 'min', label: 'Menor', suffix: 'm', intervals: [0, 3, 7] },
  { id: '7', label: 'Séptima', suffix: '7', intervals: [0, 4, 7, 10] },
  { id: 'maj7', label: 'Mayor 7', suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { id: 'm7', label: 'Menor 7', suffix: 'm7', intervals: [0, 3, 7, 10] },
  { id: 'dim', label: 'Disminuido', suffix: 'dim', intervals: [0, 3, 6] },
  { id: 'aug', label: 'Aumentado', suffix: 'aug', intervals: [0, 4, 8] },
  { id: 'sus4', label: 'Sus4', suffix: 'sus4', intervals: [0, 5, 7] },
];

export function chordNotes(root: number, typeId: string): number[] {
  const t = CHORD_TYPES.find((c) => c.id === typeId) ?? CHORD_TYPES[0];
  return t.intervals.map((i) => root + i);
}

/** Reconoce el acorde formado por un conjunto de notas (cualquier inversión). */
export function detectChord(midis: number[], notation: Notation = 'latin'): string | null {
  const set = [...new Set(midis.map(pc))].sort((a, b) => a - b);
  if (set.length < 3) return null;
  for (const root of set) {
    const rel = set.map((p) => (p - root + 12) % 12).sort((a, b) => a - b);
    for (const t of CHORD_TYPES) {
      if (t.intervals.length === rel.length && t.intervals.every((v, i) => v === rel[i])) {
        return midiToName(root, notation) + t.suffix;
      }
    }
  }
  return null;
}

/** Rango MIDI [lo, hi] típico según el número de teclas del teclado. */
export function rangeForKeys(keys: number): [number, number] {
  switch (keys) {
    case 49: return [36, 84];
    case 54: return [36, 89];
    case 61: return [36, 96];
    case 76: return [28, 103];
    default: return [21, 108];
  }
}
