---
name: project-restructure
description: Plan and apply a reviewable restructure of a static HTML repository into the canonical sber-designer pages/ plus design-system/ layout.
compatibility: sber-designer
sd:
  profile:
    - html-css
---

# Project Restructure

Use this skill only when the user explicitly asks to restructure, migrate, or
prepare a static HTML project for sber-designer. The operation is intentionally
plan-first because it can move many project-owned files.

## Load first

Call `read_agent_knowledge` for these ids before applying the runbook:

- `project-index-anatomy`
- `apply-patch-recipes`
- `frontend-ui-rules`

## Required sequence

1. Call `get_project_structure_report`. Do not begin with a broad file scan.
2. If the report is `unsupported`, stop and explain the framework/bundler
   reason. Do not convert React, Vue, Svelte, Angular, or bundled applications.
3. If `alreadyCanonical` is true, make no source edits. Report the no-op and
   offer a preview rebuild or reindex only when needed.
4. Check whether the git tree is dirty when that information is available.
   Recommend a commit before applying broad moves; never discard local work.
5. Present one reviewable plan containing every source → target mapping,
   required link rewrite, target collision, broken reference, and manual
   follow-up. Wait for explicit user confirmation before any write.
6. After confirmation, call `apply_project_restructure` once with the exact
   `planDigest` from the displayed report and `confirmedByUser: true`. Do not
   reproduce the migration with generic write/patch tools.
7. The apply tool creates the canonical package, stages moves, changes only the
   references required by those moves, rebuilds managed indexes, registers
   actual screens, requests one reindex, persists a run receipt, and rolls back
   if finalization fails.
8. Never bypass a rejected stale plan or target collision. Generate a new
   report, show the revised plan, and wait for confirmation again.
9. Treat the receipt's `postCheck` as the deterministic final report. It must
   state canonical status, remaining broken references, registered pages,
   changed paths, and manual follow-ups.

## Scope boundaries

- `pages/**` contains product screens.
- `design-system/Design.md`, `tokens.css`, and `components.css` are canonical
  design-system sources.
- `design-system/refs/**` contains user-owned HTML/CSS/JS reference examples.
- `design-system/index.html` and root `index.html` are managed outputs. Rebuild
  them; do not hand-author or overwrite an unmarked user file.
- Skip `.git`, `.sber-designer`, `node_modules`, build outputs, symlinks, and
  generated caches.
- Do not add a package manager, framework, bundler, dependency, or second
  design-system pipeline.

## Final response

Name the previous and final status, all moved/created/rebuilt files, link
rewrites, validation results, remaining collisions or broken references, and
the reindex job when available. Include the receipt plan digest. Do not claim
success if `completed` is false, the post-check is not canonical, or a local
reference remains broken.
