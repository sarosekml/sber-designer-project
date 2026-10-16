---
updated: 2026-07-21T01:16:10+03:00
---

# Design session mode

Design is the default chat session mode and replaces the former `act` value. It
creates or edits concrete project artifacts with the full generation pipeline:
project instructions, style memory, component evidence, templates, write tools,
screen readiness checks and optional Design Jury.

For a plan handoff, Design treats the reviewed Markdown document as product
intent, then revalidates component evidence before writing. Planned roles never
freeze exact contracts, imports, props or variants. Today Design uses the current
retrieval pipeline; once the planned compact component map lands, it will perform
that selection from the full map without a count cap.

Design session mode is not the canvas **Design** tab. The session mode controls
agent intent, prompt weight and tool permissions. The canvas tab controls direct
visual editing of the selected screen.

Typical flow:

1. Select **Design**, or click **Generate from plan**.
2. Provide the target and constraints; optional direction picker, wireframe and
   Jury defaults still apply.
3. Assistant selects evidence, writes the target and validates it.
4. The transcript shows the effective session mode, run status and token usage.
