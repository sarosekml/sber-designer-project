/**
 * Settings → About: product name, version, build time, commit and author from
 * GET /api/version, plus the license, third-party notices and the bundled
 * How it works docs. When the build marker is missing the panel says so and
 * names the command that writes it, instead of rendering blanks.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, FileText, Loader2, RefreshCw, Scale } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import type { BuildInfo } from '@/lib/api/version';
import { displayVersion, formatBuildTime, productNameOf, shortGitSha } from '@/lib/build-info';
import { useBuildInfoStore, type BuildInfoStatus } from '@/stores/build-info-store';

type LegalDocumentId = 'license' | 'notices';

const LEGAL_DOCUMENTS: { id: LegalDocumentId; label: string; fileName: string }[] = [
  { id: 'license', label: 'License', fileName: 'LICENSE' },
  { id: 'notices', label: 'Third-party notices', fileName: 'THIRD_PARTY_NOTICES.md' },
];

// Lazy raw imports keep the legal texts out of the Settings chunk until asked for.
const LEGAL_DOCUMENT_LOADERS: Record<LegalDocumentId, () => Promise<{ default: string }>> = {
  license: () => import('../../../../../../LICENSE?raw'),
  notices: () => import('../../../../../../THIRD_PARTY_NOTICES.md?raw'),
};

export function AboutSettingsPanel() {
  const status = useBuildInfoStore((s) => s.status);
  const info = useBuildInfoStore((s) => s.info);
  const detail = useBuildInfoStore((s) => s.detail);
  const load = useBuildInfoStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AboutSettingsContent
      status={status}
      info={info}
      detail={detail}
      onRetry={() => void load({ force: true })}
    />
  );
}

export function AboutSettingsContent({
  status,
  info,
  detail,
  onRetry,
}: {
  status: BuildInfoStatus;
  info: BuildInfo | null;
  detail: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <div className="rounded-md border border-border bg-card p-4">
        {status === 'ready' && info ? (
          <BuildDetails info={info} />
        ) : status === 'idle' || status === 'loading' ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading build metadata…
          </div>
        ) : (
          <div role="status" className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {status === 'unavailable'
                    ? 'Build metadata unavailable'
                    : 'Could not reach the API for build metadata'}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {status === 'unavailable' ? (
                    <>
                      Run <code className="font-mono">bun run build:info</code> in the sber-designer
                      checkout and restart the API.
                    </>
                  ) : (
                    detail
                  )}
                </p>
              </div>
            </div>
            {onRetry ? (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw />
                Retry
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="text-sm font-medium">Documentation and legal</div>
        <p className="mt-1 text-xs text-muted-foreground">
          How the product works, its license, and attribution for bundled open-source code.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/how-it-works"
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <BookOpen />
            How it works
          </a>
        </div>
        <div className="mt-3 grid gap-2">
          {LEGAL_DOCUMENTS.map((document) => (
            <LegalDocument
              key={document.id}
              id={document.id}
              label={document.label}
              fileName={document.fileName}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BuildDetails({ info }: { info: BuildInfo }) {
  const rows: { label: string; value: string; mono?: boolean; title?: string }[] = [
    { label: 'Product', value: productNameOf(info) },
    { label: 'Version', value: displayVersion(info.version), mono: true },
    { label: 'Built', value: formatBuildTime(info.buildTime), title: info.buildTime },
    { label: 'Commit', value: shortGitSha(info.gitSha), mono: true, title: info.gitSha },
    { label: 'Author', value: info.author ?? 'Not specified' },
  ];
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className={row.mono ? 'truncate font-mono' : 'truncate'} title={row.title}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function LegalDocument({
  id,
  label,
  fileName,
}: {
  id: LegalDocumentId;
  label: string;
  fileName: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadText = () => {
    if (text !== null) return;
    LEGAL_DOCUMENT_LOADERS[id]()
      .then((module) => setText(module.default))
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : String(loadError)),
      );
  };

  return (
    <details
      className="rounded-md border border-border bg-background"
      onToggle={(event) => {
        if (event.currentTarget.open) loadText();
      }}
    >
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
        {id === 'license' ? (
          <Scale className="size-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
        {label}
        <span className="font-mono text-xs text-muted-foreground">{fileName}</span>
      </summary>
      <div className="border-t border-border px-3 py-2">
        {error ? (
          <p className="text-xs text-destructive">
            Could not load {fileName}: {error}
          </p>
        ) : text === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
            {text}
          </pre>
        )}
      </div>
    </details>
  );
}
