import type { MessageKey } from './en';

export const UK_MESSAGES: Record<MessageKey, string> = {
  'app.title': 'ConvertHub — конвертація файлів',
  'app.brand.homeLink': 'ConvertHub, на головну',

  'layout.theme.toDark': 'Увімкнути темну тему',
  'layout.theme.toLight': 'Увімкнути світлу тему',
  'layout.language.group': 'Мова інтерфейсу',
  'layout.language.en': 'English',
  'layout.language.ru': 'Русский',
  'layout.language.uk': 'Українська',

  'home.title': 'Конвертуйте файли за секунди',
  'home.subtitle': 'JPG, PNG, DOCX і PDF — перетягніть файл, виберіть формат, заберіть результат.',
  'home.cta': 'Конвертувати JPG → PNG',
  'home.directions.heading': 'Виберіть напрямок',

  'direction.open': 'Відкрити {from} → {to}',
  'direction.jpgToPng.description': 'Прозорий фон, без втрати якості',
  'direction.pngToJpg.description': 'Менший розмір файлу, налаштовувана якість',
  'direction.docxToPdf.description': 'Готово до друку та надсилання, верстку збережено',
  'direction.pdfToJpg.description': 'Посторінково, з вибором роздільної здатності',

  'convert.back': 'На головну',
  'convert.pageTitle': 'Конвертація {from} у {to}',

  'dropzone.empty.titleDesktop': 'Перетягніть файл сюди',
  'dropzone.empty.titleMobile': 'Виберіть файл',
  'dropzone.empty.hint': '{format} до {limit}',
  'dropzone.dragover.title': 'Відпустіть файл',
  'dropzone.selected.change': 'Вибрати інший файл',
};
