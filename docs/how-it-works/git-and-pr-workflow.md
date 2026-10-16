---
updated: 2026-07-06T23:42:26+03:00
---

# Git and PR workflow

## Назначение

Git workflow нужен, чтобы изменения из sber-designer доставлялись как обычные
изменения проекта: diff, commit, push, PR. Северная звезда — **VS Code Source
Control**: один список всех незакоммиченных изменений, без деления «кто менял»,
commit/PR из той же панели.

Кодовые точки:

- `services/api/src/routes/git.ts` — маршруты;
- `services/api/src/git/git-worker.ts` — обёртка над `git`/`gh`/`glab`;
- `apps/web/src/components/editor/git/SourceControlPanel.tsx` — главная панель;
- `apps/web/src/components/editor/git/GitDiffView.tsx` — общий рендер diff;
- `apps/web/src/components/editor/git/source-control-state.ts` — чистая логика панели;
- `apps/web/src/components/editor/GitGraphDialog.tsx` — read-only просмотр истории;
- `apps/web/src/components/editor/StatusBar.tsx` — футер;
- `apps/web/src/stores/git-store.ts` — единый git-стор;
- `apps/web/src/hooks/useGitStatusSync.ts` — focus/poll синхронизация.

## Git — единственный source of truth

Никакого собственного состояния «кто менял». Каждый ответ читает свежий
`git status --porcelain=v2 -z`, поэтому рестарт процесса API ничего не меняет —
состояние живёт в git (правило 11 CLAUDE.md). Прежний in-memory `change-ownership`
Map удалён вместе с делением owned/external.

`GitChange` (`packages/shared-types`): `{ path, kind, staged, origPath? }`, где
`kind ∈ modified | added | deleted | renamed | untracked | conflicted`.

## Что показывает UI

**Панель Source Control** (правый Sheet, открывается из футера):

- header: `Source Control` + branch chip + ahead/behind + иконки Git Graph и Refresh;
- commit box: target-ветка (`Current` / existing branch / `New sd/...`) + сообщение +
  кнопки `Commit` / `Commit & Push` / `Create PR / Update PR`;
- список изменений: чекбоксы (по умолчанию все выбраны) + буква статуса
  (`M/A/D/R/U/C` с цветом) + путь; клик по строке → diff снизу;
- inline-шаг PR: title/body/draft + превью ветки (`Will create sd/<slug> …` или
  `Will update PR #N …`) + `Send`/`Back`;
- пустое состояние `No uncommitted changes`; состояние «не git-репозиторий».

**Футер** (`StatusBar`): `[branch]` (→ панель) · `↓↑` (→ fetch) · location ·
provider · PR chip (`PR open`/`Merged` + внешняя ссылка) · `Sync to base` при
merged · кнопка `Graph` (→ Git Graph) · кнопка `Send PR · N` (→ панель; `N` =
всего изменений, warning-цвет при N>0). Счётчик изменений слит в кнопку Send PR;
дублирующих входов на одно действие нет.

## Project-owned metadata

В `.sdproj` сохраняется только PR-кэш:

```text
project.gitSession = { provider, remote, remoteUrl, baseBranch, workingBranch,
                       status: 'review-open' | 'merged' | …, prUrl?, prNumber?, … }
```

Session — это кэш PR, а не источник dirty-состояния. На window-focus (не чаще
раза в 60с) и на `/sync` backend вызывает `gh pr view <n> --json state,url` и
обновляет/очищает кэш (merged снаружи → футер `Merged` без рестарта; удалённый
PR → session очищается).

## Routes

- `GET /status` (`?refreshPr=true` — освежить статус PR через `gh`);
- `GET /graph`, `GET /branches`, `GET /diff` (untracked отдаётся через
  `git diff --no-index /dev/null` — без записи в index);
- `POST /branch/create`, `POST /branch/checkout`, `POST /commit`
  (`{ paths, message? }`), `POST /push`;
- `POST /send-pr` (`{ paths, message?, title?, body?, draft? }`) — одна кнопка:
  ветка (если на base — `sd/<slug>`) → scoped commit → push → create/update PR;
- `POST /sync`, `POST /session/clear`.

Отдельных `/pr/create` и `/pr/update` больше нет — `send-pr` создаёт или
обновляет PR по наличию открытой сессии.

## Commit выбранных путей

`/commit` и `/send-pr` валидируют `paths` против свежего `git status`; устаревший
путь или конфликт → clear 400 (`git_error`). Для rename в pathspec попадают и
новый, и старый путь. `scopedCommit` делает `git add -A -- <paths>` (это и
делает untracked/deleted/rename коммитируемыми) и `git commit -m … -- <paths>`
(pathspec-scoped — чужие staged-файлы не затрагиваются). Пустое сообщение →
авто `sber-designer: update N files`.

## PR flow

1. Пользователь или агент меняет screen/source/.sdproj.
2. Git status показывает изменения (единым списком, без owned/external).
3. Пользователь открывает панель, отмечает файлы, выбирает target-ветку
   (`Current`, existing branch или новая `sd/...`) и при желании правит
   сообщение.
4. `Create PR` → inline-шаг → `Send`: backend использует выбранную ветку; если
   пользователь остался на base, режет `sd/<slug>` от base, коммитит выбранное,
   пушит и открывает PR. Повторный `Send` обновляет тот же PR (push +
   опциональный edit title/body).
5. Merged снаружи → focus-refresh показывает `Merged` + `Sync to base`.

Агент может вызвать `send_pr` tool только с разрешением; он коммитит все
незакоммиченные изменения рабочего дерева (ownership'а нет).

## Ограничения

- Не делать destructive git commands без явного действия пользователя
  (discard — отдельная задача C2 с обязательным confirm).
- Diff-запрос никогда не пишет в git index: чтение истории не меняет состояние
  рабочего дерева.
- Не считать `.sber-designer/*` мусором: это часть проектного state.
- Если git repo отсутствует, редакторские сценарии продолжают работать, а
  PR-флоу disabled + диагностика (`status.reason`).
