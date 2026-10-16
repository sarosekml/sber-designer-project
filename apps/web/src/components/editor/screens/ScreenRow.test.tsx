import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ProjectScreen } from '@sber-designer/shared-types';

import { ScreenRow } from './ScreenRow';

function screen(overrides: Partial<ProjectScreen> = {}): ProjectScreen {
  return {
    id: 'screen-1',
    name: 'Funds overview',
    kind: 'blank',
    surface: 'app',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    ...overrides,
  } as ProjectScreen;
}

function renderRow(overrides: Partial<Parameters<typeof ScreenRow>[0]> = {}) {
  return renderToStaticMarkup(
    <ScreenRow
      screen={screen()}
      active={false}
      assistantRun={null}
      onSelect={() => undefined}
      menuOpen={false}
      onMenuOpenChange={() => undefined}
      onRename={() => undefined}
      onMove={() => undefined}
      onExport={() => undefined}
      onDuplicate={() => undefined}
      onRemove={() => undefined}
      onSetHealth={() => undefined}
      taskCount={0}
      showVisibilityControl={false}
      hiddenInFlow={false}
      onToggleHidden={() => undefined}
      {...overrides}
    />,
  );
}

test('screen row renders the name on the shared child axis without a permanent icon', () => {
  const html = renderRow();
  expect(html).toContain('Funds overview');
  // No permanent decorative Frame icon before the name.
  expect(html).not.toContain('lucide-frame');
  // The select button lands on the same 28px name axis as the dropdown
  // (li px-2 + pl-5).
  expect(html).toContain('pl-5');
  expect(html).toContain('truncate font-medium');
});

test('screen row keeps status metadata after the name and trailing actions available', () => {
  const html = renderRow({
    screen: screen({ name: 'Transaction details', health: { status: 'broken', reason: 'nope' } }),
    taskCount: 3,
    showVisibilityControl: true,
  });
  expect(html).toContain('broken');
  expect(html).toContain('title="3 linked tasks"');
  expect(html).toContain('title="Hide screen in Flow"');
  // The name comes before conditional metadata so every row starts on one axis.
  expect(html.indexOf('Transaction details')).toBeLessThan(html.indexOf('broken'));
  expect(html.indexOf('Transaction details')).toBeLessThan(html.indexOf('linked tasks'));
});

test('modal marker stays after the name instead of occupying the leading axis', () => {
  const html = renderRow({ screen: screen({ name: 'Export dialog', surface: 'modal' }) });
  const nameIndex = html.indexOf('Export dialog');
  const modalIndex = html.indexOf('Modal');
  expect(nameIndex).toBeGreaterThan(-1);
  expect(modalIndex).toBeGreaterThan(nameIndex);
});
