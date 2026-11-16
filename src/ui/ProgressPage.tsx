import { streakOf, starsFor, useStore } from '../store';
import { LESSONS } from '../content/lessons';
import { Stars } from './common';

const MODE: Record<string, string> = { wait: 'Espera', realtime: 'Tiempo', watch: 'Ver' };

export function ProgressPage() {
  const p = useStore((s) => s.progress);
  const total = Object.values(p.days).reduce((a, b) => a + b, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { label: `${d.getDate()}/${d.getMonth() + 1}`, min: (p.days[key] ?? 0) / 60 };
  });
  const max = Math.max(5, ...days.map((d) => d.min));
  const mastered = Object.values(p.best).filter((a) => a >= 0.95).length;
  return (
    <div className="page">
      <h1>Progreso</h1>
      <div className="grid g4" style={{ margin: '16px 0' }}>
        <div className="card"><div className="stat">{streakOf(p.days)} 🔥</div><div className="dim small">días seguidos</div></div>
        <div className="card"><div className="stat">{Math.round(total / 60)} min</div><div className="dim small">tiempo total</div></div>
        <div className="card"><div className="stat">{LESSONS.filter((l) => p.lessons[l.id]).length}/{LESSONS.length}</div><div className="dim small">lecciones</div></div>
        <div className="card"><div className="stat">{mastered}</div><div className="dim small">piezas dominadas (★★★)</div></div>
      </div>
      <div className="card">
        <h2>Minutos por día (últimas 2 semanas)</h2>
        <div className="bars">
          {days.map((d, i) => <div key={i}><span>{d.min >= 1 ? Math.round(d.min) : ''}</span><i style={{ height: `${(d.min / max) * 80}%` }} />{d.label}</div>)}
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h2>Últimas sesiones</h2>
        {p.sessions.length === 0 ? <p className="dim">Aún no has terminado ninguna pieza. ¡Empieza por el curso!</p> : (
          <table>
            <thead><tr><th>Fecha</th><th>Pieza</th><th>Modo</th><th>Precisión</th><th /></tr></thead>
            <tbody>
              {p.sessions.slice(0, 15).map((s, i) => (
                <tr key={i}>
                  <td className="dim">{new Date(s.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</td>
                  <td>{s.title}</td><td>{MODE[s.mode] ?? s.mode}</td><td>{Math.round(s.accuracy * 100)} %</td><td><Stars n={starsFor(s.accuracy)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
