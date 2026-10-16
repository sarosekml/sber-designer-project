/** External design-source handoff (Roadmap 02 / 0054). */

export type ExternalDesignSourceKind = 'pixso' | 'figma';
export type ExternalDesignSourceInputMode = 'link' | 'selection';
export type ExternalDesignSourceTargetMode = 'new-screen' | 'replace-current' | 'design-system';
export type ExternalDesignSourceTokenPolicy = 'prefer-project-tokens' | 'allow-source-values';
export type ExternalDesignSourceComponentPolicy = 'prefer-existing' | 'allow-new-components';

export interface ExternalDesignSourceIntent {
  source: {
    kind: ExternalDesignSourceKind;
    input: ExternalDesignSourceInputMode;
    url?: string;
    nodeId?: string;
  };
  target: {
    mode: ExternalDesignSourceTargetMode;
    name?: string;
    folder?: string;
    storyId?: string;
    storyFilePath?: string;
    implementationFilePath?: string;
    proposalRoot?: string;
    designSystemFilePath?: string;
    tokensFilePath?: string;
    componentsFilePath?: string;
    designSystemPreviewFilePath?: string;
    extractionReportFilePath?: string;
  };
  policies: {
    tokens: ExternalDesignSourceTokenPolicy;
    components: ExternalDesignSourceComponentPolicy;
  };
}

export const EXTERNAL_DESIGN_SOURCE_DIRECTIVE_START = '[SBER_DESIGNER_DESIGN_SOURCE]';
export const EXTERNAL_DESIGN_SOURCE_DIRECTIVE_END = '[/SBER_DESIGNER_DESIGN_SOURCE]';

export function detectExternalDesignSourceIntent(text: string): ExternalDesignSourceIntent | null {
  const directive = parseExternalDesignSourceDirective(text);
  if (directive) return directive;

  const designSystemBootstrap = detectDesignSystemBootstrapIntent(text);
  const pixsoUrl = firstDesignToolUrl(text, 'pixso');
  if (pixsoUrl) {
    return {
      source: { kind: 'pixso', input: 'link', url: pixsoUrl },
      target: designSystemBootstrap
        ? { mode: 'design-system', ...createExternalDesignSystemProposalTargetDefaults() }
        : { mode: 'new-screen' },
      policies: designSystemBootstrap
        ? designSystemBootstrapPolicies()
        : defaultExternalDesignSourcePolicies(),
    };
  }

  if (/pixso/i.test(text) && /(selected|selection|выбран|выделен|frame|фрейм)/i.test(text)) {
    return {
      source: { kind: 'pixso', input: 'selection' },
      target: designSystemBootstrap
        ? { mode: 'design-system', ...createExternalDesignSystemProposalTargetDefaults() }
        : { mode: 'new-screen' },
      policies: designSystemBootstrap
        ? designSystemBootstrapPolicies()
        : defaultExternalDesignSourcePolicies(),
    };
  }

  const figmaUrl = firstDesignToolUrl(text, 'figma');
  if (figmaUrl) {
    const nodeId = parseFigmaNodeId(figmaUrl);
    return {
      source: {
        kind: 'figma',
        input: 'link',
        url: figmaUrl,
        ...(nodeId ? { nodeId } : {}),
      },
      target: designSystemBootstrap
        ? { mode: 'design-system', ...createExternalDesignSystemProposalTargetDefaults() }
        : { mode: 'new-screen' },
      policies: designSystemBootstrap
        ? designSystemBootstrapPolicies()
        : defaultExternalDesignSourcePolicies(),
    };
  }

  return null;
}

