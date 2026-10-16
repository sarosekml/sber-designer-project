import { describe, expect, test } from 'bun:test';

import {
  APP_ACCENTS,
  APP_ACCENT_SWATCHES,
  APP_ACCENT_STORAGE_KEY,
  APP_BRAND_MARKS,
  APP_BRAND_MARK_STORAGE_KEY,
  APP_DS_BROWSER_STORAGE_KEY,
  APP_SURFACES,
  APP_SURFACE_STORAGE_KEY,
  APP_THEME_STORAGE_KEY,
  applyAppAccentToRoot,
  applyAppSurfaceToRoot,
  applyAppThemeToRoot,
  DEFAULT_APP_ACCENT,
  DEFAULT_APP_BRAND_MARK,
  DEFAULT_APP_DS_BROWSER_ENABLED,
  DEFAULT_APP_GENERATIVE_THUMBNAIL_ENABLED,
  DEFAULT_APP_SURFACE,
  normalizeAppAccent,
  normalizeAppBrandMark,
  normalizeAppSurface,
  normalizeAppTheme,
  normalizeDsBrowserEnabled,
  readStoredAppAccent,
  readStoredAppBrandMark,
  readStoredAppSurface,
  readStoredAppTheme,
  readStoredDsBrowserEnabled,
  writeStoredAppAccent,
  writeStoredAppBrandMark,
  writeStoredAppSurface,
  writeStoredAppTheme,
  writeStoredDsBrowserEnabled,
} from './theme';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function createThemeRoot() {
  const classes = new Set<string>();
  return {
    classes,
    root: {
      classList: {
        toggle(name: string, force?: boolean) {
          if (force) classes.add(name);
          else classes.delete(name);
        },
      },
      style: { colorScheme: '' },
    },
  };
}

