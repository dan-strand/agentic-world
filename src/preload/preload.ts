import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, SessionInfo } from '../shared/types';

contextBridge.exposeInMainWorld('agentWorld', {
  onSessionsUpdate: (callback: (sessions: SessionInfo[]) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.SESSIONS_UPDATE, (_event, sessions: SessionInfo[]) => {
      callback(sessions);
    });
  },
  getInitialSessions: (): Promise<SessionInfo[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_INITIAL_SESSIONS);
  },
  minimizeWindow: (): void => {
    ipcRenderer.send('window-minimize');
  },
  closeWindow: (): void => {
    ipcRenderer.send('window-close');
  },
  startDrag: (): void => {
    ipcRenderer.send('window-drag-start');
  },
  endDrag: (): void => {
    ipcRenderer.send('window-drag-end');
  },
});
