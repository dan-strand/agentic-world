import { ipcMain } from 'electron';
import { IPC_CHANNELS, SessionInfo } from '../shared/types';

export function registerIpcHandlers(): void {
  // Returns current session list -- Plan 02 will wire to SessionStore
  ipcMain.handle(IPC_CHANNELS.GET_INITIAL_SESSIONS, async (): Promise<SessionInfo[]> => {
    return []; // Stub -- Plan 02 connects to SessionStore
  });
}
