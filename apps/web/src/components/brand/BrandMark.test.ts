import { expect, test } from 'bun:test';
import { access, readFile } from 'node:fs/promises';

const brandMarkPath = 'apps/web/src/components/brand/BrandMark.tsx';
const brandLogoAssets = [
  'blue',
  'indigo',
  'neutral',
  'violet',
  'rose',
  'orange',
  'green',
  'yellow',
].map((accent) => `apps/web/public/brand/sd-logo-${accent}-512.webp`);

test('brand mark exposes the Script D monogram, accent image sources, and wordmark', async () => {
  const source = await readFile(brandMarkPath, 'utf8');

  expect(source).toContain("export const BRAND_WORDMARK = 'Sber Designer'");
  expect(source).toContain("export const BRAND_MONOGRAM = 'D'");
  expect(source).toContain('BRAND_LOGO_BY_ACCENT');
  expect(source).toContain("blue: '/brand/sd-logo-blue-512.webp'");
  expect(source).toContain("neutral: '/brand/sd-logo-neutral-512.webp'");
  expect(source).toContain('export const BRAND_LOGO_SRC = BRAND_LOGO_BY_ACCENT.blue');
  expect(source).toContain('bg-primary');
  expect(source).toContain('text-primary-foreground');
  expect(source).toContain('sd-design-display-script');
  expect(source).toContain('text-lg');
  expect(source).toContain('font-normal');
});

test('brand logo can render either the accent-matched image or accent-aware monogram', async () => {
  const source = await readFile(brandMarkPath, 'utf8');

  expect(source).toContain('export function BrandLogo');
  expect(source).toContain('useThemeStore((s) => s.brandMark)');
  expect(source).toContain('useThemeStore((s) => s.accent)');
  expect(source).toContain("brandMark === 'image'");
  expect(source).toContain('<img');
  expect(source).toContain('max-w-none');
  expect(source).toContain('src={getBrandLogoSrc(accent)}');
  expect(source).toContain('<BrandMark className={className} />');
});

test('shared home link keeps the logo on the 32px shell and rail axis', async () => {
  const source = await readFile(brandMarkPath, 'utf8');

  expect(source).toContain('export function BrandHomeLink');
  expect(source).toContain(
    'className="-ml-1.5 grid size-11 shrink-0 place-items-center rounded-md',
  );
  expect(source).toContain('<BrandLogo className="size-8" />');
});

test('accent logo assets are bundled for every accent option', async () => {
  for (const asset of brandLogoAssets) {
    await access(asset);
  }
});
