---
updated: 2026-06-11T09:02:48+03:00
---

# Code mode

## Назначение

Code mode дает быстрый source-oriented доступ к файлам активного screen и
выбранного DOM/source target. Это не замена IDE, а встроенный редактор для
контекстной правки.

Кодовые точки:

- `apps/web/src/components/editor/CodeView.tsx`;
- `apps/web/src/lib/api/files.ts` (барель: `lib/api-client.ts`);
- `services/api/src/routes/files.ts`;
- `services/api/src/routes/patch.ts`.

## Что открывает Code mode

Приоритет выбора файла:

1. source location выбранного элемента;
2. active screen `implementationFilePath`;
3. active screen `filePath` / Storybook wrapper;
4. active component source в Storybook view.

Для screen обычно доступны два target:

- `Implementation` - основной editable screen component;
- `Story wrapper` - CSF story, которая рендерит implementation.

## Monaco

CodeView использует Monaco editor:

- показывает текущий file content;
- отслеживает dirty state;
- сохраняет по кнопке или Cmd/Ctrl-S;
- может переключать implementation/story wrapper;
- показывает ошибки чтения/записи.

## Save

Сохранение идет через backend file route и safe filesystem checks. Backend не
должен писать за пределы workspace. После save canvas должен обновиться через
HMR/reload, если файл влияет на active screen.

## Diff

Code mode может показывать diff из patch-store:

- изменения агента;
- изменения Design mode;
- pending/generated patches.

Diff нужен, чтобы пользователь видел, что реально изменилось в source, а не
только результат в canvas.

## Связь с агентом

Когда агент меняет файлы через `write_file` или `apply_patch`, Code mode должен
уметь открыть измененный target. Agent run summary и tool receipts дают пути,
которые пользователь может проверить.

## Ограничения

- Code mode не должен становиться project-wide IDE.
- Нельзя silently сохранять файлы вне workspace.
- Не нужно делать форматирование/рефакторинг unrelated files при точечной
  правке.
- Если пользователь редактирует wrapper story, implementation source не должен
  меняться автоматически без явного действия.
