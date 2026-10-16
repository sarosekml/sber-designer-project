/** General settings panel (theme, accent color, and editor-wide preferences). */
import { useState } from 'react';
import { Check, Moon, RotateCcw, Sun } from 'lucide-react';
import { BrandMark, getBrandLogoSrc } from '@/components/brand/BrandMark';
import { updateGenerativeThumbnailPreference } from '@/lib/api/http';
import { cn } from '@/lib/utils';
import {
  APP_ACCENT_LABELS,
  APP_ACCENT_SWATCHES,
  APP_ACCENTS,
  APP_BRAND_MARK_LABELS,
  APP_BRAND_MARKS,
  APP_SURFACE_LABELS,
  APP_SURFACE_SWATCHES,
  APP_SURFACES,
  DEFAULT_APP_ACCENT,
  type AppAccent,
  type AppBrandMark,
  type AppTheme,
} from '@/lib/theme';
import { useThemeStore } from '@/stores/theme-store';
import { Badge, ProviderSwitch } from './shared';

// Accents whose swatch is light enough that a dark check mark reads better.
const DARK_CHECK_ACCENTS: ReadonlySet<AppAccent> = new Set<AppAccent>(['yellow']);
const BRAND_MARK_DESCRIPTIONS: Record<AppBrandMark, string> = {
  image: 'Accent logo',
  monogram: 'Monogram logo',
};

export function GeneralSettingsPanel() {
  const [generativeThumbnailSaving, setGenerativeThumbnailSaving] = useState(false);
  const [generativeThumbnailError, setGenerativeThumbnailError] = useState<string | null>(null);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);
  const surface = useThemeStore((s) => s.surface);
  const setSurface = useThemeStore((s) => s.setSurface);
  const brandMark = useThemeStore((s) => s.brandMark);
  const setBrandMark = useThemeStore((s) => s.setBrandMark);
  const dsBrowserEnabled = useThemeStore((s) => s.dsBrowserEnabled);
  const setDsBrowserEnabled = useThemeStore((s) => s.setDsBrowserEnabled);
  const generativeThumbnailEnabled = useThemeStore((s) => s.generativeThumbnailEnabled);
  const setGenerativeThumbnailEnabled = useThemeStore((s) => s.setGenerativeThumbnailEnabled);
  const options: { value: AppTheme; label: string; icon: typeof Moon }[] = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
  ];
  const changeGenerativeThumbnail = (enabled: boolean) => {
    const previous = generativeThumbnailEnabled;
    setGenerativeThumbnailEnabled(enabled);
    setGenerativeThumbnailSaving(true);
    setGenerativeThumbnailError(null);
    void updateGenerativeThumbnailPreference(enabled)
      .then((saved) => setGenerativeThumbnailEnabled(saved))
      .catch((error) => {
        setGenerativeThumbnailEnabled(previous);
        setGenerativeThumbnailError(
          error instanceof Error ? error.message : 'Could not save the preference.',
        );
      })
      .finally(() => setGenerativeThumbnailSaving(false));
  };

  return (
    <div className="grid min-w-0 gap-4">
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium">Theme</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose the sber-designer interface appearance.
            </p>
          </div>
          <div
            role="group"
            aria-label="Theme"
            className="inline-flex shrink-0 rounded-md border border-border bg-background p-0.5 text-sm"
          >
            {options.map((option) => {
              const Icon = option.icon;
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded px-3 transition-colors',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Surface palette</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Controls neutral backgrounds, borders, and hover surfaces.
            </p>
          </div>
        </div>
        <div role="group" aria-label="Surface palette" className="mt-4 flex flex-wrap gap-2.5">
          {APP_SURFACES.map((value) => {
            const selected = surface === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSurface(value)}
                aria-pressed={selected}
                aria-label={`${APP_SURFACE_LABELS[value]} surface`}
                title={APP_SURFACE_LABELS[value]}
                className={cn(
                  'relative flex size-8 items-center justify-center rounded-full border border-border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                  selected && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                )}
                style={{ backgroundColor: APP_SURFACE_SWATCHES[value] }}
              >
                {selected ? <Check className="size-4 text-white" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Brand mark</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose the accent-matched image or the D monogram.
            </p>
          </div>
        </div>
        <div role="group" aria-label="Brand mark" className="mt-4 flex flex-wrap gap-2">
          {APP_BRAND_MARKS.map((value) => {
            const selected = brandMark === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setBrandMark(value)}
                aria-pressed={selected}
                aria-label={BRAND_MARK_DESCRIPTIONS[value]}
                className={cn(
                  'grid min-w-[132px] flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {brandOptionPreview(value, accent)}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{APP_BRAND_MARK_LABELS[value]}</span>
                  <span className="block truncate text-[11px] opacity-70">
                    {BRAND_MARK_DESCRIPTIONS[value]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Accent color</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Sets the primary and focus-ring color across the editor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAccent(DEFAULT_APP_ACCENT)}
            disabled={accent === DEFAULT_APP_ACCENT}
            className="inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
        </div>
        <div role="group" aria-label="Accent color" className="mt-4 flex flex-wrap gap-2.5">
          {APP_ACCENTS.map((value) => {
            const selected = accent === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setAccent(value)}
                aria-pressed={selected}
                aria-label={`${APP_ACCENT_LABELS[value]} accent`}
                title={APP_ACCENT_LABELS[value]}
                className={cn(
                  'relative flex size-8 items-center justify-center rounded-full border border-border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                  selected && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                )}
                style={{ backgroundColor: APP_ACCENT_SWATCHES[value] }}
              >
                {selected ? (
                  <Check
                    className={cn(
                      'size-4',
                      DARK_CHECK_ACCENTS.has(value) ? 'text-black' : 'text-white',
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Generative thumbnail</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Use a screenshot of a generated screen as the project cover on Home, refreshed after
              each generation. This preference follows your user profile across sessions.
            </p>
            {generativeThumbnailError ? (
              <p className="mt-1 text-xs text-destructive">{generativeThumbnailError}</p>
            ) : null}
          </div>
          <ProviderSwitch
            enabled={generativeThumbnailEnabled}
            disabled={generativeThumbnailSaving}
            title={
              generativeThumbnailEnabled
                ? 'Use placeholder images for project covers'
                : 'Generate project covers from screens'
            }
            onChange={changeGenerativeThumbnail}
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">DS Browser</div>
              <Badge tone="warn">Beta</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              The Design System Browser is an in-progress beta. Enable it to show the DS Browser
              entry in the top bar; it stays hidden while off.
            </p>
          </div>
          <ProviderSwitch
            enabled={dsBrowserEnabled}
            disabled={false}
            title={dsBrowserEnabled ? 'Hide the beta DS Browser' : 'Show the beta DS Browser'}
            onChange={setDsBrowserEnabled}
          />
        </div>
      </div>
    </div>
  );
}

function brandOptionPreview(value: AppBrandMark, accent: AppAccent) {
  if (value === 'image') {
    return (
      <img
        aria-hidden="true"
        alt=""
        draggable={false}
        src={getBrandLogoSrc(accent)}
        className="size-8 shrink-0 rounded-[5px] object-cover"
      />
    );
  }

  return <BrandMark className="size-8" />;
}
