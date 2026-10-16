---
name: git-pr-workflow
description: Prepare branch, commit, push, or PR actions through sber-designer's scoped Git workflow.
compatibility: sber-designer
---

# Git PR Workflow

Use this skill only when the user asks to send changes for review or Auto mode
is configured to create PRs.

See `docs/backlog/0013-git-branch-pr-lifecycle.md` for the full branch and PR
lifecycle.

## Load first

Call `read_agent_knowledge` for these ids when they are relevant before
following the runbook:

- `sber-designer-architecture`

## When to use vs when to defer

Use this skill when:

- The user asks to commit, push, open a PR, or "send for review".
- Auto mode has completed the requested implementation and is configured to
  create PRs.
- Work is complete and the remaining task is delivery through the scoped
  sber-designer Git workflow.

Defer to another skill when:

- Code, screen, component, or design changes are still pending.
- The user only asks for a plan or review and does not want Git mutation yet.
- The connected workspace has unresolved blockers that should be reported
  before delivery.

Anti-examples:

- Do not call `send_pr` before the requested edits and verification are done.
- Do not commit unrelated workspace files that the agent did not touch.

## Runbook

1. Use normal edit tools before Git tools.
2. Keep commits scoped to paths the agent changed.
3. Verify the requested behavior with the narrowest relevant tests and checks.
4. Use `send_pr` only after the requested work is complete.
5. If the GitHub CLI is unavailable, report the pushed branch and PR blocker.
6. Mention commit, branch, PR URL, or push-only result in the final response.

## Tool call examples

Create a normal PR after verified work:

```jsonc
{
  "tool": "send_pr",
  "input": {
    "title": "Add payment approvals screen",
    "body": "Summary:\n- Added the payment approvals screen\n- Reused indexed table and badge components\n\nVerification:\n- bun test tests/agent-kit-*.test.ts",
    "branch": "sd/payment-approvals",
    "baseBranch": "main",
    "pushOnly": false,
  },
}
```

Push a branch without opening a PR:

```jsonc
{
  "tool": "send_pr",
  "input": {
    "title": "Prepare design index fixtures",
    "body": "Push-only handoff for review.",
    "branch": "sd/design-index-fixtures",
    "pushOnly": true,
  },
}
```
