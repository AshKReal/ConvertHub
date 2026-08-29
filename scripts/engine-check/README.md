# engine-check

Разовые скрипты для `specs/000-engine-quality-check.md`. Не часть приложения: не в `pnpm` workspace, не в `pnpm typecheck`/`lint`, свой изолированный `package.json`/`requirements.txt`.

## Подготовка

```
cd scripts/engine-check
npm install
python -m pip install -r requirements.txt
```

`aspose-words` (кандидат C) не поддерживает Python 3.14 — отдельный `venv` на 3.12:

```
py -3.12 -m venv .venv312
.venv312\Scripts\python.exe -m pip install -r requirements-aspose.txt
```

Разложить тестовые файлы (не коммитятся, `.gitignore`):

```
scripts/engine-check/samples/
  jpg-png/    20-30 .jpg и .png
  docx-pdf/   20-30 .docx
  pdf-docx/   20-30 .pdf (одни и те же файлы для всех трёх кандидатов)
```

## Запуск

```
node jpg-png.mjs
node docx-pdf.mjs
node pdf-docx-a-libreoffice.mjs
python pdf-docx-b-pdf2docx.py
.venv312\Scripts\python.exe pdf-docx-c-aspose.py
```

Каждый скрипт:
- сам находит файлы в своей папке `samples/*`, ничего не просит на входе
- никогда не падает на отдельном файле — фиксирует ошибку в отчёте и идёт дальше
- пишет JSON-отчёт (время, размеры, `ok`/ошибка на файл) в `results/<имя>.json`
- кладёт сконвертированные файлы в `results/<имя>-out/` — их нужно открыть и оценить качество глазами, скрипт этого не делает

`results/` и `samples/` — в `.gitignore`, в git идут только сами скрипты. Находки (числа, конкретные проблемные файлы) переносятся вручную в раздел «Результаты» `specs/000-engine-quality-check.md`.

## Кандидаты PDF→DOCX

Три отдельных скрипта, один и тот же набор `samples/pdf-docx/`, чтобы сравнение было честным:

| Скрипт | Кандидат | Лицензия |
|---|---|---|
| `pdf-docx-a-libreoffice.mjs` | Фильтр импорта PDF в LibreOffice | Бесплатно (MPL/LGPL) |
| `pdf-docx-b-pdf2docx.py` | `pdf2docx` + `PyMuPDF` | Обёртка MIT, ядро `PyMuPDF` — AGPL/commercial-dual. Для продакшена в закрытом SaaS обычно нужна платная лицензия Artifex; для этой разовой офлайн-оценки — легально без покупки |
| `pdf-docx-c-aspose.py` | Aspose.Words | Платно, здесь — trial (вотермарк/лимит страниц) |

## `soffice` не на `PATH`

`docx-pdf.mjs` и `pdf-docx-a-libreoffice.mjs` ищут `soffice.exe` по стандартным путям установки (`soffice.mjs`), PATH не требуется.
