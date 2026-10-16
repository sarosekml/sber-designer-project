# @sber-designer/agent-kit

The default **product** agent kit of the built-in `ai-product-designer`:
agents, skills, knowledge, screen templates and script manifests the product
runtime merges with the personal and project kits.

Moved here from the repository root `.agents/` per
[ADR-0020](../../docs/architecture/adr/0020-default-agent-kit-location.md).
The root `.agents/` now means something else: the kit of the agents
**developing** sber-designer.

## Who reads this

- **Product runtime** (`services/api`): `loadAgentKit()` resolves the default
  root via `resolveDefaultKitRoot()` from `src/paths.ts`, then merges
  `default → personal (~/.sber-designer/agents) → project (<workspace>/.agents)`.
- **Packaging (0401)**: the `files` entry in `package.json` declares `src` and
  `kit` as shipped resources; `SBER_DESIGNER_AGENT_KIT_DIR` overrides the
  resolved root for packaged and remote deployments.

This tree is **product data under development**, not development instructions
for coding agents working on this repository. Edit it only when a task
explicitly targets the product kit. The development kit lives in the root
[`.agents/`](../../.agents/).

## What must not change (0140 invariants)

- **I1.** Internal kit structure: `config.json`, `agents/`, `instructions/`,
  `skills/`, `knowledge/`, `scripts/`, `screen-templates/` — directory names,
  frontmatter keys and file formats stay byte-compatible; extensions are
  additive and ignorable (Agent Skills `SKILL.md`, opencode-style agent
  frontmatter).
- **I2.** The connected-project kit path stays `<workspace>/.agents/` — in
  code, UI, docs and tests.
- **I3.** Kit merge order: `default → personal → project`.
- **I4.** Permission semantics (`allow`/`ask`/`deny`; categories `read`,
  `edit`, `run_script`, `load_skill`, `send_pr`, `set_mode`).
- **I5.** The public HTTP contract `/api/agent-kit/*`; only the value of
  `defaultRoot` changed with the move.

## Path map

| Was                           | Now                                          |
| ----------------------------- | -------------------------------------------- |
| `.agents/` (product kit)      | `packages/agent-kit/kit/`                    |
| `.agents/skills/**`           | `packages/agent-kit/kit/skills/**`           |
| `.agents/knowledge/craft/**`  | `packages/agent-kit/kit/knowledge/craft/**`  |
| `.agents/screen-templates/**` | `packages/agent-kit/kit/screen-templates/**` |
| `<workspace>/.agents/`        | unchanged                                    |
