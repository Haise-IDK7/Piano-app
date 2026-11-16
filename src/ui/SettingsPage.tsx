import { useEffect, useState } from 'react';
import { useStore, type Settings } from '../store';
import { MicInput } from '../engine/inputs';
import { MicTest } from './common';

export function InputFields() {
  const s = useStore((x) => x.settings);
  const set = useStore((x) => x.set);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => { void MicInput.devices().then(setDevices); }, [s.input]);
  return (
    <div className="set">
      <div>¿Cómo escucha la app tu teclado?</div>
      <select value={s.input} onChange={(e) => set({ input: e.target.value as Settings['input'] })}>
        <option value="mic">Micrófono del PC (recomendado para teclados sin USB)</option>
        <option value="midi">Cable USB / MIDI (lo más preciso, si tu teclado lo tiene)</option>
        <option value="none">Sin teclado: solo teclado del PC y ratón</option>
      </select>
      {s.input === 'mic' && (
        <>
          <div>Micrófono</div>
          <select value={s.micDeviceId} onChange={(e) => set({ micDeviceId: e.target.value })}>
            <option value="">Predeterminado del sistema</option>
            {devices.filter((d) => d.deviceId && d.deviceId !== 'default').map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Micrófono'}</option>)}
          </select>
        </>
      )}
      <div>Teclas de tu teclado</div>
      <select value={s.keys} onChange={(e) => set({ keys: Number(e.target.value) })}>
        {[49, 54, 61, 76, 88].map((k) => <option key={k} value={k}>{k} teclas</option>)}
      </select>
    </div>
  );
}

export function SettingsPage() {
  const s = useStore((x) => x.settings);
  const { set, resetAll, notify } = useStore.getState();
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1>Ajustes</h1>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Entrada</h2>
        <InputFields />
      </div>
      {s.input === 'mic' && (
        <div className="card" style={{ marginTop: 14 }}>
          <h2>Micrófono</h2>
          <div className="set" style={{ marginBottom: 16 }}>
            <div>Sensibilidad<div className="dim small">Súbela si la app no oye tus notas; bájala si reacciona al ruido.</div></div>
            <div className="row"><input type="range" min={0} max={1} step={0.05} value={s.sensitivity} onChange={(e) => set({ sensitivity: Number(e.target.value) })} style={{ flex: 1 }} /><b>{Math.round(s.sensitivity * 100)} %</b></div>
            <div>Aceptar la nota en otra octava<div className="dim small">Recomendado: el micrófono a veces confunde la octava.</div></div>
            <label className="row"><input type="checkbox" checked={s.octaveTolerant} onChange={(e) => set({ octaveTolerant: e.target.checked })} /> Activado</label>
            <div>Acordes: perdonar una nota<div className="dim small">En acordes de 3 o más notas basta con oír todas menos una.</div></div>
            <label className="row"><input type="checkbox" checked={s.chordTolerance} onChange={(e) => set({ chordTolerance: e.target.checked })} /> Activado</label>
            <div>Uso audífonos en el PC<div className="dim small">Si no, la app silencia su propio sonido al practicar para no escucharse a sí misma.</div></div>
            <label className="row"><input type="checkbox" checked={s.headphones} onChange={(e) => set({ headphones: e.target.checked })} /> Sí, uso audífonos</label>
            <div>Retardo del micrófono<div className="dim small">Solo afecta al modo «Tiempo». Súbelo si te marca tarde aunque toques a tiempo.</div></div>
            <div className="row"><input type="range" min={0} max={400} step={10} value={s.micLatencyMs} onChange={(e) => set({ micLatencyMs: Number(e.target.value) })} style={{ flex: 1 }} /><b>{s.micLatencyMs} ms</b></div>
          </div>
          <MicTest />
          <p className="warn" style={{ marginTop: 14 }}>
            Para la mejor detección: habitación en silencio, portátil a menos de 1 m del parlante del teclado y volumen medio-alto.
            Aún mejor: un cable de audio desde la salida PHONES del teclado a la entrada de micrófono/línea del PC.
          </p>
        </div>
      )}
      <div className="card" style={{ marginTop: 14 }}>
        <h2>Pantalla</h2>
        <div className="set">
          <div>Nombres de las notas</div>
          <select value={s.notation} onChange={(e) => set({ notation: e.target.value as Settings['notation'] })}>
            <option value="latin">Do Re Mi Fa Sol La Si</option>
            <option value="english">C D E F G A B</option>
          </select>
          <div>Mostrar el nombre en cada nota</div>
          <label className="row"><input type="checkbox" checked={s.labels} onChange={(e) => set({ labels: e.target.checked })} /> Activado</label>
          <div>Anticipación<div className="dim small">Segundos de música visibles en pantalla.</div></div>
          <div className="row"><input type="range" min={1.5} max={6} step={0.5} value={s.fallSeconds} onChange={(e) => set({ fallSeconds: Number(e.target.value) })} style={{ flex: 1 }} /><b>{s.fallSeconds} s</b></div>
          <div>Tu nombre</div>
          <input type="text" value={s.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h2>Datos</h2>
        <div className="row">
          <button className="btn" onClick={() => set({ onboarded: false })}>Repetir el asistente inicial</button>
          <button className="btn danger" onClick={() => { if (confirm('¿Borrar ajustes, progreso y canciones importadas?')) { resetAll(); notify('Datos borrados.'); } }}>Borrar todos los datos</button>
        </div>
        <p className="dim small" style={{ marginTop: 12 }}>Piano App v1.0 · Todo se guarda en este equipo. El audio del micrófono se analiza localmente y nunca se graba ni se envía.</p>
      </div>
    </div>
  );
}
