/**
 * 0083 Phase 2 — component description interview tools (sidecar-first).
 *
 *   list_undescribed_components       — ranked queue of what to describe next.
 *   write_component_description       — persist a confirmed layer to the sidecar.
 *   get_component_description_source  — read back the authored source (debug).
 *
 * These power the `ai-description-layer` interview role. `write_component_description`
 * always writes the sidecar (`.sber-designer/components/<id>.md`); with
 * `target: storybook|auto` it additionally merges the description into the CSF
 * story (Phase 3.1), falling back to sidecar-only when unsafe. Recompiling the
 * machine usage-cards/description-map is done by `request_project_reindex`.
 */
import { z } from 'zod';
import { DESIGN_INDEX_PATHS, type IndexedComponentRecord } from '@sber-designer/design-indexer';
import {
  descriptionLayerToMarkdown,
  extractStorybookUsageMetadata,
} from '@sber-designer/storybook-indexer';
import type { ComponentDescriptionLayer } from '@sber-designer/shared-types';
import {
  GetComponentDescriptionSourceInput,
  ListUndescribedInput,
  WriteComponentDescriptionInput,
  listUndescribedComponentsForWorkspace,
  writeComponentDescriptionSidecarForWorkspace,
} from '@sber-designer/proj-mcp/component-description-core';

import { readWorkspaceFile, writeWorkspaceFile } from '../../safe-fs';
import { markStorybookReloadPendingForPath } from '../../storybook-reload';
import { applyDescriptionToCsfSource } from '../../storybook/description-source-write';
import {
  writeHtmlDesignSystemDescription,
  type HtmlDesignSystemDescriptionWriteResult,
} from '../../html-design-system-description-write';
import {
  compareableLayer,
  readComponentDescriptionSource,
} from '../../component-description-source';
import { recordToolReceiptSafely } from '../run-recorder';
import type { ServerTool, ToolContext } from '../types';
import { normalizeSearch, readProjectIndexJsonl } from './project-index-data';
import { requireWorkspace } from './shared';

async function readComponents(workspacePath: string): Promise<IndexedComponentRecord[]> {
  return readProjectIndexJsonl<IndexedComponentRecord>(
    workspacePath,
    DESIGN_INDEX_PATHS.components,
  );
}

function findComponent(
  components: IndexedComponentRecord[],
  needle: string,
): IndexedComponentRecord | undefined {
  const query = normalizeSearch(needle);
  return components.find(
    (component) =>
      normalizeSearch(component.id) === query ||
      normalizeSearch(component.title) === query ||
      normalizeSearch(component.shortName) === query,
  );
}

export const listUndescribedComponents: ServerTool<
  z.infer<typeof ListUndescribedInput>,
  unknown
> = {
  name: 'list_undescribed_components',
  description:
    'Ranked queue for the description interview: components without an authored Description for AI layer, most-used first. Returns componentId, shortName, status (mined-draft | missing), usageCount, and source path. Call get_usage_card per component for the mined draft.',
  inputSchema: ListUndescribedInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    return listUndescribedComponentsForWorkspace(input, workspacePath);
  },
};

interface StorybookWriteOutcome {
  written: boolean;
  filePath?: string;
  reason?: string;
  /** Authored fields the round-trip verified made it into the story (R5). */
  roundTripFields?: string[];
}

function verifyRoundTrip(
  authored: ComponentDescriptionLayer,
  parsed: ComponentDescriptionLayer | null | undefined,
): { ok: boolean; fields: string[] } {
  const a = compareableLayer(authored);
  const b = compareableLayer(parsed);
  const fields: string[] = [];
  let ok = true;
  for (const key of [
    'purpose',
    'keywords',
    'requiredProps',
    'variantGuidance',
    'canonicalSnippets',
  ] as const) {
    const value = a[key];
    const authoredHas = Array.isArray(value) ? value.length > 0 : Boolean(value);
    if (!authoredHas) continue;
    fields.push(key);
    if (JSON.stringify(value) !== JSON.stringify(b[key])) ok = false;
  }
  return { ok, fields };
}

/**
 * 0083 Phase 3.1 — merge the description into the component's CSF story, with a
 * round-trip gate: write, re-read via the indexer, and revert if it does not
 * parse back to the authored layer. Any unsafe case returns `written: false` so
 * the caller keeps the sidecar as the source of truth.
 */
