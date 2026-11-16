// Dibujo en Canvas2D: teclado, cascada de notas y pentagrama simplificado.
import type { Note } from '../engine/song';
import { isBlack, midiToName, octaveOf, pc, type Notation } from '../engine/theory';

export const COLORS = {
  bg: '#0b0d12', surface: '#151922', line: '#232a38',
  R: '#3ddc84', Rdark: '#27a865', L: '#4d8dff', Ldark: '#3168d6',
  error: '#ff4d5e', gold: '#ffc845', text: '#e8ecf4', dim: '#7c869b',
};

export interface KeyRect { x: number; w: number; black: boolean }
export interface KeyLayout { lo: number; hi: number; width: number; whiteW: number; keys: Map<number, KeyRect> }

export function layoutKeyboard(lo: number, hi: number, width: number): KeyLayout {
  if (isBlack(lo)) lo--;
  if (isBlack(hi)) hi++;
  let whites = 0;
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites++;
  const whiteW = width / whites;
  const keys = new Map<number, KeyRect>();
  let i = 0;
  for (let m = lo; m <= hi; m++) {
    if (!isBlack(m)) { keys.set(m, { x: i * whiteW, w: whiteW, black: false }); i++; }
    else keys.set(m, { x: i * whiteW - whiteW * 0.3, w: whiteW * 0.6, black: true });
  }
  return { lo, hi, width, whiteW, keys };
}

/** Rango de dibujo: octavas completas que cubren la canción, dentro del teclado real. */
export function viewRange(songLo: number, songHi: number, kbLo: number, kbHi: number): [number, number] {
  let lo = Math.floor(songLo / 12) * 12;
  let hi = Math.ceil((songHi + 1) / 12) * 12;
  while (hi - lo < 36) { if (lo > kbLo) lo -= 12; if (hi - lo < 36) hi += 12; if (lo <= kbLo && hi >= kbHi) break; }
  return [Math.max(kbLo, lo), Math.min(kbHi, hi)];
}

export interface KeyboardOpts {
  highlights?: Map<number, string>;
  outlines?: Map<number, string>;
  labels?: boolean;
  notation: Notation;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rr);
}

