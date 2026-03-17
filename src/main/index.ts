import { app, BrowserWindow, ipcMain, Menu, screen } from 'electron';
import { registerIpcHandlers } from './ipc-handlers';
import { FilesystemSessionDetector } from './session-detector';
import { SessionStore } from './session-store';
import { UsageAggregator } from './usage-aggregator';
import { HistoryStore } from './history-store';
import { CrashLogger } from './crash-logger';
import { IPC_CHANNELS } from '../shared/types';

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
const usageAggregator = new UsageAggregator();
const historyStore = new HistoryStore(app.getPath('userData'));
const store = new SessionStore(detector, usageAggregator, historyStore);

// Initialize crash logging infrastructure
const crashLogger = new CrashLogger(app.getPath('userData'));
crashLogger.checkPreviousCrash();

// Catch uncaught exceptions in the main process -- log and exit
process.on('uncaughtException', (error) => {
  crashLogger.logCrash('main-uncaughtException', error.message, error.stack);
  // Allow time for electron-log to flush, then exit
  setTimeout(() => app.exit(1), 1000);
});

// Catch unhandled promise rejections in the main process
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  crashLogger.logError('main-unhandledRejection', msg + (stack ? '\n' + stack : ''));
});

// IPC listeners for renderer crash logging
ipcMain.on(IPC_CHANNELS.CRASH_LOG_ERROR, (_event, source: string, message: string, stack?: string) => {
  crashLogger.logError(source, stack ? message + '\n' + stack : message);
});
ipcMain.on(IPC_CHANNELS.CRASH_LOG_CRITICAL, (_event, source: string, message: string) => {
  crashLogger.logCrash(source, message);
});
ipcMain.on(IPC_CHANNELS.CRASH_MEMORY_STATS, (_event, stats: { heapUsedMB: number; rssMB: number }) => {
  crashLogger.logMemoryStats(stats);
});
ipcMain.on(IPC_CHANNELS.CRASH_MEMORY_WARNING, (_event, message: string) => {
  crashLogger.logMemoryWarning(message);
});

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 1080,
    minWidth: 1024,
    minHeight: 1080,
    maxWidth: 1024,
    maxHeight: 1080,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Forward native minimize/restore events to renderer via IPC
  // so the renderer can distinguish "minimized" from "unfocused"
  mainWindow.on('minimize', () => {
    mainWindow.webContents.send(IPC_CHANNELS.WINDOW_MINIMIZED);
  });
  mainWindow.on('restore', () => {
    mainWindow.webContents.send(IPC_CHANNELS.WINDOW_RESTORED);
  });

  // Log renderer console output to main process stdout
  mainWindow.webContents.on('console-message', (event) => {
    console.log(`[renderer] ${event.message}`);
  });

  // Log renderer process crashes to crash.log
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    crashLogger.logCrash('render-process-gone', details.reason, `exitCode=${details.exitCode}`);
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
registerIpcHandlers(store, historyStore);

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
  historyStore.flush();
  store.stop();
  console.log('[main] Cleanup complete');
});
