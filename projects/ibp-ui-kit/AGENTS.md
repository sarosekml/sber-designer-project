---
title: UI Kit - Agents Documentation
doc_type: reference
applies_to:
  - src/**
  - tools/**
  - build/**
use_when:
  - При доработке существующих компонентов
  - При добавлении новых компонентов
  - При исправлении багов в библиотеке
  - При подготовке релиза
change_policy: manual
source_of_truth:
  - src/index.ts
  - package.json
  - rollup.config.mjs
---

# UI Kit (@sber-ibp/uikit)

## Тип проекта

UI-библиотека — набор React-компонентов для сборки интерфейсов в едином стиле. Публикуется в корпоративный npm registry.

## Структура src/

```
src/
├── components/           # React-компоненты по атомарному дизайну
│   ├── atoms/            # Базовые элементы (Button, Icon, Link, Tooltip, Skeleton и др.)
│   ├── molecules/        # Композиции (UserProfile, Alerts, Cards)
│   └── organisms/        # Сложные блоки (Tables, Forms, Dashboard, Navigation, Filters*)
├── utils/                # Утилиты и хелперы
│   └── schemas/          # JSON Schema для валидации (Zod-совместимые)
├── styles/               # Тема и стили (MUI-based)
│   ├── colors/           # Цветовые палитры
│   └── theme/            # Тема MUI (typography, palette, breakpoints)
├── types/                # Общие TypeScript-типы
├── assets/               # Статические изображения (иллюстрации ошибок)
├── documentation/        # Документация для Storybook (Colors, Typography)
└── index.ts              # Главный экспорт библиотеки
```

## Точки входа

- `src/index.ts` — главный экспорт, переэкспортирует всё из `components`, `utils`, `styles`, `types`
- `build/index.js` — результат сборки (публикуется в npm)
- `src/components/index.ts` — экспорт всех компонентов

## Публичный API

Основные категории экспортов:

```typescript
// Стили и тема
export * from './styles';

// Компоненты
export * from './components';
// → atoms: Button, Icon, Link, IconButton, Skeleton, Tooltip, Tab, ProgressBar, Paper, Page, TextMultiRow, Splitter, SegmentControl, Divider, BadgeCounter, DictionaryBadge, RiskMetricsBadge
// → molecules: UserProfile, ...
// → organisms: Tables (Table, TemplatedTable, CacheableTable), Forms (FormConstructor), Filters (FiltersChips, FiltersModal), Dashboard, HierarchicalTree, Navigation, ModalTemplate, ErrorFallback, ModuleNotAvailablePage

// Утилиты
export * from './utils';
// → getDataTestId, trimTextLength, mergeSx, cssImportant, Theme, SxProps, gridSizes, doNothing, useFirstExistingValue

// Типы
export * from './types';
```

## Команды

```bash
npm run build          # Production сборка (Rollup, вывод в build/)
npm run build-dev     # Development сборка
npm run start         # Watch mode с пересборкой
npm run storybook     # Запуск Storybook на порту 6006
npm run build-storybook # Сборка статической документации
npm run test          # Запуск Jest-тестов
npm run lint          # ESLint проверка
npm run lint-and-fix  # Автоисправление ESLint
npm run icons-generate # Генерация React-компонентов из SVG (интерактивный режим)
npm run release       # Релиз через standard-version (major/minor/patch)
npm run release-fix   # Релиз с пререлизом fix (например, 1.0.1-fix.0)
```

## Интеграции

- **@sber-ibp/core** — предоставляет конфигурацию Rollup, используется как база для сборки
- **Material UI (@mui/)** — основа компонентов и стилей
- **DevExpress Grid (@devexpress/dx-*)** — таблицы
- **Chart.js** — графики
- **react-hook-form** — управление формами
- **date-fns** — работа с датами

## Ключевые соглашения проекта

### Организация компонентов

Каждый компонент располагается в отдельной папке и содержит:
- `ComponentName.tsx` — основной код
- `ComponentName.types.ts` — TypeScript-интерфейсы
- `ComponentName.styles.ts` — стили (MUI/emotion)
- `ComponentName.stories.tsx` — Storybook stories
- `index.ts` — именованный экспорт
- `ComponentName.test.ts` — юнит-тесты (располагаются рядом с файлом)

### Тестирование

- Тесты пишутся в формате Jest
- Располагаются рядом с тестируемым файлом: `*.test.ts`
- Конфигурация: `tsconfig.jest.json`

### Генерация иконок

Инструмент `tools/icon-converter/` преобразует SVG-файлы в React-компоненты:
- Запускается через `npm run icons-generate`
- Предлагает выбор режима: `rewrite-all` (все иконки) или `update-missing` (только новые)
- Результат: компоненты в `src/components/atoms/Icon/icons/`

### Версионирование

- Используется **standard-version** с Conventional Commits
- Типы коммитов: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Commitlint проверяет сообщения коммитов (конфиг в `.commitlintrc.js`)
- Релиз создаёт changelog автоматически

### Сборка библиотеки

- Rollup использует конфигурацию из `@sber-ibp/core`
- Результат сборки попадает в директорию `build/`
- Файлы `build/` публикуются в npm (см. поле `files` в package.json)
- Peer dependencies НЕ включаются в бандл (ожидаются от потребителя)

## Известные ограничения / важные нюансы

1. **Peer dependencies** — библиотека ожидает, что потребитель предоставит: `react`, `react-dom`, `@sber-ibp/core`, `date-fns`, `react-hook-form`, `react-error-boundary`

2. **Node.js версия** — требуется Node.js >=16 (указано в `engines`)

3. **Storybook** — документация компонентов ведётся через Storybook stories (`.stories.tsx` файлы)

4. **Именование файлов** — используется PascalCase для компонентов (`ComponentName.tsx`)

5. **Константы** — вынесены в отдельные файлы `*.const.ts` (например, `Link.const.ts`)

6. **Типы для таблиц** — сложные, находятся в `TemplatedTable.types.ts`, `CacheableTable.types.ts`

7. **Утилиты фильтров** — находятся в `src/components/organisms/Tables/utils/`, включают хуки для управления состоянием таблиц

8. **Цветовые схемы** — определены в `src/styles/colors/` как отдельные модули (blue, green, red и др.)

9. **Иконки** — генерируются автоматически, не редактируются вручную; добавляются через SVG в источники и прогоняются через `icons-generate`
