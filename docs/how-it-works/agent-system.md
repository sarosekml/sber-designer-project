---
updated: 2026-07-24T16:13:51+0300
---

# Agent system

Before a run starts, the chat session mode selects its prompt/tool profile:
Ask is read-only, Plan writes only a reviewable Markdown plan, and Design uses
the full generation/finalization pipeline. See
[Chat session modes](./chat-session-modes.md).

## Коротко

Агентная система sber-designer состоит из:

- default product agent kit `packages/agent-kit/kit`;
- optional personal kit `~/.sber-designer/agents`;
- optional connected-project kit `<workspace>/.agents`;
- API-agent tool loop;
- external CLI runtime handoff;
- permission model;
- run recorder and diagnostics.

Главный агент по умолчанию:

```text
ai-product-designer
```

## Где что лежит (ADR-0020)

Четыре кита, три из них читает рантайм продукта:

| Путь                       | Что там лежит                                       | Кто читает                                      |
| -------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `packages/agent-kit/kit/`  | дефолтный **продуктовый** кит `ai-product-designer` | рантайм продукта                                |
| `~/.sber-designer/agents/` | персональный кит пользователя                       | рантайм продукта                                |
| `<workspace>/.agents/`     | кит **подключённого проекта**                       | рантайм продукта + внешние агенты в том проекте |
| `.agents/` (корень репо)   | кит **агентов-разработчиков** sber-designer         | Claude Code, opencode, Codex CLI, Cursor        |

Дефолтный продуктовый кит — данные продукта, которые загружаются внутренним
агентом редактора; он не является инструкциями для агентов, разрабатывающих
сам sber-designer. Корень кита резолвится в одном месте —
`resolveDefaultKitRoot()` из `@sber-designer/agent-kit` (env-override
`SBER_DESIGNER_AGENT_KIT_DIR` для упаковки и remote-режимов).

Структура каждого кита одинаковая:

```text
config.json
agents/
instructions/
skills/
knowledge/
scripts/
screen-templates/   # только в продуктовом ките
```

Перемещение продуктового кита в пакет:

| Было                          | Стало                                        |
| ----------------------------- | -------------------------------------------- |
| `.agents/` (продуктовый кит)  | `packages/agent-kit/kit/`                    |
| `.agents/skills/**`           | `packages/agent-kit/kit/skills/**`           |
| `.agents/knowledge/craft/**`  | `packages/agent-kit/kit/knowledge/craft/**`  |
| `.agents/screen-templates/**` | `packages/agent-kit/kit/screen-templates/**` |
| `.agents/` (новое значение)   | кит агентов-разработчиков                    |
| `<workspace>/.agents/`        | без изменений                                |

## Merge order

Agent kit собирается в порядке:

```text
product default -> personal -> workspace
```

Поздний слой переопределяет ранний по id/name. Так проект может заменить skill
или добавить knowledge, не меняя код sber-designer.

## Agents

Default kit содержит специализированные роли:

- `ai-product-designer` - основной agent;
- `ai-screen-architect`;
- `ai-description-layer`;
- `ai-component-author`;
- `ai-design-system-scout`;
- `ai-git-deliverer`;
- `ai-project-indexer`.

Subagent не обязан становиться отдельным runtime. В API mode он может быть
фокусом prompt/tool logic, а в CLI mode он добавляется как focus lens внутри
handoff роли `ai-product-designer`.

## Skills, knowledge and scripts

Skills - папки с `SKILL.md`, которые агент может загрузить или получить как
inventory:

- screen generation;
- design-system context;
- design-mode compatibility;
- Storybook component work;
- component description interview;
- HTML component work;
- prototype wiring;
- visual design editing;
- git PR workflow;
- Pixso simple MCP;
- project indexing.

Knowledge - справочные markdown files. Scripts - безопасные manifests
`.agent-script.json` с command/args, без shell string tricks.

### Внешняя совместимость agent-kit (инвариант)

