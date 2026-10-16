import { ArrowRight, BookOpen, Clock3, FileText } from 'lucide-react';
import howItWorksDocuments from 'virtual:sber-designer/how-it-works-metadata';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { selectRecentlyUpdatedDocuments } from '@/lib/how-it-works-metadata';

const RECENT_DOCUMENTS = selectRecentlyUpdatedDocuments(howItWorksDocuments);

export function RecentDocumentationPanel() {
  if (RECENT_DOCUMENTS.length === 0) return null;

  return (
    <section className="grid gap-3" aria-labelledby="recent-documentation-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="recent-documentation-heading" className="text-sm font-semibold">
            Recently updated
          </h2>
        </div>
        <a
          href="/how-it-works"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0')}
        >
          View all
          <ArrowRight aria-hidden="true" />
        </a>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RECENT_DOCUMENTS.map((document) => (
          <article key={document.slug} className="min-w-0">
            <a
              href={document.route}
              className="group block h-full overflow-hidden rounded-lg border border-border bg-card outline-none transition-colors hover:border-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden border-b border-border bg-muted/25">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-muted/50" />
                <div className="relative grid w-3/4 gap-2 rounded-lg border border-border/80 bg-background/90 p-4 shadow-lg shadow-black/10 transition-transform duration-200 group-hover:-translate-y-0.5">
                  <div className="flex items-center gap-2 text-primary">
                    <FileText className="size-4" aria-hidden="true" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em]">
                      How it works
                    </span>
                  </div>
                  <div className="h-2 w-4/5 rounded-full bg-foreground/15" />
                  <div className="h-2 w-full rounded-full bg-foreground/10" />
                  <div className="h-2 w-2/3 rounded-full bg-foreground/10" />
                </div>
              </div>

              <div className="grid gap-3 p-4">
                <div className="grid gap-1.5">
                  <h3 className="line-clamp-2 text-base font-semibold leading-5">
                    {document.title}
                  </h3>
                  <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                    {document.excerpt}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  <time dateTime={document.updated}>
                    Updated {formatUpdatedAt(document.updated)}
                  </time>
                </div>
              </div>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatUpdatedAt(updated: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(updated));
}
