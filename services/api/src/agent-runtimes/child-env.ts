import { processEnvironment } from '@sber-designer/shared-types';

// CLI providers use these credentials/settings themselves. API auth, OIDC,
// controller tokens and arbitrary service secrets never pass implicitly.
const RUNTIME_ENV = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CONFIG_DIR',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_ORG_ID',
  'CODEX_HOME',
  'OPENROUTER_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'OPENCODE_CONFIG',
  'OPENCODE_CONFIG_CONTENT',
  'OPENCODE_CONFIG_DIR',
  'KIMI_API_KEY',
  'KIMI_BASE_URL',
  'MOONSHOT_API_KEY',
  'GIGACODE_HOME',
  'GIGACODE_API_KEY',
  'GIGACODE_BASE_URL',
] as const;

export function buildRuntimeChildEnv(
  parent: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  const passthrough = (parent.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH ?? '')
    .split(/[,\n]/u)
    .map((key) => key.trim())
    .filter(Boolean);
  return { ...processEnvironment(parent, [...RUNTIME_ENV, ...passthrough]), ...overrides };
}
