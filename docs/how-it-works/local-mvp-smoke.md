---
updated: 2026-07-24T23:16:09Z
---

# Local MVP smoke

Этот smoke проверяет, что локальный MVP поднимается на машине
разработчика и основной путь можно повторить без внешних LLM, production infra
или Playwright dependency.

## Команды

В одном терминале:

```bash
bun install
bun run dev
```

В другом терминале:

```bash
bun run smoke:local-mvp
```

Команда печатает repeatable manual checklist для основного flow. Endpoint
probes включаются отдельно, потому что в некоторых agent/sandbox runners Bun
child processes не могут открывать loopback sockets, хотя обычный shell `curl`
на той же машине работает.

Для endpoint probes:

```bash
SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS=1 bun run smoke:local-mvp
```

Endpoint probes проверяют:

- editor web root на `http://localhost:5173`;
- API `/health` на `http://localhost:3000`;
- sandbox `/health` на `http://localhost:3001`.

Если порты отличаются, задайте overrides:

```bash
SBER_DESIGNER_SMOKE_WEB_URL=http://localhost:5174 \
SBER_DESIGNER_SMOKE_API_URL=http://localhost:3010 \
SBER_DESIGNER_SANDBOX_URL=http://localhost:3011 \
SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS=1 \
bun run smoke:local-mvp
```

## Manual checklist

После успешных endpoint checks выполните сценарий, который печатает скрипт:

1. Open `http://localhost:5173` and confirm the editor shell loads.
2. Open or register a local project from Projects Home.
3. Start preview and confirm the canvas iframe renders without a blank/unhealthy
   overlay.
4. Create a blank screen in `Ungrouped` and confirm it appears in Screens.
5. Run the mock assistant write flow and confirm screen health/status changes
   without external LLMs.
6. Switch `Interact -> Design -> Code` and confirm the iframe is not restarted
   between mode changes.
7. Open Flow and confirm the screen node is visible.
8. Create a Modal screen with Width `300px` and Height `50%`; confirm the
   **Modal** badge and a centered modal-sized standalone canvas.
9. Wire a click edge into the modal; in Interact confirm a transparent
   full-viewport overlay over the live underlay, Escape/close, and a Modal-panel
   size edit without an LLM run.
10. Check git status and confirm project-owned source/.sber-designer changes are
    visible.

Host handoff variant (local profile only):

1. Open a project whose absolute path contains a space and confirm the split
   handoff button appears before Settings in Edit, but not in Demo.
2. Open **Open with editor**: an installed IDE launches the active workspace;
   an unavailable app returns an inline error without closing the menu.
3. Confirm **Copy path** copies the exact absolute workspace path.
4. Open **Copy for CLI**, copy the Codex/Claude/opencode prompt and confirm its
   `cd` command quotes the workspace path.
5. Start web/API with the server deployment mode and confirm the button is
   hidden and `/api/host/apps` returns `403 host_tools_disabled`.

HTML-first variant:

1. Create **New project -> HTML-first** with starter files enabled.
2. Confirm `index.html`, `Design.md`, `tokens.css`, `components.css` and
   `.sber-designer/project.sdproj` are created.
3. Create a blank HTML screen and confirm it is added as a separate page, not
   written into `index.html`.
4. Confirm the canvas warning, if any, refers to static HTML preview and not
   Storybook.

Component params variant (React project):

1. Open a screen that uses a catalog component and select its inner DOM in
   Design mode.
2. Open **Component** and confirm the tab resolves the usage in the active
   screen, not the library implementation.
3. Change an enum/boolean value and confirm JSX + HMR update without the Design
   draft Apply button.
4. Reset an optional prop; confirm it disappears from source. Verify expression
   and shared-component cases stay read-only.

GigaCode live variant (only on a host with installed/authenticated CLI):

1. Follow [Connect GigaCode CLI](../integrations/connect-gigacode.md).
2. Verify detection/auth, a real file edit, factual model/usage in Screen Info
   and a second turn through session resume.
3. Repeat after every CLI upgrade. A fixture/replay pass on a machine without
   GigaCode does not replace this live check.

Generated project cover variant (project with a working sandbox):

1. Add a project and confirm its card initially shows a stock placeholder.
2. Run generation on screen A; return to Home and confirm the card shows a
   snapshot of A.
3. Run generation on screen B and confirm the cover is replaced with B.
4. Select **Set as thumbnail** on A, confirm the immediate A snapshot, then run
   B again and confirm A remains pinned.
5. Uncheck A and confirm the next successful B run resumes automatic updates.
6. Disable **Settings → General → Generative thumbnail**: capture and generated
   layer stop, but a selected/uploaded thumbnail still works. Re-enable it and
   confirm the saved cover returns.
7. Choose an explicit thumbnail and confirm it wins immediately. Select the
   **Generated preview** card to return manually, then choose the explicit
   thumbnail again, run one generation and confirm the generated cover returns
   automatically.
8. Check git: `.sber-designer/previews/cover.webp` or `.png` is visible, while
   `.sber-designer/previews/screens/` is ignored.

Расширенные контракты:
[Modal screens](./modal-screens.md),
[Component params](./component-params.md) и
[GigaCode CLI runtime](./gigacode-runtime.md), а также
[Project covers](./project-covers.md).

## Expected evidence

Git-visible project state:

- `.sber-designer/project.sdproj`;
- relevant `.sber-designer/design-index/*`;
- relevant `.sber-designer/assets/*` manifests;
- `.sber-designer/previews/cover.webp` или `.png`, если generated cover создан;
- generated screen implementation files;
- generated Storybook wrappers;
- HTML-first pages and design-system sources;
- project templates/assets/materialized screen assets/agent notes that affect
  future generation.

Local-only artifacts:

- `.playwright-mcp/`;
- `tmp/`;
- root screenshots and smoke captures;
- `.sber-designer/previews/screens/`;
- temp attempt logs under `SBER_DESIGNER_AGENT_LOG_DIR`;
- private `.env` files and provider secrets.

The smoke intentionally uses the existing local/browser/manual harness instead
of adding Playwright. A future browser E2E suite can replace the manual part
once the dependency and CI story are explicit.
