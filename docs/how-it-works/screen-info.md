---
updated: 2026-07-23T16:18:09+03:00
---

# Screen info

## Что показывает панель

Кнопка **Info** находится в верхней строке канваса слева от **Annotate** и
доступна только для активного экрана в режиме Screen. Она открывает правый
Sheet с метаданными экрана и историей связанных генераций:

- датой создания и последнего изменения;
- общим числом ранов, input/output/total tokens и стоимостью, когда её отдал
  провайдер;
- статусом, режимом Ask/Plan/Design, route, runtime, моделью и провайдером
  каждого рана;
- метаданными prompt attachments без содержимого и превью;
- путями к run directory, attempt log и debug log с копированием абсолютного
  пути.

Активный ран показывается отдельно как `Generation in progress`. После его
завершения query инвалидируется, и итоговая строка появляется без перезагрузки
страницы. Повторное открытие панели также обновляет данные.

## Источник данных

Screen info не создаёт отдельный контур телеметрии. Источник истины — run
records харнеса:

```text
<workspace>/.sber-designer/runs-dataset.jsonl
<workspace>/.sber-designer/runs/<run-id>/run-manifest.json
<workspace>/.sber-designer/project.sdproj
```

При завершении рана существующая dataset-строка получает компактные поля
`screen_ids`, `screen_attribution`, `session_mode`, `cost_usd`, `attachments`
и `logs`. Экран атрибутируется по объединению трёх сигналов: active screen,
`metadata.screenId` в tool receipt и совпадение `changedFiles` с путями экрана
из sdproj. Благодаря стабильному `screen.id` rename и move не рвут историю.

Usage берётся из итоговых metrics рана. Для CLI runtime отсутствующие основные
счётчики дополняются из `runtimeSession.cumulativeUsage`; неизвестные значения
остаются `null` и показываются как `—`. Design Jury уже входит в итоговые
metrics рана и повторно не суммируется.

Для старой dataset-строки с пустым usage API дополнительно читает metrics из
живого `run-manifest.json`. Если и manifest не содержит usage или уже удалён
reaper'ом, aggregate остаётся `—`, а не превращается в ложный ноль.

## Даты и ручные изменения

Новые экраны получают `createdAt` и `updatedAt` в project.sdproj. Ручные
правки через Design/Code, rename/move и завершившиеся атрибутированные раны
двигают `updatedAt`; ручная правка не создаёт фиктивный generation run.

Старые project.sdproj остаются валидными. Если записанной даты нет, API
вычисляет её из истории ранов и timestamps файла. В панели такая дата получает
метку `estimated`; вычисление не переписывает проектный файл.

## Retention и приватность

Reaper может удалить тяжёлую папку `.sber-designer/runs/<run-id>`, но
append-only dataset остаётся. Исторический ран и его totals поэтому остаются в
панели с меткой `pruned`; путь можно скопировать как историческую ссылку.

Панель показывает только метаданные вложений: имя, MIME type, размер и hash.
Она не читает и не рендерит содержимое prompt attachments или логов.

## Точки кода

- контракт: `packages/shared-types/src/screen-generation-info.ts`;
- атрибуция и dataset: `services/api/src/agent/run-record/{screen-attribution,dataset}.ts`;
- API: `services/api/src/routes/screen-info.ts`;
- query: `apps/web/src/hooks/useScreenGenerationInfo.ts`;
- UI: `apps/web/src/components/editor/screen-info/ScreenInfoSheet.tsx`.
