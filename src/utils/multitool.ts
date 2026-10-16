// ============================================================
// Multitool — комбинируемые операции над строками
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
 * Опции обработки (чекбоксы в UI).
 */
export interface MultitoolOptions {
  /** Удалить дубликаты (с сохранением порядка) */
  removeDuplicates: boolean;
  /** Экранирование одинарных кавычек: ' → '' */
  escapeSingle: boolean;
  /** Экранирование двойных кавычек: " → \" */
  escapeDouble: boolean;
  /** Оборачивание в кавычки */
  wrapQuotes: 'none' | 'single' | 'double';
  /** Проставить запятые в конце строк */
  addCommas: boolean;
  /** Режим Workflow Query (блокирует остальные опции) */
  workflowQuery: boolean;
  /** Базовое имя для Workflow Query */
  workflowBase: string;
}

export const DEFAULT_OPTIONS: MultitoolOptions = {
  removeDuplicates: false,
  escapeSingle: false,
  escapeDouble: false,
  wrapQuotes: 'none',
  addCommas: false,
  workflowQuery: false,
  workflowBase: '',
};

/**
 * Статистика по удалённым дубликатам.
 */
export interface DuplicatesInfo {
  total: number;
  unique: number;
  removed: number;
  duplicates: Array<{ value: string; count: number }>;
}

/**
 * Результат обработки.
 */
export interface MultitoolResult {
  output: string;
  /** Статистика (если включено удаление дубликатов) */
  duplicates?: DuplicatesInfo;
  /** Сообщение об ошибке */
  error?: string;
}

/**
 * Применяет выбранные операции к списку строк в фиксированном порядке:
 *  1. Удалить дубликаты
 *  2. Экранирование '
 *  3. Экранирование "
 *  4. Обернуть в кавычки (single / double / none)
 *  5. Проставить запятые
 */
export function processLines(lines: string[], options: MultitoolOptions): MultitoolResult {
  let workingLines = [...lines];
  let duplicatesInfo: DuplicatesInfo | undefined;

  // 1. Удалить дубликаты
  if (options.removeDuplicates) {
    const total = workingLines.length;
    const seen = new Map<string, number>();
    const unique: string[] = [];

    for (const line of workingLines) {
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

    duplicatesInfo = {
      total,
      unique: unique.length,
      removed: total - unique.length,
      duplicates,
    };

    workingLines = unique;
  }

  // 2. Экранирование одинарных кавычек: ' → ''
  if (options.escapeSingle) {
    workingLines = workingLines.map(line => line.replace(/'/g, "''"));
  }

  // 3. Экранирование двойных кавычек: " → \"
  if (options.escapeDouble) {
    workingLines = workingLines.map(line => line.replace(/"/g, '\\"'));
  }

  // 4. Обернуть в кавычки
  if (options.wrapQuotes === 'single') {
    workingLines = workingLines.map(line => `'${line}'`);
  } else if (options.wrapQuotes === 'double') {
    workingLines = workingLines.map(line => `"${line}"`);
  }

  // 5. Проставить запятые
  if (options.addCommas) {
    workingLines = workingLines.map(line => `${line},`);
  }

  return {
    output: workingLines.join('\n'),
    duplicates: duplicatesInfo,
  };
}

/**
 * Генерирует URL query для фильтрации workflow.
 * Формат: {base}?query=WorkflowId IN ("id1", "id2", ...)
 * Результат URL-кодируется (сохраняя ? = &).
 */
export function buildWorkflowQuery(base: string, idsText: string): MultitoolResult {
  const baseTrimmed = (base || '').trim();
  if (!baseTrimmed) {
    return { output: '', error: 'Укажите базовое имя' };
  }

  const ids = parseLines(idsText);
  if (ids.length === 0) {
    return { output: '', error: 'Введите хотя бы один ID' };
  }

  const idsStr = ids.map(id => `"${id}"`).join(', ');
  const query = `${baseTrimmed}?query=WorkflowId IN (${idsStr})`;

  // URL-кодирование с сохранением ? = &
  const encoded = query
    .split('')
    .map(ch => {
      if (ch === '?' || ch === '=' || ch === '&') return ch;
      return encodeURIComponent(ch);
    })
    .join('');

  return { output: encoded };
}

/**
 * Есть ли хотя бы одна активная операция (для валидации кнопки).
 */
export function hasAnyOperation(options: MultitoolOptions): boolean {
  if (options.workflowQuery) return true;
  return (
    options.removeDuplicates ||
    options.escapeSingle ||
    options.escapeDouble ||
    options.wrapQuotes !== 'none' ||
    options.addCommas
  );
}

/**
 * Главная функция — обрабатывает ввод в соответствии с опциями.
 */
export function processInput(input: string, options: MultitoolOptions): MultitoolResult {
  if (options.workflowQuery) {
    return buildWorkflowQuery(options.workflowBase, input);
  }

  const lines = parseLines(input);
  if (lines.length === 0) {
    return { output: '' };
  }

  return processLines(lines, options);
}