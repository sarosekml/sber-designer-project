/**
 * Built-in agent toolset. These thin wrappers expose api capabilities to
 * the LLM. They run **in-process** (no HTTP self-call) which keeps the
 * loop simple and audit-friendly.
 *
 * Naming is snake_case to match what proj-mcp exposes externally — a
 * future iteration may share schemas, but the runtime split (in-process
 * vs HTTP) stays the way it is.
 *
 * Tool implementations live in ./tools/* by group (task 0078, KT1); this
 * file is the registry and the stable import surface for routes/tests.
 */
import type { AgentKitAgent } from '@sber-designer/shared-types';

import { loadAgentKit } from '../agent-kit/loader';
import { filterAgentTools as filterAgentToolsByPolicy } from '../agent-kit/permissions';
import { AGENT_KIT_TOOLS } from '../agent-kit/tools';
import { filterToolsForSessionMode } from '../session-mode';
import { PRODUCT_MCP_BROKER_TOOLS } from './product-mcp-tools';
import {
  listComponents,
  listDesignContext,
  listProjectTemplates,
  listScreenTemplates,
  readScreenTemplate,
} from './tools/catalog';
import {
  getComponentDescriptionSource,
  listUndescribedComponents,
  writeComponentDescription,
} from './tools/component-description';
import { updateComponentSelectionTool } from './tools/component-selection';
import { sendPr } from './tools/delivery';
import { getSelection, postMessage, setMode } from './tools/editor-bridge';
import { applyPatch, readFile, writeFile } from './tools/files';
import { rebuildDesignSystemPreviewTool } from './tools/html-design-system';
import {
  getIndexedAsset,
  getIndexedComponent,
  getIndexedIcon,
  getIndexedToken,
  getPattern,
  getProjectIndexStatus,
  getUsageCard,
  importAssetPackTool,
  listIndexedScreens,
  listPatterns,
  materializeIndexedIconTool,
  requestProjectReindex,
  searchProjectIndex,
} from './tools/project-index';
import { applyProjectRestructure, getProjectStructureReport } from './tools/project-structure';
import {
  flowAddEdge,
  flowRemoveEdge,
  screenCreate,
  screenRemove,
  screenUpdate,
} from './tools/screens-flow';
import { validateDesignScreen, validateScreenCraftTool } from './tools/validation';
import type { ServerTool, ToolContext } from './types';

export const ALL_TOOLS: ServerTool[] = [
  applyPatch,
  readFile,
  writeFile,
  getProjectIndexStatus,
  getProjectStructureReport,
  applyProjectRestructure,
  searchProjectIndex,
  getIndexedComponent,
  getUsageCard,
  updateComponentSelectionTool,
  listUndescribedComponents,
  writeComponentDescription,
  getComponentDescriptionSource,
  listPatterns,
  getPattern,
  getIndexedToken,
  getIndexedAsset,
  getIndexedIcon,
  materializeIndexedIconTool,
  listIndexedScreens,
  requestProjectReindex,
  rebuildDesignSystemPreviewTool,
  importAssetPackTool,
  validateDesignScreen,
  validateScreenCraftTool,
  listDesignContext,
  listComponents,
  listScreenTemplates,
  readScreenTemplate,
  listProjectTemplates,
  getSelection,
  setMode,
  postMessage,
  sendPr,
  screenCreate,
  screenUpdate,
  screenRemove,
  flowAddEdge,
  flowRemoveEdge,
  ...PRODUCT_MCP_BROKER_TOOLS,
  ...AGENT_KIT_TOOLS,
] as ServerTool[];

export { filterAgentTools } from '../agent-kit/permissions';

export async function loadAgentToolsForContext(
  ctx: ToolContext,
  options: { agent?: AgentKitAgent; mcpTools?: ServerTool[] } = {},
): Promise<ServerTool[]> {
  const kit = await loadAgentKit({ workspacePath: ctx.workspacePath });
  const agent = options.agent ?? kit.defaultAgent;
  const tools = options.mcpTools?.length ? [...ALL_TOOLS, ...options.mcpTools] : ALL_TOOLS;
  return filterToolsForSessionMode(
    filterAgentToolsByPolicy(tools, { policy: agent.permissionPolicy }),
    ctx.sessionMode,
  );
}
