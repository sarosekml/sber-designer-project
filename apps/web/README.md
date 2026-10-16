# @sber-designer/web

Editor web app. React 19 + Vite + Tailwind v4 + shadcn/ui + Zustand.

**Status:** active local MVP shell.

Routes:

- `/` — Projects Home with prompt entry, Connect repo, New project,
  recent project cards, thumbnail selection/upload, and the bundled
  Investment CRM demo card.
- `/edit/:id` — full editor for a registry-backed project. Opens the
  `.sdproj`, starts a sandbox/Storybook session through `services/api`,
  and syncs the active project store.
- `/share/:token` — read-only prototype viewer for a share snapshot.

Editor capabilities currently wired:

- Edit / Flow / Demo top-level views.
- Interact / Design / Code modes in Edit view.
- Panel visibility controls to hide left panels, the right inspector, or
  all side panels while inspecting narrow layouts on laptops.
- Canvas startup overlay with sandbox diagnostics for missing Storybook/script
  binaries, incomplete dependencies, and blocked package installs.
- Screens panel: pin from Storybook or create a blank generated story.
- Storybook readiness handling: after generated/story file changes, the web
  app polls the refreshed catalog for the target story, can force-restart the
  sandbox session, marks reload pending in editor state, and bumps the canvas
  reload key when readiness completes.
- Flow graph via `@xyflow/react` with persisted node positions and edge
  triggers.
- Flow designer map polish: compact/frames previews, screen/folder/edge visibility, screen notes,
  preview refresh, and duplicate screen actions.
- Full-screen Demo with click/link/on-mount flow triggers.
- Assistant chat with streaming tool traces, image/text/HTML reference
  attachments, screen-scoped chat sessions, `New chat`, history menu, context
  policy, task summaries, and patch diffs in Code mode.
- Assistant run notices distinguish preflight rejections, same-screen active
  run conflicts, and failed runs. Failed runs expose an "Export evidence" JSON
  action when a run manifest is available.
- Active run state is scoped by screen/session/client run id, so changing the
  selected screen does not move streamed tool results into the wrong Assistant
  history.
- Runtime settings for local CLI agents: OpenCode, Codex CLI and Claude Code
  can be detected/connected through the agent runtime registry.
- Project System / design-index status surfaces in Settings and assistant
  context strips.
- Settings → Indexing project can import local icon/illustration asset packs,
  generate Storybook asset galleries, and trigger project re-indexing.

See [ADR-0004](../../docs/architecture/adr/0004-three-modes.md) for the
three-mode editor model.
