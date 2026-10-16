/** Component catalog shapes (ADR-0011). */

export interface ComponentUsageExample {
  title: string;
  when: string;
  props?: Record<string, string>;
}

export interface ComponentVariantGuidance {
  /** Prop or facet the values belong to, e.g. `variant`. */
  prop: string;
  values: { value: string; meaning: string }[];
}

export interface ComponentDescriptionLayer {
  purpose: string;
  anatomy: string[];
  usage: ComponentUsageExample[];
  agentGuidance: string[];
  sourceHtml?: string;
  /**
   * 0083 authored "Description for AI" fields. Optional for back-compat with
   * pre-0083 layers; this is the canonical structured source going forward
   * (rendered to docs markdown via the project-local `describeComponent` helper,
   * see task 0197). Populated from a Storybook `## Description for AI` section,
   * `parameters.sberDesigner.descriptionLayer`, or a no-Storybook sidecar.
   */
  schemaVersion?: number;
  /** 2–3 retrieval keywords; feeds the thin description-map / search. */
  keywords?: string[];
  whenToUse?: string[];
  whenNotToUse?: string[];
  variantGuidance?: ComponentVariantGuidance[];
  requiredProps?: string[];
  canonicalSnippets?: { code: string; label?: string }[];
  pairsWith?: string[];
  a11yNotes?: string[];
  interactionNotes?: string[];
  /** Provenance for promoted human facts (0080 interview/reference/feedback). */
  evidence?: { source: string; ref?: string }[];
  status?: 'draft' | 'confirmed';
  /** Deterministic freshness marker (ISO string). */
  updatedAt?: string;
}

export interface StoryDescriptionLayer {
  purpose: string;
  usage?: ComponentUsageExample[];
  agentGuidance: string[];
}

export interface StoryEntry {
  /** Storybook id, e.g. "atoms-button--primary". */
  id: string;
  /** Display name within the component, e.g. "Primary". */
  name: string;
  /** Direct URL to the iframe preview of this exact story. */
  previewUrl: string;
  /** Optional Storybook docs / sberDesigner usage notes for this story. */
  description?: string;
  /** Structured story usage metadata for agent context. */
  descriptionLayer?: StoryDescriptionLayer;
}

export interface ComponentEntry {
  /** Stable id (for storybook source: title kebab-cased). */
  id: string;
  /** Full path used in the Storybook sidebar, e.g. "Atoms/Button". */
  title: string;
  /** Last segment of title — chip label. */
  shortName: string;
  /** Workspace-relative path to the source file (importPath in CSF). */
  filePath: string;
  /** Markdown description from Storybook docs or local sidecar. */
  description?: string;
  /** Structured component usage metadata for agent context. */
  descriptionLayer?: ComponentDescriptionLayer;
  /** Managed HTML design-system preview anchor for css-catalog components. */
  docsAnchor?: string;
  /** Stories grouped under this component. Empty for static-scan source. */
  stories: StoryEntry[];
}

export interface ComponentCatalog {
  /** How the catalog was built. */
  source: 'storybook' | 'static';
  /** Epoch ms when this snapshot was produced. */
  generatedAt: number;
  /** Resolved preview URL the catalog was built from (storybook source). */
  previewUrl?: string;
  components: ComponentEntry[];
}
