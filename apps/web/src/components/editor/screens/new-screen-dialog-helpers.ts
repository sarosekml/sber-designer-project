import {
  designBriefForbidsExistingScreenReferences,
  modalLayoutContractText,
  type ComponentEntry,
  type DesignBrief,
  type DesignBriefDensity,
  type ModalDefaults,
  type ProjectScreenSurface,
  type ScreenTemplate,
} from '@sber-designer/shared-types';

import { UNGROUPED_SCREEN_FOLDER } from '@/lib/screen-folders';

interface HtmlProjectProfile {
  sourceRoots?: string[];
}

export function buildHtmlPageScreenMetadata(input: {
  name: string;
  folder: string;
  profile: HtmlProjectProfile | null;
}) {
  const cleanName = input.name.trim() || 'New screen';
  const screenSlug = slugHtmlSegment(cleanName);
  const root = preferredHtmlRoot(input.profile);
  const folderSegment =
    input.folder && input.folder !== UNGROUPED_SCREEN_FOLDER
      ? `/${slugHtmlSegment(input.folder)}`
      : '';
  return {
    cleanName,
    screenSlug,
    folder: input.folder,
    filePath: `${root}${folderSegment}/${screenSlug}.html`,
  };
}

export interface NewScreenDesignBriefInput {
  palette?: string;
  typography?: string;
  layout?: string;
  mood?: string;
  density?: DesignBriefDensity | '';
  constraints?: string;
}

export function buildNewScreenDesignBrief(input: NewScreenDesignBriefInput): DesignBrief | null {
  const palette = normalizedBriefValue(input.palette);
  const typography = normalizedBriefValue(input.typography);
  const layout = normalizedBriefValue(input.layout);
  const mood = normalizedBriefValue(input.mood);
  const constraints = [
    ...new Set(
      (input.constraints ?? '')
        .split(/\r?\n/u)
        .map((item) => normalizedBriefValue(item))
        .filter((item): item is string => Boolean(item)),
    ),
  ].slice(0, 8);
  const axes = {
    ...(palette ? { palette } : {}),
    ...(typography ? { typography } : {}),
    ...(layout ? { layout } : {}),
    ...(mood ? { mood } : {}),
    ...(input.density ? { density: input.density } : {}),
    ...(constraints.length > 0 ? { constraints } : {}),
  };
  if (Object.keys(axes).length === 0) return null;
  return { version: 1, source: 'mini-form', axes };
}

export function generationOptionsForNewScreen(
  wireframe: boolean,
  critique: boolean,
  designBrief: DesignBrief | null = null,
  modalContext?: {
    surface: ProjectScreenSurface;
    modal?: ModalDefaults;
  },
) {
  if (!wireframe && !critique && !designBrief && !modalContext) return {};
  return {
    generation: {
      ...(wireframe ? { wireframe: true } : {}),
      ...(critique ? { critique: true } : {}),
      ...(designBrief ? { designBrief } : {}),
      ...(modalContext ? { surface: modalContext.surface } : {}),
      ...(modalContext?.modal ? { modal: modalContext.modal } : {}),
    },
  };
}

export function blankHtmlPageTemplate(name: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtmlText(name)}</title>
  </head>
  <body data-sd-screen-root>
    <main aria-label="${escapeHtmlText(name)}">
      <section data-sd-empty-canvas="true"></section>
    </main>
  </body>
</html>
`;
}

export function buildBlankHtmlScreenPrompt(input: {
  name: string;
  filePath: string;
  folder: string;
  instruction: string;
  designBrief: DesignBrief | null;
  surface: ProjectScreenSurface;
  modalDefaults?: ModalDefaults;
}): string {
  const screenReferencePolicy = designBriefForbidsExistingScreenReferences(input.designBrief)
    ? '- Do not inspect or copy existing screen/page implementations for layout, content, or visual direction. Component source and catalog examples may be read only to verify API, classes, and imports.'
    : '- Search the design index for CSS catalog components, tokens, assets, and existing page patterns.';
  const modalContract =
    input.surface === 'modal'
      ? `\n\n${modalLayoutContractText({
          profile: 'html',
          ...(input.modalDefaults ? { defaults: input.modalDefaults } : {}),
        })}`
      : '';
  return `[act-mode] Create a new production-quality ${input.surface === 'modal' ? 'HTML/CSS modal' : 'HTML/CSS page'} named "${input.name}".

Target static ${input.surface === 'modal' ? 'modal' : 'page'}:
- page file: ${input.filePath}
- Screens folder: ${input.folder}

User instruction:
${input.instruction}

The page already exists in the project. Do not call screen_create or screen_remove for this task.
Do not write this generated page to index.html: index.html is the managed Screens Index/project home and sber-designer will update it with a link automatically. Use ${input.filePath}.

Use the current project index before editing:
${screenReferencePolicy}
- Keep the page as semantic HTML.
- Reuse existing CSS variables with var(--token-name) and existing catalog classes when they fit.
- Do not introduce React, Storybook, Tailwind, or package dependencies unless the project profile/index already exposes them.
- Keep data-sd-screen-root on the root ${input.surface === 'modal' ? 'modal backdrop' : 'page container'} so canvas render verification can find it.${modalContract}

Use write_file/apply_patch for ${input.filePath}. When done, summarize the CSS catalog classes and tokens you reused.`;
}

export function blankImplementationTemplate(name: string, componentName: string): string {
  return `import React from 'react';

