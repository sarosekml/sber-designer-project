export type AppTheme = 'dark' | 'light';

export const APP_THEME_STORAGE_KEY = 'sber-designer.theme';
export const DEFAULT_APP_THEME: AppTheme = 'dark';

/**
 * Accent (brand / primary) color of the editor chrome. Orthogonal to the
 * light/dark theme: the theme drives surfaces, the accent drives `--primary`
 * and `--ring`. The applied color lives in styles.css under the matching
 * `:root[data-accent='…']` rule; this module only persists the choice and
 * stamps the attribute. Editor-only — the sandbox iframe renders the
 * connected project with its own document and is unaffected.
 */
export const APP_ACCENTS = [
  'blue',
  'indigo',
  'violet',
  'rose',
  'orange',
  'green',
  'yellow',
  'neutral',
] as const;
export type AppAccent = (typeof APP_ACCENTS)[number];

export const APP_ACCENT_STORAGE_KEY = 'sber-designer.accent';
// Users without a stored preference get the original blue brand accent; stored
// choices remain untouched and keep their selected accent.
export const DEFAULT_APP_ACCENT: AppAccent = 'blue';

/** Human label for each accent, shown in Settings → General. */
export const APP_ACCENT_LABELS: Record<AppAccent, string> = {
  indigo: 'Indigo',
  neutral: 'Neutral',
  blue: 'Blue',
  violet: 'Violet',
  rose: 'Rose',
  orange: 'Orange',
  green: 'Green',
  yellow: 'Yellow',
};

/**
 * Representative swatch color for the picker dot only. Keep in sync with the
 * `--primary` values in styles.css; the source of truth for the applied color
 * is the CSS rule, this is just the affordance. Neutral uses a mid-grey so the
 * dot reads in both light and dark.
 */
export const APP_ACCENT_SWATCHES: Record<AppAccent, string> = {
  indigo: '#5046c1',
  blue: 'oklch(0.623 0.214 259.815)',
  violet: 'oklch(0.606 0.25 292.717)',
  rose: 'oklch(0.645 0.246 16.439)',
  orange: 'oklch(0.646 0.222 41.116)',
  green: '#2daf44',
  yellow: 'oklch(0.795 0.184 86.047)',
  neutral: 'oklch(0.55 0 0)',
};

/**
 * Neutral surface palette for editor chrome. This is independent from the
 * brand accent: `graphite` is the softer default with elevated cards, `gray`
 * uses zinc-tinted UI surfaces, and `black` restores the original neutrals.
 */
export const APP_SURFACES = ['graphite', 'gray', 'black'] as const;
export type AppSurface = (typeof APP_SURFACES)[number];

export const APP_SURFACE_STORAGE_KEY = 'sber-designer.surface';
export const DEFAULT_APP_SURFACE: AppSurface = 'graphite';

export const APP_SURFACE_LABELS: Record<AppSurface, string> = {
  graphite: 'Graphite',
  gray: 'Gray',
  black: 'Black',
};

export const APP_SURFACE_SWATCHES: Record<AppSurface, string> = {
  graphite: 'oklch(0.209 0 0)',
  gray: 'oklch(0.141 0.005 285.823)',
  black: 'oklch(0.145 0 0)',
};

/** Brand mark rendering mode for the product chrome. */
export const APP_BRAND_MARKS = ['monogram', 'image'] as const;
export type AppBrandMark = (typeof APP_BRAND_MARKS)[number];

export const APP_BRAND_MARK_STORAGE_KEY = 'sber-designer.brand-mark';
export const DEFAULT_APP_BRAND_MARK: AppBrandMark = 'monogram';

export const APP_BRAND_MARK_LABELS: Record<AppBrandMark, string> = {
  monogram: 'Monogram',
  image: 'Image',
};

interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ThemeRoot {
  classList: {
    toggle(name: string, force?: boolean): void;
  };
  style?: {
    colorScheme?: string;
  };
}

export function normalizeAppTheme(value: unknown): AppTheme {
  return value === 'light' || value === 'dark' ? value : DEFAULT_APP_THEME;
}

