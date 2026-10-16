import {
  scanComponentVariants,
  type ComponentUsageCard,
  type DesignIndexDiagnostic,
  type IndexedComponentRecord,
} from '@sber-designer/design-indexer';
import type { DesignBrief, ScreenStructurePlan } from '@sber-designer/shared-types';

import type { ComponentUseCandidate } from './component-pack';
import {
  authoritativeSnippets,
  authoritativeVariantAxes,
  chooseVariants,
  extractLiteralProps,
  renderPublicImportContract,
  renderVariantAxis,
  resolutionContext,
  resolveCriticalProps,
  resolvePublicImport,
} from './component-resolution-match';
import type { ImportConvention } from './import-conventions';
import type { ModuleExports } from './public-exports';

export interface ResolvedComponentPublicImport {
  name: string;
  module: string;
  verified: boolean;
  evidence: 'confirmed-usage' | 'public-barrel' | 'usage-card' | 'source-index';
}

export interface ResolvedComponentVariant {
  prop: string;
  value: string;
  meaning?: string;
  allowedBy: 'source-type' | 'storybook-argtypes' | 'css-catalog';
  selectedBy: 'task-intent' | 'confirmed-usage';
  evidence?: string;
}

export interface ResolvedComponentCriticalProp {
  name: string;
  required: boolean;
  value?: string;
  evidence: 'source-type' | 'confirmed-usage' | 'css-catalog' | 'usage-card';
  evidenceRef?: string;
}

export interface ComponentContractResolutionTrace {
  componentId: string;
  role: string;
  regionIds: string[];
  status: 'resolved' | 'partial' | 'unverified';
  publicImport?: ResolvedComponentPublicImport;
  chosenVariants: ResolvedComponentVariant[];
  criticalProps: ResolvedComponentCriticalProp[];
  unresolvedVariantProps: string[];
  divergedFields: string[];
  excludedAuthoredFacts: string[];
}

export interface ResolveSelectedComponentContractsInput {
  workspaceRoot: string;
  candidates: ComponentUseCandidate[];
  components: IndexedComponentRecord[];
  cardsByComponent: Map<string, ComponentUsageCard>;
  divergenceFieldsByComponent: Map<string, string[]>;
  importConventions: ImportConvention[];
  userRequest: string;
  designBrief?: DesignBrief | null | undefined;
  screenStructurePlan?: ScreenStructurePlan | null;
  allowScreenUsageEvidence: boolean;
}

/**
 * Resolve the selected components against current source/types and observed
 * project usage before their contracts reach the generation prompt.
 */
export async function resolveSelectedComponentContracts(
  input: ResolveSelectedComponentContractsInput,
): Promise<ComponentContractResolutionTrace[]> {
  const selectedIds = new Set(input.candidates.map((candidate) => candidate.componentId));
  const selectedComponents = input.components.filter((component) => selectedIds.has(component.id));
  const freshVariants = await scanComponentVariants({
    workspaceRoot: input.workspaceRoot,
    components: selectedComponents,
  }).catch(() => []);
  const freshByComponent = new Map(freshVariants.map((record) => [record.componentId, record]));
  const componentsById = new Map(input.components.map((component) => [component.id, component]));
  const exportCache = new Map<string, ModuleExports>();
  const traces: ComponentContractResolutionTrace[] = [];

  for (const candidate of input.candidates) {
    const component = componentsById.get(candidate.componentId);
    if (!component) continue;
    const card = input.cardsByComponent.get(candidate.componentId);
    const divergedFields = input.divergenceFieldsByComponent.get(candidate.componentId) ?? [];
    candidate.divergedFields = divergedFields;
    const snippets = authoritativeSnippets(card, divergedFields, input.allowScreenUsageEvidence);
    const snippet = snippets[0];
    if (snippet) candidate.snippet = { code: snippet.code, sourcePath: snippet.sourcePath };
    else delete candidate.snippet;

    const fresh = freshByComponent.get(candidate.componentId);
    const axes = authoritativeVariantAxes(component, card, fresh?.props, divergedFields);
    if (axes.length > 0) candidate.variantHints = axes.map(renderVariantAxis);
    else delete candidate.variantHints;

    const sourceRequiredProps = fresh?.requiredProps;
    if (sourceRequiredProps) {
      if (sourceRequiredProps.length > 0) candidate.requiredProps = sourceRequiredProps;
      else delete candidate.requiredProps;
    } else if (divergedFields.includes('requiredProps')) {
      delete candidate.requiredProps;
    }

    const publicImport = await resolvePublicImport({
      workspaceRoot: input.workspaceRoot,
      component,
      card,
      importConventions: input.importConventions,
      exportCache,
    });
    candidate.publicImport = publicImport;
    candidate.importHint = publicImport.module;
    if (publicImport.name !== candidate.shortName) {
      candidate.componentFamily = Array.from(
        new Set([...(candidate.componentFamily ?? [candidate.shortName]), publicImport.name]),
      );
    }
    candidate.guidance = candidate.guidance.filter(
      (item) => !item.startsWith('Public import contract:'),
    );
    candidate.guidance.unshift(renderPublicImportContract(publicImport));

    const context = resolutionContext(candidate, input);
    const snippetProps = snippet
      ? extractLiteralProps(snippet.code, [candidate.shortName, publicImport.name])
      : new Map<string, string>();
    const chosenVariants = chooseVariants(axes, context, snippetProps, snippet?.sourcePath);
    const criticalProps = resolveCriticalProps({
      candidate,
      card,
      chosenVariants,
      snippetProps,
      ...(snippet?.sourcePath ? { snippetPath: snippet.sourcePath } : {}),
      sourceRequiredProps: sourceRequiredProps ?? null,
      divergedFields,
    });
    const unresolvedVariantProps = axes
      .filter((axis) => !chosenVariants.some((choice) => choice.prop === axis.prop))
      .map((axis) => axis.prop);
    const excludedAuthoredFacts = divergedFields.map((field) => `descriptionLayer.${field}`);
    if (excludedAuthoredFacts.length > 0) {
      candidate.guidance.unshift(
        `Diverged authored facts excluded from authoritative guidance: ${excludedAuthoredFacts.join(', ')}.`,
      );
    }
    const status = !publicImport.verified
      ? 'unverified'
      : unresolvedVariantProps.length > 0
        ? 'partial'
        : 'resolved';
    const trace: ComponentContractResolutionTrace = {
      componentId: candidate.componentId,
      role: candidate.role,
      regionIds: candidate.regionIds ?? [],
      status,
      publicImport,
      chosenVariants,
      criticalProps,
      unresolvedVariantProps,
      divergedFields,
      excludedAuthoredFacts,
    };
    candidate.resolution = trace;
    traces.push(trace);
  }
  return traces;
}

export function descriptionDivergenceFieldsByComponent(
  diagnostics: DesignIndexDiagnostic[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const diagnostic of diagnostics) {
    const match = /description-diverged:\s+(\S+)\s+has divergent\s+(.+?)\s+between\b/iu.exec(
      diagnostic.message,
    );
    const componentId = match?.[1];
    const fields = match?.[2];
    if (!componentId || !fields) continue;
    result.set(
      componentId,
      fields
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean),
    );
  }
  return result;
}
