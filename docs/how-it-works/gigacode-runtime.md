---
updated: 2026-09-18T00:00:00+0300
---

# GigaCode CLI runtime

## Назначение и статус

GigaCode — пятый внешний CLI runtime sber-designer наряду с Claude Code,
Codex, OpenCode и Kimi. Он запускается как отдельный процесс в connected
workspace, сам читает и меняет файлы, а backend нормализует его stream-json в
обычный transcript, tool steps, usage и run artifacts.

Текущий статус нужно формулировать точно:

- integration code, file-backed auth/catalogue и replay-контракт реализованы;
- parser, session, model identity, usage, auth, catalogue refresh и failure
  semantics покрыты fixtures/unit/replay-тестами;
- обязательная live-матрица на машине с установленным и авторизованным
  GigaCode CLI пока остаётся release-проверкой;
- текущая исследованная версия — `26.9.64`; после обновления CLI live-матрицу
  нужно повторить.

Пользовательская установка и troubleshooting описаны в
[Connect GigaCode CLI](../integrations/connect-gigacode.md).

## Пользовательский путь

1. Установить GigaCode CLI на ту машину, где запущен API backend.
2. Выполнить `gigacode auth` и завершить корпоративный SSO.
3. В server profile администратор включает runtime через
   **Home → System → Agent runtimes → GigaCode**. В local profile runtime
   доступен по умолчанию.
4. В редакторе открыть **Settings → LLM providers**, включить GigaCode и
   выбрать модель из актуального каталога. Если вход ещё не выполнен, продукт
   покажет команду `gigacode auth` и кнопку **Check again**.
5. Отправить задачу в Assistant. Изменения появляются в connected workspace,
   Code/Source control и run diagnostics.

GigaCode не предоставляет поддержанный `models` subcommand. Для v26.9.x API
читает безопасную проекцию `config.chat.models[]` из локального state CLI;
synthetic `default` и отсутствующий в каталоге `CodeChat` не показываются.

## Где выполняется CLI

```text
browser
  → services/api
  → runtime detection / auth
  → handoff prompt + allowed target snapshot
  → gigacode process in connected workspace
  → stream-json normalization
  → mechanical finalization
  → run record / transcript / diff
```

Local profile видит `gigacode` из `PATH` процесса API или путь из:

```bash
SBER_DESIGNER_GIGACODE_BIN=/absolute/path/to/gigacode
SBER_DESIGNER_GIGACODE_HOME=/absolute/path/to/.gigacode
```

Server profile не может использовать CLI с ноутбука пользователя. GigaCode
должен быть установлен и авторизован на server host под service identity.
Allowlist `enabledCliRuntimes` определяет, будет ли он показан пользователям.

## Detection и authentication

Data-driven registry описывает:

- binary `gigacode`;
- version probe `--version`;
- compatibility auth probe `gigacode auth status`;
- безопасный reader `gigacode_token.json` и `settings.json`;
- MCP probe `gigacode mcp list`;
- stdin prompt delivery;
- `stream-json` parser;
- capture-style session;
- legacy fallback model `default` только для старого `Status: Configured`.

В v26.9.x `gigacode auth status` всегда отвечает, что auth управляется backend,
поэтому readiness определяется по наличию непустого token и непросроченному
`expiryDate`. Reader принимает ISO date и epoch seconds/milliseconds, ограничивает
каждый файл 2 MiB и возвращает только status, expiry, model metadata и безопасные
diagnostics. Token, headers, system messages, `.protected-storage` и `device_id`
не читаются и не попадают в API/log/store.

Refresh повторяет detection и синхронизирует сохранённые version, launch, auth,
MCP и catalogue. Если auth истёк, сохранённое подключение становится off. Если
каталог изменился, stale model удаляется, а выбор переходит на первую доступную
модель после проверки stored/configured id.

## Запуск

Runner передаёт prompt через stdin и строит аргументы:

```text
--approval-mode auto-edit
--output-format stream-json
[--model <explicit-non-default-model>]
[--resume <captured-session-id>]
```

`auto-edit` нужен для headless file edits: интерактивное подтверждение в
процессе без TTY остановило бы run. `--include-partial-messages` не включён:
MVP нормализует полные assistant messages и не рискует задвоить deltas.

Process запускается с `shell: false`, `cwd` равен connected workspace, а env
получает `SBER_DESIGNER_RUNTIME=gigacode`. Default watchdog — 15 минут без
нового output; abort и timeout завершают child process через `SIGTERM`.

## Stream-json

GigaCode происходит от Qwen Code и использует смешанный протокол:

| Входное событие GigaCode                                  | Нормализованное событие sber-designer   |
| --------------------------------------------------------- | --------------------------------------- |
| `system.init`                                             | running status + session/model metadata |
| `assistant.message.content[type=text]`                    | assistant text delta                    |
| `message.action=tool_call`                                | tool call                               |
| `message.action=tool_result`                              | tool result                             |
| `result.subtype=success`                                  | final text/usage                        |
| `result.subtype=failure`, `is_error=true` или event error | runtime error                           |

