import { expect, test } from 'bun:test';

import { buildCliHandoffPrompt, shellQuote } from './handoff-cli-prompt';

test('shell quoting keeps spaces, metacharacters and single quotes inert', () => {
  expect(shellQuote("/Work Dev/client's project & notes")).toBe(
    `'/Work Dev/client'"'"'s project & notes'`,
  );
});

test('CLI handoff prompt carries the workspace and project-safe continuation contract', () => {
  const prompt = buildCliHandoffPrompt({
    cliLabel: 'Codex CLI',
    workspacePath: "/Work Dev/client's project & notes",
    projectName: 'Payments',
  });

  expect(prompt).toContain('Project: Payments');
  expect(prompt).toContain("Workspace: /Work Dev/client's project & notes");
  expect(prompt).toContain(`cd '/Work Dev/client'"'"'s project & notes'`);
  expect(prompt).toContain('AGENTS.md and CLAUDE.md');
  expect(prompt).toContain('indexed components');
  expect(prompt).toContain('docs/integrations/connect-claude-code.md');
});
