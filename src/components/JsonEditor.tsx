import { useRef, useMemo, useEffect, useState } from 'react';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ИСПРАВЛЕНИЕ 3.17: улучшенный regex для подсветки
const highlightLine = (line: string): string => {
  const escaped = escapeHtml(line);
  return escaped
    // Ключи: "key":
    .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="json-key">$1</span>$2')
    // Строки после двоеточия
    .replace(/:\s*(&quot;.*?&quot;)/g, ': <span class="json-string">$1</span>')
    // Числа (включая отрицательные и дробные)
    .replace(/:\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g, ': <span class="json-number">$1</span>')
    // Литералы
    .replace(/:\s*(true|false|null)/g, ': <span class="json-literal">$1</span>')
    // Отдельные литералы в массивах
    .replace(/^\s*(true|false|null)\s*$/g, '<span class="json-literal">$1</span>')
    // Отдельные числа в массивах
    .replace(/^\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\s*$/g, '<span class="json-number">$1</span>');
};

const highlight = (value: string, placeholder?: string): string => {
  if (!value) return escapeHtml(placeholder || '');
  
  return value.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    
    if (trimmed.startsWith('//')) {
      return `<span class="json-comment">${escapeHtml(line)}</span>`;
    }
    
    const commentIndex = line.indexOf('//');
    if (commentIndex > 0) {
      const before = line.slice(0, commentIndex);
      const quotes = (before.match(/"/g) || []).length;
      
      if (quotes % 2 === 0) {
        return (
          highlightLine(before) +
          `<span class="json-comment">${escapeHtml(line.slice(commentIndex))}</span>`
        );
      }
    }
    
    return highlightLine(line);
  }).join('\n');
};

export const JsonEditor = ({
  value,
  onChange,
  placeholder,
}: JsonEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), 60);
    return () => clearTimeout(t);
  }, [value]);

  const lineCount = useMemo(
    () => (value ? value.split('\n').length : 1),
    [value]
  );

  const highlightedCode = useMemo(
    () => highlight(debouncedValue, placeholder),
    [debouncedValue, placeholder]
  );

  const handleScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    
    // ИСПРАВЛЕНИЕ 3.15: синхронизация скролла gutter через transform
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      // Используем transform вместо scrollTop для overflow-y-hidden
      gutterRef.current.style.transform = `translateY(${-ta.scrollTop}px)`;
    }
  };

  return (
    <div className="relative flex h-full w-full bg-[#1e1e1e] rounded-lg overflow-hidden border border-[rgba(255,255,255,0.08)]">
      {/* ИСПРАВЛЕНИЕ 3.15: gutter с transform вместо scrollTop */}
      <div
        ref={gutterRef}
        className="flex-shrink-0 w-12 bg-[#252525] border-r border-[rgba(255,255,255,0.08)] text-gray-600 text-xs font-mono py-3 px-2 select-none overflow-hidden will-change-transform"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="leading-6 text-right h-6">
            {i + 1}
          </div>
        ))}
      </div>

      <div className="relative flex-1 h-full overflow-hidden">
        <pre
          ref={preRef}
          className="absolute inset-0 m-0 p-3 font-mono text-sm leading-6 pointer-events-none overflow-auto whitespace-pre"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />

        {/* ИСПРАВЛЕНИЕ 3.16: wrap="off" для синхронизации с pre */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          wrap="off"
          className="absolute inset-0 w-full h-full m-0 p-3 font-mono text-sm leading-6 bg-transparent text-transparent caret-white resize-none outline-none border-0 overflow-auto whitespace-pre"
          style={{ color: 'transparent', caretColor: 'white' }}
        />
      </div>
    </div>
  );
};