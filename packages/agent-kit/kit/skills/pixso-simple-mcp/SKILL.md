---
name: pixso-simple-mcp
description: Use when a task mentions Pixso MCP, Pixso Desktop, talk-to-pixso-mcp, a Pixso plugin channel, Pixso selection/frame export, live Pixso drawing, or using Pixso design context for a sber-designer screen.
compatibility: sber-designer
---

# Pixso Simple MCP

Use this skill to operate Pixso through product-owned MCP tools without
guessing tool names. Pixso can provide design context or receive live document
edits; production screens still live in the connected Git project.

## Load first

Call `read_agent_knowledge` for these ids when they are relevant before
following the runbook:

- `sber-designer-architecture`
- `project-index-anatomy`
- `catalog-response-shape`
- `design-mode-contract`

## When to use vs when to defer

Use this skill when:

- The user mentions Pixso, Pixso MCP, Pixso Desktop, `talk-to-pixso-mcp`, a
  Pixso plugin channel, Pixso selection, Pixso frame, or Pixso export.
- The task is to inspect a Pixso document before creating or editing a
  sber-designer screen.
- The task is to draw, update, export, or diagnose a live Pixso document through
  `simple-pixso-mcp`.

Defer to another skill when:

- Pixso is only visual reference and the next step is production source
  composition; load `product-screen-generation`.
- The task is a selected live-DOM tweak in sber-designer; use
  `visual-design-editing`.
- The user only asks which project token/component/icon to use; use
  design-system context.

Anti-examples:

- Do not treat Pixso as the source of truth for sber-designer screens.
- Do not call Figma-style tools such as `get_design_context`,
  `get_screenshot`, or `design_to_code` unless the current MCP inventory lists
  those exact tools.
- Do not invent namespace variants such as `talk-to-pixso-mcp--get_selection`,
  `talk-to-pixso-mcp_get_selection`, or
  `mcp__talk-to-pixso-mcp__get_selection`.

## MCP inventory rules

API-mode product MCP tools use canonical names:

```text
mcp__<normalized_server_namespace>__<normalized_tool_name>
```

For `talk-to-pixso-mcp`, the normalized namespace is `talk_to_pixso_mcp`.
Examples:

```text
mcp__talk_to_pixso_mcp__connect_to_pixso
mcp__talk_to_pixso_mcp__get_selection
mcp__talk_to_pixso_mcp__read_my_design
mcp__pixso_desktop__read_frame
```

Before using Pixso tools:

1. Read the `Connected MCP Tools` prompt block and the actual callable tool
   list.
2. Confirm the server has exposed tools, not only upstream tools. Product MCP
   exposes at most 64 tools from the server inventory. In auto mode these are
   the first 64 after `allowedTools` and `disabledTools`; after a manual
   Settings toggle they are the explicit selected tool set for that project.
3. If direct Pixso tools are absent but a product MCP discovery/broker tool is
   present, use it to list and call the real upstream tool.
4. If neither direct tools nor a broker are available, stop and report that the
   Pixso MCP server is connected but not exposed to the agent. Ask the user to
   enable the tool in Settings, reset tool selection, configure `allowedTools`,
   or reload the MCP server.

## Server selection

| Server                          | Use when                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `talk-to-pixso-mcp`             | Hosted or first-party `simple-pixso-mcp`; best for plugin channel workflows, live document operations, drawing, exports, diagnostics. |
| `pixso-desktop`                 | Pixso Desktop local MCP at `http://127.0.0.1:3667/mcp`; best for local desktop design reading if its tools are connected.             |
| `talk-to-pixso-local` or custom | Developer is running local `simple-pixso-mcp`; use the actual namespace and tool inventory shown in the prompt.                       |

Product MCP servers usually connect in the background when the app starts or MCP
config is reloaded. Manual Settings actions are recovery steps, not the normal
first path. When both Pixso servers are present and the user gives a plugin
channel, prefer `talk-to-pixso-mcp`.

## Runbook

1. **Check exposure.** Identify the Pixso server, canonical namespace, exposed
   tool names, hidden-by-limit count, disabled tools, and diagnostics. Never
   infer a tool from the server name alone.
2. **Connect.** For hosted/remote `simple-pixso-mcp`, first call
   `connect_to_pixso` when the user provides a channel id. If the user asks to
   connect but gives no channel, ask for the Pixso plugin channel.
