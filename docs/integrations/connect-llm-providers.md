# Connect LLM Providers

> Development note. Stable system-level behavior is described
> in `/docs/how-it-works/system-overview.md`, and agent-facing behavior is
> described in `/docs/how-it-works/agent-system.md`.

## Which setup path applies

### Local profile

Run with:

```bash
bun run dev
```

Use `sber-designer.json` to declare API providers, API models, local CLI
runtimes, and the default agent target. This is the current behavior and must
remain backward-compatible.

### Remote server profile

Production starts through the `sd-api` / `sd-sandbox` systemd units. The
dev/staging equivalent is:

```bash
bun run dev:server
```

This command enables the explicit server deployment profile, password auth,
managed per-user workspaces and server runtime policy. It refuses to start
without the required projects/users roots. `bun run dev` always forces the
local profile instead.

The server administrator configures at least one API model in
`/etc/sber-designer/sber-designer.json`; its `agent.default` is shown as
**Server default** and requires no user key.

Незавершённая часть серверного сценария добавит второй путь: пользователь открывает
**Settings → LLM providers → Personal API connections**, сохраняет свой key,
проверяет connection и выбирает personal model. До закрытия этого этапа UI
сценарий считается запланированным, а не реализованным.

Personal connection account-scoped: он не записывается в connected project,
`sber-designer.json`, `.sdproj` или git. API key write-only; browser после
Save видит только masked suffix. Server policy определяет доступные provider
templates; arbitrary custom endpoints default off.

Remote server не может использовать CLI с ноутбука пользователя. В model
picker могут появляться только **Server CLI agents**, которые администратор
установил и разрешил на server host. Обычный local profile продолжает видеть
локальные CLI как сейчас.

## Image-To-Screen Requirements

Image-to-screen work requires one of these target capabilities:

- an API model marked with `vision: true`;
- a local CLI runtime that supports native image input;
- a local CLI runtime that can receive run-scoped attachment file paths, with an
  explicit warning that exact raster-image understanding depends on the
  runtime and selected model.

Text-only API models can still use SVG attachments as source context, but they
reject raster images before the agent loop starts.

Do not hardcode recommendations for specific model names in product copy or
runtime code. Provider/model selectors may show configured model ids from
`sber-designer.json`, while warnings should use generic guidance such as:

```text
Use a vision-capable model/runtime for image-to-screen work.
```

## Z.AI GLM Providers (general API vs Coding Plan)

Z.AI ships two OpenAI-compatible Chat Completions endpoints with separate
billing, and both are preconfigured in the shipped `sber-designer.json`:

| Provider          | Base URL                              | Auth env                  | Billing           |
| ----------------- | ------------------------------------- | ------------------------- | ----------------- |
| `zai`             | `https://api.z.ai/api/paas/v4`        | `ZAI_API_KEY`             | Pay-as-you-go API |
| `zai-coding-plan` | `https://api.z.ai/api/coding/paas/v4` | `ZAI_CODING_PLAN_API_KEY` | GLM Coding Plan   |

- Model catalog (both presets): `glm-5.3` (text-only, always reasons) and
  `glm-5.3-flash` (image input via `image_url`, Data-URL smoke-verified
  2026-09-21). FlashX is not part of the Coding Plan and is not listed; the
  legacy `glm-5.2` alias is not used — ids are explicit.
- A Coding Plan key used on the general endpoint fails with HTTP 429 /
  Z.AI code `1113` ("Insufficient balance or no resource package"). That is
  an endpoint/subscription mismatch, not a bad key: switch the active model
  to the `zai-coding-plan` provider instead of replacing the key.
- Per-machine wiring stays in the untracked `sber-designer.local.json`
  overlay, e.g. reusing the same secret reference for the Coding Plan preset:

  ```json
  {
    "agent": { "default": { "provider": "zai-coding-plan", "model": "glm-5.3" } },
    "provider": { "zai-coding-plan": { "options": { "apiKey": "{env:ZAI_API_KEY}" } } }
  }
  ```

- Subscription scope: the endpoints are technically compatible with the
  gateway (verified by live smokes), but Z.AI's usage policy ties Coding Plan
  quota to supported tools. Treat the smoke evidence as technical
  compatibility, not an official integration guarantee; check current terms
  before promising plan support to other users.

## Connection Test (Settings)

`Settings → LLM providers` shows a **Test connection** action for the active
API provider/model. The browser sends only provider/model ids; the server
(`POST /api/config/test-connection`) resolves the configured endpoint/key,
applies admin restrictions, and runs one short tool-free completion with
bounded time and output tokens — no agent loop, no workspace content, no run
artifacts, and never triggered by merely opening Settings or refreshing
config.

Results distinguish:

- **api key configured** — the secret is present server-side (badge on the
  provider row); says nothing about reachability or billing.
- **Connection verified** — the provider answered a real request; the result
  shows the provider-reported model id and elapsed time, and is invalidated
  when provider, model, endpoint, or auth changes.
- **Connection failed** — normalized cause plus a next action: auth (check
  the key), billing/quota (Z.AI business codes like 1113/1308/1309, with the
  Coding-Plan-endpoint hint when 1113 comes from the general endpoint),
  model access, rate limiting (bare HTTP 429 is not treated as retryable),
  or network/timeout (explicitly not a verdict on the key).

Gateway errors carry structured metadata (`category`, `providerCode`,
`retryable`) alongside the legacy message; see
`packages/llm-gateway/src/provider-error.ts` and the mapping in
`services/api/src/provider-diagnostics.ts`.

## Capability Sources

API model capabilities come from the matching `provider[providerId].models`
entry. Set `vision: true` only when the provider model can read raster image
inputs sent by the gateway.

CLI runtime capabilities come from the runtime registry in
`services/api/src/agent-runtimes/registry.ts`. A runtime should be marked as
native image-capable only after the runner has tests for the actual handoff
path.
