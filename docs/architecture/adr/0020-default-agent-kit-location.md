---
id: ADR-0020
title: Default agent kit lives in packages/agent-kit, root .agents/ becomes the development kit
status: Accepted
date: 2026-09-20
accepted: 2026-09-21
scope: repository layout, agent-kit resolution, agent instruction discovery
refines:
  - ADR-0003
  - ADR-0016
---

# ADR-0020: Default agent kit location and the meaning of `.agents/`

## Status

Accepted (proposed 2026-09-20, implemented on 2026-09-21 by development task 0140).
Refines [ADR-0003](0003-bun-monorepo.md) (what belongs in a workspace
package) and [ADR-0016](0016-agent-runtime-adapters.md) (what a runtime is
handed). Supersedes nothing.

## Context

`.agents/` at the repository root is the **default product agent kit** of the
built-in `ai-product-designer`: 69 files, 372 KB of agents, skills, knowledge,
screen templates and script manifests. The loader
(`services/api/src/agent-kit/loader.ts`) merges three kits in order:

```text
product default (repo root)  →  personal (~/.sber-designer/agents)  →  project (<workspace>/.agents)
```

Four problems follow from keeping the product default at the repository root.

**1. The path name means something else in the ecosystem.** `.agents/` is the
conventional location of the kit for an agent working **on the repository that
contains it**. opencode discovers `.agents/skills/**` directly; Claude Code
reads the same Agent Skills format. So any external coding agent opening the
sber-designer repository picks up thirteen product skills
(`product-screen-generation`, `pixso-simple-mcp`, `project-restructure`, …) as
its own development instructions. Today this is prevented only by prose —
standing rule 10 in `CLAUDE.md` tells agents not to read `.agents/`. A written
warning holds exactly until the first agent that did not read it, and it cannot
be enforced by any check.

**2. Rule 10 and rule 12 pull in opposite directions.** Rule 12 requires the
kit to stay natively readable by third-party agent apps; rule 10 requires
agents working on this repository not to read it. Both are correct, but they
are only compatible once one observes _which_ kit each speaks about: rule 12 is
about the kit **materialised inside a connected project**, where `.agents/` is
the right name and an external agent _should_ read it. Rule 10 is about
sber-designer's own repository, where the same tree is not a kit-in-place at
all — it is a **product asset under development**. The conflict is an artefact
of storing a shipped asset at a path reserved for in-place configuration.

**3. Root resolution does not survive packaging.** Four modules resolve the
default root through a duplicated constant:

```ts
const REPO_ROOT_GUESS = resolve(here, '..', '..', '..', '..');
resolve(REPO_ROOT_GUESS, '.agents');
```

in `agent-kit/loader.ts`, `agent-kit/tools.ts`, `screen-templates/index.ts` and
`routes/agent-kit.ts`. The guess assumes an unbundled `src` layout and a
process whose repository root is reachable by four `..` hops. Both assumptions
break under the Tauri packaging planned in
development task 0401 and under the remote/bridge modes
sketched in development task 0400b,
where the server's working directory is not the repository. A root dot-directory
also has no declared file list, so nothing tells a bundler that those 69 files
are a runtime resource.

**4. The kit is a product surface with its own gates, and they are pinned to
the path.** `tests/eval/baselines/manifest.json` lists five `.agents/**`
patterns that decide when the screen-generation eval gate must run;
`tests/0107-agent-kit-compatibility-lint.test.ts` lints the kit against the open
Agent Skills format from `process.cwd()`. These are quality gates on _product
data_, which is further evidence the tree is a product asset rather than
repository configuration.

Separately, the project wants a place for **development** agent material —
spec-driven workflow skills, review checklists, role definitions — readable by
every agent that works on the repository, not only by Claude Code. That is
precisely what `.agents/` is for, and it is currently occupied.

## Decision

**1. The default product kit moves into a workspace package.**

```text
packages/agent-kit/
  package.json        # @sber-designer/agent-kit
  src/index.ts        # resolveDefaultKitRoot(), materialiseKit(), kit types
  kit/                # the current .agents/ tree, byte-identical
    config.json
    agents/ instructions/ skills/ knowledge/ scripts/ screen-templates/
```

