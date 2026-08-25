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
  'dropzone.selected.start': 'Конвертувати',
  'dropzone.quotaFull.title': 'Ваше сховище заповнене — файл сконвертується, але не збережеться.',
  'dropzone.uploading.title': 'Завантаження…',
  'dropzone.uploading.cancel': 'Скасувати',
  'dropzone.converting.title': 'Конвертуємо…',
  'dropzone.done.download': 'Завантажити',
  'dropzone.error.retry': 'Спробувати ще раз',

  'toast.dismiss': 'Закрити сповіщення',

  'error.invalidApiKey': 'Ключ API недійсний або відкликаний. Перевірте ключ або випустіть новий.',
  'error.emailNotVerified':
    'Підтвердьте email, перш ніж продовжити — перевірте пошту, там посилання.',
  'error.fileTooLarge': 'Файл важить {actual}, ліміт — {max}. Виберіть файл меншого розміру.',
  'error.unsupportedFileType':
    'Цей тип файлу не підтримується для такої конвертації. Перевірте список форматів.',
  'error.fileTypeMismatch':
    'Вміст файлу не відповідає його імені. Виберіть початковий, незмінений файл.',
  'error.fileCorrupted': 'Файл пошкоджений і не відкривається. Експортуйте його знову з джерела.',
  'error.filePasswordProtected': 'Файл захищений паролем. Зніміть пароль і завантажте файл ще раз.',
  'error.imageTooLarge':
    'Роздільна здатність зображення завелика для конвертації. Зменшіть розмір і спробуйте ще раз.',
  'error.tooManyPages':
    'У цьому PDF забагато сторінок для однієї конвертації. Розділіть його на частини.',
  'error.invalidParameter':
    'Один із параметрів запиту некоректний. Перевірте значення і спробуйте ще раз.',
  'error.rateLimitExceeded': 'Забагато запитів. Спробуйте за хвилину.',
  'error.conversionFailed':
    'Конвертація несподівано завершилася помилкою. Спробуйте ще раз — якщо повториться, напишіть у підтримку.',
  'error.serviceOverloaded': 'Сервіс конвертації зараз перевантажений. Спробуйте за кілька хвилин.',
  'error.storageUnavailable': 'Сховище тимчасово недоступне. Спробуйте трохи пізніше.',
  'error.conversionTimeout':
    'Конвертація тривала задовго і була зупинена. Спробуйте з меншим файлом.',
};
