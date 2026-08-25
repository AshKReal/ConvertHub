import type { MessageKey } from './en';

export const RU_MESSAGES: Record<MessageKey, string> = {
  'app.title': 'ConvertHub — конвертация файлов',
  'app.brand.homeLink': 'ConvertHub, на главную',

  'layout.theme.toDark': 'Включить тёмную тему',
  'layout.theme.toLight': 'Включить светлую тему',
  'layout.language.group': 'Язык интерфейса',
  'layout.language.en': 'English',
  'layout.language.ru': 'Русский',
  'layout.language.uk': 'Українська',

  'home.title': 'Конвертируйте файлы за секунды',
  'home.subtitle': 'JPG, PNG, DOCX и PDF — перетащите файл, выберите формат, заберите результат.',
  'home.cta': 'Конвертировать JPG → PNG',
  'home.directions.heading': 'Выберите направление',

  'direction.open': 'Открыть {from} → {to}',
  'direction.jpgToPng.description': 'Прозрачный фон, без потери качества',
  'direction.pngToJpg.description': 'Меньше размер файла, настраиваемое качество',
  'direction.docxToPdf.description': 'Готово к печати и отправке, вёрстка сохранена',
  'direction.pdfToJpg.description': 'Постранично, с выбором разрешения',

  'convert.back': 'На главную',
  'convert.pageTitle': 'Конвертация {from} в {to}',

  'dropzone.empty.titleDesktop': 'Перетащите файл сюда',
  'dropzone.empty.titleMobile': 'Выберите файл',
  'dropzone.empty.hint': '{format} до {limit}',
  'dropzone.dragover.title': 'Отпустите файл',
  'dropzone.selected.change': 'Выбрать другой файл',
};
