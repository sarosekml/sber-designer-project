# @sber-designer/sandbox

Dev-server controller. Two drivers under one REST surface:

- **local** (default) — `child_process.spawn` on the host. Fast iteration,
  no Docker dependency. ADR-0008.
- **docker** — runs the user's dev-server inside an `sd-sandbox`
  container with the workspace bind-mounted and `node_modules` in a
  named volume. Isolation, reproducible env, ready for on-prem.

The editor talks to this service **through `services/api`**
(`/api/sandbox/*`) — direct browser-to-controller calls are deprecated.

## Run (local driver)

```bash
bun --cwd services/sandbox run dev    # default port 3001
```

```bash
curl localhost:3001/health
# → { "ok": true, "driver": "local", "sessions": 0 }
```

## Run (Docker driver)

Build the sandbox image once:

```bash
docker build -t sd-sandbox:latest services/sandbox
```

Then start the controller with the Docker driver:

```bash
SBER_DESIGNER_SANDBOX_DRIVER=docker \
  bun --cwd services/sandbox run dev
```

Per-session container:

- Name: `sd-<sessionId-prefix>`
- Bind: `<workspacePath>:/work`
- Volume: `sd-modules-<sessionId-prefix>` for `/work/node_modules`
- Port: container's `:6006` published to a random host port
- Image override: `SBER_DESIGNER_SANDBOX_IMAGE` env-var

The docker driver also pre-pulls the configured image in the background
and exposes a warm-cache count on `/health`.

> Bind to localhost or a VPC-internal address. Public exposure should
> happen through services/api so auth and audit pass through one edge.

## REST API

| Method · Path              | Body                                 | Result                   |
| -------------------------- | ------------------------------------ | ------------------------ |
| `POST /api/sessions`       | `{ workspacePath, command?, args? }` | `SessionInfo` (HTTP 201) |
| `GET /api/sessions`        | —                                    | `SessionInfo[]`          |
| `GET /api/sessions/:id`    | —                                    | `SessionInfo`            |
| `DELETE /api/sessions/:id` | —                                    | 204                      |

`SessionInfo` shape:

```ts
{
  id: string;
  workspacePath: string;
  command: string;        // 'bun'
  args: string[];         // ['run', 'storybook']
  port: number;           // OS-allocated free port
  status: 'starting' | 'ready' | 'failed' | 'stopped';
  previewUrl: string | null;  // populated on the "ready" log line
  logsTail: string[];
  startedAt: number;
  readyAt: number | null;
  errorMessage: string | null;
  diagnostics: {
    reason:
      | 'binary_missing'
      | 'dependencies_missing'
      | 'package_install_blocked'
      | 'script_failed'
      | 'ready_timeout';
    severity: 'warning' | 'error';
    message: string;
    command: string;
    evidence: string[];
    suggestedAction: string;
    registry?: string;
  } | null;
}
```

Defaults: `command = 'bun'`, `args = ['run', 'storybook']`.

Diagnostics are heuristic and intentionally actionable. For example,
`storybook: command not found` becomes `binary_missing`; blocked internal
registry logs with HTTP 403 become `package_install_blocked` and preserve the
registry/evidence lines for the editor overlay and support handoff.

## Try it

```bash
# T1
bun --cwd services/sandbox run dev

# T2
curl -sS localhost:3001/api/sessions \
  -H 'content-type: application/json' \
  -d "{\"workspacePath\":\"$(pwd)/examples/sample-storybook\"}"
# → { "id": "...", "status": "starting", "previewUrl": null, ... }

curl -sS localhost:3001/api/sessions
# → on 'ready', previewUrl is "http://localhost:<port>"
```

## Current gaps

- Idle eviction and full prewarmed session pools.
- SSE log stream (`GET /api/sessions/:id/events`).
- `git clone` from a Git URL — today only local paths are accepted.
- AuthZ inside the controller. The browser should go through
  `services/api`, where auth and audit are enforced.
