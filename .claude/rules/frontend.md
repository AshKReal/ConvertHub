---
paths:
  - "apps/web/**"
---

# Frontend (Angular)

- Standalone, `OnPush` на каждом компоненте, `input()`/`output()` вместо декораторов. `NgModule` не использовать.
- Цвета — только токены Tailwind из блока `@theme` (`apps/web/src/styles.css`). HEX в разметке запрещён.
- Стрелки зависимостей идут только вниз: `features → shared → core` можно, `core → features` и `features → features` — нельзя.
- Компоненты не вызывают `HttpClient` напрямую — только через `data/*.api.ts` фичи.
- `shared/ui` не инжектит `HttpClient` и не импортирует доменные типы — компонент должен компилироваться, если его скопировать в другой проект.
- Состояние зоны загрузки и подобные многосостоятельные UI — дискриминантное объединение, не набор булевых флагов.
- Серверные данные не копируются в сигналы — только TanStack Query; локальное состояние — `signal()`; глобальное клиентское — сигнал в `core/services`.
- Именование без суффиксов `.component`/`.service` (Angular 20 style guide): `dropzone.ts` / `class Dropzone`.
- Компоненты работают только с `AppError`, никогда не разбирают сырой `HttpErrorResponse` напрямую.

Слои, состояние, автомат зоны загрузки — `ARCHITECTURE.md`, раздел 6.
