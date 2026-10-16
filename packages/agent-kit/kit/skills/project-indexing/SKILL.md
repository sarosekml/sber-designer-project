---
name: project-indexing
description: Analyze and enrich `.sber-designer/design-index/*` artifacts without editing production source files.
compatibility: sber-designer
---

# Project Indexing

Use this skill when running or reviewing background project-index enrichment.

## Load first

Call `read_agent_knowledge` for these ids when they are relevant before
following the runbook:

- `project-index-format`
- `project-index-anatomy`
- `sber-designer-architecture`

Workflow:

1. Read `project-index-format` and `project-index-anatomy` knowledge before
   producing enrichment.
2. Treat deterministic scanner output as facts, not suggestions.
3. Keep enrichment bounded to project-index artifacts.
4. Prefer `agent-notes.jsonl` for component/screen/token guidance.
5. Prefer `diagnostics.json` for missing Storybook, ambiguous route ownership,
   unsupported token formats, or weak Design-readable confidence.
6. Do not edit production source files during indexing.
7. Return strict JSON only when called by the indexing runner.

Useful notes are short, specific, and actionable for `ai-product-designer`.
Avoid broad style advice that belongs in `DESIGN.md` or the design brief.
Project-specific component names, imports, tokens, routes, and examples belong
in generated index artifacts for the connected project. Treat them as
current-project evidence for screen generation, not cross-project defaults.
