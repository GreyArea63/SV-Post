// ============================================================
// Multitool — утилиты для преобразования строк
// Порт логики Python-скрипта mlt.py (Multitool v1.4.0)
// ============================================================

/**
 * Парсит textarea → массив непустых строк (trim, без пустых).
 */
export function parseLines(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Функция 1: Обернуть каждую строку в одинарные кавычки.
 * Опционально — добавить запятую в конец каждой строки.
 */
export function toSingleQuotes(text: string, withComma: boolean = false): string {
  const lines = parseLines(text);
  return lines.map(line => withComma ? `'${line}',` : `'${line}'`).join('\n');
}

/**
 * Функция 2: Обернуть каждую строку в двойные кавычки.
 * Опционально — добавить запятую в конец каждой строки.
 */
export function toDoubleQuotes(text: string, withComma: boolean = false): string {
  const lines = parseLines(text);
  return lines.map(line => withComma ? `"${line}",` : `"${line}"`).join('\n');
}

/**
 * Функция 3: Добавить запятую в конец каждой строки.
 */
export function addCommas(text: string): string {
  const lines = parseLines(text);
  return lines.map(line => `${line},`).join('\n');
}

/**
 * Функция 4: Экранирование двойных кавычек.
 */
export function escapeDoubleQuotes(text: string): string {
  const lines = parseLines(text);
  return lines.map(line => line.replace(/"/g, '\\"')).join('\n');
}

/**
 * Функция 5: Workflow Query.
 */
export function buildWorkflowQuery(base: string, idsText: string): string {
  const baseTrimmed = (base || '').trim();
  const ids = parseLines(idsText);
  if (!baseTrimmed || ids.length === 0) return '';

  const idsStr = ids.map(id => `"${id}"`).join(', ');
  const query = `${baseTrimmed}?query=WorkflowId IN (${idsStr})`;

  const encoded = query
    .split('')
    .map(ch => {
      if (ch === '?' || ch === '=' || ch === '&') return ch;
      return encodeURIComponent(ch);
    })
    .join('');

  return encoded;
}

/**
 * Функция 6: Экранирование + обернуть в одинарные кавычки.
 */
export function escapeAndWrapSingle(text: string): string {
  const lines = parseLines(text);
  return lines.map(line => `'${line.replace(/'/g, "''")}'`).join('\n');
}

/**
 * Функция 7: Удалить дубликаты (с сохранением порядка первого появления).
 */
export interface DuplicatesResult {
  unique: string[];
  total: number;
  removed: number;
  duplicates: Array<{ value: string; count: number }>;
}

export function removeDuplicates(text: string): DuplicatesResult {
  const lines = parseLines(text);
  const total = lines.length;

  const seen = new Map<string, number>();
  const unique: string[] = [];

  for (const line of lines) {
    if (seen.has(line)) {
      seen.set(line, seen.get(line)! + 1);
    } else {
      seen.set(line, 1);
      unique.push(line);
    }
  }

  const duplicates: Array<{ value: string; count: number }> = [];
  seen.forEach((count, value) => {
    if (count > 1) duplicates.push({ value, count });
  });

  const removed = total - unique.length;

  return { unique, total, removed, duplicates };
}

export function formatDuplicatesResult(result: DuplicatesResult): string {
  return result.unique.join('\n');
}

// ============================================================
// Описания функций для UI
// ============================================================
export interface MultitoolFunction {
  id: string;
  title: string;
  description: string;
  /** ✅ Есть ли опция «Проставить запятые» */
  hasCommaOption?: boolean;
  /** Нужен ли дополнительный ввод (например, base для workflow query) */
  extraInput?: {
    label: string;
    placeholder: string;
  };
  inputPlaceholder: string;
  outputPlaceholder: string;
  /** Функция-обработчик. Второй параметр — доп. опции (comma для 1-2, extra для 5) */
  process: (input: string, opts?: { withComma?: boolean; extra?: string }) => string;
  postProcess?: (input: string, opts?: { withComma?: boolean; extra?: string }) => {
    info?: string;
    highlights?: Array<{ value: string; count: number }>;
    output: string;
  };
}

export const MULTITOOL_FUNCTIONS: MultitoolFunction[] = [
  {
    id: 'single-quotes',
    title: 'Одинарные кавычки',
    description: 'Оборачивает каждую строку в одинарные кавычки',
    hasCommaOption: true,
    inputPlaceholder: 'Вставьте строки (по одной на строку)...',
    outputPlaceholder: 'Результат',
    process: (input, opts) => toSingleQuotes(input, opts?.withComma || false),
  },
  {
    id: 'double-quotes',
    title: 'Двойные кавычки',
    description: 'Оборачивает каждую строку в двойные кавычки',
    hasCommaOption: true,
    inputPlaceholder: 'Вставьте строки (по одной на строку)...',
    outputPlaceholder: 'Результат',
    process: (input, opts) => toDoubleQuotes(input, opts?.withComma || false),
  },
  {
    id: 'commas',
    title: 'Проставить запятые',
    description: 'Добавляет запятую в конец каждой строки',
    inputPlaceholder: 'Вставьте строки (по одной на строку)...',
    outputPlaceholder: 'Результат',
    process: (input) => addCommas(input),
  },
  {
    id: 'escape-quotes',
    title: 'Экранирование кавычек',
    description: 'Заменяет " на \\"',
    inputPlaceholder: 'Вставьте строки (по одной на строку)...',
    outputPlaceholder: 'Результат',
    process: (input) => escapeDoubleQuotes(input),
  },
  {
    id: 'workflow-query',
    title: 'Workflow Query',
    description: 'Генерирует URL query для фильтрации workflow',
    inputPlaceholder: 'Вставьте ID (по одному на строку)...',
    outputPlaceholder: 'URL query',
    extraInput: {
      label: 'Базовое имя',
      placeholder: 'например, workflows',
    },
    process: (input, opts) => buildWorkflowQuery(opts?.extra || '', input),
  },
  {
    id: 'escape-wrap-single',
    title: 'Экранирование + обернуть',
    description: "Заменяет ' на '' и оборачивает в одинарные кавычки",
    inputPlaceholder: 'Вставьте строки (по одной на строку)...',
    outputPlaceholder: 'Результат',
    process: (input) => escapeAndWrapSingle(input),
  },
  {
    id: 'remove-duplicates',
    title: 'Удалить дубликаты',
    description: 'Убирает повторяющиеся строки, показывает статистику',
    inputPlaceholder: 'Вставьте строки (по одной на строку)...',
    outputPlaceholder: 'Уникальные строки',
    process: (input) => formatDuplicatesResult(removeDuplicates(input)),
    postProcess: (input) => {
      const result = removeDuplicates(input);
      const info = `Всего строк: ${result.total} · Уникальных: ${result.unique.length} · Удалено: ${result.removed}`;
      return {
        output: formatDuplicatesResult(result),
        info,
        highlights: result.duplicates,
      };
    },
  },
];