3. **Inspect before acting.** Use `get_document_info`, `get_selection`,
   `read_my_design`, `get_local_components`, and `get_styles` when available.
4. **Choose the path.**
   - Pixso to React screen: gather Pixso context, then load
     `product-screen-generation` and use project index/catalog/source tools.
   - Live Pixso drawing: plan layout first; use `design_skeleton` for long
     screens, `batch_design_dsl` for structured DSL, or `batch_create` for
     compact operations.
   - Existing Pixso edit: prefer targeted setters when they are exposed; avoid
     delete-and-recreate for style/text tweaks.
   - Export: use `export_node_as_image`,
     `export_local_styles_and_components_to_disk`, or
     `export_design_spec_bundle_all_pages_to_disk` when exposed.
5. **Verify.** After Pixso edits, export an image or read structure again. After
   production screen edits, validate the generated sber-designer screen.
6. **Report boundaries.** In the final answer, separate Pixso MCP actions from
   source-code changes.

## Pixso MCP tool map

Common `simple-pixso-mcp` upstream names:

| Intent           | Upstream tool names                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Connect/recover  | `connect_to_pixso`, `get_runtime_diagnostics`, `get_request_runtime_status`                                         |
| Inspect          | `get_document_info`, `get_selection`, `read_my_design`, `get_local_components`, `get_styles`                        |
| Export           | `export_node_as_image`, `export_local_styles_and_components_to_disk`, `export_design_spec_bundle_all_pages_to_disk` |
| Batch drawing    | `batch_create`, `batch_design_dsl`, `design_skeleton`, `design_fill_section`, `design_refine`                       |
| Undo checkpoints | `commit_undo`, `trigger_undo`                                                                                       |

Use the canonical direct names only when they are exposed. For example,
`connect_to_pixso` on `talk-to-pixso-mcp` becomes:

```text
mcp__talk_to_pixso_mcp__connect_to_pixso
```

## Recovery

- Hidden by first-64 limit: product MCP only exposes the first 64 tools directly
  in auto mode, or the explicit selected set after Settings changes. Do not
  guess direct names for hidden tools. Use `list_product_mcp_tools` /
  `call_product_mcp_tool` if available. If a direct tool must be exposed, ask
  the user to search for it in Settings, disable another selected tool first if
  the selected count is already 64, then switch the desired tool on; reset tool
  selection or configure `allowedTools` when a stable default subset is better.
- Disabled in Settings: ask the user to switch the tool back on in Settings or
  reset tool selection.
- Disabled in config: do not try to enable it from Settings; `disabledTools` is
  a config-level block.
- `not_connected`: call `connect_to_pixso` with the channel id.
- Plugin/channel timeout: call `get_runtime_diagnostics`; ask the user to
  reopen the Pixso Connect plugin or provide a fresh channel.
- Repeated tool failure: change strategy after one retry. Do not repeat the same
  failed call with identical arguments.

## Tool call examples

Connect to a hosted Pixso channel:

```jsonc
{
  "tool": "mcp__talk_to_pixso_mcp__connect_to_pixso",
  "input": { "channel": "ws7wxqu0" },
}
```

Read the current Pixso selection:

```jsonc
{
  "tool": "mcp__talk_to_pixso_mcp__get_selection",
  "input": {},
}
```

Read design details after selecting or identifying a node:

```jsonc
{
  "tool": "mcp__talk_to_pixso_mcp__read_my_design",
  "input": { "nodeId": "12:34" },
}
```

Create a skeleton before filling a large live Pixso screen:

```jsonc
{
  "tool": "mcp__talk_to_pixso_mcp__design_skeleton",
  "input": {
    "rootName": "Administration Dashboard",
    "sections": ["Header", "Metrics", "Risk Table"],
  },
}
```

Broker fallback, only if this tool is in the current callable list:

```jsonc
{
  "tool": "call_product_mcp_tool",
  "input": {
    "serverKey": "talk-to-pixso-mcp",
    "toolName": "connect_to_pixso",
    "arguments": { "channel": "ws7wxqu0" },
  },
}
```

## Output contract

- State which Pixso MCP server and canonical namespace were used.
- Name the Pixso tools actually called.
- If Pixso context leads to source edits, name the production files changed and
  validation performed.
- If Pixso MCP is connected but not exposed, say that plainly and mention
  Settings tool selection, `allowedTools`, or the first-64 limit instead of
  pretending tools are callable.
