import { describe, expect, test } from 'bun:test';

import type { GitChange } from '@/lib/api-client';
import {
  changeBadge,
  branchNameForMessage,
  defaultPrBody,
  deriveSelection,
  isProtectedBranch,
  previewBranchAction,
  selectAllPaths,
  slugForBranch,
  splitChangePath,
} from './source-control-state';

function change(path: string, kind: GitChange['kind'], extra: Partial<GitChange> = {}): GitChange {
  return { path, kind, staged: false, ...extra };
}

describe('changeBadge', () => {
  test('maps every kind to its VS Code letter', () => {
    expect(changeBadge('modified').letter).toBe('M');
    expect(changeBadge('added').letter).toBe('A');
    expect(changeBadge('deleted').letter).toBe('D');
    expect(changeBadge('renamed').letter).toBe('R');
    expect(changeBadge('untracked').letter).toBe('U');
    expect(changeBadge('conflicted').letter).toBe('C');
  });

  test('conflicted is bold + destructive', () => {
    expect(changeBadge('conflicted').className).toContain('font-bold');
    expect(changeBadge('conflicted').className).toContain('destructive');
  });
});

describe('splitChangePath', () => {
  test('splits into filename + directory', () => {
    expect(splitChangePath('src/a/b.ts')).toEqual({ name: 'b.ts', dir: 'src/a' });
  });
  test('root file has empty dir', () => {
    expect(splitChangePath('README.md')).toEqual({ name: 'README.md', dir: '' });
  });
  test('keeps spaces in the filename', () => {
    expect(splitChangePath('docs/my file.md')).toEqual({ name: 'my file.md', dir: 'docs' });
  });
});

describe('deriveSelection', () => {
  const changes = [
    change('a.ts', 'modified'),
    change('b.ts', 'added'),
    change('c.ts', 'untracked'),
  ];

  test('all selected', () => {
    const s = deriveSelection(changes, selectAllPaths(changes));
    expect(s.selectedPaths).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(s.allSelected).toBe(true);
  });

  test('subset selected → not allSelected, order preserved', () => {
    const s = deriveSelection(changes, new Set(['c.ts', 'a.ts']));
    expect(s.selectedPaths).toEqual(['a.ts', 'c.ts']);
    expect(s.allSelected).toBe(false);
  });

  test('none selected', () => {
    const s = deriveSelection(changes, new Set());
    expect(s.selectedPaths).toEqual([]);
    expect(s.allSelected).toBe(false);
  });

  test('empty change list is never "all selected"', () => {
    expect(deriveSelection([], new Set()).allSelected).toBe(false);
  });
});

describe('previewBranchAction', () => {
  test('creates sd/<slug> from base when on the base branch', () => {
    expect(
      previewBranchAction({
        hasOpenPr: false,
        currentBranch: 'main',
        baseBranch: 'main',
        message: 'Fix the header',
      }),
    ).toBe('Will create sd/fix-the-header from main');
  });

  test('pushes the existing non-base branch', () => {
    expect(
      previewBranchAction({
        hasOpenPr: false,
        currentBranch: 'feature/x',
        baseBranch: 'main',
        message: 'anything',
      }),
    ).toBe('Will push feature/x and open a PR into main');
  });

  test('updates the existing PR', () => {
    expect(
      previewBranchAction({
        hasOpenPr: true,
        prNumber: '42',
        workingBranch: 'sd/foo',
        baseBranch: 'main',
        message: 'x',
      }),
    ).toBe('Will update PR #42 on sd/foo');
  });
});

describe('slugForBranch', () => {
  test('lowercases, dashes, strips punctuation', () => {
    expect(slugForBranch('Fix: the Bug!')).toBe('fix-the-bug');
  });
  test('falls back to a placeholder when empty', () => {
    expect(slugForBranch('   ')).toBe('<slug>');
  });
});

describe('branchNameForMessage', () => {
  test('prefixes the generated slug with sd', () => {
    expect(branchNameForMessage('Fix: the Bug!')).toBe('sd/fix-the-bug');
  });

  test('uses a stable fallback for empty messages', () => {
    expect(branchNameForMessage('   ')).toBe('sd/update');
  });
});

describe('isProtectedBranch', () => {
  test('protects shared base branches', () => {
    expect(isProtectedBranch('main')).toBe(true);
    expect(isProtectedBranch('master')).toBe(true);
    expect(isProtectedBranch('develop')).toBe(true);
    expect(isProtectedBranch('release/2026-07')).toBe(true);
  });

  test('allows feature branches', () => {
    expect(isProtectedBranch('sd/fix')).toBe(false);
    expect(isProtectedBranch('feature/fix')).toBe(false);
  });
});

describe('defaultPrBody', () => {
  test('bullets the selected paths as inline code', () => {
    expect(defaultPrBody(['a.ts', 'b.ts'])).toBe('- `a.ts`\n- `b.ts`');
  });
});
