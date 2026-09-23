export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
}

export interface UpdateDownloadProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export interface ElectronAPI {
  // === Общие методы ===
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  getAppPath: () => Promise<string>;
  isElectron: boolean;
  copyToClipboard: (text: string) => void;
  openExternal: (url: string) => void;
  
  // === Импорт файлов (Postman) ===
  openFile: () => Promise<{
    success: boolean;
    content?: string;
    fileName?: string;
    canceled?: boolean;
    error?: string;
  }>;
  
  // === Методы управления обновлениями ===
  checkForUpdates: () => Promise<any>;
  downloadUpdate: () => Promise<any>;
  installUpdate: () => Promise<void>;
  
  // === Слушатели событий обновлений ===
  // Каждый метод возвращает функцию для отписки (важно для React!)
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void;
  onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => () => void;
  onUpdateError: (callback: (error: string) => void) => () => void;
  onUpdateDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => () => void;
  
  // === Удаление всех слушателей ===
  removeAllUpdateListeners: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};