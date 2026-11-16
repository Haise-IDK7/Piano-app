// Importador de "texto de notas": convierte texto como
//   Mi Mi Fa Sol | Sol Fa Mi Re      o      C4 D4 E4:2 -:1 [C4 E4 G4]:4
// en un SongDoc. Ver docs/PLAN_Piano-app_v2.txt sección 5.3.
import { parseNoteName, pcOctToMidi } from './theory';
import { finalizeSong, newId, type Hand, type Note, type SongDoc } from './song';

function parseDur(s: string | undefined): number {
  if (!s) return 1;
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    return b ? a / b : 1;
  }
  const v = Number(s);
  return v > 0 ? v : 1;
}

export interface TextParseResult { song: SongDoc; warnings: string[] }

export function parseText(text: string, opts: Partial<Pick<SongDoc, 'id' | 'title' | 'composer' | 'difficulty' | 'source' | 'tags'>> = {}): TextParseResult {
  const warnings: string[] = [];
  let title = opts.title ?? 'Canción sin título';
  let composer = opts.composer;
  let bpm = 100;
  let beatsPerBar = 4;
  const voices: Record<Hand, string[]> = { R: [], L: [] };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;
    const head = /^(titulo|título|title|bpm|tempo|compas|compás|autor|composer)\s*:\s*(.*)$/i.exec(line);
    if (head) {
      const key = head[1].toLowerCase();
      const val = head[2].trim();
      if (key.startsWith('t') && key !== 'tempo') title = val || title;
      else if (key === 'bpm' || key === 'tempo') bpm = Math.min(300, Math.max(20, Number(val) || 100));
      else if (key.startsWith('comp') && key !== 'composer') beatsPerBar = parseInt(val, 10) || 4;
      else composer = val;
      continue;
    }
    const voice = /^(d|r|i|l)\s*:\s+(.*)$/i.exec(line);
    if (voice) {
      const h: Hand = /[dr]/i.test(voice[1]) ? 'R' : 'L';
      voices[h].push(voice[2]);
    } else voices.R.push(line);
  }

  const beat = 60 / bpm;
  const notes: Note[] = [];
  for (const hand of ['R', 'L'] as Hand[]) {
    let t = 0;
    let prev: number | null = null;
    const defOct = hand === 'R' ? 4 : 3;
    const resolve = (tok: string): number | null => {
      const p = parseNoteName(tok);
      if (!p) return null;
      let midi: number;
      if (p.octave !== null) midi = pcOctToMidi(p.pc, p.octave);
      else if (prev === null) midi = pcOctToMidi(p.pc, defOct);
      else {
        // Sin octava: la altura más cercana a la nota anterior.
        midi = pcOctToMidi(p.pc, Math.floor(prev / 12) - 1);
        if (midi - prev > 6) midi -= 12;
        else if (prev - midi > 6) midi += 12;
      }
      prev = midi;
      return midi;
    };
    const tokens = voices[hand].join(' ').match(/\[[^\]]*\](?::[\d./]+)?|\S+/g) ?? [];
    for (const tok of tokens) {
      if (/^\|+$/.test(tok)) continue;
      if (tok.startsWith('[')) {
        const m = /^\[([^\]]*)\](?::([\d./]+))?$/.exec(tok);
        if (!m) { warnings.push(`Acorde sin cerrar: "${tok}"`); continue; }
        const d = parseDur(m[2]) * beat;
        const keep: number | null = prev;
        let first: number | null = null;
        for (const inner of m[1].trim().split(/\s+/).filter(Boolean)) {
          const midi = resolve(inner);
          if (midi === null) { warnings.push(`No entiendo "${inner}"`); continue; }
          if (first === null) first = midi;
          notes.push({ midi, start: t, dur: d * 0.95, hand });
        }
        prev = first ?? keep;
        t += d;
        continue;
      }
      const [name, durS] = tok.split(':');
      const d = parseDur(durS) * beat;
      if (/^(-|_|z)$/i.test(name)) { t += d; continue; }
      const midi = resolve(name);
      if (midi === null) { warnings.push(`No entiendo "${tok}"`); continue; }
      notes.push({ midi, start: t, dur: d * 0.95, hand });
      t += d;
    }
  }

  const song = finalizeSong({
    id: opts.id ?? newId(),
    title,
    composer,
    source: opts.source ?? 'text',
    difficulty: opts.difficulty ?? 2,
    bpm,
    beatsPerBar,
    notes,
    tags: opts.tags,
  });
  return { song, warnings };
}
