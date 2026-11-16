import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { BUILTIN_SONGS } from '../content/songs';
import type { SongDoc } from '../engine/song';
import { midiToSong, type MidiImport, type TrackRole } from '../engine/midiImport';
import { parseText } from '../engine/textFormat';
import { midiToName } from '../engine/theory';
import { ACCEPT, importFile } from './importer';
import { fmtTime, Modal, Stars } from './common';
import { openExternal } from './audio';
import { startPractice } from './Practice';
import { starsFor } from '../store';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function SongCard({ song, best, onDelete }: { song: SongDoc; best?: number; onDelete?: () => void }) {
  const two = song.notes.some((n) => n.hand === 'L') && song.notes.some((n) => n.hand === 'R');
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(song)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${song.title}.pianoapp.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <div className="card">
      <div className="spread">
        <span className="chip">{song.source === 'builtin' ? 'Incluida' : 'Importada'}</span>
        {best !== undefined ? <Stars n={starsFor(best)} /> : <span className="dim small">sin tocar</span>}
      </div>
      <h3 style={{ margin: '10px 0 2px' }}>{song.title}</h3>
      <div className="dim small">{song.composer ?? ' '}</div>
      <div className="row" style={{ margin: '10px 0 12px', gap: 6 }}>
        <span className="chip gold">Nivel {song.difficulty}</span>
        <span className="chip">{fmtTime(song.duration)}</span>
        <span className={`chip ${two ? 'l' : 'r'}`}>{two ? 'Dos manos' : 'Una mano'}</span>
      </div>
      <div className="row">
        <button className="btn primary sm" onClick={() => startPractice(song)}>▶ Aprender</button>
        <button className="btn sm" onClick={() => startPractice(song, undefined, 'watch')}>👁 Ver</button>
        {onDelete && <button className="btn sm ghost" title="Exportar para compartir" onClick={exportJson}>⇩</button>}
        {onDelete && <button className="btn sm ghost danger" title="Eliminar" onClick={onDelete}>✕</button>}
      </div>
    </div>
  );
}

