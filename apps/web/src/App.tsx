import { lazy, Suspense, useEffect, useState } from 'react';

import { AuthShell } from './components/auth/AuthShell';
import { ForcedPasswordChangePage } from './components/auth/ForcedPasswordChangePage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { HomeLanding } from './components/home/HomeLanding';
import { HomeShell } from './components/home/HomeShell';
import { ProfilePage } from './components/home/ProfilePage';
import { SystemPage } from './components/home/SystemPage';
import { UsersPage } from './components/home/UsersPage';
import { ShareViewer } from './components/share/ShareViewer';
import { Button } from './components/ui/button';
import {
  ApiError,
  openProjectEntry,
  setClientAuthMode,
  type ProjectOpenResult,
} from './lib/api-client';
import {
  authenticatedLanding,
  matchAppRoute,
  roleCanAccessRoute,
  type AppRoute,
} from './lib/app-route';
import { DEFAULT_CANVAS_VIEWPORT_PRESET_ID } from './lib/canvas-viewport';
import { clientNeedsAuthBootstrap, resolveClientStartupProfile } from './lib/startup-profile';
import { useSandboxSession } from './hooks/useSandboxSession';
import { useAuthStore } from './stores/auth-store';
import { useEditorStore } from './stores/editor-store';
import { useProjectStore } from './stores/project-store';
import { useSandboxStore } from './stores/sandbox-store';

/**
 * 0136 R14 — the editor is a route boundary. It used to be a static import, so
 * Home and Login downloaded the whole editor graph (canvas, chat, design
 * panel) before rendering a landing page.
 */
const EditorShell = lazy(() =>
  import('./components/editor/EditorShell').then((module) => ({
    default: module.EditorShell,
  })),
);

const HowItWorksPage = lazy(() =>
  import('./components/home/HowItWorksPage').then((module) => ({
    default: module.HowItWorksPage,
  })),
);
const ProjectsPage = lazy(() =>
  import('./components/home/ProjectsPage').then((module) => ({
    default: module.ProjectsPage,
  })),
);

const pendingProjectOpens = new Map<string, Promise<ProjectOpenResult>>();
const CLIENT_STARTUP_PROFILE = resolveClientStartupProfile({
  deploymentMode: import.meta.env.VITE_SBER_DESIGNER_DEPLOYMENT_MODE,
  authMode: import.meta.env.VITE_SBER_DESIGNER_AUTH_MODE,
});

if (!clientNeedsAuthBootstrap(CLIENT_STARTUP_PROFILE)) setClientAuthMode('local');

/**
 * Tiny pathname-based router (Phase 5.5).
 *
 * - `/login` and `/register` live outside the authenticated product shell.
 * - local profile renders immediately; user/server profiles wait for auth bootstrap.
 * - `/share/<token>` stays public and never starts auth/session bootstrap.
 *
 * No react-router yet — path matching stays small and explicit until
 * the product grows real nested navigation.
 */
export function App() {
  const route = matchAppRoute(window.location.pathname);
  if (route.kind === 'share') return <ShareViewer token={route.token} />;
  if (!clientNeedsAuthBootstrap(CLIENT_STARTUP_PROFILE)) return <LocalApp route={route} />;
  return <SessionApp route={route} />;
}

function LocalApp({ route }: { route: Exclude<AppRoute, { kind: 'share' }> }) {
  if (
    route.kind === 'login' ||
    route.kind === 'register' ||
    route.kind === 'profile' ||
    route.kind === 'admin'
  ) {
    return <AppRedirect to="/" />;
  }
  return renderProductRoute(route);
}

function SessionApp({ route }: { route: Exclude<AppRoute, { kind: 'share' }> }) {
  const status = useAuthStore((state) => state.status);
  const authMode = useAuthStore((state) => state.authMode);
  const registration = useAuthStore((state) => state.registration);
  const user = useAuthStore((state) => state.user);
  const bootstrapError = useAuthStore((state) => state.bootstrapError);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === 'loading') return <SessionLoading />;
  if (bootstrapError) return <AuthBootstrapError message={bootstrapError} onRetry={bootstrap} />;

  if (status === 'local') {
    if (
      route.kind === 'login' ||
      route.kind === 'register' ||
      route.kind === 'profile' ||
      route.kind === 'admin'
    ) {
      return <AppRedirect to="/" />;
    }
    return renderProductRoute(route);
  }

  if (status === 'anonymous') {
    if (authMode === 'oidc') return <OidcSignInRequired />;
    if (route.kind === 'register' && registration === 'open') return <RegisterPage />;
    return <LoginPage />;
  }

  if (user?.mustChangePassword) return <ForcedPasswordChangePage />;
  if (route.kind === 'login' || route.kind === 'register') {
    return <AppRedirect to={authenticatedLanding(window.location)} />;
  }
  if (!roleCanAccessRoute(route, user?.role ?? null)) return <AppRedirect to="/" />;
  return renderProductRoute(route);
}

