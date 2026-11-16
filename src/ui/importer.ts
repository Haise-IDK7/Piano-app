// Convierte un archivo del usuario en canción según su extensión.
import { finalizeSong, newId, type SongDoc } from '../engine/song';
import { readMidi, type MidiImport } from '../engine/midiImport';
import { mxlToXml, parseMusicXML } from '../engine/musicxml';
import { parseText } from '../engine/textFormat';

export type ImportResult = { kind: 'song'; song: SongDoc; warnings: string[] } | { kind: 'midi'; imp: MidiImport };

export const ACCEPT = '.mid,.midi,.musicxml,.xml,.mxl,.txt,.json';

export async function importFile(file: File): Promise<ImportResult> {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const base = file.name.replace(/\.[^.]+$/, '');
  if (ext === 'mid' || ext === 'midi') {
    const imp = readMidi(await file.arrayBuffer(), file.name);
    if (!imp.tracks.length) throw new Error('El MIDI no contiene notas de instrumentos melódicos.');
    return { kind: 'midi', imp };
  }
  if (ext === 'musicxml' || ext === 'xml') return { kind: 'song', song: parseMusicXML(await file.text(), file.name), warnings: [] };
  if (ext === 'mxl') return { kind: 'song', song: parseMusicXML(mxlToXml(new Uint8Array(await file.arrayBuffer())), file.name), warnings: [] };
  if (ext === 'txt') {
    const r = parseText(await file.text(), { title: base });
    if (!r.song.notes.length) throw new Error('No encontré notas en el texto.');
    return { kind: 'song', song: r.song, warnings: r.warnings };
  }
  if (ext === 'json') {
    const j = JSON.parse(await file.text()) as Partial<SongDoc>;
    if (!Array.isArray(j.notes) || !j.notes.length) throw new Error('El JSON no es una canción de Piano App.');
    const notes = j.notes
      .filter((n) => typeof n?.midi === 'number' && typeof n.start === 'number' && typeof n.dur === 'number')
      .map((n) => ({ midi: Math.round(n.midi), start: n.start, dur: n.dur, hand: n.hand === 'L' ? ('L' as const) : ('R' as const) }));
    return {
      kind: 'song', warnings: [],
      song: finalizeSong({
        id: newId(), title: String(j.title ?? base), composer: j.composer ? String(j.composer) : undefined, source: 'json',
        difficulty: Number(j.difficulty) || 3, bpm: Number(j.bpm) || 100, beatsPerBar: Number(j.beatsPerBar) || 4, notes,
      }),
    };
  }
  throw new Error(`Formato .${ext} no admitido. Usa MIDI (.mid), MusicXML (.musicxml, .xml, .mxl) o texto de notas (.txt).`);
}