export function buildExternalDesignSourceDirective(intent: ExternalDesignSourceIntent): string {
  const lines = [
    EXTERNAL_DESIGN_SOURCE_DIRECTIVE_START,
    `source=${intent.source.kind}`,
    `input=${intent.source.input}`,
    intent.source.url ? `url=${directiveValue(intent.source.url)}` : null,
    intent.source.nodeId ? `nodeId=${directiveValue(intent.source.nodeId)}` : null,
    `targetMode=${intent.target.mode}`,
    intent.target.name ? `targetName=${directiveValue(intent.target.name)}` : null,
    intent.target.folder ? `targetFolder=${directiveValue(intent.target.folder)}` : null,
    intent.target.storyId ? `targetStoryId=${directiveValue(intent.target.storyId)}` : null,
    intent.target.storyFilePath
      ? `targetStoryFilePath=${directiveValue(intent.target.storyFilePath)}`
      : null,
    intent.target.implementationFilePath
      ? `targetImplementationFilePath=${directiveValue(intent.target.implementationFilePath)}`
      : null,
    intent.target.proposalRoot
      ? `targetProposalRoot=${directiveValue(intent.target.proposalRoot)}`
      : null,
    intent.target.designSystemFilePath
      ? `targetDesignSystemFilePath=${directiveValue(intent.target.designSystemFilePath)}`
      : null,
    intent.target.tokensFilePath
      ? `targetTokensFilePath=${directiveValue(intent.target.tokensFilePath)}`
      : null,
    intent.target.componentsFilePath
      ? `targetComponentsFilePath=${directiveValue(intent.target.componentsFilePath)}`
      : null,
    intent.target.designSystemPreviewFilePath
      ? `targetDesignSystemPreviewFilePath=${directiveValue(intent.target.designSystemPreviewFilePath)}`
      : null,
    intent.target.extractionReportFilePath
      ? `targetExtractionReportFilePath=${directiveValue(intent.target.extractionReportFilePath)}`
      : null,
    `tokenPolicy=${intent.policies.tokens}`,
    `componentPolicy=${intent.policies.components}`,
    EXTERNAL_DESIGN_SOURCE_DIRECTIVE_END,
  ].filter(Boolean);
  return lines.join('\n');
}

export function stripExternalDesignSourceDirective(text: string): string {
  const start = text.indexOf(EXTERNAL_DESIGN_SOURCE_DIRECTIVE_START);
  if (start < 0) return text;
  const end = text.indexOf(EXTERNAL_DESIGN_SOURCE_DIRECTIVE_END, start);
  if (end < 0) return text;
  return `${text.slice(0, start)}${text.slice(
    end + EXTERNAL_DESIGN_SOURCE_DIRECTIVE_END.length,
  )}`.trim();
}

export function createExternalDesignSourceTargetDefaults(input: {
  name?: string;
  folder?: string;
  date?: string;
}): Required<
  Pick<
    ExternalDesignSourceIntent['target'],
    'folder' | 'storyId' | 'storyFilePath' | 'implementationFilePath'
  >
> & { name: string } {
  const name = normalizeDisplayName(input.name || 'Design Source Screen');
  const folder = normalizeDisplayName(
    input.folder || (/^\d{4}-\d{2}-\d{2}$/u.test(input.date ?? '') ? input.date! : 'Ungrouped'),
  );
  const folderId = toKebabCase(folder) || 'ungrouped';
  const pascalName = toPascalCase(name) || 'DesignSourceScreen';
  const kebabName = toKebabCase(name) || 'design-source-screen';
  return {
    name,
    folder,
    storyId: `screens-${folderId}-${kebabName}--default`,
    storyFilePath: `src/stories/screens/${folder}/${pascalName}.stories.tsx`,
    implementationFilePath: `src/screens/${folder}/${pascalName}.tsx`,
  };
}

export function createExternalDesignSystemProposalTargetDefaults(input?: { proposalId?: string }): {
  proposalRoot: string;
  designSystemFilePath: string;
  tokensFilePath: string;
  componentsFilePath: string;
  designSystemPreviewFilePath: string;
  extractionReportFilePath: string;
} {
  const proposalId = normalizeProposalId(input?.proposalId ?? 'design-source');
  const proposalRoot = `design/proposals/${proposalId}`;
  return {
    proposalRoot,
    designSystemFilePath: `${proposalRoot}/Design.md`,
    tokensFilePath: `${proposalRoot}/tokens.css`,
    componentsFilePath: `${proposalRoot}/components.css`,
    designSystemPreviewFilePath: `${proposalRoot}/design-system.html`,
    extractionReportFilePath: `${proposalRoot}/extraction-report.md`,
  };
}

export function defaultExternalDesignSourceScreenName(
  intent: ExternalDesignSourceIntent | null,
): string {
  if (!intent) return 'Design Source Screen';
  if (intent.target.name) return normalizeDisplayName(intent.target.name);
  if (intent.source.kind === 'pixso') return 'Pixso Screen';
  return 'Figma Screen';
}

