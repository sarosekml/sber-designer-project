import type {
  ComponentUseCandidate,
  TaskRelevantComponentPack,
} from './component-intelligence/component-pack';
import type { ScreenCraftComponentReuseSummary, ScreenCraftFinding } from './screen-craft';
import {
  componentReuseSubstituteTags,
  htmlComponentFamilyPresent,
  scoreComponentReuse,
} from './screen-craft-reuse-utils';

type ReuseAnalysis = {
  findings: ScreenCraftFinding[];
  summary: ScreenCraftComponentReuseSummary;
};

export function analyzePlannedHtmlComponentReuse(
  classSet: Set<string>,
  filePath: string,
  componentPack: TaskRelevantComponentPack,
): ReuseAnalysis {
  const selection = readinessSelection(componentPack);
  const classCandidates = componentPack.candidates.filter(
    (candidate) => (candidate.requiredClasses?.length ?? 0) > 0,
  );
  const requiredCandidates = classCandidates.filter((candidate) =>
    candidateRequired(candidate, selection.requiredRoles),
  );
  const optionalCandidates = classCandidates.filter(
    (candidate) => !candidateRequired(candidate, selection.requiredRoles),
  );
  const exact = requiredCandidates.filter((candidate) => htmlCandidatePresent(candidate, classSet));
  const skipped = requiredCandidates
    .filter((candidate) => !htmlCandidatePresent(candidate, classSet))
    .map(skippedCandidate);
  const optionalSkipped = optionalCandidates
    .filter((candidate) => !htmlCandidatePresent(candidate, classSet))
    .map(skippedCandidate);
  const usedCandidates = classCandidates.filter((candidate) =>
    htmlCandidatePresent(candidate, classSet),
  );
  const findings = [
    ...skipped.map((candidate) => missingRequiredCandidateFinding(candidate, filePath)),
    ...selection.gaps.map((role) => designSystemGapFinding(role, filePath)),
    ...optionalSkipped.map((candidate) => optionalCandidateFinding(candidate, filePath)),
  ];
  const missing = uniqueSorted(
    skipped.flatMap(
      (candidate) =>
        componentPack.candidates.find((item) => item.componentId === candidate.componentId)
          ?.requiredClasses?.[0] ?? [],
    ),
  );
  const total = requiredCandidates.length + selection.gaps.length;

  return {
    findings,
    summary: {
      expected: uniqueSorted(requiredCandidates.map((candidate) => candidate.shortName)),
      used: uniqueSorted(Array.from(classSet)),
      missing,
      exact: uniqueSorted(exact.map((candidate) => candidate.shortName)),
      substituted: [],
      skipped,
      requiredRoles: selection.requiredRolesSorted,
      usedComponentIds: uniqueSorted(usedCandidates.map((candidate) => candidate.componentId)),
      missingRequiredRoles: uniqueSorted([
        ...skipped.map((candidate) => candidate.role),
        ...selection.gaps,
      ]),
      designSystemGaps: selection.gaps,
      optionalSkipped,
      score: score(exact.length, total),
    },
  };
}

