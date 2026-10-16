# sber-designer development agent kit

Это кит **агентов-разработчиков** sber-designer: навыки, роли и чеклисты для
тех, кто (человек или агент) разрабатывает сам sber-designer. Claude Code,
opencode, Codex CLI и Cursor обнаруживают его нативно.

Продуктовый кит встроенного `ai-product-designer` переехал в
`packages/agent-kit/kit/`
([ADR-0020](../docs/architecture/adr/0020-default-agent-kit-location.md)).
Если вы ищете продуктовые скиллы (`product-screen-generation`,
`screen-redesign`, craft-knowledge, screen-templates) — они там, и это
product data, а не инструкции по разработке.

## Path map

| Было                          | Стало                                        |
| ----------------------------- | -------------------------------------------- |
| `.agents/` (продуктовый кит)  | `packages/agent-kit/kit/`                    |
| `.agents/skills/**`           | `packages/agent-kit/kit/skills/**`           |
| `.agents/knowledge/craft/**`  | `packages/agent-kit/kit/knowledge/craft/**`  |
| `.agents/screen-templates/**` | `packages/agent-kit/kit/screen-templates/**` |
| `.agents/` (новое значение)   | кит агентов-разработчиков                    |
| `<workspace>/.agents/`        | без изменений (кит подключённого проекта)    |

## Status

Папка intentionally minimal: наполнение (roles: implementer / verifier /
spec-writer; development skills; review checklists) ещё не сделано. Формат — тот же открытый Agent Skills /
opencode-стиль, что и у продуктового кита; правило 12 `AGENTS.md` действует
для обоих.
