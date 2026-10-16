# Architecture Overview

> Краткая карта системы. Текущая системная правда живет в
> [`docs/how-it-works/`](../how-it-works/README.md); ADR описывают принятые
> архитектурные решения, а не всегда фактический rollout.

## Current local MVP

```text
apps/web
  React 19 + Vite editor
  Edit view: Interact / Design / Code over one live iframe
  Flow and Demo top-level views
  English-only product UI

services/api
  Bun + Hono backend
  project/.sdproj persistence
  catalog/design-index/screen/template/git/design APIs
  Assistant stream, API-agent loop and external CLI runtime handoff
  sandbox proxy and preview state

services/sandbox
  local child-process dev-server controller by default
  optional Docker driver for experiments/future protected deployment

packages
  shared-types, design-indexer, storybook-indexer, llm-gateway,
  ast-bridge, proj-mcp

connected project
  source files, Storybook/dev-server when available,
  .sber-designer/project.sdproj, design-index, run evidence
```

The editor source of truth is the connected project filesystem. sber-designer
does not maintain a separate vector document model. Canvas is a live DOM iframe;
Storybook is useful but optional.

## Current package status

- `packages/shared-types`, `packages/design-indexer`,
  `packages/storybook-indexer`, `packages/llm-gateway`, `packages/ast-bridge`
  and `packages/proj-mcp` contain active MVP code.
- Deferred package names such as `editor-engine` and `sandbox-client` live only
  in roadmap/ADR history. The repository cleanup removed their empty workspace packages;
  create a real boundary with code and tests when the owning roadmap work starts.

## Current AI/provider model

API provider calls go through `@sber-designer/llm-gateway`. Current provider
types include mock/openai-compatible/anthropic-style paths and legacy bridge
support where implemented in code. External CLI runtimes such as Codex,
OpenCode and Claude Code use a handoff flow and are verified after they mutate
the workspace.

GigaChat, YandexGPT and vLLM are target/example corporate providers, not
implemented first-class adapters in the local MVP and out of scope for the local smoke.
If a customer requires one of them, add a separate `llm-gateway` task with its
own schema, adapter and tests.

## Current sandbox model

The local MVP defaults to `SBER_DESIGNER_SANDBOX_DRIVER=local`, which spawns a
connected project's preview/dev command as a local child process and returns a
preview origin to the API. This keeps the developer workflow simple:

```text
bun install
bun run dev
open http://localhost:5173
```

Docker-per-session remains a protected/on-prem direction and experimental
driver path. Do not make Docker mandatory for local MVP setup, and do not
claim Docker resource/network limits are enforced until that hardening lands.

## Target/on-prem directions

The following are roadmap/target capabilities, not required for the current
local MVP:

- Keycloak/OIDC as the default enterprise auth path. Current local mode can run
  with stub auth.
- Yjs/realtime multi-user collaboration.
- Docker-only or Kubernetes-only sandboxing with resource and network policy.
- Production CORS/auth exposure hardening.
- First-class GigaChat/YandexGPT/vLLM adapters.
- Cloud clone-and-PR infrastructure.

## Editing lifecycle

1. User opens a workspace and the API reads or creates
   `.sber-designer/project.sdproj`.
2. Sandbox starts the project's preview/dev server or reports actionable
   diagnostics.
3. Catalog/indexer builds component, screen, token, icon and asset context.
4. User edits in Interact/Design/Code, or Assistant runs through an API
   provider / external CLI runtime.
5. Changes are written to project-owned files and `.sber-designer/*` evidence.
6. Git status/graph/Send PR operate on the connected project repository.

## On-prem boundary principle

The product is designed to be self-hostable and enterprise-friendly, but local
MVP docs must not pretend every future boundary is already enforced. Keep docs
and tasks explicit about whether a capability is:

- implemented now;
- available as a local/dev option;
- a protected deployment requirement;
- future roadmap work.
