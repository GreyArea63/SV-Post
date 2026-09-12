import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Download, AlertCircle } from 'lucide-react';

interface Attribute {
  id: string;
  name: string;
  values: string;
  isConstant: boolean;
}

interface JsonBuilderProps {
  onClose: () => void;
}

export const JsonBuilder: React.FC<JsonBuilderProps> = ({ onClose }) => {
  const [fileName, setFileName] = useState('runner-data');
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  const totalRows = useMemo(() => {
    if (attributes.length === 0) return 0;
    const maxRows = Math.max(...attributes.map(attr => {
      if (attr.isConstant) return 1;
      return attr.values.split('\n').filter(v => v.trim()).length;
    }));
    return maxRows;
  }, [attributes]);

  const addAttribute = () => {
    const newAttribute: Attribute = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      values: '',
      isConstant: false,
    };
    setAttributes([...attributes, newAttribute]);
  };

  const removeAttribute = (id: string) => {
    setAttributes(attributes.filter(attr => attr.id !== id));
  };

  const updateAttribute = (id: string, updates: Partial<Attribute>) => {
    setAttributes(attributes.map(attr =>
      attr.id === id ? { ...attr, ...updates } : attr
    ));
  };

  const generateJson = () => {
    if (attributes.length === 0) return;

    const result: Record<string, any>[] = [];
    const maxRows = totalRows;

    for (let i = 0; i < maxRows; i++) {
      const row: Record<string, any> = {};
      attributes.forEach(attr => {
        if (attr.name.trim()) {
          if (attr.isConstant) {
            row[attr.name.trim()] = attr.values.split('\n')[0]?.trim() || '';
          } else {
            const values = attr.values.split('\n').filter(v => v.trim());
            row[attr.name.trim()] = values[i] || '';
          }
        }
      });
      result.push(row);
    }

    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-200">Конструктор JSON для Runner</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-all" aria-label="Закрыть">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Имя файла:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="runner-data"
                className="flex-1 px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20"
              />
              <span className="text-sm text-gray-500">.json</span>
            </div>
          </div>

          {/* Attributes Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-gray-300">Атрибуты</h3>
                <p className="text-xs text-gray-500 mt-0.5">Будет сформировано {totalRows} строк</p>
              </div>
              <button
                onClick={addAttribute}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
              >
                <Plus size={16} />
                Добавить строку
              </button>
            </div>

            <div className="space-y-3">
              {attributes.map((attr, index) => (
                <div key={attr.id} className="p-4 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-[#1e1e1e] rounded text-xs text-gray-500 font-mono">
                      #{index + 1}
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      {/* Attribute Name */}
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={attr.name}
                          onChange={(e) => updateAttribute(attr.id, { name: e.target.value })}
                          placeholder="Имя атрибута (например: type, id)"
                          className="flex-1 px-3 py-2 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
                        />
                        <label className="flex items-center gap-2 px-3 py-2 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={attr.isConstant}
                            onChange={(e) => updateAttribute(attr.id, { isConstant: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500/20"
                          />
                          <span className="text-sm text-gray-300">Константа</span>
                        </label>
                        <button
                          onClick={() => removeAttribute(attr.id)}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          aria-label="Удалить атрибут"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Values Textarea */}
                      <textarea
                        value={attr.values}
                        onChange={(e) => updateAttribute(attr.id, { values: e.target.value })}
                        placeholder={attr.isConstant ? "Одно значение для всех строк" : "Список значений (каждое с новой строки):\nvalue1\nvalue2\nvalue3"}
                        rows={4}
                        className="w-full px-3 py-2 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-500 font-mono resize-none"
                      />

                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Строк: {attr.isConstant ? 1 : attr.values.split('\n').filter(v => v.trim()).length}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {attributes.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Нет атрибутов</p>
                  <p className="text-xs mt-1">Нажмите "Добавить строку" для начала</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all"
          >
            Отмена
          </button>
          <button
            onClick={generateJson}
            disabled={attributes.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-all shadow-lg shadow-blue-500/30"
          >
            <Download size={16} />
            Сгенерировать JSON
          </button>
        </div>
      </div>
    </div>
  );
};