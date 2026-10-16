/** Screen readiness DoR profile shared by editor, API and run receipts. */

export type ScreenCraftSeverity = 'blocking' | 'should-fix' | 'advisory';

export type ScreenReadinessProfileMode = 'standard' | 'strict' | 'custom';

export type ScreenReadinessCategoryId =
  | 'sourceIntegrity'
  | 'renderHealth'
  | 'designSystemFit'
  | 'dataHonesty'
  | 'operationalUxStates'
  | 'accessibilityBasics'
  | 'responsiveVisualSanity'
  | 'designModeCompatibility';

export type ScreenReadinessCategoryStatus =
  | 'passed'
  | 'findings'
  | 'blocked'
  | 'disabled'
  | 'skipped'
  | 'missing';

export interface ScreenReadinessCategoryDefinition {
  id: ScreenReadinessCategoryId;
  label: string;
  description: string;
  checks: readonly string[];
  findingImpact: string;
  execution: 'active' | 'runtime-separate' | 'planned';
  /** Whether Custom can disable the check or it remains a terminal invariant. */
  control: 'custom-profile' | 'terminal-required' | 'planned';
  slice: 1 | 2;
  standardEnabled: boolean;
  strictEnabled: boolean;
  ruleIds: string[];
}

export type ScreenReadinessCategorySelection = Record<ScreenReadinessCategoryId, boolean>;
export type ScreenReadinessCategorySelectionInput = {
  [K in ScreenReadinessCategoryId]?: boolean | undefined;
};

export interface ScreenReadinessProfile {
  enabled: boolean;
  profile: ScreenReadinessProfileMode;
  categories: ScreenReadinessCategorySelection;
}

export interface ScreenReadinessProfileInput {
  enabled?: boolean | undefined;
  profile?: ScreenReadinessProfileMode | undefined;
  categories?: ScreenReadinessCategorySelectionInput | undefined;
}

export interface ScreenReadinessFindingLike {
  ruleId: string;
  severity: ScreenCraftSeverity;
  category?: ScreenReadinessCategoryId;
}

export interface ScreenReadinessCategoryResult {
  id: ScreenReadinessCategoryId;
  status: ScreenReadinessCategoryStatus;
  enabled: boolean;
  label: string;
  reason?: string;
  findings: {
    blocking: number;
    shouldFix: number;
    advisory: number;
    total: number;
  };
  ruleIds: string[];
}

export interface ScreenReadinessAppliedResult<TFinding extends ScreenReadinessFindingLike> {
  profile: ScreenReadinessProfile;
  findings: Array<TFinding & { category: ScreenReadinessCategoryId }>;
  categoryResults: Record<ScreenReadinessCategoryId, ScreenReadinessCategoryResult>;
  summary: {
    blocking: number;
    shouldFix: number;
    advisory: number;
    total: number;
  };
}

