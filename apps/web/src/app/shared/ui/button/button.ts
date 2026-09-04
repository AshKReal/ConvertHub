import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonLink = string | readonly (string | number)[];

const BASE_CLASSES =
  'inline-flex h-10 items-center justify-center rounded-md px-[18px] text-label no-underline transition-colors duration-150 active:translate-y-px disabled:translate-y-0 disabled:bg-surface-muted disabled:text-text-muted disabled:hover:bg-surface-muted';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-surface text-text border border-strong hover:bg-surface-muted',
  ghost: 'bg-transparent text-text-secondary hover:bg-surface-muted',
  danger: 'bg-danger text-on-danger',
};

@Component({
  selector: 'app-button',
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `inline-flex` внутри shrink-wrap'ится по содержимому, поэтому одного
  // `w-full` на внутреннем элементе мало: хост `<app-button>` по умолчанию
  // строчный и сам сжимается. Растягиваем оба — тогда `full` работает и в
  // колоночном flex (там хост тянется сам), и вне его.
  host: { '[class.block]': 'full()', '[class.w-full]': 'full()' },
})
export class Button {
  variant = input<ButtonVariant>('primary');
  type = input<'button' | 'submit'>('button');
  disabled = input(false);
  /** Кнопка занимает всю ширину контейнера — формы входа и регистрации. */
  full = input(false);
  /** Задан — компонент отрисует ссылку: переход обязан быть якорем, а не кнопкой. */
  link = input<ButtonLink | null>(null);

  protected readonly classes = computed(
    () => `${BASE_CLASSES} ${VARIANT_CLASSES[this.variant()]}${this.full() ? ' w-full' : ''}`,
  );
}
