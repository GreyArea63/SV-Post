import React, { useRef, useState, useEffect, useCallback } from 'react';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onBeautify?: () => void; // Новая пропса
}

// Подсветка синтаксиса JSON
const highlightJson = (text: string): string => {
  if (!text) return '';
  
  // Экранируем HTML
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Подсветка строк (включая ключи)
  escaped = escaped.replace(
    /("(?:[^"\\]|\\.)*")\s*:/g,
    '<span class="json-key">$1</span>:'
  );

  // Подсветка строковых значений
  escaped = escaped.replace(
    /:\s*("(?:[^"\\]|\\.)*")/g,
    ': <span class="json-string">$1</span>'
  );

  // Подсветка чисел
  escaped = escaped.replace(
    /:\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
    ': <span class="json-number">$1</span>'
  );

  // Подсветка null, true, false
  escaped = escaped.replace(
    /:\s*(null|true|false)/g,
    ': <span class="json-literal">$1</span>'
  );

  // Подсветка комментариев //
  escaped = escaped.replace(
    /(\/\/[^\n]*)/g,
    '<span class="json-comment">$1</span>'
  );

  // Подсветка комментариев /* */
  escaped = escaped.replace(
    /(\/\*[\s\S]*?\*\/)/g,
    '<span class="json-comment">$1</span>'
  );

  return escaped;
};

// Генерация вертикальных линий отступов
const generateIndentGuides = (text: string): string[] => {
  const lines = text.split('\n');
  return lines.map(line => {
    const match = line.match(/^(\s*)/);
    const spaces = match ? match[1].length : 0;
    const indentLevel = Math.floor(spaces / 2);
    return indentLevel;
  });
};

export const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter request body...',
  onBeautify,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Подсчет строк
  useEffect(() => {
    const lines = value.split('\n').length;
    setLineCount(lines);
  }, [value]);

  // Синхронизация скролла
  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current && lineNumbersRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
      lineNumbersRef.current.scrollTop = scrollTop;
      setScrollTop(scrollTop);
      setScrollLeft(scrollLeft);
    }
  }, []);

  // Обработка Tab
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      onChange(newVal);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }

    // Автозакрытие скобок
    if (e.key === '{' || e.key === '[' || e.key === '"' || e.key === '(') {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const closeMap: Record<string, string> = {
        '{': '}',
        '[': ']',
        '"': '"',
        '(': ')',
      };
      const closeChar = closeMap[e.key];
      
      if (start === end) {
        e.preventDefault();
        const newVal = val.substring(0, start) + e.key + closeChar + val.substring(end);
        onChange(newVal);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1;
        }, 0);
      }
    }
  };

  const highlighted = highlightJson(value);
  const indentGuides = generateIndentGuides(value);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 flex min-h-0 relative bg-[#1e1e1e] rounded border border-[#3d3d3d] overflow-hidden">
        {/* Номера строк */}
        <div
          ref={lineNumbersRef}
          className="w-12 bg-[#1e1e1e] border-r border-[#3d3d3d] py-3 px-2 text-right select-none overflow-hidden shrink-0"
          style={{ lineHeight: '20px' }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i}
              className="text-[11px] text-gray-600 font-mono"
              style={{ height: '20px' }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Контейнер для подсветки + textarea */}
        <div className="flex-1 relative overflow-hidden">
          {/* Подсветка (pre) - снизу */}
          <pre
            ref={preRef}
            className="absolute inset-0 m-0 p-3 font-mono text-sm whitespace-pre overflow-auto pointer-events-none"
            style={{
              lineHeight: '20px',
              tabSize: 2,
            }}
            aria-hidden="true"
          >
            <code
              className="json-code"
              dangerouslySetInnerHTML={{ __html: highlighted || placeholder }}
            />
          </pre>

          {/* Textarea - сверху, прозрачный текст */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 w-full h-full m-0 p-3 font-mono text-sm resize-none focus:outline-none bg-transparent text-transparent caret-white"
            style={{
              lineHeight: '20px',
              tabSize: 2,
              caretColor: '#fff',
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Стили подсветки */}
      <style>{`
        .json-code .json-key {
          color: #9cdcfe;
        }
        .json-code .json-string {
          color: #ce9178;
        }
        .json-code .json-number {
          color: #b5cea8;
        }
        .json-code .json-literal {
          color: #569cd6;
        }
        .json-code .json-comment {
          color: #6a9955;
          font-style: italic;
        }
        textarea::placeholder {
          color: #6b7280;
        }
      `}</style>
    </div>
  );
};