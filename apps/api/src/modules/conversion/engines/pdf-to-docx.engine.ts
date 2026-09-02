import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { CONVERSION_TIMEOUT_SECONDS } from '@convert-hub/shared';
import { AppException } from '../../../common/exceptions/app.exception';
import type { ConvertOptions } from '../models/convert-options.model';
import type { ConversionEngine } from './engine.interface';

const logger = new Logger('PdfToDocxEngine');
const PYTHON_COMMAND = 'python';
const SCRIPT_PATH = join(process.cwd(), 'python', 'pdf_to_docx.py');
/** TECH-SPEC.md §6 — общий лимит конвертации, `packages/shared` (спека 018 убрала
 * дубль). Владелец подтвердил оставить как есть, даже зная, что сложные реальные
 * PDF (000) укладываются не всегда — см. спеку 005, "Мои тест-кейсы". */
const TIMEOUT_MS = CONVERSION_TIMEOUT_SECONDS * 1000;

/**
 * Дочерний процесс на каждый вызов, не постоянный сайдкар (решение владельца,
 * спека 005) — `pdf2docx` (Python) не имеет Node-эквивалента. Файлы, не stdin/stdout:
 * бинарные потоки через `child_process` менее предсказуемы при больших PDF, а
 * `os.tmpdir()`-паттерн уже проверен в `convert-file.interceptor.ts`.
 */
export class PdfToDocxEngine implements ConversionEngine {
  supports(from: string, to: string): boolean {
    return from === 'PDF' && to === 'DOCX';
  }

  async convert(input: Buffer, _opts: ConvertOptions): Promise<Buffer> {
    const dir = join(tmpdir(), 'convert-hub-pdf2docx', randomUUID());
    await mkdir(dir, { recursive: true });
    const inputPath = join(dir, 'input.pdf');
    const outputPath = join(dir, 'output.docx');

    try {
      await writeFile(inputPath, input);
      await runPython(inputPath, outputPath);
      return await readFile(outputPath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

function runPython(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_COMMAND, [SCRIPT_PATH, inputPath, outputPath]);
    let stderr = '';
    let settled = false;

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      settled = true;
      child.kill();
      reject(new AppException('CONVERSION_TIMEOUT'));
    }, TIMEOUT_MS);

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new AppException('CONVERSION_FAILED', { reason: error.message }));
    });

    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      // stderr — из pdf_to_docx.py, диагностика в лог сервера, не клиенту
      // (сырой текст ошибки Python — не контракт API).
      logger.error(`pdf_to_docx.py exited with code ${code}: ${stderr}`);
      reject(new AppException('CONVERSION_FAILED', { exit_code: code ?? -1 }));
    });
  });
}
