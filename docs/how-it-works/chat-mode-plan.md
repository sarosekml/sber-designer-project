---
updated: 2026-07-21T01:16:10+03:00
---

# Plan session mode

Plan creates or updates one reviewable Markdown artifact under
`.sber-designer/plans/`. No screen, component, story, style or flow source may be
changed in this mode. The built-in toolset exposes read tools and `write_file`;
the permission and file handlers both reject writes outside the plan folder.

A useful plan contains:

- intent, constraints and unresolved questions;
- regions and information hierarchy;
- data, actions, navigation and loading/empty/error states;
- component roles and likely project component ids with confidence;
- design-system gaps and acceptance checks;
- a clear next step.

Plan uses project-index evidence to make the proposal concrete, but does not
hydrate final props, imports or variants. Those can become stale between review
and implementation. **Generate from plan** switches the same session to Design,
where current component evidence is revalidated and exact contracts are loaded.
Once the planned compact component map is implemented, this same boundary will
use the full map and uncapped relevance-based selection. **Refine plan** keeps Plan selected and
prepares the composer for user feedback.

`PlanDocumentCard` reads the real file through the files API, renders Markdown,
and saves edits back to the same file. The workspace document—not a transcript
snapshot—is the source of truth and remains visible to Git/SCM.

Typical flow:

1. Select **Plan** and describe the desired screen or flow.
2. Assistant inspects project evidence and writes a plan file.
3. Review or edit the plan card.
4. Refine it until approved.
5. Click **Generate from plan** to enter Design and implement it.
