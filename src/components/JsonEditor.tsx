import { useRef, useEffect, useCallback, useState } from 'react';
import Editor, { OnMount, OnChange, BeforeMount } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';

// ============================================================
// ТИПЫ
// ============================================================
interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** JSON Schema для автодополнения (опционально) */
  schema?: object;
  /** Язык: 'json' (по умолчанию), 'graphql' */
  language?: 'json' | 'graphql';
  /** Только чтение (для просмотра) */
  readOnly?: boolean;
  /** Высота (CSS-значение) */
  height?: string;
}

// ============================================================
// КОМПОНЕНТ
// ============================================================
export const JsonEditor = ({
  value,
  onChange,
  placeholder,
  schema,
  language = 'json',
  readOnly = false,
  height = '100%',
}: JsonEditorProps) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const [isReady, setIsReady] = useState(false);

  // ============================================================
  // Настройка Monaco ДО монтирования
  // ============================================================
  const handleBeforeMount: BeforeMount = useCallback((monacoInstance) => {
    monacoRef.current = monacoInstance;

    // ===== Кастомная тема (тёмная, как SV-Post) =====
    monacoInstance.editor.defineTheme('sv-post-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'string.key.json', foreground: '9CDCFE' },
        { token: 'string.value.json', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'keyword.json', foreground: '569CD6' },
        { token: 'delimiter', foreground: 'D4D4D4' },
        { token: 'comment', foreground: '6A9955' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editorLineNumber.foreground': '#5A5A5A',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editor.lineHighlightBackground': '#2A2D2E',
        'editor.selectionBackground': '#264F78',
        'editorCursor.foreground': '#FFFFFF',
        'editorIndentGuide.background1': '#404040',
        'editorWidget.background': '#252526',
        'editorSuggestWidget.background': '#252526',
        'editorSuggestWidget.border': '#454545',
        'editorSuggestWidget.selectedBackground': '#094771',
        'editorSuggestWidget.highlightForeground': '#4FC1FF',
      },
    });

    // ===== JSON Schema для автодополнения =====
    if (language === 'json') {
      if (schema) {
        monacoInstance.languages.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          allowComments: false,
          schemas: [
            {
              uri: 'http://sv-post/schema.json',
              fileMatch: ['*'],
              schema: schema,
            },
          ],
          enableSchemaRequest: false,
        });
      } else {
        monacoInstance.languages.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          allowComments: false,
          schemas: [],
          enableSchemaRequest: false,
        });
      }
    }
  }, [language, schema]);

  // ============================================================
  // Настройка после монтирования
  // ============================================================
  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    setIsReady(true);

    // Горячая клавиша Ctrl+S — сохранить запрос
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 's',
          ctrlKey: true,
          bubbles: true,
        }));
      }
    );

    // Горячая клавиша Shift+Alt+F — форматирование
    editor.addCommand(
      monacoInstance.KeyMod.Shift | monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyF,
      () => {
        editor.getAction('editor.action.formatDocument')?.run();
      }
    );
  }, []);

  // ============================================================
  // Обработка изменения
  // ============================================================
  const handleChange: OnChange = useCallback((newValue) => {
    onChange(newValue ?? '');
  }, [onChange]);

  // ============================================================
  // Синхронизация внешнего value с редактором
  // (для Beautify и подобных внешних изменений)
  // ============================================================
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = editor.getValue();
    if (value !== currentValue) {
      const selection = editor.getSelection();
      const scrollTop = editor.getScrollTop();

      editor.setValue(value);

      if (selection) {
        editor.setSelection(selection);
      }
      editor.setScrollTop(scrollTop);
    }
  }, [value]);

  return (
    <div className="relative w-full h-full bg-[#1E1E1E] rounded-lg overflow-hidden border border-[rgba(255,255,255,0.08)]">
      <Editor
        height={height}
        defaultLanguage={language}
        value={value}
        onChange={handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        theme="sv-post-dark"
        options={{
          // === Основные ===
          readOnly,
          fontSize: 13,
          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
          fontLigatures: true,
          lineHeight: 20,
          tabSize: 2,
          insertSpaces: true,

          // === Внешний вид ===
          minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
          scrollBeyondLastLine: false,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          lineNumbers: 'on',
          lineNumbersMinChars: 3,
          glyphMargin: false,
          folding: true,
          renderLineHighlight: 'line',
          renderWhitespace: 'selection',
          wordWrap: 'off',

          // === Редактирование ===
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          autoIndent: 'full',
          formatOnPaste: true,
          formatOnType: false,
          wordBasedSuggestions: 'off',

          // === Автодополнение ===
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          snippetSuggestions: 'top',
          suggestSelection: 'first',

          // === Валидация ===
          renderValidationDecorations: 'on',

          // === UI ===
          contextmenu: true,
          mouseWheelZoom: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          padding: { top: 12, bottom: 12 },
          stickyScroll: { enabled: false },
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
        }}
        loading={
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <div className="w-5 h-5 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin mr-2" />
            Загрузка редактора...
          </div>
        }
      />

      {/* Placeholder, если value пустой */}
      {!value && placeholder && isReady && (
        <div className="absolute top-3 left-12 text-gray-600 font-mono text-sm pointer-events-none whitespace-pre-wrap">
          {placeholder}
        </div>
      )}

      {/* Индикатор языка в правом нижнем углу */}
      <div className="absolute bottom-1 right-3 px-2 py-0.5 bg-[#252525] border border-[rgba(255,255,255,0.08)] rounded text-[10px] text-gray-500 font-mono pointer-events-none">
        {language.toUpperCase()}
      </div>
    </div>
  );
};