import { expect, test } from 'bun:test';

import {
  SCREEN_READINESS_CATEGORIES,
  applyScreenReadinessProfile,
  DEFAULT_SCREEN_READINESS_PROFILE,
  resolveScreenReadinessProfile,
  screenReadinessCategoryForRule,
} from '../packages/shared-types/src/screen-readiness';

test('Post-check settings expose detailed user-facing behavior for every category', () => {
  for (const category of SCREEN_READINESS_CATEGORIES) {
    expect(category.description.length).toBeGreaterThan(60);
    expect(category.checks.length).toBeGreaterThanOrEqual(2);
    expect(category.findingImpact.length).toBeGreaterThan(40);
    expect(['active', 'runtime-separate', 'planned']).toContain(category.execution);
    expect(['custom-profile', 'terminal-required', 'planned']).toContain(category.control);
  }
  expect(
    SCREEN_READINESS_CATEGORIES.filter((category) => category.control === 'terminal-required').map(
      (category) => category.id,
    ),
  ).toEqual(['renderHealth', 'designModeCompatibility']);
});

test('screen readiness defaults to enabled Standard static categories', () => {
  const profile = resolveScreenReadinessProfile();

  expect(profile).toEqual(DEFAULT_SCREEN_READINESS_PROFILE);
  expect(profile.enabled).toBe(true);
  expect(profile.profile).toBe('standard');
  expect(profile.categories.sourceIntegrity).toBe(true);
  expect(profile.categories.designSystemFit).toBe(true);
  expect(profile.categories.dataHonesty).toBe(true);
  expect(profile.categories.operationalUxStates).toBe(true);
  expect(profile.categories.accessibilityBasics).toBe(true);
  expect(profile.categories.renderHealth).toBe(false);
  expect(profile.categories.responsiveVisualSanity).toBe(false);
  expect(profile.categories.designModeCompatibility).toBe(false);
});

test('legacy runtime boolean can disable the default profile without implying persisted migration', () => {
  const profile = resolveScreenReadinessProfile(undefined, false);

  expect(profile.enabled).toBe(false);
  expect(profile.profile).toBe('standard');
  expect(profile.categories.sourceIntegrity).toBe(true);
});

test('rule ids resolve to one readiness category source of truth', () => {
  expect(screenReadinessCategoryForRule('craft.fake-metric')).toBe('dataHonesty');
  expect(screenReadinessCategoryForRule('craft.raw-hex')).toBe('designSystemFit');
  expect(screenReadinessCategoryForRule('craft.component-reuse.required-component-missing')).toBe(
    'designSystemFit',
  );
  expect(screenReadinessCategoryForRule('craft.icon-button-label')).toBe('accessibilityBasics');
  expect(screenReadinessCategoryForRule('craft.missing-state')).toBe('operationalUxStates');
  expect(screenReadinessCategoryForRule('craft.unknown-future-rule')).toBe('sourceIntegrity');
});

test('disabled categories remove active findings and report disabled instead of passed', () => {
  const profile = resolveScreenReadinessProfile({
    profile: 'custom',
    categories: {
      designSystemFit: false,
    },
  });

  const result = applyScreenReadinessProfile({
    profile,
    findings: [
      { ruleId: 'craft.raw-hex', severity: 'should-fix' },
      { ruleId: 'craft.fake-metric', severity: 'blocking' },
    ],
  });

  expect(result.findings.map((finding) => finding.ruleId)).toEqual(['craft.fake-metric']);
  expect(result.categoryResults.designSystemFit.status).toBe('disabled');
  expect(result.categoryResults.designSystemFit.findings.total).toBe(0);
  expect(result.categoryResults.dataHonesty.status).toBe('blocked');
});

test('strict profile promotes selected should-fix findings through policy layer', () => {
  const result = applyScreenReadinessProfile({
    profile: resolveScreenReadinessProfile({ profile: 'strict' }),
    findings: [{ ruleId: 'craft.raw-hex', severity: 'should-fix' }],
  });

  expect(result.findings[0]?.severity).toBe('blocking');
  expect(result.categoryResults.designSystemFit.status).toBe('blocked');
  expect(result.summary.blocking).toBe(1);
  expect(result.summary.shouldFix).toBe(0);
});

test('slice two categories are skipped when enabled before their runner exists', () => {
  const result = applyScreenReadinessProfile({
    profile: resolveScreenReadinessProfile({
      profile: 'custom',
      categories: {
        renderHealth: true,
      },
    }),
    findings: [],
  });

  expect(result.categoryResults.renderHealth.status).toBe('skipped');
  expect(result.categoryResults.renderHealth.reason).toContain('Slice 2');
});
