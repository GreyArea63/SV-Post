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
 * Функция 1: Обернуть каждую строку в одинарные кавычки (построчно).
 * Пример:
 *   abc → 'abc'
 *   def → 'def'
 */
export function toSingleQuotes(text: string): string {
  const lines = parseLines(text);
  return lines.map(line => `'${line}'`).join('\n');
}

/**
 * Функция 2: Обернуть каждую строку в двойные кавычки (построчно).
 * Пример:
 *   abc → "abc"
 *   def → "def"
 */
export function toDoubleQuotes(text: string): string {
  const lines = parseLines(text);
  return lines.map(line => `"${line}"`).join('\n');
}

/**
 * Функция 3: Добавить запятую в конец каждой строки.
 * Пример:
 *   abc → abc,
 *   def → def,
 */
export function addCommas(text: string): string {
  const lines = parseLines(text);
  return lines.map(line => `${line},`).join('\n');
}

/**
 * Функция 4: Экранирование двойных кавычек.
 * Замена " → \"
 * Пример:
 *   a"b → a\"b
 */
export function escapeDoubleQuotes(text: string): string {
  const lines = parseLines(text);
  return lines.map(line => line.replace(/"/g, '\\"')).join('\n');
}

/**
 * Функция 5: Workflow Query.
 * Формат: {base}?query=WorkflowId IN ("id1", "id2", ...)
 * Результат URL-кодируется.
 * Пример:
 *   base = workflows
 *   ids = [aaa, bbb]
 *   → workflows?query=WorkflowId%20IN%20%28%22aaa%22%2C%20%22bbb%22%29
 */
export function buildWorkflowQuery(base: string, idsText: string): string {
  const baseTrimmed = (base || '').trim();
  const ids = parseLines(idsText);
  if (!baseTrimmed || ids.length === 0) return '';

  const idsStr = ids.map(id => `"${id}"`).join(', ');
  const query = `${baseTrimmed}?query=WorkflowId IN (${idsStr})`;

  // URL-кодирование с сохранением ?=&
  // Вручную через encodeURIComponent, потому что urlencode с safe='?=&' в JS нет из коробки
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
 * Внутри строки: ' → ''
 * Снаружи: обернуть в '
 * Пример:
 *   a'b → 'a''b'
 */
export function escapeAndWrapSingle(text: string): string {
  const lines = parseLines(text);
  return lines.map(line => `'${line.replace(/'/g, "''")}'`).join('\n');
}

/**
 * Функция 7: Удалить дубликаты (с сохранением порядка первого появления).
 * Возвращает уникальные строки + статистику.
 */
export interface DuplicatesResult {
  /** Уникальные строки (первое появление) */
  unique: string[];
  /** Общее количество строк во вводе */
  total: number;
  /** Сколько дубликатов удалено */
  removed: number;
  /** Какие строки были дубликатами и сколько раз встречались */
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

/**
 * Форматирует результат removeDuplicates для отображения в textarea.
 */
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
  /** Нужен ли дополнительный ввод (например, base для workflow query) */
  extraInput?: {
    label: string;
    placeholder: string;
  };
  /** Основной placeholder для textarea ввода */
  inputPlaceholder: string;
  /** Placeholder для результата */
  outputPlaceholder: string;
  /** Функция-обработчик */
  process: (input: string, extra?: string) => string;
  /** Дополнительная информация после обработки (опционально) */
  postProcess?: (input: string, extra?: string) => {
    /** Строка с информацией, если есть */
    info?: string;
    /** Строки для подсветки (удалённые дубликаты) */
    highlights?: Array<{ value: string; count: number }>;
    /** Уникальные строки (для вставки в output) */
    output: string;
  };
}

export const MULTITOOL_FUNCTIONS: MultitoolFunction[] = [
  {
    id: 'single-quotes',
    title: 'Одинарные кавычки',
    description: 'Оборачивает каждую строку в одинарные кавычки',
    inputPlaceholder: 'Вставьте строки (по одной на строку)...',
    outputPlaceholder: 'Результат',
    process: (input) => toSingleQuotes(input),
  },
  {
    id: 'double-quotes',
    title: 'Двойные кавычки',
    description: 'Оборачивает каждую строку в двойные кавычки',
    inputPlaceholder: 'Вставьте строки (по одной на строку)...',
    outputPlaceholder: 'Результат',
    process: (input) => toDoubleQuotes(input),
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
    process: (input, extra) => buildWorkflowQuery(extra || '', input),
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