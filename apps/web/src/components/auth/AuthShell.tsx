import type { ReactNode } from 'react';

import { BRAND_WORDMARK, BrandLogo } from '@/components/brand/BrandMark';

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="grid min-h-full place-items-center bg-background px-4 py-10 text-foreground">
      <div className="grid w-full max-w-[420px] gap-5">
        <a
          href="/"
          className="mx-auto flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${BRAND_WORDMARK} home`}
        >
          <BrandLogo className="size-9" />
          <span className="text-base font-semibold tracking-tight">{BRAND_WORDMARK}</span>
        </a>

        <section className="rounded-xl border border-border bg-card p-6 shadow-2xl shadow-black/20">
          <header className="mb-6 grid gap-1.5 text-center">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm leading-5 text-muted-foreground">{description}</p>
          </header>
          {children}
          {footer ? <footer className="mt-6 text-center text-sm">{footer}</footer> : null}
        </section>
      </div>
    </main>
  );
}
