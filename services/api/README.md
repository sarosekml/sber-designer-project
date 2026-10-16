# @sber-designer/api

Bun + Hono edge service between `apps/web`, the sandbox controller, the
LLM gateway, git, and persisted project state. See
[ADR-0009](../../docs/architecture/adr/0009-services-api-edge.md).

**Status:** active local MVP backend. The service is file-backed and
single-process today; Postgres/multi-user RBAC is still enterprise
roadmap work.

## Run

```bash
bun --cwd services/api run dev    # default port 3000
```

```bash
curl localhost:3000/health
# -> { "ok": true }
```

## Auth

Every endpoint except `/health`, `/api/config`, public share reads, and
preview-share proxy reads is authenticated.

- **Stub mode** (default dev): send
  `x-sber-designer-user: <name>`. The web app sends `local-dev`.
- **OIDC mode**: set `SBER_DESIGNER_OIDC_ISSUER` and optionally
  `SBER_DESIGNER_OIDC_AUDIENCE` /
  `SBER_DESIGNER_OIDC_JWKS_URL`. The api verifies
  `Authorization: Bearer <jwt>` against the issuer JWKS. The web app
  reads the token from `localStorage['sd-oidc-token']`; a full PKCE
  login UI is not implemented here.

## Main endpoints

| Endpoint                                                                                                       | Purpose                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/config`                                                                                              | Server-resolved `sber-designer.json`; secrets are masked as `__configured__` / `__missing__`.                                                                                |
| `GET/POST/DELETE /api/projects`                                                                                | File-backed Projects Home registry under `~/.sber-designer/projects.json`. Removing a project detaches it from the list without deleting the workspace or `.sber-designer`.  |
| `POST /api/projects/:id/open`                                                                                  | Touches the registry entry and loads `<workspace>/.sber-designer/project.sdproj`. The web app then starts the sandbox session.                                               |
| `GET/PUT /api/projects/:id/thumbnail`                                                                          | Reads or updates project card thumbnails.                                                                                                                                    |
| `GET/PUT /api/projects/:id/cover` · `PUT /api/projects/:id/cover-screen`                                       | Serves/writes the generated project cover and pins/unpins its source screen. Covers live in the project; responses use content ETags.                                        |
| `GET/PUT /api/project`                                                                                         | Active `.sdproj` load/save with schema validation.                                                                                                                           |
| `/api/sandbox/*`                                                                                               | Authenticated proxy to `services/sandbox` (`SBER_DESIGNER_SANDBOX_URL`, default `:3001`), including startup diagnostics from failed sessions.                                |
| `GET /api/catalog`                                                                                             | Live component catalog. Uses Storybook when `previewUrl` is available; falls back to static AST scan when only `workspacePath` is known. `refresh=1` bypasses the 30s cache. |
| `GET /api/project/screen-templates`                                                                            | Built-in screen templates for `Add a screen`; does not read `.sber-designer/templates` from the connected project.                                                           |
| `POST /api/chat`                                                                                               | Non-streaming built-in agent loop via `llm-gateway` and server tools. Accepts prompt attachments and `maxIterations` for continuation runs.                                  |
| `POST /api/chat/stream`                                                                                        | SSE agent loop with text deltas, tool calls/results, image/text/HTML reference attachments, and `maxIterations`.                                                             |
| `POST /api/chat/summarize-task`                                                                                | Lightweight task title/summary generation for screen-scoped assistant history. Falls back without blocking the main chat turn.                                               |
| `GET /api/agent-runs/:runId/evidence`                                                                          | Folder-like JSON evidence manifest for run manifest, timeline, receipts, attachments, continuation context, screenshots, design-source artifacts and external log links.     |
| `GET/POST /api/agent-kit/*`                                                                                    | Loads/reloads the merged product/personal/workspace agent kit and can bootstrap a project-local `.agents` folder.                                                            |
| `GET/POST /api/agent-runtimes/*`                                                                               | Detect, connect, disconnect and select models for local CLI runtimes such as OpenCode, Codex CLI and Claude Code.                                                            |
| `GET/POST/PATCH/DELETE /api/mcp/*`                                                                             | Product-owned MCP server status, reload/connect/disconnect/restart, runtime enablement and per-tool exposure overrides for API-mode agents.                                  |
| `GET/POST /api/tasks/*`                                                                                        | Comment-derived tasks plus Linear/Jira tracker test/status/fetch endpoints when task tracker config is present.                                                              |
| `GET/POST /api/files`                                                                                          | Workspace-scoped file read/write used by generated screen creation and Code mode.                                                                                            |
| `GET /api/fs/list`                                                                                             | Browser-safe folder picker access to server-side directories.                                                                                                                |
| `POST /api/assets/import-pack`                                                                                 | Copies an approved local SVG/PNG/JPG/WebP/AVIF asset folder into `src/assets`, generates Storybook asset galleries, and returns changed files.                               |
| `GET /api/project/design-index`                                                                                | Project System status/freshness/counts/context items for Settings, prompts and agents. Accepts `workspacePath` when the active workspace is not in memory.                   |
| `POST /api/project/design-index/jobs`                                                                          | Starts the background project index/setup profiler job; `GET /api/project/design-index/jobs/:id` polls progress.                                                             |
| `POST /api/project/design-index/generate`                                                                      | Synchronous design-index generation used by existing maintenance flows.                                                                                                      |
| `GET /api/project/design-index/browser`                                                                        | Design System Browser payload over `project-profile`, components, tokens, icons, assets, screens, routes, examples and agent notes.                                          |
| `POST /api/project/design-index/profile-answers`                                                               | Saves shared setup answers to `.sber-designer/design-index/project-profile.answers.json`.                                                                                    |
| `POST /api/project/design-index/component-notes`, `PATCH/DELETE /api/project/design-index/component-notes/:id` | Adds, edits or deletes shared component guidance in `agent-notes.jsonl` and refreshes the index.                                                                             |
| `POST /api/flow/previews/screens/capture`                                                                      | Captures 16:9 Flow preview screenshots into `.sber-designer/previews/screens/` when a browser debugging endpoint is configured.                                              |
| `GET /api/flow/previews/screens/:fileName`                                                                     | Serves cached Flow preview PNGs from the active workspace.                                                                                                                   |
| `POST /api/scaffold`                                                                                           | Creates a Vite + React + TS project and can initialise Storybook.                                                                                                            |
| `POST /api/git/send-pr`                                                                                        | Branch, commit, push, and open PR/MR through host `git`, `gh`, or `glab`; returns compare URLs when no CLI can open it.                                                      |
| `POST/GET/DELETE /api/share`                                                                                   | Read-only share snapshots with optional password gate.                                                                                                                       |
| `/api/preview-share/:token/*`                                                                                  | Public reverse proxy for share iframes; recipients never embed raw localhost Storybook URLs.                                                                                 |
| `/api/state`, `/api/events`                                                                                    | Editor state/event bridge used by `proj-mcp` and the browser.                                                                                                                |

Project design-index status, jobs, browser payload, profile answers and
component-note routes accept `workspacePath` as a query parameter. The web app
uses it when the active project is loaded from Projects Home and the API has not
yet inferred the workspace from process state.

### Generated project cover contract

`GET /api/projects/:id/cover` resolves the project through the authenticated
identity registry and reads one image from
`<workspace>/.sber-designer/previews/cover.webp` or `.png`; it does not start a
sandbox. Responses use a SHA-256 content ETag,
`private, no-cache, must-revalidate` and `X-Content-Type-Options: nosniff`.

`PUT /api/projects/:id/cover` accepts a browser-generated data URL plus its
source `screenId`. The store enforces a 1 MB read/write limit, verifies
PNG/WebP magic bytes, rejects path/symlink escape and uses atomic replacement.
When `coverScreenId` is pinned, a stale capture from another screen is
rejected. `PUT /api/projects/:id/cover-screen` changes that per-user registry
pin; the image itself remains project-owned and git-visible.

Cover write/reset, manual thumbnail selection and pin updates share one
identity-registry mutation queue, so a later user action cannot be overwritten
by a stale `projects.json` snapshot. Registry writes use atomic replacement and
cover-reset failures are returned to the client.

Project artwork GET/HEAD remains authenticated in every profile. Home fetches
the bytes with the common auth-aware API client (local header, password cookie,
or OIDC bearer), creates an object URL and passes that to `<img>`.

`GET /api/config` exposes the identity-scoped
`preferences.generativeThumbnailEnabled`; `PUT
/api/config/generative-thumbnail` saves it in the user's `settings.json`.

The nested `.sber-designer/.gitignore` ignores only
`previews/screens/` (Flow captures). It must not hide `previews/cover.*`.
See [Project covers](../../docs/how-it-works/project-covers.md) for display
priority, browser capture lifecycle and release smoke.

## Agent tools

The built-in agent exposes these server-side tools through the agent
loop:

- `read_file` with optional `startLine`/`limit`, `write_file` with either
  `contents` or model-friendly `contentsLines`
- `apply_patch` backed by `@sber-designer/ast-bridge`
- `list_components`, `list_screen_templates`
- `list_project_templates` remains as a compatibility alias for older prompts
- `list_design_context`, `get_project_index_status`, `search_project_index`
- `get_indexed_component`, `get_indexed_token`, `get_indexed_asset`,
  `get_indexed_icon`, `list_indexed_screens`, `request_project_reindex`
- `import_asset_pack`
- `validate_design_screen`, `validate_screen_craft`
- `get_selection`, `set_mode`, `post_message`
- `list_product_mcp_tools`, `call_product_mcp_tool` when product-owned MCP
  servers are configured for API-mode agents
- `send_pr`
- `screen_create`, `screen_remove`
- `flow_add_edge`, `flow_remove_edge`

Before `write_file` or `apply_patch` accepts changed TS/TSX/JS/JSX source, the
tool layer runs workspace import validation. It resolves relative imports,
fallback `@/* -> src/*`, local `tsconfig.json` / `jsconfig.json` `paths`, and
common static Vite `resolve.alias` forms. It then checks named imports through
barrels and re-export aliases, so `export { BaseCard as Card }` permits
`import { Card } ...` but rejects `import { BaseCard } ...` from the public
barrel. External packages are not validated by this guard.

External CLI runtime handoffs also initialize design-source run artifacts when
the user prompt or ChatPanel directive contains Pixso/Figma intent:

```text
.sber-designer/runs/<runId>/reference/design-source/
  source-summary.md
  mapping-report.md
  manifest.json
```

Those files are linked through a `reference_evidence_pack` receipt and the
final `handoff.md`.

Prompt attachments are recorded under
`.sber-designer/runs/<runId>/attachments/` when a workspace run exists. Image
attachments become visual references; text attachments become durable text
evidence; `.html/.htm` files are analyzed as untrusted reference documents. The
HTML source is kept in the run folder for audit, while prompts receive compact
title/headings/landmarks/forms/tables/actions/mock-data analysis plus an
explicit contract to rebuild with project components instead of copying raw
HTML/CSS/JS into implementation source.

Tool results include enough structured data for the web UI to render
tool traces and patch diffs.

Run completion diagnostics also cross-link attempt logs, dev-run logs and
`.sber-designer/runs/<runId>/run-manifest.json`. External runtime render health
can turn a changed source diff into `failed` when the live canvas shows a
Storybook/runtime error. Missing verifier capability is recorded as unavailable
evidence and does not create a user-facing review state.

Repair-grade render evidence requires a browser-backed probe through
`SBER_DESIGNER_CHROME_DEBUGGING_URL`. The HTTP Storybook fallback only fetches
static iframe HTML; it may detect server/HTML error text, but it cannot execute
preview JavaScript and therefore records `warning`/`unavailable` instead of
claiming a complete client render check. Newly written stories are first
checked against Storybook `index.json`; transient non-OK preview responses are
recorded as weak `unavailable` evidence rather than terminal render failures.
Run receipts include the evidence source (`chrome` or `storybook-http`) so
support/debug flows can distinguish executed browser evidence from static HTTP
fallback evidence.

`GET /api/agent-runs/<runId>/evidence` returns the same run evidence as a JSON
manifest for support/debug workflows. The web Assistant panel uses it for the
"Export evidence" action on failed runs.

## Current gaps and operational notes

- No Postgres-backed project registry or audit store yet.
- No product-owned OIDC login UI or RBAC policy model yet.
- Demo workspaces are normal external projects. Connect or remove them through
  Projects Home like any other workspace.
- External CLI runtime acceptance is implemented as target-file no-op
  validation, source-diff classification, optional screenshot/pixel-diff
  acceptance and render-health failure classification.
- Built-in agent reliability includes provider abort propagation for
  OpenAI-compatible/Anthropic requests and permission-deny termination as a
  failed run, so Stop/deny no longer leaves the model continuing in the
  background.
- Pixso/Figma design-source handoff has an MVP parser/mini-form/evidence-pack
  path through external runtimes. Setup polish, structured Pixso smoke tests
  and a product-owned MCP Hub are not implemented yet.
