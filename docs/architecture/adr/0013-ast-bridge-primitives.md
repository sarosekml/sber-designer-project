---
id: ADR-0013
title: AST bridge primitives
status: Accepted
date: 2026-05-08
scope: structured source edits
refines:
  - ADR-0007
  - ADR-0010
---

# ADR-0013: `ast-bridge` primitives — структурные правки JSX через ts-morph

- **Дата:** 2026-05-08
- **Статус:** Accepted
- **Контекст:** Phase 2 step 1.

## Контекст

`proj-mcp` сейчас умеет только `ast_write_file` — full-replace
содержимого файла. Для агента это плохо:

- LLM должен сам сформулировать **весь файл** заново — токены, риск
  поломки структуры, изменение случайных строк.
- Нет атомарности: если агент пишет два файла подряд, между ними
  состояние репо неконсистентно.
- Не работает связка с Design-mode selection: пользователь выделил
  `<Button>` в строке 13, агент должен поменять одну prop без чтения
  всего файла.

ADR-0007 уже даёт нам source location (`file:line:col`) через React
Fiber. ADR-0009/0010 уже дают `services/api` как edge. Осталось
закрепить мост AST↔patch как первоклассный пакет с типизированным
набором операций.

## Решение

Реализуем `@sber-designer/ast-bridge` поверх **ts-morph** (lib над
TypeScript Compiler API). Один публичный entry — `applyOps`:

```ts
import { applyOps } from '@sber-designer/ast-bridge';

const result = await applyOps({
  workspaceRoot: '/abs/path/to/repo',
  ops: [
    { kind: 'set-prop', file: 'src/Button.tsx', loc: '13:5', name: 'variant', value: 'ghost' },
    { kind: 'add-import', file: 'src/Button.tsx', source: '@/Tooltip', name: 'Tooltip' },
  ],
});
// → { ok: true, changedFiles: ['src/Button.tsx'] }
```

### Набор операций (Phase 2.1 baseline)

| `kind`        | Что делает                                           | Когда выбирать                                           |
| ------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| `set-prop`    | Установить/перезаписать prop у JSX-элемента в `loc`. | Меняем variant, label, sx, etc.                          |
| `remove-prop` | Убрать prop.                                         | Сбрасываем переопределение.                              |
| `add-import`  | Добавить именованный (или default) import.           | Перед `set-prop`, который ссылается на новую переменную. |

**Не входит в Phase 2.1:**

- `swap-component` (rename JSX tag) — Phase 2.2.
- `wrap-with` (обернуть в новый компонент) — Phase 2.2.
- `set-children-text` — Phase 2.2.
- `extract-to-component` — Phase 3+.
- `move-jsx` (DnD на canvas) — Phase 2.2.

### Семантика value

`value` в `set-prop` — это **строка-выражение TypeScript**:

```jsonc
{ "name": "variant", "value": "\"ghost\"" }   // string literal
{ "name": "size",    "value": "24" }          // number literal
{ "name": "disabled","value": "true" }        // boolean
{ "name": "onClick", "value": "() => alert('!')" } // expression
{ "name": "sx",      "value": "{ mt: 2 }" }   // object literal
```

Альтернатива (typed payload — `{ type: 'string'|'number'|'expression', value: ... }`)
потребовала бы больше круглых скобок на стороне LLM. Сырая строка
ближе к тому, как агент уже пишет JSX. ts-morph парсит её как
expression — невалидное выражение → ошибка операции, никаких записей.

### Атомарность

Все операции выполняются в **in-memory ts-morph `Project`** (фактически
параллельная виртуальная FS поверх настоящих файлов). `project.saveSync()`
вызывается один раз в конце. Если хоть одна операция бросила — мы
сбрасываем state и НЕ пишем ничего на диск. Это даёт «всё или ничего»
без явного transaction-API.

### Безопасность

Каждый `file` в op-е проверяется через `safe-path.ts` (та же логика,
что в `proj-mcp/src/safe-fs.ts`): отказ от выхода за `workspaceRoot`,
запрет абсолютных путей в op-payload.

### Где живёт endpoint

`services/api`:

```
POST /api/patch
{
  "workspacePath": "/abs/path",   // optional; defaults to state.workspacePath
  "ops": [...]
}
→ { "ok": true, "changedFiles": [...] }   // 200
→ { "error": "patch_failed", "detail": "..." }   // 422
```

Браузер пока **не** дёргает этот endpoint напрямую — Phase 2.2 даст
`/api/chat` с tool-calling, который сам решит когда и какие patches
применять. Сейчас потребитель — `proj-mcp.ast_apply_patch`, через
который external Claude Code проводит правки.

`ast_write_file` остаётся как deprecated fallback — большие
переписывания (новый файл, удаление файла) пока через него.
В Phase 2.2 заменим на `fs_write_file` с явным флагом «новый файл».

## Что меняется на стороне `proj-mcp`

```diff
- ast_write_file(path, contents)        // full replace
+ ast_apply_patch({ ops: Op[] })        // structured, atomic
+ ast_write_file(path, contents)        // marked deprecated in description
```

Тула `ast_apply_patch` дёргает `/api/patch` через bridge, как
`editor_get_selection` делает с `/api/state`.

## Что мы НЕ делаем

- **Не пишем формат-сохранение Prettier.** ts-morph сам поддерживает
  consistent indentation и стиль файла. В Phase 2.2 добавим
  `prettier --write` как post-step опционально.
- **Не делаем typecheck-после-patch.** Это Phase 1.3 sandbox: dev-server
  всё равно типы прогонит при HMR. Если упало — пользователь видит
  ошибку в iframe.
- **Не делаем undo-stack.** Каждый patch = коммит в git (Phase 2.3).
  Откат через `git revert`.

## Последствия

- LLM получает гораздо более узкий и предсказуемый интерфейс правок.
  Меньше токенов, меньше ошибок.
- Любая операция знает только source location + payload — это
  очень стабильно при HMR/source-map drift.
- ts-morph — серьёзная зависимость (~5 МБ), но единственная адекватная
  для structured AST manipulation в TS-мире.

## Ссылки

- [ts-morph docs](https://ts-morph.com/)
- ADR-0007 — откуда берутся `loc`.
- ADR-0010 — почему через `services/api`.

> **0136 update:** граница workspace стала канонической (следует по
> symlink и проверяет реальную цель) — см.
> [ADR-0019](0019-access-boundaries-and-project-integrity.md).
