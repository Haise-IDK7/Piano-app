// Curso desde cero: cada lección = explicación breve + ejercicio tocable.
import { parseText } from '../engine/textFormat';
import type { SongDoc } from '../engine/song';

export interface Lesson { id: string; level: number; title: string; goal: string; body: string[]; song: SongDoc }

interface Def { id: string; level: number; title: string; goal: string; body: string[]; text: string }

export const LEVEL_NAMES = ['Primeros pasos', 'Cinco dedos', 'Teclas negras y acordes', 'Dos manos'];

const DEFS: Def[] = [
  {
    id: 'l01', level: 0, title: 'Conoce tu teclado y el Do central', goal: 'Encontrar el Do central y tocarlo con el pulgar.',
    body: [
      'Mira las teclas negras: van en grupos de 2 y de 3 que se repiten. Hacia la derecha el sonido es más agudo; hacia la izquierda, más grave.',
      'El Do es siempre la tecla blanca que está justo a la IZQUIERDA de cada grupo de 2 negras.',
      'El "Do central" es el Do más cercano al centro de tu teclado (suele quedar frente al logotipo). En la app se llama Do4.',
      'Siéntate centrado frente a ese Do, con los antebrazos paralelos al suelo y la mano redondeada, como si sujetaras una pelota.',
      'Ejercicio: toca el Do central 4 veces con el pulgar de la mano derecha. La app espera a oírlo.',
    ],
    text: 'bpm: 70\nC4:2 C4:2 C4:2 C4:2',
  },
  {
    id: 'l02', level: 0, title: 'Los dedos tienen número', goal: 'Tocar Do-Re-Mi-Fa-Sol con los dedos 1-2-3-4-5.',
    body: [
      'En piano los dedos se numeran igual en ambas manos: 1 pulgar, 2 índice, 3 medio, 4 anular, 5 meñique.',
      '"Posición de Do": pulgar derecho (1) en el Do central y un dedo por tecla blanca: Do(1) Re(2) Mi(3) Fa(4) Sol(5).',
      'No muevas la mano: cada dedo se queda sobre su tecla.',
      'Ejercicio: sube de Do a Sol, un dedo por nota, despacio y parejo.',
    ],
    text: 'bpm: 70\nC4:2 D4:2 E4:2 F4:2 G4:4',
  },
  {
    id: 'l03', level: 0, title: 'Nombres de las teclas blancas', goal: 'Reconocer Do Re Mi Fa Sol La Si.',
    body: [
      'Las 7 teclas blancas se llaman Do, Re, Mi, Fa, Sol, La, Si y luego se repiten. En notación inglesa: C, D, E, F, G, A, B.',
      'Truco: Do está a la izquierda del grupo de 2 negras; Fa está a la izquierda del grupo de 3 negras.',
      'Puedes cambiar entre Do-Re-Mi y C-D-E en Ajustes.',
      'Ejercicio: sube toda la escala y vuelve. Aún no importa la digitación; usa el dedo que te resulte cómodo.',
    ],
    text: 'bpm: 80\nC4 D4 E4 F4 G4 A4 B4 C5:2 B4 A4 G4 F4 E4 D4 C4:2',
  },
  {
    id: 'l04', level: 1, title: 'Subir y bajar en posición de Do', goal: 'Tocar parejo sin mirar las manos.',
    body: [
      'Vuelve a la posición de Do (pulgar en Do central).',
      'Intenta mirar la pantalla y no las manos: tus dedos ya están cada uno sobre su tecla.',
      'Consejo: lento y correcto vale más que rápido y con errores. Puedes bajar la velocidad con la flecha ↓.',
    ],
    text: 'bpm: 84\nC4 D4 E4 F4 G4 F4 E4 D4 | C4 D4 E4 F4 G4 F4 E4 D4 | C4:4',
  },
  {
    id: 'l05', level: 1, title: 'Saltos entre dedos', goal: 'Saltarse teclas sin mover la mano.',
    body: [
      'No siempre se toca la tecla de al lado. Do-Mi-Sol se toca con los dedos 1-3-5, saltando una tecla cada vez.',
      'Mantén la mano quieta: solo se mueven los dedos.',
    ],
    text: 'bpm: 84\nC4 E4 G4 E4 | C4 E4 G4:2 | D4 F4 D4 F4 | E4 G4 E4 C4 | C4 E4 G4 E4 | C4:4',
  },
  {
    id: 'l06', level: 1, title: 'Notas largas y cortas', goal: 'Sentir el pulso.',
    body: [
      'En la pantalla, una barra larga es una nota que se mantiene pulsada más tiempo; una barra corta se suelta antes.',
      'Activa el metrónomo (tecla M) y cuenta "1, 2, 3, 4". Las notas largas de este ejercicio duran 2 pulsos; la última, 4.',
      'En modo espera la app no te apura. Cuando te salga, prueba el modo "Tiempo" para tocar con el pulso.',
    ],
    text: 'bpm: 80\nC4:2 C4:2 | D4 D4 D4 D4 | E4:2 E4:2 | D4 D4 D4 D4 | C4:4',
  },
  {
    id: 'l07', level: 1, title: 'Tu primera melodía', goal: 'Tocar "Mary tenía un corderito".',
    body: [
      'Todo cabe en la posición de Do: Mi es el dedo 3, Re el 2, Do el 1 y Sol el 5.',
      'Si te equivocas siempre en el mismo sitio, haz clic en esa sección de la barra superior para repetirla en bucle.',
    ],
    text: 'bpm: 96\nE4 D4 C4 D4 | E4 E4 E4:2 | D4 D4 D4:2 | E4 G4 G4:2 | E4 D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4:4',
  },
  {
    id: 'l08', level: 1, title: 'La mano izquierda', goal: 'Posición de Do con la izquierda.',
    body: [
      'Busca el Do que está una octava por debajo del Do central (Do3). Coloca ahí el MEÑIQUE izquierdo (5).',
      'Un dedo por tecla: Do(5) Re(4) Mi(3) Fa(2) Sol(1). Fíjate que la numeración va al revés que en la derecha.',
      'En la pantalla la mano izquierda se dibuja en azul y la derecha en verde.',
    ],
    text: 'bpm: 76\nI: C3:2 D3:2 E3:2 F3:2 G3:4 | G3 F3 E3 D3 C3:4',
  },
  {
    id: 'l09', level: 2, title: 'Teclas negras: sostenidos y bemoles', goal: 'Tocar las teclas negras por su nombre.',
    body: [
      'Cada tecla negra toma el nombre de su vecina: "sostenido" (#) = la negra de la derecha; "bemol" (b) = la negra de la izquierda.',
      'Por eso la misma tecla tiene dos nombres: Do# y Reb son la misma tecla negra.',
      'Ejercicio: primero el grupo de 2 negras (Do# Re#) y luego el de 3 (Fa# Sol# La#).',
    ],
    text: 'bpm: 76\nC#4:2 D#4:2 C#4:2 D#4:2 | F#4:2 G#4:2 A#4:2 G#4:2 F#4:4',
  },
  {
    id: 'l10', level: 2, title: 'Escala de Do mayor con paso del pulgar', goal: 'Tocar 8 notas seguidas con solo 5 dedos.',
    body: [
      'Para subir 8 notas: Do(1) Re(2) Mi(3) y aquí el pulgar pasa POR DEBAJO de la mano hasta Fa(1); luego Sol(2) La(3) Si(4) Do(5).',
      'Para bajar: 5-4-3-2-1 y el dedo 3 cruza POR ENCIMA del pulgar hasta Mi; después 2-1.',
      'Hazlo muy lento: el paso del pulgar debe sonar igual de parejo que el resto.',
    ],
    text: 'bpm: 72\nC4 D4 E4 F4 G4 A4 B4 C5:2 | B4 A4 G4 F4 E4 D4 C4:2',
  },
  {
    id: 'l11', level: 2, title: 'Primeros acordes: Do, Fa y Sol', goal: 'Tocar tres notas a la vez.',
    body: [
      'Un acorde son varias notas que suenan juntas. Do mayor = Do + Mi + Sol (dedos 1-3-5).',
      'Fa mayor aquí se toca Do + Fa + La (1-3-5 abriendo un poco la mano) y Sol mayor Si + Re + Sol (1-2-5): así la mano casi no se mueve.',
      'Con MICRÓFONO: pulsa las tres teclas a la vez, con decisión, y déjalas sonar un instante. Los acordes son lo más difícil de reconocer por micrófono; si la app no los oye, sube la sensibilidad en Ajustes.',
    ],
    text: 'bpm: 66\n[C4 E4 G4]:4 [C4 F4 A4]:4 [C4 E4 G4]:4 [B3 D4 G4]:4 [C4 E4 G4]:4',
  },
  {
    id: 'l12', level: 2, title: 'La menor y la progresión del pop', goal: 'Do – Sol – La menor – Fa.',
    body: [
      'Un acorde MENOR suena más triste que uno mayor. La menor = La + Do + Mi.',
      'Do – Sol – La menor – Fa es la progresión de cientos de canciones famosas. Si la dominas, podrás acompañar muchísimas.',
    ],
    text: 'bpm: 66\n[C4 E4 G4]:4 [B3 D4 G4]:4 [A3 C4 E4]:4 [A3 C4 F4]:4 | [C4 E4 G4]:4 [B3 D4 G4]:4 [A3 C4 E4]:4 [A3 C4 F4]:4 | [C4 E4 G4]:4',
  },
  {
    id: 'l13', level: 3, title: 'Dos manos: melodía y nota grave', goal: 'Coordinar ambas manos por primera vez.',
    body: [
      'La mano izquierda mantiene una nota larga mientras la derecha toca la melodía.',
      'Método que funciona siempre: 1) derecha sola, 2) izquierda sola, 3) ambas MUY lento. Usa el selector de mano.',
      'Las notas que empiezan a la vez aparecen a la misma altura en la pantalla: se pulsan juntas.',
    ],
    text: 'bpm: 72\nD: E4 D4 C4 D4 | E4 E4 E4:2 | D4 D4 D4:2 | E4 G4 G4:2\nI: C3:4 | C3:4 | G3:4 | C3:4',
  },
  {
    id: 'l14', level: 3, title: 'Dos manos: Oda a la Alegría', goal: 'Tu primera pieza con ambas manos.',
    body: [
      'La izquierda solo cambia entre Do (dedo 5) y Sol (dedo 1): no hace falta mirarla.',
      'Cuando lo consigas en modo espera, pasa a la canción completa en la biblioteca.',
    ],
    text: 'bpm: 84\nD: E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:0.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2\nI: C3:4 | G3:4 | C3:4 | C3:2 G3:2 | C3:4 | G3:4 | C3:4 | G3:2 C3:2',
  },
];

