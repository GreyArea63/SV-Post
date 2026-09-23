import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// Настройка логирования обновлений
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
    console.log('Запуск в режиме разработки...');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('Запуск в production режиме...');
    const indexPath = path.join(__dirname, '../dist/index.html');

    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error('❌ Файл dist/index.html не найден!');
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

    // Автоматическая проверка обновлений при запуске (только в production)
    if (!isDev) {
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch((err) => {
          log.error('Ошибка автопроверки обновлений:', err);
        });
      }, 2000);
    }
  });

  // Обработчик закрытия окна
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
    return false;
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

// Отправка событий в renderer процесс
function sendToRenderer(channel: string, data?: any): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// Настройка обработчиков событий автообновлений
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Проверка обновлений...');
    sendToRenderer('update-checking');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] Доступно обновление:', info.version);
    sendToRenderer('update-available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('[Updater] Обновлений нет. Текущая версия:', info.version);
    sendToRenderer('update-not-available', info);
  });

  autoUpdater.on('error', (err) => {
    log.error('[Updater] Ошибка:', err);
    sendToRenderer('update-error', err.message || 'Неизвестная ошибка');
  });

  autoUpdater.on('download-progress', (progress) => {
    const msg = `Скорость: ${(progress.bytesPerSecond / 1024).toFixed(1)} KB/s | Загружено: ${progress.percent.toFixed(1)}%`;
    log.info('[Updater]', msg);
    sendToRenderer('update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] Обновление загружено:', info.version);
    sendToRenderer('update-downloaded', info);
  });
}

app.whenReady().then(() => {
  console.log('SV-Post Electron app initialized');

  // Настраиваем автообновления ПЕРЕД созданием окна
  setupAutoUpdater();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// ============ IPC обработчики — общие ============
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-app-path', () => app.getAppPath());

// ============ IPC обработчик — диалог выбора файла для импорта ============
ipcMain.handle('dialog:open-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
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
  } catch (error: any) {
    log.error('Error opening file:', error);
    return { success: false, error: error.message || 'Не удалось прочитать файл' };
  }
});

// ============ IPC обработчики — обновления ============
ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return { error: 'Проверка обновлений недоступна в режиме разработки' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return result;
  } catch (error: any) {
    log.error('Ошибка проверки обновлений:', error);
    return { error: error.message || 'Неизвестная ошибка' };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error: any) {
    log.error('Ошибка загрузки обновления:', error);
    return { error: error.message || 'Неизвестная ошибка' };
  }
});

ipcMain.handle('install-update', () => {
  // quitAndInstall(isSilent: boolean, isForceRunAfter: boolean)
  autoUpdater.quitAndInstall(false, true);
});

// ============ Глобальные обработчики ошибок ============
process.on('uncaughtException', (error) => {
  log.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  log.error('❌ Unhandled Rejection:', error);
});