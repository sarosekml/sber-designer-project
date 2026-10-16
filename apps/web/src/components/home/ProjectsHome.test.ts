import { expect, test } from 'bun:test';
import { readFile, stat } from 'node:fs/promises';

const projectsPagePath = 'apps/web/src/components/home/ProjectsPage.tsx';
const projectCardPath = 'apps/web/src/components/home/ProjectCard.tsx';
const homeLandingPath = 'apps/web/src/components/home/HomeLanding.tsx';
const homeDisplayWordmarkPath = 'apps/web/src/components/home/HomeDisplayWordmark.tsx';
const homeShellPath = 'apps/web/src/components/home/HomeShell.tsx';
const stylesPath = 'apps/web/src/styles.css';
const pixelFontPath = 'apps/web/public/fonts/SBDesignDisplay-Pixel.otf';
const scriptFontPath = 'apps/web/public/fonts/SBDesignDisplay-Script.otf';

test('home shell keeps an icon-only brand and settings header', async () => {
  const shellSource = await readFile(homeShellPath, 'utf8');
  const projectsSource = await readFile(projectsPagePath, 'utf8');
  const header = shellSource.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';

  expect(header).toContain('<BrandHomeLink />');
  expect(header).not.toContain('<BrandLogo');
  expect(header).not.toContain('BRAND_WORDMARK');
  expect(header).not.toContain('sd-brand-wordmark');
  expect(header).toContain('aria-label="Settings"');
  expect(header).not.toContain('Connect repo');
  expect(projectsSource).not.toContain('<header');
  expect(shellSource.indexOf('<header')).toBeLessThan(shellSource.indexOf('<HomeRail'));
});

test('home display wordmark bundles and assigns both owner-supplied fonts', async () => {
  const [styles, wordmark, pixelFont, scriptFont] = await Promise.all([
    readFile(stylesPath, 'utf8'),
    readFile(homeDisplayWordmarkPath, 'utf8'),
    stat(pixelFontPath),
    stat(scriptFontPath),
  ]);

  expect(pixelFont.size).toBeGreaterThan(0);
  expect(scriptFont.size).toBeGreaterThan(0);
  expect(styles).toContain("url('/fonts/SBDesignDisplay-Pixel.otf')");
  expect(styles).toContain("url('/fonts/SBDesignDisplay-Script.otf')");
  expect(styles).toContain('.sd-design-display-pixel');
  expect(styles).toContain('.sd-design-display-script');
  expect(styles).toContain('.sd-design-display-support');
  expect(styles.match(/font-family: 'SB Sans Display', var\(--font-sans\)/gu)?.length).toBe(2);
  expect(wordmark).toContain('text-primary');
  expect(wordmark).toContain('text-[clamp(2rem,7vw,3rem)]');
  expect(wordmark.match(/sd-design-display-script/gu)?.length).toBe(3);
  expect(wordmark).toContain('sd-design-display-pixel');
  expect(wordmark).toContain('<span className="sd-design-display-support">IG</span>');
  expect(wordmark).toContain('role="img"');
  expect(wordmark).toContain('aria-label="Sber Designer"');
});

test('project duplication is available only for managed server workspaces', async () => {
  const [source, card] = await Promise.all([
    readFile(projectsPagePath, 'utf8'),
    readFile(projectCardPath, 'utf8'),
  ]);

  expect(source).toContain('canDuplicate={DEPLOYMENT_CAPABILITIES.canDuplicateProjects}');
  expect(card).toContain('{canDuplicate && (');
  expect(source).toContain('{DEPLOYMENT_CAPABILITIES.canDuplicateProjects && (');
});

test('home landing previews projects while the projects page keeps full registry controls', async () => {
  const [landing, projects] = await Promise.all([
    readFile(homeLandingPath, 'utf8'),
    readFile(projectsPagePath, 'utf8'),
  ]);

  expect(landing).toContain('<HomeDisplayWordmark />');
  expect(landing).toContain('<ProjectsLandingSection />');
  expect(landing.indexOf('<ProjectsLandingSection />')).toBeLessThan(
    landing.indexOf('<RecentDocumentationPanel />'),
  );
  expect(landing.indexOf('<RecentDocumentationPanel />')).toBeLessThan(
    landing.indexOf('<HarnessStatusPanel />'),
  );
  expect(landing).toContain('<HarnessStatusPanel />');
  expect(landing).toContain('<RecentDocumentationPanel />');
  expect(landing).not.toContain('fetchProjects');
  expect(projects).toContain('export function ProjectsLandingSection()');
  expect(projects).toContain('const LANDING_PROJECT_LIMIT = 3');
  expect(projects).toContain('projects.slice(0, LANDING_PROJECT_LIMIT)');
  expect(projects).toContain('fetchProjects(ac.signal)');
  expect(projects).not.toContain('HarnessStatusPanel');
  expect(projects).not.toContain('RecentDocumentationPanel');
  expect(projects).not.toContain('What should we build?');
});
