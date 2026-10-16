import { describe, expect, test } from 'bun:test';

import {
  datedValueLabel,
  formatBytes,
  formatCost,
  formatTokenCount,
  resolveWorkspacePath,
} from './screen-info-format';

describe('screen info formatting', () => {
  test('keeps missing usage explicit and formats known values', () => {
    expect(formatTokenCount(null)).toBe('—');
    expect(formatTokenCount(125)).toBe('125');
    expect(formatCost(undefined)).toBe('—');
    expect(formatCost(0.25)).toContain('0.25');
    expect(formatBytes(2_048)).toBe('2.0 KB');
    expect(datedValueLabel(null)).toBe('—');
  });

  test('copies project-relative logs as absolute paths', () => {
    expect(resolveWorkspacePath('/projects/demo', '.sber-designer/runs/run-1')).toBe(
      '/projects/demo/.sber-designer/runs/run-1',
    );
    expect(resolveWorkspacePath('/projects/demo', '/tmp/run-1')).toBe('/tmp/run-1');
  });
});
