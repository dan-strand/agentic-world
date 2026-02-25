import { app, BrowserWindow } from 'electron';
import { registerIpcHandlers } from './ipc-handlers';
import { DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT } from '../shared/constants';

// Forge webpack magic globals for entry point URLs
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

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
};

// Register IPC handlers before any windows are created
registerIpcHandlers();

// Create window when Electron is ready
app.on('ready', createWindow);

// Quit when all windows are closed (Windows behavior)
app.on('window-all-closed', () => {
  app.quit();
});

// Cleanup placeholder -- Plan 02 will add actual cleanup (stop watchers, clear intervals)
app.on('before-quit', () => {
  console.log('Cleaning up...');
});