export const SCREEN_READINESS_CATEGORIES = [
  {
    id: 'sourceIntegrity',
    label: 'Source integrity',
    description:
      'Verifies that the generated screen has a real editable source file and can be compiled against the connected project.',
    checks: [
      'Resolves the implementation file and catches missing or unreadable source.',
      'Runs project-aware TypeScript checks and detects React hooks placed outside components.',
    ],
    findingImpact:
      'Blocking findings prevent the run from being accepted until the source is repaired.',
    execution: 'active',
    control: 'custom-profile',
    slice: 1,
    standardEnabled: true,
    strictEnabled: true,
    ruleIds: [
      'craft.source-missing',
      'craft.react-hook-outside-component',
      'craft.type-error',
      'craft.typecheck-unavailable',
    ],
  },
  {
    id: 'renderHealth',
    label: 'Render health',
    description:
      'Proves that the active screen actually renders in the project preview instead of only looking valid in source.',
    checks: [
      'Detects runtime crashes, missing screen roots and blank or unavailable canvases.',
      'Records confirmed, failed or pending browser evidence; unavailable evidence is never reported as passed.',
    ],
    findingImpact:
      'Runtime proof already runs as a separate terminal gate; this profile row does not control that gate yet.',
    execution: 'runtime-separate',
    control: 'terminal-required',
    slice: 2,
    standardEnabled: false,
    strictEnabled: true,
    ruleIds: [],
  },
  {
    id: 'designSystemFit',
    label: 'Design-system fit',
    description:
      'Checks whether the screen follows the connected design system instead of rebuilding known UI from generic primitives.',
    checks: [
      'Flags raw colors, raw font families, default palettes and placeholder assets when project alternatives exist.',
      'Compares the source with the task component pack and verifies explicitly required components.',
    ],
    findingImpact:
      'Explicit component requirements are blocking. Other fit findings are should-fix in Standard and blocking in Strict.',
    execution: 'active',
    control: 'custom-profile',
    slice: 1,
    standardEnabled: true,
    strictEnabled: true,
    ruleIds: [
      'craft.raw-hex',
      'craft.raw-font-family',
      'craft.default-palette',
      'craft.placeholder-asset',
      'craft.component-reuse.design-system-gap',
      'craft.component-reuse.missing-breadcrumb',
      'craft.component-reuse.missing-page-header',
      'craft.component-reuse.missing-section-header',
      'craft.component-reuse.missing-tile',
      'craft.component-reuse.optional-candidate-unused',
      'craft.component-reuse.required-component-missing',
      'craft.component-family.missing-data-table',
    ],
  },
  {
    id: 'dataHonesty',
    label: 'Data honesty',
    description:
      'Prevents generated operational screens from presenting invented numbers as if they were real project data.',
    checks: [
      'Looks for metric-like amounts and percentages introduced without a mock, sample or demo marker.',
      'Allows clearly labelled example data; it does not validate business facts against an external data source.',
    ],
    findingImpact:
      'Unlabelled invented metrics are blocking until removed or marked as sample data.',
    execution: 'active',
    control: 'custom-profile',
    slice: 1,
    standardEnabled: true,
    strictEnabled: true,
    ruleIds: ['craft.fake-metric'],
  },
  {
    id: 'operationalUxStates',
    label: 'Operational UX states',
    description:
      'Checks whether an operational screen remains useful outside the happy path and has an appropriate product structure.',
    checks: [
      'Looks for loading, empty and error states in data-heavy interfaces.',
      'Flags card-only layouts and marketing hero language when the task calls for an operational workflow.',
    ],
    findingImpact:
      'Findings are should-fix or advisory in Standard; should-fix findings become blocking in Strict.',
    execution: 'active',
    control: 'custom-profile',
    slice: 1,
    standardEnabled: true,
    strictEnabled: true,
    ruleIds: ['craft.missing-state', 'craft.card-soup', 'craft.marketing-hero'],
  },
  {
    id: 'accessibilityBasics',
    label: 'Accessibility basics',
    description:
      'Catches a small deterministic accessibility baseline for controls and icon usage in generated screens.',
    checks: [
      'Requires an accessible name for icon-only buttons and controls.',
      'Flags emoji or text symbols used as interface icons when project icons or labelled controls should be used.',
    ],
    findingImpact:
      'Missing accessible names are blocking; emoji icon findings are reported as should-fix.',
    execution: 'active',
    control: 'custom-profile',
    slice: 1,
    standardEnabled: true,
    strictEnabled: true,
    ruleIds: ['craft.icon-button-label', 'craft.emoji-icon'],
  },
  {
    id: 'responsiveVisualSanity',
    label: 'Responsive visual sanity',
    description:
      'Will compare bounded desktop, tablet and mobile evidence for basic responsive breakage.',
    checks: [
      'Looks for horizontal overflow, clipped primary controls and blank responsive states.',
      'Requires browser snapshots at defined viewport sizes rather than guessing from source alone.',
    ],
    findingImpact:
      'Planned runner: selecting this category is preserved, but current runs report it as skipped.',
    execution: 'planned',
    control: 'planned',
    slice: 2,
    standardEnabled: false,
    strictEnabled: true,
    ruleIds: [],
  },
  {
    id: 'designModeCompatibility',
    label: 'Design-mode compatibility',
    description:
      'Verifies that generated DOM can still be mapped back to editable source through Design mode.',
    checks: [
      'Checks screen root/source mapping, inspectable elements and supported editing capabilities.',
      'Separates a visually rendered screen from one that is safe to inspect and patch later.',
    ],
    findingImpact:
      'Runs as independent terminal evidence. Custom profile selection cannot disable this compatibility check.',
    execution: 'runtime-separate',
    control: 'terminal-required',
    slice: 2,
    standardEnabled: false,
    strictEnabled: true,
    ruleIds: [],
  },
] as const satisfies readonly ScreenReadinessCategoryDefinition[];

export const SCREEN_READINESS_CATEGORY_IDS = SCREEN_READINESS_CATEGORIES.map(
  (category) => category.id,
) as ScreenReadinessCategoryId[];

export const SCREEN_READINESS_RULE_CATEGORY: Record<string, ScreenReadinessCategoryId> =
  Object.fromEntries(
    SCREEN_READINESS_CATEGORIES.flatMap((category) =>
      category.ruleIds.map((ruleId) => [ruleId, category.id]),
    ),
  );

export const DEFAULT_SCREEN_READINESS_PROFILE: ScreenReadinessProfile = {
  enabled: true,
  profile: 'standard',
  categories: categorySelectionForMode('standard'),
};

const STRICT_PROMOTED_CATEGORIES = new Set<ScreenReadinessCategoryId>([
  'designSystemFit',
  'operationalUxStates',
]);

export function resolveScreenReadinessProfile(
  input?: ScreenReadinessProfileInput | ScreenReadinessProfile | null,
  legacyEnabled?: boolean,
): ScreenReadinessProfile {
  const mode = input?.profile ?? 'standard';
  const base = categorySelectionForMode(mode);
  return {
    enabled: input?.enabled ?? legacyEnabled ?? true,
    profile: mode,
    categories: mergeCategorySelection(base, input?.categories),
  };
}

