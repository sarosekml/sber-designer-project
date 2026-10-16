import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'bun:test';
import type { ReactElement } from 'react';
import { Sparkles } from 'lucide-react';

import { AgentProviderIcon, agentIconIdForProvider } from './AgentProviderIcon';

describe('agentIconIdForProvider', () => {
  test('maps runtime provider ids to bundled icon ids', () => {
    expect(agentIconIdForProvider('claude-code-runtime', 'Claude Code CLI')).toBe('claude');
    expect(agentIconIdForProvider('codex-runtime', 'Codex CLI')).toBe('codex');
    expect(agentIconIdForProvider('opencode-runtime', 'OpenCode')).toBe('opencode');
  });

  test('falls back to a normalized provider name', () => {
    expect(agentIconIdForProvider('custom-provider', 'Custom Provider')).toBe('custom-provider');
  });

  test('maps configured API providers to branded icons where available', () => {
    expect(agentIconIdForProvider('openrouter', 'OpenRouter')).toBe('openrouter');
    expect(agentIconIdForProvider('gigachat', 'GigaChat')).toBe('gigachat');
    expect(agentIconIdForProvider('gigacode', 'GigaCode')).toBe('gigachat');
    expect(agentIconIdForProvider('unknown', 'GigaCode')).toBe('gigachat');
    expect(agentIconIdForProvider('deepseek', 'DeepSeek')).toBe('deepseek');
    expect(agentIconIdForProvider('zai', 'Z.AI')).toBe('zai');
    expect(agentIconIdForProvider('unknown', 'Z.AI')).toBe('zai');
    expect(agentIconIdForProvider('custom', 'Custom Provider')).toBe('api');
  });
});

describe('AgentProviderIcon', () => {
  test('renders bundled colored icons as images', () => {
    const element = AgentProviderIcon({
      providerId: 'codex-runtime',
      label: 'Codex CLI',
      size: 20,
    }) as ReactElement<{ src?: string; width?: number; height?: number }>;

    expect(element.type).toBe('img');
    expect(element.props.src).toBe('/agent-icons/codex.svg');
    expect(element.props.width).toBe(20);
    expect(element.props.height).toBe(20);
  });

  test('renders mono icons through a CSS mask', () => {
    const element = AgentProviderIcon({
      providerId: 'opencode-runtime',
      label: 'OpenCode',
      size: 18,
    }) as ReactElement<{ style?: Record<string, string | number> }>;

    expect(element.type).toBe('span');
    expect(element.props.style?.maskImage).toBe('url("/agent-icons/opencode.svg")');
    expect(element.props.style?.width).toBe(18);
  });

  test('renders branded API provider icons', () => {
    const element = AgentProviderIcon({
      providerId: 'deepseek',
      label: 'DeepSeek',
      size: 18,
    }) as ReactElement<{ src?: string }>;

    expect(element.type).toBe('img');
    expect(element.props.src).toBe('/agent-icons/deepseek.svg');
  });

  test('renders the bundled GigaCode logo as a colored image', async () => {
    const element = AgentProviderIcon({
      providerId: 'gigachat',
      label: 'GigaCode',
      size: 18,
    }) as ReactElement<{ src?: string }>;

    expect(element.type).toBe('img');
    expect(element.props.src).toBe('/agent-icons/gigachat.svg');

    const logo = await readFile('apps/web/public/agent-icons/gigachat.svg', 'utf8');
    expect(logo).toContain('viewBox="0 0 61 61"');
    expect(logo).toContain('paint0_linear');
  });

  test('renders the bundled Z.AI logo asset', async () => {
    const element = AgentProviderIcon({
      providerId: 'zai',
      label: 'Z.AI',
      size: 18,
    }) as ReactElement<{ src?: string }>;

    expect(element.type).toBe('img');
    expect(element.props.src).toBe('/agent-icons/zai.svg');

    const logo = await readFile('apps/web/public/agent-icons/zai.svg', 'utf8');
    expect(logo).toContain('aria-label="Z.AI logo"');
    expect(logo).toContain('viewBox="0 0 30 30"');
  });

  test('renders generic API provider icon for custom providers', () => {
    const element = AgentProviderIcon({
      providerId: 'custom',
      label: 'Custom Provider',
      size: 18,
    }) as ReactElement<{ className?: string }>;

    expect(element.type).toBe(Sparkles);
    expect(element.props.className).toContain('text-primary');
  });
});
