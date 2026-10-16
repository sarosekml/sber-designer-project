/**
 * Thin client for services/api. The browser never imports
 * `@sber-designer/llm-gateway` directly for chat — it goes through
 * /api/chat, where secrets and audit live (ADR-0009).
 *
 * Split by domain into lib/api/* (task 0078, KT1); this file is the
 * compatibility barrel so existing `@/lib/api-client` imports keep
 * working. New code may import the concrete domain module directly.
 */
export * from './api/http';
export * from './api/auth';
export * from './api/admin';
export * from './api/chat';
export * from './api/agent-runs';
export * from './api/files';
export * from './api/project';
export * from './api/share';
export * from './api/git';
export * from './api/mcp';
export * from './api/screens';
export * from './api/design';
export * from './api/agent-kit';
export * from './api/tasks';
export * from './api/project-index';
export * from './api/host-tools';
