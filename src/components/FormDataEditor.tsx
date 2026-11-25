import { useState, useCallback } from 'react';
import { Plus, Trash2, GripVertical, File, FileText, X, Upload } from 'lucide-react';
import { KeyValuePair } from '../types';
import { generateId } from '../utils/helpers';

interface FormDataEditorProps {
  rows: KeyValuePair[];
  onChange: (rows: KeyValuePair[]) => void;
}

export const FormDataEditor: React.FC<FormDataEditorProps> = ({ rows, onChange }) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const updateRow = useCallback(
    (id: string, patch: Partial<KeyValuePair>) => {
      onChange(rows.map((r) => (r.id === id ? { ...r, ...(patch as any) } : r)));
    },
    [rows, onChange]
  );

  const addRow = useCallback(() => {
    onChange([...rows, { id: generateId(), key: '', value: '', enabled: true, type: 'text' } as any]);
  }, [rows, onChange]);

  const removeRow = useCallback(
    (id: string) => {
      onChange(rows.filter((r) => r.id !== id));
    },
    [rows, onChange]
  );

  // ✅ Выбор файлов через Electron API
  const handleSelectFiles = useCallback(async (id: string) => {
    if (!window.electronAPI?.openFiles) {
      alert('Выбор файлов доступен только в десктопном приложении');
      return;
    }
    const result = await window.electronAPI.openFiles();
    if (result.success && result.filePaths) {
      updateRow(id, { files: result.filePaths } as any);
    }
  }, [updateRow]);

  const removeFile = useCallback((id: string, filePath: string) => {
    const row = rows.find(r => r.id === id);
    const currentFiles = (row as any)?.files;
    if (!row || !currentFiles) return;
    
    const newFiles = currentFiles.filter((f: string) => f !== filePath);
    updateRow(id, { files: newFiles.length > 0 ? newFiles : undefined } as any);
  }, [rows, updateRow]);

  // Drag-n-drop
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

  const activeCount = rows.filter((r) => r.enabled && r.key).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[rgba(255,255,255,0.08)] shrink-0">
        <span className="text-xs text-gray-400">
          {rows.length === 0 ? 'Нет полей' : `${activeCount} активных из ${rows.length}`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {rows.map((row) => {
          const rowType = (row as any).type || 'text';
          const rowFiles = (row as any).files || [];
          
          return (
            <div
              key={row.id}
              draggable
              onDragStart={(e) => handleDragStart(e, row.id)}
              onDragOver={(e) => handleDragOver(e, row.id)}
              onDrop={(e) => handleDrop(e, row.id)}
              onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
              className={`flex flex-col p-1.5 rounded-lg border transition-all group ${
                dragOverId === row.id
                  ? 'border-indigo-500/50 bg-indigo-500/5'
                  : 'border-transparent hover:border-[rgba(255,255,255,0.08)] hover:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center gap-2">
                <GripVertical size={12} className="text-gray-600 cursor-grab active:cursor-grabbing shrink-0" />
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => updateRow(row.id, { enabled: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-gray-600 text-gray-400 focus:ring-gray-500/20 shrink-0"
                  aria-label="Включить поле"
                />
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) => updateRow(row.id, { key: e.target.value })}
                  placeholder="Field"
                  className={`flex-1 px-2.5 py-1.5 bg-[#2d2d2d] border rounded-lg focus:outline-none text-sm text-gray-300 transition-all placeholder:text-gray-600 ${
                    row.enabled ? 'border-[rgba(255,255,255,0.08)] focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20' : 'border-transparent opacity-50'
                  }`}
                />

                {/* Селектор Text / File */}
                <select
                  value={rowType}
                  onChange={(e) => updateRow(row.id, { type: e.target.value, files: undefined, value: '' } as any)}
                  className={`px-2 py-1.5 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-gray-300 outline-none focus:border-gray-500 transition-all shrink-0 ${!row.enabled && 'opacity-50'}`}
                >
                  <option value="text">Text</option>
                  <option value="file">File</option>
                </select>

                <button
                  onClick={() => removeRow(row.id)}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                  aria-label="Удалить поле"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Value Input (в зависимости от типа) */}
              {rowType === 'text' ? (
                <div className="pl-6 pt-1.5">
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateRow(row.id, { value: e.target.value })}
                    placeholder="Value"
                    className={`w-full px-2.5 py-1.5 bg-[#2d2d2d] border rounded-lg focus:outline-none text-sm text-gray-300 transition-all placeholder:text-gray-600 ${
                      row.enabled ? 'border-[rgba(255,255,255,0.08)] focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20' : 'border-transparent opacity-50'
                    }`}
                  />
                </div>
              ) : (
                <div className="pl-6 pt-1.5 space-y-1">
                  <button
                    onClick={() => handleSelectFiles(row.id)}
                    disabled={!row.enabled}
                    className={`flex items-center gap-2 px-3 py-1.5 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-gray-300 hover:bg-[#363636] focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${!row.enabled && 'opacity-50'}`}
                  >
                    <Upload size={14} />
                    Выбрать файл...
                  </button>
                  
                  {/* Список выбранных файлов */}
                  {rowFiles.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {rowFiles.map((filePath: string) => (
                        <div key={filePath} className="flex items-center gap-2 px-2 py-1 bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded text-xs text-gray-400 group/file">
                          <FileText size={12} className="shrink-0 text-indigo-400" />
                          <span className="truncate flex-1" title={filePath}>
                            {filePath.split(/[\\/]/).pop()}
                          </span>
                          <button onClick={() => removeFile(row.id, filePath)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover/file:opacity-100 transition-all shrink-0">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={addRow}
          className="flex items-center gap-2 px-3 py-1.5 text-gray-300 hover:bg-gray-500/10 rounded-lg transition-all text-sm font-medium mt-1"
        >
          <Plus size={14} />
          Добавить поле
        </button>
      </div>
    </div>
  );
};