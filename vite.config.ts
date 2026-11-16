import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// La política de seguridad de contenido solo se inyecta en el build final
// (en desarrollo Vite necesita scripts en línea para la recarga en caliente).
const csp = (): Plugin => ({
  name: 'csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: data:" />`,
    ),
});

export default defineConfig({
  base: './',
  plugins: [react(), csp()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
