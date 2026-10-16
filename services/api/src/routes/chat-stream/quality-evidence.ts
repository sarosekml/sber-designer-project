import type {
  ScreenReadinessProfile,
  ScreenReadinessProfileInput,
} from '@sber-designer/shared-types';

import {
  readAgentRunReceipts,
  recordToolReceiptSafely,
  type AgentRunManifest,
} from '../../agent/run-recorder';
import type { TaskRelevantComponentPack } from '../../component-intelligence/component-pack';
import {
  validateDesignScreenCompatibility,
  type DesignCompatibilityResult,
} from '../../design-compatibility';
import type { ScreenCraftProfile } from '../../generation-mode';
import { validateScreenCraft, type ScreenCraftResult } from '../../screen-craft';

export async function ensureFinalScreenQualityEvidence(input: {
  workspacePath: string | null;
  agentRun: AgentRunManifest | null;
  componentPack?: TaskRelevantComponentPack | null;
  screenReadiness?: ScreenReadinessProfileInput | ScreenReadinessProfile | null;
  screenCraftProfile?: ScreenCraftProfile;
  forceCraft?: boolean;
  forceDesignMode?: boolean;
}): Promise<{ craft: ScreenCraftResult | null; designMode: DesignCompatibilityResult | null }> {
  if (!input.workspacePath || !input.agentRun?.activeScreen) {
    return { craft: null, designMode: null };
  }
  const receipts = await readAgentRunReceipts(input.workspacePath, input.agentRun.runId).catch(
    () => [],
  );
  const screen = screenInput(input.agentRun);
  const shouldRunCraft =
    input.forceCraft || !receipts.some((receipt) => receipt.tool === 'validate_screen_craft');
  const shouldRunDesignMode =
    input.agentRun.projectProfile?.kind !== 'html-css' &&
    (input.forceDesignMode ||
      !receipts.some((receipt) => receipt.tool === 'validate_design_screen'));
  const craft = shouldRunCraft
    ? await validateScreenCraft({
        workspaceRoot: input.workspacePath,
        screen,
        ...(input.componentPack !== undefined ? { componentPack: input.componentPack } : {}),
        ...(input.screenReadiness !== undefined ? { screenReadiness: input.screenReadiness } : {}),
        ...(input.screenCraftProfile ? { profile: input.screenCraftProfile } : {}),
        ...(input.agentRun.activeScreen?.surface
          ? { surface: input.agentRun.activeScreen.surface }
          : {}),
      })
    : null;
  if (craft) {
    await recordScreenCraftEvidence({
      workspacePath: input.workspacePath,
      runId: input.agentRun.runId,
      result: craft,
    });
  }
  const designMode = shouldRunDesignMode
    ? await validateDesignScreenCompatibility({ workspaceRoot: input.workspacePath, screen })
    : null;
  if (designMode) {
    await recordDesignModeEvidence({
      workspacePath: input.workspacePath,
      runId: input.agentRun.runId,
      result: designMode,
    });
  }
  return { craft, designMode };
}

export async function recordDesignModeEvidence(input: {
  workspacePath: string | null;
  runId: string | null | undefined;
  result: DesignCompatibilityResult;
}): Promise<void> {
  await recordToolReceiptSafely({
    workspacePath: input.workspacePath,
    runId: input.runId,
    tool: 'validate_design_screen',
    status: input.result.status === 'missing' ? 'error' : 'ok',
    changedFiles: input.result.target.filePath ? [input.result.target.filePath] : [],
    summary: `Design-mode compatibility: ${input.result.status}.`,
    metadata: {
      status: input.result.status,
      projectSupport: input.result.projectSupport,
      target: input.result.target,
      diagnostics: input.result.diagnostics,
      summary: input.result.summary,
    },
  });
}

export async function recordScreenCraftEvidence(input: {
  workspacePath: string | null;
  runId: string | null | undefined;
  result: ScreenCraftResult;
}): Promise<void> {
  const findings = input.result.summary.findings;
  await recordToolReceiptSafely({
    workspacePath: input.workspacePath,
    runId: input.runId,
    tool: 'validate_screen_craft',
    status: input.result.status === 'missing' ? 'error' : 'ok',
    changedFiles: input.result.summary.checkedFiles,
    summary: `Craft post-check found ${findings.blocking} blocking, ${findings.shouldFix} should-fix, and ${findings.advisory} advisory findings.`,
    metadata: {
      status: input.result.status,
      checkedFiles: input.result.summary.checkedFiles,
      blocking: findings.blocking,
      shouldFix: findings.shouldFix,
      advisory: findings.advisory,
      findings: input.result.findings,
      ...(input.result.componentReuse ? { componentReuse: input.result.componentReuse } : {}),
      profile: input.result.readiness?.profile,
      categoryResults: input.result.readiness?.categoryResults ?? {},
    },
  });
}

function screenInput(agentRun: AgentRunManifest) {
  const screen = agentRun.activeScreen!;
  return {
    ...(screen.id ? { screenId: screen.id } : {}),
    ...(screen.filePath ? { filePath: screen.filePath } : {}),
    ...(screen.implementationFilePath
      ? { implementationFilePath: screen.implementationFilePath }
      : {}),
  };
}
