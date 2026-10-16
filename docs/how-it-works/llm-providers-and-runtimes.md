---
updated: 2026-07-24T16:20:16+0300
---

# LLM providers and runtimes

## Две ветки исполнения

sber-designer поддерживает два принципиально разных типа AI target.

### API provider

Модель вызывается через `@sber-designer/llm-gateway`. Внутренний
`ai-product-designer` получает tool schemas и работает внутри API backend.

Примеры provider types:

- `mock`;
- `openai-compatible`;
- `anthropic`;
- `claude-code` bridge legacy/adapter path.

### CLI runtime

sber-designer запускает внешний локальный CLI:

- `claude-code-runtime`;
- `codex-runtime`;
- `opencode-runtime`;
- `kimi-runtime`;
- `gigacode-runtime`.

CLI runtime не получает internal tool loop. Backend создает run, собирает
handoff prompt, запускает CLI в workspace, стримит события и после завершения
проверяет changed target files/render health.

Каждый runtime имеет собственный parser/session/attachment contract в общем
data-driven registry. Подробный контракт пятого runtime:
[GigaCode CLI runtime](./gigacode-runtime.md).

## Config

Project config:

```text
<workspace>/sber-designer.json
```

Схема находится в `packages/llm-gateway/src/schema.ts`.

Основные секции:

```json
{
  "agent": {
    "default": "...",
    "restrict": "...",
    "attachments": {},
    "concurrency": {}
  },
  "provider": {},
  "mcpServers": {}
}
```

Secrets задаются через env references:

```json
{ "apiKey": "{env:OPENROUTER_API_KEY}" }
```

Frontend получает только redacted config через `toFrontendConfig`.

## Local и server model configuration

Серверный сценарий вводит явный deployment profile. Раздельные команды и
runtime граница уже реализованы; personal API connection UI остаётся
незавершённой частью этого направления.

### Local profile — без изменений

`bun run dev` продолжает использовать текущий `sber-designer.json`, env этой
машины и установленные на ней CLI runtimes. Новый server account secret store
не загружается, login не появляется, существующая настройка/выбор моделей не
мигрируют. Server `system.json` и allowlist CLI в этом profile не читаются:
локально видны runtime'ы этой машины — так же, как до появления server
profile.

### Server profile — два источника API models

Server profile запускается через `bun run dev:server` для dev/staging или
через systemd units для production. Он требует password/OIDC identity и
managed projects/users roots. Сейчас готов server-managed каталог; personal
connections ниже описывают оставшуюся часть Этапа 11.

1. **Server models.** Администратор настраивает server config и secret env.
   `agent.default` становится **Server default**; новый пользователь работает
   без собственного API key.
2. **Personal API models.** Пользователь добавляет provider в
   **Settings → LLM providers**. Connection принадлежит его server account и
   доступен во всех его проектах в рамках admin policy.

Effective model catalog строится server-side для текущей identity. Personal
provider получает внутренний id `personal:<connectionId>` и не может быть
запрошен по user id другого аккаунта. Admin restrictions/templates применяются
после merge.

Personal key:

- принимается browser только при create/replace;
- хранится в `users/<userId>/model-connections.json.enc` с authenticated
  encryption и правами `0600`;
- в API возвращается только `keyLast4`;
- не попадает в `sber-designer.json`, `.sdproj`, git, prompts, audit, run
  evidence или error body;
- не восстанавливается из browser/localStorage.

Выбранная personal model хранится как remote user preference. Если connection
удалён/запрещён, UI явно предлагает Server default. Ошибка personal provider во
время запуска не вызывает silent fallback: отправка данных другой модели без
согласия запрещена.

### CLI в server profile

Server backend не видит Codex/OpenCode/Claude Code/Kimi/GigaCode, установленные
на ноутбуке пользователя. Он может запускать только CLI, установленные и
авторизованные на server host под service identity. В UI они называются
**Server CLI agents** и включаются администратором. Local profile сохраняет
нынешние **local CLI agents**.

## Model visibility

`listVisibleModels` учитывает:

- provider entries;
- agent defaults;
- restrict policy;
- model capabilities.

UI не должен советовать конкретную модель по имени. Для задач с изображениями
правильная формулировка: выбрать vision-capable model/runtime.

