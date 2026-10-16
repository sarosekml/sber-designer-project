import { expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';

import { matchAppRoute } from '@/lib/app-route';

const pagePath = 'apps/web/src/components/home/HowItWorksPage.tsx';
const metadataPath = 'apps/web/src/lib/how-it-works-metadata.ts';
const documentationPath = 'docs/how-it-works';
const sourceControlPath = 'apps/web/src/components/editor/git/SourceControlChanges.tsx';

test('How it works reader includes every markdown page as raw build input', async () => {
  const [source, metadataSource, entries] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(metadataPath, 'utf8'),
    readdir(documentationPath),
  ]);
  const markdownFiles = entries.filter((entry) => entry.endsWith('.md'));

  expect(markdownFiles.length).toBeGreaterThan(20);
  expect(source).toContain('../../../../../docs/how-it-works/*.md');
  expect(source).toContain("query: '?raw'");
  expect(source).toContain("from 'virtual:sber-designer/how-it-works-metadata'");
  expect(metadataSource).toContain("fileName === 'README.md' ? 'overview'");
  expect(source).toContain("label: 'More'");
});

test('documentation reader provides responsive navigation and markdown rendering', async () => {
  const source = await readFile(pagePath, 'utf8');

  expect(source).toContain('ReactMarkdown');
  expect(source).toContain('remarkGfm');
  expect(source).toContain('aria-label="How it works pages"');
  expect(source).toContain('lg:hidden');
  expect(source).toContain('hidden h-[calc(100dvh-3rem)]');
  expect(source).not.toContain('rehypeRaw');
});

test('every documentation filename has an addressable route shape', async () => {
  const entries = await readdir(documentationPath);
  const slugs = entries
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => (entry === 'README.md' ? null : entry.replace(/\.md$/u, '')));

  for (const slug of slugs) {
    const pathname = slug ? `/how-it-works/${encodeURIComponent(slug)}` : '/how-it-works';
    expect(matchAppRoute(pathname)).toEqual({ kind: 'how-it-works', slug });
  }
});

test('existing product help links open the in-app documentation route', async () => {
  const source = await readFile(sourceControlPath, 'utf8');

  expect(source).toContain('href="/how-it-works/git-and-pr-workflow"');
  expect(source).not.toContain('href="/docs/how-it-works/git-and-pr-workflow.md"');
});
