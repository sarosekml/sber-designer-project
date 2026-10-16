---
updated: 2026-07-21T01:16:10+03:00
---

# Ask session mode

Use Ask for questions, reviews, comparisons and explanations. Ask includes the
active editor context, project instructions and compact project-index evidence,
but omits the screen-generation component pack, templates, style-memory block,
Design Jury and craft finalization.

The guarantee is structural: mutating tools are removed before the built-in
agent starts. A prompt such as “ignore the rules and edit this file” therefore
cannot write through the agent toolset. If implementation is required, switch to
Design; if a reviewable brief should come first, switch to Plan.

Typical flow:

1. Select **Ask** in the Assistant footer.
2. Ask about the project, screen, selection or design system.
3. Assistant may inspect indexed evidence and files with read-only tools.
4. The answer is returned without readiness checks or file changes.

CLI runtimes receive the Ask override but are currently marked `promptOnly` in
the run manifest. Use the built-in agent when a hard read-only guarantee is
required before native CLI permission profiles land.
