import {
  BookOpen,
  Clock,
  Code2,
  Copy,
  FileCode2,
  Image as ImageIcon,
  MoreHorizontal,
  PencilLine,
  Trash2,
} from 'lucide-react';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProjectArtworkSrc } from '@/hooks/use-project-artwork-src';
import type { ProjectEntry } from '@/lib/api-client';
import type { AppTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme-store';

import { generatedProjectCoverSrc, projectThumbnailSrc } from './project-thumbnails';
import { projectTypePresentation } from './project-type';

export function ProjectCard({
  entry,
  menuOpen,
  onMenuOpenChange,
  onChangeThumbnail,
  onRename,
  canDuplicate,
  onDuplicate,
  onDelete,
  titleLevel = 'h2',
}: {
  entry: ProjectEntry;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onChangeThumbnail: () => void;
  onRename: () => void;
  canDuplicate: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  titleLevel?: 'h2' | 'h3';
}) {
  const theme = useThemeStore((state) => state.theme);
  const Title = titleLevel;
  return (
    <article className="group relative overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-muted-foreground/50">
      <button
        type="button"
        onClick={() => window.location.assign(`/edit/${encodeURIComponent(entry.id)}`)}
        className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ProjectCardCover entry={entry} theme={theme} />
        <div className="grid gap-2 p-3">
          <div className="min-w-0">
            <Title className="truncate text-sm font-semibold">{entry.name}</Title>
            <p className="truncate text-xs text-muted-foreground">{entry.workspacePath}</p>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3" aria-hidden="true" />
            {formatRelativeTime(entry.lastOpenedAt)}
          </div>
        </div>
      </button>
      <div className="absolute right-2 top-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(event) => {
            event.stopPropagation();
            onMenuOpenChange(!menuOpen);
          }}
          aria-label={`Project actions for ${entry.name}`}
          aria-expanded={menuOpen}
          className="border border-border/70 bg-background/85 shadow-sm backdrop-blur hover:bg-background"
        >
          <MoreHorizontal />
        </Button>
        {menuOpen && (
          <div className="absolute right-0 top-9 z-20 w-48 rounded-md border border-border bg-popover p-1 text-sm shadow-xl shadow-black/30">
            <button
              type="button"
              onClick={onRename}
              className="flex min-h-11 w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PencilLine className="size-4 text-muted-foreground" />
              Rename
            </button>
            <button
              type="button"
              onClick={onChangeThumbnail}
              className="flex min-h-11 w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ImageIcon className="size-4 text-muted-foreground" />
              Change thumbnail
            </button>
            {canDuplicate && (
              <button
                type="button"
                onClick={onDuplicate}
                className="flex min-h-11 w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Copy className="size-4 text-muted-foreground" />
                Duplicate
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="flex min-h-11 w-full items-center gap-2 rounded px-2 py-2 text-left text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="size-4" />
              Remove from list
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <ProjectTypeBadge type={entry.projectType} />
          {entry.legacy ? (
            <span
              className="truncate text-[10px] uppercase tracking-wide text-muted-foreground"
              title="Legacy project; assign an owner by SSH"
            >
              Legacy
            </span>
          ) : null}
        </div>
        <span className="text-[10px] text-muted-foreground">Open project</span>
      </div>
    </article>
  );
}

/**
 * Layered cover (0135): the stock placeholder (or the user's explicit
 * upload/pick) is the base; when the project has no explicit override we lay the
 * auto-generated cover over it and reveal it on load. A missing cover 404s, the
 * overlay stays hidden and the stock base shows through — no broken image.
 */
function ProjectCardCover({ entry, theme }: { entry: ProjectEntry; theme: AppTheme }) {
  const generativeThumbnailEnabled = useThemeStore((state) => state.generativeThumbnailEnabled);
  const baseSrc = projectThumbnailSrc(entry, theme);
  // Explicit choice wins outright, and the feature switch turns the generated
  // cover off entirely — both fall back to the placeholder image (0135).
  const coverSrc = generatedProjectCoverSrc(entry, generativeThumbnailEnabled);
  const resolvedBaseSrc = useProjectArtworkSrc(baseSrc);
  const resolvedCoverSrc = useProjectArtworkSrc(coverSrc);
  const [coverLoaded, setCoverLoaded] = useState(false);

  useEffect(() => {
    setCoverLoaded(false);
  }, [resolvedCoverSrc]);

  return (
    <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden border-b border-border bg-muted/30">
      {resolvedBaseSrc ? (
        <img src={resolvedBaseSrc} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : null}
      {resolvedCoverSrc ? (
        <img
          src={resolvedCoverSrc}
          alt=""
          loading="lazy"
          onLoad={() => setCoverLoaded(true)}
          onError={() => setCoverLoaded(false)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity',
            coverLoaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

function ProjectTypeBadge({ type }: { type: ProjectEntry['projectType'] }) {
  const presentation = projectTypePresentation(type);
  const Icon = type === 'storybook' ? BookOpen : type === 'html' ? FileCode2 : Code2;
  return (
    <Badge
      variant="secondary"
      className="gap-1 border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
      title={presentation.description}
    >
      <Icon className="size-3" aria-hidden="true" />
      {presentation.label}
    </Badge>
  );
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 14) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US');
}
