// Evaluación: compara lo que toca el usuario con los eventos esperados.
import type { NoteEvent } from './song';
import { pc } from './theory';

export type MatchMode = 'wait' | 'realtime';
export type EventResult = 'pending' | 'hit' | 'miss';
export interface MatcherOptions { mode: MatchMode; window: number; octaveTolerant: boolean }
export interface Stats { total: number; hits: number; misses: number; wrong: number; accuracy: number }

export class Matcher {
  results: EventResult[];
  hadError: boolean[];
  cursor = 0;
  wrong = 0;
  /** Errores por nota esperada (MIDI) para el resumen. */
  trouble = new Map<number, number>();
  private pressed = new Set<number>();
  private pressedFor = -1;

  constructor(public events: NoteEvent[], public opts: MatcherOptions) {
    this.results = events.map(() => 'pending');
    this.hadError = events.map(() => false);
  }

  /** Reinicia la evaluación desde un instante de la canción. */
  reset(fromTime = 0): void {
    this.cursor = this.events.findIndex((e) => e.time >= fromTime - 1e-6);
    if (this.cursor < 0) this.cursor = this.events.length;
    for (let i = this.cursor; i < this.events.length; i++) { this.results[i] = 'pending'; this.hadError[i] = false; }
    this.wrong = 0;
    this.pressed.clear();
    this.pressedFor = -1;
  }

  private same(a: number, b: number) { return this.opts.octaveTolerant ? pc(a) === pc(b) : a === b; }

  /** Evento que toca ahora (el siguiente sin juzgar). */
  current(): NoteEvent | undefined { return this.events[this.cursor]; }
  done(): boolean { return this.cursor >= this.events.length; }

  private markWrong(ev: NoteEvent | undefined): void {
    this.wrong++;
    if (ev) {
      this.hadError[ev.index] = true;
      for (const n of ev.notes) this.trouble.set(n.midi, (this.trouble.get(n.midi) ?? 0) + 1);
    }
  }

  private complete(ev: NoteEvent): void {
    this.results[ev.index] = 'hit';
    this.pressed.clear();
    this.pressedFor = -1;
    while (this.cursor < this.events.length && this.results[this.cursor] !== 'pending') this.cursor++;
  }

  /** Entrada nota a nota (MIDI, teclado del PC, clic). */
  noteOn(midi: number, now: number): 'hit' | 'partial' | 'wrong' | 'ignored' {
    const ev = this.current();
    if (!ev) return 'ignored';
    if (this.opts.mode === 'realtime' && ev.time - now > this.opts.window * 2) {
      this.wrong++;
      return 'wrong';
    }
    if (this.pressedFor !== ev.index) { this.pressed.clear(); this.pressedFor = ev.index; }
    const target = ev.notes.find((n) => this.same(n.midi, midi) && !this.pressed.has(n.midi));
    if (target) {
      this.pressed.add(target.midi);
      if (this.pressed.size >= ev.notes.length) { this.complete(ev); return 'hit'; }
      return 'partial';
    }
    if (ev.notes.some((n) => this.same(n.midi, midi))) return 'ignored'; // repetida del mismo acorde
    this.markWrong(ev);
    return 'wrong';
  }

  /** El micrófono confirma que el evento actual suena completo. */
  micHit(now: number): boolean {
    const ev = this.current();
    if (!ev) return false;
    if (this.opts.mode === 'realtime' && ev.time - now > this.opts.window * 2) return false;
    this.complete(ev);
    return true;
  }

  micWrong(): void { this.markWrong(this.current()); }

  /** Modo tiempo real: marca como omitidos los eventos que ya pasaron. */
  tick(now: number): NoteEvent[] {
    const missed: NoteEvent[] = [];
    if (this.opts.mode !== 'realtime') return missed;
    while (this.cursor < this.events.length && this.events[this.cursor].time < now - this.opts.window) {
      const ev = this.events[this.cursor];
      if (this.results[ev.index] === 'pending') {
        this.results[ev.index] = 'miss';
        for (const n of ev.notes) this.trouble.set(n.midi, (this.trouble.get(n.midi) ?? 0) + 1);
        missed.push(ev);
      }
      this.cursor++;
      this.pressed.clear();
    }
    return missed;
  }

  stats(from = 0, to = Infinity): Stats {
    let total = 0, hits = 0, misses = 0, clean = 0;
    for (const e of this.events) {
      if (e.time < from - 1e-6 || e.time >= to) continue;
      total++;
      if (this.results[e.index] === 'hit') { hits++; if (!this.hadError[e.index]) clean++; }
      else if (this.results[e.index] === 'miss') misses++;
    }
    const accuracy = this.opts.mode === 'wait'
      ? (hits ? clean / hits : 0)
      : (hits + misses + this.wrong ? hits / (hits + misses + this.wrong) : 0);
    return { total, hits, misses, wrong: this.wrong, accuracy };
  }
}
