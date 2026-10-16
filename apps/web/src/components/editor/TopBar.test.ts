import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const topBarPath = 'apps/web/src/components/editor/TopBar.tsx';

test('editor uses the shared shell-aligned brand home link', async () => {
  const topBar = await readFile(topBarPath, 'utf8');

  expect(topBar).toContain('<BrandHomeLink title="Back to all projects" />');
  expect(topBar).not.toContain('<BrandLogo');
  expect(topBar).not.toContain('BRAND_WORDMARK');
});

test('demo top bar keeps shared navigation and exposes demo-only controls', async () => {
  const topBar = await readFile(topBarPath, 'utf8');

  expect(topBar).toContain("view === 'demo'");
  expect(topBar).toContain('{DEPLOYMENT_CAPABILITIES.canShareProjects && <ShareButton />}');
  expect(topBar).toContain('DemoScreensPanelButton');
  expect(topBar).toContain('DemoFullscreenButton');
  expect(topBar).toContain('Show screens panel');
  expect(topBar).toContain('Hide screens panel');
  expect(topBar).toContain('Enter fullscreen demo');
  expect(topBar).toContain('Exit fullscreen demo');
  expect(topBar).toContain('const Icon = fullscreen ? Minimize2 : Maximize2;');
});

test('Share is hidden outside the managed server profile', async () => {
  const topBar = await readFile(topBarPath, 'utf8');

  expect(topBar).toContain('resolveDeploymentCapabilities(');
  expect(
    topBar.match(/DEPLOYMENT_CAPABILITIES\.canShareProjects && <ShareButton \/>/gu),
  ).toHaveLength(2);
});

test('top bar opens Settings on the General system section by default', async () => {
  const topBar = await readFile(topBarPath, 'utf8');

  expect(topBar).toContain(
    "const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection>('general');",
  );
  expect(topBar).toContain("setSettingsInitialSection(detail?.section ?? 'general');");
  expect(topBar).not.toContain("setSettingsInitialSection('project');");
});

test('DS Browser entry and dialog stay hidden until the beta module is enabled', async () => {
  const topBar = await readFile(topBarPath, 'utf8');

  expect(topBar).toContain('const dsBrowserEnabled = useThemeStore((s) => s.dsBrowserEnabled);');
  // Both the top-bar button and the dialog are gated behind the flag.
  expect(topBar).toContain('{dsBrowserEnabled && (');
  expect(topBar).toContain('<Boxes />');
  expect(topBar).toContain('DS Browser');
});

test('local edit top bar exposes host handoff only for a connected workspace', async () => {
  const topBar = await readFile(topBarPath, 'utf8');

  expect(topBar).toContain('DEPLOYMENT_CAPABILITIES.canOpenProjectInHostApps');
  expect(topBar).toContain('project?.workspacePath && (');
  expect(topBar).toContain(
    '<HandoffMenu workspacePath={project.workspacePath} projectName={project.name} />',
  );
});
