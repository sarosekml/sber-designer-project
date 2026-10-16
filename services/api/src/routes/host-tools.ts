import { Hono } from 'hono';
import { z } from 'zod';

import {
  HOST_APP_IDS,
  type DeploymentMode,
  type HostAppId,
  type HostAppsResponse,
  type HostPlatform,
  type OpenInHostAppResponse,
} from '@sber-designer/shared-types';

import { resolveDeploymentMode } from '../deployment-mode';
import {
  currentHostPlatform,
  hostAppAppliesToPlatform,
  hostAppCatalogueEntry,
  launchHostApp,
  listHostApps,
  resolveHostAppLaunchPlan,
  type HostAppLaunchPlan,
} from '../host-tools';
import { requestWorkspacePath } from '../workspace-context';

type Platform = HostPlatform | 'unknown';

interface HostToolsRouterDependencies {
  deploymentMode: () => DeploymentMode;
  workspacePath: () => string | null | undefined;
  platform: () => Platform;
  listApps: (platform: Platform) => Promise<HostAppsResponse>;
  resolveLaunchPlan: (
    appId: HostAppId,
    workspacePath: string,
    platform: Platform,
  ) => Promise<HostAppLaunchPlan>;
  launch: (
    command: string,
    args: string[],
    platform: Platform,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const OpenInHostAppSchema = z.object({ appId: z.enum(HOST_APP_IDS) }).strict();

const DEFAULT_DEPENDENCIES: HostToolsRouterDependencies = {
  deploymentMode: resolveDeploymentMode,
  workspacePath: requestWorkspacePath,
  platform: currentHostPlatform,
  listApps: (platform) => listHostApps({ platform }),
  resolveLaunchPlan: (appId, workspacePath, platform) =>
    resolveHostAppLaunchPlan(appId, workspacePath, { platform }),
  launch: (command, args, platform) => launchHostApp(command, args, { platform }),
};

export function createHostToolsRouter(overrides: Partial<HostToolsRouterDependencies> = {}): Hono {
  const deps = { ...DEFAULT_DEPENDENCIES, ...overrides };
  const router = new Hono();

  router.get('/apps', async (c) => {
    if (deps.deploymentMode() === 'server') {
      return c.json(
        { error: 'host_tools_disabled', detail: 'Host applications are local-only.' },
        403,
      );
    }
    return c.json(await deps.listApps(deps.platform()));
  });

  router.post('/open-in', async (c) => {
    if (deps.deploymentMode() === 'server') {
      return c.json(
        { error: 'host_tools_disabled', detail: 'Host applications are local-only.' },
        403,
      );
    }

    const body = await c.req.json().catch(() => null);
    const parsed = OpenInHostAppSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'bad_request', detail: 'Choose a known host application.' }, 400);
    }

    const platform = deps.platform();
    const entry = hostAppCatalogueEntry(parsed.data.appId);
    if (!entry || !hostAppAppliesToPlatform(entry, platform)) {
      return c.json(
        { error: 'bad_request', detail: 'This application is not supported on the host platform.' },
        400,
      );
    }

    const workspacePath = deps.workspacePath();
    if (!workspacePath) {
      return c.json(
        { error: 'no_active_project', detail: 'Connect a project before opening a host app.' },
        404,
      );
    }

    const plan = await deps.resolveLaunchPlan(parsed.data.appId, workspacePath, platform);
    if (!plan.available || !plan.command || !plan.args) {
      return c.json(
        { error: 'app_not_available', detail: `${entry.label} is not installed.` },
        409,
      );
    }

    const launched = await deps.launch(plan.command, plan.args, platform);
    if (!launched.ok) {
      return c.json(
        {
          error: 'launch_failed',
          detail: `Failed to launch ${entry.label}: ${launched.error}`,
        },
        500,
      );
    }

    const response: OpenInHostAppResponse = {
      ok: true,
      appId: parsed.data.appId,
      path: workspacePath,
    };
    return c.json(response);
  });

  return router;
}

export const hostToolsRouter = createHostToolsRouter();
