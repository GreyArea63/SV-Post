import React, { useState } from 'react';
import { X, Plus, Trash2, Download, FileJson, Play, CheckCircle, Hash, List } from 'lucide-react';

interface JsonBuilderProps {
  onClose: () => void;
}

interface Attribute {
  id: string;
  name: string;
  isConstant: boolean;
  constantValue: string;
  listValues: string;
}

export const JsonBuilder: React.FC<JsonBuilderProps> = ({ onClose }) => {
  const [fileName, setFileName] = useState('runner-data');
  const [attributes, setAttributes] = useState<Attribute[]>([
    { id: '1', name: '', isConstant: false, constantValue: '', listValues: '' },
  ]);
  const [generatedJson, setGeneratedJson] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);

  const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

  const addAttribute = () => {
    setAttributes([...attributes, { id: generateId(), name: '', isConstant: false, constantValue: '', listValues: '' }]);
  };

  const removeAttribute = (id: string) => {
    setAttributes(attributes.filter(attr => attr.id !== id));
  };

  const updateAttribute = (id: string, field: keyof Attribute, value: any) => {
    setAttributes(attributes.map(attr => attr.id === id ? { ...attr, [field]: value } : attr));
  };

  const handleGenerate = () => {
    const validAttributes = attributes.filter(attr => attr.name.trim() !== '');
    if (validAttributes.length === 0) {
      alert('Добавьте хотя бы один атрибут с именем');
      return;
    }

    let maxListLength = 1;
    attributes.forEach(attr => {
      if (!attr.isConstant) {
        const values = attr.listValues.split('\n').filter(v => v.trim() !== '');
        maxListLength = Math.max(maxListLength, values.length);
      }
    });

    const data = [];
    for (let i = 0; i < maxListLength; i++) {
      const obj: Record<string, string> = {};
      attributes.forEach(attr => {
        if (attr.name.trim() === '') return;
        if (attr.isConstant) {
          obj[attr.name] = attr.constantValue;
        } else {
          const values = attr.listValues.split('\n').filter(v => v.trim() !== '');
          obj[attr.name] = values[i] || '';
        }
      });
      data.push(obj);
    }

    setGeneratedJson(JSON.stringify(data, null, 2));
    setIsGenerated(true);
  };

  const handleSave = () => {
    if (!generatedJson) return;
    const blob = new Blob([generatedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setGeneratedJson(null);
    setIsGenerated(false);
  };

  const totalIterations = attributes.some(a => !a.isConstant) 
    ? Math.max(...attributes.filter(a => !a.isConstant).map(a => a.listValues.split('\n').filter(v => v.trim()).length))
    : 1;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-[#1a1a23] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <FileJson size={16} className="text-white" />
            </div>
            Конструктор JSON для Runner
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {!isGenerated ? (
            <>
              <div className="px-6 py-3 border-b border-[rgba(255,255,255,0.08)] bg-[#1a1a23]">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-400">Имя файла:</label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    className="flex-1 px-3 py-1.5 bg-[#252532] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    placeholder="runner-data"
                  />
                  <span className="text-sm text-gray-500">.json</span>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-300">Атрибуты</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Будет сформировано <span className="text-indigo-400 font-medium">{totalIterations}</span> строк
                    </p>
                  </div>
                  <button
                    onClick={addAttribute}
                    className="flex items-center gap-1.5 px-3 py-1.5 gradient-btn text-white rounded-lg text-xs font-medium"
                  >
                    <Plus size={12} /> Добавить строку
                  </button>
                </div>

                <div className="space-y-2">
                  {attributes.map((attr, index) => (
                    <div key={attr.id} className="bg-[#252532] border border-[rgba(255,255,255,0.08)] rounded-lg p-3 hover:border-[rgba(255,255,255,0.15)] transition-all">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-gray-500 w-6 font-mono">#{index + 1}</span>
                        <input
                          type="text"
                          value={attr.name}
                          onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                          placeholder="Имя атрибута (например: type, id)"
                          className="flex-1 px-2.5 py-1.5 bg-[#1a1a23] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-indigo-400 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-gray-600"
                        />
                        <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-[#1a1a23] border border-[rgba(255,255,255,0.08)] rounded-lg hover:border-[rgba(255,255,255,0.15)] transition-all">
                          <input
                            type="checkbox"
                            checked={attr.isConstant}
                            onChange={(e) => updateAttribute(attr.id, 'isConstant', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 text-indigo-500 focus:ring-indigo-500/20"
                          />
                          <span className="text-xs text-gray-300 font-medium">Константа</span>
                        </label>
                        <button
                          onClick={() => removeAttribute(attr.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {attr.isConstant ? (
                        <div className="ml-8 flex items-center gap-2">
                          <Hash size={14} className="text-gray-500" />
                          <input
                            type="text"
                            value={attr.constantValue}
                            onChange={(e) => updateAttribute(attr.id, 'constantValue', e.target.value)}
                            placeholder="Значение (одинаковое для всех строк)"
                            className="flex-1 px-2.5 py-1.5 bg-[#1a1a23] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-gray-600"
                          />
                        </div>
                      ) : (
                        <div className="ml-8">
                          <div className="flex items-start gap-2">
                            <List size={14} className="text-gray-500 mt-2" />
                            <textarea
                              value={attr.listValues}
                              onChange={(e) => updateAttribute(attr.id, 'listValues', e.target.value)}
                              placeholder="Список значений (каждое с новой строки):&#10;value1&#10;value2&#10;value3"
                              className="flex-1 px-2.5 py-1.5 bg-[#1a1a23] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-gray-600 font-mono"
                              rows={4}
                            />
                          </div>
                          <div className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                            <CheckCircle size={10} />
                            Строк: {attr.listValues.split('\n').filter(v => v.trim()).length}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-xs text-gray-500 bg-[#252532] border border-[rgba(255,255,255,0.08)] rounded-lg p-3">
                  <p className="mb-1.5 font-medium text-gray-400">💡 Как это работает:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li>По умолчанию — режим <strong className="text-gray-300">Список</strong> (textarea)</li>
                    <li>Поставьте галочку <strong className="text-gray-300">Константа</strong> — одно значение для всех строк</li>
                    <li>Каждая строка в списке = одна итерация Runner</li>
                    <li>Имена атрибутов должны совпадать с {'{{'}variable{'}'} в запросе</li>
                  </ul>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-[rgba(255,255,255,0.08)] bg-[#1a1a23] flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={attributes.length === 0}
                  className="flex items-center gap-2 px-4 py-2 gradient-btn disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-all"
                >
                  <Play size={14} /> Сформировать JSON
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 py-3 border-b border-[rgba(255,255,255,0.08)] bg-[#1a1a23] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-medium text-gray-300">JSON сформирован</h3>
                  <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                    {totalIterations} строк
                  </span>
                </div>
                <button onClick={handleReset} className="text-xs text-indigo-400 hover:text-indigo-300 transition-all">
                  ← Редактировать
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="bg-[#1a1a23] border border-[rgba(255,255,255,0.08)] rounded-lg p-4 font-mono text-xs text-gray-300 whitespace-pre overflow-auto max-h-[400px]">
                  {generatedJson}
                </div>
              </div>

              <div className="px-6 py-3 border-t border-[rgba(255,255,255,0.08)] bg-[#1a1a23] flex justify-end gap-3">
                <button onClick={handleReset} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg font-medium text-sm transition-all">
                  Назад
                </button>
                <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-lg font-medium text-sm transition-all">
                  <Download size={14} /> Сохранить {fileName}.json
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};