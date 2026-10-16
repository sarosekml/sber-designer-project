# Architecture Decision Records

ADR фиксируют устойчивые архитектурные решения: контекст, рассмотренные
варианты, выбор и последствия. Текущее устройство системы описывается в
[`docs/how-it-works/`](../../how-it-works/README.md). Старый ADR не переписывается так, будто
история была другой: новое несовместимое решение получает следующий номер, а
предыдущее получает статус `Superseded` и ссылку `superseded-by`.

Допустимые статусы: `Proposed`, `Accepted`, `Superseded`, `Deprecated`.

| ADR                                                     | Решение                         | Статус   | Дата       | Текущая оценка                                                                                                       |
| ------------------------------------------------------- | ------------------------------- | -------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| [0001](0001-live-dom-canvas.md)                         | Live-DOM canvas                 | Accepted | 2026-05-07 | Действует: код проекта и live DOM остаются источником истины                                                         |
| [0002](0002-fork-openpencil.md)                         | Selective OpenPencil adoption   | Accepted | 2026-05-07 | Историческая основа; пустые package scaffolds удалены задачей 0137                                                   |
| [0003](0003-bun-monorepo.md)                            | Bun workspaces monorepo         | Accepted | 2026-05-07 | Действует; список активных пакетов смотрите в architecture overview                                                  |
| [0004](0004-three-modes.md)                             | Interact / Design / Code        | Accepted | 2026-05-07 | Действует, preview cache уточнён ADR-0018                                                                            |
| [0005](0005-llm-gateway.md)                             | LLM gateway                     | Accepted | 2026-05-08 | Граница действует; перечень провайдеров определяется кодом и конфигом                                                |
| [0006](0006-proj-mcp-and-claude-as-agent.md)            | Inbound and outbound MCP        | Accepted | 2026-05-08 | Направление действует; актуальный tool catalog находится в коде и integration docs                                   |
| [0007](0007-fiber-source-detection.md)                  | React Fiber source detection    | Accepted | 2026-05-08 | Действует вместе с fallback source markers                                                                           |
| [0008](0008-local-spawn-sandbox.md)                     | Local sandbox controller        | Accepted | 2026-05-08 | Local — default, Docker — experimental; границы усилены ADR-0019                                                     |
| [0009](0009-services-api-edge.md)                       | `services/api` backend edge     | Accepted | 2026-05-08 | Действует; текущее состояние хранится в файлах, не в PostgreSQL                                                      |
| [0010](0010-editor-mcp-bridge.md)                       | Editor / MCP bridge             | Accepted | 2026-05-08 | Действует; auth и project scope развиты последующими задачами                                                        |
| [0011](0011-storybook-indexer.md)                       | Component indexer               | Accepted | 2026-05-08 | Действует и расширен HTML/static-AST профилями                                                                       |
| [0012](0012-chat-with-project-context.md)               | Project-aware assistant context | Accepted | 2026-05-08 | Действует; точная сборка контекста находится в prompt modules                                                        |
| [0013](0013-ast-bridge-primitives.md)                   | Structured AST edits            | Accepted | 2026-05-08 | Действует; файловые границы усилены ADR-0019                                                                         |
| [0014](0014-tool-calling-and-agent-loop.md)             | Tool calling and agent loop     | Accepted | 2026-05-08 | Действует; streaming, run records и CLI handoff уже развиты дальше baseline                                          |
| [0015](0015-design-project-vs-component-source.md)      | Design project model            | Accepted | 2026-06-19 | Действует для standalone, HTML-first и подключаемых component sources                                                |
| [0016](0016-agent-runtime-adapters.md)                  | Hybrid runtime adapters         | Accepted | 2026-06-25 | Действует для API и локальных CLI runtimes                                                                           |
| [0017](0017-description-source-of-truth.md)             | Component descriptions          | Accepted | 2026-07-09 | Действует: sidecar является каноном, UI/HTML/Storybook — projections                                                 |
| [0018](0018-bounded-screen-preview-cache.md)            | Bounded preview cache           | Accepted | 2026-07-19 | Действует: один active target и ограниченный passive cache                                                           |
| [0019](0019-access-boundaries-and-project-integrity.md) | Access and integrity boundaries | Accepted | 2026-09-19 | Действует; принято после security/integrity review 0136                                                              |
| [0020](0020-default-agent-kit-location.md)              | Default agent kit location      | Accepted | 2026-09-20 | Действует (реализовано 0140 2026-09-21): продуктовый кит в `packages/agent-kit`, корневая `.agents` — кит разработки |

## Как менять решения

1. Для совместимого уточнения обновите `refines` и добавьте датированное
   примечание, не удаляя исходный контекст.
2. Для несовместимого решения создайте новый ADR и укажите на старом
   `status: Superseded` и `superseded-by`.
3. Не переносите в ADR длинные implementation checklists; актуальная карта
   модулей принадлежит how-it-works.
4. После изменения обновите таблицу выше и проверьте, что относительные
   ссылки ведут в существующие файлы.