Каркас `system/assistant/result` похож на Claude Code, но tool traffic имеет
форму `message.action`. Поэтому GigaCode использует собственный parser, а не
Claude mapper.

Невалидная JSON-строка проходит общий stdout fallback. TLS warnings и
`[ERROR] [MCP_KEYCHAIN] …` классифицируются как runtime noise и не становятся
текстом ассистента.

## Truthful model identity

`system.init.model` может быть общим alias, например `CodeChat`. Модель,
которая реально сформировала ответ, приходит в `assistant.message.model`.
Приоритет такой:

```text
assistant.message.model
  → system.init.model
  → явно выбранная model
  → первая модель актуального каталога (или legacy `default`)
```

Финальное значение проходит через `runtime.model` в diagnostics,
`finalResponse.model`, screen generation info и run manifest. UI не должен
подменять его sentinel-значением из picker.

## Session continuation

Первый run не придумывает session id. GigaCode присылает CLI-owned
`system.init.session_id`; backend сохраняет его как `runtime.session`.
Следующий совместимый turn того же Assistant session запускается с:

```text
--resume <captured-session-id>
```

Resume разрешён только когда совпадают runtime, model, workspace и session
metadata. Если контекст несовместим, начинается новый runtime session.

## Usage и failure semantics

Usage берётся из финального `result.usage`:

- `input_tokens` → input;
- `output_tokens` → output;
- `total_tokens` → total.

Assistant-level usage не суммируется второй раз. `cache_read_input_tokens` не
прибавляется к input, потому что CLI уже сообщает агрегированные значения, а
публичный usage-контракт не имеет отдельного cache-счётчика.

Exit code `0` сам по себе не означает успех. Если stream прислал
`subtype=failure`, `is_error=true` или error event, runner завершает:

```text
finishReason = other
hadErrors = true
```

Это защищает finalization и replay consumers от ложного `complete`.

## MCP и attachments

GigaCode читает собственный `~/.gigacode/settings.json` с ключом
`mcpServers`. sber-designer:

- показывает результат `gigacode mcp list`;
- не мутирует пользовательский глобальный config;
- не инжектит product-owned MCP servers из `sber-designer.json`;
- передаёт project/agent-kit context через handoff prompt и файловые пути.

Raster image attachments не имеют подтверждённого native transport и поэтому
не объявляются поддержанными. SVG/source и validated file references могут идти
как текстовый контекст.

## Run artifacts и финализация

GigaCode run использует общий внешний runtime pipeline:

1. сохраняются target/workspace snapshots и `handoff.md`;
2. timeline получает normalized text/tool/runtime events;
3. после exit проверяются разрешённые changed files;
4. выполняются source/craft/render gates;
5. provider, фактическая model, session и usage попадают в manifest;
6. transcript сохраняется в screen-scoped Assistant history.

GigaCode не получает internal API tool schemas. Tool calls в transcript — это
инструменты самого CLI.

## Проверки и live-матрица

Автоматический контур включает:

- unit parser/args/auth/MCP tests;
- runtime registry и adapter contracts;
- mock process replay;
- checksum manifest и replay goldens;
- success, tool-call/keychain-noise и failure-with-exit-zero traces;
- handoff, session, model identity и usage tests.

Перед релизом на поддерживаемой машине дополнительно проверяются:

1. detection/version/auth/MCP;
2. stdin без TTY;
3. реальная file edit с `auto-edit`;
4. второй turn через `--resume`;
5. фактическая model/usage в Screen Info и manifest;
6. logout/error/noise paths.

Fixtures-verified нельзя называть live-verified до прохождения этой матрицы.

## Карта кода

| Область                    | Файл                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| Runtime definition         | `services/api/src/agent-runtimes/registry.ts`                    |
| Spawn/parser/usage/failure | `services/api/src/agent-runtimes/gigacode-runner.ts`             |
| Adapter dispatch           | `services/api/src/agent-runtimes/adapter.ts`                     |
| Detection/auth/MCP parsing | `services/api/src/agent-runtimes/detection.ts`                   |
| Safe GigaCode state reader | `services/api/src/agent-runtimes/gigacode-state.ts`              |
| Session policy             | `services/api/src/agent-runtimes/session.ts`                     |
| Model identity             | `services/api/src/agent-runtimes/model-identity.ts`              |
| Runtime settings           | `apps/web/src/components/editor/settings/providers.tsx`          |
| Chat model switcher        | `apps/web/src/components/editor/chat/AssistantModelSwitcher.tsx` |
| Server allowlist           | `services/api/src/auth/system-settings.ts`                       |
| Replay traces              | `tests/fixtures/runtime-traces/gigacode/`                        |
