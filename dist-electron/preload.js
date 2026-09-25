"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
console.log('Preload script loaded');
const electronAPI = {
    // === Общие методы ===
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    getPlatform: () => electron_1.ipcRenderer.invoke('get-platform'),
    getAppPath: () => electron_1.ipcRenderer.invoke('get-app-path'),
    isElectron: true,
    copyToClipboard: (text) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
    },
    openExternal: (url) => {
        console.log('Opening external URL:', url);
    },
    // === Импорт файлов (Postman) ===
    openFile: () => electron_1.ipcRenderer.invoke('dialog:open-file'),
    // === Методы управления обновлениями ===
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => electron_1.ipcRenderer.invoke('download-update'),
    installUpdate: () => electron_1.ipcRenderer.invoke('install-update'),
    // === Слушатели событий обновлений ===
    onUpdateChecking: (callback) => {
        const listener = () => callback();
        electron_1.ipcRenderer.on('update-checking', listener);
        return () => electron_1.ipcRenderer.removeListener('update-checking', listener);
    },
    onUpdateAvailable: (callback) => {
        const listener = (_event, info) => callback(info);
        electron_1.ipcRenderer.on('update-available', listener);
        return () => electron_1.ipcRenderer.removeListener('update-available', listener);
    },
    onUpdateNotAvailable: (callback) => {
        const listener = (_event, info) => callback(info);
        electron_1.ipcRenderer.on('update-not-available', listener);
        return () => electron_1.ipcRenderer.removeListener('update-not-available', listener);
    },
    onUpdateError: (callback) => {
        const listener = (_event, error) => callback(error);
        electron_1.ipcRenderer.on('update-error', listener);
        return () => electron_1.ipcRenderer.removeListener('update-error', listener);
    },
    onUpdateDownloadProgress: (callback) => {
        const listener = (_event, progress) => callback(progress);
        electron_1.ipcRenderer.on('update-download-progress', listener);
        return () => electron_1.ipcRenderer.removeListener('update-download-progress', listener);
    },
    onUpdateDownloaded: (callback) => {
        const listener = (_event, info) => callback(info);
        electron_1.ipcRenderer.on('update-downloaded', listener);
        return () => electron_1.ipcRenderer.removeListener('update-downloaded', listener);
    },
    // === Удаление всех слушателей обновлений ===
    removeAllUpdateListeners: () => {
        electron_1.ipcRenderer.removeAllListeners('update-checking');
        electron_1.ipcRenderer.removeAllListeners('update-available');
        electron_1.ipcRenderer.removeAllListeners('update-not-available');
        electron_1.ipcRenderer.removeAllListeners('update-error');
        electron_1.ipcRenderer.removeAllListeners('update-download-progress');
        electron_1.ipcRenderer.removeAllListeners('update-downloaded');
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded in preload');
    });
}
