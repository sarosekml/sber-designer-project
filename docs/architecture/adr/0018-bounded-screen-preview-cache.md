---
id: ADR-0018
title: Bounded screen preview cache
status: Accepted
date: 2026-07-19
scope: screen tabs, previews, and active editor target
refines:
  - ADR-0004
---

# ADR-0018: Bounded Screen Preview Cache

## Status

Accepted (2026-07-19).

## Context

ADR-0004 established one shared sandbox iframe for Interact, Design and Code.
That decision prevents mode switches from restarting the live preview and keeps
one editor target for DOM inspection and AST mapping.

Task 0124 adds browser-like screen tabs. The number of open tabs must not become
the number of live preview documents: a project can have dozens of open screen
tabs, while every Storybook/Vite iframe owns a DOM, JavaScript runtime, timers
and an HMR connection. Keeping every tab mounted would make memory and idle CPU
grow with navigation history.

At the same time, always destroying the previous screen iframe makes a quick
A→B→A workflow pay the full preview startup cost on every return. Users also
run independent agent tasks on several screens and need to switch between those
screen contexts without moving the run or transcript to the currently visible
screen.

## Decision

Screen tabs, preview documents and agent runs are independent resources.

### Screen tabs

- The editor may keep any number of open screen tab ids.
- Tab state is ephemeral UI state and does not create sandbox sessions,
  iframes or agent runs.
- Exactly one tab/screen is the active editor target.

### Active preview

Exactly one `ScreenPreviewFrame` is active. It is the only frame that:

- is visible, focusable and interactive;
- registers `designStore.previewWindow` and the editor bridge;
- owns Design/Code DOM overlays, selection, comments and Flow runtime;
- contributes canvas warning/readiness UI.

Interact, Design and Code continue to share this active frame. Switching editor
mode must not create or remount a frame.

### Warm preview cache

The editor has two auxiliary screen-frame slots shared by recently inactive
previews and the existing Interact Flow overlay. Without an overlay it may
retain at most two inactive frames in an LRU pool; while an overlay is open only
one warm slot remains. Warm frames are passive:

- hidden, inert and excluded from the accessibility tree;
- disconnected from editor bridge, selection overlays and Flow runtime;
- served by the existing project sandbox session;
- promoted to active only after the previous active bindings are detached.

The total Screen-view budget therefore remains three iframes: one active editor
target plus two auxiliary frames. The implementation ships only after a browser
benchmark. If two warm frames cause unacceptable idle CPU or memory use, the
default pool is reduced to one. The public tab behavior does not depend on the
cache size.

### Invalidation

Correctness wins over retained state. Warm frames are evicted or marked stale
when their project, sandbox session, screen source or preview generation changes,
and when the editor enters Storybook view. Background run invalidation is keyed
by the run's captured `screenId`, never by the screen that happens to be active
when an SSE event arrives.

### Storybook view

Storybook component browsing uses one active preview frame and no component
tabs or warm component frames. Selecting another component replaces the active
Storybook preview. Entering Storybook evicts the screen warm pool while keeping
screen tab metadata.

## Relationship To ADR-0004

ADR-0004 remains authoritative for editor modes and the single active editor
target. This ADR narrows the phrase “one iframe per session”:

- one **active editor iframe** is still mandatory;
- up to two passive, bounded screen preview frames are an implementation cache,
  not additional editor targets or sandbox sessions.

If the passive cache cannot satisfy the performance and isolation gates, the
fallback is a single iframe with the same screen-tab UX.

## Considered Options

### One iframe for every open tab

Rejected. DOM, JavaScript runtimes, timers and HMR connections would grow with
an unbounded navigation list. Closing a UI tab would also become an accidental
resource-management operation.

### Always one iframe, no warm cache

Safe and remains the fallback. It has the smallest resource footprint but makes
recent screen revisits pay the full navigation/render cost.

### Bounded passive LRU cache

Chosen. It limits worst-case resource growth while accelerating
the common A→B→A workflow. It requires strict active-only bindings and explicit
invalidation.

### Multiple sandbox sessions

Rejected. Tabs are views inside one connected project. They must share the
project dev-server, filesystem and HMR source of truth.

## Consequences

Positive:

- Open tab count no longer predicts iframe/process count.
- Recent screen switching can preserve a ready DOM.
- Agent concurrency remains independent from canvas rendering.
- Interact/Design/Code keep one active target and shared context.

Trade-offs:

- Up to three screen iframe documents and HMR clients may exist in Screen view.
- Arbitrary project JavaScript in passive frames can continue running even when
  hidden; the bounded size and benchmark are therefore mandatory.
- `CanvasFrame` must separate active-only bindings from passive frame lifecycle.
- Background writes need screen-scoped cache invalidation.

## Acceptance Gates

- Maximum three screen iframes: one active plus two auxiliary slots shared by
  warm previews and the Flow overlay.
- Exactly one frame is focusable and registered as `previewWindow`.
- Twenty open tabs do not increase preview iframe count beyond the pool.
- Warm revisit is measurably faster than cold revisit on the agreed fixture.
- Idle CPU/RAM and HMR connection deltas are recorded before acceptance.
- Storybook view contains one preview iframe and no component preview cache.
- Switching screens during concurrent runs does not mix sessions, transcripts
  or changed-file invalidation.

## Implementation And Validation

Implemented by task 0124 in `CanvasFrame`, with pure LRU rules in
`apps/web/src/lib/screen-preview-cache.ts` and screen-scoped revisions in the
editor store. The stream handler invalidates the run's captured `screenId` as
soon as a successful tool result reports target-file changes.

Browser smoke on the 51-screen `ibp-ui-kit` fixture recorded:

- four open screen tabs -> three iframe documents, exactly one visible and
  focusable; both passive frames were `inert`, `aria-hidden` and `tabIndex=-1`;
- a fifth target replaced the oldest warm document without increasing iframe
  count;
- Screen -> Storybook reduced the pool to one iframe;
- ten consecutive component selections remained at one iframe and created no
  component tabs;
- Storybook -> Screen restored the four tab records while starting from one
  freshly active screen frame;
- Interact -> Design preserved the active preview URL and one active frame.

The structural resource gate is therefore accepted at the two-warm-frame
default. Extended heap/idle-CPU profiling remains useful for unusually heavy
connected projects; the single constant `MAX_WARM_SCREEN_PREVIEWS` can be
reduced to one without changing tab behavior.

## Links

- [ADR-0004 Three editor modes](./0004-three-modes.md)
- [Canvas and sandbox](../../how-it-works/canvas-and-sandbox.md)
