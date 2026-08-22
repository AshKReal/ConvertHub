---
version: alpha
name: ConvertHub
description: Утилитарный файловый инструмент. Нейтральный холст, один акцент — приглушённый фиолетовый, вся выразительность — в состояниях и обратной связи.
colors:
  accent: "#b399cf"
  accent-hover: "#9681ae"
  accent-subtle: "#f2edf7"
  canvas: "#f6f3f9"
  surface: "#fdfcfe"
  surface-muted: "#f9f7fb"
  border: "#e2dee6"
  border-strong: "#87818c"
  text: "#3c3542"
  text-secondary: "#847e89"
  text-muted: "#928c96"
  on-accent: "#3a2650"
  on-danger: "#ffffff"
  success: "#2f6b45"
  success-subtle: "#e8eeec"
  danger: "#c94a3a"
  danger-subtle: "#f8ece9"
  danger-border: "#e2beb3"
  warning: "#9a6200"
  warning-subtle: "#fdf1dd"
  dark-accent: "#b494d1"
  dark-accent-hover: "#bfa4d8"
  dark-accent-subtle: "#4f445d"
  dark-canvas: "#1c1a1f"
  dark-surface: "#332e3c"
  dark-surface-muted: "#282430"
  dark-border: "#4d4756"
  dark-border-strong: "#847f8b"
  dark-text: "#eae8ec"
  dark-text-secondary: "#a8a2ac"
  dark-text-muted: "#9a949f"
  dark-on-accent: "#251f2a"
  dark-on-danger: "#251f2a"
  dark-success: "#7bc494"
  dark-success-subtle: "#40494c"
  dark-danger: "#e08065"
  dark-danger-subtle: "#4a2e28"
  dark-danger-border: "#6a4438"
  dark-warning: "#e2a44a"
  dark-warning-subtle: "#2a1f0f"
typography:
  display:
    fontFamily: Inter
    fontSize: 44px
    fontWeight: 640
    lineHeight: 1.1
    letterSpacing: -0.025em
  heading-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: 620
    lineHeight: 1.2
    letterSpacing: -0.02em
  heading:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.015em
  heading-sm:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -0.01em
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 550
    lineHeight: 1.3
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 450
    lineHeight: 1.4
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 450
    lineHeight: 1.5
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 450
    lineHeight: 1.4
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px
  5xl: 96px
  page-max: 1120px
  content-max: 720px
  card-padding: 24px
  section-gap: 64px
rounded:
  none: 0px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 20px
  full: 9999px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 10px 18px
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-muted}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: 10px 18px
    height: 40px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  dropzone:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.3xl}"
  dropzone-dragover:
    backgroundColor: "{colors.accent-subtle}"
  dropzone-error:
    backgroundColor: "{colors.danger-subtle}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: 9px 12px
    height: 40px
  badge:
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 3px 10px
  progress-track:
    backgroundColor: "{colors.surface-muted}"
    rounded: "{rounded.full}"
    height: 6px
  progress-fill:
    backgroundColor: "{colors.accent-hover}"
    rounded: "{rounded.full}"
---

# ConvertHub — DESIGN.md

> Инструмент, а не витрина. Спокойный интерфейс, в котором единственное яркое пятно — то, что пользователь должен нажать следующим.

**Темы:** светлая (по умолчанию) и тёмная. Обе обязательны, ни одна не является приоритетной.

Этот файл — нормативный источник визуальных решений. Значения токенов имеют приоритет над прозой; проза объясняет, как их применять. Если нужного значения здесь нет, агент **спрашивает, а не выбирает сам** — новые цвета, размеры и радиусы не изобретаются по ходу работы.

Компонентная и файловая структура — `ARCHITECTURE.md`, разделы 6.1 и 13. Здесь только визуальный слой.

---

## Overview

ConvertHub — утилита, которой пользуются между делом: пришёл, перетащил файл, забрал результат, ушёл. Из этого следует всё остальное.

**Интерфейс не должен запоминаться.** Пользователь не рассматривает страницу, он выполняет операцию за двадцать секунд. Дизайн, требующий изучения, здесь работает против продукта. Отсюда почти монохромная палитра: единственный насыщенный цвет — акцентный синий, и в любой момент на экране он присутствует ровно в одном осмысленном месте — на кнопке следующего шага или на активной зоне загрузки.

