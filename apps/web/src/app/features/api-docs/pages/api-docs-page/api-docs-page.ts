import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ERROR_CODES,
  MAX_FILE_SIZE_BYTES,
  USER_STORAGE_QUOTA_BYTES,
  type ErrorCode,
} from '@convert-hub/shared';

import { ERROR_MESSAGE_KEYS } from '../../../../core/i18n/messages';
import { I18nService } from '../../../../core/services/i18n';
import { CodeBlock } from '../../../../shared/ui/code-block/code-block';
import { OPENAPI_URL, injectOpenApiEndpointsQuery } from '../../data/api-docs.api';

interface ErrorEntry {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
}

const ERROR_ENTRIES: readonly ErrorEntry[] = (Object.keys(ERROR_CODES) as ErrorCode[]).map(
  (code) => ({
    code,
    status: ERROR_CODES[code].status,
    retryable: ERROR_CODES[code].retryable,
  }),
);

const SAMPLE_BEARER_TOKEN = 'ch_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

@Component({
  selector: 'app-api-docs-page',
  imports: [CodeBlock],
  templateUrl: './api-docs-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiDocsPage {
  protected readonly i18n = inject(I18nService);

  /** Спека 013. Эндпоинты — из `/v1/openapi.json` (сгенерирован из Zod-схем), не из стаба. */
  protected readonly endpointsQuery = injectOpenApiEndpointsQuery();
  protected readonly openApiUrl = OPENAPI_URL;

  protected readonly errorEntries = ERROR_ENTRIES;
  protected readonly errorMessageKeys = ERROR_MESSAGE_KEYS;

  protected readonly maxFileSizeBytes = MAX_FILE_SIZE_BYTES;
  protected readonly storageQuotaBytes = USER_STORAGE_QUOTA_BYTES;

  protected readonly authExample = `Authorization: Bearer ${SAMPLE_BEARER_TOKEN}`;

  protected readonly convertExample = [
    'curl -X POST https://api.convert-hub.io/v1/convert \\',
    `  -H "Authorization: Bearer ${SAMPLE_BEARER_TOKEN}" \\`,
    '  -F "file=@photo.jpg" \\',
    '  -F "target=png" \\',
    '  -o result.png',
  ].join('\n');

  protected readonly listFilesExample = [
    'curl https://api.convert-hub.io/v1/files?limit=25 \\',
    `  -H "Authorization: Bearer ${SAMPLE_BEARER_TOKEN}"`,
  ].join('\n');
}
