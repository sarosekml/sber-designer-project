import {
  HTML_DESIGN_SYSTEM_PATHS,
  detectDesignSystemBootstrapIntent,
  detectExternalDesignSourceIntent,
} from '@sber-designer/shared-types';
import type { EditorState } from './state-store';

export const HTML_DESIGN_SYSTEM_SOURCE_TARGETS = [
  HTML_DESIGN_SYSTEM_PATHS.designMd,
  HTML_DESIGN_SYSTEM_PATHS.tokensCss,
  HTML_DESIGN_SYSTEM_PATHS.componentsCss,
  `${HTML_DESIGN_SYSTEM_PATHS.refsDir}/**`,
] as const;

export function htmlDesignSystemSourceTargetsForRequest(input: {
  userRequest?: string | null | undefined;
  activeScreen?: EditorState['activeScreen'] | null | undefined;
}): string[] {
  const userRequest = input.userRequest?.trim() ?? '';
  if (!userRequest) return [];
  if (!isHtmlFirstLikeContext(input.activeScreen, userRequest)) return [];
  if (!isHtmlDesignSystemSourceImportOrUpdate(userRequest)) return [];
  return [...HTML_DESIGN_SYSTEM_SOURCE_TARGETS];
}

export function isHtmlDesignSystemReferenceBootstrap(userRequest: string): boolean {
  const designSource = detectExternalDesignSourceIntent(userRequest);
  if (designSource?.target.mode === 'design-system') return true;
  return detectDesignSystemBootstrapIntent(userRequest) && looksLikeReferenceInput(userRequest);
}

function isHtmlFirstLikeContext(
  activeScreen: EditorState['activeScreen'] | null | undefined,
  userRequest: string,
): boolean {
  const activePath = activeScreen?.implementationFilePath ?? activeScreen?.filePath ?? '';
  if (activeScreen?.kind === 'page' && /\.html$/iu.test(activePath)) return true;
  return /\b(?:html-first|static html|html project|html проект|html[-\s]?проект)\b/iu.test(
    userRequest,
  );
}

function isHtmlDesignSystemSourceImportOrUpdate(userRequest: string): boolean {
  if (isHtmlDesignSystemReferenceBootstrap(userRequest)) return false;
  if (!mentionsDesignSystemSource(userRequest)) {
    return hasReusableHtmlComponentIntent(userRequest);
  }
  return hasDirectDesignSystemSourceAction(userRequest) || hasDesignSystemScreenIntent(userRequest);
}

function mentionsDesignSystemSource(userRequest: string): boolean {
  return /\b(?:design\.md|tokens\.css|components\.css|design-system\.html|design system|design-system)\b|дизайн[-\s]?систем/iu.test(
    userRequest,
  );
}

function hasDirectDesignSystemSourceAction(userRequest: string): boolean {
  return [
    /\b(?:import|connect|update|rewrite|write|move|paste|transfer)\b[\s\S]{0,120}\b(?:design\.md|tokens\.css|components\.css|design-system\.html|design system|design-system)\b/iu,
    /\b(?:design\.md|tokens\.css|components\.css|design-system\.html|design system|design-system)\b[\s\S]{0,120}\b(?:import|connect|update|rewrite|write|move|paste|transfer)\b/iu,
    /(?:^|[^\p{L}])(?:импортируй|импорт|подключи|обнови|перепиши|напиши|перенеси|перенос|вставь)(?:$|[^\p{L}])[\s\S]{0,120}(?:design\.md|tokens\.css|components\.css|design-system\.html|дизайн[-\s]?систем)/iu,
    /(?:design\.md|tokens\.css|components\.css|design-system\.html|дизайн[-\s]?систем)[\s\S]{0,120}(?:^|[^\p{L}])(?:импортируй|импорт|подключи|обнови|перепиши|напиши|перенеси|перенос|вставь)(?:$|[^\p{L}])/iu,
  ].some((pattern) => pattern.test(userRequest));
}

function hasDesignSystemScreenIntent(userRequest: string): boolean {
  if (!hasCreateDesignSystemScreenAction(userRequest)) return false;
  return (
    /\b(?:screen|page)\s+(?:for\s+|called\s+|named\s+)?(?:the\s+)?(?:design system|design-system|design-system\.html)\b/iu.test(
      userRequest,
    ) ||
    /\b(?:design system|design-system|design-system\.html)\s+(?:screen|page)\b/iu.test(
      userRequest,
    ) ||
    /(?:экран|страниц[ау])\s+(?:для\s+)?дизайн[-\s]?систем/iu.test(userRequest) ||
    /дизайн[-\s]?систем[а-я]*\s+(?:экран|страниц[ау])/iu.test(userRequest)
  );
}

function hasCreateDesignSystemScreenAction(userRequest: string): boolean {
  return /\b(?:create|generate|build|make)\b|(?:^|[^\p{L}])(?:созда[йть]|сделай|сгенерируй|собери)(?:$|[^\p{L}])/iu.test(
    userRequest,
  );
}

function hasReusableHtmlComponentIntent(userRequest: string): boolean {
  const action =
    /\b(?:add|create|build|make|update|edit|change|extend|refactor)\b|(?:^|[^\p{L}])(?:добавь|созда[йть]|сделай|собери|обнови|измени|расширь|доработай|перепиши)(?:$|[^\p{L}])/iu;
  if (!action.test(userRequest)) return false;
  return (
    /\b(?:reusable|shared|css|html)\s+(?:ui\s+)?component\b/iu.test(userRequest) ||
    /\b(?:component|компонент)[\s\S]{0,80}\b(?:components\.css|css|modifier|variant|reusable|shared)\b/iu.test(
      userRequest,
    ) ||
    /\b(?:components\.css|css|modifier|variant|reusable|shared)[\s\S]{0,80}\b(?:component|компонент)\b/iu.test(
      userRequest,
    ) ||
    /(?:переиспользуем|общ[а-я]*|css|модификатор|вариант)[\s\S]{0,80}(?:компонент|паттерн)/iu.test(
      userRequest,
    ) ||
    /(?:компонент|паттерн)[\s\S]{0,80}(?:переиспользуем|общ[а-я]*|css|модификатор|вариант)/iu.test(
      userRequest,
    )
  );
}

function looksLikeReferenceInput(userRequest: string): boolean {
  return /\b(?:pixso|figma|screenshot|image|reference|ref|mockup|url|link)\b|(?:скриншот|картинк|референс|макет|ссылк|изображени)/iu.test(
    userRequest,
  );
}
