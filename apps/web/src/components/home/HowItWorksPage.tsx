import { Children, isValidElement, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, ChevronDown, FileText, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import howItWorksMetadata from 'virtual:sber-designer/how-it-works-metadata';

import { cn } from '@/lib/utils';
import {
  documentationRoute,
  parseHowItWorksDocument,
  type HowItWorksMetadata,
} from '@/lib/how-it-works-metadata';

interface HowItWorksDocument extends HowItWorksMetadata {
  content: string;
}

interface HowItWorksGroup {
  label: string;
  documents: HowItWorksDocument[];
}

const RAW_HOW_IT_WORKS_DOCUMENTS = import.meta.glob('../../../../../docs/how-it-works/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

const GROUP_DEFINITIONS = [
  {
    label: 'Start here',
    slugs: [
      'overview',
      'system-overview',
      'project-requirements',
      'project-workspace-modes',
      'project-state-and-persistence',
      'code-map',
      'local-mvp-smoke',
    ],
  },
  {
    label: 'Workspace and canvas',
    slugs: [
      'html-first-projects',
      'indexing-project',
      'screens-panel-and-screen-creation',
      'screen-templates',
      'canvas-and-sandbox',
      'canvas-mark',
      'flow-mode',
      'design-mode',
      'code-mode',
      'storybook-mode-and-catalog',
      'describe-components-for-ai',
      'design-system-browser',
    ],
  },
  {
    label: 'Assistant and delivery',
    slugs: [
      'assistant-panel-and-tasks',
      'chat-session-modes',
      'chat-mode-ask',
      'chat-mode-plan',
      'chat-mode-design',
      'agent-system',
      'agent-quality-harness',
      'dual-profile-harness',
      'generation-pipeline',
      'screen-readiness-post-checks',
      'llm-providers-and-runtimes',
      'mcp-and-integrations',
      'assets-and-attachments',
      'git-and-pr-workflow',
      'run-records-and-diagnostics',
    ],
  },
] as const;

const RAW_DOCUMENTS_BY_FILE_NAME = new Map(
  Object.entries(RAW_HOW_IT_WORKS_DOCUMENTS).map(([path, content]) => [
    path.split('/').at(-1) ?? path,
    content,
  ]),
);

export const HOW_IT_WORKS_DOCUMENTS = howItWorksMetadata
  .map((metadata): HowItWorksDocument => {
    const source = RAW_DOCUMENTS_BY_FILE_NAME.get(metadata.fileName);
    if (source === undefined) {
      throw new Error(`Missing bundled How it works source for ${metadata.fileName}.`);
    }
    return {
      ...metadata,
      content: parseHowItWorksDocument(source, metadata.fileName).body,
    };
  })
  .sort((left, right) => {
    if (left.slug === 'overview') return -1;
    if (right.slug === 'overview') return 1;
    return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
  });

const DOCUMENT_SLUGS = new Set(HOW_IT_WORKS_DOCUMENTS.map((document) => document.slug));

export function HowItWorksPage({ slug }: { slug: string | null }) {
  const [query, setQuery] = useState('');
  const activeSlug = slug || 'overview';
  const activeDocument =
    HOW_IT_WORKS_DOCUMENTS.find((document) => document.slug === activeSlug) ?? null;
  const groups = useMemo(() => groupDocuments(HOW_IT_WORKS_DOCUMENTS, query), [query]);

  return (
    <main className="min-h-full bg-background text-foreground lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-[calc(100dvh-3rem)] min-h-0 overflow-y-auto border-r border-border bg-sidebar lg:block">
        <DocumentationNavigation
          groups={groups}
          activeSlug={activeSlug}
          query={query}
          onQueryChange={setQuery}
        />
      </aside>

      <section className="min-w-0">
        <details className="group border-b border-border bg-card lg:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <BookOpen className="size-4 text-primary" />
            <span className="min-w-0 flex-1 truncate">
              {activeDocument?.title ?? 'How it works'}
            </span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="max-h-[60vh] overflow-y-auto border-t border-border">
            <DocumentationNavigation
              groups={groups}
              activeSlug={activeSlug}
              query={query}
              onQueryChange={setQuery}
              compact
            />
          </div>
        </details>

        {activeDocument ? (
          <DocumentationArticle document={activeDocument} />
        ) : (
          <DocumentationNotFound slug={activeSlug} />
        )}
      </section>
    </main>
  );
}

function DocumentationNavigation({
  groups,
  activeSlug,
  query,
  onQueryChange,
  compact = false,
}: {
  groups: HowItWorksGroup[];
  activeSlug: string;
  query: string;
  onQueryChange: (query: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn('grid gap-4 p-3', !compact && 'pb-8')}>
      {!compact && (
        <div className="flex min-w-0 items-center gap-2 px-1 pt-1">
          <BookOpen className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">How it works</h1>
            <p className="text-[11px] text-muted-foreground">
              Product documentation · {HOW_IT_WORKS_DOCUMENTS.length} pages
            </p>
          </div>
        </div>
      )}

      <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs focus-within:ring-1 focus-within:ring-ring">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="sr-only">Filter documentation</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter pages"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>

      <nav aria-label="How it works pages" className="grid gap-4">
        {groups.map((group) => (
          <section key={group.label} className="grid gap-1">
            <h2 className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {group.label}
            </h2>
            {group.documents.map((document) => {
              const active = document.slug === activeSlug;
              return (
                <a
                  key={document.slug}
                  href={documentationRoute(document.slug)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
                    active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
                  )}
                >
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 leading-4">{document.title}</span>
                </a>
              );
            })}
          </section>
        ))}
        {groups.length === 0 && (
          <p className="rounded-md border border-border bg-card px-3 py-4 text-center text-xs text-muted-foreground">
            No documentation pages match “{query.trim()}”.
          </p>
        )}
      </nav>
    </div>
  );
}

function DocumentationArticle({ document }: { document: HowItWorksDocument }) {
  return (
    <article className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4 text-xs text-muted-foreground">
        <span>How it works</span>
        <span className="font-mono text-[11px]">docs/how-it-works/{document.fileName}</span>
      </div>
      <DocumentationMarkdown content={document.content} />
    </article>
  );
}

function DocumentationMarkdown({ content }: { content: string }) {
  return (
    <div className="min-w-0 break-words text-[15px] leading-7 text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              id={headingId(children)}
              className="mb-5 scroll-mt-6 text-3xl font-semibold leading-tight tracking-tight"
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              id={headingId(children)}
              className="mb-3 mt-10 scroll-mt-6 border-b border-border pb-2 text-xl font-semibold tracking-tight"
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 id={headingId(children)} className="mb-2 mt-7 scroll-mt-6 text-base font-semibold">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 id={headingId(children)} className="mb-2 mt-6 scroll-mt-6 font-semibold">
              {children}
            </h4>
          ),
          p: ({ children }) => <p className="my-4">{children}</p>,
          ul: ({ children }) => <ul className="my-4 ml-6 list-disc space-y-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-4 ml-6 list-decimal space-y-1.5">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => <DocumentationLink href={href}>{children}</DocumentationLink>,
          blockquote: ({ children }) => (
            <blockquote className="my-5 border-l-2 border-primary/60 bg-muted/35 px-4 py-1 text-muted-foreground">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="my-5 overflow-x-auto rounded-lg border border-border bg-card p-4 text-[13px] leading-6 shadow-sm">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const block = /\blanguage-/u.test(className ?? '');
            return block ? (
              <code className={cn('font-mono', className)} {...props}>
                {children}
              </code>
            ) : (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.88em]" {...props}>
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-r border-border px-3 py-2 font-semibold last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-r border-border px-3 py-2 align-top last:border-r-0">
              {children}
            </td>
          ),
          hr: () => <hr className="my-8 border-border" />,
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt ?? ''}
              loading="lazy"
              className="my-5 h-auto max-w-full rounded-lg border border-border"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function DocumentationLink({ href, children }: { href: string | undefined; children: ReactNode }) {
  const resolved = resolveDocumentationHref(href);
  if (!resolved) {
    return (
      <span
        className="text-muted-foreground underline decoration-dotted underline-offset-4"
        title="This source link points outside the in-app How it works library"
      >
        {children}
      </span>
    );
  }
  if (resolved.external) {
    return (
      <a
        href={resolved.href}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-primary underline underline-offset-4"
      >
        {children}
      </a>
    );
  }
  return (
    <a href={resolved.href} className="font-medium text-primary underline underline-offset-4">
      {children}
    </a>
  );
}

function DocumentationNotFound({ slug }: { slug: string }) {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-xl place-content-center gap-3 px-6 text-center">
      <FileText className="mx-auto size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Documentation page not found</h1>
      <p className="text-sm text-muted-foreground">
        There is no markdown file for “{slug}” in docs/how-it-works.
      </p>
      <a
        href="/how-it-works"
        className="mx-auto rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        Open overview
      </a>
    </div>
  );
}

