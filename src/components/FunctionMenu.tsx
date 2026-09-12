import { useState, useRef, useEffect, useMemo } from 'react';
import { Download, Upload, X, Settings, Trash2, Database, FileJson, Menu } from 'lucide-react';
import { Collection } from '../types';
import { isPostmanCollection, convertPostmanCollection } from '../utils/postmanConverter';
import { storage } from '../utils/storage';

interface FunctionMenuProps {
  onImport: (collections: Collection[]) => void;
  onExportAll: () => void;
  collections: Collection[];
  onOpenEnvManager: () => void;
  onOpenJsonBuilder: () => void;
}

interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

// Строгая типизация для устранения ошибок TS2339
interface MenuItem {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export const FunctionMenu: React.FC<FunctionMenuProps> = ({
  onImport,
  onExportAll,
  collections,
  onOpenEnvManager,
  onOpenJsonBuilder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрытие меню при клике вне его области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Авто-скрытие уведомлений
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const handleImportClick = () => {
    setIsOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      let importedCollections: Collection[] = [];

      if (isPostmanCollection(data)) {
        importedCollections = [convertPostmanCollection(data)];
      } else if (data.collections && Array.isArray(data.collections)) {
        importedCollections = data.collections;
      } else if (Array.isArray(data)) {
        importedCollections = data;
      } else if (data.id && data.name && Array.isArray(data.requests)) {
        importedCollections = [data];
      } else if (data.info && Array.isArray(data.item)) {
        importedCollections = [convertPostmanCollection(data)];
      } else {
        throw new Error('Неверный формат файла');
      }

      // БЕЗОПАСНАЯ фильтрация: проверка на null и корректную структуру объекта
      const validCollections = importedCollections.filter((c: any) => 
        c && typeof c === 'object' && c.id && c.name && Array.isArray(c.requests)
      );
      
      if (validCollections.length === 0) throw new Error('Не найдено валидных коллекций');

      onImport(validCollections);
      showNotification('success', `Импортировано: ${validCollections.length} колл.`);
    } catch (err: any) {
      showNotification('error', `Ошибка: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportClick = () => {
    setIsOpen(false);
    if (collections.length === 0) {
      showNotification('error', 'Нет коллекций для экспорта');
      return;
    }
    try {
      onExportAll();
      showNotification('success', `Экспортировано: ${collections.length} колл.`);
    } catch (err: any) {
      showNotification('error', `Ошибка: ${err.message}`);
    }
  };

  const handleShowStorageInfo = async () => {
    const stats = await storage.getStorageStats();
    showNotification('info', `IndexedDB: ${(stats.totalSize / 1024).toFixed(1)} KB`);
    setIsOpen(false);
  };

  // useMemo предотвращает пересоздание массива при каждом рендере
  const menuSections = useMemo<{ title: string; items: MenuItem[] }[]>(() => [
    {
      title: 'Коллекции',
      items: [
        { icon: <Upload size={14} />, label: 'Импорт', description: 'Postman / SV-Post', onClick: handleImportClick },
        { icon: <Download size={14} />, label: 'Экспорт', description: `${collections.length} колл.`, onClick: handleExportClick, disabled: collections.length === 0 },
      ]
    },
    {
      title: 'Runner',
      items: [
        { icon: <FileJson size={14} />, label: 'Собрать JSON', description: 'Данные для Runner', onClick: () => { setIsOpen(false); onOpenJsonBuilder(); } },
      ]
    },
    {
      title: 'Настройки',
      items: [
        { icon: <Settings size={14} />, label: 'Окружения', description: 'Переменные', onClick: () => { setIsOpen(false); onOpenEnvManager(); } },
        { icon: <Database size={14} />, label: 'Хранилище', description: 'Статистика', onClick: handleShowStorageInfo },
      ]
    },
    {
      title: 'Очистка',
      items: [
        { 
          icon: <Trash2 size={14} />, 
          label: 'История', 
          description: 'Удалить', 
          danger: true, 
          onClick: async () => {
            if (window.confirm('Очистить историю запросов?')) {
              await storage.clearHistory();
              showNotification('success', 'История очищена');
              window.location.reload();
            }
          } 
        },
        { 
          icon: <Trash2 size={14} />, 
          label: 'Все данные', 
          description: 'Полный сброс', 
          danger: true, 
          onClick: async () => {
            if (window.confirm('Удалить ВСЕ данные приложения? Это действие необратимо.')) {
              await storage.clearAllData();
              showNotification('success', 'Все данные очищены');
              window.location.reload();
            }
          } 
        },
      ]
    }
  ], [collections.length, handleImportClick, handleExportClick, handleShowStorageInfo, onOpenJsonBuilder, onOpenEnvManager]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-all ${
          isOpen 
            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
            : 'bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-300 border border-[rgba(255,255,255,0.08)]'
        }`}
        aria-label="Открыть меню функций"
      >
        <Menu size={12} />
        <span>Функции</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl z-50 overflow-hidden animate-scale-in">
          {menuSections.map((section, sIdx) => (
            <div key={sIdx} className={sIdx > 0 ? 'border-t border-[rgba(255,255,255,0.08)]' : ''}>
              <div className="px-3 py-1.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                {section.title}
              </div>
              {section.items.map((item, iIdx) => (
                <button
                  key={iIdx}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-2 px-3 py-2 transition-all text-left ${
                    item.disabled 
                      ? 'opacity-40 cursor-not-allowed' 
                      : item.danger 
                        ? 'hover:bg-red-500/10 text-red-400' 
                        : 'hover:bg-white/5 text-gray-300'
                  }`}
                >
                  <div className={`flex-shrink-0 ${item.danger ? 'text-red-400' : 'text-indigo-400'}`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{item.label}</div>
                    <div className={`text-[10px] ${item.danger ? 'text-red-400/60' : 'text-gray-500'}`}>
                      {item.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      {notification && (
        <div className={`fixed top-16 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-[100] flex items-center gap-2 animate-fade-in bg-[#1e1e1e] border ${
          notification.type === 'success' ? 'border-emerald-500/30 text-emerald-400' : 
          notification.type === 'error' ? 'border-red-500/30 text-red-400' : 
          'border-blue-500/30 text-blue-400'
        }`}>
          <span className="text-xs">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="hover:opacity-70" aria-label="Закрыть уведомление">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};