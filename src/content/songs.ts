// Biblioteca incluida: melodías de DOMINIO PÚBLICO codificadas a mano en el
// formato de texto de la app (nota + octava + :duración en pulsos).
import { parseText } from '../engine/textFormat';
import type { SongDoc } from '../engine/song';

interface Def { id: string; title: string; composer: string; difficulty: number; tags: string[]; text: string }

const TWINKLE_L = 'C3:4 | F3:2 C3:2 | F3:2 C3:2 | G3:2 C3:2 |';
const ELISA_A = 'E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 | A4:1 -:0.5 C4:0.5 E4:0.5 A4:0.5 |';
const CANON_L = 'D3:2 A2:2 B2:2 F#2:2 G2:2 D2:2 G2:2 A2:2';
const GRUTA = `A3:0.5 B3:0.5 C4:0.5 D4:0.5 E4:0.5 C4:0.5 E4:1 | D#4:0.5 B3:0.5 D#4:1 D4:0.5 Bb3:0.5 D4:1 |
 A3:0.5 B3:0.5 C4:0.5 D4:0.5 E4:0.5 C4:0.5 E4:0.5 A4:0.5 | G4:0.5 E4:0.5 C4:0.5 E4:0.5 G4:2 |`;
const MINUET_1_6 = `D5:1 G4:0.5 A4:0.5 B4:0.5 C5:0.5 | D5:1 G4:1 G4:1 | E5:1 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 | G5:1 G4:1 G4:1 |
 C5:1 D5:0.5 C5:0.5 B4:0.5 A4:0.5 | B4:1 C5:0.5 B4:0.5 A4:0.5 G4:0.5 |`;

