# sber-designer `.agents`

This folder is the default product agent kit for the built-in
`ai-product-designer`.

It is product data used by sber-designer at runtime. It is not the instruction
set for external coding agents working on this repository. External development
guidance lives in `AGENTS.md`, `CLAUDE.md`, ADRs and current user instructions.

Full documentation:

- [Agent system](../../../docs/how-it-works/agent-system.md)
- [Code map](../../../docs/how-it-works/code-map.md) — where each module of
  sber-designer itself lives (for humans browsing this repo)
- [LLM providers and runtimes](../../../docs/how-it-works/llm-providers-and-runtimes.md)
- [Run records and diagnostics](../../../docs/how-it-works/run-records-and-diagnostics.md)

## What lives here

```text
.agents/
  config.json
  agents/
  instructions/
  skills/
  knowledge/
  scripts/
  screen-templates/
```

The loader merges kits in this order:

```text
product default -> optional personal kit -> optional connected-project kit
```

Connected-project facts still come from the opened project: source files,
Storybook/static catalog, HTML/CSS catalog, `.sber-designer/project.sdproj`,
`.sber-designer/design-index/*`, project instructions, HTML-first
`Design.md`/`tokens.css`/`components.css` sources, attachments and run
artifacts.

## Runtime permissions

Project kits can define a `permission` map in `.agents/config.json`,
instruction frontmatter, or agent frontmatter. The supported actions are
`allow`, `ask`, and `deny`; the supported categories include `read`, `edit`,
`run_script`, `load_skill`, `send_pr`, and `set_mode`.

`read` and `load_skill` are normally safe to `allow`. `edit`, `run_script`, and
`send_pr` should usually stay on `ask`, while sensitive paths can be set to
`deny`. When a tool is set to `ask`, sber-designer pauses the run and shows a
permission card in chat. The user may approve once or choose
**Always allow this session**; that memory is process-local and is not written
to the connected project.
