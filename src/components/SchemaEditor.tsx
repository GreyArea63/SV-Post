import React, { useState, useEffect } from 'react';
import { X, Save, Download, Upload, Code, CheckCircle, AlertCircle } from 'lucide-react';
import { JsonEditor } from './JsonEditor';

interface SchemaEditorProps {
  schema: string;
  onSave: (schema: string) => void;
  onClose: () => void;
  bodyContent: string;
  onApplyExample: (example: string) => void;
}

// Валидация JSON Schema
const validateSchema = (schema: string): { valid: boolean; error?: string } => {
  try {
    const parsed = JSON.parse(schema);
    // Простая проверка структуры JSON Schema
    if (parsed.$schema && !parsed.$schema.includes('json-schema.org')) {
      return { valid: false, error: 'Неверный формат $schema' };
    }
    return { valid: true };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
};

// Генерация примера JSON из JSON Schema
const generateExampleFromSchema = (schema: any, level = 0): any => {
  if (level > 5) return null; // Ограничение глубины

  if (!schema.type) {
    if (schema.properties) return generateExampleFromSchema({ type: 'object', properties: schema.properties }, level);
    if (schema.items) return generateExampleFromSchema({ type: 'array', items: schema.items }, level);
    return null;
  }

  switch (schema.type) {
    case 'string':
      return schema.enum ? schema.enum[0] : (schema.default || 'string');
    case 'number':
    case 'integer':
      return schema.default || (schema.type === 'integer' ? 0 : 0.0);
    case 'boolean':
      return schema.default || false;
    case 'null':
      return null;
    case 'array':
      if (schema.items) {
        return [generateExampleFromSchema(schema.items, level + 1)];
      }
      return [];
    case 'object':
      if (schema.properties) {
        const obj: any = {};
        Object.entries(schema.properties).forEach(([key, propSchema]) => {
          obj[key] = generateExampleFromSchema(propSchema as any, level + 1);
        });
        return obj;
      }
      return {};
    default:
      return null;
  }
};

// Валидация JSON против схемы (упрощенная)
const validateJsonAgainstSchema = (json: any, schema: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  const validate = (data: any, schemaPart: any, path = '') => {
    if (!schemaPart) return;

    // Проверка типа
    if (schemaPart.type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      if (actualType !== schemaPart.type) {
        if (!(schemaPart.type === 'integer' && typeof data === 'number')) {
          errors.push(`${path || 'root'}: ожидается тип "${schemaPart.type}", получено "${actualType}"`);
        }
      }
    }

    // Проверка обязательных полей
    if (schemaPart.required && Array.isArray(schemaPart.required)) {
      schemaPart.required.forEach((field: string) => {
        if (data && !(field in data)) {
          errors.push(`${path || 'root'}: отсутствует обязательное поле "${field}"`);
        }
      });
    }

    // Рекурсивная проверка свойств объекта
    if (schemaPart.type === 'object' && schemaPart.properties && data && typeof data === 'object') {
      Object.entries(schemaPart.properties).forEach(([key, propSchema]) => {
        validate(data[key], propSchema as any, path ? `${path}.${key}` : key);
      });
    }

    // Проверка элементов массива
    if (schemaPart.type === 'array' && schemaPart.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        validate(item, schemaPart.items, `${path}[${index}]`);
      });
    }

    // Проверка enum
    if (schemaPart.enum && !schemaPart.enum.includes(data)) {
      errors.push(`${path || 'root'}: значение должно быть одним из ${JSON.stringify(schemaPart.enum)}`);
    }
  };

  validate(json, schema);
  return { valid: errors.length === 0, errors };
};

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  schema,
  onSave,
  onClose,
  bodyContent,
  onApplyExample,
}) => {
  const [schemaText, setSchemaText] = useState(schema);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [validationMessage, setValidationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Пример JSON Schema по умолчанию
  const defaultSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      data: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          id: { type: 'string' },
          attributes: {
            type: 'object',
            properties: {
              status: { type: 'string' }
            }
          }
        },
        required: ['type', 'id']
      }
    }
  };

  const handleValidate = () => {
    const result = validateSchema(schemaText);
    setValidationResult(result);
    if (result.valid) {
      setValidationMessage({ type: 'success', text: 'Schema валидна' });
    } else {
      setValidationMessage({ type: 'error', text: result.error || 'Ошибка валидации' });
    }
  };

  const handleGenerateExample = () => {
    try {
      const parsed = JSON.parse(schemaText);
      const example = generateExampleFromSchema(parsed);
      const exampleJson = JSON.stringify(example, null, 2);
      onApplyExample(exampleJson);
      setValidationMessage({ type: 'success', text: 'Пример сгенерирован и применен' });
    } catch (e: any) {
      setValidationMessage({ type: 'error', text: `Ошибка генерации: ${e.message}` });
    }
  };

  const handleValidateBody = () => {
    try {
      const parsedSchema = JSON.parse(schemaText);
      const bodyJson = JSON.parse(bodyContent);
      const result = validateJsonAgainstSchema(bodyJson, parsedSchema);
      
      if (result.valid) {
        setValidationMessage({ type: 'success', text: 'Body соответствует схеме' });
      } else {
        setValidationMessage({ 
          type: 'error', 
          text: `Найдено ошибок: ${result.errors.length}\n${result.errors.slice(0, 3).join('\n')}` 
        });
      }
    } catch (e: any) {
      setValidationMessage({ type: 'error', text: `Ошибка: ${e.message}` });
    }
  };

  const handleSave = () => {
    const result = validateSchema(schemaText);
    if (result.valid) {
      onSave(schemaText);
      onClose();
    } else {
      setValidationMessage({ type: 'error', text: 'Невозможно сохранить невалидную схему' });
    }
  };

  const handleImportSchema = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        JSON.parse(text); // Проверка валидности JSON
        setSchemaText(text);
        setValidationMessage({ type: 'success', text: 'Schema импортирована' });
      } catch (err: any) {
        setValidationMessage({ type: 'error', text: `Ошибка импорта: ${err.message}` });
      }
    };
    input.click();
  };

  const handleExportSchema = () => {
    try {
      JSON.parse(schemaText); // Проверка
      const blob = new Blob([schemaText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'schema.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setValidationMessage({ type: 'success', text: 'Schema экспортирована' });
    } catch (e: any) {
      setValidationMessage({ type: 'error', text: `Ошибка экспорта: ${e.message}` });
    }
  };

  const loadDefaultSchema = () => {
    setSchemaText(JSON.stringify(defaultSchema, null, 2));
    setValidationMessage({ type: 'success', text: 'Загружена схема по умолчанию' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-[#252525] border border-[#3d3d3d] rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3d3d3d]">
          <h2 className="text-lg font-bold text-primary-500 flex items-center gap-2">
            <Code size={20} />
            JSON Schema Editor
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#3d3d3d] rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-[#1e1e1e] border-b border-[#3d3d3d]">
          <button
            onClick={handleValidate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded text-sm transition-colors"
          >
            <CheckCircle size={14} />
            Validate Schema
          </button>
          <button
            onClick={handleValidateBody}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded text-sm transition-colors"
          >
            <CheckCircle size={14} />
            Validate Body
          </button>
          <button
            onClick={handleGenerateExample}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 rounded text-sm transition-colors"
          >
            <Code size={14} />
            Generate Example
          </button>
          <div className="w-px h-6 bg-[#3d3d3d] mx-2" />
          <button
            onClick={handleImportSchema}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded text-sm transition-colors"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            onClick={handleExportSchema}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded text-sm transition-colors"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={loadDefaultSchema}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded text-sm transition-colors ml-auto"
          >
            Load Default
          </button>
        </div>

        {/* Validation Message */}
        {validationMessage && (
          <div className={`px-4 py-2 text-sm flex items-center gap-2 ${
            validationMessage.type === 'success' 
              ? 'bg-green-500/10 text-green-500 border-b border-green-500/30' 
              : 'bg-red-500/10 text-red-500 border-b border-red-500/30'
          }`}>
            {validationMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            <span className="whitespace-pre-line">{validationMessage.text}</span>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-hidden p-4 min-h-0">
          <div className="h-full flex flex-col">
            <div className="text-xs text-gray-400 mb-2">JSON Schema (Draft 7)</div>
            <div className="flex-1 min-h-0">
              <JsonEditor
                value={schemaText}
                onChange={setSchemaText}
                placeholder='{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string" }
  }
}'
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#3d3d3d] bg-[#1e1e1e]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:bg-[#2d2d2d] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
          >
            <Save size={14} />
            Save Schema
          </button>
        </div>
      </div>
    </div>
  );
};