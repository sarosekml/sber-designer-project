# Agent Script Manifests

This folder stores safe script manifests for `ai-product-designer`.

The default sber-designer manifests live here:

```text
packages/agent-kit/kit/scripts/
```

Project-specific manifests can be added here:

```text
<connected-project>/.agents/scripts/
```

Personal manifests for all projects can be added here when
`SBER_DESIGNER_USER_KIT=enabled`:

```text
~/.sber-designer/agents/scripts/
```

The actual command implementation should normally live in the connected
project's `package.json`, `scripts/`, `tools/`, a personal helper location such
as `~/.sber-designer/scripts/`, or an approved CLI binary. This folder should
contain small `*.agent-script.json` manifests, not large shell programs or
dependency folders.

API-mode agents request these through `run_agent_script` and the permission
model. Local CLI runtimes receive script inventory in the handoff, but
sber-designer still validates the resulting target-file diff and render/source
receipts after the CLI exits.
