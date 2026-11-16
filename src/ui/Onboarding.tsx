import { useState } from 'react';
import { useStore } from '../store';
import { MicTest, Modal } from './common';
import { InputFields } from './SettingsPage';

export function Onboarding() {
  const s = useStore((x) => x.settings);
  const set = useStore((x) => x.set);
  const [step, setStep] = useState(0);
  return (
    <Modal>
      <div className="dim small">Paso {step + 1} de 3</div>
      {step === 0 && (
        <>
          <h1>Bienvenido a Piano App 🎹</h1>
          <p className="dim">Vas a aprender piano viendo en pantalla qué tocar, mientras la app escucha tu teclado y te corrige.</p>
          <label className="field" style={{ margin: '14px 0' }}>¿Cómo te llamas? (opcional)<input type="text" value={s.name} onChange={(e) => set({ name: e.target.value })} autoFocus /></label>
          <label className="field">¿Cómo prefieres ver los nombres de las notas?
            <select value={s.notation} onChange={(e) => set({ notation: e.target.value as 'latin' | 'english' })}>
              <option value="latin">Do Re Mi Fa Sol La Si</option>
              <option value="english">C D E F G A B</option>
            </select>
          </label>
        </>
      )}
      {step === 1 && (
        <>
          <h1>Tu teclado</h1>
          <p className="dim">Si tu teclado no tiene puerto USB ni MIDI, elige el micrófono: la app reconocerá las notas por el sonido.</p>
          <div style={{ margin: '16px 0' }}><InputFields /></div>
          <p className="warn">Con micrófono, las notas sueltas se reconocen muy bien; los acordes y pasajes rápidos, con menos exactitud. Por eso el modo por defecto es «Espera»: la canción no avanza hasta oír la nota correcta.</p>
        </>
      )}
      {step === 2 && (
        <>
          <h1>{s.input === 'mic' ? 'Probemos el micrófono' : '¡Todo listo!'}</h1>
          {s.input === 'mic' ? (
            <>
              <p className="dim">Sube el volumen del teclado a un nivel medio y acerca el portátil. Si Windows pregunta, permite el uso del micrófono.</p>
              <MicTest target={60} />
              <p className="dim small" style={{ marginTop: 12 }}>¿No reconoce nada? Puedes continuar y ajustar la sensibilidad más tarde en Ajustes → Micrófono.</p>
            </>
          ) : (
            <p className="dim">{s.input === 'midi' ? 'Conecta el teclado por USB antes de practicar. Podrás comprobarlo en Herramientas → Juego libre.' : 'Podrás tocar con las teclas A S D F G H J del PC o con el ratón.'}</p>
          )}
        </>
      )}
      <div className="row" style={{ marginTop: 20 }}>
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Atrás</button>}
        {step < 2
          ? <button className="btn primary" onClick={() => setStep(step + 1)}>Continuar</button>
          : <button className="btn primary" onClick={() => set({ onboarded: true })}>Empezar a tocar</button>}
      </div>
    </Modal>
  );
}
