/**
 * Парсер CSV с поддержкой:
 * - Кавычек внутри полей ("Smith, John")
 * - Экранированных кавычек ("He said ""Hello""")
 * - Переносов строк внутри кавычек
 * - BOM в начале UTF-8 файла
 * - Автоопределение разделителя (запятая, точка с запятой, табуляция)
 * 
 * ИСПРАВЛЕНИЕ 2.28: замена простого split(',') на конечный автомат
 */

export const parseCSV = (text: string): Record<string, string>[] => {
  if (!text || !text.trim()) return [];

  // Удаляем BOM, если он есть (частая проблема UTF-8 CSV)
  let content = text;
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  // Автоопределение разделителя по первой строке
  const firstLine = content.split('\n')[0];
  const separator = detectSeparator(firstLine);

  const rows = parseRows(content, separator);
  if (rows.length === 0) return [];

  // Первая строка — заголовки
  const headers = rows[0].map(h => h.trim());
  const result: Record<string, string>[] = [];

  // Остальные строки — данные
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Пропускаем полностью пустые строки
    if (row.length === 1 && row[0].trim() === '') continue;

    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) {
        record[header] = row[index] !== undefined ? row[index].trim() : '';
      }
    });
    result.push(record);
  }

  return result;
};

/**
 * Автоопределение разделителя по первой строке
 */
const detectSeparator = (line: string): string => {
  const separators = [',', ';', '\t', '|'];
  let bestSeparator = ',';
  let maxCount = 0;

  for (const sep of separators) {
    // Считаем количество разделителей вне кавычек
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === sep && !inQuotes) {
        count++;
      }
    }
    if (count > maxCount) {
      maxCount = count;
      bestSeparator = sep;
    }
  }

  return bestSeparator;
};

/**
 * Парсинг строк CSV с помощью конечного автомата
 * Корректно обрабатывает:
 * - Кавычки внутри полей
 * - Экранированные кавычки ""
 * - Переносы строк внутри кавычек
 */
const parseRows = (content: string, separator: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"') {
        // Экранированная кавычка ""
        if (nextChar === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Закрывающая кавычка
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        // Любой символ внутри кавычек (включая разделители и переносы строк)
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        // Открывающая кавычка
        inQuotes = true;
        i++;
        continue;
      }

      if (char === separator) {
        // Разделитель полей
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      }

      if (char === '\n' || char === '\r') {
        // Конец строки
        // Обработка \r\n
        if (char === '\r' && nextChar === '\n') {
          i += 2;
        } else {
          i++;
        }
        currentRow.push(currentField);
        currentField = '';
        
        // Добавляем строку, если она не пустая
        if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        continue;
      }

      // Обычный символ
      currentField += char;
      i++;
    }
  }

  // Добавляем последнее поле и строку
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
};

/**
 * Обратная операция: сериализация массива объектов в CSV
 * Используется для экспорта данных
 */
export const serializeToCSV = (data: Record<string, string>[]): string => {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const escapeField = (field: string): string => {
    // Если поле содержит разделитель, кавычку или перенос строки — оборачиваем в кавычки
    if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  };

  const lines: string[] = [];
  
  // Заголовки
  lines.push(headers.map(escapeField).join(','));
  
  // Данные
  data.forEach(row => {
    const values = headers.map(h => escapeField(row[h] || ''));
    lines.push(values.join(','));
  });

  return lines.join('\n');
};