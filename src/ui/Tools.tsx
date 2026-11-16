import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { CHORD_TYPES, chordNotes, detectChord, midiToName, rangeForKeys } from '../engine/theory';
import { getSynth, useLiveInput } from './audio';
import { MicTest, Piano } from './common';
import { COLORS } from './render';

type Tab = 'mic' | 'free' | 'metro' | 'chords';

export function Tools() {
  const [tab, setTab] = useState<Tab>('mic');
  const tabs: [Tab, string][] = [['mic', 'Probar micrófono'], ['free', 'Juego libre'], ['metro', 'Metrónomo'], ['chords', 'Acordes']];
  return (
    <div className="page">
      <h1>Herramientas</h1>
      <div className="tabs" style={{ marginTop: 14 }}>
        {tabs.map(([id, label]) => <button key={id} className={`btn ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === 'mic' && (
        <div className="card">
          <h2>¿Qué oye la app?</h2>
          <p className="dim">Toca notas sueltas en tu teclado. Si la nota que aparece coincide con la que tocas, todo está listo. Si no aparece nada, acerca el micrófono o sube la sensibilidad en Ajustes.</p>
          <MicTest />
        </div>
      )}
      {tab === 'free' && <FreePlay />}
      {tab === 'metro' && <Metronome />}
      {tab === 'chords' && <Chords />}
    </div>
  );
}

function FreePlay() {
  const settings = useStore((s) => s.settings);
  const [lo, hi] = rangeForKeys(settings.keys);
  const [held, setHeld] = useState<number[]>([]);
  const [heard, setHeard] = useState<number | null>(null);
  const synth = getSynth();
  const on = (m: number, sound: boolean) => { if (sound) synth.noteOn(m); setHeld((h) => (h.includes(m) ? h : [...h, m])); };
  const off = (m: number) => { synth.noteOff(m); setHeld((h) => h.filter((x) => x !== m)); };
  const status = useLiveInput({
    onNoteOn: (m, src) => on(m, src === 'pc'),
    onNoteOff: off,
    onMic: (o) => { if (o.heard !== null) setHeard(o.heard); else if (!o.active) setHeard(null); },
  });
  const highlights = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of held) map.set(m, COLORS.R);
    if (heard !== null) map.set(heard, COLORS.gold);
    return map;
  }, [held, heard]);
  const names = [...held].sort((a, b) => a - b);
  const chord = detectChord(names, settings.notation);
  return (
    <div className="card">
      <h2>Juego libre</h2>
      <p className="dim">Toca con el ratón, con el teclado del PC (<span className="kbd">A S D F G H J K</span>, negras <span className="kbd">W E T Y U</span>, octava <span className="kbd">Z</span>/<span className="kbd">X</span> · actual {status.octave}) o en tu teclado: la tecla que oye el micrófono se marca en amarillo.</p>
      <div className="bignote" style={{ fontSize: 40, margin: '10px 0 14px' }}>
        {chord ?? (names.length ? names.map((m) => midiToName(m, settings.notation, true)).join(' ') : heard !== null ? midiToName(heard, settings.notation, true) : '—')}
      </div>
      <Piano lo={Math.max(lo, 36)} hi={Math.min(hi, 96)} highlights={highlights} onDown={(m) => on(m, true)} onUp={off} />
      <div className={`small ${status.state === 'error' ? 'err' : 'dim'}`} style={{ marginTop: 8 }}>{status.message}</div>
    </div>
  );
}

function Metronome() {
  const [bpm, setBpm] = useState(80);
  const [beats, setBeats] = useState(4);
  const [on, setOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const taps = useRef<number[]>([]);
  useEffect(() => {
    if (!on) { setBeat(-1); return; }
    const synth = getSynth();
    let i = 0;
    const tick = () => { synth.click(i % beats === 0); setBeat(i % beats); i++; };
    tick();
    const id = setInterval(tick, 60000 / bpm);
    return () => clearInterval(id);
  }, [on, bpm, beats]);
  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    if (taps.current.length >= 3) {
      const d = (taps.current[taps.current.length - 1] - taps.current[0]) / (taps.current.length - 1);
      setBpm(Math.max(30, Math.min(240, Math.round(60000 / d))));
    }
  };
  return (
    <div className="card">
      <h2>Metrónomo</h2>
      <div className="row" style={{ gap: 18, margin: '12px 0' }}>
        <div className="bignote">{bpm}</div>
        <div className="dim">pulsos por minuto</div>
      </div>
      <input type="range" min={30} max={240} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} style={{ width: '100%' }} />
      <div className="row" style={{ margin: '16px 0' }}>
        {Array.from({ length: beats }, (_, i) => (
          <div key={i} style={{ width: 26, height: 26, borderRadius: 99, background: beat === i ? (i === 0 ? 'var(--gold)' : 'var(--r)') : 'var(--surface2)' }} />
        ))}
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => setOn(!on)}>{on ? '❚❚ Parar' : '▶ Iniciar'}</button>
        <button className="btn" onClick={tap}>Marcar tempo (tap)</button>
        <select value={beats} onChange={(e) => setBeats(Number(e.target.value))}>
          {[2, 3, 4, 6].map((b) => <option key={b} value={b}>{b} pulsos por compás</option>)}
        </select>
      </div>
    </div>
  );
}

function Chords() {
  const notation = useStore((s) => s.settings.notation);
  const [root, setRoot] = useState(0);
  const [type, setType] = useState('maj');
  const [inv, setInv] = useState(0);
  const notes = useMemo(() => {
    const base = chordNotes(60 + root, type);
    for (let i = 0; i < inv && i < base.length; i++) base.push(base.shift()! + 12);
    return base;
  }, [root, type, inv]);
  const highlights = useMemo(() => new Map(notes.map((m) => [m, COLORS.R] as [number, string])), [notes]);
  const synth = getSynth();
  const play = (arp: boolean) => notes.forEach((m, i) => setTimeout(() => synth.noteOn(m, 1.4), arp ? i * 260 : 0));
  const t = CHORD_TYPES.find((c) => c.id === type)!;
  return (
    <div className="card">
      <h2>Diccionario de acordes</h2>
      <div className="row" style={{ marginBottom: 10 }}>
        {Array.from({ length: 12 }, (_, i) => <button key={i} className={`btn sm ${root === i ? 'on' : ''}`} onClick={() => setRoot(i)}>{midiToName(60 + i, notation)}</button>)}
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        {CHORD_TYPES.map((c) => <button key={c.id} className={`btn sm ${type === c.id ? 'on' : ''}`} onClick={() => { setType(c.id); setInv(0); }}>{c.label}</button>)}
      </div>
      <div className="row" style={{ alignItems: 'baseline', gap: 16 }}>
        <div className="bignote" style={{ fontSize: 44 }}>{midiToName(60 + root, notation)}{t.suffix}</div>
        <div className="dim">{notes.map((m) => midiToName(m, notation)).join(' – ')}</div>
      </div>
      <div style={{ margin: '14px 0' }}><Piano lo={48} hi={84} highlights={highlights} onDown={(m) => synth.noteOn(m, 1)} /></div>
      <div className="row">
        <button className="btn primary" onClick={() => play(false)}>▶ Sonar acorde</button>
        <button className="btn" onClick={() => play(true)}>Arpegiado</button>
        <div className="seg">
          {t.intervals.map((_, i) => <button key={i} className={inv === i ? 'on' : ''} onClick={() => setInv(i)}>{i === 0 ? 'Fundamental' : `${i}.ª inversión`}</button>)}
        </div>
      </div>
    </div>
  );
}
