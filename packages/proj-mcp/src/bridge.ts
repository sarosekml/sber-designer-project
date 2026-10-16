/**
 * EditorBridge backed by services/api (ADR-0010).
 *
 * Uses HTTP, not WebSocket — proj-mcp is short-lived per-tool-call from
 * Claude Code's perspective, and a stateless POST is simpler. Events
 * flow services/api → editor over WS; we just push to the bus.
 */
import type {
  CatalogSnapshot,
  ComponentSelectionBridgeInput,
  CreateScreenBridgeInput,
  EditorBridge,
  EditorSelection,
} from './context';

export interface HttpBridgeOptions {
  apiUrl: string;
  workspacePath?: string;
  user?: string;
  serviceToken?: string;
  fetchImpl?: typeof fetch;
}

export function createHttpBridge(opts: HttpBridgeOptions): EditorBridge {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const authHeaders: Record<string, string> = opts.serviceToken
    ? { 'x-sber-designer-service-token': opts.serviceToken }
    : { 'x-sber-designer-user': opts.user ?? 'proj-mcp' };
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...authHeaders,
  };

  const publish = async (event: unknown) => {
    const url = opts.apiUrl.replace(/\/+$/, '') + '/api/events/publish';
    const res = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`api ${res.status}: ${text.slice(0, 200)}`);
    }
  };

  const markStorybookReloadPending = async (path: string) => {
    const stateUrl = opts.apiUrl.replace(/\/+$/, '') + '/api/state';
    const stateRes = await fetchImpl(stateUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        storybookReloadPending: true,
        ...(opts.workspacePath ? { workspacePath: opts.workspacePath } : {}),
      }),
    });
    if (!stateRes.ok) {
      const text = await stateRes.text().catch(() => '');
      throw new Error(`api ${stateRes.status}: ${text.slice(0, 200)}`);
    }
    await publish({ type: 'storybook.reload-pending', path });
  };

  const loadProject = async () => {
    const url = opts.apiUrl.replace(/\/+$/, '') + '/api/project';
    const res = await fetchImpl(url, {
      headers: authHeaders,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`api ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as {
      version: 1;
      name: string;
      workspacePath: string;
      screens?: {
        id: string;
        name: string;
        kind: 'story' | 'page';
        storyId?: string;
        filePath?: string;
        implementationFilePath?: string;
        folder?: string;
        description?: string;
      }[];
      [key: string]: unknown;
    };
  };

  const saveProject = async (project: Record<string, unknown>) => {
    const url = opts.apiUrl.replace(/\/+$/, '') + '/api/project';
    const res = await fetchImpl(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(project),
    });
    const data = (await res.json().catch(() => ({}))) as {
      screens?: { id: string; name: string }[];
      error?: string;
      detail?: string;
    };
    if (!res.ok) {
      const reason = data.detail ?? data.error ?? `HTTP ${res.status}`;
      throw new Error(`project save failed: ${reason}`);
    }
    return data;
  };

  return {
    async postMessage(text) {
      await publish({ type: 'editor.message', text, source: 'proj-mcp' });
    },
    async announceToolCall(tool, argsSummary) {
      await publish({ type: 'proj-mcp.tool-call', tool, argsSummary });
    },
    async getSelection() {
      const url = new URL(opts.apiUrl.replace(/\/+$/, '') + '/api/state');
      if (opts.workspacePath) url.searchParams.set('workspacePath', opts.workspacePath);
      const res = await fetchImpl(url, {
        headers: authHeaders,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`api ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as { selection?: EditorSelection | null };
      return data.selection ?? null;
    },
    async applyPatch(input) {
      const url = opts.apiUrl.replace(/\/+$/, '') + '/api/patch';
      const res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: true;
        changedFiles?: string[];
        ops?: { kind: string; file: string }[];
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.ok) {
        const reason = data.detail ?? data.error ?? `HTTP ${res.status}`;
        throw new Error(`patch failed: ${reason}`);
      }
      return {
        ok: true,
        changedFiles: data.changedFiles ?? [],
        ops: data.ops ?? [],
      };
    },
    async markStorybookReloadPending(path) {
      await markStorybookReloadPending(path);
    },
    async createScreen(input: CreateScreenBridgeInput) {
      const project = await loadProject();
      const screens = project.screens ?? [];
      if (
        screens.some(
          (screen) =>
            screen.storyId === input.storyId ||
            screen.filePath === input.filePath ||
            screen.implementationFilePath === input.implementationFilePath,
        )
      ) {
        throw new Error('A screen with this story or source path already exists.');
      }
      const id = `screen-${Date.now()}-${input.storyId.replace(/[^a-z0-9_-]+/giu, '-')}`;
      const screen = {
        id,
        name: input.name,
        kind: 'story' as const,
        storyId: input.storyId,
        filePath: input.filePath,
        implementationFilePath: input.implementationFilePath,
        ...(input.folder ? { folder: input.folder } : {}),
        ...(input.description ? { description: input.description } : {}),
      };
      const saved = await saveProject({
        ...project,
        screens: [...screens, screen],
      });
      await markStorybookReloadPending(input.filePath);
      return {
        ok: true,
        id,
        screens: (saved.screens ?? [...screens, screen]).map((item) => ({
          id: item.id,
          name: item.name,
        })),
      };
    },
    async sendPr(input) {
      const url = opts.apiUrl.replace(/\/+$/, '') + '/api/git/send-pr';
      const res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: true;
        branch?: string;
        committed?: boolean;
        prUrl?: string | null;
        note?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.ok) {
        const reason = data.detail ?? data.error ?? `HTTP ${res.status}`;
        throw new Error(`send-pr failed: ${reason}`);
      }
      return {
        ok: true,
        branch: data.branch ?? '',
        committed: Boolean(data.committed),
        prUrl: data.prUrl ?? null,
        ...(data.note ? { note: data.note } : {}),
      };
    },
    async requestProjectReindex(input) {
      const url = new URL(opts.apiUrl.replace(/\/+$/, '') + '/api/project/design-index/jobs');
      url.searchParams.set('workspacePath', input.workspacePath);
      const res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: input.reason }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        job?: { id?: string };
        started?: boolean;
        alreadyRunning?: boolean;
        statusEndpoint?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.job?.id) {
        const reason = data.detail ?? data.error ?? `HTTP ${res.status}`;
        throw new Error(`project reindex failed: ${reason}`);
      }
      return {
        started: data.started ?? res.status === 202,
        alreadyRunning: data.alreadyRunning ?? false,
        jobId: data.job.id,
        statusEndpoint: data.statusEndpoint ?? `/api/project/design-index/jobs/${data.job.id}`,
        reason: input.reason ?? 'Project index may be stale or missing.',
        message: data.alreadyRunning
          ? 'Project re-index is already running; poll the status endpoint for completion.'
          : 'Project re-index started; poll the status endpoint for completion.',
      };
    },
    async updateComponentSelection(runId, input: ComponentSelectionBridgeInput) {
      const url =
        opts.apiUrl.replace(/\/+$/, '') +
        `/api/agent-runs/${encodeURIComponent(runId)}/component-selection`;
      const res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: true;
        interruption?: false;
        userTurnCreated?: false;
        change?: Record<string, unknown>;
        componentPack?: Record<string, unknown>;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.ok || !data.change || !data.componentPack) {
        const reason = data.detail ?? data.error ?? `HTTP ${res.status}`;
        throw new Error(`component selection update failed: ${reason}`);
      }
      return {
        ok: true,
        interruption: false,
        userTurnCreated: false,
        change: data.change,
        componentPack: data.componentPack,
      };
    },
    async getCatalog() {
      const url = opts.apiUrl.replace(/\/+$/, '') + '/api/catalog';
      const res = await fetchImpl(url, {
        headers: authHeaders,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`api ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        source: 'storybook' | 'static';
        components: {
          id: string;
          title: string;
          shortName: string;
          filePath: string;
          description?: string;
          descriptionLayer?: import('@sber-designer/shared-types').ComponentDescriptionLayer;
          stories: unknown[];
        }[];
      };
      return {
        source: data.source,
        components: data.components.map((c) => ({
          id: c.id,
          title: c.title,
          shortName: c.shortName,
          filePath: c.filePath,
          storyCount: c.stories.length,
          ...(c.description ? { description: c.description } : {}),
          ...(c.descriptionLayer ? { descriptionLayer: c.descriptionLayer } : {}),
        })),
      } satisfies CatalogSnapshot;
    },
  };
}
