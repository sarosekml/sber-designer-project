# Connect a project to the editor (PoC-3)

> Phase 0 — local-spawn sandbox. Docker-per-session and `git clone`
> arrive in Phase 1 (see [ADR-0008](../architecture/adr/0008-local-spawn-sandbox.md)).

## What you need

- The sber-designer monorepo cloned, `bun install` run at the root.
- A target React project on disk that:
  - has a `bun run storybook` (or another command — see "Custom command")
  - is built with **Vite** (Storybook 8 with `@storybook/react-vite`,
    or any React+Vite app). Webpack-based Storybook works too, but loses
    Fiber `__source` mapping — Phase 1 plugin handles that.

## 1. Start the controller

```bash
bun --cwd services/sandbox run dev
# → [sandbox] listening on http://localhost:3001
```

Health-check:

```bash
curl localhost:3001/health
# → { "ok": true, "sessions": 0 }
```

## 2. Start the editor

```bash
bun --cwd apps/web run dev
# → http://localhost:5173
```

Open it in a browser. The TopBar shows **Connect**.

## 3. Connect a project

Click **Connect**, paste the absolute path to your project, hit
**Connect**. The editor will:

1. `POST /api/sessions { workspacePath }` to the controller.
2. The controller `child_process.spawn`s `bun run storybook` in that
   workspace on a free port.
3. The editor polls `GET /api/sessions/:id` every 1 s. As soon as the
   controller sees a "ready" line in stdout, status flips to **ready**
   and the iframe loads the Storybook preview.

Try it on the bundled fixture:

```
/absolute/path/to/sber-designer/examples/sample-storybook
```

You should see the Button / MetricCard stories on the canvas.

## 4. Inspect with Design mode

- Press **⌘2** (or click **Design** in the top tabs).
- Hover over an element on the canvas — a blue rectangle follows it
  with a label like `button @ src/Button.tsx:13:5`.
- Click — the right ContextPanel shows tag, source location, and bounds.

The source location comes from React Fiber's `_debugSource`, which
`@vitejs/plugin-react` injects automatically in development. No Babel
plugin or repo modification required (per [ADR-0007](../architecture/adr/0007-fiber-source-detection.md)).

## 5. Custom command

`POST /api/sessions` accepts `command` and `args`:

```bash
curl -sS localhost:3001/api/sessions \
  -H 'content-type: application/json' \
  -d '{"workspacePath":"/path/to/repo","command":"npm","args":["run","dev"]}'
```

Default is `bun run storybook`. Use `npm run storybook` if your repo
predates Bun, or `bun run dev` for a non-Storybook React+Vite app.

## 6. Stop a session

In the **Connect** dialog → **Disconnect**. Or:

```bash
curl -X DELETE localhost:3001/api/sessions/<id>
```

The child process receives `SIGTERM`. Bun on macOS reaps it within
~50 ms; long-running Storybook can take a second to fully exit.

## What's broken / coming

- **`ibp-ui-kit`** boots dev-server fine but `bun install` against the
  internal Nexus needs corp VPN. Use `examples/sample-storybook` for
  local validation; switch to `ibp-ui-kit` when you're on the network.
- **CORS noise.** The editor (`:5173`) reads from a Storybook iframe
  on a random port. Both are `localhost` so the browser allows
  same-origin DOM access for Fiber walking. If you proxy the dev-server
  behind a stricter origin, the overlay needs the current injected
  `postMessage` bridge rather than direct DOM access.
- **Webpack Storybook (Storybook 6 / `@storybook/react-webpack5`).**
  `__source` is not injected by default; the overlay falls back to
  `data-sd-loc`, which doesn't exist either, so selection is blind.
  Install
  [`@sber-designer/babel-plugin-sd-loc`](../../packages/babel-plugin-sd-loc/)
  in the target repo's Babel config to emit the attribute and restore
  selection.
- **Docker isolation.** Phase 1.

## Troubleshooting

| Symptom                                                    | Cause                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Cannot reach sandbox controller at http://localhost:3001` | `services/sandbox` is not running.                                                                                             |
| Status stuck on `starting` for >60 s                       | Storybook prints a custom "ready" line we don't recognise — check `services/sandbox` logs and add a regex to `log-matcher.ts`. |
| `workspace_not_found`                                      | Path is wrong, or non-absolute. Pass an absolute path.                                                                         |
| Selection works but source is `unknown`                    | Either the project is not React, or it's a production build (no `__source`). Confirm the dev-server is in development mode.    |