function groupDocuments(documents: HowItWorksDocument[], query: string): HowItWorksGroup[] {
  const needle = query.trim().toLocaleLowerCase();
  const visible = needle
    ? documents.filter(
        (document) =>
          document.title.toLocaleLowerCase().includes(needle) ||
          document.fileName.toLocaleLowerCase().includes(needle),
      )
    : documents;
  const visibleBySlug = new Map(visible.map((document) => [document.slug, document]));
  const used = new Set<string>();
  const groups: HowItWorksGroup[] = GROUP_DEFINITIONS.map((definition) => {
    const groupedDocuments = definition.slugs
      .map((slug) => visibleBySlug.get(slug))
      .filter((document): document is HowItWorksDocument => Boolean(document));
    groupedDocuments.forEach((document) => used.add(document.slug));
    return { label: definition.label, documents: groupedDocuments };
  }).filter((group) => group.documents.length > 0);
  const remaining = visible.filter((document) => !used.has(document.slug));
  if (remaining.length > 0) groups.push({ label: 'More', documents: remaining });
  return groups;
}

function resolveDocumentationHref(
  href: string | undefined,
): { href: string; external: boolean } | null {
  if (!href) return null;
  if (/^(?:https?:|mailto:)/u.test(href)) return { href, external: true };
  if (href.startsWith('#')) return { href, external: false };
  if (href.startsWith('/')) return { href, external: false };

  const [path, hash] = splitOnce(href, '#');
  const fileName = path.split('/').at(-1) ?? '';
  if (!fileName.endsWith('.md')) return null;
  const slug = fileName === 'README.md' ? 'overview' : fileName.replace(/\.md$/u, '');
  if (!DOCUMENT_SLUGS.has(slug)) return null;
  return {
    href: `${documentationRoute(slug)}${hash ? `#${hash}` : ''}`,
    external: false,
  };
}

function headingId(children: ReactNode): string {
  return reactNodeText(children)
    .toLocaleLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/gu, '-')
    .replace(/-+/gu, '-');
}

function reactNodeText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (isValidElement<{ children?: ReactNode }>(child))
        return reactNodeText(child.props.children);
      return '';
    })
    .join('');
}

function splitOnce(value: string, separator: string): [string, string] {
  const index = value.indexOf(separator);
  return index < 0 ? [value, ''] : [value.slice(0, index), value.slice(index + separator.length)];
}
