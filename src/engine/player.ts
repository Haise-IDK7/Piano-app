// Reproductor de práctica: reloj de la canción, modos, bucles, políticas de
// error y escalera de tempo. No depende de React.
import { buildEvents, type Note, type NoteEvent, type SongDoc } from './song';
import { Matcher, type Stats } from './matcher';
import type { MicTracker, TrackerOutput } from './pitch';
import type { Synth } from './synth';

export type Mode = 'watch' | 'wait' | 'realtime';

export interface PlayerConfig {
  mode: Mode;
  speed: number; // 1 = tempo original
  hands: { R: boolean; L: boolean };
  autoplayOther: boolean;
  loop: { start: number; end: number } | null;
  metronome: boolean;
  latency: number; // segundos
  octaveTolerant: boolean;
  window: number; // ventana de acierto en tiempo real (s)
  errorPolicy: 'continue' | 'repeat';
  repeatAfter: number;
  ladder: boolean;
  muted: boolean; // silenciar el sonido propio (micrófono sin audífonos)
}

export type Feedback =
  | { kind: 'hit' | 'wrong' | 'miss'; midis: number[] }
  | { kind: 'rewind' }
  | { kind: 'loop'; stats: Stats; speed: number };

export interface PlayerCallbacks { onFinish(stats: Stats): void; onFeedback(f: Feedback): void }

const PREROLL = 1.5;

export class Player {
  time = -PREROLL;
  playing = false;
  finished = false;
  events: NoteEvent[] = [];
  matcher!: Matcher;
  /** Destellos de tecla: midi → {color lógico, instante de fin (ms)} */
  flashes = new Map<number, { kind: 'hit' | 'wrong'; until: number }>();
  streak = 0;
  private autoIdx = 0;
  private armSeq = 0;
  private passErrors = 0;
  private sorted: Note[];

  constructor(public song: SongDoc, public cfg: PlayerConfig, private synth: Synth, private cb: PlayerCallbacks) {
    this.sorted = [...song.notes].sort((a, b) => a.start - b.start);
    this.rebuild();
  }

  private rebuild(): void {
    this.events = buildEvents(this.song.notes, this.cfg.hands);
    this.matcher = new Matcher(this.events, {
      mode: this.cfg.mode === 'realtime' ? 'realtime' : 'wait', window: this.cfg.window, octaveTolerant: this.cfg.octaveTolerant,
    });
    this.matcher.reset(Math.max(0, this.time));
    this.armSeq++;
  }

  setConfig(p: Partial<PlayerConfig>): void {
    const structural = p.hands !== undefined || p.mode !== undefined || p.octaveTolerant !== undefined || p.window !== undefined;
    const loopChanged = p.loop !== undefined;
    this.cfg = { ...this.cfg, ...p };
    if (structural) this.rebuild();
    if (loopChanged) this.seek(this.cfg.loop ? this.cfg.loop.start : 0);
  }

  get startTime(): number { return this.cfg.loop?.start ?? 0; }
  get endTime(): number { return this.cfg.loop?.end ?? this.song.duration + 0.4; }

  play(): void { if (this.finished) this.restart(); this.playing = true; this.synth.resume(); }
  pause(): void { this.playing = false; this.synth.allOff(); }
  restart(): void { this.seek(this.startTime); this.streak = 0; }

  seek(t: number, preroll = true): void {
    this.time = preroll ? t - PREROLL * Math.min(1, this.cfg.speed + 0.3) : t;
    this.finished = false;
    this.passErrors = 0;
    this.matcher.reset(t);
    this.armSeq++;
    this.autoIdx = this.sorted.findIndex((n) => n.start >= t - 1e-6);
    if (this.autoIdx < 0) this.autoIdx = this.sorted.length;
    this.synth.allOff();
  }

  /** Instante usado para juzgar (compensa la latencia de la entrada). */
  private judgeTime(): number { return this.time - this.cfg.latency * this.cfg.speed; }

  private flash(midis: number[], kind: 'hit' | 'wrong'): void {
    const until = performance.now() + (kind === 'hit' ? 260 : 420);
    for (const m of midis) this.flashes.set(m, { kind, until });
  }

  private registerError(): void {
    this.streak = 0;
    this.passErrors++;
    if (this.cfg.mode === 'realtime' && this.cfg.errorPolicy === 'repeat' && this.passErrors >= this.cfg.repeatAfter) {
      const sec = this.cfg.loop ?? this.song.sections.find((s) => this.time >= s.start && this.time < s.end) ?? { start: 0 };
      this.seek(sec.start);
      this.cb.onFeedback({ kind: 'rewind' });
    }
  }