export function analyzePlannedComponentReuse(
  usedTags: Set<string>,
  filePath: string,
  componentPack: TaskRelevantComponentPack,
): ReuseAnalysis {
  const selection = readinessSelection(componentPack);
  const requiredCandidates = componentPack.candidates.filter((candidate) =>
    candidateRequired(candidate, selection.requiredRoles),
  );
  const optionalCandidates = componentPack.candidates.filter(
    (candidate) => !candidateRequired(candidate, selection.requiredRoles),
  );
  const scoring = scoreComponentReuse(
    requiredCandidates,
    usedTags,
    (candidate) => candidate.userRequired === true,
  );
  const optionalSkipped = optionalCandidates
    .filter((candidate) => !reactCandidatePresent(candidate, usedTags))
    .map(skippedCandidate);
  const usedCandidates = componentPack.candidates.filter((candidate) =>
    reactCandidatePresent(candidate, usedTags),
  );
  const findings = [
    ...scoring.skipped.map((candidate) => missingRequiredCandidateFinding(candidate, filePath)),
    ...selection.gaps.map((role) => designSystemGapFinding(role, filePath)),
    ...optionalSkipped.map((candidate) => optionalCandidateFinding(candidate, filePath)),
  ];
  const total = requiredCandidates.length + selection.gaps.length;

  return {
    findings,
    summary: {
      expected: uniqueSorted(requiredCandidates.map((candidate) => candidate.shortName)),
      used: uniqueSorted(Array.from(usedTags).filter((tag) => /^[A-Z]/u.test(tag))),
      missing: uniqueSorted(scoring.skipped.map((candidate) => candidate.expected)),
      exact: scoring.exact,
      substituted: scoring.substituted,
      skipped: scoring.skipped,
      requiredRoles: selection.requiredRolesSorted,
      usedComponentIds: uniqueSorted(usedCandidates.map((candidate) => candidate.componentId)),
      missingRequiredRoles: uniqueSorted([
        ...scoring.skipped.map((candidate) => candidate.role),
        ...selection.gaps,
      ]),
      designSystemGaps: selection.gaps,
      optionalSkipped,
      score: score(scoring.score.earned, total),
    },
  };
}

function readinessSelection(componentPack: TaskRelevantComponentPack) {
  const requiredRolesSorted = uniqueSorted(componentPack.selectionPlan?.requiredRoles ?? []);
  const requiredRoles = new Set(requiredRolesSorted);
  const gaps = uniqueSorted(
    (componentPack.selectionPlan?.gaps ?? [])
      .filter((gap) => requiredRoles.has(gap.role))
      .map((gap) => gap.role),
  );
  return { requiredRoles, requiredRolesSorted, gaps };
}

function candidateRequired(candidate: ComponentUseCandidate, requiredRoles: Set<string>): boolean {
  return candidate.userRequired === true || requiredRoles.has(candidate.role);
}

function htmlCandidatePresent(candidate: ComponentUseCandidate, classSet: Set<string>): boolean {
  return htmlComponentFamilyPresent(candidate.requiredClasses ?? [], classSet);
}

function reactCandidatePresent(candidate: ComponentUseCandidate, usedTags: Set<string>): boolean {
  return (
    usedTags.has(candidate.shortName) ||
    (!candidate.userRequired &&
      componentReuseSubstituteTags(candidate).some((tag) => usedTags.has(tag)))
  );
}

function skippedCandidate(candidate: ComponentUseCandidate) {
  return {
    role: candidate.role,
    expected: candidate.shortName,
    componentId: candidate.componentId,
  };
}

function missingRequiredCandidateFinding(
  candidate: ReturnType<typeof skippedCandidate>,
  filePath: string,
): ScreenCraftFinding {
  return {
    severity: 'blocking',
    ruleId: 'craft.component-reuse.required-component-missing',
    filePath,
    componentRole: candidate.role,
    message: `Required role ${candidate.role} expected ${candidate.expected}, but the screen source did not use that component family.`,
    fixHint: `Use ${candidate.expected} (${candidate.componentId}) for the required ${candidate.role} region.`,
  };
}

function designSystemGapFinding(role: string, filePath: string): ScreenCraftFinding {
  return {
    severity: 'blocking',
    ruleId: 'craft.component-reuse.design-system-gap',
    filePath,
    componentRole: role,
    repairStage: 'retrieve-hydrate-repair',
    message: `Required role ${role} has no selected design-system component.`,
    fixHint: `Run one bounded retrieve → hydrate → repair pass for ${role}.`,
  };
}

function optionalCandidateFinding(
  candidate: ReturnType<typeof skippedCandidate>,
  filePath: string,
): ScreenCraftFinding {
  return {
    severity: 'advisory',
    ruleId: 'craft.component-reuse.optional-candidate-unused',
    filePath,
    componentRole: candidate.role,
    message: `Optional shortlist candidate ${candidate.expected} for ${candidate.role} was not used.`,
    fixHint:
      'This is diagnostic only; no repair is required when the candidate was intentionally skipped.',
  };
}

function score(earned: number, total: number) {
  const rounded = Math.round(earned * 10) / 10;
  return {
    earned: rounded,
    total,
    label: `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}/${total}`,
  };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