**Вся выразительность уходит в состояния.** Продукт по природе процессный: выбор файла, загрузка, конвертация, результат, восемь состояний зоны загрузки и пятнадцать кодов ошибок. Работа дизайна здесь не в том, чтобы страница выглядела эффектно, а в том, чтобы в каждый момент было очевидно, что происходит и что делать дальше. Прогресс-бар с процентами важнее любой иллюстрации.

**Числа читаются как данные.** Размеры файлов, квота, время обработки, идентификаторы, API-ключи — всё это моноширинный шрифт. Пропорциональный шрифт заставляет цифры плясать при обновлении прогресса, и «9,8 МБ» дёргается при переходе в «10,1 МБ».

**Регистр — деловой, не игривый.** Референсы намеренно разведены: iLovePDF идёт в сторону ярких плиток и крупных иконок для массового пользователя, CloudConvert — в сторону технической плотности и API. ConvertHub ближе ко второму, но с чистотой первого: у нас есть публичный API и ключи, но главный сценарий — один файл и одна кнопка. Никаких иллюстраций-персонажей, градиентов, эмодзи в интерфейсе и восклицательных знаков в текстах.

---

## Colors

Палитра на 90% нейтральная. Один акцент — приглушённый фиолетовый, три семантических цвета, дальше только серые с фиолетовым подтоном.

**Акцент здесь мягкий, не кричащий: `#b399cf` держит контраст только как заливка** (с тёмным текстом `on-accent` поверх), а не как тонкая линия или текст на светлом фоне — на `surface` он даёт всего 2,45:1. Поэтому для рамок, фокус-кольца и заливки прогресса используется более тёмный `accent-hover` — это не только hover-состояние, но и рабочий тон для тонких элементов, которым нужно быть заметными в состоянии покоя.

**Светлая тема.**

| Роль | Токен | Значение | Применение |
|---|---|---|---|
| Акцент | `accent` | `#b399cf` | Заливка главной кнопки, фон зоны загрузки при перетаскивании (как `accent-subtle`), заполнение прогресса. Только одно применение на экран |
| Акцент, наведение / рамки | `accent-hover` | `#9681ae` | Наведение на акцентные элементы; рамка зоны загрузки, выбранной карточки, фокус-кольцо, рамка поля ввода — везде, где `accent` не проходит контраст 3:1 |
| Акцент, подложка | `accent-subtle` | `#f2edf7` | Фон зоны загрузки при перетаскивании, фон информационных плашек |
| Текст на акценте | `on-accent` | `#3a2650` | Текст и иконки на заливке `accent` |
| Холст | `canvas` | `#f6f3f9` | Фон страницы. Не чистый белый: карточки должны читаться как приподнятые |
| Поверхность | `surface` | `#fdfcfe` | Карточки, зона загрузки, поповеры, модальные окна |
| Поверхность, приглушённая | `surface-muted` | `#f9f7fb` | Дорожка прогресс-бара, отключённые кнопки, чётные строки таблиц |
| Граница | `border` | `#e2dee6` | Волосяные линии карточек и разделители. Декоративная, не несёт информации |
| Граница, сильная | `border-strong` | `#87818c` | Границы полей ввода, чекбоксов, пунктир зоны загрузки |
| Текст | `text` | `#3c3542` | Заголовки, основной текст, имена файлов |
| Текст, вторичный | `text-secondary` | `#847e89` | Пояснения, описания, метаданные |
| Текст, приглушённый | `text-muted` | `#928c96` | Подписи, плейсхолдеры, отключённые состояния |
| Успех | `success` | `#2f6b45` | Завершённая конвертация, подтверждения |
| Ошибка | `danger` | `#c94a3a` | Текст ошибки, необратимое удаление, рамка полей и зоны в состоянии ошибки |
| Ошибка, подложка | `danger-subtle` | `#f8ece9` | Фон баннера и зоны загрузки в состоянии ошибки |
| Ошибка, декоративная рамка | `danger-border` | `#e2beb3` | Тонкая рамка вокруг элементов на `danger-subtle` — декоративная, как `border`. Не для рамки поля/зоны, которая обязана нести смысл: там `danger` |
| Текст на ошибке | `on-danger` | `#ffffff` | Текст кнопки Danger |
| Предупреждение | `warning` | `#9a6200` | Квота близка к исчерпанию, файл не будет сохранён |

**Тёмная тема** — не инверсия, а самостоятельный набор. Значения даны с префиксом `dark-` в токенах фронтматтера и подставляются в те же семантические переменные. В тёмной теме три уровня фона вместо двух: `canvas` — самый тёмный (фон страницы), `surface` — карточки и зона загрузки (самый светлый из трёх), `surface-muted` — между ними, для утопленных элементов внутри карточки (дорожка прогресса, отключённые поля).

