---
updated: 2026-07-07T00:17:09+03:00
---

# Storybook mode and catalog

## Назначение

Storybook mode - это canvas view для работы с компонентами и stories. Он
использует тот же editor shell, но объектом внимания становится component
catalog, а не active screen.

Кодовые точки:

- `apps/web/src/components/editor/ComponentsPanel.tsx`;
- `apps/web/src/components/editor/ContextPanel.tsx`;
- `apps/web/src/stores/editor-store.ts`;
- `packages/storybook-indexer`;
- `services/api/src/routes/catalog.ts`;
- `services/api/src/storybook-cache.ts`.

## Screen view vs Storybook view

В `CanvasArea` есть переключатель:

- `Screen` - active screen, Screens panel, screen context;
- `Storybook` - active component/story, Components panel, component context.

Storybook view не является отдельным editor mode. Interact/Design/Code mode
остаются, но context меняется.

## Catalog

Catalog строится из:

- Storybook `index.json`, если он доступен;
- static AST scan, если Storybook недоступен;
- HTML/CSS catalog, если project profile = `html-css`;
- design-index artifacts;
- component notes.

Frontend получает catalog через API и показывает components/stories.

## Component context

Когда активен Storybook view:

- ContextPanel показывает component details;
- Assistant получает component-mode prompt branch;
- screen-specific context не должен подмешиваться как основной target;
- active screen write scope не должен применяться к component task.

Это нужно, чтобы запрос "поправь компонент" не превратился в изменение текущего
screen.

## Storybook optional

Если Storybook не настроен:

- catalog может быть слабее;
- preview для stories может быть недоступен;
- Design System Browser покажет setup diagnostics;
- screen generation все равно может работать через static context and source
  conventions.

Продукт не должен блокировать основные функции только потому, что Storybook нет.

Для HTML-first проекта отсутствие Storybook ожидаемо. Компонентный контекст
берется из `html-css-catalog-manifest.json`, `components.css`, static pages и
`Design.md`; Storybook view при этом может быть пустым.

## Storybook readiness и cache

После создания/rename/move screen Storybook может иметь stale cache или еще не
видеть новую story. Backend умеет:

- ждать index readiness;
- инвалидировать cache;
- проверять source/story file на диске как fallback evidence;
- показывать preview unavailable вместо generic failure.

Для уже деградировавшей живой HMR-сессии нужен осторожный restart flow, чтобы не
убивать dev-server пользователя без проверки.

## Component authoring

Для reusable component work есть отдельные agent skills and prompts. Агент
должен:

- смотреть component catalog and source;
- не переписывать screens;
- добавлять/править stories when relevant;
- учитывать design-index notes and examples;
- держать изменения scoped to component task.
