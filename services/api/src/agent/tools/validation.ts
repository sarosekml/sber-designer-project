/** Validation tools: Design-mode compatibility and screen craft gates. */
import type { z } from 'zod';
import { screenSurface } from '@sber-designer/shared-types';

import {
  DesignCompatibilityScreenSchema,
  validateDesignScreenCompatibility,
} from '../../design-compatibility';
import { validateScreenCraft, type ScreenCraftResult } from '../../screen-craft';
import type { ServerTool } from '../types';
import { recordCraftReceiptSafely } from './files';
import { requireWorkspace } from './shared';
import { recordDesignModeEvidence } from '../../routes/chat-stream/quality-evidence';

export const validateDesignScreen: ServerTool<
  z.infer<typeof DesignCompatibilityScreenSchema>,
  unknown
> = {
  name: 'validate_design_screen',
  description:
    'Validate whether a screen is Design-readable using the unified project index. Returns diagnostics for raw HTML, missing source, complex props/classes/styles, and indexed component/token usage.',
  inputSchema: DesignCompatibilityScreenSchema,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const result = await validateDesignScreenCompatibility({
      workspaceRoot: workspacePath,
      screen: input,
    });
    await recordDesignModeEvidence({
      workspacePath,
      runId: ctx.runId,
      result,
    });
    return result;
  },
};

export const validateScreenCraftTool: ServerTool<
  z.infer<typeof DesignCompatibilityScreenSchema>,
  ScreenCraftResult
> = {
  name: 'validate_screen_craft',
  description:
    'Run deterministic product UI craft gates for a screen source: data honesty, token usage, accessibility, state coverage, numeric table alignment, form validation, workflow structure, and component reuse. Use after generation or significant screen edits. Returns blocking/should-fix/advisory findings; it never edits files.',
  inputSchema: DesignCompatibilityScreenSchema,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    // Carry the modal surface when the craft target is the active screen, so
    // its checks are surface-aware (Р-11).
    const active = ctx.activeScreen;
    const targetsActiveScreen =
      active != null &&
      ((input.screenId != null && input.screenId === active.id) ||
        (input.implementationFilePath != null &&
          input.implementationFilePath === active.implementationFilePath) ||
        (input.filePath != null && input.filePath === active.filePath));
    const result = await validateScreenCraft({
      workspaceRoot: workspacePath,
      screen: input,
      componentPack: ctx.componentPack,
      screenReadiness: ctx.screenReadiness,
      profile: ctx.screenCraftProfile,
      ...(targetsActiveScreen ? { surface: screenSurface(active) } : {}),
    });
    await recordCraftReceiptSafely(ctx, [result]);
    return result;
  },
};
