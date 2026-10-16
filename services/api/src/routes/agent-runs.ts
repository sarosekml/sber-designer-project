import { Hono } from 'hono';
import { z } from 'zod';

import { getUser } from '../auth';
import { listPendingAgentPermissionRequests } from '../agent/permission-requests';
import { getAgentRunCoordinator } from '../agent/run-coordinator';
import {
  buildRunEvidenceExportManifest,
  AgentRunFeedbackError,
  AgentRunReviewError,
  readAgentRunReceipts,
  readAgentRunFeedback,
  readAgentRunReview,
  readRecordedComponentPack,
  readRunManifest,
  recordComponentSelectionUpdate,
  recordToolReceiptSafely,
  saveAgentRunFeedback,
  markAgentRunReviewed,
  writeRunManifest,
  type AgentRunRenderProofDiagnostics,
  type AgentToolReceipt,
} from '../agent/run-recorder';
import {
  ComponentSelectionUpdateError,
  updateTaskRelevantComponentSelection,
} from '../component-intelligence/component-reselection';
import { publish } from '../event-bus';
import { getState } from '../state-store';
import {
  recordRuntimeRenderHealthSafely,
  renderProofDiagnosticsFromHealth,
} from './chat-stream/render-health';

const AgentRunFeedbackSchema = z
  .object({
    rating: z.enum(['up', 'down']),
    reason: z.string().max(240).nullable().optional(),
  })
  .strict();

const ComponentSelectionUpdateSchema = z
  .object({
    action: z.enum(['add', 'replace']),
    role: z.string().min(1),
    componentId: z.string().min(1),
    replaceComponentId: z.string().min(1).optional(),
    reason: z.string().min(1).max(500),
  })
  .strict();

