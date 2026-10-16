import { lazy, Suspense, useState } from 'react';
import { ArrowUp, FolderOpen, LayoutGrid, Sparkles } from 'lucide-react';

import { BuildVersionLabel } from '@/components/build-info/BuildVersionLabel';
import { Button } from '@/components/ui/button';

import { HarnessStatusPanel } from './HarnessStatusPanel';
import { HomeDisplayWordmark } from './HomeDisplayWordmark';
import { ProjectCreationDialog, type ProjectCreationTab } from './ProjectCreationDialog';
import { RecentDocumentationPanel } from './RecentDocumentationPanel';

const ProjectsLandingSection = lazy(() =>
  import('./ProjectsPage').then((module) => ({
    default: module.ProjectsLandingSection,
  })),
);

export function HomeLanding() {
  const [prompt, setPrompt] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<ProjectCreationTab>('connect');

  const openDialog = (tab: ProjectCreationTab) => {
    setDialogTab(tab);
    setDialogOpen(true);
  };

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
        <section className="grid gap-4" aria-labelledby="home-prompt-heading">
          <div className="mx-auto grid w-full max-w-3xl gap-10 sm:gap-14">
            <HomeDisplayWordmark />
            <div className="grid gap-3">
              <h1 id="home-prompt-heading" className="text-2xl font-semibold tracking-normal">
                What should we build?
              </h1>
              <div className="rounded-lg border border-border bg-card p-2 shadow-2xl shadow-black/20">
                <textarea
                  id="home-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  aria-labelledby="home-prompt-heading"
                  placeholder="Describe a screen, paste a task, or choose an existing project from Projects."
                  className="min-h-28 w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                />
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 border-t border-border pt-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openDialog('connect')}>
                      <FolderOpen />
                      Connect repo
                    </Button>
                    <Button size="sm" onClick={() => openDialog('bootstrap')}>
                      <Sparkles />
                      New project
                    </Button>
                  </div>
                  <Button
                    size="icon-sm"
                    disabled={!prompt.trim()}
                    onClick={() => openDialog('bootstrap')}
                    aria-label="Create project from prompt"
                    title="Create project"
                  >
                    <ArrowUp />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Suspense fallback={<ProjectsLandingLoading />}>
          <ProjectsLandingSection />
        </Suspense>
        <RecentDocumentationPanel />
        <HarnessStatusPanel />

        <footer className="flex justify-center border-t border-border pt-4 text-xs text-muted-foreground">
          <BuildVersionLabel withProductName />
        </footer>
      </div>

      <ProjectCreationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultTab={dialogTab}
      />
    </main>
  );
}

function ProjectsLandingLoading() {
  return (
    <section className="grid gap-3" aria-labelledby="landing-projects-loading-heading">
      <div className="flex items-center gap-2">
        <LayoutGrid className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="landing-projects-loading-heading" className="text-sm font-semibold">
          Projects
        </h2>
      </div>
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Loading projects"
        aria-busy="true"
      >
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="overflow-hidden rounded-lg border border-border bg-card"
            aria-hidden="true"
          >
            <div className="aspect-[16/9] animate-pulse border-b border-border bg-muted/50" />
            <div className="grid gap-2 p-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-muted/70" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
