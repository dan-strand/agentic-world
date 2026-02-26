import { app, BrowserWindow, ipcMain, Menu, screen } from 'electron';
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
    frame: false,
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

// Window control IPC handlers
ipcMain.on('window-minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.on('window-close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

// Custom window drag — poll cursor from main process since renderer
// mousemove stops firing when cursor leaves window bounds
let dragState: { win: BrowserWindow; offsetX: number; offsetY: number; interval: ReturnType<typeof setInterval> } | null = null;
ipcMain.on('window-drag-start', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const cursor = screen.getCursorScreenPoint();
  const [winX, winY] = win.getPosition();
  const interval = setInterval(() => {
    const pos = screen.getCursorScreenPoint();
    win.setPosition(pos.x - (cursor.x - winX), pos.y - (cursor.y - winY));
  }, 16);
  dragState = { win, offsetX: cursor.x - winX, offsetY: cursor.y - winY, interval };
});
ipcMain.on('window-drag-end', () => {
  if (dragState) {
    clearInterval(dragState.interval);
    dragState = null;
  }
});

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