| Роль | Значение | Отличие от светлой |
|---|---|---|
| Акцент | `#b494d1` | Насыщеннее и чуть светлее — `#b399cf` на тёмном фоне терял бы читаемость по той же логике, что и в светлой: заливка, не линия |
| Акцент, наведение / рамки | `#bfa4d8` | В тёмной теме светлее базового, не темнее — та же роль: рамки, фокус-кольцо, заполнение прогресса |
| Акцент, подложка | `#4f445d` | Не осветление фона, а тонирование `surface` в сторону акцента |
| Текст на акценте | `#251f2a` | Тот же приём, что в светлой: тёмный текст на светлой заливке акцента |
| Холст | `#1c1a1f` | Не `#000000`: чистый чёрный даёт ореолы вокруг светлого текста на OLED |
| Поверхность | `#332e3c` | В тёмной теме приподнятость передаётся **осветлением**, а не тенью — самый светлый из трёх фоновых слоёв |
| Поверхность, приглушённая | `#282430` | Между `canvas` и `surface` — утопленные элементы внутри карточки |
| Граница | `#4d4756` | |
| Граница, сильная | `#847f8b` | |
| Текст | `#eae8ec` | Не `#ffffff`: чистый белый на тёмном перегружает и вызывает гало-эффект |
| Текст, вторичный | `#a8a2ac` | |
| Текст, приглушённый | `#9a949f` | |
| Успех | `#7bc494` | Осветлён и приглушён по насыщенности |
| Ошибка | `#e08065` | Осветлена; **текст кнопки Danger в тёмной теме — не белый**: `#e08065` слишком светлый для белого текста (2,8:1), нужен тёмный `on-danger` |
| Ошибка, подложка / рамка | `#4a2e28` / `#6a4438` | |
| Текст на ошибке | `#251f2a` | Тот же тёмный тон, что и `on-accent` в тёмной теме |
| Предупреждение | `#e2a44a` | Не тронут в этой правке — вне фиолетовой семьи, задан отдельно |

### Контраст

Все значения ниже посчитаны, а не оценены. Порог WCAG AA — 4,5:1 для текста и 3:1 для границ интерактивных элементов.

| Пара | Светлая | Тёмная |
|---|---|---|
| `text` на `surface` | 11,5:1 | 10,8:1 |
| `text-secondary` на `surface` | 3,85:1 ⚠️ | 5,3:1 |
| `text-muted` на `surface` | 3,2:1 ⚠️ | 4,45:1 |
| `on-accent` на `accent` | 5,3:1 | 6,2:1 |
| `accent` на `surface` | 2,45:1 ⚠️ | 5,1:1 |
| `accent-hover` на `surface` | 3,4:1 | 6,0:1 |
| `border-strong` на `surface` | 3,7:1 | 3,4:1 |
| `danger` на `surface` | 4,5:1 | 4,7:1 |
| `danger` на `danger-subtle` | 4,0:1 ⚠️ | 4,35:1 |
| `success` на `surface` | 6,2:1 | 6,4:1 |
| `border` / `danger-border` на `surface` (декоративные) | 1,3:1 / 1,7:1 | 1,5:1 / 1,6:1 |

**⚠️ Три значения ниже порога 4,5:1 — это унаследовано от заданной палитры, не выбор при вёрстке.** `text-secondary` (3,85:1 в светлой теме), производный от него `text-muted` (3,2:1) и пара `danger`/`danger-subtle` (4,0:1) не проходят строгий AA для обычного текста. Решение оставлено как есть — мягкий контраст согласуется с минималистичным характером палитры, — но использовать `text-secondary` для мелкого текста ниже 13px не стоит: там разрыв с порогом ощущается сильнее. Если это неприемлемо, первый кандидат на правку — `text-secondary` в светлой теме, он тянет за собой `text-muted`.

**`accent` (2,45:1) не проходит даже порог 3:1 для границ** — поэтому рамки, фокус-кольцо и заполнение прогресса используют `accent-hover`, а не `accent`. `accent` остаётся только для заливок с текстом `on-accent` поверх.

`border` и `danger-border` (1,3–1,7:1) намеренно не проходят порог и не должны: это декоративные линии, а не носитель информации. Ни одна граница, несущая смысл — поле ввода, чекбокс, контур зоны загрузки, — не использует `border` или `danger-border`; для этого `border-strong`, `accent-hover` или `danger`.