export function ${componentName}() {
  return (
    <main
      data-sd-screen-root="true"
      aria-label={${JSON.stringify(name)}}
      style={{ minHeight: '100vh', background: '#ffffff', color: '#111827' }}
    >
      <section
        data-sd-empty-canvas="true"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 48,
        }}
      >
        <div
          style={{
            width: 'min(100%, 960px)',
            minHeight: 520,
            border: '1px dashed #d1d5db',
            borderRadius: 16,
            background: '#ffffff',
          }}
        />
      </section>
    </main>
  );
}
`;
}

export function buildBlankScreenPrompt(input: {
  name: string;
  storyFilePath: string;
  implementationFilePath: string;
  folder: string;
  storyId: string;
  storyTitle: string;
  instruction: string;
  components: ComponentEntry[];
  template: ScreenTemplate | null;
  designBrief: DesignBrief | null;
  surface?: ProjectScreenSurface;
  modalDefaults?: ModalDefaults;
}): string {
  const surface = input.surface ?? 'page';
  const screenReferencesForbidden = designBriefForbidsExistingScreenReferences(input.designBrief);
  const catalogSummary =
    input.components.length > 0
      ? input.components
          .map((component) => {
            const purpose =
              component.descriptionLayer?.purpose ?? firstParagraph(component.description);
            const guidance = component.descriptionLayer?.agentGuidance?.slice(0, 2).join(' | ');
            return [
              `- ${component.title} (${component.filePath}, ${component.stories.length} stories)`,
              purpose ? `  purpose: ${compactPromptLine(purpose, 260)}` : '',
              guidance ? `  guidance: ${compactPromptLine(guidance, 260)}` : '',
            ]
              .filter(Boolean)
              .join('\n');
          })
          .join('\n')
      : '- Catalog is still loading. Use list_components before editing.';
  const templateBlock = input.template
    ? `Selected screen template:
- name: ${input.template.name}
- id: ${input.template.id}
- source: ${input.template.source}
- description: ${input.template.description}

Treat the ASCII layout schema and Regions below as the intended block
arrangement. Build those regions in order and resolve each labelled role to a
real project component. Improvise only as a last resort when a region genuinely
does not fit this screen's logic, and note any deviation in your final summary.

${input.template.content}`
    : screenReferencesForbidden
      ? 'Without template selected. Use the project index, catalog components, tokens, and the user instruction to choose structure.'
      : 'Without template selected. Use the project index, catalog components, existing screens, and the user instruction to choose structure.';
  const screenReferencePolicy = screenReferencesForbidden
    ? '\nExisting-screen reference policy:\n- Do not inspect or copy existing screen/page implementations for layout, content, or visual direction.\n- Component source and Storybook examples may be read only to verify API and imports.\n'
    : '';
  const withoutTemplateGuidance = screenReferencesForbidden
    ? 'If "Without template" is selected, infer structure from the user instruction, project tokens, component documentation, and catalog usage notes.'
    : 'If "Without template" is selected, infer structure from the user instruction, indexed screens, and catalog usage notes.';
  const modalContract =
    surface === 'modal'
      ? `\n\n${modalLayoutContractText({
          profile: 'react',
          ...(input.modalDefaults ? { defaults: input.modalDefaults } : {}),
        })}`
      : '';
  return `[act-mode] Create a new production-quality ${surface === 'modal' ? 'modal screen' : 'screen'} named "${input.name}".

Target Storybook story:
- storyId: ${input.storyId}
- title: ${input.storyTitle}
- story wrapper file: ${input.storyFilePath}
- implementation file: ${input.implementationFilePath}
- Screens folder: ${input.folder}

User instruction:
${input.instruction}

Selected template:
${templateBlock}
${screenReferencePolicy}

The screen already exists in the project. Do not call screen_create or screen_remove for this task.

Import safety:
- The implementation file is nested at ${input.implementationFilePath}; compute every relative import from that file, not from any source story you read.
- The Storybook wrapper is nested at ${input.storyFilePath}; keep it thin and only update it if the implementation export changes.
- Do not copy relative imports from another story unless you recompute them for the target file.
- In generated screen stories under src/stories/screens/<folder>, imports from src/pages or src/components usually start with ../../../pages/... or ../../../components/...
- write_file will reject unresolved relative imports, so fix the path before writing.
- Use @storybook/react for Meta/StoryObj imports when writing Storybook stories in this project.

Use the existing Storybook catalog as the design system:
- First read the relevant component source files from the catalog snapshot.
- Compose the target story primarily from exported catalog components and their props.
- Follow component purpose, usage examples, and agent guidance when they are present.
- Follow the selected screen template's layout schema and regions when one is provided; deviate only when a region genuinely does not fit, and say so. ${withoutTemplateGuidance}
- Do not hardcode standalone HTML controls, cards, headers, or navigation if the catalog has a matching component.
- Use only minimal wrapper markup/styles for page layout when the catalog has no layout primitive.
- If a requested piece is missing from the design system, keep that new markup small and call out the gap.

Use write_file/apply_patch for the implementation file first. Keep the generated Storybook wrapper as a thin registration file. When done, keep the screen selected and summarize which catalog components you reused.${modalContract}

Available catalog snapshot:
${catalogSummary}`;
}

function preferredHtmlRoot(profile: HtmlProjectProfile | null): string {
  const roots = profile?.sourceRoots ?? [];
  return (
    roots.find((root) => /^(pages|screens|site|public)$/u.test(root)) ??
    roots.find((root) => /^(docs|web|static)$/u.test(root)) ??
    'pages'
  );
}

function slugHtmlSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'screen'
  );
}

function normalizedBriefValue(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/gu, ' ').trim();
  return normalized ? normalized.slice(0, 400) : null;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstParagraph(markdown: string | undefined): string | null {
  if (!markdown) return null;
  return (
    markdown
      .split(/\n\s*\n/)
      .map((part) => part.replace(/^#+\s*/gm, '').trim())
      .find(Boolean) ?? null
  );
}

function compactPromptLine(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 3).trim()}...`;
}
