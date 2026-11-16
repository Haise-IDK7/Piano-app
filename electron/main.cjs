// Proceso principal de Electron: ventana, permisos (micrófono/MIDI) y enlaces externos.
const { app, BrowserWindow, session, shell, ipcMain } = require('electron');
const path = require('node:path');

const ALLOWED = new Set(['media', 'midi', 'midiSysex', 'fullscreen']);
const isExternal = (url) => /^https?:\/\//i.test(url);

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#0b0d12',
    autoHideMenuBar: true,
    title: 'Piano App',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault();
      if (isExternal(url)) void shell.openExternal(url);
    }
  });

  if (process.env.PIANO_DEV_URL) void win.loadURL(process.env.PIANO_DEV_URL);
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  // Solo se conceden los permisos que la app necesita, y solo a su propio contenido.
  const own = (wc) => {
    const url = wc ? wc.getURL() : '';
    return url.startsWith('file://') || (!!process.env.PIANO_DEV_URL && url.startsWith(process.env.PIANO_DEV_URL));
  };
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(ALLOWED.has(permission) && own(wc)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => ALLOWED.has(permission) && own(wc));

  ipcMain.handle('open-external', (_e, url) => {
    if (typeof url === 'string' && isExternal(url)) return shell.openExternal(url);
    return undefined;
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
