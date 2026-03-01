import { ipcMain } from 'electron';
import { IPC_CHANNELS, SessionInfo, DailyAggregate } from '../shared/types';
import { SessionStore } from './session-store';
import { HistoryStore } from './history-store';

export function registerIpcHandlers(store: SessionStore, historyStore: HistoryStore): void {
  // Returns current session list from the live SessionStore
  ipcMain.handle(IPC_CHANNELS.GET_INITIAL_SESSIONS, async (): Promise<SessionInfo[]> => {
    return store.getSessions();
  });

  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async (): Promise<DailyAggregate[]> => {
    return historyStore.getHistory();
  });
}