async function writeStorybookDescription(
  workspacePath: string,
  component: IndexedComponentRecord,
  layer: ComponentDescriptionLayer,
): Promise<StorybookWriteOutcome> {
  const filePath = component.filePath;
  if (!filePath || !/\.stories\.[jt]sx?$/.test(filePath)) {
    return { written: false, reason: 'no_story_file' };
  }
  let original: string;
  try {
    original = await readWorkspaceFile(workspacePath, filePath);
  } catch {
    return { written: false, reason: 'story_unreadable' };
  }
  const applied = applyDescriptionToCsfSource({
    source: original,
    filePath,
    markdown: descriptionLayerToMarkdown(layer),
  });
  if (!applied.ok || !applied.newSource) {
    return { written: false, reason: applied.reason ?? 'apply_failed' };
  }
  await writeWorkspaceFile(workspacePath, filePath, applied.newSource);
  // Round-trip gate: the written source must parse back to the authored layer.
  const back = await extractStorybookUsageMetadata({
    workspaceRoot: workspacePath,
    importPath: filePath,
  });
  const roundTrip = verifyRoundTrip(layer, back.component?.descriptionLayer);
  if (!roundTrip.ok) {
    await writeWorkspaceFile(workspacePath, filePath, original); // revert
    return { written: false, reason: 'round_trip_failed', roundTripFields: roundTrip.fields };
  }
  markStorybookReloadPendingForPath(filePath, false);
  return { written: true, filePath, roundTripFields: roundTrip.fields };
}

export const writeComponentDescription: ServerTool<
  z.infer<typeof WriteComponentDescriptionInput>,
  unknown
> = {
  name: 'write_component_description',
  description:
    'Persist a confirmed Description for AI layer for one component. Always writes the canonical sidecar .sber-designer/components/<id>.md (human markdown + a machine sberDesigner block). Optional target "storybook" projects it into CSF docs, "design-system" projects it into managed design-system/index.html, and "auto" resolves by component model. Unsafe projections fall back to sidecar-only. After a pass, call request_project_reindex to recompile usage-cards and the description-map.',
  inputSchema: WriteComponentDescriptionInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const sidecarWrite = await writeComponentDescriptionSidecarForWorkspace(input, workspacePath);
    const { component, layer, target } = sidecarWrite;
    // The sidecar is always written — it is the canonical source in every
    // profile; Storybook and design-system/index.html are projections.
    const changedFiles = [...sidecarWrite.changedFiles];

    let storybook: StorybookWriteOutcome | undefined;
    if (target === 'storybook') {
      storybook = await writeStorybookDescription(workspacePath, component, layer);
      if (storybook.written && storybook.filePath) changedFiles.push(storybook.filePath);
    }

    let designSystem: HtmlDesignSystemDescriptionWriteResult | undefined;
    if (target === 'design-system') {
      designSystem = await writeHtmlDesignSystemDescription({
        workspacePath,
        component,
        layer,
      });
      if (designSystem.written) changedFiles.push(designSystem.filePath);
    }

    await recordToolReceiptSafely({
      workspacePath,
      runId: ctx.runId,
      tool: 'write_component_description',
      status: 'ok',
      changedFiles,
      summary: `Wrote Description for AI for ${component.shortName} (${layer.status})${
        storybook?.written ? ' + Storybook story' : ''
      }${designSystem?.written ? ' + design-system preview' : ''}.`,
      metadata: {
        componentId: component.id,
        status: layer.status,
        ...(storybook ? { storybookWritten: storybook.written } : {}),
        ...(designSystem ? { designSystemWritten: designSystem.written } : {}),
      },
    });
    return {
      ...sidecarWrite.publicResult,
      ...(storybook
        ? {
            storybook: storybook.written
              ? { written: true, filePath: storybook.filePath, verified: storybook.roundTripFields }
              : {
                  written: false,
                  reason: storybook.reason,
                  fellBackToSidecar: true,
                  ...(storybook.roundTripFields ? { verified: storybook.roundTripFields } : {}),
                },
          }
        : {}),
      ...(designSystem
        ? {
            designSystem: designSystem.written
              ? {
                  written: true,
                  filePath: designSystem.filePath,
                  block: designSystem.block,
                  verified: designSystem.roundTripFields,
                }
              : {
                  written: false,
                  reason: designSystem.reason,
                  fellBackToSidecar: true,
                  ...(designSystem.roundTripFields
                    ? { verified: designSystem.roundTripFields }
                    : {}),
                },
          }
        : {}),
    };
  },
};

export const getComponentDescriptionSource: ServerTool<
  z.infer<typeof GetComponentDescriptionSourceInput>,
  unknown
> = {
  name: 'get_component_description_source',
  description:
    'Read back the authored Description for AI source for one component (sidecar layer + readable markdown) for review/debug. Distinct from get_usage_card, which returns the compiled, prompt-ready cache.',
  inputSchema: GetComponentDescriptionSourceInput,
  handler: async (input, ctx: ToolContext) => {
    const workspacePath = requireWorkspace(ctx);
    const components = await readComponents(workspacePath);
    const component = findComponent(components, input.componentId);
    if (!component) throw new Error(`Indexed component not found: ${input.componentId}`);
    return readComponentDescriptionSource(workspacePath, component);
  },
};
