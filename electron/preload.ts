import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script loaded');

const electronAPI = {
  // === Общие методы ===
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('get-platform'),
  getAppPath: (): Promise<string> => ipcRenderer.invoke('get-app-path'),
  isElectron: true,

  copyToClipboard: (text: string): void => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  },

  openExternal: (url: string): void => {
    console.log('Opening external URL:', url);
  },

  // === Импорт файлов (Postman) ===
  openFile: (): Promise<{
    success: boolean;
    content?: string;
    fileName?: string;
    canceled?: boolean;
    error?: string;
  }> => ipcRenderer.invoke('dialog:open-file'),

  // === Методы управления обновлениями ===
  checkForUpdates: (): Promise<any> => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (): Promise<any> => ipcRenderer.invoke('download-update'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('install-update'),

  // === Слушатели событий обновлений ===
  onUpdateChecking: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('update-checking', listener);
    return () => ipcRenderer.removeListener('update-checking', listener);
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    const listener = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },
  onUpdateNotAvailable: (callback: (info: any) => void) => {
    const listener = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-not-available', listener);
    return () => ipcRenderer.removeListener('update-not-available', listener);
  },
  onUpdateError: (callback: (error: string) => void) => {
    const listener = (_event: any, error: string) => callback(error);
    ipcRenderer.on('update-error', listener);
    return () => ipcRenderer.removeListener('update-error', listener);
  },
  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    const listener = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const listener = (_event: any, info: any) => callback(info);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },

  // === Удаление всех слушателей обновлений ===
  removeAllUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-checking');
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('update-error');
    ipcRenderer.removeAllListeners('update-download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded in preload');
  });
}

export type ElectronAPI = typeof electronAPI;