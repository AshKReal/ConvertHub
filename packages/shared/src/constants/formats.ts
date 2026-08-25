/**
 * Целевой формат передаётся в `POST /v1/convert` явно, исходный сервер определяет
 * по содержимому (TECH-SPEC.md §7.3). Поэтому `target` — часть контракта,
 * а `accept` и `extensions` нужны только диалогу выбора файла и ничего не гарантируют.
 */
export const CONVERSION_TARGETS = ['png', 'jpg', 'pdf'] as const;

export type ConversionTarget = (typeof CONVERSION_TARGETS)[number];

export const CONVERSION_DIRECTIONS = [
  {
    id: 'jpg-to-png',
    from: 'JPG',
    to: 'PNG',
    target: 'png',
    accept: ['image/jpeg'],
    extensions: ['.jpg', '.jpeg'],
  },
  {
    id: 'png-to-jpg',
    from: 'PNG',
    to: 'JPG',
    target: 'jpg',
    accept: ['image/png'],
    extensions: ['.png'],
  },
  {
    id: 'docx-to-pdf',
    from: 'DOCX',
    to: 'PDF',
    target: 'pdf',
    accept: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.docx'],
  },
  {
    id: 'pdf-to-jpg',
    from: 'PDF',
    to: 'JPG',
    target: 'jpg',
    accept: ['application/pdf'],
    extensions: ['.pdf'],
  },
] as const satisfies readonly {
  id: string;
  from: string;
  to: string;
  target: ConversionTarget;
  accept: readonly string[];
  extensions: readonly string[];
}[];

export type ConversionDirection = (typeof CONVERSION_DIRECTIONS)[number];

export type ConversionDirectionId = ConversionDirection['id'];

export function findConversionDirection(id: string): ConversionDirection | undefined {
  return CONVERSION_DIRECTIONS.find((direction) => direction.id === id);
}

/** Значение атрибута `accept`: MIME-типы и расширения, вторые нужны Windows для `.docx`. */
export function acceptAttribute(direction: ConversionDirection): string {
  return [...direction.accept, ...direction.extensions].join(',');
}
