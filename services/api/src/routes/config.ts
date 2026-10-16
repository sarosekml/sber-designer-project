import { Hono } from 'hono';
import type { SberDesignerConfig } from '@sber-designer/llm-gateway';

import { authMode, getAuthStore } from '../auth';
import { type AuthMode, type SystemSettings } from '../auth';
import { DEFAULT_SYSTEM_SETTINGS } from '../auth/types';
import { configRevisionOf, loadConfig, toFrontendConfig } from '../config-store';
import {
  runProviderConnectionTest,
  type ProviderConnectionTestOutcome,
  type ProviderConnectionTestTarget,
} from '../provider-diagnostics';
import {
  UserGenerativeThumbnailPatchSchema,
  UserGenerationPipelinePatchSchema,
  readUserSettings,
  requestStorageIdentity,
  updateUserGenerativeThumbnail,
  updateUserGenerationPipeline,
} from '../user-storage';

/**
 * GET /api/config — frontend-safe view of sber-designer.json + auth
 * advertisement.
 *
 * The full config (with resolved secrets) stays on the server. The
 * browser receives provider/model metadata only, with apiKey/headers
 * replaced by `__configured__` / `__missing__` sentinels so the
 * Settings UI can show a status badge.
 *
 * The `auth` field advertises the active `local | password | oidc` mode.
 * Local uses x-sber-designer-user, password uses the HttpOnly session
 * cookie, and OIDC uses an Authorization bearer JWT.
 */
export interface ConfigRouterDependencies {
  loadConfig: () => Promise<SberDesignerConfig>;
  readSystemSettings: () => Promise<SystemSettings>;
  authMode: () => AuthMode;
  readUserSettings: typeof readUserSettings;
  updateUserGenerativeThumbnail: typeof updateUserGenerativeThumbnail;
  updateUserGenerationPipeline: typeof updateUserGenerationPipeline;
  /** Overridable connection-test runner (route tests inject fakes). */
  runConnectionTest: (
    cfg: SberDesignerConfig,
    target: ProviderConnectionTestTarget,
  ) => Promise<ProviderConnectionTestOutcome>;
}

export function createConfigRouter(dependencies: Partial<ConfigRouterDependencies> = {}): Hono {
  const resolvedDependencies: ConfigRouterDependencies = {
    loadConfig,
    readSystemSettings: () => getAuthStore().readSystemSettings(),
    authMode,
    readUserSettings,
    updateUserGenerativeThumbnail,
    updateUserGenerationPipeline,
    runConnectionTest: (cfg, target) => runProviderConnectionTest(cfg, target),
    ...dependencies,
  };

  return (
    new Hono()
      .get('/', async (c) => {
        try {
          const cfg = await resolvedDependencies.loadConfig();
          const mode = resolvedDependencies.authMode();
          const settings =
            mode === 'local'
              ? DEFAULT_SYSTEM_SETTINGS
              : await resolvedDependencies.readSystemSettings();
          const userSettings = await resolvedDependencies.readUserSettings(
            requestStorageIdentity(c),
          );
          return c.json({
            ...toFrontendConfig(cfg),
            // Opaque server revision (review R4): lets the browser notice
            // endpoint/auth changes made while Settings is open. A hash over
            // the whole resolved config — never a hash of a single secret.
            configRevision: configRevisionOf(cfg),
            auth: mode,
            system: { dsBrowser: settings.dsBrowser },
            preferences: {
              generationPipeline: userSettings.generationPipeline ?? {},
              generativeThumbnailEnabled: userSettings.generativeThumbnailEnabled ?? true,
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return c.json({ error: 'config_load_failed', detail: message }, 500);
        }
      })
      .put('/generation-pipeline', async (c) => {
        const body = await c.req.json().catch(() => null);
        const parsed = UserGenerationPipelinePatchSchema.safeParse(body);
        if (!parsed.success) {
          return c.json(
            {
              error: 'invalid_generation_pipeline_preferences',
              detail: parsed.error.issues.map((issue) => issue.message).join('; '),
            },
            400,
          );
        }
        try {
          const settings = await resolvedDependencies.updateUserGenerationPipeline(
            requestStorageIdentity(c),
            parsed.data,
          );
          return c.json({ generationPipeline: settings.generationPipeline ?? {} });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return c.json({ error: 'generation_pipeline_save_failed', detail: message }, 500);
        }
      })
      .put('/generative-thumbnail', async (c) => {
        const parsed = UserGenerativeThumbnailPatchSchema.safeParse(
          await c.req.json().catch(() => null),
        );
        if (!parsed.success) {
          return c.json(
            {
              error: 'invalid_generative_thumbnail_preference',
              detail: parsed.error.issues.map((issue) => issue.message).join('; '),
            },
            400,
          );
        }
        try {
          const settings = await resolvedDependencies.updateUserGenerativeThumbnail(
            requestStorageIdentity(c),
            parsed.data.enabled,
          );
          return c.json({ enabled: settings.generativeThumbnailEnabled ?? true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return c.json({ error: 'generative_thumbnail_save_failed', detail: message }, 500);
        }
      })
      /**
       * POST /api/config/test-connection — explicit Settings action (0139 C).
       *
       * The body carries provider/model ids only: endpoints, keys, and admin
       * restrictions are resolved from the loaded server config, so the route
       * can never be used as an arbitrary-endpoint/credential prober. Runs one
       * short tool-free chat completion; never invoked by merely opening
       * Settings or refreshing config.
       */
      .post('/test-connection', async (c) => {
        const body = (await c.req.json().catch(() => null)) as {
          provider?: unknown;
          model?: unknown;
        } | null;
        const providerId = typeof body?.provider === 'string' ? body.provider.trim() : '';
        const modelId = typeof body?.model === 'string' ? body.model.trim() : '';
        if (!providerId || !modelId) {
          return c.json(
            {
              error: 'invalid_connection_test_request',
              detail: 'provider and model ids are required.',
            },
            400,
          );
        }

        let cfg: SberDesignerConfig;
        try {
          cfg = await resolvedDependencies.loadConfig();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return c.json({ error: 'config_load_failed', detail: message }, 500);
        }

        const provider = cfg.provider[providerId];
        if (!provider) {
          return c.json(
            { error: 'unknown_provider', detail: `Provider "${providerId}" is not configured.` },
            404,
          );
        }
        if (provider.type !== 'openai-compatible' && provider.type !== 'anthropic') {
          return c.json(
            {
              error: 'provider_type_not_testable',
              detail: `Providers of type "${provider.type}" do not support connection testing.`,
            },
            400,
          );
        }
        if (provider.models && !(modelId in provider.models)) {
          return c.json(
            {
              error: 'unknown_model',
              detail: `Model "${modelId}" is not configured for provider "${providerId}".`,
            },
            404,
          );
        }
        const restrict = cfg.agent.restrict;
        if (restrict?.enabled) {
          if (restrict.providers && !restrict.providers.includes(providerId)) {
            return c.json(
              { error: 'provider_not_allowed', detail: 'Admin restriction hides this provider.' },
              403,
            );
          }
          if (restrict.models && !restrict.models.includes(modelId)) {
            return c.json(
              { error: 'model_not_allowed', detail: 'Admin restriction hides this model.' },
              403,
            );
          }
        }

        const outcome = await resolvedDependencies.runConnectionTest(cfg, {
          provider: providerId,
          model: modelId,
        });
        return c.json(outcome);
      })
  );
}

export const configRouter = createConfigRouter();
