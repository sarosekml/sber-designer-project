---
updated: 2026-07-21T01:16:10+03:00
---

# Component retrieval lifecycle

## Зачем нужен этот документ

При генерации экрана агент не получает случайные «первые 12 компонентов» и не
видит весь тяжёлый API проекта сразу. Harness сначала строит полную компактную
карту, затем выбирает роли экрана, гидратирует только нужные контракты и после
записи проверяет фактическое использование. Этот документ объясняет различия
между артефактами и одинаковый lifecycle для API-agent и внешнего CLI runtime.

## Пять разных сущностей

| Сущность              | Что содержит                                                                                                                      | Зачем нужна                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Full component map    | Все indexed components: stable id, public name, purpose, roles, capabilities, keywords, compact variant axes и description status | Даёт агенту карту всего project DS без full props/snippets     |
| Screen structure plan | Regions, требуемые UI roles, data, actions, states, constraints и assumptions конкретного экрана                                  | Объясняет, какие component roles нужны задаче до первого write |
| Selection plan        | Выбранный component или явный DS gap для каждой роли; required roles и resolution trace                                           | Делает shortlist объяснимым; число selected не имеет count cap |
| Hydrated contracts    | Source-backed import, variants, critical props, snippets, required classes/markup и region batches только выбранных components    | Даёт точный API для реализации, сохраняя bounded prompt weight |
| Used components       | Component ids, реально найденные в записанном source, missing required roles и optional skipped candidates                        | Отделяет «был предложен» от «действительно использован»        |

`late retrieval` — не шестой постоянный слой. Это bounded изменение selection
plan во время того же run: агент ищет component для незакрытой роли, читает его
usage card, добавляет или заменяет selection, получает новый hydrated contract
и продолжает реализацию без нового user turn.

## Lifecycle до и после write

```text
project reindex
  -> component-selection-map.json (known)
  -> ScreenStructurePlan (needed roles)
  -> task-relevant component pack (selected + explicit gaps)
  -> source/type resolution (imports + variants + props)
  -> byte-bounded hydration batches
  -> API prompt или CLI handoff
  -> optional late retrieve/hydrate/reselect
  -> source write
  -> craft/component-role checks (used + missing + optional skipped)
  -> render, Design mode, Jury и final quality summary
```

Карта selection строится по всему project index. Ограничение prompt относится
к UTF-8 weight hydrated details, а не к числу известных или выбранных
components. Поэтому сложный structure plan может выбрать и использовать больше
12 компонентов. Если подходящего component нет, selection plan сохраняет gap
с ролью, regions и причиной вместо неявного generic fallback.

## Как выбираются варианты и imports

После selection resolver повторно читает только выбранные React sources/types:

- literal unions и Storybook argTypes задают допустимые variant values;
- non-optional поля `*Props` становятся critical required props;
- run intent и region context выбирают конкретное значение variant;
- реальное project usage используется только как evidence, если brief это не
  запрещает;
- public import проверяется по project usage/barrel; alias входит в component
  family;
- divergent authored description fields исключаются из authoritative facts.

Для HTML/CSS catalog тот же слой несёт required classes, modifiers и canonical
markup. Принцип общий: source/types выше устаревшей документации.

## API-agent и CLI runtime

Оба пути получают одинаковые `ScreenStructurePlan` и component pack. В API
они входят в system prompt и доступны через design-only tools. Для CLI stable
component map и task-specific pack входят в handoff; injected project MCP даёт
bounded `search_project_index`, `get_usage_card` и
`update_component_selection` для late retrieval.

Перед external finalization pack перечитывается из run artifact, поэтому late
selection не теряется. Mechanical checks и Design Jury работают уже с новой
версией selection. Компонентный DS gap допускает один bounded
`retrieve → hydrate → repair`; блокирующий craft-result — одну отдельную
automatic craft repair. Повторный blocker завершает run как `needs_review`.

## Run artifacts и receipts

В `.sber-designer/runs/<run-id>/` сохраняются:

- `screen-structure-plan.json` — regions/roles/data/actions/states;
- `component-pack.json` — map projection, selection, hydration, resolutions,
  gaps и late changes;
- `receipts/*task_relevant_component_pack*` — counts и selection evidence;
- `receipts/*component_selection_update*` — add/replace, role, regions, ids и
  оставшийся budget;
- `receipts/*validate_screen_craft*` — required/used/missing, optional skipped,
  category results и findings;
- `receipts/*quality_summary*` — repair outcome, remaining findings, skipped
  checks, Design mode/render proof и Jury revision.

Assistant показывает тот же путь в компактном виде:
`indexed · described · selected · hydrated`, затем раскрываемые причины,
regions, variants, gaps и late additions. `Workspace index: stale` и
`Component context: ready/weak/missing` — разные сигналы.

## Где это реализовано

- map/index: `packages/design-indexer/src/component-selection-map.ts`;
- structure: `services/api/src/screen-planning/screen-structure-plan.ts`;
- selection/resolution/hydration:
  `services/api/src/component-intelligence/`;
- late selection: `component-reselection.ts` и run-scoped MCP/API route;
- used/reuse checks: `services/api/src/screen-craft-reuse.ts`;
- receipts: `services/api/src/agent/run-record/evidence.ts` и `quality.ts`.

См. также [Agent quality harness](./agent-quality-harness.md),
[Indexing project](./indexing-project.md) и
[Run records and diagnostics](./run-records-and-diagnostics.md).