export function normalizeExternalDesignSourceTargetPath(path: string): string | null {
  const normalized = path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '');
  if (!normalized || normalized.startsWith('/') || /^[a-z]:\//iu.test(normalized)) return null;
  if (normalized.split('/').some((segment) => segment === '..')) return null;
  return normalized.replace(/\/{2,}/g, '/');
}

export function isExternalDesignSourceTargetPath(path: string): boolean {
  const normalized = normalizeExternalDesignSourceTargetPath(path);
  if (!normalized) return false;
  return (
    /^src\/stories\/screens\/[^/]+\/[^/]+\.stories\.[jt]sx?$/iu.test(normalized) ||
    /^src\/screens\/[^/]+\/[^/]+\.[jt]sx?$/iu.test(normalized) ||
    /^design\/proposals\/[^/]+\/(?:Design\.md|tokens\.css|components\.css|design-system\.html|extraction-report\.md)$/u.test(
      normalized,
    )
  );
}

function parseExternalDesignSourceDirective(text: string): ExternalDesignSourceIntent | null {
  const start = text.indexOf(EXTERNAL_DESIGN_SOURCE_DIRECTIVE_START);
  if (start < 0) return null;
  const end = text.indexOf(EXTERNAL_DESIGN_SOURCE_DIRECTIVE_END, start);
  if (end < 0) return null;
  const body = text.slice(start + EXTERNAL_DESIGN_SOURCE_DIRECTIVE_START.length, end);
  const fields = new Map<string, string>();
  for (const rawLine of body.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }

  const kind = fields.get('source');
  const input = fields.get('input');
  if ((kind !== 'pixso' && kind !== 'figma') || (input !== 'link' && input !== 'selection')) {
    return null;
  }
  const rawTargetMode = fields.get('targetMode');
  const targetMode =
    rawTargetMode === 'replace-current' || rawTargetMode === 'design-system'
      ? rawTargetMode
      : 'new-screen';
  const tokenPolicy =
    fields.get('tokenPolicy') === 'allow-source-values'
      ? 'allow-source-values'
      : 'prefer-project-tokens';
  const componentPolicy =
    fields.get('componentPolicy') === 'allow-new-components'
      ? 'allow-new-components'
      : 'prefer-existing';
  const url = optionalDirectiveValue(fields.get('url'));
  const nodeId =
    optionalDirectiveValue(fields.get('nodeId')) ?? (url ? parseFigmaNodeId(url) : undefined);
  const targetName = optionalDirectiveValue(fields.get('targetName'));
  const targetFolder = optionalDirectiveValue(fields.get('targetFolder'));
  const targetStoryId = optionalDirectiveValue(fields.get('targetStoryId'));
  const storyFilePath = optionalDirectiveValue(fields.get('targetStoryFilePath'));
  const implementationFilePath = optionalDirectiveValue(fields.get('targetImplementationFilePath'));
  const proposalRoot = optionalDirectiveValue(fields.get('targetProposalRoot'));
  const designSystemFilePath = optionalDirectiveValue(fields.get('targetDesignSystemFilePath'));
  const tokensFilePath = optionalDirectiveValue(fields.get('targetTokensFilePath'));
  const componentsFilePath = optionalDirectiveValue(fields.get('targetComponentsFilePath'));
  const designSystemPreviewFilePath = optionalDirectiveValue(
    fields.get('targetDesignSystemPreviewFilePath'),
  );
  const extractionReportFilePath = optionalDirectiveValue(
    fields.get('targetExtractionReportFilePath'),
  );

  return {
    source: {
      kind,
      input,
      ...(url ? { url } : {}),
      ...(nodeId ? { nodeId } : {}),
    },
    target: {
      mode: targetMode,
      ...(targetName ? { name: targetName } : {}),
      ...(targetFolder ? { folder: targetFolder } : {}),
      ...(targetStoryId ? { storyId: targetStoryId } : {}),
      ...(storyFilePath ? { storyFilePath } : {}),
      ...(implementationFilePath ? { implementationFilePath } : {}),
      ...(proposalRoot ? { proposalRoot } : {}),
      ...(designSystemFilePath ? { designSystemFilePath } : {}),
      ...(tokensFilePath ? { tokensFilePath } : {}),
      ...(componentsFilePath ? { componentsFilePath } : {}),
      ...(designSystemPreviewFilePath ? { designSystemPreviewFilePath } : {}),
      ...(extractionReportFilePath ? { extractionReportFilePath } : {}),
    },
    policies: {
      tokens: tokenPolicy,
      components: componentPolicy,
    },
  };
}

