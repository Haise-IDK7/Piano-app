// Importación de archivos MIDI estándar (.mid) a pistas asignables a manos.
import { Midi } from '@tonejs/midi';
import { finalizeSong, newId, splitHands, type Hand, type Note, type SongDoc } from './song';

export type TrackRole = Hand | 'split' | 'skip';

export interface ImportTrack {
  name: string;
  noteCount: number;
  avgPitch: number;
  notes: { midi: number; start: number; dur: number }[];
  role: TrackRole;
}

export interface MidiImport { title: string; bpm: number; beatsPerBar: number; tracks: ImportTrack[] }

export function readMidi(data: ArrayBuffer | Uint8Array, fileName = 'Canción'): MidiImport {
  const midi = new Midi(data as ArrayBuffer);
  const tracks: ImportTrack[] = [];
  midi.tracks.forEach((t, i) => {
    if (!t.notes.length || t.instrument?.percussion || t.channel === 9) return;
    const notes = t.notes.map((n) => ({ midi: n.midi, start: n.time, dur: Math.max(0.05, n.duration) }));
    tracks.push({
      name: t.name?.trim() || t.instrument?.name || `Pista ${i + 1}`,
      noteCount: notes.length,
      avgPitch: notes.reduce((s, n) => s + n.midi, 0) / notes.length,
      notes,
      role: 'skip',
    });
  });
  assignDefaultRoles(tracks);
  return {
    title: midi.name?.trim() || fileName.replace(/\.(mid|midi)$/i, ''),
    bpm: Math.round(midi.header.tempos[0]?.bpm ?? 120),
    beatsPerBar: midi.header.timeSignatures[0]?.timeSignature?.[0] ?? 4,
    tracks,
  };
}

/** 1 pista → dividir por Do central; 2+ → las dos con más notas (la aguda = derecha). */
export function assignDefaultRoles(tracks: ImportTrack[]): void {
  if (tracks.length === 1) { tracks[0].role = 'split'; return; }
  const top = [...tracks].sort((a, b) => b.noteCount - a.noteCount).slice(0, 2);
  if (top.length === 2) {
    const [hi, lo] = top[0].avgPitch >= top[1].avgPitch ? top : [top[1], top[0]];
    hi.role = 'R';
    lo.role = 'L';
  }
}

export function midiToSong(imp: MidiImport, splitPoint = 60): SongDoc {
  let notes: Note[] = [];
  for (const t of imp.tracks) {
    if (t.role === 'skip') continue;
    if (t.role === 'split') notes = notes.concat(splitHands(t.notes.map((n) => ({ ...n, hand: 'R' as Hand })), splitPoint));
    else notes = notes.concat(t.notes.map((n) => ({ ...n, hand: t.role as Hand })));
  }
  return finalizeSong({
    id: newId(), title: imp.title, source: 'midi', difficulty: estimateDifficulty(notes),
    bpm: imp.bpm, beatsPerBar: imp.beatsPerBar, notes,
  });
}

export function estimateDifficulty(notes: Note[]): number {
  if (!notes.length) return 1;
  const dur = Math.max(1, notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0));
  const density = notes.length / dur; // notas por segundo
  const twoHands = notes.some((n) => n.hand === 'L') && notes.some((n) => n.hand === 'R');
  return Math.max(1, Math.min(10, Math.round(density * 1.3 + (twoHands ? 2 : 0))));
}