export function drawKeyboard(ctx: CanvasRenderingContext2D, lay: KeyLayout, y: number, h: number, o: KeyboardOpts): void {
  const blackH = h * 0.62;
  for (const [m, k] of lay.keys) {
    if (k.black) continue;
    const hl = o.highlights?.get(m);
    ctx.fillStyle = hl ?? '#f4f6fa';
    roundRect(ctx, k.x + 0.5, y, k.w - 1, h, 4);
    ctx.fill();
    const out = o.outlines?.get(m);
    if (out) { ctx.strokeStyle = out; ctx.lineWidth = 3; roundRect(ctx, k.x + 2, y + 2, k.w - 4, h - 4, 4); ctx.stroke(); }
    if (o.labels !== false && (pc(m) === 0 || hl || out) && k.w > 14) {
      ctx.fillStyle = hl ? '#0b0d12' : '#6b7386';
      ctx.font = `${pc(m) === 0 && !hl && !out ? 500 : 700} ${Math.min(12, k.w * 0.42)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(pc(m) === 0 ? midiToName(m, o.notation) + octaveOf(m) : midiToName(m, o.notation), k.x + k.w / 2, y + h - 7);
    }
  }
  for (const [m, k] of lay.keys) {
    if (!k.black) continue;
    const hl = o.highlights?.get(m);
    ctx.fillStyle = hl ?? '#161a22';
    roundRect(ctx, k.x, y, k.w, blackH, 3);
    ctx.fill();
    const out = o.outlines?.get(m);
    if (out) { ctx.strokeStyle = out; ctx.lineWidth = 3; roundRect(ctx, k.x + 1.5, y + 1.5, k.w - 3, blackH - 3, 3); ctx.stroke(); }
  }
}

export function keyAt(lay: KeyLayout, x: number, yRel: number, h: number): number | null {
  if (yRel < h * 0.62) for (const [m, k] of lay.keys) if (k.black && x >= k.x && x <= k.x + k.w) return m;
  for (const [m, k] of lay.keys) if (!k.black && x >= k.x && x < k.x + k.w) return m;
  return null;
}

export interface SceneOpts {
  time: number;
  fallSeconds: number;
  notation: Notation;
  labels: boolean;
  hands: { R: boolean; L: boolean };
  expected: Note[];
  bpm: number;
  beatsPerBar: number;
}

const noteColor = (n: Note) => (n.hand === 'R' ? (isBlack(n.midi) ? COLORS.Rdark : COLORS.R) : isBlack(n.midi) ? COLORS.Ldark : COLORS.L);

export function drawCascade(ctx: CanvasRenderingContext2D, lay: KeyLayout, h: number, notes: Note[], o: SceneOpts): void {
  const pps = h / o.fallSeconds;
  // guías de octava y líneas de compás
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  for (const [m, k] of lay.keys) {
    if (pc(m) === 0 && !k.black) { ctx.beginPath(); ctx.moveTo(k.x, 0); ctx.lineTo(k.x, h); ctx.stroke(); }
  }
  const bar = (60 / o.bpm) * o.beatsPerBar;
  if (bar > 0.2) {
    ctx.fillStyle = COLORS.dim;
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    for (let b = Math.max(0, Math.floor(o.time / bar)); b * bar < o.time + o.fallSeconds; b++) {
      const y = h - (b * bar - o.time) * pps;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(lay.width, y); ctx.stroke();
      ctx.fillText(String(b + 1), 6, y - 4);
      ctx.globalAlpha = 1;
    }
  }
  for (const n of notes) {
    if (n.start > o.time + o.fallSeconds || n.start + n.dur < o.time - 0.05) continue;
    const k = lay.keys.get(n.midi);
    if (!k) continue;
    const yBottom = h - (n.start - o.time) * pps;
    const hh = Math.max(8, n.dur * pps - 2);
    const w = k.black ? k.w : k.w - 4;
    const x = k.black ? k.x : k.x + 2;
    ctx.globalAlpha = o.hands[n.hand] ? 1 : 0.3;
    ctx.fillStyle = noteColor(n);
    roundRect(ctx, x, yBottom - hh, w, hh, 5);
    ctx.fill();
    if (o.expected.includes(n)) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
    if (o.labels && w >= 13 && hh >= 15) {
      ctx.fillStyle = '#06110b';
      ctx.font = `700 ${Math.min(12, w * 0.5)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(midiToName(n.midi, o.notation), x + w / 2, yBottom - 5);
    }
    ctx.globalAlpha = 1;
  }
  // línea de impacto
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(0, h - 2, lay.width, 2);
}

const DIATONIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const dia = (midi: number) => DIATONIC[pc(midi)] + 7 * octaveOf(midi);
const D_C4 = dia(60);

export function drawStaff(ctx: CanvasRenderingContext2D, w: number, h: number, notes: Note[], o: SceneOpts): void {
  const s = Math.max(9, Math.min(18, h / 19));
  const yT = h * 0.5 - s * 1.5; // línea inferior del pentagrama de Sol (Mi4)
  const yB = yT + s * 3; // línea superior del pentagrama de Fa (La3)
  const x0 = Math.max(120, w * 0.2);
  const ppx = (w - x0) / (o.fallSeconds * 1.7);
  const yOf = (n: Note) => (n.hand === 'R' ? yT + s - ((dia(n.midi) - D_C4) * s) / 2 : yB - s - ((dia(n.midi) - D_C4) * s) / 2);

  ctx.strokeStyle = '#3a4357';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    for (const y of [yT - i * s, yB + i * s]) { ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(w - 8, y); ctx.stroke(); }
  }
  ctx.fillStyle = COLORS.dim;
  ctx.textAlign = 'left';
  ctx.font = `${s * 3.6}px "Segoe UI Symbol", "Noto Music", serif`;
  ctx.fillText('\u{1D11E}', 22, yT + s * 0.6);
  ctx.font = `${s * 3}px "Segoe UI Symbol", "Noto Music", serif`;
  ctx.fillText('\u{1D122}', 24, yB + s * 2.9);
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.R; ctx.fillText('Mano derecha', 70, yT - s * 4 - 10);
  ctx.fillStyle = COLORS.L; ctx.fillText('Mano izquierda', 70, yB + s * 4 + 20);

  const bar = (60 / o.bpm) * o.beatsPerBar;
  if (bar > 0.2) {
    ctx.strokeStyle = '#2b3345';
    for (let b = Math.max(0, Math.ceil((o.time - x0 / ppx) / bar)); b * bar < o.time + (w - x0) / ppx; b++) {
      const x = x0 + (b * bar - o.time) * ppx - s;
      if (x < 60) continue;
      ctx.beginPath(); ctx.moveTo(x, yT - 4 * s); ctx.lineTo(x, yB + 4 * s); ctx.stroke();
    }
  }
  // cursor de lectura
  ctx.fillStyle = 'rgba(255,200,69,0.16)';
  ctx.fillRect(x0 - s, yT - 6 * s, s * 2, yB - yT + 12 * s);
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(x0 - 1, yT - 6 * s, 2, yB - yT + 12 * s);

  for (const n of notes) {
    const x = x0 + (n.start - o.time) * ppx;
    if (x > w + 20 || x + n.dur * ppx < 50) continue;
    const y = yOf(n);
    const col = noteColor(n);
    const past = n.start + n.dur < o.time;
    ctx.globalAlpha = (o.hands[n.hand] ? 1 : 0.3) * (past ? 0.35 : 1);
    // líneas adicionales
    ctx.strokeStyle = '#5a657c';
    const [top, bottom] = n.hand === 'R' ? [yT - 4 * s, yT] : [yB, yB + 4 * s];
    for (let ly = bottom + s; ly <= y + 0.1; ly += s) { ctx.beginPath(); ctx.moveTo(x - s, ly); ctx.lineTo(x + s, ly); ctx.stroke(); }
    for (let ly = top - s; ly >= y - 0.1; ly -= s) { ctx.beginPath(); ctx.moveTo(x - s, ly); ctx.lineTo(x + s, ly); ctx.stroke(); }
    // duración
    ctx.fillStyle = col;
    const len = n.dur * ppx - s * 0.4;
    if (len > s) { ctx.globalAlpha *= 0.35; ctx.fillRect(x, y - 2, len, 4); ctx.globalAlpha /= 0.35; }
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.64, s * 0.46, -0.35, 0, Math.PI * 2);
    ctx.fill();
    if (o.expected.includes(n)) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }
    if (isBlack(n.midi)) {
      ctx.font = `${s * 1.25}px "Segoe UI Symbol", serif`;
      ctx.textAlign = 'right';
      ctx.fillText('♯', x - s * 0.75, y + s * 0.42);
    }
    if (o.labels && !past) {
      ctx.font = `600 ${Math.max(9, s * 0.72)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(midiToName(n.midi, o.notation), x, n.hand === 'R' ? y - s * 0.9 : y + s * 1.45);
    }
    ctx.globalAlpha = 1;
  }
}
