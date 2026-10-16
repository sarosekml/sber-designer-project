---
name: storybook-screen-rename
description: Use ONLY when the user explicitly asks to rename a screen, its Storybook story/title, or its component — to rename safely across the screen display name, component export, story import/`component`/`meta.title`, `storyId`, and screen registration without breaking the render. Never load this to rename on your own initiative.
compatibility: sber-designer
sd:
  profile:
    - react-storybook
---

# Storybook Screen Rename

Renaming a sber-designer screen touches several independent identity surfaces.
Change one without the others and the screen stops rendering (the classic
failure is a story whose `component` no longer resolves: _"Unable to render
story … as the component annotation is missing from the default export"_).
This skill is the safe procedure.

## Load first

Call `read_agent_knowledge` for these ids when they are relevant before
following the runbook:

- `sber-designer-architecture`
- `design-mode-contract`

## When to use vs when to defer

Use this skill **only** when the user explicitly asks to rename — e.g. "rename
this screen to ClientInfoPage", "call the story X", "rename the component".

**Do NOT rename on your own initiative.** When you are filling, editing, or
repairing a screen, the existing name is the user's and must be preserved —
even when the generated content suggests a nicer label. If the user did not ask
to rename, do not touch the display name, the component export, `meta.title`,
the story export, the `storyId`, or the file names. There is no "tidy-up
rename"; an unrequested rename is a regression, not a courtesy.

## The screen identity model

A registered screen has up to six identity surfaces:

| #   | Surface                                             | Where it lives                                                              | Effect if changed                                                           |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | **Display name**                                    | `.sber-designer/project.sdproj` (via `screen_update` `name`)                | Cosmetic label in the Screens panel. Independent of code.                   |
| 2   | **Component export**                                | implementation file, e.g. `export function PaymentTest04()`                 | The story imports this by name. Rename without (3) → broken render.         |
| 3   | **Story `import` + `component` + `Meta<typeof …>`** | `*.stories.tsx`                                                             | Must reference the live export (2). `component: undefined` → render error.  |
| 4   | **`meta.title`**                                    | `*.stories.tsx` `title:`                                                    | Storybook sidebar path; **derives the `storyId`**.                          |
| 5   | **`storyId`**                                       | `.sber-designer/project.sdproj` (registered) AND derived from (4)+export id | sber-designer maps the screen by this. Mismatch → screen "not found"/blank. |
| 6   | **File names**                                      | `Foo.tsx`, `Foo.stories.tsx`                                                | Cosmetic on disk; breaks all imports/paths if changed alone.                |

Key relationships:

- `storyId = kebab(meta.title) + "--" + kebab(storyExportId)`. For
  `title: 'Screens/DeepseekV4Flash/Payment-test-04'` and export `Default`,
  `storyId = screens-deepseekv4flash-payment-test-04--default`.
- The story object's `name` property (e.g. `name: 'Payment-test-04'`) is a
  **human label only** — it does **not** change the `storyId`.
- The display name (1) is fully independent of (2)–(6).

## Decide the rename mode first

Most "rename" requests mean only the **label**. Confirm scope before editing.

### Mode A — Display name only (default, safest)

The user wants a nicer label in the Screens panel; the code identity should
stay. **Change only surface 1.**

1. `screen_update({ screenId, name: "<New Name>" })`.
2. Do **not** touch the component export, story file, `meta.title`, `storyId`,
   or file names.
3. Done — no render risk, `storyId` unchanged, sber-designer still maps it.

Prefer Mode A unless the user clearly wants the code/story renamed too.

### Mode B — Full identity rename (only when asked to rename code/story)

The user wants the component and/or story actually renamed. Change the surfaces
**together, in one pass**, then re-register and verify.

1. **Component export (2).** Rename `export function OldName` → `NewName` in the
   implementation file. Update any self-references.
2. **Story binding (3).** In the `*.stories.tsx`, update the `import { OldName }`
   → `NewName`, `component: NewName`, and `Meta<typeof NewName>`. The
   `component` symbol must resolve to the live export.
3. **`meta.title` (4) — only if the user wants the Storybook path to change.**
   If you change it, you change the `storyId`; if you keep it, the `storyId`
   stays stable (often what you want, to avoid re-registration).
4. **`storyId` registration (5).** If (4) changed, recompute
   `storyId = kebab(meta.title) + "--" + kebab(exportId)` and update the
   registration with `screen_update({ screenId, storyId })`. If (4) did not
   change, leave `storyId` as-is.
5. **Display name (1).** Update with `screen_update({ name })` if the user wants
   the panel label to match.
6. **File names (6).** Rename files only if explicitly requested; then fix every
   import/path that referenced them. Usually skip — keep files stable.

Minimal, low-risk full rename = steps 1, 2, 5 (rename code + label, keep
`meta.title`/`storyId`/files stable).

## Invariants to hold after any rename

- The story's `component` symbol resolves to a real export of the
  implementation file (no dangling import).
- The registered `storyId` equals the `storyId` derived from the current
  `meta.title` + story export id.
- Exactly one component export is wired into `component`.
- No file path/import points at an old filename.

## Verify

1. `validate_design_screen` on the story + implementation files.
2. Let the product runtime run canvas render verification. If it reports a
   missing-component / module / import / Storybook error, the rename is
   inconsistent — fix the smallest broken surface before claiming completion.
3. Confirm in the Screens panel that the screen still resolves under its
   (possibly new) `storyId`.

## Anti-patterns (these are the bugs this skill prevents)

- Renaming the component export but leaving the story importing the old name →
  `component: undefined` → render error. **Most common; never do this.**
- Changing `meta.title` without re-registering `storyId` → sber-designer can no
  longer find the screen.
- Renaming files without updating imports → module-not-found.
- Renaming the display name and assuming the code/story changed too — they did
  not; the screen is now mislabelled relative to its files (acceptable only if
  the user asked for a label change).
- Renaming at all when the user did not ask. Don't.

## Output contract

- State which rename mode you used (A or B) and why.
- List every surface you changed (display name, export, story, `meta.title`,
  `storyId`, files) and every one you deliberately left unchanged.
- Name the validation and render verification performed.
