"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const electron_updater_1 = require("electron-updater");
const electron_log_1 = __importDefault(require("electron-log"));
const isDev = !electron_1.app.isPackaged;
let mainWindow = null;
let isQuitting = false;
// ============================================================
// КРИТИЧНО ВАЖНО: Блокировка второго экземпляра приложения
// Предотвращает конфликт доступа к IndexedDB
// ============================================================
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
    // ============================================================
    // Уникальный путь для данных приложения (изоляция IndexedDB)
    // ============================================================
    const userDataPath = path.join(electron_1.app.getPath('appData'), 'sv-post-app');
    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
    }
    electron_1.app.setPath('userData', userDataPath);
    electron_log_1.default.transports.file.level = 'info';
    electron_updater_1.autoUpdater.logger = electron_log_1.default;
    function createWindow() {
        mainWindow = new electron_1.BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 900,
            minHeight: 600,
            title: 'SV-Post',
            backgroundColor: '#1e1e1e',
            show: false,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false,
            },
            titleBarStyle: 'default',
        });
        if (isDev) {
            console.log('Запуск в режиме разработки...');
            mainWindow.loadURL('http://localhost:3000');
            mainWindow.webContents.openDevTools();
        }
        else {
            console.log('Запуск в production режиме...');
            const indexPath = path.join(__dirname, '../dist/index.html');
            if (fs.existsSync(indexPath)) {
                mainWindow.loadFile(indexPath);
            }
            else {
                console.error('❌ Файл dist/index.html не найден!');
                mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
            <h1>❌ Ошибка запуска</h1>
            <p>Файл dist/index.html не найден.</p>
          `)}`);
            }
        }
        mainWindow.once('ready-to-show', () => {
            mainWindow?.show();
            if (!isDev) {
                setTimeout(() => {
                    electron_updater_1.autoUpdater.checkForUpdatesAndNotify().catch((err) => {
                        electron_log_1.default.error('Ошибка автопроверки обновлений:', err);
                    });
                }, 2000);
            }
        });
        // ============================================================
        // ИСПРАВЛЕНО: закрытие окна работает корректно
        // Если нужен трей — раскомментируйте блок ниже и убедитесь,
        // что before-quit устанавливает isQuitting = true.
        // ============================================================
        mainWindow.on('close', () => {
            // Логика трея (по умолчанию отключена):
            // if (!isQuitting) {
            //   event.preventDefault();
            //   mainWindow?.hide();
            // }
        });
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith('https:') || url.startsWith('http:')) {
                electron_1.shell.openExternal(url);
                return { action: 'deny' };
            }
            return { action: 'allow' };
        });
        mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
            console.error('Ошибка загрузки:', errorCode, errorDescription);
        });
        mainWindow.on('closed', () => {
            mainWindow = null;
        });
    }
    function sendToRenderer(channel, data) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, data);
        }
    }
    function setupAutoUpdater() {
        electron_updater_1.autoUpdater.autoDownload = false;
        electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
        electron_updater_1.autoUpdater.on('checking-for-update', () => {
            electron_log_1.default.info('[Updater] Проверка обновлений...');
            sendToRenderer('update-checking');
        });
        electron_updater_1.autoUpdater.on('update-available', (info) => {
            electron_log_1.default.info('[Updater] Доступно обновление:', info.version);
            sendToRenderer('update-available', info);
        });
        electron_updater_1.autoUpdater.on('update-not-available', (info) => {
            electron_log_1.default.info('[Updater] Обновлений нет. Текущая версия:', info.version);
            sendToRenderer('update-not-available', info);
        });
        electron_updater_1.autoUpdater.on('error', (err) => {
            electron_log_1.default.error('[Updater] Ошибка:', err);
            sendToRenderer('update-error', err.message || 'Неизвестная ошибка');
        });
        electron_updater_1.autoUpdater.on('download-progress', (progress) => {
            const msg = `Скорость: ${(progress.bytesPerSecond / 1024).toFixed(1)} KB/s | Загружено: ${progress.percent.toFixed(1)}%`;
            electron_log_1.default.info('[Updater]', msg);
            sendToRenderer('update-download-progress', {
                percent: progress.percent,
                bytesPerSecond: progress.bytesPerSecond,
                total: progress.total,
                transferred: progress.transferred,
            });
        });
        electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
            electron_log_1.default.info('[Updater] Обновление загружено:', info.version);
            sendToRenderer('update-downloaded', info);
        });
    }
    electron_1.app.whenReady().then(() => {
        console.log('SV-Post Electron app initialized');
        console.log('UserData path:', electron_1.app.getPath('userData'));
        setupAutoUpdater();
        createWindow();
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
    electron_1.app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            electron_1.app.quit();
        }
    });
    electron_1.app.on('before-quit', () => {
        isQuitting = true;
    });
    // ============ IPC обработчики — общие ============
    electron_1.ipcMain.handle('get-app-version', () => electron_1.app.getVersion());
    electron_1.ipcMain.handle('get-platform', () => process.platform);
    electron_1.ipcMain.handle('get-app-path', () => electron_1.app.getAppPath());
    // ============ IPC обработчик — диалог выбора файла для импорта ============
    electron_1.ipcMain.handle('dialog:open-file', async () => {
        try {
            const result = await electron_1.dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                    { name: 'Postman Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });
            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true };
            }
            const filePath = result.filePaths[0];
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            return { success: true, content, fileName };
        }
        catch (error) {
            electron_log_1.default.error('Error opening file:', error);
            return { success: false, error: error.message || 'Не удалось прочитать файл' };
        }
    });
    // ============ IPC обработчики — обновления ============
    electron_1.ipcMain.handle('check-for-updates', async () => {
        if (isDev) {
            return { error: 'Проверка обновлений недоступна в режиме разработки' };
        }
        try {
            const result = await electron_updater_1.autoUpdater.checkForUpdates();
            return result;
        }
        catch (error) {
            electron_log_1.default.error('Ошибка проверки обновлений:', error);
            return { error: error.message || 'Неизвестная ошибка' };
        }
    });
    electron_1.ipcMain.handle('download-update', async () => {
        try {
            await electron_updater_1.autoUpdater.downloadUpdate();
            return { success: true };
        }
        catch (error) {
            electron_log_1.default.error('Ошибка загрузки обновления:', error);
            return { error: error.message || 'Неизвестная ошибка' };
        }
    });
    electron_1.ipcMain.handle('install-update', () => {
        electron_updater_1.autoUpdater.quitAndInstall(false, true);
    });
    // ============ Глобальные обработчики ошибок ============
    process.on('uncaughtException', (error) => {
        electron_log_1.default.error('❌ Uncaught Exception:', error);
    });
    process.on('unhandledRejection', (error) => {
        electron_log_1.default.error('❌ Unhandled Rejection:', error);
    });
}
