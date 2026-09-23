import { useState, useMemo } from 'react';
import { X, Check } from 'lucide-react';

interface SchemaEditorProps {
  schema: string;
  onSave: (schema: string) => void;
  onClose: () => void;
  onApplyExample: (example: string) => void;
}

// ИСПРАВЛЕНИЕ 3.40: вынесено за компонент
const DEFAULT_SCHEMA = `{
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "name": { "type": "string" }
  },
  "required": ["id", "name"]
}`;

// ИСПРАВЛЕНИЕ 3.36: Number.isInteger для integer
const validateJsonAgainstSchema = (schema: any, data: any): { valid: boolean; error?: string } => {
  if (!schema || typeof schema !== 'object') {
    return { valid: false, error: 'Некорректная схема' };
  }

  if (schema.type === 'object') {
    // ИСПРАВЛЕНИЕ 3.37: проверка на null/undefined перед field in data
    if (data === null || data === undefined) {
      return { valid: false, error: 'Ожидался объект, получено null/undefined' };
    }
    if (typeof data !== 'object' || Array.isArray(data)) {
      return { valid: false, error: 'Ожидался объект' };
    }

    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in data)) {
          return { valid: false, error: `Отсутствует обязательное поле: ${field}` };
        }
      }
    }

    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (key in data) {
          const result = validateJsonAgainstSchema(prop, data[key]);
          if (!result.valid) {
            return { valid: false, error: `Поле "${key}": ${result.error}` };
          }
        }
      }
    }

    return { valid: true };
  }

  // ИСПРАВЛЕНИЕ 3.36: Number.isInteger для integer
  if (schema.type === 'integer') {
    if (typeof data !== 'number' || !Number.isInteger(data)) {
      return { valid: false, error: 'Ожидалось целое число' };
    }
    return { valid: true };
  }

  if (schema.type === 'number') {
    if (typeof data !== 'number') {
      return { valid: false, error: 'Ожидалось число' };
    }
    return { valid: true };
  }

  if (schema.type === 'string') {
    if (typeof data !== 'string') {
      return { valid: false, error: 'Ожидалась строка' };
    }
    return { valid: true };
  }

  if (schema.type === 'boolean') {
    if (typeof data !== 'boolean') {
      return { valid: false, error: 'Ожидался boolean' };
    }
    return { valid: true };
  }

  if (schema.type === 'array') {
    if (!Array.isArray(data)) {
      return { valid: false, error: 'Ожидался массив' };
    }
    return { valid: true };
  }

  return { valid: true };
};

// ИСПРАВЛЕНИЕ 3.38: !== undefined вместо || для default
const generateExampleFromSchema = (schema: any): any => {
  if (!schema || typeof schema !== 'object') return null;

  if (schema.type === 'object') {
    const obj: any = {};
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, prop]: [string, any]) => {
        // ИСПРАВЛЕНИЕ 3.38: используем !== undefined вместо ||
        if (prop.default !== undefined) {
          obj[key] = prop.default;
        } else if (prop.type === 'string') {
          obj[key] = '';
        } else if (prop.type === 'number') {
          obj[key] = 0;
        } else if (prop.type === 'integer') {
          obj[key] = 0;
        } else if (prop.type === 'boolean') {
          obj[key] = false;
        } else if (prop.type === 'array') {
          obj[key] = [];
        } else if (prop.type === 'object') {
          obj[key] = generateExampleFromSchema(prop);
        } else {
          obj[key] = null;
        }
      });
    }
    return obj;
  }

  if (schema.type === 'string') return '';
  if (schema.type === 'number' || schema.type === 'integer') return 0;
  if (schema.type === 'boolean') return false;
  if (schema.type === 'array') return [];

  return null;
};

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  schema,
  onSave,
  onClose,
  onApplyExample,
}) => {
  const [localSchema, setLocalSchema] = useState<string>(schema || DEFAULT_SCHEMA);
  const [validationError, setValidationError] = useState<string | null>(null);

  const schemaObject = useMemo(() => {
    try {
      return JSON.parse(localSchema);
    } catch {
      return null;
    }
  }, [localSchema]);

  const handleSave = () => {
    try {
      JSON.parse(localSchema);
      setValidationError(null);
      onSave(localSchema);
    } catch (e: any) {
      setValidationError('Некорректный JSON: ' + e.message);
    }
  };

  const handleApplyExample = () => {
    if (!schemaObject) {
      setValidationError('Некорректный JSON в схеме');
      return;
    }

    try {
      const example = generateExampleFromSchema(schemaObject);
      onApplyExample(JSON.stringify(example, null, 2));
      onClose();
    } catch (e) {
      setValidationError('Ошибка генерации примера: ' + (e as Error).message);
    }
  };

  const handleValidate = () => {
    if (!schemaObject) {
      setValidationError('Некорректный JSON в схеме');
      return;
    }
    setValidationError(null);
    setValidationError('Схема валидна ✓');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-scale-in">
      <div className="bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.08)]">
          <h3 className="text-lg font-bold text-gray-200">JSON Schema Editor</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-all"
            aria-label="Close"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                JSON Schema
              </label>
              <button
                onClick={handleValidate}
                className="text-[10px] text-gray-400 hover:text-gray-200 hover:bg-white/5 px-2 py-1 rounded transition-all"
              >
                Проверить схему
              </button>
            </div>
            <textarea
              value={localSchema}
              onChange={(e) => {
                setLocalSchema(e.target.value);
                setValidationError(null);
              }}
              rows={15}
              className="w-full px-3 py-2 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 text-sm text-gray-300 font-mono resize-none"
              placeholder={DEFAULT_SCHEMA}
              spellCheck={false}
            />
            {validationError && (
              <div className={`mt-2 text-xs px-3 py-2 rounded ${
                validationError.includes('✓')
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {validationError}
              </div>
            )}
          </div>

          <div className="p-3 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded-lg">
            <div className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
              Подсказка по типам
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500">
              <div><span className="text-indigo-400">"type": "object"</span> — объект с полями</div>
              <div><span className="text-indigo-400">"type": "array"</span> — массив</div>
              <div><span className="text-indigo-400">"type": "string"</span> — строка</div>
              <div><span className="text-indigo-400">"type": "integer"</span> — целое число</div>
              <div><span className="text-indigo-400">"type": "number"</span> — число</div>
              <div><span className="text-indigo-400">"type": "boolean"</span> — true/false</div>
              <div><span className="text-indigo-400">"required": [...]</span> — обязательные поля</div>
              <div><span className="text-indigo-400">"default": ...</span> — значение по умолчанию</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.08)] bg-[#1e1e1e] flex justify-between gap-3">
          <button
            onClick={handleApplyExample}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all"
          >
            <Check size={16} />
            Применить пример
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-gray-300 rounded-lg text-sm font-medium transition-all"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
            >
              Сохранить схему
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};