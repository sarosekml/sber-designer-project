import { Hono } from 'hono';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { HTML_DESIGN_SYSTEM_PATHS } from '@sber-designer/shared-types';

import { audit } from '../audit';
import { getUser } from '../auth';
import { resolveCatalog } from '../catalog-cache';
import {
  addProjectComponentNote,
  deleteProjectComponentNote,
  generateProjectDesignIndexFiles,
  loadProjectDesignIndex,
  updateProjectComponentNote,
} from '../design-index';
import { loadProjectDesignSystemBrowser, saveProjectSetupAnswers } from '../design-system-browser';
import { findActiveProjectIndexJob, getProjectIndexJob } from '../project-index/job-store';
import { runProjectIndexJobNow, startProjectIndexJob } from '../project-index/indexing-runner';
import { getProject } from '../project-store';
import { regenerateHtmlDesignSystemPreview } from '../html-design-system-preview';
import {
  materializeHtmlDesignSystemPreset,
  resolveHtmlDesignSystemPresetId,
} from '../html-design-system-presets';
import { writeWorkspaceFile } from '../safe-fs';
import { getState } from '../state-store';
import {
  HTML_DESIGN_SYSTEM_ACCEPTED_REPORT_PATH,
  HTML_DESIGN_SYSTEM_PROPOSAL_FILES,
  HTML_DESIGN_SYSTEM_REPORT_FILE,
  listHtmlDesignSystemProposals,
  readHtmlDesignSystemProposal,
  resolveAcceptedDesignContractTargetPath,
} from './design-index-proposals';