## AgentModelTarget

Перед запуском backend приводит выбранный provider/runtime к
`AgentModelTarget`.

API target знает:

- provider id;
- model id;
- supports tool calls;
- supports project MCP tools;
- supports raster image input only if `vision: true`;
- optional `imageInput` transport metadata:
  `transport`, `acceptsDataUrl`, `acceptsRemoteUrl`, `verification`,
  `verifiedAt`, `lastFailureCode`, `lastFailureMessage`;
- supports SVG as source/context.

CLI target знает:

- runtime provider id;
- command/path/status;
- supports own MCP config;
- supports native image paths или warning fallback;
- has no project MCP tools from API mode.

## Attachments

Правила:

- API raster images отправляются только в vision-capable model.
- API vision payload строится backend-ом из validated run evidence. Browser
  `image_url` parts считаются transient input и пересобираются перед model call.
- `models.*.imageInput.verification` with a `failed-*` value blocks raster
  attachments even if a future config accidentally sets `vision: true`.
- Direct DeepSeek V4 Pro is text-only in the built-in config: the public direct
  API rejected OpenAI-compatible `image_url` parts with
  `unknown variant image_url, expected text`, and zcode only proved SVG/source
  inspection, not JPG/PNG vision.
- Text-only API target должен получить preflight rejection для raster image
  task.
- Remote image URLs допускаются только как explicit attachments; backend
  валидирует HTTPS/public host, MIME, размер, redirect-limit и пишет bytes в
  run evidence.
- SVG считается source/context и может идти в text-only target как текстовый
  артефакт.
- Codex CLI получает raster image paths как native CLI input.
- OpenCode/Claude Code пока получают raster files как references с warning,
  пока native image handoff не подтвержден тестами.
- HTML attachments сохраняются как sanitized compact reference analysis. Их
  нельзя вставлять в UI как raw HTML.

## Runtime registry

Код:

- `services/api/src/agent-runtimes/registry.ts`;
- `services/api/src/routes/agent-runtimes.ts`;
- `services/api/src/agent-runtimes/<runtime>-runner.ts`, включая
  `gigacode-runner.ts`.

Registry описывает:

- command candidates;
- event parser;
- model list capabilities;
- MCP capabilities;
- image handoff capabilities;
- smoke/preflight behavior.

Runtime connection state хранится в пользовательском config path, а не в
`.sdproj`, потому что это состояние конкретной машины. Но выбранный agent
default проекта может храниться в `.sdproj`.

## GigaCode CLI

GigaCode использует headless аргументы `--approval-mode auto-edit
--output-format stream-json`, получает prompt через stdin и захватывает
CLI-owned session id из `system.init` для последующего `--resume`.
`assistant.message.model` считается фактической model и имеет приоритет над
alias из `system.init`; usage берётся из финального `result`.

Runtime-level failure не определяется только exit code: `result.failure` при
exit `0` всё равно завершает run с `hadErrors=true`. Собственный
`~/.gigacode/settings.json` не мутируется, project MCP injection в MVP нет.

Integration fixtures/replay-verified, но реальная file edit/auth/resume матрица
должна выполняться после установки или обновления CLI. Полное описание:
[GigaCode CLI runtime](./gigacode-runtime.md); установка:
[Connect GigaCode CLI](../integrations/connect-gigacode.md).

## Codex CLI preflight

После инцидента 08.06.2026 Codex CLI startup проверяется до normal generation
handoff. Если `codex exec --json` не стартует из-за config, backend возвращает
machine-readable error:

```text
409 runtime_config_invalid
```

Например:

```text
service_tier="priority" is unsupported; expected "fast" or "flex"
```

Это должно отображаться как проблема настройки runtime, а не как "agent made no
changes".

## Concurrency

Agent runs координируются по screen/session/provider/model/target scope.
Backend создает preflight run и lease, чтобы пользователь не запускал
конфликтующие изменения одного screen без контроля.

## MCP distinction

Product-owned MCP servers из `sber-designer.json` доступны API-agent mode.
External CLI runtime использует свой MCP config. sber-designer может передать
CLI информацию о project context и skill inventory, но не внедряет свои API
MCP tools в чужой runtime как executable schema.
