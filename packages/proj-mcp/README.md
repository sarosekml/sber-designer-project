# @sber-designer/proj-mcp

Inbound [Model Context Protocol](https://modelcontextprotocol.io) server.
Lets external coding agents — **Claude Code, Cursor, OpenCode, Codex CLI** —
operate on a sber-designer project the same way the built-in agent does.

See ADR-0006 for the full rationale (and why we run _both_ outbound MCP,
like Builder.io Fusion, and inbound MCP, like openpencil).

## Quick start

```bash
# From the project workspace root:
bunx @sber-designer/proj-mcp --workspace . --project-id my-app
# → "[proj-mcp] stdio ready · project=my-app · workspace=/abs/path"
```

For Claude Code, add to `~/.claude.json` (or run `claude mcp add ...`):

```json
{
  "mcpServers": {
    "sber-designer": {
      "command": "bunx",
      "args": ["-y", "@sber-designer/proj-mcp", "--workspace", "/abs/path/to/project"]
    }
  }
}
```

Then Claude Code sees these tools as `mcp__sber-designer__<tool>`:

| Tool                       | What it does                                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ping`                     | Sanity check; returns project id and version.                                                                                                                                                                    |
| `get_project_index_status` | Reads design-index status, counts, diagnostics, artifacts, and compact project-system summary.                                                                                                                   |
| `ast_read_file`            | Read a file inside the project workspace.                                                                                                                                                                        |
| `ast_write_file`           | Full-replace or create a file (deprecated — use `ast_apply_patch` for any change that fits structured ops).                                                                                                      |
| `ast_apply_patch`          | Apply atomic structured AST ops (`set-prop`, `remove-prop`, `add-import`, `swap-component`, `wrap-with`, `set-children-text`, `replace-text`) to one or more files. ADR-0013.                                    |
| `catalog_list_components`  | Reads the live Storybook/static catalog from `services/api` when `--api-url` is configured; otherwise returns an empty placeholder with a note.                                                                  |
| `editor_post_message`      | Push a chat message into the running editor's chat panel. **Live** when `--api-url` (or `SBER_DESIGNER_API_URL`) points at services/api — see [ADR-0010](../../docs/architecture/adr/0010-editor-mcp-bridge.md). |
| `editor_get_selection`     | Read the JSX node currently selected in the editor's Design mode (`file:line:col` + tag). Same bridge as above.                                                                                                  |
| `create_screen`            | Register a generated design-source screen through `services/api`. Requires `--api-url`; validates paths under `src/stories/screens/` and `src/screens/`.                                                         |
| `git_create_pr`            | Branch, commit, push, and open a PR through `services/api` when `--api-url` is configured.                                                                                                                       |
| `tail_run_events`          | Read the latest `.sber-designer/runs/<runId>/external-runtime/events.jsonl` entries for live-smoke diagnostics.                                                                                                  |

See [`docs/integrations/connect-claude-code.md`](../../docs/integrations/connect-claude-code.md)
for the end-to-end "Claude as agent" walkthrough.

## Current status

**In:**

- stdio transport for Claude Code/Cursor-style MCP clients.
- lightweight REST transport for CI/non-MCP clients — see below.
- workspace-scoped read/write tools.
- structured `ast_apply_patch` through `services/api` when `--api-url`
  is configured.
- Storybook reload-pending marks when write operations touch story files,
  Storybook/Vite/Tailwind config, `package.json`, or create a new file.
- live `catalog_list_components`, `editor_post_message`,
  `editor_get_selection`, `create_screen`, and `git_create_pr` through the
  same api bridge.
- `tail_run_events` for run-log diagnostics without manually opening JSONL
  artifacts.
- Workspace-scoped fs ops (refuses to escape the project root).

## HTTP transport

```bash
bunx @sber-designer/proj-mcp \
  --http \
  --token mysecret \
  --workspace /abs/path \
  --api-url http://localhost:3000 \
  --service-token "$SBER_DESIGNER_SERVICE_TOKEN"

# REST surface (bearer token required on /mcp/tools and /mcp/call):
curl -s localhost:3030/mcp/health
curl -s -H 'authorization: Bearer mysecret' localhost:3030/mcp/tools
curl -s -X POST -H 'authorization: Bearer mysecret' \
     -H 'content-type: application/json' \
     -d '{"name":"ping","arguments":{}}' \
     localhost:3030/mcp/call
```

The HTTP path is **not** the MCP-spec Streamable HTTP transport — it's
a tiny REST surface useful for CI / non-MCP clients today. Claude Code
should still use stdio. MCP-spec Streamable HTTP is still future work.

`--service-token` authenticates the outgoing bridge calls to services/api in
password mode. It is separate from `--token`, which protects this process's
own `/mcp/*` HTTP surface. The bridge token can also be supplied through
`SBER_DESIGNER_SERVICE_TOKEN`.

**Still out:**

- MCP-spec Streamable HTTP transport.
- `editor_set_mode` and `sandbox_get_url` tools.
- Shared schemas with the built-in agent toolset.

## Attribution

Structure inspired by [openpencil's pen-mcp](https://github.com/ZSeven-W/openpencil)
(MIT) — no source is shared yet. See [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md).
