import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpEventType } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { QueryClient, provideTanStackQuery } from '@tanstack/angular-query-experimental';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONVERSION_DIRECTIONS, MAX_FILE_SIZE_BYTES } from '@convert-hub/shared';

import { environment } from '../../../../../environments/environment';
import { Dropzone } from './dropzone';

/**
 * Спека 015. Автомат зоны загрузки — `DropzoneState` (дискриминантное
 * объединение, `ARCHITECTURE.md` §6.4). `injectMeQuery` остаётся неактивным
 * (гость: `auth.user()` === null → `enabled` false), поэтому `quotaFull`
 * здесь не проверяется — он завязан на живой `['me']`, это делает e2e
 * `X-Save-Skipped-Reason`. Здесь — переходы, гарды и счётчик drag-глубины.
 */
interface DropzoneInternals {
  state: () => {
    kind: string;
    error?: { code: string };
    progress?: number;
  };
  select: (files: FileList | null) => void;
  onDragEnter: (event: DragEvent) => void;
  onDragLeave: () => void;
  clear: () => void;
  start: () => void;
  markUploadDone: () => void;
}

const fileList = (file: File): FileList =>
  ({
    length: 1,
    0: file,
    item: (index: number) => (index === 0 ? file : null),
  }) as unknown as FileList;

const fakeFile = (name: string, size: number): File => {
  const file = new File(['x'], name, { type: 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('Dropzone — state machine', () => {
  let fixture: ComponentFixture<Dropzone>;
  let dz: DropzoneInternals;
  let httpMock: HttpTestingController;

  const create = (): void => {
    fixture = TestBed.createComponent(Dropzone);
    fixture.componentRef.setInput('direction', CONVERSION_DIRECTIONS[0]);
    fixture.detectChanges();
    dz = fixture.componentInstance as unknown as DropzoneInternals;
  };

  const selectValidFile = (): void => {
    dz.select(fileList(fakeFile('ok.jpg', 1024)));
  };

  const takeConvertRequest = () => httpMock.expectOne(`${environment.apiUrl}/v1/convert`);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTanStackQuery(new QueryClient()),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('starts empty with no file and no quota data', () => {
    create();
    expect(dz.state().kind).toBe('empty');
  });

  it('tracks drag depth with a counter, not a flag', () => {
    create();
    dz.onDragEnter(new Event('dragenter') as DragEvent);
    dz.onDragEnter(new Event('dragenter') as DragEvent);
    dz.onDragLeave();
    expect(dz.state().kind).toBe('dragover');

    dz.onDragLeave();
    expect(dz.state().kind).toBe('empty');

    dz.onDragLeave();
    expect(dz.state().kind).toBe('empty');
  });

  it('rejects a file over the size limit into an error state', () => {
    create();
    dz.select(fileList(fakeFile('big.jpg', MAX_FILE_SIZE_BYTES + 1)));

    const state = dz.state();
    expect(state.kind).toBe('error');
    expect(state.error?.code).toBe('FILE_TOO_LARGE');
  });

  it('ignores select() once past the selectable states (guard by kind)', () => {
    create();
    dz.select(fileList(fakeFile('big.jpg', MAX_FILE_SIZE_BYTES + 1)));
    expect(dz.state().kind).toBe('error');

    dz.select(fileList(fakeFile('small.jpg', 10)));
    expect(dz.state().kind).toBe('error');
  });

  it('clear() returns to empty from any state', () => {
    create();
    dz.select(fileList(fakeFile('big.jpg', MAX_FILE_SIZE_BYTES + 1)));
    expect(dz.state().kind).toBe('error');

    dz.clear();
    expect(dz.state().kind).toBe('empty');
  });

  it('start() is a no-op without a selected file', () => {
    create();
    dz.start();
    httpMock.expectNone(`${environment.apiUrl}/v1/convert`);
    expect(dz.state().kind).toBe('empty');
  });

  it('start() moves selected → uploading and fires the conversion request', () => {
    create();
    selectValidFile();
    expect(dz.state().kind).toBe('selected');

    dz.start();
    const request = takeConvertRequest();
    expect(dz.state().kind).toBe('uploading');

    request.flush(new Blob(['done'], { type: 'image/png' }));
  });

  it('upload progress at 100% advances to converting; markUploadDone is then inert', () => {
    create();
    selectValidFile();
    dz.start();
    const request = takeConvertRequest();

    request.event({
      type: HttpEventType.UploadProgress,
      loaded: 1024,
      total: 1024,
    });
    expect(dz.state().kind).toBe('converting');

    dz.markUploadDone();
    expect(dz.state().kind).toBe('converting');

    request.flush(new Blob(['done'], { type: 'image/png' }));
  });
});
