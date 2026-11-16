# Piano App 🎹

Aplicación de escritorio para **aprender piano desde cero**: ves en pantalla qué tocar (notas que caen o pentagrama), tocas en tu teclado y la app **te escucha por el micrófono** y te corrige. Funciona sin internet.

## Descargar (Windows)

1. Ve a **[Releases](https://github.com/Haise-IDK7/Piano-app/releases/latest)**.
2. Descarga `Piano-App-Setup-x.y.z.exe` (instalador) o `Piano-App-Portable-x.y.z.exe` (no requiere instalación).
3. El ejecutable no está firmado. Si Windows muestra «Windows protegió su PC», pulsa **Más información → Ejecutar de todas formas**.
4. La primera vez, Windows pedirá permiso para usar el micrófono: acéptalo. (Configuración → Privacidad → Micrófono → «Permitir que las aplicaciones de escritorio accedan al micrófono».)

## Cómo se usa

1. **Asistente inicial**: elige cómo escucha la app tu teclado (micrófono, cable USB/MIDI o solo teclado del PC) y prueba que reconoce el Do central.
2. **Curso**: 14 lecciones cortas, de «encontrar el Do central» a tocar con dos manos.
3. **Canciones**: 15 piezas de dominio público incluidas, y puedes traer las tuyas.
4. **Práctica**:
   - **Espera**: la canción se detiene en cada nota hasta que toques la correcta (recomendado con micrófono).
   - **Tiempo**: la canción no espera; se puntúa acierto y ritmo.
   - **Ver**: la app toca la canción para que la escuches.
   - Vista **Cascada** (estilo Synthesia) o **Pentagrama** (tecla `V`), manos separadas, velocidad 30–150 %, bucle por secciones con «escalera de tempo», metrónomo.

### Traer la canción que quieres aprender

| Formato | Extensiones | Notas |
|---|---|---|
| **MIDI** | `.mid` `.midi` | El más fácil de encontrar. Si trae varias pistas, eliges cuál es cada mano. |
| **MusicXML** | `.musicxml` `.xml` `.mxl` | El de las partituras digitales (MuseScore, Sibelius…). Ya indica la mano. |
| **Texto de notas** | pegar o `.txt` | `Mi Mi Fa Sol Sol Fa Mi Re` — ideal para melodías copiadas de una web. |

Arrastra el archivo a la ventana, o usa **Canciones → Importar archivo / Pegar notas**. El buscador de Canciones abre tu navegador en sitios donde encontrar MIDI/MusicXML. **No sirven** PDF, fotos de partituras ni MP3/vídeo.

Sintaxis del texto de notas:

```
titulo: Oda a la Alegría
bpm: 108
D: Mi4 Mi4 Fa4 Sol4 | Sol4 Fa4 Mi4 Re4 | Do4 Do4 Re4 Mi4 | Mi4:1.5 Re4:0.5 Re4:2
I: Do3:4 | Sol3:4 | Do3:4 | Do3:2 Sol3:2
```

`Do4` = Do central · `:2` = dura 2 pulsos · `-` = silencio · `[Do Mi Sol]` = acorde · `D:` mano derecha · `I:` mano izquierda. También vale `C D E F G A B`.

### Consejos para el micrófono

- Habitación en silencio, portátil a menos de 1 m del parlante del teclado, volumen medio-alto.
- Mejor aún: cable de audio de la salida PHONES del teclado a la entrada de micrófono/línea del PC.
- Si la app no oye tus notas, sube la **sensibilidad** en Ajustes. Compruébalo en **Herramientas → Probar micrófono**.
- Límites reales: las notas sueltas se reconocen bien; los acordes y los pasajes rápidos, con menos exactitud. Con acordes la app comprueba que suenen las notas esperadas, pero no puede decirte qué nota equivocada tocaste. Si tu teclado tiene USB/MIDI, esa entrada es exacta.

## Desarrollo

```bash
npm install
npm run dev        # interfaz en el navegador (http://localhost:5173)
npm test           # pruebas del motor (teoría, importadores, evaluación, detección de tono)
npm start          # compila y abre en Electron
npm run dist:win   # genera release/*.exe (en Windows)
```

Para publicar una versión: sube la versión en `package.json`, crea el tag (`git tag v1.0.1 && git push --tags`) y GitHub Actions compila y adjunta los `.exe` al Release.

Estructura: `src/engine` (TypeScript puro, con pruebas: teoría, formatos, detección por micrófono, evaluación, reproductor), `src/ui` (React + Canvas), `src/content` (canciones y lecciones), `electron` (ventana y permisos). El plan de diseño está en [`docs/PLAN_Piano-app_v2.txt`](docs/PLAN_Piano-app_v2.txt).

## Licencia

MIT. Las canciones incluidas son obras de dominio público codificadas para este proyecto.
