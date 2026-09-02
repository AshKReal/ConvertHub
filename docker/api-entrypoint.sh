#!/bin/sh
# Спека 016. Миграции при старте контейнера (ARCHITECTURE.md §10) — для
# одного инстанса норма; при нескольких их выносят в отдельный шаг деплоя
# (017), чтобы не гонять параллельно.
set -e

node node_modules/prisma/build/index.js migrate deploy

# nest build кладёт точку входа в dist/src/main.js (rootDir выводится в `src`,
# рядом с dist/vitest.config.js и пр.) — не dist/main.js.
exec node dist/src/main