The tree inside `kit/` is not restructured: directory names, frontmatter keys
and file formats stay exactly as they are, so rule 12 continues to hold.

**2. `resolveDefaultKitRoot()` is the single resolution point.** The four
`REPO_ROOT_GUESS` constants are deleted and replaced by one function exported
from the package, resolved relative to the package rather than guessed from the
repository root. `SBER_DESIGNER_AGENT_KIT_DIR` overrides it for packaged and
remote deployments.

**3. The root `.agents/` is kept and re-purposed as the development kit** — the
agents, skills and instructions used by whoever (human or agent) develops
sber-designer itself. It follows the same open formats, so opencode, Claude
Code, Codex CLI and Cursor all discover it natively. After this ADR, an agent
that reads `.agents/` at the root is doing the right thing, not the wrong one.

**4. Development instructions live in universal locations.** `AGENTS.md` becomes
the canonical instruction document for every agent working on the repository;
`CLAUDE.md` is reduced to a pointer to it. Deep material lives in `.agents/` and
`docs/`. No development guidance is stored in a vendor-specific location.

**5. Standing rule 10 is inverted rather than deleted.** The rule stops saying
"do not read `.agents/`" and starts saying: `packages/agent-kit/kit/` is product
data and must not be treated as development instructions; `.agents/` is the
development kit and should be read.

## Alternatives considered

**A. Keep `.agents/` at the root, keep rule 10.** Zero migration cost. Rejected:
it leaves an unenforceable prose rule as the only barrier, leaves
`REPO_ROOT_GUESS` in place for 0401/0400b, and leaves no home for development
agent material.

**B. `services/api/src/agent-kit/default-kit/`.** Co-locates the data with its
loader and makes the path relative, which survives bundling. Rejected: 372 KB of
product data inside a service's `src/` mixes data with code against the
repository's own module conventions, and the kit is consumed beyond `services/api`
— `apps/web` renders it (`AgentKitPanel`, `SettingsDialog`, `ContextStrip`) and
`services/sandbox` knows about it.

**C. `product/agent-kit/` or `assets/agent-kit/` at the root.** Cheapest real
move — one directory plus one constant, and `refs/` sets a precedent for a
root-level data directory. Rejected: introduces a top-level directory outside the
documented layout, and still offers no declared file list for packaging and no
natural home for `resolveDefaultKitRoot()`. It stops halfway.

**D. `.sber-designer/agent-kit/`.** Rejected outright: `.sber-designer/` is the
metadata convention of a **connected project** (`project.sdproj`, `design-index`,
`previews`). Its appearance in sber-designer's own repository would assert that
sber-designer is opened as a project inside itself.

## Consequences

**Positive**

- The namespace collision is resolved structurally; rule 10 becomes a statement
  of architecture instead of a warning that an agent may miss.
- Packaging (0401) gets a declared resource with a `files` entry, and remote
  modes (0400b) get an explicit, overridable root.
- `packages/agent-kit` becomes the natural home for `materialiseKit()`, the
  operation development task 0024 needs to write a
  project-local kit into a connected repository.
- Development agent material gets the location the ecosystem already looks in,
  which serves every agent runtime equally rather than Claude Code alone.

**Negative / costs**

- An eighth workspace package.
- About 65 documents mention `.agents`; each must be read rather than
  sed-replaced, because most of them correctly describe the **project** kit,
  whose name does not change.
- `tests/eval/baselines/manifest.json` must be updated in the same commit as the
  move. If it is not, the screen-generation eval gate silently stops triggering
  on prompt and skill changes — a gate that fails open is worse than no gate, so
  0140 treats this as the migration's primary hazard.
- A transition window exists in which an agent may find product skills at the
  old path and development expectations at the same name. The move and the
  re-purposing are therefore sequenced, not simultaneous.

**Neutral**

- The workspace/project kit path `<workspace>/.agents/` is unchanged, as are all
  runtime permission semantics, the merge order and the kit file formats.
- Historical development records are not rewritten: they record what was true
  when written.
