import { definedJson } from '../defined-json';
import { Hono } from 'hono';
import { z } from 'zod';

import { audit } from '../audit';
import { getUser } from '../auth';
import { getProject } from '../project-store';
import {
  dedupeTasks,
  extractCommentTasks,
  fetchTrackerTasks,
  testTrackerConnection,
  trackerEnvStatus,
} from '../task-tracker';

const TaskTrackerConfigSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('linear'),
      projectUrl: z.string().min(1),
      labelFilter: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('jira'),
      projectUrl: z.string().min(1),
      projectKey: z.string().optional(),
    })
    .strict(),
]);

export const tasksRouter = new Hono()
  .get('/', async (c) => {
    const user = getUser(c);
    const project = getProject();
    const commentTasks = extractCommentTasks(project);
    let trackerTasks: typeof commentTasks = [];
    let trackerError: string | null = null;

    if (project.taskTracker) {
      try {
        trackerTasks = await fetchTrackerTasks(project.taskTracker, project);
      } catch (err) {
        trackerError = err instanceof Error ? err.message : String(err);
        audit({ kind: 'error', user, errorMessage: `tracker tasks fetch: ${trackerError}` });
      }
    }

    const tasks = dedupeTasks([...trackerTasks, ...commentTasks]);
    audit({
      kind: 'config',
      user,
      errorMessage: `tasks fetched total=${tasks.length} tracker=${trackerTasks.length} comments=${commentTasks.length}${trackerError ? ` trackerError=${trackerError}` : ''}`,
    });
    return c.json({ tasks, ...(trackerError ? { trackerError } : {}) });
  })
  .get('/check-env', (c) => {
    const type = c.req.query('type');
    if (type !== 'linear' && type !== 'jira') {
      return c.json({ error: 'invalid_tracker_type', detail: 'type must be linear or jira' }, 400);
    }
    return c.json(trackerEnvStatus(type));
  })
  .post('/test-connection', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parsed = TaskTrackerConfigSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }

    try {
      const result = await testTrackerConnection(definedJson(parsed.data));
      audit({
        kind: 'config',
        user,
        errorMessage: `tracker test type=${parsed.data.type} ok=${result.ok} count=${result.taskCount ?? 0}`,
      });
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `tracker test: ${message}` });
      return c.json({ ok: false, message }, 422);
    }
  });
