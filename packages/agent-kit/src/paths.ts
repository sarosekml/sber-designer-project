/**
 * Single resolution point for the default (product) agent kit root.
 *
 * 0140 / ADR-0020: the kit lives in this package (`kit/`), not at the
 * repository root, so the root is resolved relative to the module — never
 * guessed from the process working directory or a chain of `..` hops.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function resolveDefaultKitRoot(): string {
  const override = process.env.SBER_DESIGNER_AGENT_KIT_DIR;
  if (override && override.trim() !== '') return resolve(override);
  return resolve(here, '..', 'kit');
}