---

## Typography

Два семейства. **Inter** — весь интерфейс. **JetBrains Mono** — данные.

Inter выбран не за красоту, а за две вещи, которые здесь нужны: подключаемые табличные цифры (`tnum`) и переменное начертание, позволяющее взять промежуточные веса вроде 550 и 620 вместо прыжка с 500 на 600.

Моноширинный применяется в четырёх местах и только в них: размеры файлов, API-ключи и идентификаторы, время обработки, значения квоты. Всё остальное — Inter, даже если это цифры внутри предложения.

| Уровень | Размер | Вес | Интерлиньяж | Трекинг | Где применяется |
|---|---|---|---|---|---|
| `display` | 44px | 640 | 1.1 | −0.025em | Заголовок главной страницы, единственный на сайт |
| `heading-lg` | 30px | 620 | 1.2 | −0.02em | Заголовки страниц |
| `heading` | 22px | 600 | 1.3 | −0.015em | Заголовки секций и модальных окон |
| `heading-sm` | 17px | 600 | 1.4 | −0.01em | Заголовки карточек, имена файлов |
| `body` | 15px | 400 | 1.6 | — | Основной текст |
| `body-sm` | 13px | 400 | 1.5 | — | Пояснения, описания форматов |
| `label` | 13px | 550 | 1.3 | — | Кнопки, метки полей, вкладки |
| `caption` | 12px | 450 | 1.4 | — | Подсказки под полями, метаданные, бейджи |
| `mono` | 13px | 450 | 1.5 | — | Размеры, ключи, идентификаторы |
| `mono-sm` | 12px | 450 | 1.4 | — | Проценты прогресса, техническая метаинформация |

**Обязательное правило:** все числовые значения, которые обновляются на месте — проценты прогресса, размеры, счётчик квоты, — получают `font-variant-numeric: tabular-nums`. Без этого при переходе с 9 % на 10 % строка дёргается, потому что цифры имеют разную ширину. Это самая заметная и самая дешёвая в исправлении небрежность в таком продукте.

Базовый размер текста — 15px, а не 16px: интерфейс плотный, экраны короткие, длинных текстов нет. Ниже 12px не опускаться нигде.

---

## Layout

Сетка 4px. Все отступы кратны четырём, промежуточных значений не бывает.

| Токен | Значение | Применение |
|---|---|---|
| `xs` | 4px | Промежуток между иконкой и текстом |
| `sm` | 8px | Внутренние отступы плотных элементов, промежуток между бейджами |
| `md` | 12px | Промежуток между связанными элементами |
| `lg` | 16px | Внутренние отступы компактных карточек |
| `xl` | 24px | Внутренние отступы карточек, промежуток между блоками |
| `2xl` | 32px | Промежуток между группами |
| `3xl` | 48px | Внутренние отступы зоны загрузки |
| `4xl` | 64px | Промежуток между секциями |
| `5xl` | 96px | Отступ сверху и снизу главной страницы |

**Ширины.** Максимальная ширина страницы — 1120px. Максимальная ширина текстовой колонки — 720px: длиннее строка перестаёт читаться. Зона загрузки на главной — не более 640px по ширине, по центру: растянутая на всю ширину она перестаёт восприниматься как цель для перетаскивания.

**Плотность — комфортная, но не воздушная.** Один экран, одно действие. На главной странице выше линии сгиба находятся только заголовок, зона загрузки и выбор формата — больше ничего.

**Мобильная адаптация.** Одна колонка от 320px. Зона загрузки на мобильном теряет надпись о перетаскивании (перетаскивать нечем) и превращается в крупную кнопку высотой не менее 56px. Минимальная область нажатия любого интерактивного элемента — 44×44px.

---

## Elevation & Depth

Иерархия строится **на цвете поверхности и границе**, а не на тенях. Тени в интерфейсе используются в трёх случаях, и во всех трёх элемент действительно всплывает над страницей: выпадающие меню, модальные окна, всплывающие уведомления.

```
shadow-popover: 0 4px 12px rgba(60, 53, 66, 0.08), 0 0 0 1px rgba(60, 53, 66, 0.04)
shadow-modal:   0 16px 48px rgba(60, 53, 66, 0.16)
shadow-toast:   0 6px 20px rgba(60, 53, 66, 0.12)
```

**В тёмной теме тени не работают** — чёрное на чёрном невидимо. Там те же три элемента получают вместо тени границу `border` и осветлённую поверхность на один шаг: `surface-muted` вместо `surface`. Это не обходной приём, а нормальная практика: в темноте глубина передаётся светом.

