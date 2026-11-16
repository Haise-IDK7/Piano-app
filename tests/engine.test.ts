// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { zipSync, strToU8 } from 'fflate';
import { chordNotes, detectChord, midiToName, parseNoteName, rangeForKeys } from '../src/engine/theory';
import { buildEvents, fitToRange, type Note } from '../src/engine/song';
import { parseText } from '../src/engine/textFormat';
import { midiToSong, readMidi } from '../src/engine/midiImport';
import { mxlToXml, parseMusicXML } from '../src/engine/musicxml';
import { Matcher } from '../src/engine/matcher';
import { BUILTIN_SONGS } from '../src/content/songs';
import { LESSONS } from '../src/content/lessons';

describe('theory', () => {
  it('nombra notas en ambas notaciones', () => {
    expect(midiToName(60, 'latin', true)).toBe('Do4');
    expect(midiToName(61, 'english')).toBe('C#');
    expect(midiToName(69, 'latin')).toBe('La');
  });
  it('interpreta nombres', () => {
    expect(parseNoteName('Do')).toEqual({ pc: 0, octave: null });
    expect(parseNoteName('Sib3')).toEqual({ pc: 10, octave: 3 });
    expect(parseNoteName('F#5')).toEqual({ pc: 6, octave: 5 });
    expect(parseNoteName('Bb')).toEqual({ pc: 10, octave: null });
    expect(parseNoteName('Db')).toEqual({ pc: 1, octave: null });
    expect(parseNoteName('hola')).toBeNull();
  });
  it('acordes', () => {
    expect(chordNotes(60, 'min')).toEqual([60, 63, 67]);
    expect(detectChord([64, 67, 72])).toBe('Do');
    expect(detectChord([57, 60, 64], 'english')).toBe('Am');
    expect(rangeForKeys(61)).toEqual([36, 96]);
  });
});

describe('texto de notas', () => {
  it('melodía sin octavas usa la altura más cercana', () => {
    const { song, warnings } = parseText('bpm: 120\nDo Re Mi Fa Sol La Si Do');
    expect(warnings).toEqual([]);
    expect(song.notes.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(song.notes[1].start).toBeCloseTo(0.5);
  });
  it('duraciones, silencios, acordes y dos manos', () => {
    const { song } = parseText('titulo: Prueba\nbpm: 60\nD: C4:2 -:1 E4 | [C4 E4 G4]:2\nI: C3:4 G2:2');
    expect(song.title).toBe('Prueba');
    const r = song.notes.filter((n) => n.hand === 'R');
    const l = song.notes.filter((n) => n.hand === 'L');
    expect(r.map((n) => [n.midi, n.start])).toEqual([[60, 0], [64, 3], [60, 4], [64, 4], [67, 4]]);
    expect(l.map((n) => [n.midi, n.start])).toEqual([[48, 0], [43, 4]]);
    expect(buildEvents(song.notes, { R: true, L: true }).length).toBe(3);
    expect(buildEvents(song.notes, { R: true, L: false }).length).toBe(3);
  });
  it('avisa de símbolos desconocidos', () => {
    expect(parseText('Do xx Re').warnings.length).toBe(1);
    expect(parseText('Do [Mi Sol').warnings.length).toBeGreaterThan(0); // acorde a medio escribir: no debe fallar
    expect(parseText('[ ]: :: # [] -:x Do:0 Re:abc').song.notes.length).toBe(2);
  });
});

describe('rango', () => {
  it('transpone por octavas y pliega', () => {
    const notes: Note[] = [100, 103, 108].map((midi, i) => ({ midi, start: i, dur: 1, hand: 'R' }));
    const fit = fitToRange(notes, 36, 96);
    expect(fit.every((n) => n.midi >= 36 && n.midi <= 96)).toBe(true);
    expect(fit.map((n) => n.midi)).toEqual([88, 91, 96]);
  });
});

describe('MIDI', () => {
  it('ida y vuelta con dos pistas', () => {
    const m = new Midi();
    const a = m.addTrack(); a.name = 'Melodía';
    [72, 74, 76].forEach((midi, i) => a.addNote({ midi, time: i * 0.5, duration: 0.4 }));
    const b = m.addTrack();
    [48, 43].forEach((midi, i) => b.addNote({ midi, time: i, duration: 0.9 }));
    const imp = readMidi(m.toArray(), 'x.mid');
    expect(imp.tracks.map((t) => t.role)).toEqual(['R', 'L']);
    const song = midiToSong(imp);
    expect(song.notes.filter((n) => n.hand === 'R').map((n) => n.midi)).toEqual([72, 74, 76]);
    expect(song.notes.filter((n) => n.hand === 'L').length).toBe(2);
  });
  it('una pista se divide por Do central', () => {
    const m = new Midi();
    const a = m.addTrack();
    [48, 60, 72].forEach((midi, i) => a.addNote({ midi, time: i, duration: 0.5 }));
    const song = midiToSong(readMidi(m.toArray()));
    expect(song.notes.map((n) => n.hand)).toEqual(['L', 'R', 'R']);
  });
});

const XML = `<?xml version="1.0"?><score-partwise><work><work-title>Mini</work-title></work>
<part-list><score-part id="P1"/></part-list><part id="P1">
<measure number="1"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
<direction><sound tempo="120"/></direction>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><staff>1</staff></note>
<note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><staff>1</staff></note>
<note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><staff>1</staff></note>
<note><rest/><duration>2</duration><staff>1</staff></note>
<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><tie type="start"/><staff>1</staff></note>
<backup><duration>8</duration></backup>
<note><pitch><step>C</step><octave>3</octave></pitch><duration>8</duration><staff>2</staff></note>
</measure>
<measure number="2">
<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>4</duration><tie type="stop"/><staff>1</staff></note>
</measure></part></score-partwise>`;

describe('MusicXML', () => {
  it('lee notas, acordes, silencios, ligaduras y manos', () => {
    const song = parseMusicXML(XML);
    expect(song.title).toBe('Mini');
    expect(song.bpm).toBe(120);
    const r = song.notes.filter((n) => n.hand === 'R');
    expect(r.map((n) => [n.midi, n.start])).toEqual([[60, 0], [64, 0.5], [67, 0.5], [66, 1.5]]);
    expect(r[3].dur).toBeGreaterThan(1.3); // ligadura: 0,5 + 1 s
    expect(song.notes.filter((n) => n.hand === 'L').map((n) => n.midi)).toEqual([48]);
  });
  it('lee .mxl comprimido', () => {
    const zip = zipSync({
      'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>'),
      'score.xml': strToU8(XML),
    });
    expect(parseMusicXML(mxlToXml(zip)).notes.length).toBe(5);
  });
});

