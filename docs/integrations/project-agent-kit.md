# Project Agent Kit

The built-in `ai-product-designer` starts from the default kit in the
sber-designer repo:

```text
<sber-designer-repo>/packages/agent-kit/kit/
```

When a user connects a project, sber-designer loads that default kit first and
then overlays an optional project kit:

```text
<connected-project>/.agents/
```

Use the project kit for project-specific docs, skills, and script manifests.
The project facts still live in `.sber-designer/`: `project.sdproj`,
`templates/`, and `design-index/`.

## Folder Layout

```text
<connected-project>/.agents/
  config.json
  agents/
    ai-product-designer.md
  instructions/
    *.md
  skills/
    my-skill/SKILL.md
  knowledge/
    *.md
  scripts/
    *.agent-script.json
```

Only add the folders you need. Missing project folders fall back to the default
sber-designer kit.

## Merge Rules

- Project files override default files with the same agent, skill, knowledge id,
  or script name.
- Unique project skills, knowledge, and scripts are appended to the inventory.
- `tools` and `skills` frontmatter filter what the agent can see.
- `permission` controls what happens when the agent tries to run a visible tool.

## Config Example

```json
{
  "$schema": "https://sber-designer.example/agents.schema.json",
  "defaultAgent": "ai-product-designer",
  "instructions": ["instructions/*.md"],
  "knowledge": [
    {
      "id": "billing-domain-rules",
      "path": "knowledge/billing-domain-rules.md",
      "description": "Domain copy, statuses, and UX rules for billing screens."
    }
  ],
  "permission": {
    "*": "ask",
    "read": "allow",
    "edit": {
      "*": "ask",
      "src/generated/**": "allow",
      ".env*": "deny"
    },
    "run_script": {
      "*": "ask",
      "validate-design-context": "allow"
    },
    "load_skill": "allow",
    "send_pr": "ask",
    "set_mode": "allow"
  },
  "skills": {
    "allow": ["*"],
    "deny": []
  }
}
```

## Runtime Permission Grammar

The `permission` map accepts these actions:

- `allow`: run without asking.
- `ask`: pause the agent and show a **Permission required** card in chat.
- `deny`: return `agent_permission_denied` before the tool handler runs.

Rules can be a single action or a resource-pattern map:

```json
{
  "permission": {
    "edit": {
      "*": "ask",
      "src/screens/**": "ask",
      "src/generated/**": "allow",
      ".env*": "deny"
    }
  }
}
```

Supported categories:

| Category     | What it covers                                                                  |
| ------------ | ------------------------------------------------------------------------------- |
| `read`       | `read_file`, component/catalog/design-index/template/selection/agent inventory  |
| `edit`       | `apply_patch`, `write_file`, `screen_create`, screen removal, flow edge changes |
| `run_script` | `run_agent_script` by manifest name                                             |
| `load_skill` | `load_agent_skill` by skill name                                                |
| `send_pr`    | `send_pr` by branch or fallback                                                 |
| `set_mode`   | `set_mode` by target editor mode                                                |
| `*`          | Fallback for unknown categories                                                 |

Pattern matching supports exact strings, `*`, prefix folders like
`src/generated/**`, and simple `*` wildcards. The longest matching pattern wins.
For multi-file tool calls, `deny` wins over `ask`, and `ask` wins over `allow`.

Permission layers merge in this order:

1. sber-designer defaults;
2. `.agents/config.json.permission`;
3. instruction frontmatter `permission`;
4. agent frontmatter `permission`.

If the user clicks **Always allow this session** on an approval card, the API
remembers the approved `user + workspace + category + pattern` in memory. It is
cleared when the API process restarts and is never written to the project.

## Skills

Add a skill at:

```text
<connected-project>/.agents/skills/my-skill/SKILL.md
```

Use lowercase kebab-case for the folder and frontmatter name:

```md
---
name: my-skill
description: When the agent should load this workflow.
---

# My Skill

Write a focused runbook with concrete tool-call examples.
```

The agent sees only the name and description until it calls
`load_agent_skill`.

## Knowledge

Add focused markdown reference files under:

```text
<connected-project>/.agents/knowledge/
```

Register each file in `config.json.knowledge` with an id, path, and
description. The agent can list and read knowledge through explicit tools.

## Scripts

There are three script locations:

| Location                                                            | Purpose                                           |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `<sber-designer-repo>/packages/agent-kit/kit/scripts/`              | Default manifests shipped with sber-designer      |
| `<connected-project>/.agents/scripts/`                              | Project-specific manifests                        |
| `<connected-project>/package.json`, `scripts/`, `tools/`, CLI paths | Real command implementations invoked by manifests |

Script manifests are inventory entries, not auto-run hooks. The agent can ask
for them through `run_agent_script`. Commands are spawned without a shell, args
are separate, timeouts are required, and default script permission is `ask`.

Keep `.agents/scripts/` small: store `*.agent-script.json` manifests there, not
large shell programs or generated dependency folders.

Example manifest:

```json
{
  "name": "validate-design-context",
  "description": "Check that design-index artifacts are present and readable.",
  "command": "bun",
  "args": ["run", "scripts/validate-design-context.ts"],
  "cwd": "workspace",
  "permission": "ask",
  "timeoutMs": 120000
}
```

## Safe Defaults

- Let `read` and `load_skill` stay `allow` unless your project has a stricter
  policy.
- Keep `edit`, `run_script`, and `send_pr` on `ask` for normal development.
- Use path-based `deny` for secrets, generated dependency folders, and files the
  agent should never touch.
- Prefer project docs and skills over hardcoding project behavior into the
  default sber-designer kit.
