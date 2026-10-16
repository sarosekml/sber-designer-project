import {
  detectDesignSystemBootstrapIntent,
  parseHtmlDesignSystemApplyDirective,
  type ProjectScreen,
  type SberDesignerProjectKind,
} from '@sber-designer/shared-types';

import type { AssistantTaskIntent } from '@/stores/editor-store';

export type AssistantTargetPreference = 'auto' | 'current-screen' | 'new-screen';

export interface ResolveAssistantTargetInput {
  message: string;
  activeScreen: ProjectScreen | null;
  preference: AssistantTargetPreference;
  existingIntent: AssistantTaskIntent | null;
  projectKind?: SberDesignerProjectKind | null;
}

export interface ResolveAssistantTargetResult {
  intent: AssistantTaskIntent | null;
  target: AssistantTargetPreference;
  reason:
    | 'existing-intent'
    | 'explicit-current'
    | 'explicit-new'
    | 'project-scope'
    | 'preference'
    | 'none';
}

const CURRENT_SCREEN_PATTERNS = [
  /\b(?:on|in)\s+(?:the\s+)?current\s+(?:screen|page)\b/iu,
  /\b(?:this|the\s+current)\s+(?:screen|page)\b/iu,
  /\b(?:update|edit|replace|fill|build)\s+(?:this|the\s+current)\s+(?:screen|page)\b/iu,
  /(?:^|[^\p{L}])на\s+текущ(?:ей|ую)\s+страниц[еуы](?:$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])текущ(?:ую|ей)\s+страниц[уе](?:$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])на\s+текущ(?:ем|ий)\s+экран[е]?(?:$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])текущ(?:ий|ем)\s+экран[е]?(?:$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])на\s+эт(?:ом|ой)\s+(?:экране|странице)(?:$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])эт(?:от|у)\s+(?:экран|страницу)(?:$|[^\p{L}])/iu,
];

const NEW_SCREEN_PATTERNS = [
  /\bnew\s+(?:screen|page)\b/iu,
  /\bcreate\s+(?:a\s+)?(?:new|another)\s+(?:screen|page)\b/iu,
  /\b(?:create|generate|build|make)\s+(?:a\s+|an\s+|the\s+)?(?:[\p{L}\p{N}_-]+\s+){0,8}(?:screen|page)\b/iu,
  /\badd\s+(?:a\s+)?(?:screen|page)\b/iu,
  /(?:^|[^\p{L}])созда[йть]\s+(?:нов(?:ый|ую)\s+)?(?:экран|страниц[уа])(?:$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])сделай\s+нов(?:ый|ую)\s+(?:экран|страниц[уа])(?:$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])добавь\s+(?:нов(?:ый|ую)\s+)?(?:экран|страниц[уа])(?:$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])нов(?:ый|ую)\s+(?:экран|страниц[уа])(?:$|[^\p{L}])/iu,
];

const DUPLICATE_SCREEN_PATTERNS = [
  /\b(?:duplicate|copy|clone)\s+(?:this|the\s+current)?\s*(?:screen|page)\b/iu,
  /(?:^|[^\p{L}])(?:сдублируй|скопируй|клонируй)\s+(?:эт(?:от)?|текущ(?:ий)?)?\s*(?:экран|страниц[уа])(?:$|[^\p{L}])/iu,
];

export function resolveAssistantTarget(
  input: ResolveAssistantTargetInput,
): ResolveAssistantTargetResult {
  const message = input.message.trim();
  if (parseHtmlDesignSystemApplyDirective(message).length > 0) {
    return {
      intent: null,
      target: 'auto',
      reason: 'project-scope',
    };
  }
  if (input.projectKind === 'html-first' && isHtmlFirstProjectScopeMessage(message)) {
    return {
      intent: null,
      target: 'auto',
      reason: 'project-scope',
    };
  }

  const existingIntent = input.existingIntent;
  if (existingIntent && existingIntent.kind !== 'edit-current-screen') {
    return {
      intent: existingIntent,
      target: 'current-screen',
      reason: 'existing-intent',
    };
  }

  const explicitDuplicate = matchesAny(message, DUPLICATE_SCREEN_PATTERNS);
  if (explicitDuplicate) {
    return {
      intent: null,
      target: 'new-screen',
      reason: 'explicit-new',
    };
  }

  const explicitCurrent =
    Boolean(input.activeScreen) && matchesAny(message, CURRENT_SCREEN_PATTERNS);
  if (explicitCurrent) {
    return editCurrentScreenResult(input.activeScreen!, 'explicit-current');
  }

  if (
    existingIntent?.kind === 'edit-current-screen' &&
    input.activeScreen &&
    existingIntent.targetScreenId === input.activeScreen.id
  ) {
    return {
      intent: existingIntent,
      target: 'current-screen',
      reason: 'existing-intent',
    };
  }

  const explicitNew = matchesAny(message, NEW_SCREEN_PATTERNS);
  if (explicitNew) {
    return {
      intent: null,
      target: 'new-screen',
      reason: 'explicit-new',
    };
  }

  if (input.preference === 'current-screen' && input.activeScreen) {
    return editCurrentScreenResult(input.activeScreen, 'preference');
  }

  if (input.preference === 'new-screen') {
    return {
      intent: null,
      target: 'new-screen',
      reason: 'preference',
    };
  }

  return {
    intent: null,
    target: 'auto',
    reason: 'none',
  };
}

function isHtmlFirstProjectScopeMessage(message: string): boolean {
  if (detectDesignSystemBootstrapIntent(message)) return true;
  return [
    /\b(?:write|rewrite|update|import|extract|connect|paste|transfer)\b[\s\S]{0,120}\b(?:design\.md|tokens\.css|components\.css|design-system\.html|design system|design-system)\b/iu,
    /\b(?:design\.md|tokens\.css|components\.css|design-system\.html|design system|design-system)\b[\s\S]{0,120}\b(?:write|rewrite|update|import|extract|connect|paste|transfer)\b/iu,
    /(?:^|[^\p{L}])(?:напиши|перепиши|обнови|импортируй|импорт|перенеси|подключи|вставь)(?:$|[^\p{L}])[\s\S]{0,120}(?:design\.md|tokens\.css|components\.css|design-system\.html|дизайн[-\s]?систем)/iu,
    /(?:design\.md|tokens\.css|components\.css|design-system\.html|дизайн[-\s]?систем)[\s\S]{0,120}(?:^|[^\p{L}])(?:напиши|перепиши|обнови|импортируй|импорт|перенеси|подключи|вставь)(?:$|[^\p{L}])/iu,
  ].some((pattern) => pattern.test(message));
}

function editCurrentScreenResult(
  activeScreen: ProjectScreen,
  reason: ResolveAssistantTargetResult['reason'],
): ResolveAssistantTargetResult {
  return {
    intent: {
      kind: 'edit-current-screen',
      targetScreenId: activeScreen.id,
    },
    target: 'current-screen',
    reason,
  };
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}