function renderProductRoute(route: Exclude<AppRoute, { kind: 'share' }>) {
  if (route.kind === 'home') {
    return (
      <HomeShell currentPath="/">
        <HomeLanding />
      </HomeShell>
    );
  }
  if (route.kind === 'projects') {
    return (
      <HomeShell currentPath="/projects">
        <Suspense fallback={<HomeRouteLoading label="Loading projects…" />}>
          <ProjectsPage />
        </Suspense>
      </HomeShell>
    );
  }
  if (route.kind === 'profile') {
    return (
      <HomeShell currentPath="/profile">
        <ProfilePage />
      </HomeShell>
    );
  }
  if (route.kind === 'how-it-works') {
    const currentPath = route.slug
      ? `/how-it-works/${encodeURIComponent(route.slug)}`
      : '/how-it-works';
    return (
      <HomeShell currentPath={currentPath}>
        <Suspense fallback={<DocumentationLoading />}>
          <HowItWorksPage slug={route.slug} />
        </Suspense>
      </HomeShell>
    );
  }
  if (route.kind === 'admin') {
    return (
      <HomeShell currentPath={route.pathname}>
        {route.pathname === '/admin/users' ? <UsersPage /> : <SystemPage />}
      </HomeShell>
    );
  }
  if (route.kind === 'edit') return <ProjectEditorRoute projectId={route.projectId} />;
  return <LazyEditorShell />;
}

function LazyEditorShell() {
  return (
    <Suspense fallback={<HomeRouteLoading label="Loading editor…" />}>
      <EditorShell />
    </Suspense>
  );
}

function DocumentationLoading() {
  return <HomeRouteLoading label="Loading documentation…" />;
}

function HomeRouteLoading({ label }: { label: string }) {
  return (
    <div className="grid min-h-full place-items-center bg-background text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function SessionLoading() {
  return (
    <div className="grid min-h-full place-items-center bg-background text-sm text-muted-foreground">
      Loading session…
    </div>
  );
}

function AppRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <SessionLoading />;
}

function AuthBootstrapError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <AuthShell
      title="Sber Designer is unavailable"
      description="The authentication service could not be reached."
    >
      <div className="grid gap-4 text-center">
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
        <Button type="button" onClick={() => void onRetry()}>
          Try again
        </Button>
      </div>
    </AuthShell>
  );
}

function OidcSignInRequired() {
  return (
    <AuthShell
      title="Sign in required"
      description="Authentication is managed by your identity provider."
    >
      <div className="grid gap-4 text-center">
        <p className="text-sm text-muted-foreground">
          Complete your organization sign-in, then reload this page.
        </p>
        <Button type="button" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </AuthShell>
  );
}

function ProjectEditorRoute({ projectId }: { projectId: string }) {
  const { createSession, stopSession } = useSandboxSession();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const open = async () => {
      setReady(false);
      setError(null);
      useEditorStore.getState().setCanvasViewportPresetId(DEFAULT_CANVAS_VIEWPORT_PRESET_ID);
      useEditorStore.getState().setProjectId(projectId);
      try {
        const { project, entry } = await openProjectOnce(projectId);
        useProjectStore.getState().setBaseline(project);
        // Mirror the pinned cover screen so run completions can decide locally (0135).
        useEditorStore.getState().setCoverScreenId(entry.coverScreenId ?? null);
        const current = useSandboxStore.getState().session;
        if (current && current.workspacePath !== entry.workspacePath) {
          await stopSession();
        }
        await createSession(entry.workspacePath);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? `${err.code ?? 'error'}: ${err.message}`
              : err instanceof Error
                ? err.message
                : String(err),
          );
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void open();
    return () => {
      cancelled = true;
    };
  }, [createSession, projectId, stopSession]);

  if (!ready) {
    return (
      <div className="grid min-h-full place-items-center bg-background text-sm text-muted-foreground">
        Opening project…
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-full place-items-center bg-background px-6 text-center">
        <div className="grid max-w-md gap-3">
          <h1 className="text-base font-semibold">Project could not be opened</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="mx-auto rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            Back to projects
          </button>
        </div>
      </div>
    );
  }

  return <LazyEditorShell />;
}

function openProjectOnce(projectId: string): Promise<ProjectOpenResult> {
  const pending = pendingProjectOpens.get(projectId);
  if (pending) return pending;
  const task = openProjectEntry(projectId).finally(() => pendingProjectOpens.delete(projectId));
  pendingProjectOpens.set(projectId, task);
  return task;
}