export function readStoredAppTheme(storage = browserLocalStorage()): AppTheme {
  if (!storage) return DEFAULT_APP_THEME;
  try {
    return normalizeAppTheme(storage.getItem(APP_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export function writeStoredAppTheme(theme: AppTheme, storage = browserLocalStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(APP_THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore private-mode / quota failures; the current session still updates.
  }
}

export function applyAppTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  applyAppThemeToRoot(document.documentElement, theme);
}

export function applyStoredAppTheme(): AppTheme {
  const theme = readStoredAppTheme();
  applyAppTheme(theme);
  return theme;
}

export function applyAppThemeToRoot(root: ThemeRoot, theme: AppTheme): void {
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme === 'dark');
  if (root.style) root.style.colorScheme = theme;
}

interface AttributeRoot {
  setAttribute(name: string, value: string): void;
}

export function normalizeAppAccent(value: unknown): AppAccent {
  return typeof value === 'string' && (APP_ACCENTS as readonly string[]).includes(value)
    ? (value as AppAccent)
    : DEFAULT_APP_ACCENT;
}

export function readStoredAppAccent(storage = browserLocalStorage()): AppAccent {
  if (!storage) return DEFAULT_APP_ACCENT;
  try {
    return normalizeAppAccent(storage.getItem(APP_ACCENT_STORAGE_KEY));
  } catch {
    return DEFAULT_APP_ACCENT;
  }
}

export function writeStoredAppAccent(accent: AppAccent, storage = browserLocalStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(APP_ACCENT_STORAGE_KEY, accent);
  } catch {
    // Ignore private-mode / quota failures; the current session still updates.
  }
}

export function applyAppAccent(accent: AppAccent): void {
  if (typeof document === 'undefined') return;
  applyAppAccentToRoot(document.documentElement, accent);
}

export function applyStoredAppAccent(): AppAccent {
  const accent = readStoredAppAccent();
  applyAppAccent(accent);
  return accent;
}

export function applyAppAccentToRoot(root: AttributeRoot, accent: AppAccent): void {
  root.setAttribute('data-accent', accent);
}

export function normalizeAppSurface(value: unknown): AppSurface {
  return typeof value === 'string' && (APP_SURFACES as readonly string[]).includes(value)
    ? (value as AppSurface)
    : DEFAULT_APP_SURFACE;
}

export function readStoredAppSurface(storage = browserLocalStorage()): AppSurface {
  if (!storage) return DEFAULT_APP_SURFACE;
  try {
    return normalizeAppSurface(storage.getItem(APP_SURFACE_STORAGE_KEY));
  } catch {
    return DEFAULT_APP_SURFACE;
  }
}

export function writeStoredAppSurface(surface: AppSurface, storage = browserLocalStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(APP_SURFACE_STORAGE_KEY, surface);
  } catch {
    // Ignore private-mode / quota failures; the current session still updates.
  }
}

export function applyAppSurface(surface: AppSurface): void {
  if (typeof document === 'undefined') return;
  applyAppSurfaceToRoot(document.documentElement, surface);
}

export function applyStoredAppSurface(): AppSurface {
  const surface = readStoredAppSurface();
  applyAppSurface(surface);
  return surface;
}

export function applyAppSurfaceToRoot(root: AttributeRoot, surface: AppSurface): void {
  root.setAttribute('data-surface', surface);
}

export function normalizeAppBrandMark(value: unknown): AppBrandMark {
  return typeof value === 'string' && (APP_BRAND_MARKS as readonly string[]).includes(value)
    ? (value as AppBrandMark)
    : DEFAULT_APP_BRAND_MARK;
}

export function readStoredAppBrandMark(storage = browserLocalStorage()): AppBrandMark {
  if (!storage) return DEFAULT_APP_BRAND_MARK;
  try {
    return normalizeAppBrandMark(storage.getItem(APP_BRAND_MARK_STORAGE_KEY));
  } catch {
    return DEFAULT_APP_BRAND_MARK;
  }
}

export function writeStoredAppBrandMark(
  brandMark: AppBrandMark,
  storage = browserLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(APP_BRAND_MARK_STORAGE_KEY, brandMark);
  } catch {
    // Ignore private-mode / quota failures; the current session still updates.
  }
}

/**
 * DS Browser module visibility. The Design System Browser is still a beta
 * surface, so it ships disabled: the editor chrome hides its entry point until
 * a user opts in from Settings → General. Editor-only browser-local preference
 * — it never touches the connected project (CLAUDE.md rule 11), so a boolean in
 * localStorage is the right home rather than `.sdproj` metadata.
 */
export const APP_DS_BROWSER_STORAGE_KEY = 'sber-designer.ds-browser-enabled';
export const DEFAULT_APP_DS_BROWSER_ENABLED = false;

export function normalizeDsBrowserEnabled(value: unknown): boolean {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return DEFAULT_APP_DS_BROWSER_ENABLED;
}

export function readStoredDsBrowserEnabled(
  storage = browserLocalStorage(),
  defaultEnabled = DEFAULT_APP_DS_BROWSER_ENABLED,
): boolean {
  if (!storage) return defaultEnabled;
  try {
    const stored = storage.getItem(APP_DS_BROWSER_STORAGE_KEY);
    return stored === null ? defaultEnabled : normalizeDsBrowserEnabled(stored);
  } catch {
    return defaultEnabled;
  }
}

export function writeStoredDsBrowserEnabled(
  enabled: boolean,
  storage = browserLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(APP_DS_BROWSER_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore private-mode / quota failures; the current session still updates.
  }
}

export const DEFAULT_APP_GENERATIVE_THUMBNAIL_ENABLED = true;

function browserLocalStorage(): ThemeStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage ?? null;
}
