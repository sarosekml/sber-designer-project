---
updated: 2026-07-21T01:16:10+03:00
---

# Assistant panel and tasks

Режим выполнения выбирается отдельно для каждой chat session. Контракт Ask /
Plan / Design, отдельный Auto toggle и plan handoff описаны в
[Chat session modes](./chat-session-modes.md).

## Назначение

Assistant panel - пользовательский интерфейс для работы с `ai-product-designer`.
Он показывает диалог, tool events, runtime diagnostics, attachments and run
links. Агентная система ниже может быть API-mode или CLI-mode, но пользователь
видит один Assistant workflow.

Кодовые точки:

- `apps/web/src/hooks/useChat.ts`;
- `apps/web/src/components/editor/ToolCallBubble.tsx`;
- `apps/web/src/stores/editor-store.ts`;
- `apps/web/src/stores/project-store.ts`;
- `services/api/src/routes/chat-stream/` (router + built-in/external/render-health);
- `services/api/src/agent/run-record/` (manifest, receipts, evidence, handoff).

## Screen-scoped sessions

История Assistant хранится по screen:

```text
project.assistant.sessions[]
project.assistant.activeSessionByScreenId
```

При переключении active screen UI восстанавливает session именно этого screen.
Это важно: задача генерации/правки почти всегда относится к конкретному screen,
и история не должна смешиваться между screens.

## Current task

Кнопка New task создает новый активный task context для текущего screen. Старые
сообщения остаются видимыми в истории, но не отправляются модели целиком по
умолчанию.

Внутренний prompt policy:

- отправлять текущую задачу активного screen;
- добавлять короткий relevant tail/summary, если он нужен;
- не прикладывать все старые задачи без явной причины;
- последние user instructions всегда главнее сохраненного summary.

Старый видимый переключатель context mode не должен возвращаться без новой
spec, потому что он смешивал UX с внутренней prompt policy.

## Context strip

Assistant panel показывает компактные индикаторы:

- Components count/context;
- Selection context;
- Current task;
- active provider/runtime.

Полные пояснения доступны через tooltip/ARIA, чтобы панель не раздувалась
текстом.

## Sending a message

Frontend отправляет:

- user text;
- active screen;
- selected element;
- canvas/story context;
- active model/runtime;
- attachments;
- assistant task/session metadata.

Перед стартом backend делает preflight:

- config/provider/runtime;
- model capabilities;
- attachment compatibility;
- run concurrency;
- allowed target scope.

## Stream events

SSE stream может содержать:

- run-started;
- external-runtime-context;
- text;
- tool-call;
- permission;
- tool-result;
- usage;
- done;
- error;
- run-rejected.

UI должен показывать полезную диагностику, но не заставлять пользователя читать
сырой JSON.

## Transcript persistence

После incident reports 07-08.06 главное правило:

```text
видимая история сохраняется независимо от финального статуса run
```

На `done` backend transcript authoritative. Frontend также checkpoint'ит важные
stream events, чтобы reload/SSE-drop не оставил только user prompt.

Внутренние auto-nudge сообщения не показываются как user history.

## Attachments

Assistant panel может прикладывать:

- markdown/text specs;
- images;
- SVG;
- HTML reference files.

Compatibility проверяется до запуска. Если выбран text-only API model и задача
требует raster image, run должен быть rejected before agent start с понятной
причиной.

## Run status cards

UI должен различать:

- request rejected before agent start;
- runtime config invalid;
- source written, validation unfinished;
- no target changes after CLI actually started;
- render health failed;
- preview unavailable;
- complete.

Generic red card без точной причины считается плохой диагностикой.

## Continue run

Continue run использует `continuation-context.json`. Он должен начинать с
текущего факта:

- какие файлы уже изменены;
- какие checks прошли;
- какие checks не успели;
- что нужно исправить дальше.

Он не должен заставлять агента заново читать весь проект, если предыдущий run
уже записал active screen.
