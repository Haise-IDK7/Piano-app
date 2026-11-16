import { useEffect, useRef, useState, type ReactNode } from 'react';
import { drawKeyboard, keyAt, layoutKeyboard, COLORS } from './render';
import { useStore } from '../store';
import { useLiveInput } from './audio';
import { midiToName } from '../engine/theory';

export function Stars({ n }: { n: number }) {
  return <span className="stars">{'★'.repeat(n)}<i>{'★'.repeat(3 - n)}</i></span>;
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal">{children}</div>
    </div>
  );
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface PianoProps { lo: number; hi: number; height?: number; highlights?: Map<number, string>; onDown?(midi: number): void; onUp?(midi: number): void }

/** Teclado dibujado en canvas, clicable. */
export function Piano({ lo, hi, height = 130, highlights, onDown, onUp }: PianoProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const notation = useStore((s) => s.settings.notation);
  const [width, setWidth] = useState(800);
  const down = useRef<number | null>(null);
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr; c.height = height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);
    drawKeyboard(ctx, layoutKeyboard(lo, hi, width), 0, height, { highlights, notation });
  }, [width, height, lo, hi, highlights, notation]);
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return keyAt(layoutKeyboard(lo, hi, width), e.clientX - r.left, e.clientY - r.top, height);
  };
  return (
    <canvas
      ref={ref} className="piano" style={{ height }}
      onPointerDown={(e) => { const m = pick(e); if (m !== null) { down.current = m; onDown?.(m); } }}
      onPointerUp={() => { if (down.current !== null) { onUp?.(down.current); down.current = null; } }}
      onPointerLeave={() => { if (down.current !== null) { onUp?.(down.current); down.current = null; } }}
    />
  );
}

/** Probador de micrófono: nivel, umbral y nota que oye la app. */
export function MicTest({ target }: { target?: number }) {
  const settings = useStore((s) => s.settings);
  const [level, setLevel] = useState(0);
  const [gate, setGate] = useState(0);
  const [heard, setHeard] = useState<number | null>(null);
  const [ok, setOk] = useState(false);
  const last = useRef(0);
  const status = useLiveInput({
    onMic: (o, tracker) => {
      const now = performance.now();
      if (o.heard !== null) {
        setHeard(o.heard);
        last.current = now;
        if (target !== undefined && o.heard % 12 === target % 12) setOk(true);
      } else if (now - last.current > 900) setHeard(null);
      setLevel(o.level);
      setGate(tracker.gate);
    },
  }, settings.input === 'mic');
  if (settings.input !== 'mic') return <p className="dim">La entrada seleccionada no es el micrófono.</p>;
  const pct = (v: number) => `${Math.min(100, Math.sqrt(v) * 220)}%`;
  return (
    <div>
      <div className={status.state === 'error' ? 'err small' : 'dim small'} style={{ marginBottom: 8 }}>{status.message}</div>
      <div className="meter"><div style={{ width: pct(level) }} /><i style={{ left: pct(gate) }} /></div>
      <div className="dim small" style={{ margin: '6px 0 14px' }}>Nivel del micrófono. La marca amarilla es el umbral: el sonido debe superarla al tocar.</div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="bignote" style={{ color: heard === null ? '#3a4254' : ok || target === undefined ? 'var(--r)' : 'var(--text)' }}>
          {heard === null ? '—' : midiToName(heard, settings.notation, true)}
        </div>
        <div className="dim">{heard === null ? 'Toca una tecla del teclado…' : 'es la nota que oigo'}</div>
      </div>
      {target !== undefined && (
        <p style={{ marginTop: 12 }} className={ok ? '' : 'dim'}>
          {ok ? '✓ ¡Perfecto! El micrófono reconoce tu teclado.' : `Toca el ${midiToName(target, settings.notation)} central (la tecla blanca a la izquierda del grupo de 2 negras del centro).`}
        </p>
      )}
    </div>
  );
}