describe('Matcher', () => {
  const song = parseText('bpm: 60\nC4 [E4 G4] D4 C4').song;
  const events = buildEvents(song.notes, { R: true, L: true });
  it('modo espera: acorde nota a nota, error y repetida', () => {
    const m = new Matcher(events, { mode: 'wait', window: 0.2, octaveTolerant: false });
    expect(m.noteOn(60, 0)).toBe('hit');
    expect(m.noteOn(64, 0)).toBe('partial');
    expect(m.noteOn(64, 0)).toBe('ignored');
    expect(m.noteOn(65, 0)).toBe('wrong');
    expect(m.noteOn(67, 0)).toBe('hit');
    expect(m.noteOn(62, 0)).toBe('hit');
    expect(m.noteOn(60, 0)).toBe('hit');
    expect(m.done()).toBe(true);
    const s = m.stats();
    expect(s.hits).toBe(4);
    expect(s.accuracy).toBeCloseTo(0.75);
    expect(m.trouble.get(64)).toBe(1);
  });
  it('tolerancia de octava', () => {
    const m = new Matcher(events, { mode: 'wait', window: 0.2, octaveTolerant: true });
    expect(m.noteOn(72, 0)).toBe('hit');
  });
  it('tiempo real: omitidas, demasiado pronto y reinicio', () => {
    const m = new Matcher(events, { mode: 'realtime', window: 0.2, octaveTolerant: false });
    expect(m.noteOn(60, 0.05)).toBe('hit');
    expect(m.tick(1.5).length).toBe(1); // acorde del segundo 1 omitido
    expect(m.noteOn(62, 2.1)).toBe('hit');
    expect(m.noteOn(60, 2.2)).toBe('wrong'); // el Do final (t=3) aún está lejos
    expect(m.micHit(2.2)).toBe(false);
    expect(m.micHit(2.9)).toBe(true);
    const s = m.stats();
    expect([s.hits, s.misses, s.wrong]).toEqual([3, 1, 1]);
    m.reset(2);
    expect(m.current()?.time).toBe(2);
    expect(m.stats().wrong).toBe(0);
  });
});

describe('contenido', () => {
  it('todas las canciones incluidas son válidas', () => {
    expect(BUILTIN_SONGS.length).toBeGreaterThanOrEqual(12);
    for (const s of BUILTIN_SONGS) {
      expect(s.notes.length, s.title).toBeGreaterThan(8);
      expect(s.duration, s.title).toBeGreaterThan(3);
      expect(s.notes.every((n) => n.midi >= 36 && n.midi <= 96), s.title).toBe(true);
    }
    expect(new Set(BUILTIN_SONGS.map((s) => s.id)).size).toBe(BUILTIN_SONGS.length);
  });
  it('todas las lecciones tienen ejercicio', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(10);
    for (const l of LESSONS) expect(l.song.notes.length, l.title).toBeGreaterThan(2);
  });
});
