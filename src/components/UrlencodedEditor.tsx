import { useState, useCallback } from 'react';
import { Plus, Trash2, GripVertical, Pencil, Table2 } from 'lucide-react';
import { KeyValuePair } from '../types';
import { generateId } from '../utils/helpers';
import { parseUrlencoded, serializeUrlencoded } from '../utils/urlencoded';

interface UrlencodedEditorProps {
  rows: KeyValuePair[];
  onChange: (rows: KeyValuePair[]) => void;
}

export const UrlencodedEditor: React.FC<UrlencodedEditorProps> = ({ rows, onChange }) => {
  const [mode, setMode] = useState<'table' | 'bulk'>('table');
  const [bulkText, setBulkText] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleEnterBulk = useCallback(() => {
    setBulkText(serializeUrlencoded(rows));
    setMode('bulk');
  }, [rows]);

  const handleApplyBulk = useCallback(() => {
    const parsed = parseUrlencoded(bulkText);
    onChange(parsed);
    setMode('table');
  }, [bulkText, onChange]);

  const updateRow = useCallback(
    (id: string, patch: Partial<KeyValuePair>) => {
      onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [rows, onChange]
  );

  const addRow = useCallback(() => {
    onChange([...rows, { id: generateId(), key: '', value: '', enabled: true }]);
  }, [rows, onChange]);

  const removeRow = useCallback(
    (id: string) => {
      onChange(rows.filter((r) => r.id !== id));
    },
    [rows, onChange]
  );

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const from = rows.findIndex((r) => r.id === draggedId);
    const to = rows.findIndex((r) => r.id === targetId);
    if (from < 0 || to < 0) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setDraggedId(null);
    setDragOverId(null);
  };

  // ============================================================
  // BULK EDIT
  // ============================================================
  if (mode === 'bulk') {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[rgba(255,255,255,0.08)] shrink-0">
          <span className="text-xs text-gray-400">
            Bulk Edit — формат: <code className="font-mono">key=value</code>, по одному на строку или через <code className="font-mono">&amp;</code>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('table')}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded transition-all"
            >
              <Table2 size={11} /> Таблица
            </button>
            <button
              onClick={handleApplyBulk}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-all font-medium"
            >
              Применить
            </button>
          </div>
        </div>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={'key1=value1\nkey2=value2\nkey3=value3'}
          className="flex-1 min-h-[200px] px-3 py-2 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 text-sm text-gray-300 font-mono resize-none leading-relaxed placeholder:text-gray-600"
          spellCheck={false}
        />
      </div>
    );
  }

  // ============================================================
  // TABLE
  // ============================================================
  const activeCount = rows.filter((r) => r.enabled && r.key).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[rgba(255,255,255,0.08)] shrink-0">
        <span className="text-xs text-gray-400">
          {rows.length === 0
            ? 'Нет параметров'
            : `${activeCount} активных из ${rows.length}`}
        </span>
        <button
          onClick={handleEnterBulk}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded transition-all"
          title="Редактировать как текст"
        >
          <Pencil size={11} /> Bulk Edit
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {rows.map((row) => (
          <div
            key={row.id}
            draggable
            onDragStart={(e) => handleDragStart(e, row.id)}
            onDragOver={(e) => handleDragOver(e, row.id)}
            onDrop={(e) => handleDrop(e, row.id)}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
            className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all group ${
              dragOverId === row.id
                ? 'border-indigo-500/50 bg-indigo-500/5'
                : 'border-transparent hover:border-[rgba(255,255,255,0.08)] hover:bg-white/[0.02]'
            }`}
          >
            <GripVertical
              size={12}
              className="text-gray-600 cursor-grab active:cursor-grabbing shrink-0"
            />
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => updateRow(row.id, { enabled: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-gray-600 text-gray-400 focus:ring-gray-500/20 shrink-0"
              aria-label="Включить параметр"
            />
            <input
              type="text"
              value={row.key}
              onChange={(e) => updateRow(row.id, { key: e.target.value })}
              placeholder="Key"
              className={`flex-1 px-2.5 py-1.5 bg-[#2d2d2d] border rounded-lg focus:outline-none text-sm text-gray-300 transition-all placeholder:text-gray-600 ${
                row.enabled
                  ? 'border-[rgba(255,255,255,0.08)] focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20'
                  : 'border-transparent opacity-50'
              }`}
            />
            <input
              type="text"
              value={row.value}
              onChange={(e) => updateRow(row.id, { value: e.target.value })}
              placeholder="Value"
              className={`flex-1 px-2.5 py-1.5 bg-[#2d2d2d] border rounded-lg focus:outline-none text-sm text-gray-300 transition-all placeholder:text-gray-600 ${
                row.enabled
                  ? 'border-[rgba(255,255,255,0.08)] focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20'
                  : 'border-transparent opacity-50'
              }`}
            />
            <button
              onClick={() => removeRow(row.id)}
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
              aria-label="Удалить параметр"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        <button
          onClick={addRow}
          className="flex items-center gap-2 px-3 py-1.5 text-gray-300 hover:bg-gray-500/10 rounded-lg transition-all text-sm font-medium"
        >
          <Plus size={14} />
          Добавить параметр
        </button>
      </div>
    </div>
  );
};