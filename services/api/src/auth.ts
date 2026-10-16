/**
 * Compatibility facade for the three-mode auth implementation.
 * Keep imports on `./auth`; implementation lives in `./auth/*`.
 */
export {
  authMode,
  deploymentMode,
  adminRouter,
  authRouter,
  getAuthService,
  getAuthStore,
  getSessionUser,
  getUser,
  initializeAuth,
  requireUser,
  requireAdmin,
} from './auth/runtime';
export { resolveAuthMode } from './auth/mode';
export type { AdminUser, AuthMode, SessionUser, SystemSettings } from './auth/types';