describe('app theme helpers', () => {
  test('normalizes and persists only supported app themes', () => {
    const storage = new MemoryStorage();

    expect(normalizeAppTheme('light')).toBe('light');
    expect(normalizeAppTheme('dark')).toBe('dark');
    expect(normalizeAppTheme('system')).toBe('dark');
    expect(readStoredAppTheme(storage)).toBe('dark');

    writeStoredAppTheme('light', storage);

    expect(storage.getItem(APP_THEME_STORAGE_KEY)).toBe('light');
    expect(readStoredAppTheme(storage)).toBe('light');
  });

  test('applies light and dark classes to the root element', () => {
    const { root, classes } = createThemeRoot();

    applyAppThemeToRoot(root, 'light');

    expect(classes.has('light')).toBe(true);
    expect(classes.has('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');

    applyAppThemeToRoot(root, 'dark');

    expect(classes.has('light')).toBe(false);
    expect(classes.has('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
  });
});

describe('app accent helpers', () => {
  test('normalizes only supported accents, defaulting otherwise', () => {
    expect(DEFAULT_APP_ACCENT).toBe('blue');
    expect(normalizeAppAccent('indigo')).toBe('indigo');
    expect(normalizeAppAccent('blue')).toBe('blue');
    expect(normalizeAppAccent('violet')).toBe('violet');
    expect(normalizeAppAccent('neutral')).toBe('neutral');
    expect(normalizeAppAccent('chartreuse')).toBe(DEFAULT_APP_ACCENT);
    expect(normalizeAppAccent(null)).toBe(DEFAULT_APP_ACCENT);
    expect(normalizeAppAccent(42)).toBe(DEFAULT_APP_ACCENT);
  });

  test('keeps neutral last in the accent picker', () => {
    expect(APP_ACCENTS).toEqual([
      'blue',
      'indigo',
      'violet',
      'rose',
      'orange',
      'green',
      'yellow',
      'neutral',
    ]);
    expect(APP_ACCENT_SWATCHES.indigo).toBe('#5046c1');
    expect(APP_ACCENT_SWATCHES.green).toBe('#2daf44');
  });

  test('persists and reads the accent, defaulting when unset', () => {
    const storage = new MemoryStorage();

    expect(readStoredAppAccent(storage)).toBe(DEFAULT_APP_ACCENT);

    writeStoredAppAccent('rose', storage);

    expect(storage.getItem(APP_ACCENT_STORAGE_KEY)).toBe('rose');
    expect(readStoredAppAccent(storage)).toBe('rose');
  });

  test('stamps the accent as a data attribute on the root element', () => {
    const attributes = new Map<string, string>();
    const root = {
      setAttribute(name: string, value: string) {
        attributes.set(name, value);
      },
    };

    applyAppAccentToRoot(root, 'green');
    expect(attributes.get('data-accent')).toBe('green');

    applyAppAccentToRoot(root, 'neutral');
    expect(attributes.get('data-accent')).toBe('neutral');
  });
});

describe('app surface helpers', () => {
  test('orders graphite, gray, and black and defaults to graphite', () => {
    expect(APP_SURFACES).toEqual(['graphite', 'gray', 'black']);
    expect(DEFAULT_APP_SURFACE).toBe('graphite');
    expect(normalizeAppSurface('black')).toBe('black');
    expect(normalizeAppSurface('gray')).toBe('gray');
    expect(normalizeAppSurface('graphite')).toBe('graphite');
    expect(normalizeAppSurface('indigo')).toBe(DEFAULT_APP_SURFACE);
    expect(normalizeAppSurface(null)).toBe(DEFAULT_APP_SURFACE);
  });

  test('persists and reads the surface palette separately from the accent', () => {
    const storage = new MemoryStorage();

    expect(readStoredAppSurface(storage)).toBe(DEFAULT_APP_SURFACE);

    writeStoredAppSurface('gray', storage);
    writeStoredAppAccent('rose', storage);

    expect(storage.getItem(APP_SURFACE_STORAGE_KEY)).toBe('gray');
    expect(storage.getItem(APP_ACCENT_STORAGE_KEY)).toBe('rose');
    expect(readStoredAppSurface(storage)).toBe('gray');
    expect(readStoredAppAccent(storage)).toBe('rose');

    writeStoredAppSurface('graphite', storage);

    expect(storage.getItem(APP_SURFACE_STORAGE_KEY)).toBe('graphite');
    expect(readStoredAppSurface(storage)).toBe('graphite');
  });

  test('stamps the surface palette as a data attribute on the root element', () => {
    const attributes = new Map<string, string>();
    const root = {
      setAttribute(name: string, value: string) {
        attributes.set(name, value);
      },
    };

    applyAppSurfaceToRoot(root, 'gray');
    expect(attributes.get('data-surface')).toBe('gray');

    applyAppSurfaceToRoot(root, 'graphite');
    expect(attributes.get('data-surface')).toBe('graphite');

    applyAppSurfaceToRoot(root, 'black');
    expect(attributes.get('data-surface')).toBe('black');
  });
});

describe('app brand mark helpers', () => {
  test('puts the text monogram first and uses it by default', () => {
    expect(APP_BRAND_MARKS).toEqual(['monogram', 'image']);
    expect(DEFAULT_APP_BRAND_MARK).toBe('monogram');
    expect(normalizeAppBrandMark('image')).toBe('image');
    expect(normalizeAppBrandMark('monogram')).toBe('monogram');
    expect(normalizeAppBrandMark('icon')).toBe(DEFAULT_APP_BRAND_MARK);
    expect(normalizeAppBrandMark(undefined)).toBe(DEFAULT_APP_BRAND_MARK);
  });

  test('persists and reads the brand mark mode independently', () => {
    const storage = new MemoryStorage();

    expect(readStoredAppBrandMark(storage)).toBe(DEFAULT_APP_BRAND_MARK);

    writeStoredAppBrandMark('image', storage);
    writeStoredAppSurface('gray', storage);

    expect(storage.getItem(APP_BRAND_MARK_STORAGE_KEY)).toBe('image');
    expect(storage.getItem(APP_SURFACE_STORAGE_KEY)).toBe('gray');
    expect(readStoredAppBrandMark(storage)).toBe('image');
  });
});

describe('DS Browser module preference', () => {
  test('defaults to disabled so the beta module ships hidden', () => {
    expect(DEFAULT_APP_DS_BROWSER_ENABLED).toBe(false);
    expect(readStoredDsBrowserEnabled(new MemoryStorage())).toBe(false);
  });

  test('uses the system default only until a personal override exists', () => {
    const storage = new MemoryStorage();
    expect(readStoredDsBrowserEnabled(storage, true)).toBe(true);

    writeStoredDsBrowserEnabled(false, storage);
    expect(readStoredDsBrowserEnabled(storage, true)).toBe(false);
  });

  test('normalizes only true/false, defaulting otherwise', () => {
    expect(normalizeDsBrowserEnabled('true')).toBe(true);
    expect(normalizeDsBrowserEnabled(true)).toBe(true);
    expect(normalizeDsBrowserEnabled('false')).toBe(false);
    expect(normalizeDsBrowserEnabled(false)).toBe(false);
    expect(normalizeDsBrowserEnabled('yes')).toBe(DEFAULT_APP_DS_BROWSER_ENABLED);
    expect(normalizeDsBrowserEnabled(null)).toBe(DEFAULT_APP_DS_BROWSER_ENABLED);
    expect(normalizeDsBrowserEnabled(1)).toBe(DEFAULT_APP_DS_BROWSER_ENABLED);
  });

  test('persists the opt-in as a string flag and reads it back', () => {
    const storage = new MemoryStorage();

    writeStoredDsBrowserEnabled(true, storage);
    expect(storage.getItem(APP_DS_BROWSER_STORAGE_KEY)).toBe('true');
    expect(readStoredDsBrowserEnabled(storage)).toBe(true);

    writeStoredDsBrowserEnabled(false, storage);
    expect(storage.getItem(APP_DS_BROWSER_STORAGE_KEY)).toBe('false');
    expect(readStoredDsBrowserEnabled(storage)).toBe(false);
  });
});

test('generative thumbnail is enabled until the user preference loads', () => {
  expect(DEFAULT_APP_GENERATIVE_THUMBNAIL_ENABLED).toBe(true);
});
