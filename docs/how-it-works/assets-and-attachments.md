---
updated: 2026-07-07T00:17:09+03:00
---

# Assets and attachments

## Два asset workflow

sber-designer поддерживает два разных способа работать с иконками,
иллюстрациями и изображениями:

- **Asset packs** - полный import папки assets внутрь проекта.
- **Icon sources** - справочник для агента: индексировать папку с иконками без
  копирования всего pack.

Оба способа должны оставлять generated code переносимым. В source screen нельзя
импортировать `/Users/...` или другой внешний абсолютный путь.

## Asset packs

Settings -> Indexing project -> Asset packs показывает одно поле
**Path to assets**. Этот путь можно:

- сохранить и проиндексировать без копирования всего pack;
- импортировать в `src/assets/*`, если path находится внутри connected
  workspace.

Full import также доступен через tool/API `import_asset_pack`.

Разрешенные типы:

- `.svg`;
- `.png`;
- `.jpg`;
- `.jpeg`;
- `.webp`;
- `.avif`.

Для full import source folder должен быть внутри connected workspace. Если
пользователь выбрал папку вне проекта, кнопка import блокируется; такой path
можно только сохранить и индексировать как external references.

Backend копирует файлы в:

```text
src/assets/icons/
src/assets/illustrations/
src/assets/index.ts
src/stories/assets/*.stories.tsx       если есть .storybook
.sber-designer/assets/imported-packs.json
```

После этого assets становятся частью project context, а не ссылкой на внешнюю
папку пользователя.

## Icon sources

Icon source - внутренний термин indexer для сохраненного **Path to assets**.
Пользователь не задает отдельное имя source: UI выводит его из basename папки.
Настройка сохраняется в:

```text
.sber-designer/project.sdproj
  externalAssetSources.icons[]
```

Indexer классифицирует source:

- `workspace` - папка находится внутри connected project;
- `external` - папка находится вне connected project.

### Workspace source

Workspace source не дублируется. Индексатор читает файлы на месте:

- `.svg/.png/.jpg/.jpeg/.webp/.avif` становятся project assets;
- `.tsx/.jsx` становятся project icon files/components.

Такие records можно использовать напрямую, потому что пути уже принадлежат
workspace.

### External source

External source индексируется как portable reference. Абсолютный `localPath`
остается в `.sdproj` только как локальная привязка этой машины, а generated
index хранит только переносимые поля:

```text
.sber-designer/assets/icon-sources.json
.sber-designer/design-index/external-icons.jsonl
```

`external-icons.jsonl` содержит `id`, `sourceId`, `sourceName`,
`sourceRelPath`, extension, hash/tags. В нем нет абсолютного пути.

Если агенту нужна такая иконка, `get_indexed_icon` вернет usage с:

```json
{ "requiresMaterialization": true, "tool": "materialize_indexed_icon" }
```

После вызова `materialize_indexed_icon` файл копируется в project-owned screen
asset library:

```text
src/sber-designer-assets/icons/<icon>.<ext>
src/sber-designer-assets/index.ts
.sber-designer/assets/materialized-assets.json
```

Затем проект переиндексируется, и materialized icon появляется как обычный
asset с `importSource: "@/sber-designer-assets"`. Если проект перенести на
другой компьютер, уже материализованные иконки останутся в git. Для новых
иконок из того же external source пользователь может заново привязать локальную
папку в Settings, имя/source id и relative path дадут индексу сопоставить pack
без внешних импортов в коде.

## Design index assets

`assets.jsonl` содержит:

- kind;
- filePath;
- importName;
- importSource;
- packId;
- tags;

Агент должен использовать эти records для import-ов и выбора иллюстраций.

`icon-candidates.jsonl` объединяет project icon props, assets, project icon
files, external icon references и Lucide fallback. Для external references
агент обязан сначала materialize icon.

## Prompt attachments

Assistant может получать вложения:

- images;
- SVG;
- text/markdown specs;
- HTML references;
- other supported documents.

Все вложения записываются в run evidence:

```text
.sber-designer/runs/<run-id>/attachments/
```

И попадают в prompt/handoff как durable references.

Attachment не становится project asset автоматически. Если reference требует
переиспользуемой иконки/картинки в source, агент должен явно использовать asset
pack import, icon source materialization или записать новый project-owned asset
в рамках allowed scope.

## Images

Image handling зависит от target:

- API vision model получает raster image как native content, собранный
  backend-ом из run evidence.
- Text-only API target блокируется preflight для raster image task. This
  includes direct DeepSeek V4 Pro in the built-in config: it can receive SVG as
  source/context, but not PNG/JPG/WebP native image input.
- Codex CLI получает native image file paths.
- OpenCode/Claude Code получают file references с warning fallback.
- SVG может передаваться как source/context.

Raster references могут быть uploaded files или explicit HTTPS image URLs.
URL-картинки не загружаются браузером для preview: backend валидирует URL,
блокирует private-network hosts, скачивает bytes с лимитами, пишет файл в run
evidence и только после этого формирует provider `image_url` content part.

UI и agent summary не должны обещать pixel-perfect image-to-screen, если runtime
не подтвердил image understanding.

## HTML attachments

HTML attachment используется как reference analysis:

- structure;
- headings;
- landmarks;
- forms;
- tables;
- labels;
- actions;
- mock text.

Запрещено:

- копировать attached HTML/CSS/JS в source как raw page;
- использовать `dangerouslySetInnerHTML` для visible UI;
- расширять allowed target files из-за attachment.

Экран должен быть пересобран через project components, tokens, icons and assets.

Это правило не относится к HTML-first project source files. В HTML-first
проекте `.html` и `.css` файлы внутри workspace являются production source и
могут редактироваться напрямую в рамках allowed screen/design-system scope.
Attachment становится source только если пользователь или агент явно создает
reviewable proposal или page file в подключенном проекте.

HTML-first design-system reference flow использует вложение или Pixso URL как
evidence и пишет proposal под:

```text
design/proposals/<proposal-id>/
```

До accept root `Design.md`, `tokens.css` и `components.css` не меняются.

## Attachments and scope

Attachment дает требования, но не разрешение на любые файлы. Scope по-прежнему
задается active screen/task/agent contract.

Если attachment требует новую asset import или общий component change, agent
должен явно запросить/объяснить это, а не молча менять unrelated files.
