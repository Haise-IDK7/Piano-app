// Importación de MusicXML (.musicxml/.xml) y MusicXML comprimido (.mxl).
import { unzipSync, strFromU8 } from 'fflate';
import { finalizeSong, newId, type Hand, type Note, type SongDoc } from './song';
import { estimateDifficulty } from './midiImport';

const STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const txt = (el: Element | null | undefined) => el?.textContent?.trim() ?? '';
const child = (el: Element, name: string) => {
  for (const c of Array.from(el.children)) if (c.tagName === name) return c;
  return null;
};

export function parseMusicXML(xml: string, fileName = 'Canción'): SongDoc {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('El archivo MusicXML no es válido.');
  const parts = Array.from(doc.getElementsByTagName('part'));
  if (!parts.length) throw new Error('El archivo no contiene partes (¿es MusicXML "partwise"?).');

  let bpm = 0;
  const sound = Array.from(doc.getElementsByTagName('sound')).find((s) => s.getAttribute('tempo'));
  if (sound) bpm = Number(sound.getAttribute('tempo'));
  if (!bpm) bpm = Number(txt(doc.getElementsByTagName('per-minute')[0])) || 100;
  const beat = 60 / bpm;
  let beatsPerBar = 4;

  const notes: Note[] = [];
  parts.forEach((part, partIdx) => {
    let divisions = 1;
    let cursor = 0; // en negras
    let lastStart = 0;
    const open = new Map<string, Note>(); // notas ligadas pendientes
    for (const measure of Array.from(part.children).filter((c) => c.tagName === 'measure')) {
      let maxCursor = cursor;
      for (const el of Array.from(measure.children)) {
        if (el.tagName === 'attributes') {
          const d = Number(txt(child(el, 'divisions')));
          if (d > 0) divisions = d;
          const time = child(el, 'time');
          if (time && partIdx === 0) {
            const b = Number(txt(child(time, 'beats')));
            const bt = Number(txt(child(time, 'beat-type'))) || 4;
            if (b > 0) beatsPerBar = (b * 4) / bt;
          }
        } else if (el.tagName === 'backup') {
          cursor -= Number(txt(child(el, 'duration'))) / divisions;
        } else if (el.tagName === 'forward') {
          cursor += Number(txt(child(el, 'duration'))) / divisions;
        } else if (el.tagName === 'note') {
          if (child(el, 'grace')) continue;
          const dur = Number(txt(child(el, 'duration'))) / divisions;
          const isChord = !!child(el, 'chord');
          const start = isChord ? lastStart : cursor;
          const pitch = child(el, 'pitch');
          if (pitch && dur > 0) {
            const midi = 12 * (Number(txt(child(pitch, 'octave'))) + 1) + (STEPS[txt(child(pitch, 'step'))] ?? 0) +
              (Number(txt(child(pitch, 'alter'))) || 0);
            const staff = Number(txt(child(el, 'staff'))) || 0;
            const hand: Hand = staff ? (staff >= 2 ? 'L' : 'R') : partIdx === 0 ? 'R' : 'L';
            const ties = Array.from(el.children).filter((c) => c.tagName === 'tie').map((t) => t.getAttribute('type'));
            const key = `${hand}:${midi}`;
            const prev = open.get(key);
            if (ties.includes('stop') && prev) {
              prev.dur = start * beat + dur * beat - prev.start;
              if (!ties.includes('start')) open.delete(key);
            } else {
              const n: Note = { midi, start: start * beat, dur: dur * beat, hand };
              notes.push(n);
              if (ties.includes('start')) open.set(key, n);
            }
          }
          if (!isChord) { lastStart = cursor; cursor += dur; }
        }
        if (cursor > maxCursor) maxCursor = cursor;
      }
      cursor = maxCursor;
    }
  });
  for (const n of notes) n.dur = Math.max(0.05, n.dur * 0.95);

  const title = txt(doc.getElementsByTagName('work-title')[0]) || txt(doc.getElementsByTagName('movement-title')[0]) ||
    fileName.replace(/\.(musicxml|xml|mxl)$/i, '');
  const composer = txt(Array.from(doc.getElementsByTagName('creator')).find((c) => c.getAttribute('type') === 'composer'));
  return finalizeSong({
    id: newId(), title, composer: composer || undefined, source: 'musicxml',
    difficulty: estimateDifficulty(notes), bpm: Math.round(bpm), beatsPerBar: Math.max(1, Math.round(beatsPerBar)), notes,
  });
}

/** Extrae el XML principal de un .mxl (zip). */
export function mxlToXml(data: Uint8Array): string {
  const files = unzipSync(data);
  let root: string | undefined;
  const container = files['META-INF/container.xml'];
  if (container) root = /full-path="([^"]+)"/.exec(strFromU8(container))?.[1];
  if (!root || !files[root]) {
    root = Object.keys(files).find((f) => !f.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(f));
  }
  if (!root) throw new Error('El .mxl no contiene una partitura.');
  return strFromU8(files[root]);
}
