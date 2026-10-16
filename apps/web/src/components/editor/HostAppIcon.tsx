import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { Braces, Code2, FileCode2, FolderOpen, Sparkles, SquareTerminal } from 'lucide-react';

import type { HostApp } from '@sber-designer/shared-types';
import { cn } from '@/lib/utils';

const HOST_APP_ICONS: Partial<Record<HostApp['id'], ComponentType<LucideProps>>> = {
  cursor: Code2,
  vscode: Braces,
  windsurf: Code2,
  zed: FileCode2,
  qoder: Sparkles,
  antigravity: Sparkles,
  webstorm: FileCode2,
  idea: FileCode2,
  xcode: FileCode2,
};

export function HostAppIcon({
  app,
  className,
}: {
  app: Pick<HostApp, 'id' | 'kind'>;
  className?: string;
}) {
  const Icon =
    HOST_APP_ICONS[app.id] ??
    (app.kind === 'terminal'
      ? SquareTerminal
      : app.kind === 'file-manager'
        ? FolderOpen
        : FileCode2);
  return <Icon className={cn('size-4', className)} aria-hidden="true" />;
}
