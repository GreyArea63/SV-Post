/// <reference types="vite/client" />

// Разрешаем импортировать CSS файлы
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// Разрешаем импортировать CSS как строки
declare module '*.css?inline' {
  const content: string;
  export default content;
}

// Для импорта изображений
declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}