import type { CSSProperties } from 'react';
import { Sparkles } from 'lucide-react';

import {
  CLAUDE_CODE_RUNTIME_PROVIDER_ID,
  CODEX_RUNTIME_PROVIDER_ID,
  GIGACODE_RUNTIME_PROVIDER_ID,
  OPENCODE_RUNTIME_PROVIDER_ID,
} from '@/lib/api/agent-runs';
import { cn } from '@/lib/utils';

const ICON_EXT: Record<string, 'svg' | 'png'> = {
  claude: 'svg',
  codex: 'svg',
  deepseek: 'svg',
  gigachat: 'svg',
  opencode: 'svg',
  openrouter: 'svg',
  zai: 'svg',
};

const MONO_ICONS = new Set(['opencode', 'openrouter']);

const PROVIDER_ICON_ALIASES: Record<string, string> = {
  [CLAUDE_CODE_RUNTIME_PROVIDER_ID]: 'claude',
  [CODEX_RUNTIME_PROVIDER_ID]: 'codex',
  [GIGACODE_RUNTIME_PROVIDER_ID]: 'gigachat',
  [OPENCODE_RUNTIME_PROVIDER_ID]: 'opencode',
  'claude-code': 'claude',
  codex: 'codex',
  deepseek: 'deepseek',
  'giga-code': 'gigachat',
  gigachat: 'gigachat',
  gigacode: 'gigachat',
  gigaide: 'gigachat',
  opencode: 'opencode',
  openrouter: 'openrouter',
  'z-ai': 'zai',
  'z.ai': 'zai',
  zai: 'zai',
};

const GENERIC_API_PROVIDER_IDS = new Set(['custom']);

export function agentIconIdForProvider(providerId: string, label?: string | null): string {
  for (const raw of [providerId, label]) {
    if (!raw) continue;
    const key = normalizeIconKey(raw);
    const alias = PROVIDER_ICON_ALIASES[key] ?? key;
    if (ICON_EXT[alias]) return alias;
    if (GENERIC_API_PROVIDER_IDS.has(alias)) return 'api';
    if (alias.includes('claude')) return 'claude';
    if (alias.includes('codex')) return 'codex';
    if (alias.includes('opencode')) return 'opencode';
  }
  return normalizeIconKey(providerId || label || 'provider');
}

export function AgentProviderIcon({
  providerId,
  label,
  size = 18,
  className,
}: {
  providerId: string;
  label?: string | null;
  size?: number;
  className?: string;
}) {
  const iconId = agentIconIdForProvider(providerId, label);
  const ext = ICON_EXT[iconId];
  const baseClassName = cn('inline-flex shrink-0 items-center justify-center', className);

  if (ext) {
    const src = `/agent-icons/${iconId}.${ext}`;
    if (ext === 'svg' && MONO_ICONS.has(iconId)) {
      const style: CSSProperties = {
        width: size,
        height: size,
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      };
      return (
        <span
          className={cn(baseClassName, 'bg-current text-primary')}
          style={style}
          aria-hidden="true"
        />
      );
    }
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={baseClassName}
        aria-hidden="true"
        draggable={false}
      />
    );
  }

  if (iconId === 'api') {
    return (
      <Sparkles
        className={cn(baseClassName, 'text-primary')}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  const initial = (label || providerId).match(/[a-z0-9]/i)?.[0]?.toUpperCase() ?? '?';
  return (
    <span
      className={cn(
        baseClassName,
        'rounded-sm border border-border bg-muted font-mono font-medium text-muted-foreground',
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.46)) }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

function normalizeIconKey(raw: string): string {
  return raw
    .trim()
    .split(/[\\/]/)
    .pop()!
    .replace(/\.(cmd|exe|bat)$/i, '')
    .replace(/\s+/g, '-')
    .replace(/-cli$/i, '')
    .toLowerCase();
}
