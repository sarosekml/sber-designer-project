import { useCallback, useEffect, useRef } from 'react';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import { ApiError, fetchProject, saveProjectToApi } from '@/lib/api-client';
import {
  readStoredActiveScreenId,
  writeStoredActiveScreenId,
} from '@/lib/active-screen-persistence';
import { shouldMirrorSessionWorkspacePath } from '@/lib/project-adoption';
import { useChatStore } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useTasksStore } from '@/stores/tasks-store';

/**
 * Loads the active .sdproj on mount, mirrors the connected workspace
 * path into it (so users don't have to re-set it every time), and
 * exposes a save() callback wired to PUT /api/project.
 */
export function useProject(): { save: () => Promise<void> } {
  const setBaseline = useProjectStore((s) => s.setBaseline);
  const setProject = useProjectStore((s) => s.setProject);
  const setSaving = useProjectStore((s) => s.setSaving);
  const setLoadError = useProjectStore((s) => s.setLoadError);
  const setSaveError = useProjectStore((s) => s.setSaveError);
  const project = useProjectStore((s) => s.project);
  const syncTasks = useTasksStore((s) => s.sync);
  const hydrateChatFromProject = useChatStore((s) => s.hydrateFromProject);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const autoSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const session = useSandboxStore((s) => s.session);

  // Initial load.
  useEffect(() => {
    if (useProjectStore.getState().project) return;
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchProject(ac.signal);
        if (!cancelled) {
          setBaseline(p);
          hydrateChatFromProject(p);
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        const message =
          err instanceof ApiError
            ? `${err.code ?? 'error'}: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        setLoadError(message);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [hydrateChatFromProject, setBaseline, setLoadError]);

  // Mirror the connected workspace path into a project that doesn't
  // have one yet (fresh project / Connect repo flow). A project that
  // already names another workspace must keep it — re-stamping the
  // session path onto foreign content redirects autosave into this
  // workspace's project.sdproj (cross-project corruption, 2026-06-12).
  useEffect(() => {
    if (!project || !session?.workspacePath) return;
    if (!shouldMirrorSessionWorkspacePath(project, session.workspacePath)) return;
    setProject({ ...project, workspacePath: session.workspacePath });
  }, [project, session?.workspacePath, setProject]);

  // Auto-select the first screen once the project loads — keeps the
  // canvas pointed at something meaningful immediately. The short delay is
  // intentional: project hydration/refetch can briefly publish an incomplete
  // screens array, and selecting the first screen during that window would
  // overwrite a deliberate sidebar selection.
  useEffect(() => {
    if (autoSelectTimerRef.current !== null) {
      clearTimeout(autoSelectTimerRef.current);
      autoSelectTimerRef.current = null;
    }
    if (!project || project.screens.length === 0) return;
    const stillExists = activeScreenId && project.screens.some((s) => s.id === activeScreenId);
    if (stillExists) return;

    autoSelectTimerRef.current = setTimeout(() => {
      autoSelectTimerRef.current = null;
      const latestProject = useProjectStore.getState().project;
      const latestActiveScreenId = useEditorStore.getState().activeScreenId;
      if (!latestProject || latestProject.screens.length === 0) return;
      if (
        latestActiveScreenId &&
        latestProject.screens.some((screen) => screen.id === latestActiveScreenId)
      ) {
        return;
      }
      const screenId =
        readStoredActiveScreenId(
          latestProject.workspacePath,
          latestProject.screens.map((screen) => screen.id),
        ) ?? latestProject.screens[0]!.id;
      useEditorStore.getState().setActiveScreenId(screenId, { source: 'auto' });
    }, 100);

    return () => {
      if (autoSelectTimerRef.current !== null) {
        clearTimeout(autoSelectTimerRef.current);
        autoSelectTimerRef.current = null;
      }
    };
  }, [activeScreenId, project?.screens]);

  useEffect(() => {
    if (!project || !activeScreenId) return;
    if (!project.screens.some((screen) => screen.id === activeScreenId)) return;
    writeStoredActiveScreenId(project.workspacePath, activeScreenId);
  }, [activeScreenId, project]);

  const taskTrackerKey = project?.taskTracker ? JSON.stringify(project.taskTracker) : '';
  const openCommentsCount =
    project?.comments?.filter((comment) => comment.status === 'open').length ?? 0;

  useEffect(() => {
    if (!project) return;
    if (!project.taskTracker && openCommentsCount === 0) return;
    void syncTasks();
  }, [openCommentsCount, project?.workspacePath, syncTasks, taskTrackerKey]);

  const save = useCallback(async () => {
    const current = useProjectStore.getState().project;
    if (!current) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved: SberDesignerProject = await saveProjectToApi(current);
      setBaseline(saved);
      hydrateChatFromProject(saved);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.code ?? 'error'}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [hydrateChatFromProject, setBaseline, setSaveError, setSaving]);

  return { save };
}