Карточки, зона загрузки, строки списка файлов теней не имеют **никогда** — только `surface` на фоне `canvas` и волосяная граница.

---

## Shapes

Радиусы умеренные: продукт технический, полностью круглые формы читались бы как игрушечные, острые углы — как незаконченные.

| Токен | Значение | Применение |
|---|---|---|
| `sm` | 6px | Бейджи, мелкие теги, чекбоксы |
| `md` | 8px | Кнопки, поля ввода, выпадающие меню |
| `lg` | 12px | Карточки, строки списка файлов |
| `xl` | 16px | Зона загрузки, модальные окна |
| `2xl` | 20px | Крупные баннеры на главной |
| `full` | 9999px | Только полоса прогресса и индикаторы-точки |

Внутри одной поверхности радиусы не смешиваются: кнопка внутри карточки — 8px, карточка — 12px, и это единственная допустимая разница на два шага.

**Фокус — сплошное кольцо, не тень.** `outline: 2px solid accent-hover; outline-offset: 2px` (`accent` не проходит контраст 3:1 — раздел «Контраст»). Никогда не `outline: none` без замены: удалённый индикатор фокуса делает интерфейс непроходимым с клавиатуры, и это не стилистический вопрос, а вопрос доступности.

---

## Components

### Зона загрузки — центральный компонент

Все восемь состояний по ТЗ п. 12.3. Изменение состояния всегда меняет как минимум два визуальных признака (цвет и текст), а не один: одного цвета недостаточно для дальтоников и в условиях яркого света.

| Состояние | Фон | Граница | Содержимое |
|---|---|---|---|
| Пусто | `surface` | 2px пунктир `border-strong` | Иконка 32px `text-muted`, `heading-sm` с приглашением, `caption` с ограничениями |
| Файл над зоной | `accent-subtle` | 2px сплошная `accent-hover` | Тот же текст, иконка окрашивается в `accent-hover`, вся зона `scale(1.01)` |
| Файл выбран | `surface` | 1px сплошная `border` | Имя файла `heading-sm`, размер `mono` `text-muted`, кнопка запуска, ссылка «выбрать другой» |
| Загрузка | `surface` | 1px сплошная `border` | Полоса прогресса, проценты `mono-sm` с табличными цифрами, кнопка отмены |
| Конвертация | `surface` | 1px сплошная `border` | Неопределённый индикатор без процентов, текст «Конвертируем», отмена **убрана** |
| Готово | `surface` | 1px сплошная `success` | Иконка галочки `success`, имя и размер результата, кнопка скачивания как главное действие |
| Ошибка | `danger-subtle` | 1px сплошная `danger` | Иконка `danger`, текст с конкретными числами и способом решения, кнопка «Попробовать снова» |
| Хранилище заполнено | `warning-subtle` | 1px сплошная `warning` | Текст о том, что файл конвертируется, но не сохранится; ссылка на управление файлами |

Переход между состояниями — 150 мс `ease-out` по фону и границе. Появление и исчезновение содержимого — 100 мс по прозрачности. Размеры зоны при смене состояния не меняются: скачок высоты сдвигает страницу под курсором.

### Кнопки

| Вариант | Фон | Текст | Граница |
|---|---|---|---|
| Primary | `accent` | `on-accent` | нет |
| Secondary | `surface` | `text` | 1px `border-strong` |
| Ghost | прозрачный | `text-secondary` | нет |
| Danger | `danger` | `on-danger` | нет |

**`on-danger` — не всегда белый.** В светлой теме `danger` достаточно тёмный для белого текста (4,5:1). В тёмной `danger` — светлый коралловый (`#e08065`), белый текст на нём даёт 2,8:1; там `on-danger` — тот же тёмный тон, что `on-accent`.

Высота 40px, внутренние отступы 10px/18px, радиус 8px, `label` 13px/550. Компактный вариант — 32px и отступы 6px/12px.

Наведение: primary → `accent-hover`; secondary и ghost → фон `surface-muted`. Нажатие — дополнительное затемнение и `translateY(1px)`, без изменения размера.

**Primary на экране одна.** Если кажется, что нужны две — одна из них secondary.

**Отключённая кнопка не прозрачная**, а перекрашенная: фон `surface-muted`, текст `text-muted`. Прозрачность даёт непредсказуемый результат на разных фонах и ломает контраст.