export function Songs({ onMidi }: { onMidi(imp: MidiImport): void }) {
  const imported = useStore((s) => s.imported);
  const best = useStore((s) => s.progress.best);
  const { addSong, removeSong, notify } = useStore.getState();
  const [q, setQ] = useState('');
  const [paste, setPaste] = useState(false);
  const [help, setHelp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => [...imported, ...BUILTIN_SONGS], [imported]);
  const shown = useMemo(() => {
    const k = norm(q.trim());
    return k ? all.filter((s) => norm(`${s.title} ${s.composer ?? ''} ${(s.tags ?? []).join(' ')}`).includes(k)) : all;
  }, [all, q]);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      const r = await importFile(file);
      if (r.kind === 'midi') onMidi(r.imp);
      else { addSong(r.song); notify(`«${r.song.title}» importada (${r.song.notes.length} notas).`); }
    } catch (e) { notify(e instanceof Error ? e.message : 'No se pudo importar.'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const query = encodeURIComponent(q.trim());
  const links: [string, string, string][] = [
    ['MuseScore', `https://musescore.com/sheetmusic?text=${query}`, 'Partituras de la comunidad; descarga en MusicXML o MIDI (requiere cuenta).'],
    ['BitMidi', `https://bitmidi.com/search?q=${query}`, 'Archivos MIDI gratuitos.'],
    ['Web: MIDI de piano', `https://www.google.com/search?q=${query}+piano+midi`, 'Búsqueda general de archivos .mid.'],
    ['Web: notas Do Re Mi', `https://www.google.com/search?q=${query}+notas+piano+do+re+mi`, 'Para copiar y usar «Pegar notas».'],
  ];

  return (
    <div className="page">
      <div className="spread">
        <div>
          <h1>Canciones</h1>
          <p className="dim">Elige una canción o trae la que quieres aprender: la app la convierte en tutorial.</p>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => fileRef.current?.click()}>⇧ Importar archivo</button>
          <button className="btn" onClick={() => setPaste(true)}>✎ Pegar notas</button>
          <button className="btn ghost" onClick={() => setHelp(true)}>¿Qué formatos?</button>
          <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
      </div>

      <input type="text" placeholder="Busca una canción: «Para Elisa», «Bohemian Rhapsody»…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', margin: '14px 0', fontSize: 16, padding: '12px 16px' }} />

      {q.trim() && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>{shown.length ? '¿No es la que buscas? Encuéntrala en internet' : `«${q.trim()}» no está en tu biblioteca. Búscala en internet:`}</h3>
          <p className="dim small">Se abre tu navegador con la búsqueda hecha. Descarga el archivo <b>.mid</b> o <b>.musicxml</b> y arrástralo a esta ventana. Usa solo material que tengas derecho a usar.</p>
          <div className="row">
            {links.map(([label, url, tip]) => <button key={label} className="btn sm" title={tip} onClick={() => openExternal(url)}>{label} ↗</button>)}
          </div>
        </div>
      )}

      <div className="grid g3">
        {shown.map((s) => (
          <SongCard key={s.id} song={s} best={best[s.id]} onDelete={s.source === 'builtin' ? undefined : () => removeSong(s.id)} />
        ))}
      </div>

      {paste && <PasteDialog onClose={() => setPaste(false)} />}
      {help && (
        <Modal onClose={() => setHelp(false)}>
          <h2>Formatos que la app convierte en tutorial</h2>
          <table>
            <tbody>
              <tr><td><b>MIDI</b><br /><span className="dim small">.mid .midi</span></td><td>El más fácil de encontrar para canciones famosas. Contiene cada nota con su inicio y duración. Si trae varias pistas, eliges cuál es cada mano.</td></tr>
              <tr><td><b>MusicXML</b><br /><span className="dim small">.musicxml .xml .mxl</span></td><td>El formato de las partituras digitales (MuseScore, Sibelius, Finale…). Ya indica qué toca cada mano. El mejor cuando existe.</td></tr>
              <tr><td><b>Texto de notas</b><br /><span className="dim small">pegar o .txt</span></td><td>Notas escritas: <code>Mi Mi Fa Sol Sol Fa Mi Re</code>. Ideal para melodías copiadas de una web.</td></tr>
              <tr><td><b>Piano App</b><br /><span className="dim small">.pianoapp.json</span></td><td>Canciones exportadas desde esta app.</td></tr>
            </tbody>
          </table>
          <p className="warn" style={{ marginTop: 14 }}>No sirven: PDF o fotos de partituras (son imágenes) ni MP3/vídeos (la app no transcribe audio en esta versión).</p>
          <button className="btn primary" onClick={() => setHelp(false)}>Entendido</button>
        </Modal>
      )}
    </div>
  );
}

