---
id: ADR-0012
title: Project-aware assistant context
status: Accepted
date: 2026-05-08
scope: assistant system context
refines:
  - ADR-0010
  - ADR-0011
---

# ADR-0012: System prompt с проектным контекстом

- **Дата:** 2026-05-08
- **Статус:** Accepted
- **Контекст:** Phase 1 step 4.

## Контекст

`/api/chat` уже работает (ADR-0009), но LLM не видит ни каталог, ни
selection, ни режим редактора. Без этого агент:

- придумывает компоненты, которых нет в DS проекта;
- предлагает «давайте создадим Button» когда `Atoms/Button` уже
  существует;
- не понимает, что значит «эту штуку на экране» когда пользователь
  выделил элемент в Design.

Бесплатно лежит готовый каталог из ADR-0011 и live state из ADR-0010 —
надо собрать их в system prompt и положить перед user-сообщением.

## Что делает Builder.io Fusion

Документация Fusion описывает понятие «design system intelligence» и
admin-restrict, но не публикует свой prompt template. Из публичных
интервью и поведения видно, что они вкладывают каталог компонентов
(индекс Storybook + design-system metadata) и текущее selection в
системный контекст. Делаем то же самое — это очевидное best practice
для design-aware агентов.

## Решение

Перед каждым `/api/chat` сервер собирает **system message** с тремя
блоками:

1. **Behavior** — общая инструкция «ты помощник в sber-designer,
   предпочитай существующие компоненты из каталога, не выдумывай новые».
2. **Editor state** — текущий mode, selection (`loc`, `tagName`),
   `workspacePath`, `canvasUrl`.
3. **Component catalog** — компактный список из `state.canvasUrl`,
   построенный через `indexFromStorybook`. Только то, что реально
   полезно: `shortName`, `title`, `filePath`, count stories.

Если `state.canvasUrl` пустой — блок каталога пропускается с пометкой
«no project connected». Если фетч каталога упал — пишем «catalog
unavailable: <reason>», чтобы агент знал что слепой и не выдумывал.

Если переданный пользователем `messages[]` уже содержит первый
`role: "system"` — наш prompt **подставляется до него**, а user/system
из запроса остаются как есть. Это сохраняет per-call overrides, не
ломая дефолт.

### Контроль на стороне UI

В апи добавляем флаг `attachContext: boolean` в `ChatRequest` (default
`true`). Браузер по умолчанию шлёт `true`. В Settings/чат-input можно
оставить опт-аут на потом — пока единый дефолт.

### Почему собираем prompt на сервере, а не на клиенте

- Клиент уже не видит секреты и не знает админ-restrict — логично что
  и контекст-сборка живёт там же.
- В Phase 1.5+ каталог можно кэшировать на стороне api, и prompt-builder
  переиспользует кэш.
- Внешний Claude Code не зовёт `/api/chat` (он идёт через MCP), но
  если **встроенный** агент использует тот же prompt-builder когда мы
  будем делать tools/function-calling — единая точка.

## Что мы НЕ делаем

- **Не вкладываем все stories целиком** — только agg по компонентам
  и счётчик stories. Полный stories-list — Phase 2 когда добавим
  retrieval-style контекст для длинных DS.
- **Не вкладываем исходники компонентов.** Это огромный токен-бюджет
  и устаревает быстро. Phase 2 — tool-calling: агент сам дёрнет
  `ast_read_file` когда нужен исходник.
- **Не делаем chunking / RAG** для каталогов >100 компонентов. PoC
  валидируется на `examples/sample-storybook` (2 компонента) и
  `ibp-ui-kit` (~200). Для 200 system prompt будет ~3-5K токенов —
  ещё помещается в context window любого современного провайдера.
  RAG появится в Phase 2 если будут DS на 1000+ компонентов.

## Последствия

- Каждый `/api/chat` делает (опционально) `indexFromStorybook` —
  ~1 RTT к sandbox dev-server'у. Phase 1.5 закрываем кэшем.
- Аудит-лог получает новое поле `contextSize` (сколько компонентов
  попало в prompt) — пригодится для пост-мортема плохих ответов.
- Ошибки фетча каталога **не валят** chat-запрос: prompt-builder
  деградирует gracefully и пишет агенту, что слепой.

## Ссылки

- ADR-0010 — state-store, откуда читается `canvasUrl`/selection/mode.
- ADR-0011 — каталог как источник.
