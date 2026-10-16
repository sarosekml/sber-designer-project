import { SyntaxKind } from 'ts-morph';

import type {
  TaskRelevantComponentPack,
  ComponentUseCandidate,
} from './component-intelligence/component-pack';
import type { ScreenCraftComponentReuseSummary, ScreenCraftFinding } from './screen-craft';
import {
  analyzePlannedComponentReuse,
  analyzePlannedHtmlComponentReuse,
} from './screen-craft-reuse-readiness';
import {
  componentReuseSubstituteTags,
  htmlComponentFamilyPresent,
  scoreComponentReuse,
} from './screen-craft-reuse-utils';

export function analyzeHtmlComponentReuse(
  contents: string,
  filePath: string,
  componentPack: TaskRelevantComponentPack | null | undefined,
): { findings: ScreenCraftFinding[]; summary?: ScreenCraftComponentReuseSummary } {
  if (!componentPack) return { findings: [] };
  const classSet = new Set(htmlClassNames(contents));
  if (componentPack.selectionPlan?.requiredRoles) {
    return analyzePlannedHtmlComponentReuse(classSet, filePath, componentPack);
  }
  if (componentPack.candidates.length === 0) return { findings: [] };
  const expectedCandidates = componentPack.candidates.filter(
    (candidate) => (candidate.requiredClasses?.length ?? 0) > 0,
  );
  if (expectedCandidates.length === 0) return { findings: [] };
  const exact: string[] = [];
  const skipped: ScreenCraftComponentReuseSummary['skipped'] = [];
  const missing = new Set<string>();
  const findings: ScreenCraftFinding[] = [];

  for (const candidate of expectedCandidates) {
    const requiredClasses = candidate.requiredClasses ?? [];
    const present = htmlComponentFamilyPresent(requiredClasses, classSet);
    if (present) {
      exact.push(candidate.shortName);
      continue;
    }
    skipped.push({
      role: candidate.role,
      expected: candidate.shortName,
      componentId: candidate.componentId,
    });
    if (requiredClasses[0]) missing.add(requiredClasses[0]);
    findings.push({
      severity: 'should-fix',
      ruleId: 'craft.component-reuse.missing-tile',
      filePath,
      message: `HTML screen did not use required CSS catalog classes for ${candidate.shortName}.`,
      fixHint: `Use the ${requiredClasses[0]} component root class from ${candidate.componentId}.`,
    });
  }

  exact.sort((a, b) => a.localeCompare(b));
  skipped.sort((a, b) => a.expected.localeCompare(b.expected));
  return {
    findings,
    summary: {
      expected: expectedCandidates.map((candidate) => candidate.shortName).sort(),
      used: Array.from(classSet).sort(),
      missing: Array.from(missing).sort(),
      exact,
      substituted: [],
      skipped,
      score: {
        earned: exact.length,
        total: expectedCandidates.length,
        label: `${exact.length}/${expectedCandidates.length}`,
      },
    },
  };
}

export function analyzeComponentReuse(
  contents: string,
  sourceFile: import('ts-morph').SourceFile,
  filePath: string,
  componentPack: TaskRelevantComponentPack | null | undefined,
): { findings: ScreenCraftFinding[]; summary?: ScreenCraftComponentReuseSummary } {
  if (!componentPack) return { findings: [] };
  const usedTags = new Set([
    ...sourceFile
      .getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
      .map((opening) => opening.getTagNameNode().getText().split('.').at(-1) ?? '')
      .filter(Boolean),
    ...sourceFile
      .getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
      .map((opening) => opening.getTagNameNode().getText().split('.').at(-1) ?? '')
      .filter(Boolean),
  ]);
  if (componentPack.selectionPlan?.requiredRoles) {
    return analyzePlannedComponentReuse(usedTags, filePath, componentPack);
  }
  if (componentPack.candidates.length === 0) return { findings: [] };
  const findings: ScreenCraftFinding[] = [];
  const missing = new Set<string>();
  const trackedCandidates = componentPack.candidates.filter((candidate) =>
    REUSE_TRACKED_ROLES.has(candidate.role),
  );
  const roleClues = componentReuseRoleClues(contents);
  const hasDenseDataRegion = roleClues.get('data-table') ?? false;
  const expectedCandidates = trackedCandidates.filter(
    (candidate) =>
      (hasDenseDataRegion && DENSE_REUSE_ROLES.has(candidate.role)) ||
      roleClues.get(candidate.role) ||
      usedTags.has(candidate.shortName) ||
      componentReuseSubstituteTags(candidate).some((tag) => usedTags.has(tag)),
  );
  const expected = new Set(expectedCandidates.map((candidate) => candidate.shortName));
  for (const candidate of componentPack.candidates.filter((item) => item.userRequired)) {
    expected.add(candidate.shortName);
    if (usedTags.has(candidate.shortName)) continue;
    missing.add(candidate.shortName);
    findings.push({
      severity: 'blocking',
      ruleId: 'craft.component-reuse.required-component-missing',
      filePath,
      message: `The user explicitly required ${candidate.shortName}, but the generated screen does not use it.`,
      fixHint: `Use ${candidate.shortName} (${candidate.componentId}) from ${candidate.importHint ?? candidate.title}; related components and layout primitives are not substitutes.`,
    });
  }
  maybePushComponentReuseFinding({
    findings,
    candidate: componentPack.candidates.find((item) => item.role === 'breadcrumb'),
    usedTags,
    missing,
    filePath,
    ruleId: 'craft.component-reuse.missing-breadcrumb',
    clue: roleClues.get('breadcrumb') ?? false,
    region: 'breadcrumb/navigation trail',
  });
  maybePushComponentReuseFinding({
    findings,
    candidate: componentPack.candidates.find((item) => item.role === 'page-header'),
    usedTags,
    missing,
    filePath,
    ruleId: 'craft.component-reuse.missing-page-header',
    clue: roleClues.get('page-header') ?? false,
    region: 'page header/title region',
  });
  maybePushComponentReuseFinding({
    findings,
    candidate: componentPack.candidates.find((item) => item.role === 'section-header'),
    usedTags,
    missing,
    filePath,
    ruleId: 'craft.component-reuse.missing-section-header',
    clue: roleClues.get('section-header') ?? false,
    region: 'section header region',
  });
  maybePushComponentReuseFinding({
    findings,
    candidate: componentPack.candidates.find((item) => item.role === 'content-panel'),
    usedTags,
    missing,
    filePath,
    ruleId: 'craft.component-reuse.missing-tile',
    clue: roleClues.get('content-panel') ?? false,
    region: 'content panel surface',
  });
  maybePushComponentReuseFinding({
    findings,
    candidate: componentPack.candidates.find((item) => item.role === 'data-table'),
    usedTags,
    missing,
    filePath,
    ruleId: 'craft.component-family.missing-data-table',
    clue: roleClues.get('data-table') ?? false,
    region: 'dense data table/list workflow region',
  });
  const scoring = scoreComponentReuse(expectedCandidates, usedTags);
  for (const item of scoring.substituted) missing.add(item.expected);
  for (const item of scoring.skipped) missing.add(item.expected);
  return {
    findings,
    summary: {
      expected: Array.from(expected).sort((a, b) => a.localeCompare(b)),
      used: Array.from(usedTags)
        .filter((tag) => /^[A-Z]/u.test(tag))
        .sort((a, b) => a.localeCompare(b)),
      missing: Array.from(missing).sort((a, b) => a.localeCompare(b)),
      exact: scoring.exact,
      substituted: scoring.substituted,
      skipped: scoring.skipped,
      score: scoring.score,
    },
  };
}

