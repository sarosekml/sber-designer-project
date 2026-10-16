export interface CliHandoffPromptInput {
  cliLabel: string;
  workspacePath: string;
  projectName?: string;
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function buildCliHandoffPrompt({
  cliLabel,
  workspacePath,
  projectName,
}: CliHandoffPromptInput): string {
  const projectLine = projectName?.trim() ? `Project: ${projectName.trim()}\n` : '';
  return `Continue working on this sber-designer project with ${cliLabel}.

${projectLine}Workspace: ${workspacePath}

Start in the connected workspace:

\`\`\`bash
cd ${shellQuote(workspacePath)}
\`\`\`

1. Read the repository instructions first, including AGENTS.md and CLAUDE.md when present.
2. Inspect the current project state and continue the existing screen/design task without discarding user changes.
3. Reuse the project's design system, indexed components, and documented component variants.
4. Verify the relevant typecheck, tests, and build before handing the result back.

If the CLI supports MCP, connect the existing sber-designer project MCP integration described in docs/integrations/connect-claude-code.md.`;
}
