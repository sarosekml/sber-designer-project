# Connect Claude Code as your sber-designer agent

> "Claude as agent" mode lets you drive sber-designer from your local
> [Claude Code](https://docs.claude.com/claude-code) CLI instead of (or
> alongside) the built-in agent. The conversation happens in Claude Code;
> sber-designer is the workspace it reads, writes, and posts updates to.
>
> See [ADR-0006](../architecture/adr/0006-proj-mcp-and-claude-as-agent.md)
> for the design rationale.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (`bunx` is used to launch the MCP server).
- Claude Code installed and logged in (`claude doctor` should be green).
- The sber-designer monorepo cloned locally, with `bun install` already
  run at least once so `@sber-designer/proj-mcp` is linked.

## Quick handoff from the top bar

In a local connected project, open the split button immediately to the left of
Settings and choose **Copy for CLI → Claude Code**. sber-designer copies a
continuation prompt with the absolute workspace path, a shell-safe `cd`
command, repository-instruction and verification steps, plus a reminder about
this MCP integration.

This only copies text. It does not start Claude Code, create an Assistant run,
change the Ask / Plan / Design mode, or grant MCP permissions. Continue with
the setup below when you want Claude Code to call back into the live editor.

## 1. Pick "Claude Code (external)" in Project settings

Open the editor → top-bar gear icon → **Active model** dropdown →
choose **Claude Code (external) · _bridge_** (entry from the
`claude-code-bridge` provider in `sber-designer.json`).

The chat panel switches into bridge mode and stops sending messages
through `llm-gateway`.

## 2. Register the MCP server with Claude Code

Pick one of the two equivalent setups.

### Option A — `claude mcp add`

```bash
claude mcp add sber-designer \
  --command bunx \
  --args "-y" \
  --args "@sber-designer/proj-mcp" \
  --args "--workspace" \
  --args "$(pwd)" \
  --args "--project-id" \
  --args "my-project" \
  --args "--api-url" \
  --args "http://localhost:3000" \
  --args "--service-token" \
  --args "<mcp-service-token>"
```

### Option B — edit `~/.claude.json`

```json
{
  "mcpServers": {
    "sber-designer": {
      "command": "bunx",
      "args": [
        "-y",
        "@sber-designer/proj-mcp",
        "--workspace",
        "/absolute/path/to/my-project",
        "--project-id",
        "my-project",
        "--api-url",
        "http://localhost:3000"
      ],
      "env": {
        "SBER_DESIGNER_SERVICE_TOKEN": "<mcp-service-token>"
      }
    }
  }
}
```

> `--api-url` (or `SBER_DESIGNER_API_URL` env var) wires the editor bridge
> per [ADR-0010](../architecture/adr/0010-editor-mcp-bridge.md). Without
> it, `editor_post_message` and `editor_get_selection` log to stderr
> instead of reaching the running editor.

When services/api runs with `SBER_DESIGNER_AUTH_MODE=password`, the bridge
also needs the token named `mcp` from the server-side
`SBER_DESIGNER_SERVICE_TOKENS="mcp:<token>,…"` map. Pass it as
`--service-token` or, preferably, inject `SBER_DESIGNER_SERVICE_TOKEN` into
the MCP process environment so the secret is not stored in command arguments.
The API records these calls as `svc:mcp`; this token is independent from the
MCP HTTP transport's `--token` option.