**Кнопка в состоянии загрузки сохраняет ширину** — иначе она прыгает при подмене текста на индикатор.

### Карточка формата

Плитка выбора направления конвертации: `surface`, радиус 12px, граница 1px `border`, внутренний отступ 24px. Внутри — иконка формата 24px, направление `heading-sm` (например, `JPG → PNG`), краткое пояснение `body-sm` `text-secondary`.

Выбранная карточка: граница 1px `accent-hover` и фон `accent-subtle`. Не тень, не увеличение — только цвет.

### Строка файла

Список в хранилище: высота 64px, радиус 12px, `surface`, разделители `border`. Слева иконка типа 20px, дальше имя файла `heading-sm` с обрезкой по центру (`file-name-that-is-…-long.pdf`, не обрезка хвоста — расширение обязано быть видно), под ним `mono-sm` `text-muted` с размером и датой. Справа бейдж статуса и действия, появляющиеся при наведении и **всегда видимые на мобильном**.

### Бейдж статуса

Радиус `full`, отступы 3px/10px, `caption`. Пары «текст на подложке»: `success` на `success-subtle`, `danger` на `danger-subtle`, `warning` на `warning-subtle`, `text-secondary` на `surface-muted`.

**Статус всегда содержит текст**, а не только цветную точку.

### Полоса прогресса

Высота 6px, радиус `full`, дорожка `surface-muted`, заполнение `accent-hover`, переход ширины 200 мс `linear` — не `ease`, иначе движение выглядит рывками. Проценты справа сверху, `mono-sm`, табличные цифры.

Неопределённое состояние (конвертация) — та же полоса с бегущим градиентом, **без процентов**: показывать проценты там, где прогресс неизвестен, — это обман.

### Поле ввода

Высота 40px, отступы 9px/12px, радиус 8px, фон `surface`, граница 1px `border-strong`, текст `body`. Фокус — граница `accent-hover` плюс кольцо 2px. Ошибка — граница `danger` и текст ошибки `caption` `danger` под полем, **всегда с текстом**, не только красной рамкой.

Поле API-ключа — `mono`, кнопка копирования справа внутри поля, значение маскируется до `ch_live_a1b2••••••••`.

### Уведомление

Всплывает справа снизу, ширина 360px, радиус 12px, `surface`, `shadow-toast`, цветная полоса 3px слева по семантике. Автоскрытие через 5 секунд, ошибки — **не скрываются автоматически**. Не более трёх одновременно.

### Индикатор квоты

Полоса 8px, радиус `full`. До 80 % — `accent-hover`, от 80 до 100 % — `warning`, при заполнении — `danger`. Подпись `mono-sm`: `247 МБ из 300 МБ`.

---

## Motion

Единственная роль анимации — объяснить, что изменилось. Декоративного движения нет.

| Тип | Длительность | Кривая |
|---|---|---|
| Наведение, цвет | 120 мс | `ease-out` |
| Смена состояния | 150 мс | `ease-out` |
| Появление поповера | 150 мс | `ease-out` |
| Модальное окно | 200 мс | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Полоса прогресса | 200 мс | `linear` |

Ничего дольше 250 мс. Ничего с отскоком, кроме модального окна.

**`prefers-reduced-motion: reduce` обязателен**: движение отключается, переходы по прозрачности остаются. Это не опция, а требование доступности.

---

## Do's and Don'ts

### Do

- Держать акцентный цвет ровно в одном осмысленном месте на экране
- Показывать в сообщении об ошибке конкретные числа и способ решения: «Этот файл 14,8 МБ — максимум 10 МБ. Сожмите его или разделите на части»
- Ставить `tabular-nums` на любое число, которое обновляется на месте
- Различать состояния минимум двумя признаками: цветом и текстом
- Строить иерархию цветом поверхности и границей, а не тенью
- Сохранять размеры элемента при смене состояния — менять только содержимое
- В тёмной теме передавать приподнятость осветлением поверхности

### Don't

- Не писать HEX в разметке. Только токены. Если нужного цвета нет — спросить, а не подобрать
- Не использовать `#000000` и `#ffffff` как цвета текста ни в одной теме
- Не получать тёмную тему инверсией светлой
- Не ставить тени на карточки, строки списка и зону загрузки
- Не размещать `text-muted` на `surface-muted`: в тёмной теме это 4,3:1, ниже порога
- Не передавать статус одним лишь цветом, без текста
- Не показывать проценты там, где прогресс неизвестен
- Не убирать индикатор фокуса без равноценной замены
- Не размещать на экране две primary-кнопки
- Не использовать прозрачность для отключённых состояний — только перекрашивание
- Не добавлять эмодзи, иллюстрации-персонажей и градиенты
- Не изобретать промежуточные значения отступов вне шкалы 4px

