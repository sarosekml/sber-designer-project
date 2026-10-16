import { expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';

import {
  parseHowItWorksDocument,
  selectRecentlyUpdatedDocuments,
  type HowItWorksMetadata,
} from './how-it-works-metadata';

const DOCUMENTATION_ROOT = 'docs/how-it-works';

test('How it works parser removes frontmatter and extracts card metadata', () => {
  const parsed = parseHowItWorksDocument(
    [
      '---',
      'updated: 2026-07-23T17:30:00+03:00',
      '---',
      '',
      '# Example `document`',
      '',
      'A short **summary** with [an internal link](other.md).',
    ].join('\n'),
    'example-document.md',
    new Date('2026-07-24T00:00:00Z'),
  );

  expect(parsed.metadata).toEqual({
    fileName: 'example-document.md',
    slug: 'example-document',
    title: 'Example document',
    excerpt: 'A short summary with an internal link.',
    updated: '2026-07-23T17:30:00+03:00',
    route: '/how-it-works/example-document',
  });
  expect(parsed.body.startsWith('# Example')).toBe(true);
  expect(parsed.body).not.toContain('updated:');
});

test('How it works parser rejects missing, invalid, and future metadata', () => {
  expect(() =>
    parseHowItWorksDocument('# Missing', 'missing.md', new Date('2026-07-24T00:00:00Z')),
  ).toThrow('must start with YAML frontmatter');
  expect(() =>
    parseHowItWorksDocument(
      ['---', 'updated: yesterday', '---', '', '# Invalid'].join('\n'),
      'invalid.md',
      new Date('2026-07-24T00:00:00Z'),
    ),
  ).toThrow('must be an ISO date or timestamp');
  expect(() =>
    parseHowItWorksDocument(
      ['---', 'updated: 2026-07-25', '---', '', '# Future'].join('\n'),
      'future.md',
      new Date('2026-07-24T00:00:00Z'),
    ),
  ).toThrow('cannot be in the future');
});

test('recent documents sort by timestamp with stable title and slug tie-breaks', () => {
  const documents: HowItWorksMetadata[] = [
    metadata('beta', 'Beta', '2026-07-24T10:00:00+03:00'),
    metadata('zulu', 'Alpha', '2026-07-24T10:00:00+03:00'),
    metadata('alpha', 'Alpha', '2026-07-24T10:00:00+03:00'),
    metadata('newest', 'Newest', '2026-07-24T11:00:00+03:00'),
  ];

  expect(selectRecentlyUpdatedDocuments(documents).map((document) => document.slug)).toEqual([
    'newest',
    'alpha',
    'zulu',
  ]);
});

test('every bundled How it works document has valid repo-owned updated metadata', async () => {
  const fileNames = (await readdir(DOCUMENTATION_ROOT))
    .filter((fileName) => fileName.endsWith('.md'))
    .sort();

  expect(fileNames.length).toBeGreaterThan(20);
  for (const fileName of fileNames) {
    const source = await readFile(`${DOCUMENTATION_ROOT}/${fileName}`, 'utf8');
    const parsed = parseHowItWorksDocument(source, fileName, new Date('2026-09-18T23:59:59Z'));
    expect(parsed.metadata.fileName).toBe(fileName);
    expect(parsed.body.startsWith('# ')).toBe(true);
  }
});

function metadata(slug: string, title: string, updated: string): HowItWorksMetadata {
  return {
    fileName: `${slug}.md`,
    slug,
    title,
    excerpt: title,
    updated,
    route: `/how-it-works/${slug}`,
  };
}