function PasteDialog({ onClose }: { onClose(): void }) {
  const { addSong, notify } = useStore.getState();
  const notation = useStore((s) => s.settings.notation);
  const [title, setTitle] = useState('');
  const [bpm, setBpm] = useState(100);
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseText(`bpm: ${bpm}\n${text}`, { title: title.trim() || 'Mi canción' }), [text, bpm, title]);
  const n = parsed.song.notes.length;
  return (
    <Modal onClose={onClose}>
      <h2>Pegar notas</h2>
      <p className="dim small">
        Escribe o pega las notas separadas por espacios, en Do-Re-Mi o en C-D-E.<br />
        Opcional: octava (<code>Do4</code> = Do central), duración en pulsos (<code>Sol:2</code>), silencio (<code>-</code>), acorde (<code>[Do Mi Sol]</code>),
        sostenido/bemol (<code>Fa#</code>, <code>Sib</code>). Para dos manos empieza las líneas con <code>D:</code> e <code>I:</code>.
      </p>
      <div className="row" style={{ marginBottom: 10 }}>
        <label className="field" style={{ flex: 1 }}>Título<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mi canción" /></label>
        <label className="field">Tempo (pulsos/min)<input type="number" min={30} max={240} value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 100)} style={{ width: 110 }} /></label>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'Mi Mi Fa Sol | Sol Fa Mi Re | Do Do Re Mi | Mi:1.5 Re:0.5 Re:2'} autoFocus />
      <div className="small" style={{ margin: '8px 0 14px' }}>
        {n > 0 ? <span>✓ {n} notas · {fmtTime(parsed.song.duration)} · empieza en {midiToName(parsed.song.notes[0].midi, notation, true)}</span> : <span className="dim">Aún no hay notas.</span>}
        {parsed.warnings.length > 0 && <div className="err">{parsed.warnings.slice(0, 4).join(' · ')}</div>}
      </div>
      <div className="row">
        <button className="btn primary" disabled={!n} onClick={() => { addSong(parsed.song); notify(`«${parsed.song.title}» guardada.`); onClose(); }}>Guardar canción</button>
        <button className="btn" disabled={!n} onClick={() => { addSong(parsed.song); onClose(); startPractice(parsed.song); }}>Guardar y aprender</button>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}

/** Asistente de importación MIDI: qué pista toca cada mano. */
export function MidiDialog({ imp, onClose }: { imp: MidiImport; onClose(): void }) {
  const { addSong, notify, go } = useStore.getState();
  const [title, setTitle] = useState(imp.title);
  const [roles, setRoles] = useState<TrackRole[]>(imp.tracks.map((t) => t.role));
  const [split, setSplit] = useState(60);
  const notation = useStore((s) => s.settings.notation);
  const build = () => midiToSong({ ...imp, title: title.trim() || imp.title, tracks: imp.tracks.map((t, i) => ({ ...t, role: roles[i] })) }, split);
  const used = roles.some((r) => r !== 'skip');
  const finish = (learn: boolean) => {
    const song = build();
    if (!song.notes.length) { notify('Selecciona al menos una pista.'); return; }
    addSong(song);
    onClose();
    if (learn) startPractice(song);
    else { go('songs'); notify(`«${song.title}» importada (${song.notes.length} notas).`); }
  };
  return (
    <Modal onClose={onClose}>
      <h2>Importar MIDI</h2>
      <label className="field" style={{ marginBottom: 12 }}>Título<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <p className="dim small">
        {imp.tracks.length === 1
          ? 'El archivo tiene una sola pista: se divide en dos manos por la nota que elijas.'
          : 'El archivo tiene varias pistas. Indica cuál toca cada mano; ignora voz, batería u otros instrumentos.'}
      </p>
      <table>
        <thead><tr><th>Pista</th><th>Notas</th><th>Registro</th><th>Usar como</th></tr></thead>
        <tbody>
          {imp.tracks.map((t, i) => (
            <tr key={i}>
              <td>{t.name}</td><td>{t.noteCount}</td><td>{midiToName(Math.round(t.avgPitch), notation, true)}</td>
              <td>
                <select value={roles[i]} onChange={(e) => setRoles(roles.map((r, j) => (j === i ? (e.target.value as TrackRole) : r)))}>
                  <option value="R">Mano derecha</option>
                  <option value="L">Mano izquierda</option>
                  <option value="split">Ambas (dividir)</option>
                  <option value="skip">Ignorar</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {roles.includes('split') && (
        <label className="row small dim" style={{ marginTop: 12 }}>
          Dividir manos en
          <input type="range" min={48} max={72} value={split} onChange={(e) => setSplit(Number(e.target.value))} />
          <b style={{ color: 'var(--text)' }}>{midiToName(split, notation, true)}</b> (de ahí hacia arriba = derecha)
        </label>
      )}
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn primary" disabled={!used} onClick={() => finish(true)}>Importar y aprender</button>
        <button className="btn" disabled={!used} onClick={() => finish(false)}>Solo importar</button>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}