---

## Реализация в Tailwind 4

Готовый блок для `apps/web/src/styles.css`. Копируется целиком.

**Здесь есть одна деталь, которую легко сделать неправильно.** В Tailwind 4 токены объявляются в `@theme`, но значения там статические — при смене темы утилиты не переключатся. Рабочий способ ровно один: семантические переменные объявляются в `:root` и `.dark`, а `@theme inline` ссылается на них. Ключевое слово `inline` подставляет `var(...)` прямо в утилиту вместо того, чтобы вычислить значение на этапе сборки. Без `inline` тёмная тема молча не заработает, а причина будет неочевидной.

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --accent: #b399cf;
  --accent-hover: #9681ae;
  --accent-subtle: #f2edf7;
  --canvas: #f6f3f9;
  --surface: #fdfcfe;
  --surface-muted: #f9f7fb;
  --border-hairline: #e2dee6;
  --border-strong: #87818c;
  --text: #3c3542;
  --text-secondary: #847e89;
  --text-muted: #928c96;
  --on-accent: #3a2650;
  --success: #2f6b45;
  --success-subtle: #e8eeec;
  --danger: #c94a3a;
  --danger-subtle: #f8ece9;
  --danger-border: #e2beb3;
  --on-danger: #ffffff;
  --warning: #9a6200;
  --warning-subtle: #fdf1dd;
}

.dark {
  --accent: #b494d1;
  --accent-hover: #bfa4d8;
  --accent-subtle: #4f445d;
  --canvas: #1c1a1f;
  --surface: #332e3c;
  --surface-muted: #282430;
  --border-hairline: #4d4756;
  --border-strong: #847f8b;
  --text: #eae8ec;
  --text-secondary: #a8a2ac;
  --text-muted: #9a949f;
  --on-accent: #251f2a;
  --success: #7bc494;
  --success-subtle: #40494c;
  --danger: #e08065;
  --danger-subtle: #4a2e28;
  --danger-border: #6a4438;
  --on-danger: #251f2a;
  --warning: #e2a44a;
  --warning-subtle: #2a1f0f;
}

@theme inline {
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-subtle: var(--accent-subtle);
  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);
  --color-hairline: var(--border-hairline);
  --color-strong: var(--border-strong);
  --color-text: var(--text);
  --color-text-secondary: var(--text-secondary);
  --color-text-muted: var(--text-muted);
  --color-on-accent: var(--on-accent);
  --color-success: var(--success);
  --color-success-subtle: var(--success-subtle);
  --color-danger: var(--danger);
  --color-danger-subtle: var(--danger-subtle);
  --color-danger-border: var(--danger-border);
  --color-on-danger: var(--on-danger);
  --color-warning: var(--warning);
  --color-warning-subtle: var(--warning-subtle);

  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --text-display: 44px;
  --text-display--line-height: 1.1;
  --text-display--letter-spacing: -0.025em;
  --text-display--font-weight: 640;
  --text-heading-lg: 30px;
  --text-heading-lg--line-height: 1.2;
  --text-heading-lg--letter-spacing: -0.02em;
  --text-heading-lg--font-weight: 620;
  --text-heading: 22px;
  --text-heading--line-height: 1.3;
  --text-heading--letter-spacing: -0.015em;
  --text-heading--font-weight: 600;
  --text-heading-sm: 17px;
  --text-heading-sm--line-height: 1.4;
  --text-heading-sm--letter-spacing: -0.01em;
  --text-heading-sm--font-weight: 600;
  --text-body: 15px;
  --text-body--line-height: 1.6;
  --text-body-sm: 13px;
  --text-body-sm--line-height: 1.5;
  --text-label: 13px;
  --text-label--line-height: 1.3;
  --text-label--font-weight: 550;
  --text-caption: 12px;
  --text-caption--line-height: 1.4;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;

  --shadow-popover: 0 4px 12px rgb(60 53 66 / 0.08), 0 0 0 1px rgb(60 53 66 / 0.04);
  --shadow-modal: 0 16px 48px rgb(60 53 66 / 0.16);
  --shadow-toast: 0 6px 20px rgb(60 53 66 / 0.12);
}