Оба кита — продуктовый в пакете и корневой `.agents/` — намеренно совместимы
с внешними агентными приложениями и не должны от них дрейфовать. Это опора
CLI-handoff (внешний CLI сам читает `SKILL.md`) и условие переносимости кита
между инструментами; правило 12 `AGENTS.md` ссылается на этот раздел как на
канон. Факты ниже проверены по официальной документации Claude Code и opencode
(<https://code.claude.com/docs/en/skills>, <https://opencode.ai/docs/agents/>,
<https://opencode.ai/docs/skills/>) и актуальны на 2026-07-02.

**Форматы, которые мы обязаны соблюдать:**

- **Skills — открытый стандарт [Agent Skills](https://agentskills.io)**
  (`SKILL.md`), которому следует Claude Code и который читает opencode. Ядро
  frontmatter: `name` (= имя каталога, 1–64 символа, `[a-z0-9-]`),
  `description` (обязателен в opencode; в Claude Code — recommended, листинг
  обрезает `description` + `when_to_use` на 1536 символах). Опциональные:
  `license`, `compatibility`, `metadata` (map строка→строка — штатная точка
  расширения стандарта). Наши skills используют
  `name`/`description`/`compatibility`.
- **Layout `.agents/skills/<name>/SKILL.md` сам является внешним
  контрактом.** opencode нативно сканирует его в проекте и
  `~/.agents/skills/**` глобально, наряду с `.opencode/skills` и
  `.claude/skills`; Claude Code читает тот же формат. Каталоги не
  переименовывать.
- **Agent-определения — opencode-формат**: markdown с frontmatter, обязателен
  только `description`; `mode: primary|subagent|all`, `model`, `temperature`,
  `permission`, `top_p`, `steps`, `prompt`, `disable`, `hidden` —
  опциональны; неизвестные ключи opencode пробрасывает как model options.
  Наши `agents/*.md` (`name`/`description`/`mode`/`temperature`/`maxIterations`)
  совместимы, причём `maxIterations` — наш дополнительный ключ (аналог их
  `steps`) и остаётся опциональным.
- **`sber-designer.json` — opencode-style config.** Корневой `AGENTS.md` —
  общая конвенция инструкций для внешних coding-агентов.

**Правила поверх фактов:**

1. Расширения frontmatter — **только additive и ignorable**: предпочтительно
   через штатный `metadata`-map, для структурных нужд — один опциональный
   блок `sd:`. Скилл обязан полноценно работать в стороннем инструменте,
   который эти расширения игнорирует.
2. Обязательными могут быть только поля ядра стандарта; ни одно наше поле не
   может быть required для загрузки скилла или агента.
3. Ядро-поля не переименовываются и не меняют семантику; layout
   `.agents/{agents,skills,knowledge,...}` стабилен.
4. Guard — `tests/0107-agent-kit-compatibility-lint.test.ts`: он держит кит в
   рамках инварианта, и изменения форматов без зелёного теста не мержатся.
5. При обновлении внешней документации (новые поля или пути) сначала
   правится этот раздел, потом код.

Для экранных скиллов `sd.critique.policy` управляет Design Jury:
`required` всегда запускает ревью, `opt-in` запускает его только по явному
выбору рана, `opt-out` запускает по умолчанию и допускает явное выключение.
Если политика не указана, действует безопасный additive-дефолт `opt-in`.

## Permissions

Permission categories:

- read;
- edit;
- run_script;
- load_skill;
- send_pr;
- set_mode;
- wildcard.

Defaults: read/load_skill usually allowed, edits/scripts/PR ask by default.
Permission wait должен логироваться отдельно от runtime handler duration, чтобы
длинный human wait не выглядел как зависший tool.

## API provider mode

Поток:

1. Frontend отправляет user message, editor context, attachments.
2. Backend resolves `AgentModelTarget`.
3. Backend загружает merged agent kit.
4. `prompt-builder` собирает system prompt:
   - agent profile;
   - always-on instructions;
   - project instructions;
   - active screen/selection;
   - task context;
   - design index;
   - component pack;
   - attachments;
   - MCP/tool information.
5. `llm-gateway` вызывает provider.
6. `runAgentStream` обрабатывает text/tool calls.
7. `toolset` читает/пишет файлы, создает screens, валидирует design/source,
   пишет receipts.
8. Mechanical finalization проверяет diff/story/root/craft/render.
9. Для generation/redesign с включённой critique-политикой Design Jury
   последовательно выполняет пять read-only review-turns. Низкий composite
   запускает максимум одну revision через обычные tools/permissions, после неё
   mechanical finalization выполняется повторно. CLI использует resume той же
   runtime-сессии.
10. Run recorder сохраняет transcript, timeline, receipts and summary.

Полный пользовательский и технический путь нового quality harness, включая
Design Jury, token usage, dataset, feedback и project style memory, описан в
[Agent quality harness](./agent-quality-harness.md).

### Role-aware context gates

Не все роли получают один и тот же контекст. Для `ai-description-layer`
description-прогон собирает компактный профиль вместо screen-generation пакета:

- project profile и состояние индекса;
- очередь `list_undescribed_components`;
- mined draft через `get_usage_card`;
- активный компонент, если пользователь стартовал с component card;
- профильные правила записи: sidecar canonical, Storybook/HTML projections.

Screen-specific `component-pack`, screen templates и repair-контракты не
инлайнятся в этот режим. Для HTML-first та же роль получает CSS catalog contract:
вопросы про modifiers/base classes/canonical HTML и default target
`design-system`.

## API tools

Ключевые tools:

- `read_file`;
- `write_file`;
- `apply_patch`;
- screen tools;
- project index tools;
- design validation tools;
- asset import/materialization tools;
- flow tools;
- git/send_pr tools;
- MCP broker tools;
- agent kit tools.

При `edit-current-screen` действует scope guard: агент может менять только
allowed target files активного screen. Это защищает проект от unrelated edits,
но требует явных tools для screen rename/update metadata.

Для assets у агента есть два разных edit-пути:

- `import_asset_pack` - копирует выбранный workspace-local pack в `src/assets/*`;
- `materialize_indexed_icon` - копирует один `external-icon-reference` в
  `src/sber-designer-assets/*` и обновляет индекс.

`get_indexed_icon` / `search_project_index` могут вернуть external reference,
но такой record нельзя импортировать напрямую из внешней папки.

## CLI runtime mode

CLI runtime path:

1. Backend создает run and target snapshots.
2. Backend сохраняет prompt attachments.
3. `agent-kit-handoff` строит adapted prompt:
   - role delegation: acting as `ai-product-designer`;
   - product/project instructions;
   - skill/knowledge inventory with paths;
   - active screen and selected element;
   - allowed target files;
   - project index overview;
   - attachment references;
   - output contract.
4. Backend запускает CLI в workspace.
5. CLI сам читает и пишет файлы.
6. Backend парсит stream/events.
7. После exit backend проверяет target diff, render health and receipts.

CLI не получает internal tool schemas, skill bodies inline or product MCP tools
как executable API. Он получает contract and paths.

Поддерживаемые data-driven runtimes: Claude Code, Codex, OpenCode, Kimi и
GigaCode. У каждого свой spawn/event/session contract, но handoff,
allowed-target finalization и run artifacts общие. GigaCode-specific
stream-json, truthful model identity и capture/resume описаны в
[GigaCode CLI runtime](./gigacode-runtime.md).

### Role-aware CLI contracts

CLI handoff тоже разделяет роли. Если run запрошен для `ai-description-layer`,
handoff инлайнит тело description-роли и
`packages/agent-kit/kit/skills/component-description-interview/SKILL.md`, а не полный
screen-generation контракт. Если `proj-mcp` доступен, внешний агент использует
`list_undescribed_components`, `write_component_description`,
`get_component_description_source` и `request_project_reindex`. Если MCP/tools
нет, файловый fallback пишет только sidecar
`.sber-designer/components/<id>.md`; Storybook CSF и `design-system.html`
остаются tool-owned projections.

После external runtime exit финализатор смотрит changed files. Если изменены
`.sber-designer/components/*.md`, backend автоматически стартует project-index
background job и пишет receipt `project_index_reconcile`. Поэтому coverage
описаний обновляется без ручного Index project и без записи derived index files
самим CLI.

## Run artifacts

Каждый запуск сохраняется:

```text
.sber-designer/runs/<run-id>/
  run-manifest.json
  timeline.jsonl
  receipts/
  handoff.md
  feedback.json                 optional
  prompt-attachments/
  external-runtime/
  continuation-context.json
```

Статусы:

- running;
- complete;
- failed;
- needs_review;
- cancelled.

Если source был записан, но финальная проверка не завершилась, предпочтителен
`needs_review`, а не generic failed. UI должен показывать source evidence.

`validate_screen_craft` дополнительно type-checks generated screen против
проектного `tsconfig` (findings `craft.type-error` / `craft.typecheck-unavailable`),
а при `needs_review`/`failed` финализатор добавляет authoritative run-status
banner в финальное сообщение, чтобы оптимистичный summary агента не вводил в
заблуждение. Детали - в `run-records-and-diagnostics.md`.

## Diagnostics after 9999 incidents

Зафиксированные правила:

- successful `write_file` active screen должен сразу trigger canvas reload;
- render health запускается и для partial write/truncated runs;
- transcript persists from authoritative backend transcript;
- Codex config invalid blocks before normal generation;
- no-target-changes является вторичной диагностикой после реального CLI start;
- Storybook unavailable with consistent source file is `preview unavailable`,
  not "agent did nothing";
- tool timing separates approval wait and handler runtime.

## Continue run

Continuation context должен говорить агенту:

- какие файлы уже изменились;
- какие checks не завершились;
- какие craft/render findings остались;
- не повторять долгую reconnaissance фазу, если source уже записан.

## Важные ограничения

- Агент не должен hardcode-ить знания конкретного проекта в product code.
- Агент не должен писать внешние абсолютные asset/icon paths в generated code;
  внешние indexed icons сначала materialize-ятся в проект.
- Attachments не расширяют allowed target scope.
- API-agent and CLI-agent share product role but not execution mechanics.
- Изменения продуктового кита (`packages/agent-kit/kit`) — это продуктовые
  данные, а не память внешнего coding agent; корневая `.agents/`, наоборот,
  является китом агентов-разработчиков и читается внешними агентами.
