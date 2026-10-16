/**
 * Managed modal-size apply (0132.3, Р-17). One endpoint edits the modal window's
 * size contract deterministically, per profile:
 *   - HTML: the bounded start-tag rewriter (modal-size-rewrite).
 *   - JSX/TSX: locate the single `data-sd-modal-window` element and edit it with
 *     the normal `set-style-prop` / `set-prop` ops (ast-bridge now unwraps the
 *     `as React.CSSProperties` cast the custom properties need).
 * 0/2 markers block with an actionable error; a baseline hash guards against a
 * racing edit (409).
 */
import { createHash } from 'node:crypto';
import { applyOps, locateJsxAttributeElements, type Op } from '@sber-designer/ast-bridge';
import {
  MODAL_CONTENT_ATTR,
  MODAL_HEIGHT_VAR,
  MODAL_WIDTH_VAR,
  MODAL_WINDOW_MARKER,
  parseModalDimension,
} from '@sber-designer/shared-types';

import { readWorkspaceFile, writeWorkspaceFile } from './safe-fs';
import { markStorybookReloadPendingForPath } from './storybook-reload';
import { touchScreensForWorkspacePaths } from './project-store';
import { rewriteHtmlModalSize, type ModalSizePatch } from './modal-size-rewrite';

export interface ApplyModalSizeInput {
  workspaceRoot: string;
  filePath: string;
  patch: ModalSizePatch;
  baseline?: { hash: string };
}

export interface ApplyModalSizeResult {
  ok: true;
  changedFiles: string[];
  diff: { path: string; before: string; after: string };
  baseline: { filePath: string; hash: string };
}

export async function readModalSizeBaseline(input: {
  workspaceRoot: string;
  filePath: string;
}): Promise<{ filePath: string; hash: string }> {
  const contents = await readWorkspaceFile(input.workspaceRoot, input.filePath);
  return { filePath: input.filePath, hash: sha256(contents) };
}

function apiError(message: string, status: 409 | 422, code: string): Error {
  const error = new Error(message);
  Object.assign(error, { status, code });
  return error;
}

function normalizePatch(patch: ModalSizePatch): ModalSizePatch {
  const normalized: ModalSizePatch = {};
  if (patch.width !== undefined) {
    const parsed = parseModalDimension(patch.width, { allowAuto: false });
    if (!parsed.ok || !parsed.value)
      throw apiError(`Invalid modal width "${patch.width}".`, 422, 'modal_size_invalid');
    normalized.width = parsed.value;
  }
  if (patch.height !== undefined) {
    const parsed = parseModalDimension(patch.height, { allowAuto: true });
    if (!parsed.ok || !parsed.value)
      throw apiError(`Invalid modal height "${patch.height}".`, 422, 'modal_size_invalid');
    normalized.height = parsed.value;
  }
  if (patch.longContent !== undefined) {
    if (patch.longContent !== 'scroll' && patch.longContent !== 'grow') {
      throw apiError(
        `Invalid long-content mode "${patch.longContent}".`,
        422,
        'modal_size_invalid',
      );
    }
    normalized.longContent = patch.longContent;
  }
  if (
    normalized.width === undefined &&
    normalized.height === undefined &&
    normalized.longContent === undefined
  ) {
    throw apiError('No modal size change was provided.', 422, 'modal_size_empty');
  }
  return normalized;
}

export async function applyModalSize(input: ApplyModalSizeInput): Promise<ApplyModalSizeResult> {
  const patch = normalizePatch(input.patch);
  const before = await readWorkspaceFile(input.workspaceRoot, input.filePath);
  if (input.baseline && sha256(before) !== input.baseline.hash) {
    throw apiError(
      'Source changed since this modal draft was created. Reload before applying.',
      409,
      'modal_size_conflict',
    );
  }

  if (isHtmlPath(input.filePath)) {
    const result = rewriteHtmlModalSize(before, patch);
    if (!result.ok || result.html === undefined) throw mapRewriteError(result.error);
    await writeWorkspaceFile(input.workspaceRoot, input.filePath, result.html);
  } else {
    const locations = locateJsxAttributeElements(before, MODAL_WINDOW_MARKER);
    if (locations.length === 0) throw mapRewriteError('no-marker');
    if (locations.length > 1) throw mapRewriteError('ambiguous-marker');
    const loc = locations[0]!;
    const ops: Op[] = [];
    if (patch.width !== undefined) {
      ops.push({
        kind: 'set-style-prop',
        file: input.filePath,
        loc,
        name: MODAL_WIDTH_VAR,
        value: JSON.stringify(patch.width),
      });
    }
    if (patch.height !== undefined) {
      ops.push({
        kind: 'set-style-prop',
        file: input.filePath,
        loc,
        name: MODAL_HEIGHT_VAR,
        value: JSON.stringify(patch.height),
      });
    }
    if (patch.longContent !== undefined) {
      ops.push({
        kind: 'set-prop',
        file: input.filePath,
        loc,
        name: MODAL_CONTENT_ATTR,
        value: JSON.stringify(patch.longContent),
      });
    }
    await applyOps({ workspaceRoot: input.workspaceRoot, ops });
  }

  const after = await readWorkspaceFile(input.workspaceRoot, input.filePath).catch(() => '');
  markStorybookReloadPendingForPath(input.filePath, false);
  await touchScreensForWorkspacePaths(input.workspaceRoot, [input.filePath]).catch(() => undefined);
  return {
    ok: true,
    changedFiles: [input.filePath],
    diff: { path: input.filePath, before, after },
    baseline: { filePath: input.filePath, hash: sha256(after) },
  };
}

function mapRewriteError(error: string | undefined): Error {
  switch (error) {
    case 'no-marker':
      return apiError(
        `This screen has no ${MODAL_WINDOW_MARKER} element. Ask the assistant to restore the modal size contract.`,
        422,
        'modal_size_unmanaged',
      );
    case 'ambiguous-marker':
      return apiError(
        `This screen has more than one ${MODAL_WINDOW_MARKER}; the size contract is ambiguous.`,
        422,
        'modal_size_ambiguous',
      );
    case 'invalid-value':
      return apiError('Invalid modal size value.', 422, 'modal_size_invalid');
    default:
      return apiError('Could not apply the modal size change.', 422, 'modal_size_failed');
  }
}

function isHtmlPath(filePath: string): boolean {
  return /\.html?$/iu.test(filePath);
}

function sha256(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}
