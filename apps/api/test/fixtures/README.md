# Фикстуры валидаторов (спека 015)

Бинарные файлы для юнит-тестов `modules/conversion/validators/**`. Пересобрать:

```bash
node apps/api/test/fixtures/generate.mjs
```

`generate.mjs` — источник истины, файлы закоммичены только чтобы тесты не
требовали запуска скрипта. Меняете набор — правьте скрипт, не файлы руками.

| Файл | Чем сгенерён | Зачем |
|---|---|---|
| `sample.jpg` | `sharp` 8×8, сплошной цвет, `.jpeg()` | magic bytes = `image/jpeg` |
| `sample.png` | `sharp` 8×8, сплошной цвет, `.png()` | magic bytes = `image/png`; валидный маленький PNG для `assertWithinPixelLimit` |
| `huge-dimensions.png` | настоящий 1×1 PNG, в IHDR перезаписаны width/height на 60000×60000, пересчитан CRC чанка | decompression bomb: заголовок заявляет 3.6 млрд пикселей при 90 байтах на диске → `IMAGE_TOO_LARGE`, не `FILE_CORRUPTED` |
| `sample.pdf` | `pdf-lib`, 1 пустая страница | валидный PDF в пределах лимита страниц |
| `exactly-50.pdf` | `pdf-lib`, 50 страниц | ровно `MAX_PDF_PAGES` — граница, исключения быть не должно |
| `many-pages.pdf` | `pdf-lib`, 51 страница | `MAX_PDF_PAGES + 1` → `TOO_MANY_PAGES` |
| `not-an-image.txt` | обычный текст | нет сигнатуры → `detectFileType` возвращает `undefined`; `sharp`/`pdf-lib` не разбирают → `FILE_CORRUPTED` |

Чего здесь нет намеренно:

- **`.docx`** — в зависимостях `apps/api` нет zip-райтера; кейс «реальный DOCX
  mime → `UNSUPPORTED_FILE_TYPE`» покрыт на уровне `conversion-direction.validator.spec.ts`
  фейковым `FileTypeResult`, движок `docx-to-pdf` всё равно только в 018.
- **зашифрованный PDF** — `pdf-lib` не пишет шифрование. Текущий валидатор
  ловит зашифрованный PDF в общий `FILE_CORRUPTED` (отдельный
  `FILE_PASSWORD_PROTECTED` — в движке 005, не в валидаторе); проверяется
  на e2e-уровне движка, не здесь.
