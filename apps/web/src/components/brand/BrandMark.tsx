import { cn } from '@/lib/utils';
import type { AppAccent } from '@/lib/theme';
import { useThemeStore } from '@/stores/theme-store';

export const BRAND_WORDMARK = 'Sber Designer';
export const BRAND_MONOGRAM = 'D';
export const BRAND_LOGO_BY_ACCENT: Record<AppAccent, string> = {
  blue: '/brand/sd-logo-blue-512.webp',
  indigo: '/brand/sd-logo-indigo-512.webp',
  neutral: '/brand/sd-logo-neutral-512.webp',
  violet: '/brand/sd-logo-violet-512.webp',
  rose: '/brand/sd-logo-rose-512.webp',
  orange: '/brand/sd-logo-orange-512.webp',
  green: '/brand/sd-logo-green-512.webp',
  yellow: '/brand/sd-logo-yellow-512.webp',
};
export const BRAND_LOGO_SRC = BRAND_LOGO_BY_ACCENT.blue;

export function getBrandLogoSrc(accent: AppAccent): string {
  return BRAND_LOGO_BY_ACCENT[accent];
}

interface BrandMarkProps {
  className?: string | undefined;
}

interface BrandHomeLinkProps {
  title?: string | undefined;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'sd-design-display-script inline-flex shrink-0 select-none items-center justify-center rounded-[6px] bg-primary text-lg font-normal leading-none text-primary-foreground',
        className,
      )}
    >
      {BRAND_MONOGRAM}
    </span>
  );
}

export function BrandLogo({ className }: BrandMarkProps) {
  const brandMark = useThemeStore((s) => s.brandMark);
  const accent = useThemeStore((s) => s.accent);

  if (brandMark === 'image') {
    return (
      <img
        aria-hidden="true"
        alt=""
        draggable={false}
        src={getBrandLogoSrc(accent)}
        className={cn(
          'inline-block max-w-none shrink-0 select-none rounded-[5px] object-cover',
          className,
        )}
      />
    );
  }

  return <BrandMark className={className} />;
}

export function BrandHomeLink({ title = 'Sber Designer home' }: BrandHomeLinkProps) {
  return (
    <a
      href="/"
      aria-label="Sber Designer home"
      title={title}
      className="-ml-1.5 grid size-11 shrink-0 place-items-center rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <BrandLogo className="size-8" />
    </a>
  );
}
