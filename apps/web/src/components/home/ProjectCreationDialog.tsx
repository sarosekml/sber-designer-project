import { ConnectRepoDialog } from '@/components/editor/ConnectRepoDialog';
import { registerProject } from '@/lib/api-client';

export type ProjectCreationTab = 'connect' | 'bootstrap';

export function ProjectCreationDialog({
  open,
  onOpenChange,
  defaultTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab: ProjectCreationTab;
}) {
  const handleConnected = async (workspacePath: string) => {
    const entry = await registerProject({ workspacePath });
    window.location.assign(`/edit/${encodeURIComponent(entry.id)}`);
  };

  return (
    <ConnectRepoDialog
      open={open}
      onOpenChange={onOpenChange}
      defaultTab={defaultTab}
      onConnected={handleConnected}
    />
  );
}
