/**
 * 0083 D3 — render assistant chat prose as Markdown.
 *
 * The agent replies with `**bold**`, lists, and fenced code; before this they
 * showed as raw text. We render with react-markdown + remark-gfm (GitHub-flavored
 * markdown) and a constrained element set. Raw HTML is intentionally NOT enabled
 * (no rehype-raw), so assistant/bridge output cannot inject markup.
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="min-w-0 break-words text-sm leading-relaxed [&_:first-child]:mt-0 [&_:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2">{children}</p>,
          ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          h1: ({ children }) => <h1 className="mb-1 mt-3 text-sm font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-1 mt-3 text-sm font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-2 text-xs font-semibold">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-md border border-border bg-muted/50 p-2 text-xs">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = /\blanguage-/.test(className ?? '');
            return isBlock ? (
              <code className={cn('font-mono', className)} {...props}>
                {children}
              </code>
            ) : (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props}>
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
