/**
 * Server-side context that all tools share.
 *
 * Holds the workspace root (every fs op is scoped to it) plus an
 * optional EditorBridge — tools that touch the running editor speak
 * to it through services/api (events + state, ADR-0010).
 */
import { resolve } from 'node:path';
import type { ComponentDescriptionLayer } from '@sber-designer/shared-types';

export interface EditorBridge {
  /** Push a chat message into the editor chat panel. */
  postMessage(text: string): Promise<void>;
  /** Read the current editor selection (Design mode). */
  getSelection(): Promise<EditorSelection | null>;
  /** Announce a tool call so the user sees what proj-mcp is doing. */
  announceToolCall(tool: string, argsSummary: string): Promise<void>;
  /** Fetch the live component catalog (ADR-0011). */
  getCatalog(): Promise<CatalogSnapshot>;
  /** Apply structured AST patches against the active workspace (ADR-0013). */
  applyPatch(input: { workspacePath?: string; ops: unknown[] }): Promise<{
    ok: true;
    changedFiles: string[];
    ops: { kind: string; file: string }[];
  }>;
  /** Mark Storybook iframe/catalog reload as pending in the editor. */
  markStorybookReloadPending(path: string): Promise<void>;
  /** Register a generated screen through services/api project persistence. */
  createScreen(input: CreateScreenBridgeInput): Promise<CreateScreenBridgeResult>;
  /** Branch + commit + push + open PR (Phase 3.4). */
  sendPr(input: {
    title: string;
    // `?: T | undefined` rather than `?: T`: a zod schema with `.optional()`
    // produces an explicitly-undefined key, which `exactOptionalPropertyTypes`
    // refuses to assign to a plain optional.
    body?: string | undefined;
    branch?: string | undefined;
    baseBranch?: string | undefined;
    pushOnly?: boolean | undefined;
  }): Promise<{
    ok: true;
    branch: string;
    committed: boolean;
    prUrl: string | null;
    note?: string;
  }>;
  /** Start a project design-index background job through services/api. */
  requestProjectReindex(input: { workspacePath: string; reason?: string }): Promise<{
    started: boolean;
    alreadyRunning: boolean;
    jobId: string;
    statusEndpoint: string;
    reason: string;
    message: string;
  }>;
  /** Update only the active run's component selection, without a HITL turn. */
  updateComponentSelection?(
    runId: string,
    input: ComponentSelectionBridgeInput,
  ): Promise<ComponentSelectionBridgeResult>;
}

export interface ComponentSelectionBridgeInput {
  action: 'add' | 'replace';
  role: string;
  componentId: string;
  replaceComponentId?: string;
  reason: string;
}

export interface ComponentSelectionBridgeResult {
  ok: true;
  interruption: false;
  userTurnCreated: false;
  change: Record<string, unknown>;
  componentPack: Record<string, unknown>;
}

export interface CreateScreenBridgeInput {
  name: string;
  storyId: string;
  filePath: string;
  implementationFilePath: string;
  folder?: string | undefined;
  description?: string | undefined;
}

export interface CreateScreenBridgeResult {
  ok: true;
  id: string;
  screens: { id: string; name: string }[];
}

export interface EditorSelection {
  loc: string;
  tagName: string;
  text?: string;
  selector?: string;
  componentName?: string;
  componentLoc?: string;
  attributes?: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
}

export interface CatalogSnapshot {
  source: 'storybook' | 'static';
  components: {
    id: string;
    title: string;
    shortName: string;
    filePath: string;
    storyCount: number;
    description?: string;
    descriptionLayer?: ComponentDescriptionLayer;
  }[];
}

export interface ProjMcpContext {
  /** Absolute path to the workspace root the MCP server operates on. */
  workspaceRoot: string;
  /** Project id, advertised by the `ping` tool. */
  projectId: string;
  /** Server version (matches package.json). */
  version: string;
  /** Optional bridge to the running editor through services/api. */
  bridge: EditorBridge | null;
  /** Active agent run owning mutable selection evidence. */
  runId: string | null;
}

export function makeContext(opts: {
  workspaceRoot?: string;
  projectId?: string;
  bridge?: EditorBridge | null;
  runId?: string | null;
}): ProjMcpContext {
  return {
    workspaceRoot: resolve(opts.workspaceRoot ?? process.cwd()),
    projectId: opts.projectId ?? 'default',
    version: '0.0.0',
    bridge: opts.bridge ?? null,
    runId: opts.runId ?? null,
  };
}
