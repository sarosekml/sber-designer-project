// @sber-designer/proj-mcp — public surface.
export { createMcpServer } from './server';
export { createHttpServer, type CreateHttpServerOptions } from './http-server';
export {
  makeContext,
  type ProjMcpContext,
  type EditorBridge,
  type EditorSelection,
  type CreateScreenBridgeInput,
  type CreateScreenBridgeResult,
  type ComponentSelectionBridgeInput,
  type ComponentSelectionBridgeResult,
} from './context';
export { createHttpBridge, type HttpBridgeOptions } from './bridge';
export { ALL_TOOLS, type ToolDefinition } from './tools';
export { listTools, callTool, type ListToolsResponse, type CallToolResponse } from './tool-runner';