const DEFS: Def[] = [
  {
    id: 'estrellita', title: 'Estrellita, ¿dónde estás?', composer: 'Tradicional', difficulty: 1, tags: ['infantil', 'dos manos'],
    text: `bpm: 100
D: C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 |
D: G4 G4 F4 F4 | E4 E4 D4:2 | G4 G4 F4 F4 | E4 E4 D4:2 |
D: C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2
I: ${TWINKLE_L} C3:2 F3:2 | C3:2 G3:2 | C3:2 F3:2 | C3:2 G3:2 | ${TWINKLE_L}`,
  },
  {
    id: 'oda-alegria', title: 'Oda a la Alegría', composer: 'L. van Beethoven', difficulty: 2, tags: ['clásica', 'dos manos'],
    text: `bpm: 108
D: E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:0.5 D4:2 |
D: E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2 |
D: D4 D4 E4 C4 | D4 E4:0.5 F4:0.5 E4 C4 | D4 E4:0.5 F4:0.5 E4 D4 | C4 D4 G3:2 |
D: E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2
I: C3:4 | G3:4 | C3:4 | C3:2 G3:2 | C3:4 | G3:4 | C3:4 | G3:2 C3:2 |
I: G3:4 | G3:4 | G3:4 | C3:2 G3:2 | C3:4 | G3:4 | C3:4 | G3:2 C3:2`,
  },
  {
    id: 'mary', title: 'Mary tenía un corderito', composer: 'Tradicional', difficulty: 1, tags: ['infantil', 'una mano'],
    text: `bpm: 110
E4 D4 C4 D4 | E4 E4 E4:2 | D4 D4 D4:2 | E4 G4 G4:2 | E4 D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4:4`,
  },
  {
    id: 'martinillo', title: 'Martinillo (Frère Jacques)', composer: 'Tradicional', difficulty: 1, tags: ['infantil', 'una mano'],
    text: `bpm: 110
C4 D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4:2 | E4 F4 G4:2 |
G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 | G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 | C4 G3 C4:2 | C4 G3 C4:2`,
  },
  {
    id: 'jingle-bells', title: 'Jingle Bells (estribillo)', composer: 'J. Pierpont', difficulty: 2, tags: ['navidad', 'dos manos'],
    text: `bpm: 120
D: E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:0.5 | E4:4 | F4 F4 F4:1.5 F4:0.5 | F4 E4 E4 E4:0.5 E4:0.5 | E4 D4 D4 E4 | D4:2 G4:2 |
D: E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:0.5 | E4:4 | F4 F4 F4:1.5 F4:0.5 | F4 E4 E4 E4:0.5 E4:0.5 | G4 G4 F4 D4 | C4:4
I: C3:4 | C3:4 | C3:4 | C3:4 | F3:4 | C3:4 | G3:4 | G3:4 | C3:4 | C3:4 | C3:4 | C3:4 | F3:4 | C3:4 | G3:4 | C3:4`,
  },
  {
    id: 'au-clair', title: 'Au clair de la lune', composer: 'Tradicional francesa', difficulty: 1, tags: ['infantil', 'una mano'],
    text: `bpm: 100
C4 C4 C4 D4 | E4:2 D4:2 | C4 E4 D4 D4 | C4:4 | C4 C4 C4 D4 | E4:2 D4:2 | C4 E4 D4 D4 | C4:4 |
D4 D4 D4 D4 | A3:2 A3:2 | D4 C4 B3 A3 | G3:4 | C4 C4 C4 D4 | E4:2 D4:2 | C4 E4 D4 D4 | C4:4`,
  },
  {
    id: 'saints', title: 'When the Saints Go Marching In', composer: 'Tradicional', difficulty: 2, tags: ['jazz', 'una mano'],
    text: `bpm: 120
C4 E4 F4 | G4:4 | -:1 C4 E4 F4 | G4:4 | -:1 C4 E4 F4 | G4:2 E4:2 | C4:2 E4:2 | D4:4 |
-:1 E4 E4 D4 | C4:3 C4 | E4:2 G4:2 | G4 F4:3 | -:2 E4 F4 | G4:2 E4:2 | C4:2 D4:2 | C4:4`,
  },
  {
    id: 'aura-lee', title: 'Aura Lee', composer: 'G. R. Poulton', difficulty: 2, tags: ['balada', 'una mano'],
    text: `bpm: 96
G3 C4 B3 C4 | D4 A3 D4:2 | C4 B3 A3 B3 | C4:4 | G3 C4 B3 C4 | D4 A3 D4:2 | C4 B3 A3 B3 | C4:4 |
E4 E4 E4:2 | E4 E4 E4:2 | E4 D4 C4 D4 | E4:4 | E4 E4 F4 E4 | D4 A3 D4:2 | C4 B3 A3 B3 | C4:4`,
  },
  {
    id: 'cumpleanos', title: 'Cumpleaños feliz', composer: 'Tradicional', difficulty: 2, tags: ['fiesta', 'una mano'],
    text: `bpm: 100
compas: 3
G4:0.75 G4:0.25 | A4 G4 C5 | B4:2 G4:0.75 G4:0.25 | A4 G4 D5 | C5:2 G4:0.75 G4:0.25 | G5 E5 C5 | B4 A4 F5:0.75 F5:0.25 | E5 C5 D5 | C5:3`,
  },
  {
    id: 'cuna-brahms', title: 'Canción de cuna', composer: 'J. Brahms', difficulty: 3, tags: ['clásica', 'una mano'],
    text: `bpm: 90
compas: 3
E4:0.5 E4:0.5 | G4:1.5 E4:0.5 E4:1 | G4:2 E4:0.5 G4:0.5 | C5:1 B4:1.5 A4:0.5 | A4:1 G4:1 D4:0.5 E4:0.5 |
F4:1 D4:1 D4:0.5 E4:0.5 | F4:2 D4:0.5 F4:0.5 | B4:0.5 A4:0.5 G4:1 B4:1 | C5:3`,
  },
  {
    id: 'greensleeves', title: 'Greensleeves', composer: 'Tradicional inglesa', difficulty: 3, tags: ['folk', 'una mano'],
    text: `bpm: 110
compas: 3
A4:1 | C5:2 D5:1 | E5:1.5 F5:0.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:0.5 B4:1 | C5:2 A4:1 | A4:1.5 G#4:0.5 A4:1 | B4:2 G#4:1 | E4:2 A4:1 |
C5:2 D5:1 | E5:1.5 F5:0.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:0.5 B4:1 | C5:1.5 B4:0.5 A4:1 | G#4:1.5 F#4:0.5 G#4:1 | A4:3`,
  },
  {
    id: 'gruta', title: 'En la gruta del rey de la montaña (tema)', composer: 'E. Grieg', difficulty: 3, tags: ['clásica', 'una mano'],
    text: `bpm: 104
${GRUTA}
${GRUTA}`,
  },
  {
    id: 'para-elisa', title: 'Para Elisa (tema principal)', composer: 'L. van Beethoven', difficulty: 4, tags: ['clásica', 'dos manos'],
    text: `bpm: 126
compas: 3
D: E5:0.5 D#5:0.5 | ${ELISA_A} B4:1 -:0.5 E4:0.5 G#4:0.5 B4:0.5 | C5:1 -:0.5 E4:0.5 E5:0.5 D#5:0.5 |
D: ${ELISA_A} B4:1 -:0.5 E4:0.5 C5:0.5 B4:0.5 | A4:2
I: -:1 | -:3 | A2:0.5 E3:0.5 A3:0.5 -:1.5 | E2:0.5 E3:0.5 G#3:0.5 -:1.5 | A2:0.5 E3:0.5 A3:0.5 -:1.5 |
I: -:3 | A2:0.5 E3:0.5 A3:0.5 -:1.5 | E2:0.5 E3:0.5 G#3:0.5 -:1.5 | A2:0.5 E3:0.5 A3:1`,
  },
  {
    id: 'canon', title: 'Canon en Re (simplificado)', composer: 'J. Pachelbel', difficulty: 4, tags: ['clásica', 'dos manos'],
    text: `bpm: 84
D: F#5:2 E5:2 D5:2 C#5:2 B4:2 A4:2 B4:2 C#5:2 |
D: D5:2 C#5:2 B4:2 A4:2 G4:2 F#4:2 G4:2 E4:2 |
D: D4 F#4 A4 G4 F#4 D4 F#4 E4 D4 B3 D4 A4 G4 B4 A4 G4 | F#4:4
I: ${CANON_L} | ${CANON_L} | ${CANON_L} | D3:4`,
  },
  {
    id: 'minueto', title: 'Minueto en Sol', composer: 'C. Petzold (Cuaderno de A. M. Bach)', difficulty: 5, tags: ['clásica', 'dos manos'],
    text: `bpm: 104
compas: 3
D: ${MINUET_1_6} F#4:1 G4:0.5 A4:0.5 B4:0.5 G4:0.5 | A4:3 |
D: ${MINUET_1_6} A4:1 B4:0.5 A4:0.5 G4:0.5 F#4:0.5 | G4:3
I: G3:2 A3:1 | B3:3 | C4:3 | B3:3 | A3:3 | G3:3 | D4:1 B3:1 G3:1 | D4:1 D3:0.5 C4:0.5 B3:0.5 A3:0.5 |
I: B3:2 A3:1 | G3:1 B3:1 G3:1 | C4:3 | B3:1 C4:0.5 B3:0.5 A3:0.5 G3:0.5 | A3:2 F#3:1 | G3:2 B3:1 | C4:1 D4:1 D3:1 | G3:2 G2:1`,
  },
];

export const BUILTIN_SONGS: SongDoc[] = DEFS.map((d) => {
  const { song, warnings } = parseText(d.text, { id: `builtin:${d.id}`, title: d.title, composer: d.composer, difficulty: d.difficulty, source: 'builtin', tags: d.tags });
  if (warnings.length) throw new Error(`Canción "${d.title}": ${warnings.join(', ')}`);
  return song;
});
