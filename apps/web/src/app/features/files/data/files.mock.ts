import type { ConversionTarget } from '@convert-hub/shared';

import type { FileEntry } from '../model/file-entry';

export const FILES_PAGE_SIZE = 8;

/** Искусственная задержка мок-запроса — тем же приёмом, что 006. */
export const MOCK_FETCH_DELAY_MS = 500;

const SAMPLE_STEMS: readonly string[] = [
  'invoice-march',
  'scan-passport',
  'presentation-final',
  'report-quarterly',
  'photo-profile',
  'contract-draft',
  'receipt-office-supplies',
  'poster-event',
  'letter-cover',
  'diagram-architecture',
];

const TARGETS: readonly ConversionTarget[] = ['png', 'jpg', 'pdf', 'docx'];

const TOTAL_MOCK_FILES = 22;
const DAY_MS = 24 * 60 * 60 * 1000;

function buildMockFiles(): readonly FileEntry[] {
  const now = Date.now();

  return Array.from({ length: TOTAL_MOCK_FILES }, (_unused, i) => {
    const target = TARGETS[i % TARGETS.length];
    const stemIndex = i % SAMPLE_STEMS.length;
    const repeat = Math.floor(i / SAMPLE_STEMS.length);
    const stem = repeat > 0 ? `${SAMPLE_STEMS[stemIndex]}-${repeat + 1}` : SAMPLE_STEMS[stemIndex];

    return {
      id: `file-${String(TOTAL_MOCK_FILES - i).padStart(3, '0')}`,
      name: `${stem}.${target}`,
      sizeBytes: 40_000 + ((i * 137_000) % 9_000_000),
      createdAt: new Date(now - i * DAY_MS).toISOString(),
      target,
      saved: i % 5 !== 0,
    };
  });
}

/**
 * Для приёмки пустого состояния — временно заменить на `[]` руками
 * (тот же приём, что `MOCK_LOGIN_SUCCEEDS` в 019).
 */
export const MOCK_FILES: readonly FileEntry[] = buildMockFiles();
