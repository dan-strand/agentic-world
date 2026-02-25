import { app, BrowserWindow } from 'electron';
import { registerIpcHandlers } from './ipc-handlers';
import { DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT } from '../shared/constants';
import { FilesystemSessionDetector } from './session-detector';
import { SessionStore } from './session-store';

// Forge webpack magic globals for entry point URLs
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Create detector and store at module level so they're accessible for cleanup
const detector = new FilesystemSessionDetector();
const store = new SessionStore(detector);

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    // Standard Windows titlebar -- no frame:false, no titleBarStyle, no alwaysOnTop, no transparent
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open DevTools in development for debugging
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Start session polling after the renderer has finished loading
  // so it's ready to receive IPC messages
  mainWindow.webContents.on('did-finish-load', () => {
    store.start(mainWindow);
    console.log('[main] Session store started');
  });
};

// Register IPC handlers with the store so get-initial-sessions can serve live data
registerIpcHandlers(store);

// Create window when Electron is ready
app.on('ready', createWindow);

// Quit when all windows are closed (Windows behavior)
app.on('window-all-closed', () => {
  app.quit();
});

// Clean up polling on quit
app.on('before-quit', () => {
  store.stop();
  console.log('[main] Cleanup complete');
});