  private sounds(n: Note): boolean {
    if (this.cfg.mode === 'watch') return true;
    if (this.cfg.muted) return false;
    return !this.cfg.hands[n.hand] && this.cfg.autoplayOther;
  }

  update(dt: number): void {
    if (!this.playing) return;
    const end = this.endTime;
    let next = this.time + dt * this.cfg.speed;
    if (this.cfg.mode === 'wait') {
      const cur = this.matcher.current();
      if (cur && cur.time < end && next > cur.time) next = Math.max(this.time, cur.time);
    }
    while (this.autoIdx < this.sorted.length && this.sorted[this.autoIdx].start < next) {
      const n = this.sorted[this.autoIdx++];
      if (n.start >= this.time - 0.05 && n.start < end && this.sounds(n)) this.synth.noteOn(n.midi, n.dur / this.cfg.speed, 0.6);
    }
    if (this.cfg.metronome && !(this.cfg.muted && this.cfg.mode !== 'watch') && next > this.time) {
      const beat = 60 / this.song.bpm;
      const a = Math.floor(this.time / beat), b = Math.floor(next / beat);
      if (b > a) this.synth.click(((b % this.song.beatsPerBar) + this.song.beatsPerBar) % this.song.beatsPerBar === 0);
    }
    this.time = next;
    if (this.cfg.mode === 'realtime') {
      for (const ev of this.matcher.tick(this.judgeTime())) {
        if (ev.time >= end) break;
        this.cb.onFeedback({ kind: 'miss', midis: ev.notes.map((n) => n.midi) });
        this.registerError();
        if (!this.playing) return;
      }
    }
    if (this.time >= end) {
      if (this.cfg.loop) {
        const stats = this.matcher.stats(this.cfg.loop.start, this.cfg.loop.end);
        if (this.cfg.ladder && this.cfg.mode !== 'watch' && stats.total > 0) {
          if (stats.accuracy >= 0.9) this.cfg.speed = Math.min(1.5, Math.round((this.cfg.speed + 0.1) * 100) / 100);
          else if (stats.accuracy < 0.6) this.cfg.speed = Math.max(0.3, Math.round((this.cfg.speed - 0.1) * 100) / 100);
        }
        this.cb.onFeedback({ kind: 'loop', stats, speed: this.cfg.speed });
        this.seek(this.cfg.loop.start);
      } else {
        this.playing = false;
        this.finished = true;
        this.cb.onFinish(this.matcher.stats());
      }
    }
  }

  /** Nota del usuario desde MIDI, teclado del PC o clic. */
  noteOn(midi: number): void {
    if (this.cfg.mode === 'watch' || !this.playing) return;
    const r = this.matcher.noteOn(midi, this.judgeTime());
    if (r === 'hit' || r === 'partial') {
      this.flash([midi], 'hit');
      if (r === 'hit') { this.streak++; this.cb.onFeedback({ kind: 'hit', midis: [midi] }); }
    } else if (r === 'wrong') {
      this.flash([midi], 'wrong');
      this.cb.onFeedback({ kind: 'wrong', midis: [midi] });
      this.registerError();
    }
  }

  /** Salida del micrófono: confirma el evento esperado y lo rearma. */
  micOutput(o: TrackerOutput, tracker: MicTracker, tMs: number): void {
    if (this.cfg.mode === 'watch' || !this.playing) { tracker.setExpected(null, 'off'); return; }
    let cur = this.matcher.current();
    if (cur && cur.time >= this.endTime) cur = undefined;
    if (cur && o.hit) {
      if (this.matcher.micHit(this.judgeTime())) {
        this.flash(cur.notes.map((n) => n.midi), 'hit');
        this.streak++;
        this.cb.onFeedback({ kind: 'hit', midis: cur.notes.map((n) => n.midi) });
      } else this.armSeq++; // demasiado pronto: rearmar el mismo evento
    } else if (cur && o.wrong !== null) {
      this.matcher.micWrong();
      this.flash([o.wrong], 'wrong');
      this.cb.onFeedback({ kind: 'wrong', midis: [o.wrong] });
      this.registerError();
    }
    cur = this.matcher.current();
    if (cur && cur.time >= this.endTime) cur = undefined;
    tracker.setExpected(cur ? cur.notes.map((n) => n.midi) : null, cur ? `${cur.index}:${this.armSeq}` : 'none', tMs);
  }

  /** Notas que hay que tocar ahora (para resaltar teclas). */
  expected(): Note[] {
    if (this.cfg.mode === 'watch') return [];
    const cur = this.matcher.current();
    if (!cur || cur.time >= this.endTime) return [];
    if (this.cfg.mode === 'wait') return cur.time - this.time < 0.05 ? cur.notes : [];
    return Math.abs(cur.time - this.time) < this.cfg.window ? cur.notes : [];
  }
}