export const agentRunsRouter = new Hono()
  .get('/active', (c) => {
    const user = getUser(c);
    const runs = getAgentRunCoordinator().activeRuns();
    const pendingPermissions = listPendingAgentPermissionRequests({ user }).map((request) => {
      const run = runs.find(
        (candidate) =>
          (request.runId && candidate.runId === request.runId) ||
          candidate.clientRunId === request.runId,
      );
      return {
        ...request,
        ...(run
          ? {
              clientRunId: run.clientRunId,
              sessionId: run.sessionId,
              screenId: run.screenId,
            }
          : {}),
      };
    });
    return c.json({ runs, pendingPermissions });
  })
  .get('/:runId/evidence', async (c) => {
    const runId = c.req.param('runId');
    const workspacePath = getState().workspacePath;
    if (!workspacePath) {
      return c.json(
        {
          error: 'workspace_not_connected',
          detail: 'Connect a project workspace before exporting agent run evidence.',
        },
        400,
      );
    }
    try {
      return c.json(await buildRunEvidenceExportManifest(workspacePath, runId));
    } catch (error) {
      return c.json(
        {
          error: 'agent_run_not_found',
          detail: error instanceof Error ? error.message : `Agent run "${runId}" was not found.`,
        },
        404,
      );
    }
  })
  .get('/:runId/feedback', async (c) => {
    const runId = c.req.param('runId');
    const workspacePath = getState().workspacePath;
    if (!workspacePath) {
      return c.json(
        {
          error: 'workspace_not_connected',
          detail: 'Connect a project workspace before reading agent run feedback.',
        },
        400,
      );
    }
    const manifest = await readRunManifest(workspacePath, runId);
    if (!manifest) {
      return c.json(
        { error: 'agent_run_not_found', detail: `Agent run "${runId}" was not found.` },
        404,
      );
    }
    return c.json({ feedback: await readAgentRunFeedback(workspacePath, runId) });
  })
  .post('/:runId/feedback', async (c) => {
    const runId = c.req.param('runId');
    const workspacePath = getState().workspacePath;
    if (!workspacePath) {
      return c.json(
        {
          error: 'workspace_not_connected',
          detail: 'Connect a project workspace before saving agent run feedback.',
        },
        400,
      );
    }
    const raw = await c.req.json().catch(() => null);
    const parsed = AgentRunFeedbackSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    try {
      const feedback = await saveAgentRunFeedback({
        workspacePath,
        runId,
        rating: parsed.data.rating,
        ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}),
      });
      return c.json({ feedback });
    } catch (error) {
      if (error instanceof AgentRunFeedbackError) {
        const status =
          error.code === 'run_not_found' ? 404 : error.code === 'run_not_terminal' ? 409 : 400;
        return c.json({ error: error.code, detail: error.message }, status);
      }
      return c.json(
        {
          error: 'run_feedback_failed',
          detail: error instanceof Error ? error.message : String(error),
        },
        422,
      );
    }
  })
  .get('/:runId/review', async (c) => {
    const runId = c.req.param('runId');
    const workspacePath = getState().workspacePath;
    if (!workspacePath) {
      return c.json(
        {
          error: 'workspace_not_connected',
          detail: 'Connect a project workspace before reading run review status.',
        },
        400,
      );
    }
    const manifest = await readRunManifest(workspacePath, runId);
    if (!manifest) {
      return c.json(
        { error: 'agent_run_not_found', detail: `Agent run "${runId}" was not found.` },
        404,
      );
    }
    return c.json({ review: await readAgentRunReview(workspacePath, runId) });
  })
  .post('/:runId/review', async (c) => {
    const runId = c.req.param('runId');
    const workspacePath = getState().workspacePath;
    if (!workspacePath) {
      return c.json(
        {
          error: 'workspace_not_connected',
          detail: 'Connect a project workspace before marking a run reviewed.',
        },
        400,
      );
    }
    try {
      const review = await markAgentRunReviewed({
        workspacePath,
        runId,
        reviewer: getUser(c),
      });
      publish({ type: 'project.changed', reason: 'run-reviewed' });
      return c.json({ review });
    } catch (error) {
      if (error instanceof AgentRunReviewError) {
        return c.json(
          { error: error.code, detail: error.message },
          error.code === 'run_not_found' ? 404 : 409,
        );
      }
      return c.json(
        {
          error: 'run_review_failed',
          detail: error instanceof Error ? error.message : String(error),
        },
        422,
      );
    }
  })
  .post('/:runId/render-reprobe', async (c) => {
    const runId = c.req.param('runId');
    const workspacePath = getState().workspacePath;
    if (!workspacePath) {
      return c.json(
        {
          error: 'workspace_not_connected',
          detail: 'Connect a project workspace before re-running render verification.',
        },
        400,
      );
    }
    const manifest = await readRunManifest(workspacePath, runId);
    if (!manifest) {
      return c.json(
        {
          error: 'agent_run_not_found',
          detail: `Agent run "${runId}" was not found.`,
        },
        404,
      );
    }
    const body = await c.req.json().catch(() => ({}));
    const receipts = await readAgentRunReceipts(workspacePath, runId);
    const canvasUrl = selectRenderReprobeCanvasUrl(body, receipts);
    const changedFiles = changedFilesForRenderReprobe(receipts);
    if (!canvasUrl) {
      const renderProof = browserEvidenceRequiredRenderProof();
      await recordToolReceiptSafely({
        workspacePath,
        runId,
        tool: 'runtime_root_probe',
        status: 'skipped',
        changedFiles,
        summary: renderProof.reason,
        metadata: { code: 'browser_evidence_required', renderProof },
      });
      const latest = (await readRunManifest(workspacePath, runId)) ?? manifest;
      await writeRunManifest(workspacePath, {
        ...latest,
        updatedAt: Date.now(),
        diagnostics: {
          ...latest.diagnostics,
          renderProof,
        },
      });
      return c.json({ ok: false, code: 'browser_evidence_required', renderProof }, 202);
    }
    const health = await recordRuntimeRenderHealthSafely({
      workspacePath,
      agentRun: manifest,
      canvasUrl,
      changedFiles,
    });
    const renderProof = renderProofDiagnosticsFromHealth(health, canvasUrl, 2);
    await recordToolReceiptSafely({
      workspacePath,
      runId,
      tool: 'runtime_root_probe',
      status:
        renderProof.status === 'confirmed'
          ? 'ok'
          : renderProof.status === 'failed'
            ? 'error'
            : 'skipped',
      changedFiles,
      summary:
        renderProof.status === 'confirmed'
          ? 'Runtime proof confirmed by re-probe.'
          : `Runtime proof ${renderProof.status}: ${renderProof.reason}`,
      metadata: { renderProof, health, canvasUrl },
    });
    const latest = (await readRunManifest(workspacePath, runId)) ?? manifest;
    await writeRunManifest(workspacePath, {
      ...latest,
      updatedAt: Date.now(),
      diagnostics: {
        ...latest.diagnostics,
        renderProof,
      },
    });
    return c.json({ ok: true, renderProof, health });
  })
  .post('/:runId/component-selection', async (c) => {
    const runId = c.req.param('runId');
    const workspacePath = getState().workspacePath;
    if (!workspacePath) {
      return c.json(
        {
          error: 'workspace_not_connected',
          detail: 'Connect a project workspace before updating run component selection.',
        },
        400,
      );
    }
    const parsed = ComponentSelectionUpdateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    const manifest = await readRunManifest(workspacePath, runId);
    if (!manifest) {
      return c.json(
        { error: 'agent_run_not_found', detail: `Agent run "${runId}" was not found.` },
        404,
      );
    }
    if (manifest.status !== 'running') {
      return c.json(
        {
          error: 'agent_run_not_active',
          detail: `Agent run "${runId}" is already ${manifest.status}.`,
        },
        409,
      );
    }
    const componentPack = await readRecordedComponentPack(workspacePath, runId);
    if (!componentPack) {
      return c.json(
        {
          error: 'component_pack_missing',
          detail: `Agent run "${runId}" has no recorded component pack.`,
        },
        409,
      );
    }
    try {
      const result = await updateTaskRelevantComponentSelection({
        workspaceRoot: workspacePath,
        componentPack,
        action: parsed.data.action,
        role: parsed.data.role,
        componentId: parsed.data.componentId,
        ...(parsed.data.replaceComponentId
          ? { replaceComponentId: parsed.data.replaceComponentId }
          : {}),
        reason: parsed.data.reason,
      });
      await recordComponentSelectionUpdate({
        workspacePath,
        runId,
        componentPack: result.componentPack,
        change: result.change,
      });
      return c.json({
        ok: true,
        interruption: false,
        userTurnCreated: false,
        change: result.change,
        componentPack: result.componentPack,
      });
    } catch (error) {
      if (error instanceof ComponentSelectionUpdateError) {
        return c.json({ error: error.code, detail: error.message }, 409);
      }
      return c.json(
        {
          error: 'component_selection_update_failed',
          detail: error instanceof Error ? error.message : String(error),
        },
        422,
      );
    }
  })
  .post('/:runId/cancel', (c) => {
    const runId = c.req.param('runId');
    const ok = getAgentRunCoordinator().cancel(runId);
    if (!ok) {
      return c.json(
        { error: 'agent_run_not_active', detail: `Agent run "${runId}" is not active.` },
        404,
      );
    }
    return c.json({ ok: true });
  });

