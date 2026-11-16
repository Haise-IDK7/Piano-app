import { useEffect, useState } from 'react';
import { useStore, type Page } from '../store';
import { Home } from './Home';
import { Course } from './Course';
import { Songs, MidiDialog } from './Songs';
import { Practice } from './Practice';
import { Tools } from './Tools';
import { ProgressPage } from './ProgressPage';
import { SettingsPage } from './SettingsPage';
import { Onboarding } from './Onboarding';
import { importFile } from './importer';
import type { MidiImport } from '../engine/midiImport';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'home', label: 'Inicio', icon: '⌂' },
  { id: 'course', label: 'Curso', icon: '✎' },
  { id: 'songs', label: 'Canciones', icon: '♫' },
  { id: 'tools', label: 'Herramientas', icon: '⚙' },
  { id: 'progress', label: 'Progreso', icon: '↗' },
  { id: 'settings', label: 'Ajustes', icon: '☰' },
];

export function App() {
  const page = useStore((s) => s.page);
  const target = useStore((s) => s.target);
  const toast = useStore((s) => s.toast);
  const onboarded = useStore((s) => s.settings.onboarded);
  const { go, loadSongs, addSong, notify } = useStore.getState();
  const [dragging, setDragging] = useState(false);
  const [midi, setMidi] = useState<MidiImport | null>(null);

  useEffect(() => { void loadSongs(); }, [loadSongs]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => notify(null), 3800);
    return () => clearTimeout(id);
  }, [toast, notify]);

  // Arrastrar y soltar un archivo de canción en cualquier pantalla.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const enter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setDragging(true); } };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setDragging(false); };
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = async (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      try {
        const r = await importFile(file);
        if (r.kind === 'midi') setMidi(r.imp);
        else { addSong(r.song); go('songs'); notify(`«${r.song.title}» importada (${r.song.notes.length} notas).`); }
      } catch (err) { notify(err instanceof Error ? err.message : 'No se pudo importar el archivo.'); }
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [addSong, go, notify]);

  const overlays = (
    <>
      {!onboarded && <Onboarding />}
      {midi && <MidiDialog imp={midi} onClose={() => setMidi(null)} />}
      {dragging && <div className="drop">Suelta el archivo para importarlo (.mid, .musicxml, .mxl, .txt)</div>}
      {toast && <div className="toast">{toast}</div>}
    </>
  );

  if (page === 'practice' && target) return <><Practice key={target.song.id + (target.mode ?? '')} />{overlays}</>;

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">Piano<span>App</span></div>
        {NAV.map((n) => (
          <button key={n.id} className={`nav ${page === n.id ? 'on' : ''}`} onClick={() => go(n.id)}>
            <span style={{ width: 18, textAlign: 'center' }}>{n.icon}</span>{n.label}
          </button>
        ))}
        <div className="foot">v1.0 · funciona sin internet<br />Arrastra aquí un .mid o .musicxml</div>
      </aside>
      <main className="main">
        {page === 'home' && <Home />}
        {page === 'course' && <Course />}
        {(page === 'songs' || page === 'practice') && <Songs onMidi={setMidi} />}
        {page === 'tools' && <Tools />}
        {page === 'progress' && <ProgressPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
      {overlays}
    </div>
  );
}
