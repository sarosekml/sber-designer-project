import { useEffect } from 'react';
import {
  BUILTIN_DEFAULTS,
  parseConfig,
  shouldPresentDirectionPicker,
} from '@sber-designer/llm-gateway';
import {
  resolveGenerationPipelineDefaults,
  resolveScreenReadinessProfile,
} from '@sber-designer/shared-types';

import { ApiError, fetchConfig, withSignal } from '@/lib/api-client';
import { DEFAULT_APP_GENERATIVE_THUMBNAIL_ENABLED } from '@/lib/theme';
import { useEditorStore } from '@/stores/editor-store';
import { useThemeStore } from '@/stores/theme-store';

/**
 * Loads the project's sber-designer.json on mount.
 *
 * Resolution order:
 *   1. services/api at GET /api/config — server-resolved env-vars,
 *      secrets stripped (the production path, ADR-0009).
 *   2. /sber-designer.json from apps/web/public/ — PoC-2 fallback so
 *      the editor still opens without the api running. apiKey will be
 *      a `{env:VAR}` placeholder; chat will refuse cleanly.
 *   3. BUILTIN_DEFAULTS (mock provider only) on hard failure.
 */
export function useConfigLoader() {
  const setConfig = useEditorStore((s) => s.setConfig);
  const setGenerationDefaults = useEditorStore((s) => s.setGenerationDefaults);
  const setScreenReadiness = useEditorStore((s) => s.setScreenReadiness);
  const applyDsBrowserDefault = useThemeStore((s) => s.applyDsBrowserDefault);
  const setGenerativeThumbnailEnabled = useThemeStore((s) => s.setGenerativeThumbnailEnabled);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      // 1. live api
      try {
        const cfg = await fetchConfig(ac.signal);
        if (!cancelled) {
          applyDsBrowserDefault(cfg.system?.dsBrowser.defaultEnabled ?? false);
          setGenerativeThumbnailEnabled(
            cfg.preferences?.generativeThumbnailEnabled ?? DEFAULT_APP_GENERATIVE_THUMBNAIL_ENABLED,
          );
          setGenerationDefaults(
            resolveGenerationPipelineDefaults(
              cfg.preferences?.generationPipeline?.generationDefaults,
              shouldPresentDirectionPicker(cfg, 'screen'),
            ),
          );
          setScreenReadiness(
            resolveScreenReadinessProfile(cfg.preferences?.generationPipeline?.screenReadiness),
          );
          setConfig(cfg);
        }
        return;
      } catch (err) {
        if (cancelled) return;
        // Fall through unless the request was aborted by unmount.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }

      // 2. static fallback
      try {
        const res = await fetch('/sber-designer.json', withSignal({}, ac.signal));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = (await res.json()) as unknown;
        const cfg = parseConfig(raw, { env: {}, strictEnv: false });
        if (!cancelled) {
          applyDsBrowserDefault(false);
          setGenerativeThumbnailEnabled(DEFAULT_APP_GENERATIVE_THUMBNAIL_ENABLED);
          setGenerationDefaults(
            resolveGenerationPipelineDefaults(
              undefined,
              shouldPresentDirectionPicker(cfg, 'screen'),
            ),
          );
          setScreenReadiness(resolveScreenReadinessProfile());
          setConfig(
            cfg,
            'services/api unreachable — using static fallback. Chat will be disabled until the api is running.',
          );
        }
        return;
      } catch (err) {
        if (cancelled) return;
        // 3. last resort
        const message =
          err instanceof ApiError
            ? `${err.code ?? 'api_error'}: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        applyDsBrowserDefault(false);
        setGenerativeThumbnailEnabled(DEFAULT_APP_GENERATIVE_THUMBNAIL_ENABLED);
        setGenerationDefaults(
          resolveGenerationPipelineDefaults(
            undefined,
            shouldPresentDirectionPicker(BUILTIN_DEFAULTS, 'screen'),
          ),
        );
        setScreenReadiness(resolveScreenReadinessProfile());
        setConfig(BUILTIN_DEFAULTS, `Failed to load config (${message}); using built-in defaults.`);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [
    applyDsBrowserDefault,
    setConfig,
    setGenerationDefaults,
    setGenerativeThumbnailEnabled,
    setScreenReadiness,
  ]);
}
