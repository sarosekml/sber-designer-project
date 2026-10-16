---
updated: 2026-07-24T23:16:08Z
---

# Run records and diagnostics

## Назначение

Run records нужны, чтобы agent work был воспроизводимым и проверяемым. Если
экран не рендерится или CLI упал, диагностика должна показывать границу сбоя,
а не общий "agent failed".

## Где лежат run artifacts

```text
<workspace>/.sber-designer/runs/<run-id>/
  run-manifest.json
  timeline.jsonl
  receipts/
  handoff.md
  feedback.json                 optional
  prompt-attachments/
  external-runtime/
  continuation-context.json
```

Project-level observability и память лежат рядом с runs:

```text
<workspace>/.sber-designer/runs-dataset.jsonl
<workspace>/.sber-designer/preferences/events.jsonl
<workspace>/.sber-designer/preferences/preferences.md
```

Нормализованная dataset-строка создаётся один раз на terminal Run ID и хранит
status, gates, reuse, craft, Jury score и `total/input/output` usage. Оценка
пользователя обновляет поле `feedback` без второго Run ID. Полная логика
feedback и derived style memory описана в
[Agent quality harness](./agent-quality-harness.md#feedback-и-project-style-memory).

Временные attempt logs могут лежать в system temp:

```text
/var/folders/.../T/sber-designer/agent-runs/*.jsonl
```

UI должен показывать ссылки/пути к обоим типам evidence.

## Git hygiene for local MVP

Run evidence under `.sber-designer/runs/*` belongs to the connected project when
it is needed to understand or continue work:

- design-source handoff evidence;
- mapping reports and receipts used in review;
- failed/needs-review run timelines that explain a generated screen;
- continuation context for a run the team expects to resume.

Local machine artifacts should stay out of git:

- temp attempt logs under `SBER_DESIGNER_AGENT_LOG_DIR`;
- `.playwright-mcp/*`;
- root `*.log` files;
- ad-hoc screenshots and local smoke captures such as `*-smoke.png`;
- browser dumps that are not attached to a durable run.

For feature PRs, include only the run records that explain the change or are
explicitly requested for debugging. The normal project transfer set is
`.sber-designer/project.sdproj`, relevant `.sber-designer/design-index/*`,
relevant `.sber-designer/assets/*`, screen/source/story/template/assets,
materialized `src/sber-designer-assets/*` files and the shared
`sber-designer.json` config when it contains no secrets.

## Run manifest

Manifest фиксирует:

- run id;
- screen/session;
- provider/runtime;
- status;
- started/finished;
- changed files;
- diagnostics;
- summary;
- metrics.

Status должен отражать реальность:

- `complete` - задача завершена;
- `needs_review` - source изменен, но проверка/качество требуют человека;
- `failed` - нет полезной мутации или произошла настоящая ошибка;
- `running` - run еще активен;
- `cancelled` - run остановлен пользователем; committed изменения могут
  остаться на диске.

## Timeline

Timeline JSONL фиксирует события:

- run start;
- user prompt;
- model output;
- tool call/result;
- permission request/resolution;
- runtime events;
- receipts;
- done/error.

Это главный forensic слой.

## Receipts

Receipts - структурированные подтверждения:

- write_file/apply_patch;
- source validation;
- design-readable validation;
- craft findings;
- screen readiness profile and per-category DoR results;
- external runtime target diff;
- runtime render health;
- prompt attachments;
- component pack, включая selection source, planned roles, design-system gaps,
  resolved public imports, chosen variants/critical props, excluded divergence,
  hydrated component ids и region-batch byte sizes;
- git/send_pr.

Receipts должны быть короткими, машинно читаемыми и пригодными для UI badges.

### External runtime identity

Для CLI run manifest должен хранить фактические runtime/model/session/usage, а
не только sentinel из picker. В частности, GigaCode может объявить
`system.init.model=CodeChat`, но реально ответить другой model в
`assistant.message.model`; последнее значение становится authoritative.
Session id захватывается из runtime и используется при resume, а usage берётся
из финального result без повторного суммирования assistant usage.

Runtime error event остаётся ошибкой даже при process exit `0`. Эти правила
закреплены replay traces и подробно описаны в
[GigaCode CLI runtime](./gigacode-runtime.md).

### Screen readiness receipts

`validate_screen_craft` receipts include the user-selected global Screen
readiness profile snapshot and a `categoryResults` table. A
category result can be:

- `passed` - enabled and no active findings;
- `findings` - enabled with should-fix/advisory findings;
- `blocked` - enabled with blocking findings;
- `disabled` - user disabled the category in the profile;
- `skipped` - category is enabled but prerequisites/runner are unavailable;
- `missing` - reserved for future screen-level checks where the target cannot be
  resolved.

`disabled` and `skipped` are not the same as `passed`. UI and handoff should show
them distinctly so an empty repo without tokens/components does not look more
ready than it is.

### TypeScript craft gate

`validate_screen_craft` also type-checks the generated screen against the
connected project's own `tsconfig` (ts-morph, scoped to the changed file, one
program cached per tsconfig). This turns the contract failures that used to
surface as cryptic runtime crashes ("Page is not defined", "Element type is
invalid") into precise findings the fix loop can act on:

- `craft.type-error` (blocking) - a real TS error in the screen: wrong prop name
  (`<Icon iconName>` when the prop is `name`), an invalid union token
  (`type="Body_M_Regular"`), a wrong prop shape (`startIcon={<Icon/>}` when it is
  a string), or a symbol imported under the wrong name/module.
- `craft.typecheck-unavailable` (should-fix) - the project has a `tsconfig` but
  the type program could not load (`project_load_failed` / `file_not_in_program`).
  The gate is best-effort: a project with no `tsconfig` is a silent no-op, but a
  TS project whose check could not run is surfaced, never reported as "passed".

Both rule ids belong to the `sourceIntegrity` readiness category.

## Attempt logs

Attempt logger записывает route-level события, которые могут случиться до или
вне durable run:

- preflight;
- config loading;
- runtime smoke-check;
- CLI spawn/stderr/exit;
- request rejection;
- timeout.

После Codex CLI инцидента 08.06.2026 Codex branch пишет lifecycle events:

```text
runtime.codex.preflight.status
runtime.codex.handoff.start
runtime.codex.spawn
runtime.codex.stderr
runtime.codex.exit
runtime.codex.spawn.error
```

## Render health

Render health должен отвечать на вопрос:

```text
Активный screen после изменений реально рендерится?
```

Проверка должна использовать sandbox origin and story id, а не proxied iframe
URL как upstream. Если Storybook недоступен, но source/story file на диске
консистентен, это отдельная диагностическая причина.

### Run-status banner

Render health runs as a post-check **after** the agent's final message, so the
agent cannot know its result and may have written an optimistic "all validations
passed" summary. When a run resolves to `needs_review` or `failed`, the built-in
finalizer prepends an authoritative status banner to the final message:

```text
── Run status: NEEDS REVIEW ──
This screen is NOT fully validated. Disregard any "all validations passed" /
"fully verified" wording above: render verification was not proven and review
is still required.
```

The banner is deterministic: it is the source of truth and supersedes the
agent's prose, so the user is never misled by an over-optimistic summary.

## Screen health

Screen health в UI должен различать:

- broken runtime;
- source saved but preview unavailable;
- needs review due to craft findings;
- generated placeholder;
- ready.

Плохая классификация создает ощущение, что агент ничего не сделал, хотя source
уже записан.

## Transcript durability

История Assistant должна сохраняться в `.sdproj` независимо от финального
status run. Если SSE оборвался или run упал после successful write, user,
assistant text, tool calls/results and run links должны оставаться после reload.

Правило:

- backend `done.transcript` authoritative when available;
- frontend checkpoints significant events;
- internal auto-nudges filtered from visible history.

## Project cover не является run artifact

Snapshot project cover запускается UI после успешного screen run, но не входит
в run manifest, receipts или evidence export. Это best-effort post-run side
effect:

- failed, cancelled, truncated и screen-less runs его не запускают;
- capture/upload failure сохраняет предыдущий cover и не меняет итоговый
  `success`/`needs_review`;
- image лежит в `.sber-designer/previews/cover.*`, а не в
  `.sber-designer/runs/<run-id>/`;
- source screen можно понять из текущего registry pin/lifecycle, но cover не
  является доказательством прохождения quality gates.

Полный lifecycle: [Project covers](./project-covers.md).

## Evidence export

UI может дать Export evidence. Архив должен включать:

- manifest;
- timeline;
- receipts;
- prompt;
- attachments metadata;
- external runtime context;
- relevant logs.

Это нужно для баг-репортов без ручного поиска по temp folders.

## Хорошая диагностика

Сообщение пользователю должно назвать ближайшую точную причину:

- `Codex config invalid: service_tier="priority" ...`;
- `Source saved, preview server unavailable ...`;
- `Storybook story not ready after backoff`;
- `Runtime produced no changes in allowed target files`;
- `Screen root missing`;
- `Validation timed out after source write`.

Generic `Agent run failed` допустим только как заголовок, но рядом всегда должна
быть machine-readable and human-readable reason.
