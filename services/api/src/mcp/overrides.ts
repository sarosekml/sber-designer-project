import type { SberDesignerProject } from '@sber-designer/shared-types';

import { getProject, saveProject } from '../project-store';
import type { NormalizedMcpServer } from './types';

export function applyMcpServerOverrides(
  servers: NormalizedMcpServer[],
  project: SberDesignerProject | null | undefined,
): NormalizedMcpServer[] {
  return servers.map((server) => {
    const override = project?.mcpSettings?.serverOverrides?.[server.key];
    const overrideApplies = override?.configHash === server.configHash;
    const runtimeEnabled = overrideApplies ? override.enabled : true;
    return {
      ...server,
      runtimeEnabled,
      enabled: server.configEnabled && runtimeEnabled,
      ...(overrideApplies && override.toolOverrides
        ? { toolOverrides: override.toolOverrides }
        : {}),
      ...(overrideApplies && override.toolSelection
        ? { toolSelection: override.toolSelection }
        : {}),
    };
  });
}

export async function saveMcpServerOverride(
  server: NormalizedMcpServer,
  enabled: boolean,
): Promise<SberDesignerProject> {
  const project = getProject();
  const next: SberDesignerProject = {
    ...project,
    mcpSettings: {
      ...(project.mcpSettings ?? {}),
      serverOverrides: {
        ...(project.mcpSettings?.serverOverrides ?? {}),
        [server.key]: {
          enabled,
          configHash: server.configHash,
          updatedAt: Date.now(),
        },
      },
    },
  };
  return saveProject(next);
}

export async function saveMcpToolSelection(
  server: NormalizedMcpServer,
  selectedTools: string[],
): Promise<SberDesignerProject> {
  const project = getProject();
  const existing = project.mcpSettings?.serverOverrides?.[server.key];
  const existingApplies = existing?.configHash === server.configHash;
  const updatedAt = Date.now();
  const next: SberDesignerProject = {
    ...project,
    mcpSettings: {
      ...(project.mcpSettings ?? {}),
      serverOverrides: {
        ...(project.mcpSettings?.serverOverrides ?? {}),
        [server.key]: {
          enabled: existingApplies ? existing.enabled : true,
          configHash: server.configHash,
          updatedAt,
          toolSelection: {
            mode: 'explicit',
            selectedTools,
            updatedAt,
          },
        },
      },
    },
  };
  return saveProject(next);
}

export async function resetMcpToolOverrides(
  server: NormalizedMcpServer,
): Promise<SberDesignerProject> {
  const project = getProject();
  const existing = project.mcpSettings?.serverOverrides?.[server.key];
  const existingApplies = existing?.configHash === server.configHash;
  const next: SberDesignerProject = {
    ...project,
    mcpSettings: {
      ...(project.mcpSettings ?? {}),
      serverOverrides: {
        ...(project.mcpSettings?.serverOverrides ?? {}),
        [server.key]: {
          enabled: existingApplies ? existing.enabled : true,
          configHash: server.configHash,
          updatedAt: Date.now(),
        },
      },
    },
  };
  return saveProject(next);
}
