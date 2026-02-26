import { app, BrowserWindow, Menu } from 'electron';
import { registerIpcHandlers } from './ipc-handlers';
import { FilesystemSessionDetector } from './session-detector';
import { SessionStore } from './session-store';

// Forge webpack magic globals for entry point URLs
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Remove default menu bar (no File/Edit/View/Help menus)
Menu.setApplicationMenu(null);

// Create detector and store at module level so they're accessible for cleanup
const detector = new FilesystemSessionDetector();
const store = new SessionStore(detector);

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    maxWidth: 1024,
    maxHeight: 768,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a2e',
      symbolColor: '#c9a96e',
      height: 28,
    },
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Log renderer console output to main process stdout
  mainWindow.webContents.on('console-message', (event) => {
    console.log(`[renderer] ${event.message}`);
  });

  // Open DevTools in development for debugging
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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
