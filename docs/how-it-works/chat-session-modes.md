---
updated: 2026-07-21T01:16:10+03:00
---

# Chat session modes

Assistant has three conversation modes. They are independent from the canvas
tabs **Interact / Design / Code**.

| Session mode | Purpose                                  | Context and tools                                                                            | Files                                |
| ------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| Ask          | Explain or review                        | Lightweight project/index context; read-only tools                                           | Never writes                         |
| Plan         | Prepare a reviewable implementation plan | Project index, screen structure and component-role evidence; read tools plus `write_file`    | Only `.sber-designer/plans/*.md`     |
| Design       | Build or change an artifact              | Full generation context, component evidence, write tools, readiness checks and optional Jury | Writes the requested project targets |

The selector is stored on `ProjectAssistantSession.sessionMode`. A new session
defaults to Design and a retargeted session inherits its source mode. Every API
request carries the resolved mode and every run manifest records both the mode
and its enforcement level. Built-in API agents use native tool filtering. CLI
runtimes currently receive the same override in their handoff prompt and are
marked `promptOnly` until runtime-specific permissions are implemented.

Auto is not a fourth mode. It is an ephemeral composer toggle that queues tasks;
each queued task runs in Design mode. Turning Auto off returns to the selected
session mode.

## Screen tabs and concurrent runs

Screen tabs are navigation metadata, not chat sessions or run owners. Activating
a screen tab still goes through `setActiveScreenId`, which selects the existing
per-screen Assistant session. Closing the tab removes only navigation metadata:
the session, transcript and any queued/running/stopping run continue to exist.
`Open run` recreates/activates its screen tab before switching the transcript.

Runs on other screens stay visible in Background Runs and on tab/dropdown
indicators. More than five active runs shows a dismissible, polite inline
warning and an expandable `View all` list; it does not block Composer or replace
the coordinator's configured capacity/file-lock decisions. Storybook continues
to use the single `STORYBOOK_ASSISTANT_SCREEN_ID` session regardless of component
selection.

Plan and the compact component map have separate responsibilities:

1. Plan records the desired screen structure, data, actions, states, constraints,
   component roles, likely component ids, gaps and open questions.
2. Plan does not hydrate full component contracts and does not finalize variants.
3. Generate from plan switches to Design.
4. Design creates a run-owned internal structure plan from the approved intent
   and current screen/template context, then revalidates current component
   evidence before implementation. The retrieval stage uses the full compact
   component map and progressively moves selection/hydration away from the old
   fixed candidate cap.

This boundary prevents a reviewed plan from freezing stale component APIs while
keeping the future retrieval pipeline authoritative. Session modes do not
implement the compact component map themselves.

Details: [Ask](./chat-mode-ask.md), [Plan](./chat-mode-plan.md),
[Design](./chat-mode-design.md).

## Main implementation points

- `packages/shared-types/src/assistant-history.ts` — persisted mode contract.
- `services/api/src/session-mode.ts` — prompt overrides, tool allowlists and plan
  path guard.
- `services/api/src/prompt-builder.ts` — lightweight Ask/Plan prompt branches.
- `apps/web/src/components/editor/chat/SessionModeSelect.tsx` — selector and
  cost explanation.
- `apps/web/src/components/editor/chat/PlanDocumentCard.tsx` — live plan preview,
  editing and handoff.
- `apps/web/src/components/editor/CanvasNavigationStrip.tsx` — screen tab and
  Storybook component navigation without changing session ownership.
- `apps/web/src/components/editor/chat/BackgroundRunsStrip.tsx` — cross-screen
  run list and high-concurrency warning.
