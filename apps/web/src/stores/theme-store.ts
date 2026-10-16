import { create } from 'zustand';

import {
  applyAppAccent,
  applyAppSurface,
  applyAppTheme,
  DEFAULT_APP_GENERATIVE_THUMBNAIL_ENABLED,
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
  type AppAccent,
  type AppBrandMark,
  type AppSurface,
  type AppTheme,
} from '@/lib/theme';

interface ThemeStoreState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  accent: AppAccent;
  setAccent: (accent: AppAccent) => void;
  surface: AppSurface;
  setSurface: (surface: AppSurface) => void;
  brandMark: AppBrandMark;
  setBrandMark: (brandMark: AppBrandMark) => void;
  /** Whether the beta DS Browser module is shown in the editor chrome. */
  dsBrowserEnabled: boolean;
  setDsBrowserEnabled: (enabled: boolean) => void;
  applyDsBrowserDefault: (enabled: boolean) => void;
  /** Whether Home covers are generated from screens (0135). */
  generativeThumbnailEnabled: boolean;
  setGenerativeThumbnailEnabled: (enabled: boolean) => void;
}

export const useThemeStore = create<ThemeStoreState>((set) => ({
  theme: readStoredAppTheme(),
  setTheme: (theme) => {
    writeStoredAppTheme(theme);
    applyAppTheme(theme);
    set({ theme });
  },
  accent: readStoredAppAccent(),
  setAccent: (accent) => {
    writeStoredAppAccent(accent);
    applyAppAccent(accent);
    set({ accent });
  },
  surface: readStoredAppSurface(),
  setSurface: (surface) => {
    writeStoredAppSurface(surface);
    applyAppSurface(surface);
    set({ surface });
  },
  brandMark: readStoredAppBrandMark(),
  setBrandMark: (brandMark) => {
    writeStoredAppBrandMark(brandMark);
    set({ brandMark });
  },
  dsBrowserEnabled: readStoredDsBrowserEnabled(),
  setDsBrowserEnabled: (enabled) => {
    writeStoredDsBrowserEnabled(enabled);
    set({ dsBrowserEnabled: enabled });
  },
  applyDsBrowserDefault: (enabled) => {
    set({ dsBrowserEnabled: readStoredDsBrowserEnabled(undefined, enabled) });
  },
  generativeThumbnailEnabled: DEFAULT_APP_GENERATIVE_THUMBNAIL_ENABLED,
  setGenerativeThumbnailEnabled: (enabled) => {
    set({ generativeThumbnailEnabled: enabled });
  },
}));