function firstDesignToolUrl(text: string, kind: ExternalDesignSourceKind): string | null {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/giu) ?? [];
  for (const raw of matches) {
    const url = raw.replace(/[.,;!?]+$/u, '');
    if (kind === 'figma' && /^https?:\/\/(?:www\.)?figma\.com\//iu.test(url)) return url;
    if (kind === 'pixso' && /pixso/iu.test(url)) return url;
  }
  return null;
}

function parseFigmaNodeId(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get('node-id');
    return raw ? raw.replace(/-/gu, ':') : undefined;
  } catch {
    return undefined;
  }
}

function defaultExternalDesignSourcePolicies(): ExternalDesignSourceIntent['policies'] {
  return { tokens: 'prefer-project-tokens', components: 'prefer-existing' };
}

function designSystemBootstrapPolicies(): ExternalDesignSourceIntent['policies'] {
  return { tokens: 'allow-source-values', components: 'allow-new-components' };
}

export function detectDesignSystemBootstrapIntent(text: string): boolean {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  if (!mentionsDesignSystemBootstrapTarget(normalized)) return false;
  if (/^\[act-mode\]\s+Create a new production-quality screen\b/iu.test(normalized)) {
    return false;
  }
  if (isScreenGenerationUsingExistingDesignSystem(normalized)) return false;
  return hasDirectDesignSystemBootstrapAction(normalized);
}

function mentionsDesignSystemBootstrapTarget(text: string): boolean {
  return /\b(?:design\.md|design system|design-system)\b|дизайн[- ]?систем/iu.test(text);
}

function hasDirectDesignSystemBootstrapAction(text: string): boolean {
  return [
    /\b(?:create|extract|generate|bootstrap|build|write)\b(?:\s+(?:a|an|the|new|html|static|project|reviewable))*\s+\b(?:design\.md|design system|design-system)\b/iu,
    /\b(?:design\.md|design system|design-system)\b[\s\S]{0,80}\b(?:from|for|based on|по|из|для)\b/iu,
    /(?:^|[^\p{L}])(?:созда[йть]|собер[иу]?|сгенерируй|извлек[и]?|напиши|сформируй)(?:$|[^\p{L}])[\s\S]{0,80}(?:design\.md|дизайн[- ]?систем)/iu,
    /(?:design\.md|дизайн[- ]?систем)[\s\S]{0,80}(?:^|[^\p{L}])(?:по|из|для)(?:$|[^\p{L}])/iu,
    /(?:^|[^\p{L}])нов[а-я]*\s+html(?:$|[^\p{L}])[\s\S]{0,80}(?:design\.md|дизайн[- ]?систем)/iu,
  ].some((pattern) => pattern.test(text));
}

function isScreenGenerationUsingExistingDesignSystem(text: string): boolean {
  return [
    /\b(?:create|generate|build|make)\b[\s\S]{0,100}\b(?:screen|page)\b[\s\S]{0,80}\b(?:following|using|with|based on|according to)\b[\s\S]{0,40}\b(?:our|the|existing|project)?\s*(?:design system|design-system)\b/iu,
    /(?:^|[^\p{L}])(?:созда[йть]|сгенерируй|сделай|собери)(?:$|[^\p{L}])[\s\S]{0,100}(?:экран|страниц[ау])[\s\S]{0,80}(?:по|с|используя|на основе)[\s\S]{0,40}дизайн[- ]?систем/iu,
  ].some((pattern) => pattern.test(text));
}

function directiveValue(value: string): string {
  return value.replace(/[\r\n]+/gu, ' ').trim();
}

function optionalDirectiveValue(value: string | undefined): string | undefined {
  const normalized = directiveValue(value ?? '');
  return normalized || undefined;
}

function normalizeProposalId(value: string): string {
  return (
    value
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean)
      .at(-1)
      ?.replace(/[^a-z0-9._-]+/giu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 80) || 'design-source'
  );
}

function normalizeDisplayName(value: string): string {
  return value.replace(/\s+/gu, ' ').trim() || 'Design Source Screen';
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-z0-9]+/iu)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join('');
}

function toKebabCase(value: string): string {
  return value
    .split(/[^a-z0-9]+/iu)
    .filter(Boolean)
    .map((part) => part.toLowerCase())
    .join('-');
}
