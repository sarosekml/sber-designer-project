import type { ReactNode } from 'react';

type LayoutGap = 'none' | 'sm' | 'md';
type CardGridMode = 'default' | 'single' | 'auto';

function classes(...items: (string | false | null | undefined)[]) {
  return items.filter(Boolean).join(' ');
}

function gapClass(gap: LayoutGap) {
  if (gap === 'sm') return 'page-gap-sm';
  if (gap === 'md') return 'page-gap-md';
  return '';
}

export function PageStack({
  children,
  gap = 'none',
  className = '',
}: {
  children: ReactNode;
  gap?: LayoutGap;
  className?: string;
}) {
  return <div className={classes('demo-section-stack', gapClass(gap), className)}>{children}</div>;
}

export function PageBlock({
  children,
  gap = 'none',
  className = '',
}: {
  children: ReactNode;
  gap?: LayoutGap;
  className?: string;
}) {
  return <div className={classes(gapClass(gap), className)}>{children}</div>;
}

export function CardGrid({
  children,
  gap = 'none',
  mode = 'default',
  className = '',
}: {
  children: ReactNode;
  gap?: LayoutGap;
  mode?: CardGridMode;
  className?: string;
}) {
  return (
    <div
      className={classes(
        'demo-card-grid',
        mode === 'single' && 'demo-card-grid-single',
        mode === 'auto' && 'demo-card-grid-auto',
        gapClass(gap),
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ContentGrid({
  children,
  gap = 'none',
  className = '',
}: {
  children: ReactNode;
  gap?: LayoutGap;
  className?: string;
}) {
  return <div className={classes('demo-content-grid', gapClass(gap), className)}>{children}</div>;
}

export function SplitLayout({
  children,
  gap = 'none',
  className = '',
}: {
  children: ReactNode;
  gap?: LayoutGap;
  className?: string;
}) {
  return <div className={classes('split-layout', gapClass(gap), className)}>{children}</div>;
}

export function TwoColumnLayout({
  children,
  gap = 'none',
  className = '',
}: {
  children: ReactNode;
  gap?: LayoutGap;
  className?: string;
}) {
  return <div className={classes('demo-two-col', gapClass(gap), className)}>{children}</div>;
}

export function ThreeColumnGrid({
  children,
  gap = 'none',
  className = '',
}: {
  children: ReactNode;
  gap?: LayoutGap;
  className?: string;
}) {
  return <div className={classes('business-three-grid', gapClass(gap), className)}>{children}</div>;
}

export function FilterPanel({
  children,
  gap = 'none',
}: {
  children: ReactNode;
  gap?: LayoutGap;
}) {
  return <div className={classes('table-workspace', gapClass(gap))}>{children}</div>;
}
