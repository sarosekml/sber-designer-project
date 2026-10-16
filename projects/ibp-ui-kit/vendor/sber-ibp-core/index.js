'use strict';
/* Stub for @sber-ibp/core. Provides minimal runtime shapes so the project compiles
 * and Storybook can render. Real behaviour (events bus, i18n, yup helpers, etc.)
 * is intentionally simplified. */

const React = require('react');

// ---- constants ----
const emptyArray = Object.freeze([]);
const emptyString = '';
const dashSymbol = '—';
const CORE_CHANNEL_ID = 'core';

// ---- generic helpers ----
const noop = () => undefined;
const identity = (x) => x;

const isEmpty = (v) => {
  if (v == null) return true;
  if (typeof v === 'string') return v.length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
};

const isEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!isEqual(a[k], b[k])) return false;
  return true;
};

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const completeWithDefaults = (obj, defaults) => Object.assign({}, defaults, obj);

const debounce = (fn, wait = 0) => {
  let t;
  const debounced = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(t);
  debounced.flush = () => undefined;
  return debounced;
};

let _uid = 0;
const uniqueId = (prefix = '') => `${prefix}${++_uid}`;
const uuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const reverseIsoDate = (iso) => {
  if (!iso || typeof iso !== 'string') return iso;
  const [d] = iso.split('T');
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
};

const subStringWrapper = (text, _query) => text;

const mergeRefs = (...refs) => (value) => {
  refs.forEach((ref) => {
    if (typeof ref === 'function') ref(value);
    else if (ref != null) ref.current = value;
  });
};

// ---- event bus (minimal) ----
const _channels = new Map();
const triggerEvent = (channelId, event, payload) => {
  const ch = _channels.get(channelId);
  if (!ch) return;
  const eventPayload = { eventId: event, data: payload };
  const callbacks = new Set([...(ch.get(event) || []), ...(ch.get('*') || [])]);
  callbacks.forEach((cb) => {
    try {
      cb(eventPayload);
    } catch (e) {
      /* ignore */
    }
  });
};
const _subscribe = (channelId, event, cb) => {
  if (!_channels.has(channelId)) _channels.set(channelId, new Map());
  const ch = _channels.get(channelId);
  if (!ch.has(event)) ch.set(event, new Set());
  ch.get(event).add(cb);
  return () => ch.get(event).delete(cb);
};

const useEventApi = (boundChannelId) => ({
  trigger: boundChannelId ? (event, payload) => triggerEvent(boundChannelId, event, payload) : triggerEvent,
  subscribe: boundChannelId ? (event, cb) => _subscribe(boundChannelId, event, cb) : _subscribe,
});

const useEventApiListener = (...args) => {
  const legacySignature = typeof args[0] === 'function';
  const _cb = legacySignature ? args[0] : args[2];
  const _channelId = legacySignature ? args[2] : args[0];
  const _event = (legacySignature ? args[3] : args[1]) ?? '*';
  React.useEffect(() => {
    if (!_channelId || !_event || typeof _cb !== 'function') return undefined;
    return _subscribe(_channelId, _event, _cb);
  }, [_channelId, _event, _cb]);
};

const useBrowserEventsListener = (...args) => {
  const legacySignature = typeof args[0] === 'function';
  const _event = legacySignature ? args[2] : args[0];
  const handler = legacySignature ? args[0] : args[1];
  const target = legacySignature ? args[3] : args[2];
  React.useEffect(() => {
    const t = target || (typeof window !== 'undefined' ? window : null);
    if (!t || !_event || !handler || typeof t.addEventListener !== 'function') return undefined;
    t.addEventListener(_event, handler);
    return () => t.removeEventListener(_event, handler);
  }, [_event, handler, target]);
};

const useDebouncedCallback = (fn, depsOrWait = 0, maybeWait) => {
  const wait = Array.isArray(depsOrWait) ? (maybeWait ?? 0) : depsOrWait;
  const ref = React.useRef(fn);
  ref.current = fn;
  return React.useMemo(() => debounce((...args) => ref.current(...args), wait), [wait]);
};

const useDebouncedEffect = (effect, deps, wait = 0) => {
  React.useEffect(() => {
    const t = setTimeout(() => effect(), wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

const useInitialValueOnly = (value) => {
  const ref = React.useRef(value);
  return ref.current;
};

const useRerender = () => {
  const [, set] = React.useState(0);
  return React.useCallback(() => set((n) => n + 1), []);
};

// ---- i18n ----
const i18n = {
  t: (key, _opts) => key,
  language: 'ru',
  changeLanguage: () => Promise.resolve(),
  on: () => undefined,
  off: () => undefined,
};

// ---- sharedYup ----
const sharedYup = {
  getCashedSchema: (factory) => factory(),
  getCachedSchema: (factory) => factory(),
};

// ---- core events enum (placeholders) ----
const CoreEvents = {
  NAVIGATE: 'NAVIGATE',
  NAVIGATE_BACK: 'NAVIGATE_BACK',
  BREADCRUMBS_CHANGED: 'BREADCRUMBS_CHANGED',
};

const SortingDirection = {
  ASC: 'asc',
  DESC: 'desc',
};

module.exports = {
  // constants
  emptyArray,
  emptyString,
  dashSymbol,
  CORE_CHANNEL_ID,
  CoreEvents,
  SortingDirection,
  // helpers
  isEmpty,
  isEqual,
  escapeRegExp,
  completeWithDefaults,
  debounce,
  uniqueId,
  uuid,
  reverseIsoDate,
  subStringWrapper,
  mergeRefs,
  // bus
  triggerEvent,
  useEventApi,
  useEventApiListener,
  useBrowserEventsListener,
  useDebouncedCallback,
  useDebouncedEffect,
  useInitialValueOnly,
  useRerender,
  // misc
  i18n,
  sharedYup,
  // noops for unknowns
  noop,
  identity,
};
