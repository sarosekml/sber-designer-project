---
id: ADR-0017
title: Component description source of truth
status: Accepted
date: 2026-07-09
scope: component description persistence and projections
---

# ADR-0017: Component Description Source Of Truth

## Status

Accepted.

## Context

sber-designer builds a project design index from several project surfaces:
Storybook CSF files, static HTML/CSS catalogs, `.sber-designer/*` metadata, and
agent-authored knowledge. Task 0083 introduced the `Description for AI` layer so
weaker generation models can reuse components without reading all source code.
The first design made Storybook Docs the preferred human-authored surface when a
project had Storybook, and used sidecars only for no-Storybook projects.

0112 expanded the same workflow to HTML-first projects. That made the old
surface-as-canon rule ambiguous:

- Storybook is optional, and React-static projects may have no obvious surface.
- HTML-first needs a readable section in `design-system.html`, but that file is
  a generated preview and can be rebuilt.
- External CLI runtimes can safely write project files, but product-owned
  projections need round-trip gates and permission checks.
- The design index and `usage-cards.jsonl` are derived caches; they must never
  become the only place where human-reviewed facts live.

## Decision

The canonical authored source for a component description is always:

```text
.sber-designer/components/<componentId>.md
```

The sidecar stores both a readable `Description for AI` markdown rendering and a
structured `sberDesigner.descriptionLayer` block. It is project-owned, reviewable
in git, and survives index rebuilds.

Storybook CSF descriptions and HTML-first `design-system.html` sections are
recoverable projections:

- React + Storybook: optional CSF projection, currently
  `parameters.docs.description.component`, with a future structured
  `parameters.sberDesigner.descriptionLayer` projection.
- React static / no Storybook: no projection by default.
- HTML-first / CSS catalog: default projection into
  `<section data-sd-description-for="...">` in `design-system.html`.

The indexer reads sidecar first. Surface projections may fill gaps or provide
debug/divergence evidence when a sidecar is absent or stale, but when both exist
the sidecar wins. `usage-cards.jsonl`, `description-map.json`, and manifest
coverage are derived from the authored layer.

## Considered Options

### Surface as canonical source

Storybook Docs or `design-system.html` would be the source humans edit.

This gives high visibility in the component surface, but it splits behavior by
profile and makes generated HTML previews too important. It also means external
CLI runs need to mutate CSF/HTML safely, including AST/round-trip logic that
belongs in product tools.

### Sidecar as canonical source

The sidecar is the only required authored source. Product-owned tools can
project it into Storybook or HTML surfaces when useful.

This keeps one write path, makes Storybook optional, and gives CLI runtimes a
safe fallback. It requires explicit projection/restore behavior so people still
see descriptions near component demos.

### Derived index as canonical source

Store confirmed facts only in `usage-cards.jsonl` or `components.jsonl`.

Rejected. The design index is a rebuildable cache and is often regenerated from
source. Human-reviewed facts would be easy to lose or silently stale.

## Consequences

Positive:

- The description workflow has one canonical file layout for all project
  profiles.
- External CLI runtimes can participate by writing sidecars only; API finalizers
  can reindex after sidecar changes.
- Projection writers are narrow, auditable, and can be permission-gated as edit
  operations.
- Rebuild/Restore semantics for `design-system.html` are deterministic: rebuild
  can drop projections, and restore can re-render them from sidecars.

Trade-offs:

- Users may expect Storybook Docs to be the source because that is where the
  description is visible. Documentation and DS Browser must show provenance and
  divergence clearly.
- If a team edits a projection by hand, the sidecar still wins. The projection
  must be imported explicitly or re-authored through the interview.
- Full Storybook structured projection remains optional follow-up work; it is no
  longer required for canonical storage.

## Migration

Existing Storybook or `design-system.html` descriptions are read as projections
and can gap-fill missing sidecars during indexing. A project can promote them by
running the Description for AI interview or an import flow that writes the
sidecar.

When Storybook is added later, sidecars are not migrated away. Instead,
Storybook Docs are generated or restored from the sidecars.

## Links

- [Describe components for AI](../../how-it-works/describe-components-for-ai.md)
- [HTML-first projects](../../how-it-works/html-first-projects.md)
