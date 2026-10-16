export interface DeploymentCapabilities {
  canDuplicateProjects: boolean;
  canShareProjects: boolean;
  canOpenProjectInHostApps: boolean;
}

export function resolveDeploymentCapabilities(
  deploymentMode: string | undefined,
): DeploymentCapabilities {
  const managedServerWorkspace = deploymentMode === 'server';
  return {
    canDuplicateProjects: managedServerWorkspace,
    canShareProjects: managedServerWorkspace,
    canOpenProjectInHostApps: !managedServerWorkspace,
  };
}
