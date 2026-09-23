import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, X, RefreshCw, Info } from 'lucide-react';

// ============================================================
// ЛОКАЛЬНЫЕ ТИПЫ (чтобы не зависеть от electron.d.ts)
// ============================================================
type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
}

interface UpdateDownloadProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

interface ElectronAPI {
  onUpdateChecking: (callback: () => void) => () => void;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void;
  onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => () => void;
  onUpdateError: (callback: (error: string) => void) => () => void;
  onUpdateDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => () => void;
  downloadUpdate: () => Promise<any>;
  installUpdate: () => Promise<void>;
  checkForUpdates: () => Promise<any>;
}

// Безопасное получение electronAPI
const getElectronAPI = (): ElectronAPI | null => {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return (window as any).electronAPI as ElectronAPI;
  }
  return null;
};

// ============================================================
// КОМПОНЕНТ
// ============================================================
export const UpdateNotification: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [version, setVersion] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [speed, setSpeed] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;

    const unsubscribes: Array<() => void> = [];

    // Проверка обновлений
    unsubscribes.push(
      api.onUpdateChecking(() => {
        setStatus('checking');
        setIsVisible(true);
        setShowConfirmDialog(false);
        setError('');
      })
    );

    // Найдено обновление — НЕ запускаем загрузку автоматически,
    // а показываем диалог подтверждения
    unsubscribes.push(
      api.onUpdateAvailable((info: UpdateInfo) => {
        setStatus('available');
        setVersion(info.version);
        setError('');
        setIsVisible(true);
        setShowConfirmDialog(true);
      })
    );

    // Обновлений нет
    unsubscribes.push(
      api.onUpdateNotAvailable((_info: UpdateInfo) => {
        setStatus('idle');
        setIsVisible(false);
        setShowConfirmDialog(false);
      })
    );

    // Ошибка
    unsubscribes.push(
      api.onUpdateError((errMsg: string) => {
        setStatus('error');
        setError(errMsg);
        setIsVisible(true);
        setShowConfirmDialog(false);
      })
    );

    // Прогресс загрузки
    unsubscribes.push(
      api.onUpdateDownloadProgress((prog: UpdateDownloadProgress) => {
        setStatus('downloading');
        setProgress(prog.percent);
        const kbPerSec = (prog.bytesPerSecond / 1024).toFixed(1);
        setSpeed(`${kbPerSec} KB/s`);
      })
    );

    // Загрузка завершена
    unsubscribes.push(
      api.onUpdateDownloaded((info: UpdateInfo) => {
        setStatus('downloaded');
        setVersion(info.version);
        setProgress(100);
        setShowConfirmDialog(false);
      })
    );

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, []);

  const handleInstall = () => {
    const api = getElectronAPI();
    if (api) {
      api.installUpdate();
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setShowConfirmDialog(false);
  };

  const handleRetry = () => {
    setError('');
    setStatus('idle');
    setIsVisible(false);
    setShowConfirmDialog(false);
    const api = getElectronAPI();
    if (api) {
      api.checkForUpdates();
    }
  };

  // Обработчик кнопки "Да" — запускает загрузку
  const handleDownload = () => {
    setShowConfirmDialog(false);
    const api = getElectronAPI();
    if (api) {
      api.downloadUpdate().catch((err: any) => {
        console.error('Ошибка запуска загрузки:', err);
        setStatus('error');
        setError('Не удалось начать загрузку');
        setShowConfirmDialog(false);
      });
    }
  };

  // Обработчик кнопки "Нет"
  const handleDecline = () => {
    setShowConfirmDialog(false);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
        {/* Заголовок */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Обновление приложения
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors p-0.5 rounded hover:bg-gray-700"
            title="Закрыть"
          >
            <X size={14} />
          </button>
        </div>

        {/* Контент */}
        <div className="p-4">
          {/* Проверка обновлений */}
          {status === 'checking' && (
            <div className="flex items-center text-blue-400">
              <RefreshCw size={22} className="mr-3 animate-spin" />
              <div>
                <div className="font-medium">Проверка обновлений...</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Ищем новую версию
                </div>
              </div>
            </div>
          )}

          {/* Найдено обновление — ДИАЛОГ ПОДТВЕРЖДЕНИЯ */}
          {status === 'available' && showConfirmDialog && (
            <div>
              <div className="flex items-center text-blue-400 mb-3">
                <Download size={22} className="mr-3" />
                <div>
                  <div className="font-medium">Доступна версия {version}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Установить обновление?
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
                >
                  Да
                </button>
                <button
                  onClick={handleDecline}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
                >
                  Нет
                </button>
              </div>
            </div>
          )}

          {/* Загрузка */}
          {status === 'downloading' && (
            <div>
              <div className="flex items-center text-blue-400 mb-3">
                <Download size={22} className="mr-3" />
                <div>
                  <div className="font-medium">Загрузка v{version}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {speed} · {progress.toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Готово к установке */}
          {status === 'downloaded' && (
            <div>
              <div className="flex items-center text-green-400 mb-3">
                <CheckCircle size={22} className="mr-3" />
                <div>
                  <div className="font-medium">Обновление v{version} готово</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Перезапустите приложение для установки
                  </div>
                </div>
              </div>
              <button
                onClick={handleInstall}
                className="w-full bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-medium px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <RefreshCw size={16} />
                Перезапустить и установить
              </button>
            </div>
          )}

          {/* Ошибка */}
          {status === 'error' && (
            <div>
              <div className="flex items-start text-red-400 mb-3">
                <AlertCircle size={22} className="mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">Ошибка обновления</div>
                  <div className="text-xs text-gray-400 mt-1 break-words">
                    {error}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
                >
                  Повторить
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};