export const designIndexRouter = new Hono()
  .get('/', async (c) => {
    const user = getUser(c);
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const context = await loadProjectDesignIndex(workspacePath);
      audit({
        kind: 'config',
        user,
        errorMessage: `design index status=${context.status} stale=${context.stale} workspace=${workspacePath}`,
      });
      return c.json(context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `design index: ${message}` });
      return c.json({ error: 'design_index_failed', detail: message }, 422);
    }
  })
  .post('/jobs', async (c) => {
    const user = getUser(c);
    const state = getState();
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    const body = (await c.req.json().catch(() => ({}))) as { enrich?: unknown };
    try {
      const project = getProject();
      const existing = findActiveProjectIndexJob(workspacePath);
      const job =
        existing ??
        startProjectIndexJob({
          workspaceRoot: workspacePath,
          projectName: project.name || state.projectName || 'Untitled project',
          enrich: body.enrich === true,
          ...(state.canvasUrl ? { canvasUrl: state.canvasUrl } : {}),
        });
      audit({
        kind: 'config',
        user,
        errorMessage: `${
          existing ? 'reused active' : 'started'
        } design index job id=${job.id} enrich=${job.enrich} workspace=${workspacePath}`,
      });
      return c.json(
        {
          job,
          started: !existing,
          alreadyRunning: Boolean(existing),
          statusEndpoint: `/api/project/design-index/jobs/${job.id}`,
        },
        202,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `start design index job: ${message}` });
      return c.json({ error: 'design_index_job_failed', detail: message }, 422);
    }
  })
  .get('/jobs/:id', async (c) => {
    const job = getProjectIndexJob(c.req.param('id'));
    if (!job) {
      return c.json(
        {
          error: 'job_not_found',
          detail: 'Project index job not found.',
        },
        404,
      );
    }
    return c.json({ job });
  })
  .get('/browser', async (c) => {
    const user = getUser(c);
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const browser = await loadProjectDesignSystemBrowser(workspacePath);
      audit({
        kind: 'config',
        user,
        errorMessage: `loaded design system browser components=${browser.components.length} workspace=${workspacePath}`,
      });
      return c.json(browser);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `design system browser: ${message}` });
      return c.json({ error: 'design_system_browser_failed', detail: message }, 422);
    }
  })
  .post('/profile-answers', async (c) => {
    const user = getUser(c);
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    const body = (await c.req.json().catch(() => null)) as {
      answers?: unknown;
    } | null;
    const answers = Array.isArray(body?.answers)
      ? body.answers.flatMap((item) => {
          if (!item || typeof item !== 'object') return [];
          const record = item as { id?: unknown; answer?: unknown };
          if (typeof record.id !== 'string') return [];
          return [
            {
              id: record.id,
              answer:
                typeof record.answer === 'string' || record.answer === null ? record.answer : null,
            },
          ];
        })
      : [];
    if (answers.length === 0) {
      return c.json(
        {
          error: 'invalid_profile_answers',
          detail: 'At least one setup answer is required.',
        },
        400,
      );
    }

    try {
      const result = await saveProjectSetupAnswers(workspacePath, answers);
      audit({
        kind: 'config',
        user,
        errorMessage: `saved project setup answers changed=${result.changedFiles.join(',') || 'none'} workspace=${workspacePath}`,
      });
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `save project setup answers: ${message}` });
      return c.json({ error: 'profile_answers_failed', detail: message }, 422);
    }
  })
  .post('/html-design-system-sources', async (c) => {
    const user = getUser(c);
    const state = getState();
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    const body = (await c.req.json().catch(() => null)) as {
      sources?: unknown;
      presetId?: unknown;
    } | null;
    const presetId = resolveHtmlDesignSystemPresetId(body?.presetId);
    if (body?.presetId !== undefined && !presetId) {
      return c.json(
        {
          error: 'invalid_html_design_system_preset',
          detail: 'Choose a supported HTML design-system preset.',
        },
        400,
      );
    }
    const manualSources = presetId ? [] : normalizeHtmlDesignSystemSources(body?.sources);
    if (!presetId && manualSources.length === 0) {
      return c.json(
        {
          error: 'invalid_html_design_system_sources',
          detail: 'Paste at least one design-system source file.',
        },
        400,
      );
    }

    try {
      const project = getProject();
      const projectName = project.name || state.projectName || 'Untitled project';
      const sources = presetId
        ? normalizeHtmlDesignSystemSources(materializeHtmlDesignSystemPreset(presetId, projectName))
        : manualSources;
      const changedSourceFiles: string[] = [];
      for (const source of sources) {
        await writeWorkspaceFile(workspacePath, source.filePath, source.contents);
        changedSourceFiles.push(source.filePath);
      }
      const preview = await regenerateHtmlDesignSystemPreview(workspacePath, projectName);
      changedSourceFiles.push(preview.changedFile);
      const job = await runProjectIndexJobNow({
        workspaceRoot: workspacePath,
        projectName,
        enrich: false,
        ...(state.canvasUrl ? { canvasUrl: state.canvasUrl } : {}),
      });
      if (job.status === 'failed') throw new Error(job.error ?? 'Project index generation failed.');
      const browser = await loadProjectDesignSystemBrowser(workspacePath);
      audit({
        kind: 'config',
        user,
        errorMessage: `saved html design-system sources preset=${presetId ?? 'manual'} files=${changedSourceFiles.join(',')} workspace=${workspacePath}`,
      });
      return c.json({
        changedFiles: mergeChangedFiles(changedSourceFiles, job.changedFiles),
        job,
        browser,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `save html design-system sources: ${message}` });
      return c.json({ error: 'html_design_system_sources_failed', detail: message }, 422);
    }
  })
  .post('/html-design-system-preview', async (c) => {
    const user = getUser(c);
    const state = getState();
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const body = (await c.req.json().catch(() => ({}))) as { keepDescriptions?: unknown };
      const project = getProject();
      const projectName = project.name || state.projectName || 'Untitled project';
      const preview = await regenerateHtmlDesignSystemPreview(workspacePath, projectName, {
        keepDescriptions: body.keepDescriptions !== false,
      });
      audit({
        kind: 'config',
        user,
        errorMessage: `regenerated design-system preview tokens=${preview.tokenCount} classes=${preview.componentClassCount} workspace=${workspacePath}`,
      });
      return c.json({
        changedFiles: mergeChangedFiles(
          [preview.changedFile],
          preview.descriptionSections.changedFiles,
        ),
        tokenCount: preview.tokenCount,
        componentClassCount: preview.componentClassCount,
        descriptionSections: preview.descriptionSections,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `regenerate design-system preview: ${message}` });
      return c.json({ error: 'html_design_system_preview_failed', detail: message }, 422);
    }
  })
  .get('/html-design-system-proposals', async (c) => {
    const user = getUser(c);
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const proposals = await listHtmlDesignSystemProposals(workspacePath);
      audit({
        kind: 'config',
        user,
        errorMessage: `listed html design-system proposals count=${proposals.length} workspace=${workspacePath}`,
      });
      return c.json({ proposals });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `list html design-system proposals: ${message}` });
      return c.json({ error: 'html_design_system_proposals_failed', detail: message }, 422);
    }
  })
  .post('/html-design-system-proposals/:id/accept', async (c) => {
    const user = getUser(c);
    const state = getState();
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const proposal = await readHtmlDesignSystemProposal(workspacePath, c.req.param('id'));
      if (!proposal) {
        return c.json(
          {
            error: 'html_design_system_proposal_not_found',
            detail: 'Design-system proposal was not found.',
          },
          404,
        );
      }
      if (!proposal.ready) {
        const styleContractDetail =
          proposal.styleContract.required && !proposal.styleContract.complete
            ? ` The style contract has ${proposal.styleContract.presentSections}/${proposal.styleContract.totalSections} complete sections. ${proposal.styleContract.diagnostics.join(' ')}`
            : '';
        return c.json(
          {
            error: 'html_design_system_proposal_incomplete',
            detail: `Proposal must include Design.md and extraction-report.md before accept. Optional CSS files are copied when present.${styleContractDetail}`,
          },
          400,
        );
      }

      const project = getProject();
      const designContractTargetPath = await resolveAcceptedDesignContractTargetPath(
        workspacePath,
        project.projectKind,
      );
      const changedSourceFiles: string[] = [];
      for (const source of HTML_DESIGN_SYSTEM_PROPOSAL_FILES) {
        const file = proposal.files.find((item) => item.label === source.label);
        if (!file?.exists) continue;
        const targetPath =
          source.label === 'Design.md' ? designContractTargetPath : source.targetPath;
        await writeWorkspaceFile(
          workspacePath,
          targetPath,
          await readFile(join(workspacePath, file.path), 'utf8'),
        );
        changedSourceFiles.push(targetPath);
      }
      const reportContents = await readFile(
        join(proposal.absolutePath, HTML_DESIGN_SYSTEM_REPORT_FILE),
        'utf8',
      ).catch(() => null);
      if (reportContents !== null) {
        await writeWorkspaceFile(
          workspacePath,
          HTML_DESIGN_SYSTEM_ACCEPTED_REPORT_PATH,
          reportContents,
        );
        changedSourceFiles.push(HTML_DESIGN_SYSTEM_ACCEPTED_REPORT_PATH);
      }

      const projectName = project.name || state.projectName || 'Untitled project';
      const preview = await regenerateHtmlDesignSystemPreview(workspacePath, projectName);
      changedSourceFiles.push(preview.changedFile);
      const job = await runProjectIndexJobNow({
        workspaceRoot: workspacePath,
        projectName,
        enrich: false,
        ...(state.canvasUrl ? { canvasUrl: state.canvasUrl } : {}),
      });
      if (job.status === 'failed') throw new Error(job.error ?? 'Project index generation failed.');
      await rm(proposal.absolutePath, { recursive: true, force: true });
      const browser = await loadProjectDesignSystemBrowser(workspacePath);
      const proposals = await listHtmlDesignSystemProposals(workspacePath);
      audit({
        kind: 'config',
        user,
        errorMessage: `accepted html design-system proposal=${proposal.id} files=${changedSourceFiles.join(',')} workspace=${workspacePath}`,
      });
      return c.json({
        changedFiles: mergeChangedFiles(changedSourceFiles, job.changedFiles),
        deletedProposalPath: proposal.filePath,
        job,
        browser,
        proposals,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({
        kind: 'error',
        user,
        errorMessage: `accept html design-system proposal: ${message}`,
      });
      return c.json({ error: 'html_design_system_proposal_accept_failed', detail: message }, 422);
    }
  })
  .delete('/html-design-system-proposals/:id', async (c) => {
    const user = getUser(c);
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const proposal = await readHtmlDesignSystemProposal(workspacePath, c.req.param('id'));
      if (!proposal) {
        return c.json(
          {
            error: 'html_design_system_proposal_not_found',
            detail: 'Design-system proposal was not found.',
          },
          404,
        );
      }
      await rm(proposal.absolutePath, { recursive: true, force: true });
      const proposals = await listHtmlDesignSystemProposals(workspacePath);
      audit({
        kind: 'config',
        user,
        errorMessage: `rejected html design-system proposal=${proposal.id} workspace=${workspacePath}`,
      });
      return c.json({
        deletedProposalPath: proposal.filePath,
        changedFiles: [proposal.filePath],
        proposals,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({
        kind: 'error',
        user,
        errorMessage: `reject html design-system proposal: ${message}`,
      });
      return c.json({ error: 'html_design_system_proposal_reject_failed', detail: message }, 422);
    }
  })
  .post('/generate', async (c) => {
    const user = getUser(c);
    const state = getState();
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const project = getProject();
      const projectName = project.name || state.projectName || 'Untitled project';
      const job = await runProjectIndexJobNow({
        workspaceRoot: workspacePath,
        projectName,
        enrich: false,
        ...(state.canvasUrl ? { canvasUrl: state.canvasUrl } : {}),
      });
      if (job.status === 'failed') throw new Error(job.error ?? 'Project index generation failed.');
      audit({
        kind: 'config',
        user,
        errorMessage: `generated design index changed=${job.changedFiles.join(',') || 'none'} workspace=${workspacePath}`,
      });
      return c.json({ changedFiles: job.changedFiles, context: job.context, job });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `generate design index: ${message}` });
      return c.json({ error: 'design_index_generation_failed', detail: message }, 422);
    }
  })
  .post('/component-notes', async (c) => {
    const user = getUser(c);
    const state = getState();
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    const body = (await c.req.json().catch(() => null)) as {
      componentId?: unknown;
      note?: unknown;
      intent?: unknown;
      storybookTitle?: unknown;
      sourcePath?: unknown;
    } | null;
    const componentId = typeof body?.componentId === 'string' ? body.componentId.trim() : '';
    const noteText = typeof body?.note === 'string' ? body.note.trim() : '';
    const intent = normalizeNoteIntent(body?.intent);
    if (!componentId || !noteText) {
      return c.json(
        {
          error: 'invalid_component_note',
          detail: 'componentId and note are required.',
        },
        400,
      );
    }

    try {
      const project = getProject();
      const projectName = project.name || state.projectName || 'Untitled project';
      const catalogResult = await resolveCatalog({
        workspacePath,
        bypass: true,
        ...(state.canvasUrl ? { canvasUrl: state.canvasUrl } : {}),
      });
      const catalog = 'catalog' in catalogResult ? catalogResult.catalog : null;
      const catalogComponent = catalog?.components.find(
        (component) => component.id === componentId,
      );
      const bodyStorybookTitle =
        typeof body?.storybookTitle === 'string' ? body.storybookTitle.trim() : '';
      const bodySourcePath = typeof body?.sourcePath === 'string' ? body.sourcePath.trim() : '';
      const storybookTitle = catalogComponent?.title ?? bodyStorybookTitle;
      const sourcePath = catalogComponent?.filePath ?? bodySourcePath;
      const added = await addProjectComponentNote(workspacePath, {
        componentId,
        note: noteText,
        intent,
        ...(storybookTitle ? { storybookTitle } : {}),
        ...(sourcePath ? { sourcePath } : {}),
      });
      const result = await generateProjectDesignIndexFiles(workspacePath, {
        projectName,
        catalog,
      });
      audit({
        kind: 'config',
        user,
        errorMessage: `added component AI note component=${componentId} workspace=${workspacePath}`,
      });
      return c.json({
        note: added.note,
        context: result.context,
        changedFiles: result.changedFiles,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `add component AI note: ${message}` });
      return c.json({ error: 'component_note_failed', detail: message }, 422);
    }
  })
  .patch('/component-notes/:id', async (c) => {
    const user = getUser(c);
    const state = getState();
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    const body = (await c.req.json().catch(() => null)) as {
      note?: unknown;
      intent?: unknown;
    } | null;
    const noteText = typeof body?.note === 'string' ? body.note.trim() : '';
    const intent = normalizeNoteIntent(body?.intent);
    if (!noteText) {
      return c.json(
        {
          error: 'invalid_component_note',
          detail: 'note is required.',
        },
        400,
      );
    }

    try {
      const project = getProject();
      const projectName = project.name || state.projectName || 'Untitled project';
      const catalogResult = await resolveCatalog({
        workspacePath,
        bypass: true,
        ...(state.canvasUrl ? { canvasUrl: state.canvasUrl } : {}),
      });
      const catalog = 'catalog' in catalogResult ? catalogResult.catalog : null;
      const updated = await updateProjectComponentNote(workspacePath, {
        id: c.req.param('id'),
        note: noteText,
        intent,
      });
      const result = await generateProjectDesignIndexFiles(workspacePath, {
        projectName,
        catalog,
      });
      audit({
        kind: 'config',
        user,
        errorMessage: `updated component AI note id=${updated.note.id} workspace=${workspacePath}`,
      });
      return c.json({
        note: updated.note,
        context: result.context,
        changedFiles: result.changedFiles,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `update component AI note: ${message}` });
      return c.json({ error: 'component_note_failed', detail: message }, 422);
    }
  })
  .delete('/component-notes/:id', async (c) => {
    const user = getUser(c);
    const state = getState();
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const project = getProject();
      const projectName = project.name || state.projectName || 'Untitled project';
      const catalogResult = await resolveCatalog({
        workspacePath,
        bypass: true,
        ...(state.canvasUrl ? { canvasUrl: state.canvasUrl } : {}),
      });
      const catalog = 'catalog' in catalogResult ? catalogResult.catalog : null;
      const deleted = await deleteProjectComponentNote(workspacePath, c.req.param('id'));
      const result = await generateProjectDesignIndexFiles(workspacePath, {
        projectName,
        catalog,
      });
      audit({
        kind: 'config',
        user,
        errorMessage: `deleted component AI note id=${c.req.param('id')} workspace=${workspacePath}`,
      });
      return c.json({
        ...deleted,
        context: result.context,
        changedFiles: result.changedFiles,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `delete component AI note: ${message}` });
      return c.json({ error: 'component_note_failed', detail: message }, 422);
    }
  });

