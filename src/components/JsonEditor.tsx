import { useRef, useMemo, useEffect, useState, useCallback } from 'react';

// ============================================================
// ТИПЫ
// ============================================================
interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// ============================================================
// КОНСТАНТЫ
// ============================================================
const DEBOUNCE_DELAY = 150; // мс для debounce подсветки
const INDENT_SIZE = 2;

// ============================================================
// УТИЛИТЫ
// ============================================================
const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Оптимизированная подсветка JSON
const highlightJson = (value: string): string => {
  if (!value.trim()) return '';
  
  try {
    const parsed = JSON.parse(value);
    return highlightValue(parsed, 0);
  } catch {
    return highlightInvalidJson(value);
  }
};

// Подсветка невалидного JSON (быстрый fallback)
const highlightInvalidJson = (value: string): string => {
  return value.split('\n').map(line => {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('//')) {
      return `<span class="json-comment">${escapeHtml(line)}</span>`;
    }
    
    if (trimmed.match(/^".*":/)) {
      return line.replace(/(".*?")(\s*:)(.*)/, (_match, key, colon, rest) => {
        const valueMatch = rest.trim().match(/^("(?:[^"\\]|\\.)*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
        if (valueMatch) {
          const value = valueMatch[1];
          let valueClass = 'json-string';
          if (value === 'true' || value === 'false') valueClass = 'json-boolean';
          else if (value === 'null') valueClass = 'json-null';
          else if (/^-?\d/.test(value)) valueClass = 'json-number';
          
          return `<span class="json-key">${escapeHtml(key)}</span>${escapeHtml(colon)} <span class="${valueClass}">${escapeHtml(value)}</span>`;
        }
        return `<span class="json-key">${escapeHtml(key)}</span>${escapeHtml(colon)}${escapeHtml(rest)}`;
      });
    }
    
    return escapeHtml(line);
  }).join('\n');
};

// Рекурсивная подсветка валидного JSON
const highlightValue = (value: any, indent: number): string => {
  const indentStr = ' '.repeat(indent * INDENT_SIZE);
  const childIndentStr = ' '.repeat((indent + 1) * INDENT_SIZE);
  
  if (value === null) {
    return '<span class="json-null">null</span>';
  }
  
  if (typeof value === 'boolean') {
    return `<span class="json-boolean">${value}</span>`;
  }
  
  if (typeof value === 'number') {
    return `<span class="json-number">${value}</span>`;
  }
  
  if (typeof value === 'string') {
    return `<span class="json-string">"${escapeHtml(value)}"</span>`;
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    
    if (value.length > 100) {
      return `[... ${value.length} items]`;
    }
    
    const items = value.map((item, i) => {
      const comma = i < value.length - 1 ? ',' : '';
      return `${childIndentStr}${highlightValue(item, indent + 1)}${comma}`;
    }).join('\n');
    
    return `[\n${items}\n${indentStr}]`;
  }
  
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    
    if (entries.length > 100) {
      return `{... ${entries.length} keys}`;
    }
    
    const items = entries.map(([key, val], i) => {
      const comma = i < entries.length - 1 ? ',' : '';
      return `${childIndentStr}<span class="json-key">"${escapeHtml(key)}"</span>: ${highlightValue(val, indent + 1)}${comma}`;
    }).join('\n');
    
    return `{\n${items}\n${indentStr}}`;
  }
  
  return String(value);
};

// ============================================================
// КОМПОНЕНТ
// ============================================================
export const JsonEditor = ({
  value,
  onChange,
  placeholder,
}: JsonEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const [debouncedValue, setDebouncedValue] = useState(value);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Debounce для подсветки синтаксиса
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, DEBOUNCE_DELAY);
    
    return () => clearTimeout(timer);
  }, [value]);

  // Мемоизация подсветки
  const highlightedCode = useMemo(() => {
    return highlightJson(debouncedValue);
  }, [debouncedValue]);

  // Мемоизация нумерации строк (БЕЗ setState!)
  const lineNumbers = useMemo(() => {
    const count = value ? value.split('\n').length : 1;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [value]);

  // Синхронизация скролла
  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.style.transform = `translateY(${-ta.scrollTop}px)`;
    }
  }, []);

  // Обработка клавиш
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    
    if (e.key === 'Tab') {
      e.preventDefault();
      const indent = ' '.repeat(INDENT_SIZE);
      const newValue = value.substring(0, start) + indent + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + INDENT_SIZE;
      }, 0);
      return;
    }
    
    const openChars: Record<string, string> = { '{': '}', '[': ']', '"': '"' };
    if (openChars[e.key]) {
      e.preventDefault();
      const closeChar = openChars[e.key];
      const newValue = value.substring(0, start) + e.key + closeChar + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 1;
      }, 0);
      return;
    }
  }, [value, onChange]);

  // Обновление позиции курсора
  const updateCursorPosition = useCallback((pos: number) => {
    const textBeforeCursor = value.substring(0, pos);
    const lines = textBeforeCursor.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    setCursorPosition({ line, column });
  }, [value]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    updateCursorPosition(e.currentTarget.selectionStart);
  }, [updateCursorPosition]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    updateCursorPosition(e.currentTarget.selectionStart);
  }, [updateCursorPosition]);

  return (
    <div className="relative flex h-full w-full bg-[#1e1e1e] rounded-lg overflow-hidden border border-[rgba(255,255,255,0.08)]">
      {/* Нумерация строк */}
      <div
        ref={gutterRef}
        className="flex-shrink-0 w-12 bg-[#252525] border-r border-[rgba(255,255,255,0.08)] text-gray-600 text-xs font-mono py-3 px-2 select-none overflow-hidden will-change-transform"
      >
        {lineNumbers.map(num => (
          <div key={num} className="leading-6 text-right h-6">
            {num}
          </div>
        ))}
      </div>

      <div className="relative flex-1 h-full overflow-hidden">
        {/* Подсвеченный код */}
        <pre
          ref={preRef}
          className="absolute inset-0 m-0 p-3 font-mono text-sm leading-6 pointer-events-none overflow-auto whitespace-pre"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
          style={{ color: '#d4d4d4' }}
        />

        {/* Textarea для ввода */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onClick={handleClick}
          spellCheck={false}
          wrap="off"
          className="absolute inset-0 w-full h-full m-0 p-3 font-mono text-sm leading-6 bg-transparent text-transparent caret-white resize-none outline-none border-0 overflow-auto whitespace-pre"
          style={{ 
            color: 'transparent', 
            caretColor: 'white',
            zIndex: 10
          }}
          placeholder={placeholder}
        />
      </div>

      {/* Status bar */}
      <div className="absolute bottom-0 right-0 px-2 py-1 bg-[#252525] border-t border-l border-[rgba(255,255,255,0.08)] text-[10px] text-gray-500 font-mono">
        Ln {cursorPosition.line}, Col {cursorPosition.column}
      </div>

      {/* Стили для подсветки */}
      <style>{`
        .json-key { color: #9cdcfe; }
        .json-string { color: #ce9178; }
        .json-number { color: #b5cea8; }
        .json-boolean { color: #569cd6; }
        .json-null { color: #569cd6; }
        .json-comment { color: #6a9955; }
      `}</style>
    </div>
  );
};