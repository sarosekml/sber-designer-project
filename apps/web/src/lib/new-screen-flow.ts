import {
  MODAL_FALLBACK_DEFAULTS,
  screenSurface,
  type ModalLongContent,
  type ProjectScreenSurface,
  type ScreenTemplate,
  type ScreenTemplateRef,
} from '@sber-designer/shared-types';

/** Sentinel value for the "Without template" option in the new-screen dialog. */
export const NO_SCREEN_TEMPLATE_ID = 'none';

/** True when a template can be used for the given surface (0132, Р-9). */
export function isTemplateCompatibleWithSurface(
  template: ScreenTemplate,
  surface: ProjectScreenSurface,
): boolean {
  return screenSurface(template) === surface;
}

/**
 * Keep only templates that match the chosen surface. Page templates never
 * appear for a modal and vice-versa; "Without template" is offered separately.
 */
export function filterTemplatesForSurface(
  templates: ScreenTemplate[],
  surface: ProjectScreenSurface,
): ScreenTemplate[] {
  return templates.filter((template) => isTemplateCompatibleWithSurface(template, surface));
}

/**
 * Dropdown/selection key that disambiguates same-id built-in and project
 * templates, e.g. `project:deal` vs `built-in:deal`.
 */
export function screenTemplateKey(ref: ScreenTemplateRef): string {
  return `${ref.source}:${ref.id}`;
}

/** Resolve a selection key back to a template from the resolved list. */
export function selectScreenTemplateByKey(
  templates: ScreenTemplate[],
  key: string,
): ScreenTemplate | null {
  if (key === NO_SCREEN_TEMPLATE_ID) return null;
  const separator = key.indexOf(':');
  if (separator === -1) {
    // Backward-compat: bare id selects the first matching template.
    return templates.find((template) => template.id === key) ?? null;
  }
  const source = key.slice(0, separator);
  const id = key.slice(separator + 1);
  return templates.find((template) => template.source === source && template.id === id) ?? null;
}

/**
 * Display label for a template option. When a built-in and a project template
 * share an id, both are tagged (`global` / `project`) so they stay
 * distinguishable; otherwise the plain name is shown.
 */
export function screenTemplateOptionLabel(
  template: ScreenTemplate,
  templates: ScreenTemplate[],
): string {
  const collides = templates.some(
    (other) => other.id === template.id && other.source !== template.source,
  );
  if (!collides) return template.name;
  return `${template.name} (${template.source === 'built-in' ? 'global' : 'project'})`;
}

export function normalizeAssistantInstruction(value: string): string {
  return value.trim();
}

export function resolveTemplateModalLongContent(input: {
  current: ModalLongContent;
  touched: boolean;
  template: ScreenTemplate | null | undefined;
}): ModalLongContent {
  if (input.touched) return input.current;
  return input.template?.modalDefaults?.longContent ?? MODAL_FALLBACK_DEFAULTS.longContent;
}

export function shouldAskAssistantForNewScreen(input: {
  instruction: string;
  chatPending: boolean;
}): boolean {
  return normalizeAssistantInstruction(input.instruction).length > 0 && !input.chatPending;
}