function resolveWorkspacePath(explicitWorkspacePath: string | null | undefined): string | null {
  const state = getState();
  return explicitWorkspacePath ?? state.workspacePath ?? null;
}

function normalizeHtmlDesignSystemSources(
  value: unknown,
): { filePath: string; contents: string }[] {
  if (!value || typeof value !== 'object') return [];
  const record = value as {
    designMd?: unknown;
    tokensCss?: unknown;
    componentsCss?: unknown;
    designSystemHtml?: unknown;
  };
  return [
    normalizeHtmlDesignSystemSource(HTML_DESIGN_SYSTEM_PATHS.designMd, record.designMd),
    normalizeHtmlDesignSystemSource(HTML_DESIGN_SYSTEM_PATHS.tokensCss, record.tokensCss),
    normalizeHtmlDesignSystemSource(HTML_DESIGN_SYSTEM_PATHS.componentsCss, record.componentsCss),
  ].flatMap((item) => (item ? [item] : []));
}

function normalizeHtmlDesignSystemSource(
  filePath: string,
  value: unknown,
): { filePath: string; contents: string } | null {
  if (typeof value !== 'string') return null;
  const contents = value.trimEnd();
  if (!contents.trim()) return null;
  return { filePath, contents: `${contents}\n` };
}

function mergeChangedFiles(first: string[], second: string[]): string[] {
  return Array.from(new Set([...first, ...second]));
}

function normalizeNoteIntent(
  value: unknown,
): 'prefer' | 'avoid' | 'requirement' | 'deprecated' | 'usage' | 'other' {
  if (
    value === 'prefer' ||
    value === 'avoid' ||
    value === 'requirement' ||
    value === 'deprecated' ||
    value === 'usage' ||
    value === 'other'
  ) {
    return value;
  }
  return 'usage';
}
