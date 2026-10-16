# Use Figma MCP with OpenCode

Figma is secondary in Stage 02, but it uses the same sber-designer handoff as
Pixso: parse link or node id, scope target files, initialize evidence, and let
the external runtime read the design through its configured MCP tools.

References:

- Figma MCP docs: <https://developers.figma.com/docs/figma-mcp-server/>
- Figma MCP tools and prompts: <https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/>
- OpenCode MCP docs: <https://opencode.ai/docs/mcp-servers/>

## Current Support

- Figma links are detected in Assistant prompts.
- `node-id=123-456` is normalized to `123:456` in the handoff.
- The ChatPanel mini-form and backend evidence pack are shared with Pixso.
- Figma setup remains manual in OpenCode for this stage.

## Flow

1. Configure Figma MCP in OpenCode using the MCP mode available to your
   organization and client.
2. Paste a Figma link into Assistant.
3. Confirm the mini-form target mode/path and mapping policies.
4. Run through OpenCode.
5. Review generated files plus:

```text
.sber-designer/runs/<runId>/reference/design-source/source-summary.md
.sber-designer/runs/<runId>/reference/design-source/mapping-report.md
```

If the Figma MCP server is unavailable or the node cannot be read, the external
runtime should report the blocker instead of guessing from the URL.
