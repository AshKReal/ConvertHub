/**
 * Английский словарь — источник правды: набор ключей задаётся здесь,
 * остальные локали типизированы как `Record<MessageKey, string>`,
 * поэтому забытый перевод не компилируется.
 *
 * Плейсхолдеры — `{name}`, подставляются вторым аргументом `I18nService.t()`.
 */
export const EN_MESSAGES = {
  'app.title': 'ConvertHub — file conversion',
  'app.brand.homeLink': 'ConvertHub, home',

  'layout.theme.toDark': 'Switch to dark theme',
  'layout.theme.toLight': 'Switch to light theme',
  'layout.language.group': 'Interface language',
  'layout.language.en': 'English',
  'layout.language.ru': 'Русский',
  'layout.language.uk': 'Українська',

  'home.title': 'Convert files in seconds',
  'home.subtitle': 'JPG, PNG, DOCX and PDF — drop a file, pick the format, take the result.',
  'home.cta': 'Convert JPG → PNG',
  'home.directions.heading': 'Pick a direction',

  'direction.open': 'Open {from} → {to}',
  'direction.jpgToPng.description': 'Transparent background, no quality loss',
  'direction.pngToJpg.description': 'Smaller file, adjustable quality',
  'direction.docxToPdf.description': 'Ready to print and send, layout preserved',
  'direction.pdfToJpg.description': 'Page by page, with a choice of resolution',

  'convert.back': 'Back to home',
  'convert.pageTitle': 'Convert {from} to {to}',

  'dropzone.empty.titleDesktop': 'Drop your file here',
  'dropzone.empty.titleMobile': 'Choose a file',
  'dropzone.empty.hint': '{format} up to {limit}',
  'dropzone.dragover.title': 'Release to drop the file',
  'dropzone.selected.change': 'Choose another file',
} as const;

export type MessageKey = keyof typeof EN_MESSAGES;
