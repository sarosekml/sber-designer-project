export type ProjectProfileKind = 'react-storybook' | 'react' | 'html-css' | 'empty';

export interface ProjectScreenUnit {
  sourceGlob: string;
  storyRequired: boolean;
  rootMarker: string;
}

export type ProjectComponentModel = 'react-index' | 'css-catalog';

export type ProjectRenderProbe = 'storybook' | 'static-html';

export type HtmlDesignSystemSourceId =
  | 'design-md'
  | 'tokens-css'
  | 'components-css'
  | 'design-system-preview';

export interface HtmlDesignSystemSourceStatus {
  id: HtmlDesignSystemSourceId;
  label: string;
  required: boolean;
  canonicalPath: string;
  aliases: string[];
  status: 'found' | 'missing';
  foundPath?: string;
}

export type HtmlDesignSystemStatus =
  | 'canonical'
  | 'non-canonical'
  | 'missing'
  /** @deprecated persisted/index fixtures created before 0303 */
  | 'connected'
  /** @deprecated persisted/index fixtures created before 0303 */
  | 'bootstrap';

export interface HtmlDesignSystemSources {
  status: HtmlDesignSystemStatus;
  folderPath?: string;
  referencePages?: string[];
  foundRequired: HtmlDesignSystemSourceId[];
  missingRequired: HtmlDesignSystemSourceId[];
  sources: HtmlDesignSystemSourceStatus[];
}

export function isHtmlDesignSystemCanonical(status: HtmlDesignSystemStatus | null | undefined) {
  return status === 'canonical' || status === 'connected';
}

export function isHtmlDesignSystemMissing(status: HtmlDesignSystemStatus | null | undefined) {
  return status === 'missing' || status === 'bootstrap';
}

export interface ProjectProfileContract {
  kind: ProjectProfileKind;
  screenUnit: ProjectScreenUnit;
  componentModel: ProjectComponentModel;
  renderProbe: ProjectRenderProbe;
  allowedUiPackages?: string[];
  htmlDesignSystem?: HtmlDesignSystemSources;
}
