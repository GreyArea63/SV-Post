import { memo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { KeyValuePair } from '../types';

interface KeyValueEditorProps {
  items: KeyValuePair[];
  field: 'headers' | 'queryParams';
  onUpdate: <K extends keyof KeyValuePair>(field: 'headers' | 'queryParams', id: string, key: K, value: KeyValuePair[K]) => void;
  onAdd: (field: 'headers' | 'queryParams') => void;
  onRemove: (field: 'headers' | 'queryParams', id: string) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}

export const KeyValueEditor = memo<KeyValueEditorProps>(({
  items,
  field,
  onUpdate,
  onAdd,
  onRemove,
  keyPlaceholder,
  valuePlaceholder,
}) => {
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="flex gap-2 items-center group">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => onUpdate(field, item.id, 'enabled', e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-600 text-gray-400 focus:ring-gray-500/20"
            aria-label="Включить параметр"
          />
          <input
            type="text"
            value={item.key}
            onChange={(e) => onUpdate(field, item.id, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="flex-1 px-2.5 py-1.5 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 transition-all placeholder:text-gray-600"
          />
          <input
            type="text"
            value={item.value}
            onChange={(e) => onUpdate(field, item.id, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1 px-2.5 py-1.5 bg-[#2d2d2d] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 transition-all placeholder:text-gray-600"
          />
          <button
            onClick={() => onRemove(field, item.id)}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            aria-label="Удалить параметр"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onAdd(field)}
        className="flex items-center gap-2 px-3 py-1.5 text-gray-300 hover:bg-gray-500/10 rounded-lg transition-all text-sm font-medium"
      >
        <Plus size={14} />
        Добавить
      </button>
    </div>
  );
});

KeyValueEditor.displayName = 'KeyValueEditor';