function selectRenderReprobeCanvasUrl(body: unknown, receipts: AgentToolReceipt[]): string | null {
  const bodyCanvasUrl = objectValue(body)?.canvasUrl;
  if (typeof bodyCanvasUrl === 'string' && bodyCanvasUrl.trim()) return bodyCanvasUrl.trim();
  for (const receipt of receipts.slice().reverse()) {
    const canvasUrl = objectValue(receipt.metadata)?.canvasUrl;
    if (typeof canvasUrl === 'string' && canvasUrl.trim()) return canvasUrl.trim();
  }
  return null;
}

function browserEvidenceRequiredRenderProof(): AgentRunRenderProofDiagnostics {
  return {
    status: 'pending',
    attempt: 2,
    checkedAt: new Date().toISOString(),
    reason:
      'Open the screen preview in the browser and retry render proof so sber-designer can execute the canvas runtime.',
    reasonCode: 'browser_evidence_required',
    evidenceSource: 'browser-preview',
    evidenceJsCapable: false,
    canReprobe: false,
  };
}

function changedFilesForRenderReprobe(receipts: AgentToolReceipt[]): string[] {
  const latestRenderHealth = receipts
    .filter((receipt) => receipt.tool === 'runtime_render_health')
    .sort((a, b) => a.createdAt - b.createdAt)
    .at(-1);
  const candidates = latestRenderHealth?.changedFiles.length
    ? latestRenderHealth.changedFiles
    : receipts.flatMap((receipt) => receipt.changedFiles);
  return Array.from(new Set(candidates));
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
