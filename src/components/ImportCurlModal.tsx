import { useState, useEffect, useRef } from 'react';
import { Terminal, X, AlertCircle, CheckCircle } from 'lucide-react';
import { parseCurl, looksLikeCurl } from '../utils/curlParser';
import { HttpRequest } from '../types';

interface ImportCurlModalProps {
  onImport: (request: HttpRequest) => void;
  onClose: () => void;
}

export const ImportCurlModal: React.FC<ImportCurlModalProps> = ({ onImport, onClose }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<HttpRequest | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleChange = (text: string) => {
    setValue(text);
    setError(null);
    setPreview(null);

    if (!text.trim()) return;

    if (!looksLikeCurl(text)) {
      setError('Команда должна начинаться с "curl"');
      return;
    }

    try {
      const parsed = parseCurl(text);
      setPreview(parsed);
    } catch (e: any) {
      setError(e.message || 'Ошибка парсинга');
    }
  };

  const handleImport = () => {
    if (!value.trim()) {
      setError('Вставьте curl-команду');
      return;
    }
    try {
      const parsed = parseCurl(value);
      onImport(parsed);
    } catch (e: any) {
      setError(e.message || 'Ошибка парсинга');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleChange(text);
    } catch {
      setError('Не удалось прочитать буфер обмена');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[400] p-4 animate-scale-in">
      <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(255,255,255,0.08)] shrink-0">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Terminal size={20} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-200">Импорт из cURL</h3>
            <p className="text-xs text-gray-500">
              Вставьте curl-команду — запрос откроется в новой вкладке
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-400 hover:text-gray-200 transition-all"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col min-h-0 p-5 gap-3">
          <div className="relative flex-1 min-h-[200px]">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={`curl -X POST 'https://api.example.com/users' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"name":"John"}'`}
              className="w-full h-full min-h-[200px] px-3 py-2 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 text-sm text-gray-300 font-mono resize-none leading-relaxed placeholder:text-gray-600"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePasteFromClipboard}
              className="px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#363636] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-gray-300 transition-all"
            >
              Вставить из буфера
            </button>
            <button
              onClick={() => { setValue(''); setError(null); setPreview(null); }}
              className="px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#363636] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-gray-300 transition-all"
            >
              Очистить
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          {preview && !error && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">
                  Распознан запрос
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="text-gray-500">Метод:</div>
                <div className="text-gray-300">{preview.method}</div>
                <div className="text-gray-500">URL:</div>
                <div className="text-gray-300 truncate" title={preview.url}>{preview.url || '—'}</div>
                <div className="text-gray-500">Headers:</div>
                <div className="text-gray-300">{preview.headers.length}</div>
                <div className="text-gray-500">Query:</div>
                <div className="text-gray-300">{preview.queryParams.length}</div>
                <div className="text-gray-500">Body:</div>
                <div className="text-gray-300">{preview.body.type}</div>
                <div className="text-gray-500">Auth:</div>
                <div className="text-gray-300">{preview.auth?.type || 'none'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[rgba(255,255,255,0.08)] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all"
          >
            Отмена
          </button>
          <button
            onClick={handleImport}
            disabled={!preview || !!error}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
          >
            Импортировать
          </button>
        </div>
      </div>
    </div>
  );
};