export function screenReadinessCategoryForRule(ruleId: string): ScreenReadinessCategoryId {
  return SCREEN_READINESS_RULE_CATEGORY[ruleId] ?? 'sourceIntegrity';
}

export function applyScreenReadinessProfile<TFinding extends ScreenReadinessFindingLike>(input: {
  profile?: ScreenReadinessProfileInput | ScreenReadinessProfile | null | undefined;
  findings: TFinding[];
  skippedCategories?: Partial<Record<ScreenReadinessCategoryId, string>> | undefined;
}): ScreenReadinessAppliedResult<TFinding> {
  const profile = resolveScreenReadinessProfile(input.profile);
  const findings = profile.enabled
    ? input.findings.flatMap((finding) => {
        const category = finding.category ?? screenReadinessCategoryForRule(finding.ruleId);
        if (!profile.categories[category]) return [];
        const severity = effectiveSeverity(finding.severity, category, profile.profile);
        return [{ ...finding, severity, category }];
      })
    : [];
  const categoryResults = Object.fromEntries(
    SCREEN_READINESS_CATEGORIES.map((category) => [
      category.id,
      categoryResult(category, profile, findings, input.skippedCategories?.[category.id]),
    ]),
  ) as Record<ScreenReadinessCategoryId, ScreenReadinessCategoryResult>;
  return {
    profile,
    findings,
    categoryResults,
    summary: countFindings(findings),
  };
}

function categorySelectionForMode(
  mode: ScreenReadinessProfileMode,
): ScreenReadinessCategorySelection {
  return Object.fromEntries(
    SCREEN_READINESS_CATEGORIES.map((category) => [
      category.id,
      mode === 'strict' ? category.strictEnabled : category.standardEnabled,
    ]),
  ) as ScreenReadinessCategorySelection;
}

function mergeCategorySelection(
  base: ScreenReadinessCategorySelection,
  overrides: ScreenReadinessCategorySelectionInput | ScreenReadinessCategorySelection | undefined,
): ScreenReadinessCategorySelection {
  const next: ScreenReadinessCategorySelection = { ...base };
  if (!overrides) return next;
  for (const category of SCREEN_READINESS_CATEGORY_IDS) {
    const value = overrides[category];
    if (typeof value === 'boolean') next[category] = value;
  }
  return next;
}

function effectiveSeverity(
  severity: ScreenCraftSeverity,
  category: ScreenReadinessCategoryId,
  mode: ScreenReadinessProfileMode,
): ScreenCraftSeverity {
  if (mode === 'strict' && severity === 'should-fix' && STRICT_PROMOTED_CATEGORIES.has(category)) {
    return 'blocking';
  }
  return severity;
}

function categoryResult<TFinding extends ScreenReadinessFindingLike>(
  definition: ScreenReadinessCategoryDefinition,
  profile: ScreenReadinessProfile,
  findings: Array<TFinding & { category: ScreenReadinessCategoryId }>,
  skippedReason: string | undefined,
): ScreenReadinessCategoryResult {
  const enabled = profile.enabled && profile.categories[definition.id];
  if (!enabled) {
    return {
      id: definition.id,
      status: 'disabled',
      enabled: false,
      label: definition.label,
      findings: { blocking: 0, shouldFix: 0, advisory: 0, total: 0 },
      ruleIds: definition.ruleIds,
    };
  }
  if (definition.slice === 2) {
    return {
      id: definition.id,
      status: 'skipped',
      enabled: true,
      label: definition.label,
      reason: 'Slice 2 runner is not available in this implementation.',
      findings: { blocking: 0, shouldFix: 0, advisory: 0, total: 0 },
      ruleIds: definition.ruleIds,
    };
  }
  const counts = countFindings(findings.filter((finding) => finding.category === definition.id));
  if (skippedReason && counts.total === 0) {
    return {
      id: definition.id,
      status: 'skipped',
      enabled: true,
      label: definition.label,
      reason: skippedReason,
      findings: counts,
      ruleIds: definition.ruleIds,
    };
  }
  return {
    id: definition.id,
    status: counts.blocking > 0 ? 'blocked' : counts.total > 0 ? 'findings' : 'passed',
    enabled: true,
    label: definition.label,
    findings: counts,
    ruleIds: definition.ruleIds,
  };
}

function countFindings(findings: readonly ScreenReadinessFindingLike[]): {
  blocking: number;
  shouldFix: number;
  advisory: number;
  total: number;
} {
  const blocking = findings.filter((finding) => finding.severity === 'blocking').length;
  const shouldFix = findings.filter((finding) => finding.severity === 'should-fix').length;
  const advisory = findings.filter((finding) => finding.severity === 'advisory').length;
  return { blocking, shouldFix, advisory, total: findings.length };
}
