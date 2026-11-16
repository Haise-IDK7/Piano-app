// Pantalla de práctica: cascada / pentagrama, modos, bucles y corrección en vivo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { starsFor, useStore } from '../store';
import { fitToRange, songRange, type SongDoc } from '../engine/song';
import { midiToName, rangeForKeys } from '../engine/theory';
import { Player, type Feedback, type Mode } from '../engine/player';
import type { Stats } from '../engine/matcher';
import { LESSONS } from '../content/lessons';
import { getSynth, useLiveInput } from './audio';
import { COLORS, drawCascade, drawKeyboard, drawStaff, keyAt, layoutKeyboard, viewRange, type KeyLayout } from './render';
import { fmtTime, Modal, Stars } from './common';

type HandSel = 'both' | 'R' | 'L';
const MODE_LABEL: Record<Mode, string> = { watch: 'Ver', wait: 'Espera', realtime: 'Tiempo' };

export function Practice() {
  const target = useStore((s) => s.target)!;
  const settings = useStore((s) => s.settings);
  const { go, record, addTime } = useStore.getState();
  const synth = getSynth();

  const [kbLo, kbHi] = rangeForKeys(settings.keys);
  const song: SongDoc = useMemo(() => {
    const [lo, hi] = songRange(target.song.notes);
    if (lo >= kbLo && hi <= kbHi) return target.song;
    return { ...target.song, notes: fitToRange(target.song.notes, kbLo, kbHi) };
  }, [target.song, kbLo, kbHi]);
  const adapted = song !== target.song;
  const hasL = song.notes.some((n) => n.hand === 'L');
  const hasR = song.notes.some((n) => n.hand === 'R');
  const twoHands = hasL && hasR;

  const [mode, setMode] = useState<Mode>(target.mode ?? 'wait');
  const [hand, setHand] = useState<HandSel>('both');
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<'cascade' | 'staff'>('cascade');
  const [loopIdx, setLoopIdx] = useState<number | null>(null);
  const [metronome, setMetronome] = useState(false);
  const [ladder, setLadder] = useState(true);
  const [policy, setPolicy] = useState<'continue' | 'repeat'>('continue');
  const [autoOther, setAutoOther] = useState(true);
  const [result, setResult] = useState<{ stats: Stats; trouble: [number, number][] } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [hud, setHud] = useState({ time: 0, acc: 1, streak: 0, playing: false, level: 0, heard: null as number | null, judged: 0 });

  const isMic = settings.input === 'mic';
  const muted = isMic && !settings.headphones;
  const hands = useMemo(() => ({ R: hand !== 'L' || !twoHands, L: hand !== 'R' || !twoHands }), [hand, twoHands]);

  const viewRef = useRef(view);
  viewRef.current = view;
  const playerRef = useRef<Player | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useRef(new Set<number>());
  const micRef = useRef({ level: 0, heard: null as number | null, heardAt: 0 });
  const played = useRef(0);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cfgRef = useRef({ mode, lessonId: target.lessonId });
  cfgRef.current = { mode, lessonId: target.lessonId };

  const flashBanner = useCallback((msg: string) => {
    setBanner(msg);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 1600);
  }, []);

  // Crear el reproductor para esta canción.
  useEffect(() => {
    const flush = () => { if (played.current > 1) { addTime(Math.round(played.current)); played.current = 0; } };
    const p = new Player(song, {
      mode, speed, hands, autoplayOther: autoOther, loop: null, metronome, latency: isMic ? settings.micLatencyMs / 1000 : 0,
      octaveTolerant: settings.octaveTolerant, window: isMic ? 0.35 : 0.2, errorPolicy: policy, repeatAfter: 3, ladder, muted,
    }, synth, {
      onFinish: (stats) => {
        const trouble = [...p.matcher.trouble.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
        setResult({ stats, trouble });
        if (cfgRef.current.mode !== 'watch' && stats.total > 0) {
          record({ songId: song.id, title: song.title, mode: cfgRef.current.mode, accuracy: stats.accuracy, seconds: Math.round(played.current) }, cfgRef.current.lessonId);
        }
        flush();
      },
      onFeedback: (f: Feedback) => {
        if (f.kind === 'rewind') flashBanner('Varios errores: repetimos la sección');
        else if (f.kind === 'loop') {
          setSpeed(f.speed);
          if (p.cfg.mode !== 'watch') flashBanner(`Pasada: ${Math.round(f.stats.accuracy * 100)} % · velocidad ${Math.round(f.speed * 100)} %`);
        }
      },
    });
    playerRef.current = p;
    setResult(null);
    setLoopIdx(null);
    return () => { p.pause(); flush(); playerRef.current = null; };
  }, [song]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar configuración.
  useEffect(() => { playerRef.current?.setConfig({ mode, hands }); }, [mode, hands]);
  useEffect(() => {
    playerRef.current?.setConfig({
      speed, autoplayOther: autoOther, metronome, ladder, errorPolicy: policy, muted,
      latency: isMic ? settings.micLatencyMs / 1000 : 0,
    });
  }, [speed, autoOther, metronome, ladder, policy, muted, isMic, settings.micLatencyMs]);
  useEffect(() => {
    const sec = loopIdx === null ? null : song.sections[loopIdx];
    playerRef.current?.setConfig({ loop: sec ? { start: sec.start, end: sec.end } : null });
  }, [loopIdx, song]);

  const noteOn = useCallback((midi: number, source: 'midi' | 'pc') => {
    held.current.add(midi);
    if (source === 'pc') synth.noteOn(midi);
    playerRef.current?.noteOn(midi);
  }, [synth]);
  const noteOff = useCallback((midi: number) => { held.current.delete(midi); synth.noteOff(midi); }, [synth]);

  const status = useLiveInput({
    onNoteOn: noteOn,
    onNoteOff: noteOff,
    onMic: (o, tracker, ms) => {
      micRef.current.level = o.level;
      if (o.heard !== null) { micRef.current.heard = o.heard; micRef.current.heardAt = ms; }
      else if (ms - micRef.current.heardAt > 700) micRef.current.heard = null;
      playerRef.current?.micOutput(o, tracker, ms);
    },
  });

  // Bucle de animación y dibujo.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0, last = performance.now(), w = 0, h = 0;
    let lay: KeyLayout | null = null;
    const [sLo, sHi] = songRange(song.notes);
    const [lo, hi] = viewRange(sLo, sHi, kbLo, kbHi);
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lay = layoutKeyboard(lo, hi, w);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const p = playerRef.current;
      if (!p || !lay || h < 50) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (p.playing) played.current += dt;
      p.update(dt);
      const kbH = Math.min(140, h * 0.24);
      const top = h - kbH;
      const expected = p.expected();
      const opts = {
        time: p.time, fallSeconds: settings.fallSeconds, notation: settings.notation, labels: settings.labels,
        hands: p.cfg.hands, expected, bpm: song.bpm, beatsPerBar: song.beatsPerBar,
      };
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, w, top); ctx.clip();
      if (viewRef.current === 'cascade') drawCascade(ctx, lay, top, song.notes, opts);
      else drawStaff(ctx, w, top, song.notes, opts);
      ctx.restore();
      const highlights = new Map<number, string>();
      const outlines = new Map<number, string>();
      if (p.cfg.mode === 'watch' || p.cfg.autoplayOther) {
        for (const n of song.notes) {
          if (n.start <= p.time && n.start + n.dur > p.time && (p.cfg.mode === 'watch' || !p.cfg.hands[n.hand])) {
            highlights.set(n.midi, n.hand === 'R' ? COLORS.R : COLORS.L);
          }
        }
      }
      for (const m of held.current) highlights.set(m, '#c5cede');
      for (const n of expected) outlines.set(n.midi, n.hand === 'R' ? COLORS.Rdark : COLORS.Ldark);
      for (const [m, f] of p.flashes) {
        if (f.until < now) p.flashes.delete(m);
        else highlights.set(m, f.kind === 'hit' ? COLORS.gold : COLORS.error);
      }
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, top, w, kbH);
      drawKeyboard(ctx, lay, top + 3, kbH - 3, { highlights, outlines, labels: true, notation: settings.notation });
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [song, kbLo, kbHi, settings.fallSeconds, settings.notation, settings.labels]);

  // HUD a 10 Hz.
  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const st = p.cfg.loop ? p.matcher.stats(p.cfg.loop.start, p.cfg.loop.end) : p.matcher.stats();
      setHud({
        time: p.time, acc: st.accuracy, streak: p.streak, playing: p.playing, level: micRef.current.level, heard: micRef.current.heard,
        judged: st.hits + st.misses + st.wrong,
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.playing) p.pause();
    else { setResult(null); p.play(); }
  }, []);
  const restart = useCallback(() => { setResult(null); playerRef.current?.restart(); playerRef.current?.play(); }, []);

  // Atajos de teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range') return;
      if (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      const p = playerRef.current;
      const bar = (60 / song.bpm) * song.beatsPerBar;
      switch (e.code) {
        case 'Space': e.preventDefault(); toggle(); break;
        case 'KeyR': restart(); break;
        case 'KeyV': setView((v) => (v === 'cascade' ? 'staff' : 'cascade')); break;
        case 'KeyM': setMetronome((m) => !m); break;
        case 'ArrowUp': e.preventDefault(); setSpeed((s) => Math.min(1.5, Math.round((s + 0.05) * 100) / 100)); break;
        case 'ArrowDown': e.preventDefault(); setSpeed((s) => Math.max(0.3, Math.round((s - 0.05) * 100) / 100)); break;
        case 'ArrowLeft': if (p) p.seek(Math.max(p.startTime, p.time - bar), false); break;
        case 'ArrowRight': if (p) p.seek(Math.min(p.endTime - 0.1, Math.max(0, p.time) + bar), false); break;
        case 'Escape': go(cfgRef.current.lessonId ? 'course' : 'songs'); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [song, toggle, restart, go]);

  const pickKey = (e: React.PointerEvent): number | null => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const kbH = Math.min(140, r.height * 0.24);
    const y = e.clientY - r.top - (r.height - kbH);
    if (y < 0) return null;
    const [sLo, sHi] = songRange(song.notes);
    const [lo, hi] = viewRange(sLo, sHi, kbLo, kbHi);
    return keyAt(layoutKeyboard(lo, hi, r.width), e.clientX - r.left, y - 3, kbH - 3);
  };
  const mouseKey = useRef<number | null>(null);

  const nextLesson = target.lessonId ? LESSONS[LESSONS.findIndex((l) => l.id === target.lessonId) + 1] : undefined;
  const curSection = song.sections.findIndex((s) => hud.time >= s.start && hud.time < s.end);
  const stars = result ? starsFor(result.stats.accuracy) : 0;

  return (
    <div className="practice">
      <div className="pbar">
        <button className="btn sm ghost" onClick={() => go(target.lessonId ? 'course' : 'songs')}>← Volver</button>
        <div style={{ minWidth: 0, maxWidth: 260 }}>
          <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
          <div className="dim small">{song.composer ?? ''} {adapted && '· adaptada a tu teclado'}</div>
        </div>
        <div className="sep" />
        <button className="btn primary" onClick={toggle} style={{ minWidth: 104 }}>{hud.playing ? '❚❚ Pausa' : '▶ Tocar'}</button>
        <button className="btn sm" onClick={restart} title="Reiniciar (R)">↺</button>
        <div className="seg" title="Modo">
          {(['watch', 'wait', 'realtime'] as Mode[]).map((m) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{MODE_LABEL[m]}</button>
          ))}
        </div>
        {twoHands && (
          <div className="seg" title="Mano a practicar">
            <button className={hand === 'L' ? 'on l' : ''} onClick={() => setHand('L')}>Izquierda</button>
            <button className={hand === 'both' ? 'on' : ''} onClick={() => setHand('both')}>Ambas</button>
            <button className={hand === 'R' ? 'on r' : ''} onClick={() => setHand('R')}>Derecha</button>
          </div>
        )}
        <label className="row small dim" style={{ gap: 6 }}>
          Velocidad
          <input type="range" min={0.3} max={1.5} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{ width: 110 }} />
          <b style={{ color: 'var(--text)', width: 40 }}>{Math.round(speed * 100)} %</b>
        </label>
        <div className="seg" title="Vista (V)">
          <button className={view === 'cascade' ? 'on' : ''} onClick={() => setView('cascade')}>Cascada</button>
          <button className={view === 'staff' ? 'on' : ''} onClick={() => setView('staff')}>Pentagrama</button>
        </div>
        <button className={`btn sm ${metronome ? 'on' : ''}`} onClick={() => setMetronome(!metronome)} title="Metrónomo (M)">Metrónomo</button>
        {mode === 'realtime' && (
          <select value={policy} onChange={(e) => setPolicy(e.target.value as 'continue' | 'repeat')} title="Qué hacer cuando me equivoco">
            <option value="continue">Error: marcar y seguir</option>
            <option value="repeat">Error: repetir sección (3 fallos)</option>
          </select>
        )}
        {twoHands && hand !== 'both' && mode !== 'watch' && (
          <button className={`btn sm ${autoOther ? 'on' : ''}`} onClick={() => setAutoOther(!autoOther)} disabled={muted} title={muted ? 'Silenciado: micrófono sin audífonos' : ''}>
            La otra mano suena
          </button>
        )}
      </div>

      <div className="sections">
        <button className={loopIdx === null ? 'on' : ''} style={{ flex: '0 0 76px' }} onClick={() => setLoopIdx(null)}>Completa</button>
        {song.sections.map((s, i) => (
          <button
            key={i} className={`${loopIdx === i ? 'on' : ''} ${curSection === i ? 'now' : ''}`}
            title={`Repetir en bucle la sección ${s.name}`} onClick={() => setLoopIdx(loopIdx === i ? null : i)}
          >{s.name}</button>
        ))}
        {loopIdx !== null && mode !== 'watch' && (
          <button className={ladder ? 'on' : ''} style={{ flex: '0 0 150px' }} onClick={() => setLadder(!ladder)} title="Sube 10 % la velocidad tras cada pasada ≥ 90 %">
            Escalera de tempo {ladder ? 'sí' : 'no'}
          </button>
        )}
      </div>
      <div
        className="progress"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setLoopIdx(null);
          setTimeout(() => playerRef.current?.seek(((e.clientX - r.left) / r.width) * song.duration, false), 0);
        }}
      >
        <div style={{ width: `${Math.min(100, Math.max(0, (hud.time / song.duration) * 100))}%` }} />
      </div>

      <div className="stage">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => { const m = pickKey(e); if (m !== null) { mouseKey.current = m; noteOn(m, 'pc'); } }}
          onPointerUp={() => { if (mouseKey.current !== null) { noteOff(mouseKey.current); mouseKey.current = null; } }}
          onPointerLeave={() => { if (mouseKey.current !== null) { noteOff(mouseKey.current); mouseKey.current = null; } }}
        />
        {mode !== 'watch' && (
          <div className="hud">
            <span className="chip">Precisión {hud.judged ? `${Math.round(hud.acc * 100)} %` : '—'}</span>
            <span className="chip gold">Racha {hud.streak}</span>
          </div>
        )}
        {banner && <div className="banner">{banner}</div>}
        {!hud.playing && !result && hud.time <= 0 && (
          <div className="banner" style={{ fontWeight: 500, fontSize: 15, textAlign: 'center', pointerEvents: 'none' }}>
            Pulsa <b>Espacio</b> o «Tocar» para empezar<br />
            <span className="dim small">
              {mode === 'wait' ? 'Modo espera: la canción se detiene hasta que toques la nota correcta.' : mode === 'watch' ? 'Modo ver: mira y escucha cómo suena.' : 'Modo tiempo: la canción no espera; toca al ritmo.'}
            </span>
          </div>
        )}
      </div>

      <div className="pfoot">
        <span className={status.state === 'error' ? 'err' : ''}>{status.message}</span>
        {isMic && status.state === 'ok' && (
          <>
            <div className="meter" style={{ width: 120 }}><div style={{ width: `${Math.min(100, Math.sqrt(hud.level) * 220)}%` }} /></div>
            <span>Oigo: <b style={{ color: 'var(--text)' }}>{hud.heard === null ? '—' : midiToName(hud.heard, settings.notation, true)}</b></span>
            {muted && mode !== 'watch' && <span title="Para que la app no se escuche a sí misma. Si usas audífonos en el PC, actívalo en Ajustes.">🔇 sonido de la app en silencio</span>}
          </>
        )}
        <span style={{ marginLeft: 'auto' }}>
          {fmtTime(hud.time)} / {fmtTime(song.duration)} · <span className="kbd">Espacio</span> tocar · <span className="kbd">R</span> reiniciar · <span className="kbd">↑↓</span> velocidad · <span className="kbd">V</span> vista · teclado PC: <span className="kbd">A S D F G H J</span> octava {status.octave}
        </span>
      </div>

      {result && (
        <Modal onClose={() => setResult(null)}>
          {mode === 'watch' ? (
            <>
              <h2>Fin de la demostración</h2>
              <p className="dim">Ahora inténtalo tú en modo espera: la canción te esperará en cada nota.</p>
              <div className="row">
                <button className="btn primary" onClick={() => { setMode('wait'); setResult(null); setTimeout(restart, 50); }}>Practicar en modo espera</button>
                <button className="btn" onClick={restart}>Ver otra vez</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40 }}><Stars n={stars} /></div>
              <h1>{stars === 3 ? '¡Excelente!' : stars === 2 ? '¡Muy bien!' : stars === 1 ? 'Vas por buen camino' : 'Sigue practicando'}</h1>
              <p className="dim">{song.title} · modo {MODE_LABEL[mode].toLowerCase()} · velocidad {Math.round(speed * 100)} %</p>
              <div className="grid g3" style={{ margin: '14px 0' }}>
                <div className="card"><div className="stat">{Math.round(result.stats.accuracy * 100)} %</div><div className="dim small">Precisión</div></div>
                <div className="card"><div className="stat">{result.stats.hits}/{result.stats.total}</div><div className="dim small">Notas y acordes acertados</div></div>
                <div className="card"><div className="stat">{result.stats.wrong + result.stats.misses}</div><div className="dim small">Errores y omisiones</div></div>
              </div>
              {result.trouble.length > 0 && (
                <p>Lo que más te costó: {result.trouble.map(([m, c]) => <span key={m} className="chip" style={{ marginRight: 6 }}>{midiToName(m, settings.notation, true)} ×{c}</span>)}</p>
              )}
              {stars < 3 && <p className="dim small">Consejo: elige la sección difícil en la barra superior para repetirla en bucle, o baja la velocidad.</p>}
              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn primary" onClick={restart}>Repetir</button>
                {mode === 'wait' && stars >= 2 && <button className="btn" onClick={() => { setMode('realtime'); setResult(null); setTimeout(restart, 50); }}>Probar a tempo</button>}
                {nextLesson && stars >= 1 && <button className="btn blue" onClick={() => go('course')}>Siguiente lección →</button>}
                <button className="btn ghost" onClick={() => go(target.lessonId ? 'course' : 'songs')}>Salir</button>
                {!target.lessonId && nextLesson === undefined && stars >= 2 && speed < 1 && (
                  <button className="btn" onClick={() => { setSpeed(Math.min(1, speed + 0.1)); setResult(null); setTimeout(restart, 50); }}>Más rápido</button>
                )}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

export function startPractice(song: SongDoc, lessonId?: string, mode?: Mode): void {
  useStore.getState().practice({ song, lessonId, mode });
}
