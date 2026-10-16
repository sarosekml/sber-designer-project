import { expect, test } from 'bun:test';

import {
  authenticatedLanding,
  matchAppRoute,
  routeUsesHomeShell,
  roleCanAccessRoute,
  sanitizeNextDestination,
} from './app-route';

test('pathname router matches auth, protected editor, admin, and public share routes', () => {
  expect(matchAppRoute('/')).toEqual({ kind: 'home' });
  expect(matchAppRoute('/projects')).toEqual({ kind: 'projects' });
  expect(matchAppRoute('/projects/')).toEqual({ kind: 'projects' });
  expect(matchAppRoute('/login')).toEqual({ kind: 'login' });
  expect(matchAppRoute('/register')).toEqual({ kind: 'register' });
  expect(matchAppRoute('/profile')).toEqual({ kind: 'profile' });
  expect(matchAppRoute('/how-it-works')).toEqual({ kind: 'how-it-works', slug: null });
  expect(matchAppRoute('/how-it-works/canvas-and-sandbox')).toEqual({
    kind: 'how-it-works',
    slug: 'canvas-and-sandbox',
  });
  expect(matchAppRoute('/admin/users')).toEqual({ kind: 'admin', pathname: '/admin/users' });
  expect(matchAppRoute('/edit/project%201')).toEqual({ kind: 'edit', projectId: 'project 1' });
  expect(matchAppRoute('/share/token%201')).toEqual({ kind: 'share', token: 'token 1' });
});

test('only admins can enter administration routes', () => {
  const adminRoute = matchAppRoute('/admin/users');
  expect(roleCanAccessRoute(adminRoute, 'admin')).toBe(true);
  expect(roleCanAccessRoute(adminRoute, 'member')).toBe(false);
  expect(roleCanAccessRoute(adminRoute, null)).toBe(false);
  expect(roleCanAccessRoute(matchAppRoute('/profile'), 'member')).toBe(true);
});

test('next destinations stay same-origin and cannot loop through auth pages', () => {
  expect(sanitizeNextDestination('/edit/project-1?tab=code#selection')).toBe(
    '/edit/project-1?tab=code#selection',
  );
  expect(sanitizeNextDestination('//evil.example')).toBeNull();
  expect(sanitizeNextDestination('https://evil.example')).toBeNull();
  expect(sanitizeNextDestination('/login')).toBeNull();
});

test('authenticated landing prefers a safe next query and falls back to the current route', () => {
  expect(authenticatedLanding({ pathname: '/login', search: '?next=%2Fprofile', hash: '' })).toBe(
    '/profile',
  );
  expect(authenticatedLanding({ pathname: '/edit/p1', search: '?tab=code', hash: '#node' })).toBe(
    '/edit/p1?tab=code#node',
  );
  expect(
    authenticatedLanding({ pathname: '/login', search: '?next=https://evil.example', hash: '' }),
  ).toBe('/');
});

test('home shell wraps home, projects, documentation, profile, and admin routes only', () => {
  expect(routeUsesHomeShell(matchAppRoute('/'))).toBe(true);
  expect(routeUsesHomeShell(matchAppRoute('/projects'))).toBe(true);
  expect(routeUsesHomeShell(matchAppRoute('/profile'))).toBe(true);
  expect(routeUsesHomeShell(matchAppRoute('/how-it-works/agent-system'))).toBe(true);
  expect(routeUsesHomeShell(matchAppRoute('/admin/users'))).toBe(true);
  expect(routeUsesHomeShell(matchAppRoute('/edit/project-1'))).toBe(false);
  expect(routeUsesHomeShell(matchAppRoute('/share/token-1'))).toBe(false);
});
