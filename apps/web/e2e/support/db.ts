import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// `playwright.config.ts` кладёт сюда строку подключения к `convert_hub_test`
// (та же, что использует поднятый им API-сервер).
const DATABASE_URL = process.env.E2E_DATABASE_URL;

const scriptPath = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'api',
  'scripts',
  'e2e-db.mjs',
);
const apiDir = resolve(__dirname, '..', '..', '..', 'api');

function run(args: string[]): void {
  if (DATABASE_URL === undefined) {
    throw new Error('E2E_DATABASE_URL is not set (playwright.config.ts should set it).');
  }
  execFileSync(process.execPath, [scriptPath, ...args], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL },
    stdio: 'pipe',
  });
}

/** Сценарий «квота заполнена» — выставить занятое место пользователю. */
export function setStorageUsage(email: string, bytes: number): void {
  run(['set-usage', email, String(bytes)]);
}

/** Убрать за собой созданных тестом пользователей (каскадом — их файлы). */
export function cleanupUsers(emailSubstring: string): void {
  run(['cleanup', emailSubstring]);
}
