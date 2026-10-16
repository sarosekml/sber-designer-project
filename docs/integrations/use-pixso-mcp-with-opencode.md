# Use Pixso MCP with OpenCode

This is the current Stage 02 path for design-source-to-screen work:
sber-designer prepares the scoped handoff and acceptance boundary, while
OpenCode owns the Pixso MCP connection.

For API provider mode, sber-designer also has a product-owned MCP path:
enabled servers from `sber-designer.json` connect in the background and are
shown in Settings -> LLM providers -> API MCP servers. That API-mode path is
separate from this OpenCode setup; OpenCode still uses its own MCP config.

References:

- Pixso local MCP docs: <https://pixso.net/developer/en/mcp/local-mcp.html>
- Pixso MCP overview: <https://pixso.net/articles/pixso-mcp/>
- OpenCode MCP docs: <https://opencode.ai/docs/mcp-servers/>
- Builder Fusion local MCP pattern: <https://www.builder.io/c/docs/fusion-connect-to-a-local-mcp-server>

## Setup

1. In Pixso desktop, enable Pixso MCP from the File menu.
2. Keep the target Pixso file open. For selection mode, select exactly one
   frame or layer.
3. Add Pixso to OpenCode's MCP config. Pixso's local MCP endpoint is:

```text
http://127.0.0.1:3667/mcp
```

Example `opencode.jsonc` shape:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "pixso": {
      "type": "remote",
      "url": "http://127.0.0.1:3667/mcp",
      "enabled": true,
    },
  },
}
```

OpenCode also supports local MCP servers under `mcp` with `"type": "local"`
and a `command`, but Pixso's desktop MCP is exposed as a local HTTP endpoint.

## sber-designer Flow

1. Select OpenCode as the active local CLI runtime in Settings.
2. In Assistant, paste a Pixso link or ask for the selected Pixso frame.
3. The ChatPanel shows the design-source mini-form:
   - `New screen` or `Replace current`;
   - target name/path;
   - token policy;
   - component policy.
4. The visible chat message stays clean. The wire prompt gets a structured
   design-source directive.
5. The backend adds new-screen paths to allowed target snapshots and initializes:

```text
.sber-designer/runs/<runId>/reference/design-source/
  source-summary.md
  mapping-report.md
  manifest.json
```

6. OpenCode should use Pixso MCP tools when available, create/update the scoped
   target files, and update the evidence/mapping files when practical.
7. sber-designer accepts the result through the external runtime acceptance
   boundary: target-file diff, source-risk classification, optional screenshot
   diff and `needs_review` when visual impact is uncertain.

## Project Tools

If OpenCode also has `@sber-designer/proj-mcp` configured with `--api-url`,
it can call `create_screen` to register a generated screen through
`services/api`:

```bash
bunx @sber-designer/proj-mcp \
  --workspace /abs/path/to/project \
  --api-url http://localhost:3000
```

`create_screen` validates generated screen paths under:

```text
src/stories/screens/
src/screens/
```

The product-owned MCP runtime is not required for OpenCode. It is used only by
API-mode `ai-product-designer`; local CLI runtimes keep using their own MCP
configuration.
