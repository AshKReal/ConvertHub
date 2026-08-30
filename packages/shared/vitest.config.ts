import { defineConfig } from 'vitest/config';

/** Чистый TS/Zod, без декораторов — дефолтная node-среда, без плагинов. */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
  },
});
