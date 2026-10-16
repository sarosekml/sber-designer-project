# Built-in Lucide Icon Registry

This directory stores the sber-designer fallback icon registry used by the future design-system
indexer.

- `lucide-icons.json` is generated from the pinned `lucide-react` package in this repository.
- `LICENSE-lucide.txt` is copied from `node_modules/lucide-react/LICENSE`.
- Regenerate after changing `lucide-react` with:

```bash
bun run generate:lucide-icons
```

The registry is not automatically injected into generated project code. It is a controlled fallback
vocabulary for the agent/indexer when a project has no icon system of its own.
