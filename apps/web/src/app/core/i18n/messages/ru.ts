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
  'direction.pdfToDocx.description':
    'Редактируемый Word-документ — проверьте оформление после конвертации',

  'convert.back': 'На главную',
  'convert.pageTitle': 'Конвертация {from} в {to}',

  'dropzone.empty.titleDesktop': 'Перетащите файл сюда',
  'dropzone.empty.titleMobile': 'Выберите файл',
  'dropzone.empty.hint': '{format} до {limit}',
  'dropzone.dragover.title': 'Отпустите файл',
  'dropzone.selected.change': 'Выбрать другой файл',
  'dropzone.selected.start': 'Конвертировать',
  'dropzone.quotaFull.title': 'Ваше хранилище заполнено — файл сконвертируется, но не сохранится.',
  'dropzone.uploading.title': 'Загрузка…',
  'dropzone.uploading.cancel': 'Отмена',
  'dropzone.converting.title': 'Конвертируем…',
  'dropzone.done.download': 'Скачать',
  'dropzone.error.retry': 'Попробовать снова',

  'toast.dismiss': 'Закрыть уведомление',

  'error.invalidApiKey': 'Ключ API недействителен или отозван. Проверьте ключ или выпустите новый.',
  'error.emailNotVerified':
    'Подтвердите email, прежде чем продолжить — проверьте почту, там ссылка.',
  'error.fileTooLarge': 'Файл весит {actual}, лимит — {max}. Выберите файл меньшего размера.',
  'error.unsupportedFileType':
    'Этот тип файла не поддерживается для такой конвертации. Проверьте список форматов.',
  'error.fileTypeMismatch':
    'Содержимое файла не соответствует его имени. Выберите исходный, неизменённый файл.',
  'error.fileCorrupted': 'Файл повреждён и не открывается. Экспортируйте его заново из источника.',
  'error.filePasswordProtected': 'Файл защищён паролем. Снимите пароль и загрузите файл снова.',
  'error.imageTooLarge':
    'Разрешение изображения слишком велико для конвертации. Уменьшите размер и попробуйте снова.',
  'error.tooManyPages':
    'В этом PDF слишком много страниц для одной конвертации. Разделите его на части.',
  'error.invalidParameter':
    'Один из параметров запроса некорректен. Проверьте значение и попробуйте снова.',
  'error.rateLimitExceeded': 'Слишком много запросов. Попробуйте через минуту.',
  'error.conversionFailed':
    'Конвертация неожиданно завершилась ошибкой. Попробуйте снова — если повторится, напишите в поддержку.',
  'error.serviceOverloaded':
    'Сервис конвертации сейчас перегружен. Попробуйте через несколько минут.',
  'error.storageUnavailable': 'Хранилище временно недоступно. Попробуйте немного позже.',
  'error.conversionTimeout':
    'Конвертация заняла слишком много времени и была остановлена. Попробуйте с файлом поменьше.',
};
