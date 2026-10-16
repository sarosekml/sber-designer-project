import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const generalSettingsPath = 'apps/web/src/components/editor/settings/general.tsx';

test('general settings expose independent accent, surface, and brand mark controls', async () => {
  const source = await readFile(generalSettingsPath, 'utf8');

  expect(source).toContain('Accent color');
  expect(source).toContain('Surface palette');
  expect(source).toContain('Brand mark');
  expect(source).toContain('APP_SURFACES.map');
  expect(source).toContain('APP_BRAND_MARKS.map');
  expect(source).toContain('setSurface(value)');
  expect(source).toContain('setBrandMark(value)');
});

test('general settings name the black/gray surfaces and image/monogram logo modes', async () => {
  const source = await readFile(generalSettingsPath, 'utf8');

  expect(source).toContain('`${APP_SURFACE_LABELS[value]} surface`');
  expect(source).toContain('Accent logo');
  expect(source).toContain('Monogram logo');
});

test('general settings render surface choices as compact swatches like accent choices', async () => {
  const source = await readFile(generalSettingsPath, 'utf8');

  expect(source).toContain('APP_SURFACE_SWATCHES[value]');
  expect(source).toContain('role="group" aria-label="Surface palette"');
  expect(source).toContain(
    'rounded-full border border-border transition-transform hover:scale-105',
  );
  expect(source).not.toContain('SURFACE_DESCRIPTIONS');
});

test('general settings render brand mark choices as real previews', async () => {
  const source = await readFile(generalSettingsPath, 'utf8');

  expect(source).toContain('getBrandLogoSrc');
  expect(source).toContain('BrandMark');
  expect(source).toContain('brandOptionPreview');
  expect(source).toContain('brandOptionPreview(value, accent)');
  expect(source).toContain('src={getBrandLogoSrc(accent)}');
  expect(source).toContain('D monogram');
  expect(source).toContain('<BrandMark className="size-8" />');
});

test('general settings expose the beta DS Browser module toggle', async () => {
  const source = await readFile(generalSettingsPath, 'utf8');

  expect(source).toContain('DS Browser');
  expect(source).toContain('<Badge tone="warn">Beta</Badge>');
  expect(source).toContain('enabled={dsBrowserEnabled}');
  expect(source).toContain('onChange={setDsBrowserEnabled}');
});

test('generative thumbnail persists as a user preference instead of browser-local state', async () => {
  const source = await readFile(generalSettingsPath, 'utf8');

  expect(source).toContain('updateGenerativeThumbnailPreference');
  expect(source).toContain('changeGenerativeThumbnail');
  expect(source).toContain('follows your user profile across sessions');
});
