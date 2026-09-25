import { useState, useEffect, useRef } from 'react';
import { X, FolderPlus } from 'lucide-react';

interface NewCollectionModalProps {
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export const NewCollectionModal: React.FC<NewCollectionModalProps> = ({
  onConfirm,
  onClose,
}) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[400] p-4 animate-scale-in"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.08)]">
          <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
            <FolderPlus size={16} className="text-amber-400" />
            Новая коллекция
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded transition-all"
            aria-label="Close"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            Название коллекции
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Например: WMS API"
            className="w-full px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-gray-600"
          />
          <p className="text-[10px] text-gray-500">
            Нажмите <kbd className="px-1 py-0.5 bg-[#2d2d2d] rounded text-gray-400">Enter</kbd> чтобы создать, <kbd className="px-1 py-0.5 bg-[#2d2d2d] rounded text-gray-400">Esc</kbd> — отменить
          </p>
        </div>

        <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.08)] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-xs font-medium transition-all"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-all"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
};