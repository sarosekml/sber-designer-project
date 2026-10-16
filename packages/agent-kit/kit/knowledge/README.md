# Agent Knowledge

Knowledge files are project guidance that should be read on demand. Keep each
file focused and small enough to be useful in a single agent turn.

API-mode `ai-product-designer` sees knowledge as an inventory first and reads a
specific file only when a task needs it. Local CLI runtimes receive the same
knowledge inventory and paths in the external handoff, but they read files
directly with their own CLI capabilities.
