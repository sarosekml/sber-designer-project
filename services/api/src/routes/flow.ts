import { readFile } from 'node:fs/promises';
import { resolveInside } from '@sber-designer/ast-bridge';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  captureFlowScreenPreviews,
  flowPreviewCapturePath,
  normalizeCaptureScreenId,
} from '../flow-preview-capture';
import { getProject } from '../project-store';
import { getState } from '../state-store';

const CaptureInput = z
  .object({
    viewport: z
      .object({
        width: z.number().int().positive().max(4096),
        height: z.number().int().positive().max(4096),
      })
      .strict(),
    screens: z
      .array(
        z
          .object({
            screenId: z.string().min(1),
            url: z.string().url(),
            sourceFingerprint: z.string().min(1),
          })
          .strict(),
      )
      .min(1)
      .max(64),
  })
  .strict();

export const flowRouter = new Hono()
  .post('/previews/screens/capture', async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parse = CaptureInput.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const workspaceRoot = activeWorkspaceRoot();
    if (!workspaceRoot) {
      return c.json(
        { error: 'no_workspace', detail: 'No active workspace. Connect a project first.' },
        400,
      );
    }
    const result = await captureFlowScreenPreviews({
      workspaceRoot,
      chromeDebuggingUrl: process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL,
      screens: parse.data.screens,
      viewport: parse.data.viewport,
    });
    return c.json(result);
  })
  .get('/previews/screens/:fileName', async (c) => {
    const workspaceRoot = activeWorkspaceRoot();
    if (!workspaceRoot) {
      return c.json(
        { error: 'no_workspace', detail: 'No active workspace. Connect a project first.' },
        400,
      );
    }
    let imagePath: string;
    try {
      const fileName = c.req.param('fileName');
      if (!fileName.endsWith('.png')) throw new Error('Preview image must be a PNG file.');
      imagePath = flowPreviewCapturePath(normalizeCaptureScreenId(fileName.slice(0, -4)));
    } catch (err) {
      return c.json(
        { error: 'invalid_input', detail: err instanceof Error ? err.message : String(err) },
        400,
      );
    }

    try {
      const bytes = await readFile(resolveInside(workspaceRoot, imagePath));
      return new Response(bytes, {
        headers: {
          'content-type': 'image/png',
          'cache-control': 'no-cache',
        },
      });
    } catch {
      return c.json({ error: 'preview_not_found', detail: 'Preview image not found.' }, 404);
    }
  });

function activeWorkspaceRoot(): string | null | undefined {
  return getState().workspacePath || getProject().workspacePath || null;
}
