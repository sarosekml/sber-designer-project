---
id: ADR-0016
title: Hybrid agent runtime adapters
status: Accepted
date: 2026-06-25
scope: API and CLI agent runtimes
refines:
  - ADR-0005
  - ADR-0006
---

# ADR-0016: Hybrid Agent Runtime Adapters

## Status

Accepted.

## Context

sber-designer has two agent execution paths:

- the built-in API loop through `@sber-designer/llm-gateway`;
- external local CLI runtimes such as Codex CLI, Claude Code, and OpenCode.

The API loop is still required for closed-contour deployments, tool governance,
and product-owned agent behavior. External CLI runtimes are useful because they
bring local auth, their own MCP configuration, and strong project-editing
capabilities. Treating either path as the only runtime would make the product
less deployable.

## Decision

Keep the built-in API loop and add adapter-driven CLI runtimes behind a common
runtime contract.

Each CLI runtime is described by data in `AgentRuntimeDef` plus an `AgentAdapter`
facade:

- launch resolution is separate from detection and can come from local profiles,
  env overrides, or PATH;
- prompt delivery is explicit (`stdin`, `file`, or `argv`) and guarded by a byte
  budget;
- capabilities are derived from the runtime definition;
- raw runner streams are normalized into product-level agent events;
- external runtime SSE events are also appended to a per-run JSONL log.

## Consequences

Adding a new CLI runtime should primarily mean adding a runtime definition,
adapter wiring, parser/replay fixtures, and tests. UI capability gating can read
the same capabilities that detection and handoff use.

The API loop remains the default product contract for environments where local
CLI agents are unavailable or disallowed. CLI adapters are an additional runtime
surface, not a replacement for `@sber-designer/llm-gateway`.
