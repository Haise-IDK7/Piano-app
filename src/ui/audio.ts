// Servicios de audio compartidos por toda la interfaz + hook de entrada en vivo.
import { useEffect, useRef, useState } from 'react';
import { Synth } from '../engine/synth';
import { MicInput, MidiInput, PC_KEYS } from '../engine/inputs';
import type { MicTracker, TrackerOptions, TrackerOutput } from '../engine/pitch';
import { useStore, type Settings } from '../store';

let synth: Synth | null = null;
let mic: MicInput | null = null;
const midi = new MidiInput();

export function getSynth(): Synth {
  if (!synth) synth = new Synth();
  return synth;
}

export const trackerOpts = (s: Settings): TrackerOptions => ({
  sensitivity: s.sensitivity, octaveTolerant: s.octaveTolerant, chordTolerance: s.chordTolerance,
});

export function getMic(s: Settings): MicInput {
  if (!mic) mic = new MicInput(getSynth().ctx, trackerOpts(s));
  return mic;
}

export interface LiveHandlers {
  onNoteOn?(midi: number, source: 'midi' | 'pc'): void;
  onNoteOff?(midi: number): void;
  onMic?(o: TrackerOutput, tracker: MicTracker, tMs: number): void;
}

export interface LiveStatus { state: 'idle' | 'starting' | 'ok' | 'error'; message: string; octave: number }

/** Conecta la entrada elegida en Ajustes (micrófono o MIDI) y el teclado del PC. */
export function useLiveInput(handlers: LiveHandlers, enabled = true): LiveStatus {
  const settings = useStore((s) => s.settings);
  const ref = useRef(handlers);
  ref.current = handlers;
  const [status, setStatus] = useState<LiveStatus>({ state: 'idle', message: '', octave: 4 });
  const octave = useRef(4);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (settings.input === 'mic') {
      const m = getMic(settings);
      m.setOptions(trackerOpts(settings));
      m.onOutput = (o, t, ms) => ref.current.onMic?.(o, t, ms);
      setStatus((s) => ({ ...s, state: 'starting', message: 'Abriendo micrófono…' }));
      m.start(settings.micDeviceId || undefined)
        .then(() => { if (!cancelled) setStatus((s) => ({ ...s, state: 'ok', message: 'Micrófono escuchando' })); })
        .catch((e: unknown) => {
          if (!cancelled) setStatus((s) => ({ ...s, state: 'error', message: `No se pudo abrir el micrófono (${e instanceof Error ? e.message : 'error'}). Revisa Ajustes → Entrada.` }));
        });
    } else if (settings.input === 'midi') {
      midi.onNoteOn = (n) => ref.current.onNoteOn?.(n, 'midi');
      midi.onNoteOff = (n) => ref.current.onNoteOff?.(n);
      setStatus((s) => ({ ...s, state: 'starting', message: 'Buscando teclado MIDI…' }));
      midi.start()
        .then((names) => {
          if (cancelled) return;
          setStatus((s) => names.length
            ? { ...s, state: 'ok', message: `MIDI: ${names.join(', ')}` }
            : { ...s, state: 'error', message: 'No hay ningún teclado MIDI conectado.' });
        })
        .catch(() => { if (!cancelled) setStatus((s) => ({ ...s, state: 'error', message: 'MIDI no disponible en este equipo.' })); });
    } else setStatus((s) => ({ ...s, state: 'ok', message: 'Teclado del PC (A S D F G H J) y clic' }));
    return () => {
      cancelled = true;
      if (mic) { mic.onOutput = null; mic.stop(); }
      midi.onNoteOn = null; midi.onNoteOff = null; midi.stop();
    };
  }, [enabled, settings.input, settings.micDeviceId, settings.sensitivity, settings.octaveTolerant, settings.chordTolerance]); // eslint-disable-line

  useEffect(() => {
    if (!enabled) return;
    const held = new Map<string, number>();
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.code === 'KeyZ' || e.code === 'KeyX') {
        octave.current = Math.max(1, Math.min(7, octave.current + (e.code === 'KeyZ' ? -1 : 1)));
        setStatus((s) => ({ ...s, octave: octave.current }));
        return;
      }
      const semi = PC_KEYS[e.code];
      if (semi === undefined) return;
      const note = 12 * (octave.current + 1) + semi;
      held.set(e.code, note);
      ref.current.onNoteOn?.(note, 'pc');
    };
    const up = (e: KeyboardEvent) => {
      const note = held.get(e.code);
      if (note === undefined) return;
      held.delete(e.code);
      ref.current.onNoteOff?.(note);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [enabled]);

  return status;
}

export function openExternal(url: string): void {
  const api = (window as unknown as { pianoApp?: { openExternal(u: string): void } }).pianoApp;
  if (api) api.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}
