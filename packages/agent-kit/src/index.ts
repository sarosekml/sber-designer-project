/**
 * @sber-designer/agent-kit — public surface.
 *
 * Exposes the default kit root resolution used by the product runtime
 * (services/api loads and merges the kit payload itself). materialiseKit() —
 * writing a project-local kit into a connected repository (task 0024) — will
 * be added here later; 0140 deliberately leaves the slot empty.
 */
export { resolveDefaultKitRoot } from './paths';
