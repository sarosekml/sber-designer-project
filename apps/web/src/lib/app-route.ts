export type AppRoute =
  | { kind: 'home' }
  | { kind: 'projects' }
  | { kind: 'login' }
  | { kind: 'register' }
  | { kind: 'profile' }
  | { kind: 'how-it-works'; slug: string | null }
  | { kind: 'admin'; pathname: string }
  | { kind: 'edit'; projectId: string }
  | { kind: 'share'; token: string }
  | { kind: 'fallback'; pathname: string };

export interface AppLocation {
  pathname: string;
  search: string;
  hash: string;
}

export function matchAppRoute(pathname: string): AppRoute {
  if (pathname === '/') return { kind: 'home' };
  if (pathname === '/projects' || pathname === '/projects/') return { kind: 'projects' };
  if (pathname === '/login') return { kind: 'login' };
  if (pathname === '/register') return { kind: 'register' };
  if (pathname === '/profile') return { kind: 'profile' };
  const documentationMatch = /^\/how-it-works(?:\/([^/]+))?\/?$/u.exec(pathname);
  if (documentationMatch) {
    return {
      kind: 'how-it-works',
      slug: documentationMatch[1] ? safeDecode(documentationMatch[1]) : null,
    };
  }
  if (/^\/admin(?:\/|$)/.test(pathname)) return { kind: 'admin', pathname };

  const editMatch = /^\/edit\/([^/]+)\/?$/.exec(pathname);
  if (editMatch?.[1]) return { kind: 'edit', projectId: safeDecode(editMatch[1]) };

  const shareMatch = /^\/share\/([^/]+)\/?$/.exec(pathname);
  if (shareMatch?.[1]) return { kind: 'share', token: safeDecode(shareMatch[1]) };

  return { kind: 'fallback', pathname };
}

export function sanitizeNextDestination(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const base = new URL('https://sber-designer.local');
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return null;
    if (parsed.pathname === '/login' || parsed.pathname === '/register') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function authenticatedLanding(location: AppLocation): string {
  const requested = new URLSearchParams(location.search).get('next');
  const sanitized = sanitizeNextDestination(requested);
  if (sanitized) return sanitized;
  if (location.pathname !== '/login' && location.pathname !== '/register') {
    return (
      sanitizeNextDestination(`${location.pathname || '/'}${location.search}${location.hash}`) ??
      '/'
    );
  }
  return '/';
}

export function routeUsesHomeShell(route: AppRoute): boolean {
  return (
    route.kind === 'home' ||
    route.kind === 'projects' ||
    route.kind === 'profile' ||
    route.kind === 'how-it-works' ||
    route.kind === 'admin'
  );
}

export function roleCanAccessRoute(route: AppRoute, role: 'admin' | 'member' | null): boolean {
  return route.kind !== 'admin' || role === 'admin';
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
