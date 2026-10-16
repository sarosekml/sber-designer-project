---
id: ADR-0011
title: Storybook component indexer
status: Accepted
date: 2026-05-08
scope: component catalog ingestion
---

# ADR-0011: storybook-indexer — каталог компонентов из работающего Storybook

- **Дата:** 2026-05-08
- **Статус:** Accepted
- **Контекст:** Phase 1 step 3.

## Контекст

Components panel в редакторе и `proj-mcp.catalog_list_components` пока
показывают placeholder-список. Чтобы агент мог осознанно собирать
страницы из существующих компонентов, нужен реальный каталог.

Изучили формат Storybook 8:

- ([docs/api/main-config/main-config-indexers](https://storybook.js.org/docs/api/main-config/main-config-indexers))
  Каждый running Storybook dev-server отдаёт **`/index.json`** в корне.
  Структура:
  ```jsonc
  {
    "v": 5,
    "entries": {
      "atoms-button--primary": {
        "type": "story", // 'story' | 'docs'
        "id": "atoms-button--primary",
        "title": "Atoms/Button",
        "name": "Primary",
        "importPath": "./src/Button.stories.tsx",
        "tags": ["story", "autodocs"],
      },
      // ...
    },
  }
  ```
- ([docs/api/csf](https://storybook.js.org/docs/api/csf))
  `meta.component` — обязательное поле default export. Имя группы
  (`title`) если не задано, авто-генерируется из пути.

## Решение

Новый пакет **`@sber-designer/storybook-indexer`** с двумя стратегиями:

1. **`indexFromStorybook(previewUrl)`** (Phase 1.3 — реализуем сейчас).
   Просто `fetch '<previewUrl>/index.json'`, парсит entries, группирует
   stories по `title` → компонент. Cheap, точно, не требует AST.
2. **`indexFromStaticAst(workspacePath)`** (Phase 1.5+, отдельная
   итерация). Когда у репо нет Storybook — статический скан
   default-exported React компонентов через ts-morph. Не делается
   сейчас, чтобы не блокировать эту итерацию.

### Каталог shape (publishable type в `shared-types`)

```ts
interface ComponentCatalog {
  source: 'storybook' | 'static';
  generatedAt: number;
  components: ComponentEntry[];
}

interface ComponentEntry {
  /** Stable id used by the editor and by proj-mcp tools. */
  id: string;
  /** Storybook title or static-scan derived path. */
  title: string;
  /** Last segment of `title` — what to show as the chip label. */
  shortName: string;
  /** Workspace-relative path to the *.stories.tsx (storybook) or *.tsx (static). */
  filePath: string;
  /** Stories grouped under this component (storybook only — empty for static). */
  stories: StoryEntry[];
}

interface StoryEntry {
  id: string;
  name: string;
  /** URL to the iframe preview for this exact story (for thumbnails / previews). */
  previewUrl: string;
}
```

### Где живёт

- Реализация — `packages/storybook-indexer/`.
- Используется на сервере: **`services/api`** в новом
  `GET /api/catalog`. Эндпойнт смотрит на текущий `state.canvasUrl`
  (см. ADR-0010), вызывает `indexFromStorybook(canvasUrl)`, возвращает
  каталог.
- `proj-mcp.catalog_list_components` теперь идёт к api через тот же
  bridge, что и `editor_*` тулзы.
- `apps/web` показывает каталог в Components panel (новый
  `useCatalog()` hook).

### Кэширование

Cтр (1.3): фетчить index.json каждый запрос. Cheap (`<10 KB`,
local-network). Phase 1.4 — `If-Modified-Since` или ETag headers

- in-process LRU.

### Что НЕ делаем сейчас

- Скриншоты story (headless Chromium) — Phase 2 для Components panel.
- Прокси `<previewUrl>/iframe.html?id=...` через api — пока браузер
  ходит на Storybook iframe напрямую (как и canvas). Закроется с auth.
- Парс CSF args/argTypes — Phase 1.5, когда понадобятся для editor
  property panels.
- Static AST fallback — отдельный пакет/итерация.

## Последствия

- Components panel в Phase 1.3 показывает живой список из
  `examples/sample-storybook` (или любого подключённого репо).
- `proj-mcp.catalog_list_components` отдаёт реальные компоненты —
  external Claude Code знает что у проекта есть `Button`/`MetricCard`
  и может собирать страницы.
- Catalog shape опубликован в `@sber-designer/shared-types` — единый
  тип для всех потребителей.

## Ссылки

- [Storybook indexer config](https://storybook.js.org/docs/api/main-config/main-config-indexers)
- [Storybook CSF](https://storybook.js.org/docs/api/csf)
- ADR-0010 — почему через services/api.