> The MCP server is **stdio** by default (transport recommended by
> [Builder Fusion](https://www.builder.io/c/docs/fusion-connect-to-a-local-mcp-server)
> and the [MCP spec](https://modelcontextprotocol.io)). Phase 1 will add
> `--http` for cases where Claude Code runs on a different machine.

## 3. Verify the connection

In Claude Code, run:

```
> use the mcp__sber-designer__ping tool
```

You should see a response like:

```json
{ "ok": true, "projectId": "my-project", "version": "0.0.0" }
```

If you instead get "no such tool", check `claude mcp list` — the
server entry should be `connected`.

## 4. What you can do

| Tool                                                   | Use it for                                                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcp__sber-designer__ping`                             | Sanity check.                                                                                                                                         |
| `mcp__sber-designer__catalog_list_components`          | **Live (with `--api-url`).** Read the live component catalog from the connected Storybook (ADR-0011).                                                 |
| `mcp__sber-designer__get_usage_card`                   | Read the compiled usage card for one component (variant semantics, real mined JSX snippets, when-to-use/avoid facts) from the project design index.   |
| `mcp__sber-designer__list_undescribed_components`      | Read the ranked Description for AI interview queue from `.sber-designer/design-index/*`, excluding components with canonical sidecars.                |
| `mcp__sber-designer__write_component_description`      | Write the canonical `.sber-designer/components/<id>.md` sidecar for a confirmed Description for AI layer.                                             |
| `mcp__sber-designer__get_component_description_source` | Read back the canonical sidecar, indexed layer, available Storybook/HTML projections, and divergence diagnostics for review/debug.                    |
| `mcp__sber-designer__request_project_reindex`          | **Live (with `--api-url`).** Start the same background design-index job used in the editor after description sidecars change.                         |
| `mcp__sber-designer__list_patterns`                    | List compiled composition patterns — the project screen grammar derived from confirmed screen templates. Check before composing a full screen.        |
| `mcp__sber-designer__get_pattern`                      | Read one composition pattern with full slots (role → bound component ids, presets) and evidence.                                                      |
| `mcp__sber-designer__ast_read_file`                    | Read source files inside the workspace.                                                                                                               |
| `mcp__sber-designer__ast_apply_patch`                  | **Live (with `--api-url`).** Apply atomic structured AST ops (`set-prop`, `remove-prop`, `add-import`) — the preferred way to change code (ADR-0013). |
| `mcp__sber-designer__ast_write_file`                   | Replace a file wholesale. Deprecated for code changes; use `ast_apply_patch`.                                                                         |
| `mcp__sber-designer__editor_post_message`              | **Live (with `--api-url`).** Push a chat message to the running editor — your reply appears in the chat panel as if you typed it.                     |
| `mcp__sber-designer__editor_get_selection`             | **Live (with `--api-url`).** Read what the user has selected in Design mode (`file:line:col`) — useful for "this thing on screen" prompts.            |
| `mcp__sber-designer__create_screen`                    | **Live (with `--api-url`).** Register a generated screen after creating scoped `src/stories/screens/` and `src/screens/` files.                       |
| `mcp__sber-designer__git_create_pr`                    | **Live (with `--api-url`).** Branch, commit, push and open a PR through `services/api`.                                                               |

Example prompt to try in your Claude Code:

> Use mcp**sber-designer**ast_read_file to read `apps/web/public/demo-target/index.html`,
> then propose 2 small improvements without writing them yet.

For component description work, prefer the MCP tools over manual file
conventions:

1. `mcp__sber-designer__list_undescribed_components`
2. `mcp__sber-designer__get_usage_card`
3. `mcp__sber-designer__write_component_description`
4. `mcp__sber-designer__get_component_description_source`
5. `mcp__sber-designer__request_project_reindex`

Manual fallback may write only `.sber-designer/components/<id>.md`. Do not edit
Storybook CSF descriptions, `design-system.html`, or
`.sber-designer/design-index/*` by hand; those are tool-owned projections and
derived caches.

## 5. What's coming next

- **More `ast_*` ops** — `swap-component`, `wrap-with`,
  `set-children-text`, `extract-to-component` (Phase 2.2).
- **`editor_set_mode`, `sandbox_get_url`, `sandbox_screenshot`** — same
  bridge surface as `editor_post_message` / `editor_get_selection`,
  additional capabilities.
- **HTTP/SSE transport** with a bearer token, so a remote Claude Code
  (or Cursor / OpenCode / Gemini CLI) can connect.

## Troubleshooting

- **"command not found: bunx"** — install Bun (`curl -fsSL https://bun.sh/install | bash`).
- **MCP server connects but tools 404** — make sure your Claude Code
  version supports MCP `tools/list` (any recent build does).
- **Workspace escape errors** — `proj-mcp` refuses paths outside
  `--workspace`. Pass an absolute path.
- **API returns `401 unauthenticated` in password mode** — configure
  `SBER_DESIGNER_SERVICE_TOKEN` with the value of the server's named `mcp`
  service token.
