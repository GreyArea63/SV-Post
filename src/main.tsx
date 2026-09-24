import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Импортируем типы для Electron (должен быть создан файл src/types/electron.d.ts)


// ============================================================
// ПРОВЕРКА ОКРУЖЕНИЯ
// ============================================================

// Определяем, запущено ли приложение в Electron
// Используем optional chaining (?) для безопасного доступа
const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

if (isElectron) {
  console.log('🚀 SV-Post запущен в Electron');
  
  // Получаем версию приложения из Electron
  window.electronAPI?.getAppVersion().then(version => {
    console.log('📦 Версия приложения:', version);
  }).catch(err => {
    console.error('❌ Ошибка получения версии:', err);
  });
  
  // Получаем платформу
  window.electronAPI?.getPlatform().then(platform => {
    console.log('💻 Платформа:', platform);
  }).catch(err => {
    console.error('❌ Ошибка получения платформы:', err);
  });
} else {
  console.log(' SV-Post запущен в браузере');
}

// ============================================================
// РЕНДЕРИНГ ПРИЛОЖЕНИЯ
// ============================================================

// Находим корневой элемент
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Корневой элемент #root не найден в DOM');
}

// Создаём React root и рендерим приложение
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ============================================================
// ОБРАБОТКА ОШИБОК
// ============================================================

// Перехватываем глобальные ошибки
window.addEventListener('error', (event) => {
  console.error('❌ Глобальная ошибка:', event.error);
});

// Перехватываем необработанные промисы
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Необработанный промис:', event.reason);
});

// Логирование при закрытии страницы (для отладки)
window.addEventListener('beforeunload', () => {
  console.log('👋 Приложение закрывается');
});