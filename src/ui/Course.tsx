import { useState } from 'react';
import { useStore } from '../store';
import { LESSONS, LEVEL_NAMES, type Lesson } from '../content/lessons';
import { Stars } from './common';
import { startPractice } from './Practice';

export function Course() {
  const lessons = useStore((s) => s.progress.lessons);
  const firstPending = LESSONS.find((l) => !lessons[l.id]);
  const [open, setOpen] = useState<Lesson | null>(null);

  if (open) {
    const idx = LESSONS.indexOf(open);
    return (
      <div className="page" style={{ maxWidth: 820 }}>
        <button className="btn sm ghost" onClick={() => setOpen(null)}>← Curso</button>
        <div className="chip r" style={{ margin: '14px 0 6px' }}>Lección {idx + 1} · {LEVEL_NAMES[open.level]}</div>
        <h1>{open.title}</h1>
        <p className="dim">Objetivo: {open.goal}</p>
        <div className="card lesson-body" style={{ margin: '16px 0' }}>
          {open.body.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <div className="row">
          <button className="btn" onClick={() => startPractice(open.song, open.id, 'watch')}>👁 Ver demostración</button>
          <button className="btn primary" onClick={() => startPractice(open.song, open.id, 'wait')}>▶ Practicar</button>
          {lessons[open.id] !== undefined && <Stars n={lessons[open.id]} />}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Curso desde cero</h1>
      <p className="dim">Lecciones cortas: lee, mira la demostración y toca. La app te espera en cada nota.</p>
      {LEVEL_NAMES.map((name, level) => (
        <div key={level} style={{ marginTop: 22 }}>
          <h2>Nivel {level} · {name}</h2>
          <div className="grid g3">
            {LESSONS.filter((l) => l.level === level).map((l) => (
              <div key={l.id} className="card click" onClick={() => setOpen(l)} style={l === firstPending ? { borderColor: 'var(--r)' } : undefined}>
                <div className="spread">
                  <span className="dim small">Lección {LESSONS.indexOf(l) + 1}</span>
                  {lessons[l.id] !== undefined ? <Stars n={lessons[l.id]} /> : l === firstPending ? <span className="chip r">Siguiente</span> : null}
                </div>
                <h3 style={{ marginTop: 6 }}>{l.title}</h3>
                <div className="dim small">{l.goal}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
