import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type { EditorState } from '../services/api/src/state-store';
import type {
  RuntimeTargetChangeSummary,
  RuntimeTargetSnapshot,
} from '../services/api/src/agent-runtimes/change-validation';
import { validateSelectionTargetContract } from '../services/api/src/agent-runtimes/selection-target-contract';

const TARGET = 'src/screens/Payment.tsx';

function selection(): NonNullable<EditorState['selection']> {
  return {
    loc: `${TARGET}:18:9`,
    sourceKind: 'react-source',
    tagName: 'button',
    text: 'Отменить',
    selector: '[data-testid="cancel-action"]',
    componentName: 'Button',
    componentPath: ['PaymentScreen', 'Toolbar', 'Button'],
    rect: { x: 1200, y: 96, width: 131, height: 40 },
  };
}

function source(cancelColor: string, headerColor = '#198754'): string {
  return [
    'export function PaymentScreen() {',
    '  return (',
    '    <main data-sd-screen-root>',
    '      <header>',
    `        <CheckIcon style={{ color: "${headerColor}" }} />`,
    '        <h1>Платеж от 30.07.2024</h1>',
    '      </header>',
    '      <section>',
    '        <Button data-testid="approve-action">',
    '          Подтвердить отправку счета клиенту',
    '        </Button>',
    '        <Button',
    '          data-testid="cancel-action"',
    '          variant="outline"',
    '        >',
    `          <XCircle style={{ color: "${cancelColor}" }} />`,
    '          Отменить',
    '        </Button>',
    '      </section>',
    '    </main>',
    '  );',
    '}',
    '',
  ].join('\n');
}

async function workspaceWithSource(after: string, before = source('#7a8b8b')) {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0107-selection-target-'));
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  await writeFile(join(workspace, TARGET), after, 'utf8');
  const snapshots: RuntimeTargetSnapshot[] = [
    {
      path: TARGET,
      before,
      beforeBytes: Buffer.byteLength(before),
      beforeLines: before.split('\n').length,
    },
  ];
  const summary: RuntimeTargetChangeSummary = {
    targetFiles: [TARGET],
    changedFiles: [TARGET],
    unchangedFiles: [],
    missingFiles: [],
    changedTargets: [
      {
        path: TARGET,
        kind: 'modified',
        beforeBytes: Buffer.byteLength(before),
        afterBytes: Buffer.byteLength(after),
        beforeLines: before.split('\n').length,
        afterLines: after.split('\n').length,
        changedLineCount: 1,
        changedCharacterCount: 7,
        sourceRisk: 'low_signal',
        sourceRiskReasons: [],
      },
    ],
  };
  return { workspace, snapshots, summary };
}

test('selection target contract passes when the edit touches the selected element neighborhood', async () => {
  const { workspace, snapshots, summary } = await workspaceWithSource(source('#d32f2f'));

  const result = await validateSelectionTargetContract({
    workspacePath: workspace,
    selection: selection(),
    userRequest: 'сделай иконку тоже красного цвета',
    summary,
    snapshots,
    taskKind: 'screen-edit',
  });

  expect(result.status).toBe('passed');
  expect(result.reasonCode).toBe('selected_source_changed');
});

test('selection target contract fails when the edit misses the selected element', async () => {
  const { workspace, snapshots, summary } = await workspaceWithSource(source('#7a8b8b', '#d32f2f'));

  const result = await validateSelectionTargetContract({
    workspacePath: workspace,
    selection: selection(),
    userRequest: 'сделай иконку тоже красного цвета',
    summary,
    snapshots,
    taskKind: 'screen-edit',
  });

  expect(result.status).toBe('failed');
  expect(result.reasonCode).toBe('edit_target_missed');
  expect(result.reason).toContain('selected element');
});
