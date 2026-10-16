---
id: ADR-0002
title: Selective OpenPencil structure adoption
status: Accepted
date: 2026-05-07
scope: repository origin and adopted upstream boundaries
---

# ADR-0002: Fork openpencil — структура и выборочные пакеты

- **Дата:** 2026-05-07
- **Статус:** Accepted
- **Контекст:** Phase 0, выбор стартовой кодовой базы.

## Контекст

Нам нужен зрелый каркас для редактора: monorepo с Bun, MCP-сервер,
multi-provider LLM-runtime, Figma `.fig` импорт, опциональный Tauri-shell.
Реализовывать это с нуля — потеря 4–6 недель.

Кандидаты:

| Проект                                                                | Лицензия | Стек                             | Подход к canvas                     |
| --------------------------------------------------------------------- | -------- | -------------------------------- | ----------------------------------- |
| [ZSeven-W/openpencil](https://github.com/ZSeven-W/openpencil)         | MIT      | React 19 + Bun + Electron + Skia | Vector canvas + codegen             |
| [open-pencil/open-pencil](https://github.com/open-pencil/open-pencil) | MIT      | Vue 3 + Tauri v2 + Skia + Yoga   | Vector canvas + codegen, P2P collab |
| with-scratch                                                          | —        | —                                | —                                   |

## Решение

**Форкаем структуру `openpencil` (ZSeven-W). Берём избирательно — без
Skia/canvas пакетов.**

### Что берём

- Monorepo layout (`apps/web`, `apps/desktop`, `apps/cli`, `packages/*`) с Bun-workspaces.
- `pen-mcp` → переименовываем в `proj-mcp`. Серверный каркас, протокол подключения внешних агентов.
- `agent-native` (Zig NAPI multi-provider) → как **опциональный** локальный LLM-runtime для air-gapped инсталляций.
- `pen-figma` → оставляем для импорта `.fig` (Phase 3, design integrations).
- Конфиги Bun, oxlint, tsconfig.base, скрипты `bump`, `cli:dev`.
- Идею `op` CLI → у нас будет `sd` CLI (Phase 2+).

### Что НЕ берём

- `pen-engine` / `pen-core` / `pen-renderer` — это Skia-документ и canvas. Заменяем
  собственным `editor-engine` с моделью «AST + DOM overlay».
- `pen-react` (React UI SDK поверх их canvas). Наш UI — shadcn/ui поверх iframe.
- `pen-codegen` (vector → React). Не нужен: у нас холст уже React.

### Из open-pencil — заимствуем идеи без форка

- Tauri v2 как shell (Phase 4). Vue-стек open-pencil не интегрируется напрямую,
  поэтому копируем только конфиг Tauri и подход к bundling.
- 100+ MCP tools — как референс набора инструментов для нашего `proj-mcp`.
- Yjs+Trystero pattern (но **не P2P** — для on-prem делаем server-shard).

## Последствия

- License: openpencil MIT → в наших файлах храним атрибуцию в `THIRD_PARTY_NOTICES.md` (создадим в Phase 1, когда реально импортируем код).
- Мы НЕ становимся форком в смысле Git — копируем нужные пакеты, адаптируем,
  включаем в наш monorepo. Upstream не отслеживаем (расхождение слишком большое).
- Renames фиксированы: `pen-mcp → proj-mcp`, `pen-engine → editor-engine`
  (полностью переписан). Названия в импортах — `@sber-designer/proj-mcp` и т.д.

## Не идём

- WebContainer (StackBlitz) — закрытая лицензия, нельзя в on-prem.
- Полноценный fork open-pencil — Vue-стек противоречит React-стеку Sber-команд.
