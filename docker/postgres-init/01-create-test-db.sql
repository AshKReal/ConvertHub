-- Спека 015 (частично). Отдельная БД для e2e-тестов apps/api на том же
-- контейнере Postgres, что и dev (не Testcontainers — решение владельца,
-- specs/015-testing.md). Применяется официальным образом postgres только
-- при инициализации СВЕЖЕГО volume — на уже существующем создаётся вручную
-- один раз (docs/SETUP.md).
CREATE DATABASE convert_hub_test;
