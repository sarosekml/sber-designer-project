/**
 * Local, offline contract for the canonical Google DESIGN.md shape.
 *
 * Source format: https://github.com/google-labs-code/design.md
 * License: Apache-2.0. We keep only the public spec constants here; the
 * actual validation wrapper lives in design-context.ts so sber-designer
 * works in air-gapped installs without shelling out or downloading npm
 * packages at runtime.
 */
export const GOOGLE_DESIGN_MD_SPEC_VERSION = 'alpha';

/**
 * Checked against google-labs-code/design.md main on 2026-05-11.
 * GitHub main latest at that time was 887a4bf.
 */
export const GOOGLE_DESIGN_MD_SOURCE_COMMIT = '887a4bf';

export const CANONICAL_DESIGN_MD_SECTIONS = [
  'Overview',
  'Colors',
  'Typography',
  'Layout',
  'Elevation & Depth',
  'Shapes',
  'Components',
  "Do's and Don'ts",
] as const;

export const REQUIRED_PROMPT_SECTIONS = [
  'Overview',
  'Layout',
  'Typography',
  'Components',
  "Do's and Don'ts",
] as const;
