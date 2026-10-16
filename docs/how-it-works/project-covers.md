---
updated: 2026-07-24T23:16:16Z
---

# Project covers and generated thumbnails

## Назначение

Карточка проекта на Home и `/projects` может показывать снимок экрана,
полученный после успешной генерации. Это статическая обложка проекта, а не
живой iframe: неактивный проект не имеет запущенного sandbox, поэтому
sber-designer делает снимок, пока проект открыт, сохраняет один небольшой файл
в workspace и затем отдаёт его по project id.

Home/Projects shell, в котором отображаются карточки, описан в [System overview](./system-overview.md#home-и-project-cover).

## Приоритет изображения

Фактический порядок такой:

```text
явный thumbnailPath (встроенная картинка или upload)
  → generated cover, если Generative thumbnail включён и файл существует
  → детерминированная встроенная заглушка Preview 01–05
```

Явный `thumbnailPath` показывается сразу, но он **временный**: успешная запись
новой обложки очищает его, поэтому после ближайшей генерации карточка снова
показывает скриншот. Насовсем отключить генерацию можно только свитчером
**Generative thumbnail** в Settings › General. Вернуть скриншот раньше можно
вручную — выбрать карточку **Generated preview** в диалоге Change thumbnail
(отдельной кнопки «Reset to auto» нет). Если cover ещё не создан, повреждён или
API возвращает 404, карточка оставляет стоковую основу и не показывает broken
image.

Диалог Change thumbnail держит хедер и кнопку загрузки зафиксированными, а
список вариантов скроллит, поэтому не выходит за пределы экрана.

Встроенные Preview 01–05 имеют dark/light варианты. Generated и загруженные
изображения не перекрашиваются при смене темы.

## Когда обновляется cover

Источник автоматического cover — target screen только что завершившегося
успешного run, а не первый экран проекта и не текущий визуально открытый iframe.

```text
successful SSE done / successful one-shot response
  → target screen id из binding
  → offscreen preview iframe
  → snapshot bridge (Annotate-слой)
  → 640×360 WebP
  → PUT /api/projects/:id/cover
```

Failed, cancelled, truncated и не привязанные к screen runs не обновляют
обложку. Capture является best-effort post-run side effect: ошибка снимка не
меняет статус agent run и сохраняет предыдущую обложку.

Очередь выполняет один capture за раз и схлопывает burst до самого нового
pending-запроса. Поэтому быстрые последовательные генерации не теряют последний
результат, но и не создают очередь устаревших снимков.

Streaming и поддерживаемый non-streaming `POST /api/chat` используют один
lifecycle. Запуск server-side Chrome и
`SBER_DESIGNER_CHROME_DEBUGGING_URL` для project cover не требуются.

## Set as thumbnail

Контекстное меню screen содержит checkbox **Set as thumbnail**:

- включение сохраняет `coverScreenId` в project registry и сразу снимает этот
  screen;
- пока pin активен, генерации других screens не меняют cover;
- повторная генерация закреплённого screen обновляет его изображение;
- выключение checkbox очищает pin и возвращает режим «последний
  сгенерированный screen»;
- удаление закреплённого screen снимает pin; project refresh и open также
  чинят orphan pin после внешней/agent правки.

Клиент повторно проверяет текущие `projectId`, `screenId` и pin перед upload.
Backend принимает source `screenId` и отвергает устаревший capture, если pin
успел измениться.

## Generative thumbnail

Switch находится в **Settings → General** и по умолчанию включён.

Выключенное состояние:

- не запускает capture;
- скрывает generated cover на Home/Projects и карточку **Generated preview**
  в диалоге Change thumbnail;
- **убирает** пункт **Set as thumbnail** из меню экрана (не «делает неактивным» —
  пункта просто нет);
- сохраняет существующий cover-файл и pin, поэтому включение возвращает
  прежнее состояние;
- не скрывает явно загруженный или выбранный `thumbnailPath` — и он перестаёт
  быть временным, потому что новых обложек больше не пишется.

Это **единственное** место, где фича включается и выключается: выбор заглушки в
диалоге её не отключает.

Это identity-scoped user preference, а не правило connected project. Значение
следует за профилем между браузерами/сессиями и хранится вне project:

```text
~/.sber-designer/users/<identity>/settings.json
  generativeThumbnailEnabled: boolean
```

Local-профиль использует тот же user-settings слой с identity key `local`.
`GET /api/config` загружает значение, а
`PUT /api/config/generative-thumbnail` сохраняет его. Другой участник проекта
управляет своим capture/display независимо; сам cover-файл остаётся
project-owned и reviewable в git.

## Хранение и git

Generated cover принадлежит connected project:

```text
<workspace>/.sber-designer/
  .gitignore
  previews/
    cover.webp              generated project cover, коммитится
    cover.png               допустимый fallback; одновременно хранится один формат
    screens/                тяжёлые Flow captures, не коммитятся
```

Обычный capture создаёт 640×360 WebP с quality `0.72`; PNG используется только
как fallback, если браузер не может кодировать WebP. Backend ограничивает
чтение и запись одним мегабайтом и проверяет magic bytes, а не доверяет одному
MIME из data URL.

Вложенный `.sber-designer/.gitignore` содержит ровно правило для
`previews/screens/`. Legacy-правило `previews/` автоматически сужается, иначе
оно скрыло бы `cover.webp` от git. Корневой `.gitignore` подключённого проекта
не переписывается.

Pin хранится отдельно в per-user registry:

```text
ProjectEntry.coverScreenId
```

Поэтому сам cover переносится через git вместе с проектом, а выбор
закреплённого screen остаётся настройкой записи Home конкретного пользователя.
Удаление проекта из списка Home не удаляет workspace и его cover.

## API и cache

| Endpoint                                          | Поведение                                                      |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `GET /api/projects/:id/cover`                     | WebP/PNG из workspace; 404, если валидного cover нет           |
| `PUT /api/projects/:id/cover`                     | Записать cover с `screenId` source guard                       |
| `PUT /api/projects/:id/cover-screen`              | Pin/unpin `coverScreenId`                                      |
| `PUT /api/projects/:id/thumbnail { reset: true }` | Удалить явный `thumbnailPath` и вернуться к automatic priority |
| `PUT /api/config/generative-thumbnail`            | Сохранить per-user capture/display preference                  |

Успешный `PUT /cover` сам вызывает этот reset — поэтому выбранная заглушка
живёт только до ближайшей генерации.

Cover-write, reset, manual thumbnail и pin проходят через одну
identity-registry mutation queue. Поэтому более поздний manual pick/pin не
теряется из-за stale read-modify-write `projects.json`; ошибка reset не
маскируется успешным HTTP-ответом. Registry и новые thumbnail-файлы заменяются
atomic rename, а старый upload чистится только после успешной записи registry.

**Доступ из `<img>`.** Обычный тег не умеет отправлять ни local-заголовок
`x-sber-designer-user`, ни OIDC bearer. Поэтому карточка и диалог сначала
получают `cover`/`thumbnail` авторизованным fetch общего API-клиента, создают
короткоживущий object URL и передают его `<img>`. Local header, password cookie
и OIDC bearer работают одинаково; GET/HEAD artwork остаются под auth во всех
режимах, object URL отзывается при смене карточки/unmount.

GET не запускает sandbox и не читает `.sdproj` каждого проекта. Он использует
identity-scoped registry lookup, canonical workspace path и content SHA-256
ETag. Ответы имеют `private, no-cache, must-revalidate` и `nosniff`; повторный
запрос может получить 304.

Storage guard запрещает path traversal и symlink escape как для директории
`previews`, так и для самого cover-файла. Запись выполняется через временный
файл и atomic rename, поэтому Home не читает частично записанное изображение.

## Карта кода

| Область                  | Файл                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| Capture/resize/queue     | `apps/web/src/lib/project-cover-capture.ts`                        |
| Run lifecycle            | `apps/web/src/hooks/use-chat-stream.ts`                            |
| Screen pin UI            | `apps/web/src/components/editor/screens/ScreenRow.tsx`             |
| Screen pin orchestration | `apps/web/src/components/editor/ScreensPanel.tsx`                  |
| Card layering            | `apps/web/src/components/home/ProjectCard.tsx`                     |
| Auth-aware artwork       | `apps/web/src/hooks/use-project-artwork-src.ts`                    |
| Placeholder resolution   | `apps/web/src/components/home/project-thumbnails.ts`               |
| General preference       | `services/api/src/user-storage.ts`, `routes/config.ts`             |
| Preference web client    | `apps/web/src/lib/api/http.ts`, `stores/theme-store.ts`            |
| API client               | `apps/web/src/lib/api/project.ts`                                  |
| Cover storage/guards     | `services/api/src/project-cover-store.ts`                          |
| Registry and pin         | `services/api/src/projects-registry.ts`                            |
| HTTP routes              | `services/api/src/routes/projects.ts`                              |
| Focused tests            | `services/api/src/projects-cover.test.ts`, web cover/capture tests |

## Acceptance boundary

Автоматически покрыты queue coalescing, продолжение после ошибки, storage,
gitignore migration, format replacement, MIME/size/path guards, pin/source
guard, orphan repair, reset, ETag/304 и identity scope.

Release smoke должен вручную подтвердить полный браузерный цикл:

1. новый проект показывает stock placeholder;
2. первая и вторая генерации последовательно обновляют cover;
3. pin делает выбранный screen источником и переживает чужие runs;
4. unpin возвращает automatic mode;
5. switch скрывает/возвращает generated cover и убирает `Set as thumbnail`
   из меню экрана; новое значение переживает reload профиля;
6. выбранная заглушка держится до следующей генерации, а карточка
   **Generated preview** в диалоге возвращает скриншот вручную;
7. `cover.webp` виден в git, `previews/screens/` игнорируется.
