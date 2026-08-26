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
  'layout.auth.login': 'Увійти',
  'layout.auth.logout': 'Вийти',
  'layout.auth.profileLink': 'Відкрити профіль',

  'home.title': 'Конвертуйте файли за секунди',
  'home.subtitle': 'JPG, PNG, DOCX і PDF — перетягніть файл, виберіть формат, заберіть результат.',
  'home.cta': 'Конвертувати JPG → PNG',
  'home.directions.heading': 'Виберіть напрямок',

  'direction.open': 'Відкрити {from} → {to}',
  'direction.jpgToPng.description': 'Прозорий фон, без втрати якості',
  'direction.pngToJpg.description': 'Менший розмір файлу, налаштовувана якість',
  'direction.docxToPdf.description': 'Готово до друку та надсилання, верстку збережено',
  'direction.pdfToDocx.description':
    'Редагований Word-документ — перевірте оформлення після конвертації',

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

  'auth.email': 'Email',
  'auth.password': 'Пароль',
  'auth.or': 'або',
  'auth.login.title': 'Вхід',
  'auth.login.submit': 'Увійти',
  'auth.login.error': 'Невірний email або пароль',
  'auth.login.noAccount': 'Немає акаунта?',
  'auth.login.registerLink': 'Зареєструватися',
  'auth.login.forgotPassword': 'Забули пароль?',
  'auth.register.title': 'Реєстрація',
  'auth.register.submit': 'Створити акаунт',
  'auth.register.hasAccount': 'Вже є акаунт?',
  'auth.register.loginLink': 'Увійти',
  'auth.error.emailRequired': 'Введіть email',
  'auth.error.emailInvalid': 'Введіть коректний email',
  'auth.error.passwordRequired': 'Введіть пароль',
  'auth.error.passwordTooShort': 'Пароль має бути не коротшим за {min} символів',
  'auth.oauth.google': 'Увійти через Google',
  'auth.oauth.telegram': 'Увійти через Telegram',
  'auth.forgotPassword.title': 'Відновлення пароля',
  'auth.forgotPassword.hint':
    'Введіть email, вказаний під час реєстрації — надішлемо посилання для скидання пароля.',
  'auth.forgotPassword.submit': 'Надіслати посилання',
  'auth.forgotPassword.sentTitle': 'Перевірте пошту',
  'auth.forgotPassword.sentMessage':
    'Якщо акаунт із такою поштою існує, ми надіслали на нього посилання для скидання пароля.',
  'auth.forgotPassword.backToLogin': 'Повернутися до входу',
  'auth.resetPassword.title': 'Новий пароль',
  'auth.resetPassword.newPassword': 'Новий пароль',
  'auth.resetPassword.confirmPassword': 'Підтвердіть пароль',
  'auth.resetPassword.submit': 'Скинути пароль',
  'auth.resetPassword.mismatch': 'Паролі не збігаються',
  'auth.resetPassword.successTitle': 'Пароль оновлено',
  'auth.resetPassword.successMessage': 'Тепер ви можете увійти з новим паролем.',

  'profile.title': 'Профіль',
  'profile.changePassword.title': 'Зміна пароля',
  'profile.changePassword.currentPassword': 'Поточний пароль',
  'profile.changePassword.submit': 'Змінити пароль',
  'profile.changePassword.success': 'Пароль змінено, увійдіть знову',
  'profile.providers.title': 'Способи входу',
  'profile.providers.password': 'Пароль',
  'profile.providers.google': 'Google',
  'profile.providers.telegram': 'Telegram',
  'profile.providers.connected': 'Підключено',
  'profile.providers.notConnected': 'Не підключено',
  'profile.deleteAccount.title': 'Видалення акаунта',
  'profile.deleteAccount.description':
    'Це незворотно. Вас буде розлогінено і ви одразу втратите доступ.',
  'profile.deleteAccount.action': 'Видалити акаунт',
  'profile.deleteAccount.confirmTitle': 'Видалити акаунт?',
  'profile.deleteAccount.confirmMessage':
    'Це незворотно. Вас буде розлогінено і ви одразу втратите доступ.',
  'profile.deleteAccount.confirmAction': 'Видалити акаунт',
  'profile.deleteAccount.cancel': 'Скасувати',

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
