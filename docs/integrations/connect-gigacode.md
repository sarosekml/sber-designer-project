# Connect GigaCode CLI as your sber-designer agent

> GigaCode CLI is Sber's terminal coding agent (part of the GigaCode /
> [GitVerse](https://gitverse.ru/features/gigacode/) family, available both in
> the cloud and on-premise). sber-designer drives it the same way it drives
> Claude Code, Codex CLI, OpenCode, and Kimi Code: your prompt goes to the CLI,
> and the editor renders its output as a normal agent run.
>
> Текущий runtime pipeline,
> event mapping, session/model/usage semantics и граница автоматической и live
> проверки описаны в
> [How it works: GigaCode CLI runtime](../how-it-works/gigacode-runtime.md).

> **Verification status.** Интеграция покрыта mock/replay traces, включая
> tool calls, truthful model identity, usage и failure при exit `0`. Реальный
> stdin/auto-edit/auth/MCP/resume smoke нужно выполнить на машине с
> установленным CLI перед релизом и после каждого обновления GigaCode.

## Prerequisites

- GigaCode CLI installed and on your `PATH` (`gigacode --version` prints a
  version such as `26.9.64`).
- A signed-in CLI. Run `gigacode auth` and complete the corporate SSO flow.
  Current builds do not expose truthful readiness through `auth status`.

If the binary lives outside `PATH`, point sber-designer at it with an
environment variable before starting the API service:

```bash
export SBER_DESIGNER_GIGACODE_BIN=/absolute/path/to/gigacode
```

If GigaCode keeps its state outside `~/.gigacode`, point the API directly at
that state directory:

```bash
export SBER_DESIGNER_GIGACODE_HOME=/absolute/path/to/.gigacode
```

## 1. Enable the runtime (server deployments only)

On a shared/beta server an administrator decides which CLI runtimes are
offered: **Home → System → Agent runtimes → GigaCode**. Installations that
already stored this setting keep their previous selection, so GigaCode starts
out disabled there and has to be switched on once.

Local single-user installs have every runtime enabled by default and can skip
this step.

## 2. Select GigaCode in Settings

Open the editor → **Settings → LLM providers**. The **GigaCode** row shows the
detected binary, version, and authentication state.

- Turn on the row to run detection. If auth is not ready, copy `gigacode auth`
  from the dialog, complete SSO in a terminal and press **Check again**. The
  product never launches a terminal or browser on your behalf.
- Pick a model from the current GigaCode chat catalogue. Description and
  context size come from the CLI state. Stale `CodeChat` and synthetic
  `default` entries are intentionally omitted for v26.9.x.
- sber-designer still records the authoritative `assistant.message.model` in
  the final response and run manifest because runtime identity can be more
  specific than the selected catalogue id.

You can also switch to GigaCode from the model switcher next to the chat
composer.

## 3. Verify

Send a small request in the chat, for example _"List the screens in this
project."_ You should see:

- streamed assistant text in the chat panel;
- tool calls (`read_file`, `write_file`, …) rendered as run steps;
- token usage on the run, visible in the screen **Info** panel;
- file changes in Source control when the run edits the workspace.

## 4. What GigaCode can and cannot do here

| Capability                              | Status                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Streamed text, tool calls, tool results | Supported (`--output-format stream-json`)                                                                                               |
| File edits without prompts              | Configured with `--approval-mode auto-edit`; verify once after installing or upgrading the CLI                                          |
| Session continuation across chat turns  | The first run captures `system.init.session_id`; later turns use `--resume`                                                             |
| Token usage reporting                   | Supported (from the CLI's final `result` event)                                                                                         |
| Failure with process exit `0`           | Treated as failed when the final result reports `failure` / `is_error`                                                                  |
| Model list in Settings                  | Supported from the sanitized local `config.chat.models[]` projection; no token data leaves the API process                              |
| Project MCP server injection            | Not yet — GigaCode stores MCP servers in its own `~/.gigacode/settings.json` format, so the agent works through the file system instead |
| Raster image attachments                | Not supported; SVG sources and file paths are passed as text                                                                            |

## Troubleshooting

**GigaCode is missing from Settings.** On a server deployment, check
Home → System → Agent runtimes. Otherwise the binary was not found: confirm
`gigacode --version` works in the same shell that starts the API service, or
set `SBER_DESIGNER_GIGACODE_BIN`.

**Status shows "not connected" although the CLI works.** Run `gigacode auth`,
complete SSO, then press **Check again**. If state is stored outside
`~/.gigacode`, set `SBER_DESIGNER_GIGACODE_HOME` before starting the API.

**No models are available.** Refresh the runtime after GigaCode finishes its
backend update. A valid token with an empty or invalid chat catalogue is blocked
instead of silently running an unknown default model.

**`[ERROR] [MCP_KEYCHAIN] …` lines appear when the CLI starts.** GigaCode logs
keychain failures for its own MCP servers. sber-designer ignores these lines —
they never reach the chat — and they do not affect runs.

**A run ends without touching any file.** Check that the CLI is allowed to edit
this workspace: run `gigacode --approval-mode auto-edit` manually in the project
directory once and confirm the approval prompt does not block writes.
