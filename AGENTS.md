# AGENTS.md — canonical instructions for every coding agent

> Read it before touching the codebase. It's short on purpose; if a rule
> isn't here, follow the linked ADRs. Claude Code reads the same rules
> through the [`CLAUDE.md`](./CLAUDE.md) pointer; opencode, Codex CLI,
> Cursor and any other agent read this file directly.

## What sber-designer is

Self-hostable, AI-powered visual UI builder for corporate frontend teams.
On-prem analog of [Builder.io Fusion](https://www.builder.io/fusion):
connect a Git repo with a component library (Storybook **optional**),
describe a screen in chat, get production code on the canvas. The
workspace is the AST of files in the repo; the visual scene is the live
DOM rendered by a sandboxed dev-server.

Start with [`README.md`](README.md) for the product overview and
[`docs/how-it-works/`](docs/how-it-works/README.md) for how each part works
today; [`docs/architecture/adr/`](docs/architecture/adr/README.md) explains
why it is built that way.

## Path moves (ADR-0020) — check here when a path is not found

| Was                           | Now                                           |
| ----------------------------- | --------------------------------------------- |
| `.agents/` (product kit)      | `packages/agent-kit/kit/`                     |
| `.agents/skills/**`           | `packages/agent-kit/kit/skills/**`            |
| `.agents/knowledge/craft/**`  | `packages/agent-kit/kit/knowledge/craft/**`   |
| `.agents/screen-templates/**` | `packages/agent-kit/kit/screen-templates/**`  |
| `.agents/` (new meaning)      | development kit of sber-designer's own agents |
| `<workspace>/.agents/`        | unchanged — kit of the **connected project**  |

## Standing rules (apply to every change)

1. **Don't fantasise — check the docs.** Before designing or
   re-implementing a feature, fetch the relevant page from the
   reference products below. Builder.io is the north-star for
   end-to-end UX; opencode is the reference for provider config; openpencil
   is our package donor. If you can't reach a doc, say so and stop.
2. **Product UI is English-only.** Every visible string in the editor
   is English. Russian is fine in `docs/` and in PR / commit prose for
   the Russian-speaking team.
3. **shadcn/ui first** for any UI primitive. Then `21st.dev` for
   compositions, then `assistant-ui/tool-ui` for chat / agent surfaces.
   Don't hand-roll a button. See "UI sources" below.
4. **Live-DOM, not vector.** The canvas is an iframe with a real
   dev-server; the source of truth is the AST. Never propose an
   alternative vector representation as the document model. See
   [ADR-0001](docs/architecture/adr/0001-live-dom-canvas.md).
5. **Storybook is optional.** Three onboarding paths (with Storybook,
   without, empty repo). Don't gate features behind Storybook presence.
6. **All LLM calls go through `@sber-designer/llm-gateway`.** Never
   `import` an Anthropic / OpenAI / GigaChat SDK directly. Add a new
   provider type if you need new behaviour. See
   [ADR-0005](docs/architecture/adr/0005-llm-gateway.md).
7. **No closed-license dependencies.** WebContainer is out (closed
   license, not on-prem-deployable). Anything we adopt must be MIT /
   Apache-2.0 / ISC, recorded in
   [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
8. **Three editor modes.** Interact / Design / Code share **one**
   sandbox iframe; switching mode never recreates it. See
   [ADR-0004](docs/architecture/adr/0004-three-modes.md).
9. **Connected-project universality.** sber-designer is a universal tool, not
   an `ibp-ui-kit`-specific generator. Product logic, prompts, validators,
   skills, and reusable agent instructions must stay role / capability based.
   Do not hardcode customer-project component names, ids, import paths, tokens,
   routes, or assets in universal code. Concrete components and usage examples
   must come from the current project's index, catalog, description layer,
   agent notes, or source inspection. Project-specific hints belong only in
   generated index artifacts, fixtures, tests, or user-approved project notes.
10. **The product kit is separated from the development kit.**
    `packages/agent-kit/kit/` is product data of the built-in
    `ai-product-designer`: its agents, skills, knowledge and templates
    describe how the product's own agent works inside the product. Do not
    treat them as your development instructions; edit them only when a task
    explicitly targets the product kit. `.agents/` at the repository root is
    the kit of the agents **developing** sber-designer — reading it is the
    right thing to do
    ([ADR-0020](docs/architecture/adr/0020-default-agent-kit-location.md)).
11. **Project-owned state, not editor-owned hidden state.** sber-designer is a
    program for opening, editing, and committing a connected project. User
    changes made through the editor should belong to that project and be
    reviewable in git through workspace files or `.sdproj` metadata. Use
    browser-local storage only for ephemeral UI state that should not affect
    the project, collaborators, generated code, prompts, or future editing sessions.
12. **Agent kits stay compatible with external agent apps.** This applies to
    both kits — the product kit in `packages/agent-kit/kit/` and the root
    development kit `.agents/`. Both follow the open formats that Claude
    Code, opencode, and similar tools read natively: skills are Agent Skills
    `SKILL.md` (<https://agentskills.io>; `name` = directory name, 1–64 lowercase
    alphanumerics/hyphens, `description` required; opencode discovers
    `.agents/skills/**` directly), agent definitions are opencode-style
    markdown frontmatter (`description` required; `mode`/`temperature`
    optional), `sber-designer.json` stays opencode-style. Do not rename these
    directories or add required custom fields: sber-designer extensions must be
    additive and ignorable (`metadata` map or one optional `sd:` block), so a
    kit entry keeps working when a third-party tool ignores them. Details and
    verified field lists:
    [agent-system.md](docs/how-it-works/agent-system.md#внешняя-совместимость-agent-kit-инвариант).
13. **Docs describe the system; ADRs record why.** `docs/how-it-works/**`,
    `docs/integrations/**`, `docs/architecture/*.md`, `README.md` and this
    file answer "how does it work now". Update them in the same change as the
    code they describe. Write the reason in the doc itself, and link an ADR
    when the rationale is load-bearing; a decision that changes the
    architecture gets a new or superseding ADR. Every relative link in the
    docs must resolve to a file in the repository.

## Repository layout

```
apps/
  web/             React 19 + Vite editor (Tailwind v4, shadcn/ui, Zustand);
                   panels in components/editor + feature subfolders
                   (chat/ screens/ settings/ design-panel/), HTTP client in lib/api/
packages/
  agent-kit/       Default product agent kit (kit/: agents, skills, knowledge,
                   screen templates) + resolveDefaultKitRoot() — product data,
                   not development instructions (ADR-0020)
  shared-types/    Cross-package TS types (domain modules behind index.ts barrel)
  ast-bridge/      ts-morph + Babel: DOM node ↔ JSX in repo files, path safety
  storybook-indexer/  CSF parser + static AST fallback
  design-indexer/  builds .sber-designer/design-index for connected projects
  babel-plugin-sd-loc/  data-sd-loc attributes for DOM→source mapping
  llm-gateway/     Provider abstraction (mock / openai-compatible / anthropic / claude-code-bridge)
  proj-mcp/        Inbound MCP server: external Claude Code / Cursor drive the project
services/
  api/             Bun + Hono backend (agent loop+tools, run records, routes,
                   MCP, git-worker; see docs/how-it-works/code-map.md)
  sandbox/         dev-server controller: local-spawn default, experimental docker driver
docs/
  how-it-works/          current system docs; code-map.md = module-level map
  architecture/adr/      ADRs — read these before redesigning anything
  integrations/          User-facing how-tos (e.g. connect-claude-code.md)
.agents/                 Development agent kit for THIS repository (skills,
                         roles, checklists for agents working on sber-designer)
sber-designer.json       Per-project agent / provider / mcp config (opencode-style)
```

## Stack

- **Runtime:** Bun ≥ 1.2 (tested on 1.2.13; the text `bun.lock` format needs
  1.2+), Node ≥ 20 fallback. CI pins 1.2.13 and installs `--frozen-lockfile`.
- **Web:** React 19 + Vite + Tailwind v4 + shadcn/ui + Zustand + TanStack Query.
  The editor route and Monaco are lazy boundaries — Home/Login must not pull
  them into the entry chunk.
- **Code editor:** Monaco, bundled locally (no CDN), loaded on the first
  switch to Code/Diff.
- **Backend:** Bun + Hono. **State is files, not a database:** the project
  lives in the connected repo as `.sber-designer/project.sdproj`, run records
  and the design index are files beside it, and auth/user data are JSON files
  under `~/.sber-designer`. There is no PostgreSQL, Prisma or MinIO in the
  code or in any manifest — they remain a possible future for server mode,
  not the current stack.
- **Realtime:** a WebSocket event bus in `services/api` (`/api/events`) for
  project/run change notifications. Yjs + y-websocket collaborative editing is
  still planned, not implemented.
- **Sandbox:** local child-process dev-server for the current local MVP, plus a
  static-HTML driver for html-first projects; the Docker driver is an
  experimental/protected-deployment path, not a requirement for local
  development. The controller binds loopback and can require a shared token.
- **Desktop shell:** Tauri v2 is planned; its package is created by the first
  stage that needs it rather than kept as an empty workspace scaffold.
- **Lint/format:** oxlint + Prettier.
- **Test:** `bun run test` for the automated suite, and `bun run smoke:browser`
  for the local browser suite (Playwright + Chromium, opt-in: the browser
  binary is a separate `bunx playwright install chromium`). CI runs `bun run test`
  but has no browser job yet.

## Commands

```bash
bun install                       # Bun >= 1.2 (text bun.lock); CI uses --frozen-lockfile
bun run dev                       # api + sandbox + editor together, local profile
bun --cwd apps/web run dev        # editor only, on http://localhost:5173
bun --cwd packages/proj-mcp start # stdio MCP server (for Claude Code bridge)
bun run build                     # local profile web build
bun run build:server              # server profile web build
bun run smoke:local-mvp           # endpoint probes + manual checklist
bun run smoke:browser             # local browser suite (needs Chromium, see above)
bun run typecheck                 # whole workspace; fails on new diagnostics vs typecheck-baseline.json
bun run lint                      # oxlint
bun run format / format:check     # Prettier
```

## Tests

`bun run test` runs the whole automated suite (no Vitest). It scopes
`bun test` to `apps/`, `packages/`, `services/`, `tests/` and `scripts/`, so
the demo projects in `projects/` (which carry their own test setups) stay out
of it; a bare `bun test` from the root would pick them up. A separate, opt-in
browser suite runs with `bun run smoke:browser` — it boots api + sandbox +
the built web app on free ports with the offline mock provider and drives
Chromium through Playwright. It skips with an install hint when Chromium is
absent, so `bun run test` on a fresh clone is unaffected, and CI has no browser
job yet. Conventions:

- **Placement.** Co-located `*.test.ts` next to the subject for pure web
  modules (`apps/web/src/lib`, hooks, stores) and small editor components;
  `tests/` for services/api integration and cross-package scenarios.
- **Naming.** New test files are named after the module they cover
  (`screen-folders.test.ts`). Numbered `00XX-*` files are incident/task
  regressions — keep them intact as regression units; renames are fine,
  deleting asserts is not.
- **Import the real module**, not a compatibility facade/barrel (e.g.
  `agent/run-record/receipts`, not `agent/run-recorder`; `lib/api/git`,
  not `lib/api-client`).
- **During refactors** tests are the referee: behavior-preserving moves
  must not touch test files; reorganizing tests (imports, moves, splits)
  happens separately and must not change any `expect(...)`.
- **Coverage.** Use `bun run test:coverage` to write LCOV output to
  `coverage/`. CI uploads this report as an artifact, but does not enforce a
  global coverage threshold yet.
- **Source-string tests** (asserting a component file contains some text)
  prove a file's contents, not behaviour. Keep the ones that are meaningful,
  but put anything about navigation, focus, the sandbox iframe or a session
  in the browser suite instead.

## Module layout and size budget

Conventions from the god-file refactor; apply to new code. The full
current code map (every module dir, facades, "where to change what") is
[`docs/how-it-works/code-map.md`](docs/how-it-works/code-map.md).

- **Feature subfolders.** Editor feature pieces live next to their shell:
  `components/editor/chat/*`, `settings/*`, `screens/*`, `design-panel/*`.
  Pure logic extracted from components goes to `apps/web/src/lib/`.
- **Web API client.** `lib/api/<domain>.ts`; `lib/api-client.ts` is a
  compatibility barrel — import the domain module in new code.
- **Services.** Split modules keep the old import path via a facade file
  or a directory index (`agent/tools/*` + `agent/toolset.ts` registry;
  `agent/run-record/*`; `design-context/*`; `routes/chat-stream/`).
- **Size budget (review rule; oxlint 0.10 has no max-lines).** New modules
  target ≤600 lines, hard cap ≤800; shells ≤400–500. Don't grow a
  watchlist file (600–800) past 800 — extract into a new module instead.
- Behavior-preserving moves go in their own commits, separate from behaviour
  changes.

## How to extend things

### New UI element

1. Look in `apps/web/src/components/ui/` for an existing primitive.
2. If it doesn't exist, add it via the shadcn/ui CLI (preferred) or copy
   the source file by hand. Style is `new-york`, baseColor `neutral`,
   icons `lucide`.
3. Compose feature components in `apps/web/src/components/editor/`.
4. State goes in `apps/web/src/stores/editor-store.ts` (Zustand);
   one slice per concern.

### New LLM provider

Add a `case` to the `provider.type` discriminated union in
`packages/llm-gateway/src/schema.ts`, write the adapter in
`packages/llm-gateway/src/providers/<name>.ts`, register it in
`packages/llm-gateway/src/index.ts`. Bump
[ADR-0005](docs/architecture/adr/0005-llm-gateway.md) in a follow-up.

### New MCP tool

Add a `ToolDefinition` to `packages/proj-mcp/src/tools/index.ts`, with a
zod input schema and a handler that takes `(input, ProjMcpContext)`. The
server (`server.ts`) discovers it automatically. Document it in
[`docs/integrations/connect-claude-code.md`](docs/integrations/connect-claude-code.md).

### New editor mode

Don't add one — we ship exactly three (Interact / Design / Code) per
[ADR-0004](docs/architecture/adr/0004-three-modes.md). Comments / a11y
inspector / etc. are _layers_ over a mode, not modes.

## Reference docs (consult before designing features)

| What                               | Where                                                                                        | When                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Builder.io Fusion**              | <https://www.builder.io/c/docs/get-started-fusion>                                           | Any product-UX question              |
| → Modes (Interact / Design / Code) | <https://www.builder.io/c/docs/fusion-mode-overview>                                         | Editor shell / mode switching        |
| → AI models                        | <https://www.builder.io/c/docs/ai-models>                                                    | Settings dialog / admin restrict     |
| → Local MCP (outbound)             | <https://www.builder.io/c/docs/fusion-connect-to-a-local-mcp-server>                         | `mcpServers` shape, tool naming      |
| → VS Code extension                | <https://www.builder.io/c/docs/projects-vscode>                                              | IDE integration                      |
| **opencode**                       | <https://opencode.ai/docs/>                                                                  | Provider config schema, CLI patterns |
| → Providers                        | <https://opencode.ai/docs/providers/>                                                        | `sber-designer.json` shape           |
| **OpenAI Codex CLI**               | <https://developers.openai.com/codex>                                                        | External coding agent driver         |
| **Claude Code CLI**                | <https://code.claude.com/docs/en/overview> · <https://code.claude.com/docs/en/cli-reference> | External coding agent driver         |
| **Storybook**                      | <https://storybook.js.org/docs> · <https://github.com/storybookjs/storybook>                 | `storybook-indexer`                  |
| **Tokens Studio naming**           | <https://docs.tokens.studio/manage-tokens/token-names>                                       | Design-token round-trip              |

## UI sources (in priority order)

1. **shadcn/ui** — <https://ui.shadcn.com/docs/components>
2. **21st.dev community** — <https://21st.dev/community/components>
3. **assistant-ui / tool-ui** — <https://github.com/assistant-ui/tool-ui>

Use `lucide-react` for icons; it's already a dep of `apps/web`.

## Things we explicitly don't do

- **WebContainer** (StackBlitz) — closed license. The sandbox is a local
  child process by default, with Docker as an optional driver.
- **Vector canvas** (Skia / CanvasKit) as the document model.
- **Direct provider SDK imports** outside `llm-gateway`.
- **TanStack Start / Nitro** in `apps/web` — overkill while editor is
  scaffolding; backend lives in `services/api`.
- **i18n in product UI** — English-only until the user requests Russian.
- **Eager editor imports in the app entry** — `main.tsx` and the Home/Login
  path must not pull Monaco or `EditorShell`. `bun run smoke:browser` fails on
  a byte budget if they do.
- **Silent overwrites of a damaged `.sdproj`** — a corrupt project file is
  quarantined on request, never replaced by an empty one.

## When you're stuck

Open an ADR draft (`docs/architecture/adr/000X-*.md`) describing what you're
trying to do, what you considered, what you picked, and why.
ADRs are how the team agrees on architectural changes — see existing
ones for the format.
