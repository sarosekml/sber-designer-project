import { Hono } from 'hono';

import { loadBuildInfo, type BuildInfo } from '../build-info';

type BuildInfoLoader = () => BuildInfo;

export function createVersionRouter(load: BuildInfoLoader = loadBuildInfo): Hono {
  const router = new Hono();

  router.get('/', (c) => {
    try {
      return c.json(load());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[api] build info unavailable: ${message}\n`);
      return c.json(
        {
          error: 'build_info_unavailable',
          detail: 'Build metadata is unavailable. Run the repository build step before serving.',
        },
        503,
      );
    }
  });

  return router;
}

function startupBuildInfoLoader(): BuildInfoLoader {
  try {
    const buildInfo = loadBuildInfo();
    return () => buildInfo;
  } catch (error) {
    return () => {
      throw error;
    };
  }
}

// Snapshot metadata at process start so /api/version identifies the running
// API process even while a newer BUILD_INFO.json is staged during an update.
export const versionRouter = createVersionRouter(startupBuildInfoLoader());
