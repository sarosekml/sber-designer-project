/* Stub typings for @sber-ibp/core. All non-trivial domain types are widened to `any`
 * so the project compiles without the real package. */

import type * as React from 'react';

// ---------- generic / domain types (kept loose) ----------
export type Nullable<T> = T | null | undefined;
export type Dictionary<V = any> = Record<string, V>;
export type IsoDate = string;

export type ColumnName = string;
export type FixedSide = 'left' | 'right';

export type FilterPreset<T = any> = {
  objectId?: string;
  name: string;
  data?: T;
  [k: string]: any;
};

export type TableColumn = any;
export type TableSettings = any;
export type TableSettingsCacheLoader = any;
export type FormReadyDto = any;
export type SearchRequestDto = any;
export type SearchResponseDto<T = any> = { items: T[]; total?: number; [k: string]: any };
export type ListInfoType = any;
export type NavigationSchema = any;
export type NavigateCallback = (...args: any[]) => any;
export type BreadcrumbsNavigationData = any;
export type Subscriber<T = any> = (payload: T) => void;

// ---------- constants ----------
export const emptyArray: readonly any[];
export const emptyString: '';
export const dashSymbol: string;
export const CORE_CHANNEL_ID: string;

export const CoreEvents: {
  NAVIGATE: 'NAVIGATE';
  NAVIGATE_BACK: 'NAVIGATE_BACK';
  BREADCRUMBS_CHANGED: 'BREADCRUMBS_CHANGED';
  [k: string]: string;
};

export const SortingDirection: {
  ASC: 'asc';
  DESC: 'desc';
};

// ---------- helpers ----------
export function isEmpty(v: any): boolean;
export function isEqual(a: any, b: any): boolean;
export function escapeRegExp(s: string): string;
export function completeWithDefaults<T>(obj: Partial<T>, defaults: T): T;
export function debounce<F extends (...args: any[]) => any>(fn: F, wait?: number): F & {
  cancel: () => void;
  flush: () => void;
};
export function uniqueId(prefix?: string): string;
export function uuid(): string;
export function reverseIsoDate(iso: string): string;
export function subStringWrapper(text: any, query?: string): any;
export function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined | null>): (value: T) => void;
export function noop(): void;
export function identity<T>(x: T): T;

// ---------- event bus / hooks ----------
export function triggerEvent(channelId: string, event: string, payload?: any): void;
export function useEventApi(channelId?: string): {
  trigger: typeof triggerEvent;
  subscribe: (channelId: string, event: string, cb: Subscriber) => () => void;
};
export function useEventApiListener(channelId: string, event: string, cb?: Subscriber): void;
export function useEventApiListener<TEvents = any, TEventName extends string = string>(
  cb: Subscriber,
  deps: React.DependencyList,
  channelId: string,
  event?: TEventName,
): void;
export function useBrowserEventsListener(event: string, handler: any, target?: EventTarget | null): void;
export function useBrowserEventsListener(
  handler: any,
  deps: React.DependencyList,
  event: string,
  target?: EventTarget | null,
): void;
export function useDebouncedCallback<F extends (...args: any[]) => any>(fn: F, wait?: number): F;
export function useDebouncedCallback<F extends (...args: any[]) => any>(
  fn: F,
  deps: React.DependencyList,
  wait?: number,
): F;
export function useDebouncedEffect(effect: () => void, deps: React.DependencyList, wait?: number): void;
export function useInitialValueOnly<T>(value: T): T;
export function useRerender(): () => void;

// ---------- i18n / yup ----------
export const i18n: {
  t: <T = string>(key: string, opts?: any) => T;
  language: string;
  changeLanguage: (l: string) => Promise<void>;
  on: (...a: any[]) => void;
  off: (...a: any[]) => void;
};

export const sharedYup: {
  getCashedSchema: <T = any>(factory: () => T) => T;
  getCachedSchema: <T = any>(factory: () => T) => T;
};
