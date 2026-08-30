#!/usr/bin/env node
// Спека 015 (частично). `prisma migrate deploy` читает DATABASE_URL из
// схемы — эта БД отдельная (TEST_DATABASE_URL), не читается автоматически.
// Кроссплатформенный скрипт вместо `VAR=x command` в package.json: в этом
// проекте уже были проблемы с таким инлайном на нативном Windows-шелле
// (только Git Bash его понимает, cmd.exe/PowerShell — нет).
//
// Ручной шаг, как и обычный `db:migrate` для dev-БД — миграции нигде в
// проекте не гоняются автоматически при старте, тот же принцип и здесь.

import { execSync } from 'node:child_process';
import { config } from 'dotenv';

config();

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined) {
  console.error('TEST_DATABASE_URL is not set in apps/api/.env');
  process.exit(1);
}

execSync('pnpm exec prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});
