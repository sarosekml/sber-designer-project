import { useEffect, useState } from 'react';
import { Boxes, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  fetchProjectDesignIndexJob,
  fetchProjectDesignSystemBrowser,
  startProjectDesignIndexJob,
  type ProjectDesignSystemBrowser,
  type ProjectIndexJob,
} from '@/lib/api-client';
import { useProjectStore } from '@/stores/project-store';
import { DesignSystemBrowser } from './DesignSystemBrowser';

interface DesignSystemBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DesignSystemBrowserDialog({ open, onOpenChange }: DesignSystemBrowserDialogProps) {
  const project = useProjectStore((s) => s.project);
  const [browser, setBrowser] = useState<ProjectDesignSystemBrowser | null>(null);
  const [job, setJob] = useState<ProjectIndexJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadBrowser = async () => {
    if (!project?.workspacePath) {
      setBrowser(null);
      setError('Connect a workspace before opening the Design System Browser.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBrowser(await fetchProjectDesignSystemBrowser({ workspacePath: project.workspacePath }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const runSetupProfiler = async () => {
    if (!project?.workspacePath || running) return;
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const started = await startProjectDesignIndexJob({
        enrich: false,
        workspacePath: project.workspacePath,
      });
      setJob(started.job);
      const completed = await pollDesignIndexJob(started.job.id, setJob);
      if (completed.status === 'failed') {
        throw new Error(completed.error ?? 'Project index job failed.');
      }
      setMessage(
        completed.changedFiles.length > 0
          ? `Generated ${completed.changedFiles.length} index file${completed.changedFiles.length === 1 ? '' : 's'}.`
          : 'Design index is already up to date.',
      );
      setBrowser(await fetchProjectDesignSystemBrowser({ workspacePath: project.workspacePath }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void reloadBrowser();
  }, [open, project?.workspacePath]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(920px,calc(100vh-2rem))] w-[min(1480px,calc(100vw-2rem))] max-w-none overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="size-5 text-primary" />
              Design System Browser
            </DialogTitle>
            <DialogDescription>
              Browse indexed project knowledge, edit agent guidance, and run setup profiling.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {(message || error || job?.status === 'queued' || job?.status === 'running') && (
              <div className="mb-3 rounded-md border border-border bg-card px-3 py-2 text-xs">
                {job?.status === 'queued' || job?.status === 'running' ? (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Setup profiler is {job.status}.
                  </span>
                ) : message ? (
                  <span className="text-success">{message}</span>
                ) : error ? (
                  <span className="text-destructive-foreground">{error}</span>
                ) : null}
              </div>
            )}

            <DesignSystemBrowser
              browser={browser}
              loading={loading}
              running={Boolean(running || job?.status === 'queued' || job?.status === 'running')}
              {...(project?.workspacePath ? { workspacePath: project.workspacePath } : {})}
              onRefresh={() => void reloadBrowser()}
              onRunProfiler={() => void runSetupProfiler()}
              onChanged={() => void reloadBrowser()}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function pollDesignIndexJob(
  id: string,
  onUpdate: (job: ProjectIndexJob) => void,
): Promise<ProjectIndexJob> {
  for (let attempt = 0; attempt < 120; attempt++) {
    const { job } = await fetchProjectDesignIndexJob(id);
    onUpdate(job);
    if (job.status === 'complete' || job.status === 'failed') return job;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for project index job.');
}
