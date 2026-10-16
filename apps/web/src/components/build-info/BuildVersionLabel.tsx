/**
 * Compact version label for always-visible chrome (editor status bar, Home
 * footer). The full build summary lives in its tooltip; Settings → About has
 * the detailed view.
 */
import { useEffect } from 'react';

import type { BuildInfo } from '@/lib/api/version';
import { buildInfoSummary, displayVersion, productNameOf } from '@/lib/build-info';
import { cn } from '@/lib/utils';
import { useBuildInfoStore, type BuildInfoStatus } from '@/stores/build-info-store';

export function BuildVersionLabel({
  className,
  withProductName = false,
}: {
  className?: string;
  withProductName?: boolean;
}) {
  const status = useBuildInfoStore((s) => s.status);
  const info = useBuildInfoStore((s) => s.info);
  const load = useBuildInfoStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <BuildVersionText
      status={status}
      info={info}
      className={className}
      withProductName={withProductName}
    />
  );
}

export function BuildVersionText({
  status,
  info,
  className,
  withProductName = false,
}: {
  status: BuildInfoStatus;
  info: BuildInfo | null;
  className?: string | undefined;
  withProductName?: boolean;
}) {
  if (status === 'ready' && info) {
    const version = displayVersion(info.version);
    return (
      <span className={cn('truncate', className)} title={buildInfoSummary(info)}>
        {withProductName ? `${productNameOf(info)} ${version}` : version}
      </span>
    );
  }
  if (status === 'unavailable') {
    return (
      <span
        className={cn('truncate', className)}
        title="Build metadata unavailable — run `bun run build:info`"
      >
        version unknown
      </span>
    );
  }
  return null;
}
