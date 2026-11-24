import { KeyValuePair } from '../types';
import { generateId } from './helpers';

/**
 * Парсит строку вида "a=1&b=2&a=3" или "a=1\nb=2" в массив KeyValuePair.
 * - Поддерживает URL-encoded значения (%20, +, кириллица)
 * - Поддерживает разделение как через '&', так и через перенос строки
 * - Сохраняет дубликаты ключей (как Postman)
 * - Пустые сегменты игнорируются
 */
export function parseUrlencoded(text: string): KeyValuePair[] {
  if (!text || !text.trim()) return [];

  let normalized = text;

  // Если в тексте нет '&', но есть переносы строк — 
  // значит пользователь вставил данные "построчно". Заменяем переносы на '&'.
  if (!text.includes('&') && text.includes('\n')) {
    normalized = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('&');
  }

  return normalized
    .split('&')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=');
      const rawKey = eq >= 0 ? part.slice(0, eq) : part;
      const rawValue = eq >= 0 ? part.slice(eq + 1) : '';
      return {
        id: generateId(),
        key: safeDecode(rawKey),
        value: safeDecode(rawValue),
        enabled: true,
      };
    });
}

/**
 * Сериализует массив KeyValuePair в "a=1&b=2".
 * Поведение как у URLSearchParams (RFC 1866):
 *   - пробел → '+'
 *   - спецсимволы → %XX (UTF-8)
 *   - неактивные строки и пустые ключи пропускаются
 */
export function serializeUrlencoded(rows: KeyValuePair[]): string {
  const params = new URLSearchParams();
  rows.forEach((r) => {
    if (r.enabled && r.key) {
      params.append(r.key, r.value);
    }
  });
  return params.toString();
}

/**
 * Эвристика: похоже ли содержимое на "a=1&b=2".
 * Нужна для авто-детекта при переключении body.type.
 */
export function looksLikeUrlencoded(text: string): boolean {
  if (!text || !text.trim()) return false;
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) return false;
  // Если есть '=' и нет начала JSON — считаем, что это urlencoded
  return /^[^=&\s]+=/.test(t);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}