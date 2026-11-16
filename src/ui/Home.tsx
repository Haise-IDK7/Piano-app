import { streakOf, today, useStore } from '../store';
import { LESSONS, TIPS } from '../content/lessons';
import { BUILTIN_SONGS } from '../content/songs';
import { startPractice } from './Practice';

export function Home() {
  const { settings, progress, imported } = useStore();
  const go = useStore((s) => s.go);
  const minutesToday = Math.round((progress.days[today()] ?? 0) / 60);
  const nextLesson = LESSONS.find((l) => !progress.lessons[l.id]) ?? null;
  const lessonsDone = LESSONS.filter((l) => progress.lessons[l.id]).length;
  const last = [...BUILTIN_SONGS, ...imported].find((s) => s.id === progress.lastSongId);
  const tip = TIPS[Math.floor(Date.now() / 86400000) % TIPS.length];
  const inputLabel = settings.input === 'mic' ? 'Micrófono' : settings.input === 'midi' ? 'MIDI' : 'Teclado del PC';

  return (
    <div className="page">
      <h1>Hola{settings.name ? `, ${settings.name}` : ''} 👋</h1>
      <p className="dim">Un poco cada día. Hoy también cuenta.</p>
      <div className="grid g4" style={{ margin: '18px 0' }}>
        <div className="card"><div className="stat">{streakOf(progress.days)} 🔥</div><div className="dim small">días seguidos</div></div>
        <div className="card"><div className="stat">{minutesToday} min</div><div className="dim small">practicados hoy</div></div>
        <div className="card"><div className="stat">{lessonsDone}/{LESSONS.length}</div><div className="dim small">lecciones completadas</div></div>
        <div className="card click" onClick={() => go('settings')}><div className="stat" style={{ fontSize: 22, lineHeight: '45px' }}>{inputLabel}</div><div className="dim small">entrada activa · cambiar</div></div>
      </div>
      <div className="grid g2">
        <div className="card">
          <div className="chip r">Curso</div>
          {nextLesson ? (
            <>
              <h2 style={{ marginTop: 8 }}>{nextLesson.title}</h2>
              <p className="dim">{nextLesson.goal}</p>
              <button className="btn primary" onClick={() => go('course')}>Continuar el curso →</button>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 8 }}>¡Curso completado!</h2>
              <p className="dim">Sigue con las canciones de la biblioteca o importa las tuyas.</p>
              <button className="btn primary" onClick={() => go('songs')}>Ir a canciones</button>
            </>
          )}
        </div>
        <div className="card">
          <div className="chip l">Canciones</div>
          {last ? (
            <>
              <h2 style={{ marginTop: 8 }}>{last.title}</h2>
              <p className="dim">Tu mejor precisión: {progress.best[last.id] !== undefined ? `${Math.round(progress.best[last.id] * 100)} %` : 'aún sin terminar'}</p>
              <button className="btn blue" onClick={() => startPractice(last)}>Seguir practicando →</button>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 8 }}>Aprende la canción que quieras</h2>
              <p className="dim">Elige una de la biblioteca o importa un archivo MIDI / MusicXML de tu canción favorita.</p>
              <button className="btn blue" onClick={() => go('songs')}>Ver canciones →</button>
            </>
          )}
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="chip gold">Consejo del día</div>
        <p style={{ fontSize: 17, margin: '8px 0 0' }}>{tip}</p>
      </div>
    </div>
  );
}