function htmlClassNames(contents: string): string[] {
  const classNames: string[] = [];
  for (const match of contents.matchAll(/\bclass\s*=\s*["']([^"']+)["']/giu)) {
    for (const className of (match[1] ?? '').split(/\s+/)) {
      const trimmed = className.trim();
      if (trimmed) classNames.push(trimmed);
    }
  }
  return Array.from(new Set(classNames));
}

const REUSE_TRACKED_ROLES = new Set([
  'breadcrumb',
  'page-header',
  'section-header',
  'content-panel',
  'data-table',
  'filters',
  'mass-actions',
  'side-preview',
]);

const DENSE_REUSE_ROLES = new Set(['data-table', 'filters', 'mass-actions', 'side-preview']);

function componentReuseRoleClues(contents: string): Map<string, boolean> {
  return new Map([
    ['breadcrumb', /(breadcrumb|home|главная)/iu.test(contents)],
    ['page-header', /<h1\b/iu.test(contents)],
    ['section-header', /<h[23]\b/iu.test(contents)],
    [
      'content-panel',
      /<(?:Paper|Card)\b|className=["'][^"']*\b(?:card|panel|tile)\b/iu.test(contents),
    ],
    ['data-table', hasRawDenseDataRegion(contents)],
    ['filters', /\b(filters?|search|поиск)\b|<(?:input|select)\b/iu.test(contents)],
    ['mass-actions', /\b(mass action|bulk action|selected rows?|выбран)/iu.test(contents)],
    ['side-preview', /\b(side preview|preview rail|details panel|right rail)\b/iu.test(contents)],
  ]);
}

function hasRawDenseDataRegion(contents: string): boolean {
  if (/<(?:table)\b|<\w*(?:DataTable|DataGrid|Table|Grid|List)\b/iu.test(contents)) {
    return false;
  }
  const hasOperationalClue =
    /\b(funds?|assets?|registry|list|table|rows?|columns?|filters?|search|preview|mass action|bulk action)\b/iu.test(
      contents,
    );
  const hasRawRows =
    /\b(?:rows|items)\.map\b/iu.test(contents) ||
    /className=["'][^"']*\b(?:row|flex|grid|table|filters?)\b/iu.test(contents);
  const hasControls = /<(?:input|button)\b/iu.test(contents);
  return hasOperationalClue && hasRawRows && hasControls;
}

function maybePushComponentReuseFinding(input: {
  findings: ScreenCraftFinding[];
  candidate: ComponentUseCandidate | undefined;
  usedTags: Set<string>;
  missing: Set<string>;
  filePath: string;
  ruleId: string;
  clue: boolean;
  region: string;
}): void {
  if (!input.candidate || !input.clue || input.candidate.userRequired) return;
  if (input.usedTags.has(input.candidate.shortName)) return;
  input.missing.add(input.candidate.shortName);
  input.findings.push({
    severity: 'should-fix',
    ruleId: input.ruleId,
    filePath: input.filePath,
    message: `Screen appears to recreate a ${input.region} while ${input.candidate.shortName} is available in the task-relevant component pack.`,
    fixHint: `Use ${input.candidate.shortName} (${input.candidate.componentId}) from ${input.candidate.importHint ?? input.candidate.title}, or explain why it is incompatible.`,
  });
}
