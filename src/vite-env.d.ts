/// <reference types="vite/client" />

// ============================================================
// ДЕКЛАРАЦИЯ ELECTRON API
// ============================================================
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

  // === Загрузка файлов (form-data) ===
  openFiles: () => Promise<{
    success: boolean;
    filePaths?: string[];
    canceled?: boolean;
    error?: string;
  }>;

  readFiles: (paths: string[]) => Promise<{
    success: boolean;
    files?: { path: string; name: string; buffer: Uint8Array }[];
    error?: string;
  }>;

  // === Обновления ===
  checkForUpdates: () => Promise<any>;
  downloadUpdate: () => Promise<any>;
  installUpdate: () => Promise<void>;
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (info: any) => void) => () => void;
  onUpdateNotAvailable: (callback: (info: any) => void) => () => void;
  onUpdateError: (callback: (error: string) => void) => () => void;
  onUpdateDownloadProgress: (callback: (progress: any) => void) => () => void;
  onUpdateDownloaded: (callback: (info: any) => void) => () => void;
  removeAllUpdateListeners: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// ============================================================
// ДЕКЛАРАЦИИ ДЛЯ РЕСУРСОВ
// ============================================================

// Разрешаем импортировать CSS файлы
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// Разрешаем импортировать CSS как строки
declare module '*.css?inline' {
  const content: string;
  export default content;
}

// Для импорта изображений
declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}