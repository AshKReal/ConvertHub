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
  'layout.auth.login': 'Войти',
  'layout.auth.logout': 'Выйти',
  'layout.auth.profileLink': 'Открыть профиль',
  'layout.nav.files': 'Мои файлы',

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

  'auth.email': 'Email',
  'auth.password': 'Пароль',
  'auth.or': 'или',
  'auth.login.title': 'Вход',
  'auth.login.submit': 'Войти',
  'auth.login.error': 'Неверный email или пароль',
  'auth.login.noAccount': 'Нет аккаунта?',
  'auth.login.registerLink': 'Зарегистрироваться',
  'auth.login.forgotPassword': 'Забыли пароль?',
  'auth.register.title': 'Регистрация',
  'auth.register.submit': 'Создать аккаунт',
  'auth.register.hasAccount': 'Уже есть аккаунт?',
  'auth.register.loginLink': 'Войти',
  'auth.error.emailRequired': 'Введите email',
  'auth.error.emailInvalid': 'Введите корректный email',
  'auth.error.passwordRequired': 'Введите пароль',
  'auth.error.passwordTooShort': 'Пароль должен быть не короче {min} символов',
  'auth.oauth.google': 'Войти через Google',
  'auth.oauth.telegram': 'Войти через Telegram',
  'auth.forgotPassword.title': 'Восстановление пароля',
  'auth.forgotPassword.hint':
    'Введите email, указанный при регистрации, — пришлём ссылку для сброса пароля.',
  'auth.forgotPassword.submit': 'Отправить ссылку',
  'auth.forgotPassword.sentTitle': 'Проверьте почту',
  'auth.forgotPassword.sentMessage':
    'Если аккаунт с таким email существует, мы отправили на него ссылку для сброса пароля.',
  'auth.forgotPassword.backToLogin': 'Вернуться ко входу',
  'auth.resetPassword.title': 'Новый пароль',
  'auth.resetPassword.newPassword': 'Новый пароль',
  'auth.resetPassword.confirmPassword': 'Подтвердите пароль',
  'auth.resetPassword.submit': 'Сбросить пароль',
  'auth.resetPassword.mismatch': 'Пароли не совпадают',
  'auth.resetPassword.successTitle': 'Пароль обновлён',
  'auth.resetPassword.successMessage': 'Теперь вы можете войти с новым паролем.',

  'profile.title': 'Профиль',
  'profile.changePassword.title': 'Смена пароля',
  'profile.changePassword.currentPassword': 'Текущий пароль',
  'profile.changePassword.submit': 'Сменить пароль',
  'profile.changePassword.success': 'Пароль изменён, войдите заново',
  'profile.providers.title': 'Способы входа',
  'profile.providers.password': 'Пароль',
  'profile.providers.google': 'Google',
  'profile.providers.telegram': 'Telegram',
  'profile.providers.connected': 'Подключён',
  'profile.providers.notConnected': 'Не подключён',
  'profile.deleteAccount.title': 'Удаление аккаунта',
  'profile.deleteAccount.description':
    'Это необратимо. Вы будете разлогинены и сразу потеряете доступ.',
  'profile.deleteAccount.action': 'Удалить аккаунт',
  'profile.deleteAccount.confirmTitle': 'Удалить аккаунт?',
  'profile.deleteAccount.confirmMessage':
    'Это необратимо. Вы будете разлогинены и сразу потеряете доступ.',
  'profile.deleteAccount.confirmAction': 'Удалить аккаунт',
  'profile.deleteAccount.cancel': 'Отмена',

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

  'files.title': 'Мои файлы',
  'files.quota.label': '{used} из {total}',
  'files.empty.title': 'Файлов пока нет',
  'files.empty.hint': 'Сконвертируйте файл и включите «Сохранить», чтобы он появился здесь.',
  'files.loadMore.action': 'Показать ещё',
  'files.loadMore.loading': 'Загрузка…',
  'files.badge.saved': 'Сохранён',
  'files.badge.temporary': 'Временный',
  'files.save.toggle': 'Сохранять этот файл',
};
