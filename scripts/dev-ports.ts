import { createServer } from 'node:net';

const DEFAULT_API_PORT = 3000;
const DEFAULT_SANDBOX_PORT = 3001;
const DEFAULT_WEB_PORT = 5173;
const MAX_PORT_PROBES = 50;

export interface DevPorts {
  apiPort: number;
  sandboxPort: number;
  webPort: number;
  apiEnv: NodeJS.ProcessEnv;
  sandboxEnv: NodeJS.ProcessEnv;
  webEnv: NodeJS.ProcessEnv;
}

export interface ResolveDevPortsOptions {
  env?: NodeJS.ProcessEnv;
  isPortAvailable?: (port: number) => Promise<boolean>;
}

export async function resolveDevPorts(options: ResolveDevPortsOptions = {}): Promise<DevPorts> {
  const env = options.env ?? process.env;
  const isPortAvailable = options.isPortAvailable ?? portAvailable;
  const requestedSandboxPort =
    parsePortFromUrl(env.SBER_DESIGNER_SANDBOX_URL) ?? DEFAULT_SANDBOX_PORT;
  const sandboxPort = await pickAvailablePort(requestedSandboxPort, isPortAvailable);
  const apiPort = await pickAvailablePort(
    parsePort(env.PORT, DEFAULT_API_PORT),
    isPortAvailable,
    new Set([sandboxPort]),
  );
  const webPort = await pickAvailablePort(
    parsePort(env.VITE_PORT, DEFAULT_WEB_PORT),
    isPortAvailable,
    new Set([apiPort, sandboxPort]),
  );

  const sandboxUrl = `http://localhost:${sandboxPort}`;
  const apiUrl = `http://localhost:${apiPort}`;

  return {
    apiPort,
    sandboxPort,
    webPort,
    apiEnv: {
      PORT: String(apiPort),
      SBER_DESIGNER_SANDBOX_URL: sandboxUrl,
    },
    sandboxEnv: {
      PORT: String(sandboxPort),
    },
    webEnv: {
      VITE_API_URL: env.VITE_API_URL ?? apiUrl,
      VITE_PORT: String(webPort),
    },
  };
}

export async function pickAvailablePort(
  startPort: number,
  isPortAvailable: (port: number) => Promise<boolean> = portAvailable,
  reservedPorts = new Set<number>(),
): Promise<number> {
  for (let offset = 0; offset < MAX_PORT_PROBES; offset += 1) {
    const port = startPort + offset;
    if (reservedPorts.has(port)) continue;
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(
    `No available port found from ${startPort} to ${startPort + MAX_PORT_PROBES - 1}`,
  );
}

async function portAvailable(port: number): Promise<boolean> {
  return canListen(port);
}

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return fallback;
  return port;
}

function parsePortFromUrl(value: string | undefined): number | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!url.port) return null;
    return parsePort(url.port, DEFAULT_SANDBOX_PORT);
  } catch {
    return null;
  }
}