export const LESSONS: Lesson[] = DEFS.map((d) => ({
  id: d.id, level: d.level, title: d.title, goal: d.goal, body: d.body,
  song: parseText(d.text, { id: `lesson:${d.id}`, title: d.title, source: 'builtin', difficulty: d.level + 1 }).song,
}));

export const TIPS: string[] = [
  'Practica lento y correcto antes que rápido y con errores.',
  'Quince minutos cada día rinden más que dos horas el domingo.',
  'Si fallas siempre en el mismo compás, aíslalo: clic en su sección para repetirla en bucle.',
  'Primero manos separadas; júntalas solo cuando cada una salga sola sin pensar.',
  'Relaja hombros y muñecas. Si notas tensión, para, sacude las manos y vuelve más lento.',
  'Mantén los dedos curvos, como si sujetaras una pelota pequeña.',
  'Mira la pantalla, no las manos: aprenderás la distancia entre teclas mucho antes.',
  'Sube la velocidad de 10 % en 10 % solo cuando la pasada salga limpia.',
  'Termina cada sesión tocando algo que ya te sale bien: es lo que te hará volver mañana.',
  'Canta o tararea la melodía antes de tocarla: si la tienes en la cabeza, los dedos la encuentran.',
  'Con micrófono: toca con decisión y deja sonar cada nota un instante; evita ruido de fondo (TV, ventilador).',
  'Acerca el portátil al parlante del teclado o conecta un cable de la salida PHONES a la entrada de micrófono del PC: la detección mejora mucho.',
  'Usa siempre los mismos dedos para el mismo pasaje: la memoria muscular necesita repetición idéntica.',
  'Altura del asiento: los antebrazos deben quedar paralelos al suelo.',
  'Divide las canciones en trozos de 4 compases. Domina uno antes de pasar al siguiente.',
  'Empieza la sesión por lo difícil, cuando la cabeza está fresca.',
  'El metrónomo no es un castigo: es el espejo de tu pulso.',
  'Si una canción es demasiado difícil hoy, practica solo la mano derecha: ya es música.',
];
