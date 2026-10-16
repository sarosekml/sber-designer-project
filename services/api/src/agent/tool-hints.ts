export function unknownToolDetail(toolName: string, availableToolNames: Iterable<string>): string {
  const base = `No tool named "${toolName}"`;
  const hint = unknownMcpToolHint(toolName, [...availableToolNames]);
  return hint ? `${base}. ${hint}` : base;
}

function unknownMcpToolHint(toolName: string, availableToolNames: string[]): string | undefined {
  if (!looksLikeMcpToolName(toolName)) return undefined;
  const relaxedToolName = relaxToolName(toolName);
  const exactRelaxedMatch = availableToolNames.find(
    (available) => relaxToolName(available) === relaxedToolName,
  );
  if (exactRelaxedMatch) {
    return `Did you mean "${exactRelaxedMatch}"? Use exact MCP tool names from the current inventory.`;
  }
  if (availableToolNames.includes('list_product_mcp_tools')) {
    return 'Use "list_product_mcp_tools" before guessing MCP tool names. MCP namespaces normalize dashes to underscores.';
  }
  return 'Use exact MCP tool names from the current inventory. MCP namespaces normalize dashes to underscores.';
}

function looksLikeMcpToolName(toolName: string): boolean {
  const lower = toolName.toLocaleLowerCase();
  return (
    lower.startsWith('mcp__') ||
    lower.includes('mcp') ||
    lower.includes('pixso') ||
    lower.includes('figma')
  );
}

function relaxToolName(toolName: string): string {
  return toolName
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .replace(/_+/gu, '_');
}