@layer base {
  html { color-scheme: light dark; }
  html {
    -webkit-tap-highlight-color: transparent;
    scrollbar-color: var(--border-strong) transparent;
    scrollbar-width: thin;
  }
  body {
    background-color: var(--canvas);
    color: var(--text);
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .tnum { font-variant-numeric: tabular-nums; }
  :focus-visible {
    outline: 2px solid var(--accent-hover);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }

  /* Tailwind Preflight уже сбрасывает box-model, отступы и списки.
     Дальше — то, что Preflight не трогает: цвет выделения, скроллбар,
     плейсхолдеры, ссылки и курсоры. */

  ::selection {
    background-color: var(--accent-subtle);
    color: var(--text);
  }

  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  ::-webkit-scrollbar-track {
    background-color: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background-color: var(--border-strong);
    border-radius: 9999px;
    border: 3px solid var(--canvas);
  }
  ::-webkit-scrollbar-thumb:hover {
    background-color: var(--text-muted);
  }

  ::placeholder {
    color: var(--text-muted);
    opacity: 1;
  }

  hr {
    border: none;
    border-top: 1px solid var(--border-hairline);
  }

  /* accent (#b399cf) не проходит контраст 3:1 как цвет текста — раздел
     «Контраст» выше. Ссылки — цвета text с подчёркиванием, accent-hover
     только как цвет подчёркивания на hover. */
  a {
    color: var(--text);
    text-decoration-line: underline;
    text-decoration-color: var(--border-strong);
    text-underline-offset: 2px;
  }
  a:hover {
    text-decoration-color: var(--accent-hover);
  }

  button:not(:disabled) {
    cursor: pointer;
  }
  button:disabled {
    cursor: not-allowed;
  }

  textarea {
    resize: vertical;
  }
}
```

**Переключение темы.** Класс `dark` на `<html>`, значение хранится в сервисе `core/`. Начальное значение — из системной настройки через `matchMedia('(prefers-color-scheme: dark)')`, дальше выбор пользователя имеет приоритет. Класс должен проставляться **до первой отрисовки**, иначе при перезагрузке страницы в тёмной теме мелькнёт светлый фон.

---

## Быстрая справка для агента

```
Фон страницы          bg-canvas
Карточка              bg-surface border border-hairline rounded-lg p-6
Заголовок             text-heading text-text
Основной текст        text-body text-text-secondary
Подпись               text-caption text-text-muted
Главная кнопка        bg-accent text-on-accent rounded-md h-10 px-[18px] text-label
Вторичная кнопка      bg-surface text-text border border-strong rounded-md h-10 px-[18px]
Поле ввода            bg-surface border border-strong rounded-md h-10 px-3
Размер файла          font-mono text-[13px] text-text-muted tnum
Зона загрузки, пусто  bg-surface border-2 border-dashed border-strong rounded-xl p-12
Зона, перетаскивание  bg-accent-subtle border-2 border-solid border-accent-hover
Зона, ошибка          bg-danger-subtle border border-danger
Прогресс, дорожка     bg-surface-muted h-1.5 rounded-full
Прогресс, заполнение  bg-accent-hover h-1.5 rounded-full transition-[width] duration-200 ease-linear
Бейдж успеха          bg-success-subtle text-success rounded-full px-2.5 py-[3px] text-caption
```

### Три примера промптов

1. **Карточка формата.** `bg-surface`, `rounded-lg`, `border border-hairline`, `p-6`. Иконка 24px в `text-text-muted`, направление `text-heading-sm text-text`, пояснение `text-body-sm text-text-secondary` с отступом `mt-2`. Выбранное состояние: `border-accent-hover bg-accent-subtle`, без тени и без масштабирования.

2. **Строка файла в списке.** Высота 64px, `bg-surface rounded-lg`, разделитель `border-b border-hairline`. Слева иконка 20px, имя `text-heading-sm text-text` с обрезкой по центру строки, под ним `font-mono text-[12px] text-text-muted tnum` с размером и датой. Справа бейдж статуса и действия: `opacity-0 group-hover:opacity-100` на десктопе, всегда видимые на мобильном.

3. **Зона загрузки в состоянии загрузки.** `bg-surface border border-hairline rounded-xl p-12`, ширина не более 640px. Имя файла `text-heading-sm`, под ним полоса прогресса `h-1.5 rounded-full bg-surface-muted` с заполнением `bg-accent-hover` и переходом ширины 200 мс `linear`. Справа над полосой проценты `font-mono text-[12px] tnum`. Внизу кнопка отмены варианта ghost. Высота блока фиксирована и совпадает с остальными состояниями.
