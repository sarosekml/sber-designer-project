---
id: ADR-0005
title: LLM gateway and provider configuration
status: Accepted
date: 2026-05-08
scope: model provider boundary
---

# ADR-0005: LLM gateway — конфиг провайдеров (opencode-style) и admin-restrict (Builder-style)

- **Дата:** 2026-05-08
- **Статус:** Accepted
- **Контекст:** Phase 0 PoC-2.

## Контекст

Нужно решить, **в каком формате** пользователь / админ задаёт LLM-провайдеров и модели,
и **что из этого видит** конечный пользователь редактора.

Изучили два релевантных источника:

### Builder.io Fusion ([docs/ai-models](https://www.builder.io/c/docs/ai-models))

- Провайдеры **зашиты в продукт** (Anthropic / OpenAI / Google). Нет BYOK.
- Дефолт — Claude Sonnet 4. Опция **Auto** (выбирает дешевле).
- Админ-настройка `Settings → Advanced Settings → AI`:
  - `Restrict available AI models` — список разрешённых моделей.
  - `Auto model override` — какая модель используется по умолчанию.
- Пользователь переключает модель из dropdown'а в проекте.

### opencode ([docs/providers](https://opencode.ai/docs/providers/))

- Конфиг — JSON-файл `opencode.json` (project-local) или
  `~/.local/share/opencode/opencode.json` (global).
- Каждый провайдер — объект с полями:
  ```json
  {
    "provider": {
      "myprovider": {
        "npm": "@ai-sdk/openai-compatible",
        "name": "My Custom Provider",
        "options": {
          "baseURL": "https://api.myprovider.com/v1",
          "apiKey": "{env:MY_PROVIDER_KEY}",
          "headers": { "Authorization": "Bearer ..." }
        },
        "models": {
          "my-model": { "name": "My Model", "limit": { "context": 200000, "output": 65536 } }
        }
      }
    }
  }
  ```
- 75+ провайдеров через AI SDK.
- Auth: `apiKey` поле + env-substitution `{env:VAR}` + отдельный
  `auth.json` для secrets.

## Решение

### Формат конфига

**JSON-файл `sber-designer.json` в корне проекта.** Структура — opencode-style,
расширенная двумя секциями: `agent.default` (выбор активной модели) и
`agent.restrict` (admin-restrict из Builder).

```json
{
  "$schema": "https://sber-designer.example/schema.json",
  "agent": {
    "default": { "provider": "gigachat", "model": "GigaChat-Max" },
    "restrict": {
      "enabled": false,
      "providers": ["gigachat", "vllm-internal"],
      "models": ["GigaChat-Max", "qwen3-coder"]
    }
  },
  "provider": {
    "gigachat": {
      "type": "openai-compatible",
      "name": "GigaChat",
      "options": {
        "baseURL": "https://gigachat.devices.sberbank.ru/api/v1",
        "apiKey": "{env:GIGACHAT_API_KEY}"
      },
      "models": {
        "GigaChat-Max": { "name": "GigaChat Max", "limit": { "context": 32000 } },
        "GigaChat-Pro": { "name": "GigaChat Pro", "limit": { "context": 8192 } }
      }
    },
    "vllm-internal": {
      "type": "openai-compatible",
      "name": "Internal vLLM",
      "options": {
        "baseURL": "https://vllm.internal.example/v1",
        "apiKey": "{env:VLLM_API_KEY}"
      },
      "models": {
        "qwen3-coder": { "name": "Qwen3 Coder 30B", "limit": { "context": 128000 } }
      }
    },
    "claude-code-bridge": {
      "type": "claude-code",
      "name": "Claude Code (external)",
      "description": "Use the user's local Claude Code CLI as the agent — see ADR-0006."
    }
  },
  "mcpServers": {}
}
```

### Provider types (наш набор)

| `type`              | Что делает                                                  | Когда брать                              |
| ------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| `openai-compatible` | OpenAI Chat Completions API + кастомный `baseURL`           | GigaChat, vLLM, любой OpenAI-совместимый |
| `anthropic`         | `/v1/messages` (Anthropic)                                  | Anthropic API                            |
| `gigachat-native`   | GigaChat-специфика (если/когда у opencode-compat не хватит) | Резервный                                |
| `mock`              | Детерминированные ответы                                    | Тесты, оффлайн                           |
| `claude-code`       | Псевдо-провайдер: маршрутизирует к `proj-mcp`               | Bridge-mode (см. ADR-0006)               |

### Env-substitution

Поддерживаем синтаксис opencode: `{env:VAR_NAME}`. Резолвер вызывается
**на стороне сервера** (`services/api`) — клиент-браузер ключи никогда не видит.

### Где живёт config

1. **Repo project config** — `sber-designer.json` в корне репозитория проекта,
   к которому подключён редактор. Источник истины для CI и для on-prem-инсталляции.
2. **Workspace overrides** — `~/.config/sber-designer/config.json`,
   накладывается поверх (только `agent.default` и personal-options, не provider definitions).
3. **Admin-restrict** — задаётся только в repo-config, оверрайдить из workspace нельзя.

### UI

- Settings dialog в редакторе: dropdown выбора активной пары `provider × model`,
  список ограничивается `agent.restrict.providers/models` если `enabled: true`.
- Опция **Auto** добавим в Phase 2 (нужна оценка стоимости, для MVP не критично).
- Add custom provider — через ручную правку `sber-designer.json` (UI-формы — Phase 2).

### Что мы НЕ делаем

- Не реализуем «магазин 75 провайдеров» через AI-SDK npm. Это сложный bundling
  риск. Делаем 4 «нативных» типа выше, остальное — через `openai-compatible`.
- Не используем Builder-style **Auto-mode** в MVP (требует профилирования стоимости).
- Не пишем `auth.json` отдельно: для PoC env-substitution достаточно;
  encrypted secrets store — Phase 4.

## Последствия

- Любой код продукта, который зовёт LLM, идёт через `@sber-designer/llm-gateway`.
  Нет прямых `import { Anthropic } from '@anthropic-ai/sdk'`.
- Конфиг валидируется zod-схемой (`packages/shared-types`), несовпадение версии
  схемы → ошибка при загрузке проекта.
- `agent.default` — это **runtime override**: пользователь видит UI, может
  переключить модель в текущей сессии, но изменения не пишутся в `sber-designer.json`
  без явного `Save to project` (для admin).

## Ссылки

- [opencode providers](https://opencode.ai/docs/providers/)
- [Builder.io Fusion AI models](https://www.builder.io/c/docs/ai-models)
- [ADR-0006](./0006-proj-mcp-and-claude-as-agent.md) — проникновение MCP
