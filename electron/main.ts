import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  const userDataPath = path.join(app.getPath('appData'), 'sv-post-app');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  app.setPath('userData', userDataPath);

  log.transports.file.level = 'info';
  autoUpdater.logger = log;

  function createWindow(): void {
    mainWindow = new BrowserWindow({
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
      mainWindow.loadURL('http://localhost:3000');
      mainWindow.webContents.openDevTools();
    } else {
      const indexPath = path.join(__dirname, '../dist/index.html');
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      } else {
        mainWindow.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(`
            <h1>❌ Ошибка запуска</h1>
            <p>Файл dist/index.html не найден.</p>
          `)}`
        );
      }
    }

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
      if (!isDev) {
        setTimeout(() => {
          autoUpdater.checkForUpdatesAndNotify().catch((err) => {
            log.error('Ошибка автопроверки обновлений:', err);
          });
        }, 2000);
      }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https:') || url.startsWith('http:')) {
        shell.openExternal(url);
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

  function sendToRenderer(channel: string, data?: any): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  }

  function setupAutoUpdater(): void {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('checking-for-update', () => sendToRenderer('update-checking'));
    autoUpdater.on('update-available', (info) => sendToRenderer('update-available', info));
    autoUpdater.on('update-not-available', (info) => sendToRenderer('update-not-available', info));
    autoUpdater.on('error', (err) => sendToRenderer('update-error', err.message || 'Неизвестная ошибка'));
    autoUpdater.on('download-progress', (progress) => sendToRenderer('update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred,
    }));
    autoUpdater.on('update-downloaded', (info) => sendToRenderer('update-downloaded', info));
  }

  app.whenReady().then(() => {
    setupAutoUpdater();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  // ============ IPC ============
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-platform', () => process.platform);
  ipcMain.handle('get-app-path', () => app.getAppPath());

  ipcMain.handle('dialog:open-file', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Postman Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };
      const filePath = result.filePaths[0];
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return { success: true, content, fileName: path.basename(filePath) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ✅ Новый IPC: выбор файлов для form-data
  ipcMain.handle('dialog:open-files', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
      });
      if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };
      return { success: true, filePaths: result.filePaths };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ✅ Новый IPC: чтение бинарных файлов
  ipcMain.handle('read-files', async (_event, filePaths: string[]) => {
    try {
      const results = await Promise.all(
        filePaths.map(async (filePath) => {
          const buffer = await fs.promises.readFile(filePath);
          return {
            path: filePath,
            name: path.basename(filePath),
            buffer: buffer,
          };
        })
      );
      return { success: true, files: results };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('check-for-updates', async () => {
    if (isDev) return { error: 'Проверка обновлений недоступна в режиме разработки' };
    try {
      return await autoUpdater.checkForUpdates();
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true));

  process.on('uncaughtException', (error) => log.error('❌ Uncaught Exception:', error));
  process.on('unhandledRejection', (error) => log.error('❌ Unhandled Rejection:', error));
}