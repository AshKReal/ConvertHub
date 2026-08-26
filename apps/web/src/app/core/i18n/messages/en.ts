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
  'layout.auth.login': 'Log in',
  'layout.auth.logout': 'Log out',

  'home.title': 'Convert files in seconds',
  'home.subtitle': 'JPG, PNG, DOCX and PDF — drop a file, pick the format, take the result.',
  'home.cta': 'Convert JPG → PNG',
  'home.directions.heading': 'Pick a direction',

  'direction.open': 'Open {from} → {to}',
  'direction.jpgToPng.description': 'Transparent background, no quality loss',
  'direction.pngToJpg.description': 'Smaller file, adjustable quality',
  'direction.docxToPdf.description': 'Ready to print and send, layout preserved',
  'direction.pdfToDocx.description': 'Editable Word document — check formatting after conversion',

  'convert.back': 'Back to home',
  'convert.pageTitle': 'Convert {from} to {to}',

  'dropzone.empty.titleDesktop': 'Drop your file here',
  'dropzone.empty.titleMobile': 'Choose a file',
  'dropzone.empty.hint': '{format} up to {limit}',
  'dropzone.dragover.title': 'Release to drop the file',
  'dropzone.selected.change': 'Choose another file',
  'dropzone.selected.start': 'Convert',
  'dropzone.quotaFull.title': "Your storage is full — this file will convert but won't be saved.",
  'dropzone.uploading.title': 'Uploading…',
  'dropzone.uploading.cancel': 'Cancel',
  'dropzone.converting.title': 'Converting…',
  'dropzone.done.download': 'Download',
  'dropzone.error.retry': 'Try again',

  'toast.dismiss': 'Close notification',

  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.or': 'or',
  'auth.login.title': 'Log in',
  'auth.login.submit': 'Log in',
  'auth.login.error': 'Invalid email or password',
  'auth.login.noAccount': "Don't have an account?",
  'auth.login.registerLink': 'Sign up',
  'auth.login.forgotPassword': 'Forgot password?',
  'auth.register.title': 'Create an account',
  'auth.register.submit': 'Create account',
  'auth.register.hasAccount': 'Already have an account?',
  'auth.register.loginLink': 'Log in',
  'auth.error.emailRequired': 'Enter your email',
  'auth.error.emailInvalid': 'Enter a valid email',
  'auth.error.passwordRequired': 'Enter your password',
  'auth.error.passwordTooShort': 'Password must be at least {min} characters',
  'auth.oauth.google': 'Continue with Google',
  'auth.oauth.telegram': 'Continue with Telegram',
  'auth.forgotPassword.title': 'Reset your password',
  'auth.forgotPassword.hint': "Enter the email you signed up with and we'll send a reset link.",
  'auth.forgotPassword.submit': 'Send reset link',
  'auth.forgotPassword.sentTitle': 'Check your email',
  'auth.forgotPassword.sentMessage':
    "If an account exists for that email, we've sent a link to reset the password.",
  'auth.forgotPassword.backToLogin': 'Back to log in',

  'error.invalidApiKey': 'Invalid or revoked API key. Check the key or issue a new one.',
  'error.emailNotVerified': 'Confirm your email before continuing — check your inbox for the link.',
  'error.fileTooLarge': 'File is {actual}, the limit is {max}. Choose a smaller file.',
  'error.unsupportedFileType':
    "This file type isn't supported for this conversion. Check the accepted formats.",
  'error.fileTypeMismatch':
    "The file's content doesn't match its name. Choose the original, unmodified file.",
  'error.fileCorrupted':
    "This file is corrupted and can't be opened. Re-export it from the source.",
  'error.filePasswordProtected':
    'This file is password-protected. Remove the password and upload it again.',
  'error.imageTooLarge': "This image's resolution is too high to convert. Resize it and try again.",
  'error.tooManyPages':
    'This PDF has too many pages to convert at once. Split it into smaller files.',
  'error.invalidParameter':
    'One of the request parameters is invalid. Check the value and try again.',
  'error.rateLimitExceeded': 'Too many requests. Try again in a minute.',
  'error.conversionFailed':
    'Conversion failed unexpectedly. Try again — contact support if it keeps happening.',
  'error.serviceOverloaded':
    'The conversion service is busy right now. Try again in a few minutes.',
  'error.storageUnavailable': 'Storage is temporarily unavailable. Try again shortly.',
  'error.conversionTimeout':
    'Conversion took too long and was stopped. Try again with a smaller file.',
} as const;

export type MessageKey = keyof typeof EN_MESSAGES;
