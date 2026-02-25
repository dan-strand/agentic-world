import { ipcMain } from 'electron';
import { IPC_CHANNELS, SessionInfo } from '../shared/types';
import { SessionStore } from './session-store';

export function registerIpcHandlers(store: SessionStore): void {
  // Returns current session list from the live SessionStore
  ipcMain.handle(IPC_CHANNELS.GET_INITIAL_SESSIONS, async (): Promise<SessionInfo[]> => {
    return store.getSessions();
  });
}
