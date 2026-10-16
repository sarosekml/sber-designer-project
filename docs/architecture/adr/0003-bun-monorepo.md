---
id: ADR-0003
title: Bun workspaces monorepo
status: Accepted
date: 2026-05-07
scope: workspace and toolchain layout
---

# ADR-0003: Bun workspaces monorepo

- **Дата:** 2026-05-07
- **Статус:** Accepted

## Контекст

Нужен monorepo с TypeScript-пакетами, общим тулчейном, быстрой переустановкой
зависимостей и единым lockfile. Опции: pnpm, yarn berry, bun, npm-workspaces, nx, turborepo.

## Решение

**Bun workspaces + minimal monorepo runner (`bun run`/turborepo по необходимости).**

### Аргументация

- openpencil (наш донор кода) уже на Bun — миграции пакетов нулевые.
- Bun ставит зависимости в 5–10× быстрее npm/yarn — критично для CI и onboarding.
- Bun сам по себе является runtime для backend (`services/api` на Hono+Bun).
- Workspaces + `workspace:*` синтаксис — то же, что у pnpm.

### Структура

Схема ниже фиксирует исходную целевую декомпозицию. В 0137 пустые scaffolds
`apps/desktop`, `apps/cli`, `plugins/*`, `editor-engine` и `sandbox-client`
удалены до появления исполняемой реализации; решение использовать Bun
workspaces остаётся в силе.

```
sber-designer/
├── apps/
│   ├── web/              # React 19 + Vite editor
│   ├── desktop/          # Tauri v2 shell (Phase 4)
│   └── cli/              # `sd` CLI (Phase 2+)
├── packages/
│   ├── editor-engine/    # AST-first document model, selection, history
│   ├── ast-bridge/       # ts-morph wrappers
│   ├── storybook-indexer/
│   ├── sandbox-client/   # postMessage protocol with iframe sandbox
│   ├── llm-gateway/
│   ├── proj-mcp/         # MCP server (forked from openpencil pen-mcp)
│   └── shared-types/
├── services/
│   ├── api/              # Bun + Hono backend
│   └── sandbox/          # Docker-per-session controller
├── plugins/
│   ├── figma/
│   └── pixso/
└── docs/
```

### Tooling

- **Lint:** oxlint (быстрее eslint, openpencil-tested).
- **Format:** Prettier (универсальнее oxfmt для команд).
- **Test:** текущий автоматизированный baseline - `bun test`. Vitest и
  Playwright остаются возможными будущими специализациями, но они не являются
  установленным root/app test stack на локальном MVP.
- **Build:** Vite для приложений, tsup для пакетов, Tauri CLI для desktop.
- **Type-check:** `tsc --noEmit` per-package + root aggregate.
- **CI:** GitLab CI (внутренний) + GitHub Actions (публичная зеркальная репка) — обе цели.

### Versioning

- Все пакеты следуют единой версии (lock-step). Скрипт `bun run bump <ver>` синхронизирует.
- Pre-1.0 — допускается лом совместимости минорным релизом.

## Последствия

- Минимальный порог входа: `bun install && bun run dev`.
- Повторяемая локальная проверка MVP начинается с `bun run smoke:local-mvp`.
- В CI ставим Bun отдельным шагом (`oven-sh/setup-bun`, версия закреплена на
  1.2.13); sandbox-образ — `oven/bun:1.2-debian`. Текстовый `bun.lock`
  (lockfileVersion 1) читается только Bun ≥ 1.2, поэтому 1.1 больше не
  поддерживается (0136 R11).
- Node 20 остаётся как fallback для совместимости (Tauri-shell, некоторые Node-only утилиты).
