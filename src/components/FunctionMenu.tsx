import React, { useState, useRef, useEffect } from 'react';
import { Menu, Download, Upload, X, Settings } from 'lucide-react';
import { Collection } from '../types';
import { isPostmanCollection, convertPostmanCollection } from '../utils/postmanConverter';

interface FunctionMenuProps {
  onImport: (collections: Collection[]) => void;
  onExportAll: () => void;
  collections: Collection[];
  onOpenEnvManager: () => void;
}

export const FunctionMenu: React.FC<FunctionMenuProps> = ({
  onImport,
  onExportAll,
  collections,
  onOpenEnvManager,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (type: 'success' | 'error', message: string) => {
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
        const converted = convertPostmanCollection(data);
        importedCollections = [converted];
      } else if (data.collections && Array.isArray(data.collections)) {
        importedCollections = data.collections;
      } else if (Array.isArray(data)) {
        importedCollections = data;
      } else if (data.id && data.name && Array.isArray(data.requests)) {
        importedCollections = [data];
      } else if (data.info && Array.isArray(data.item)) {
        const converted = convertPostmanCollection(data);
        importedCollections = [converted];
      } else {
        throw new Error('Неверный формат файла');
      }

      const validCollections = importedCollections.filter(
        (c: any) => c.id && c.name && Array.isArray(c.requests)
      );

      if (validCollections.length === 0) {
        throw new Error('Не найдено валидных коллекций');
      }

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
      showNotification('error', 'Нет коллекций');
      return;
    }
    try {
      onExportAll();
      showNotification('success', `Экспортировано: ${collections.length} колл.`);
    } catch (err: any) {
      showNotification('error', `Ошибка: ${err.message}`);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#3d3d3d] rounded text-sm transition-colors"
      >
        <Menu size={16} />
        <span>Функции</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-[#2d2d2d] border border-[#3d3d3d] rounded shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-[#3d3d3d] text-xs text-gray-400 uppercase">
            Коллекции
          </div>

          <button
            onClick={handleImportClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#3d3d3d] transition-colors text-left"
          >
            <Upload size={16} className="text-primary-500" />
            <div>
              <div className="text-sm">Импортировать коллекцию</div>
              <div className="text-xs text-gray-500">Postman / SV-Post JSON</div>
            </div>
          </button>

          <button
            onClick={handleExportClick}
            disabled={collections.length === 0}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#3d3d3d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
          >
            <Download size={16} className="text-primary-500" />
            <div>
              <div className="text-sm">Экспортировать коллекции</div>
              <div className="text-xs text-gray-500">
                {collections.length > 0 ? `Коллекций: ${collections.length}` : 'Нет коллекций'}
              </div>
            </div>
          </button>

          <div className="px-3 py-2 border-b border-[#3d3d3d] text-xs text-gray-400 uppercase">
            Настройки
          </div>

          <button
            onClick={() => {
              setIsOpen(false);
              onOpenEnvManager();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#3d3d3d] transition-colors text-left"
          >
            <Settings size={16} className="text-primary-500" />
            <div>
              <div className="text-sm">Менеджер окружений</div>
              <div className="text-xs text-gray-500">Управление переменными</div>
            </div>
          </button>
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
        <div className={`fixed top-16 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg z-[100] flex items-center gap-2 animate-fade-in ${
          notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <span className="text-sm">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="hover:opacity-70">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};