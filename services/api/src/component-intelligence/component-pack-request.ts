import type { DesignBrief } from '@sber-designer/shared-types';

export function componentPackRequestWithDesignBrief(
  userRequest: string | undefined,
  designBrief: DesignBrief | null | undefined,
): string {
  const constraints = designBrief?.axes.constraints ?? [];
  return [userRequest?.trim(), ...constraints.map((constraint) => constraint.trim())]
    .filter(Boolean)
    .join('\n');
}

export function sameComponentName(left: string, right: string): boolean {
  const normalize = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  return normalize(left) === normalize(right);
}
