/**
 * Catalog tools: component list, screen/project templates, design context.
 */
import { z } from 'zod';
import type {
  ComponentCatalog,
  ComponentDescriptionLayer,
  ProjectTemplate,
  ScreenTemplate,
} from '@sber-designer/shared-types';

import { resolveCatalog } from '../../catalog-cache';
import { loadProjectDesignContext, type ProjectDesignContext } from '../../design-context';
import { listProjectTemplates as loadProjectTemplates } from '../../project-templates';
import { findScreenTemplate, resolveScreenTemplates } from '../../screen-templates';
import type { ServerTool } from '../types';

const ListComponentsInput = z
  .object({
    query: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const listComponents: ServerTool<
  z.infer<typeof ListComponentsInput>,
  {
    source: string;
    components: {
      id: string;
      title: string;
      shortName: string;
      filePath: string;
      storyCount: number;
      description?: string;
      descriptionLayer?: ComponentDescriptionLayer;
    }[];
  }
> = {
  name: 'list_components',
  description:
    "List components available in the connected project's Storybook. Use before suggesting which component to use; do not invent components that aren't on this list.",
  inputSchema: ListComponentsInput,
  handler: async (input, ctx) => {
    if (!ctx.canvasUrl && !ctx.workspacePath) {
      throw new Error(
        'No active sandbox and no known workspace. Ask the user to Connect a project first.',
      );
    }
    const result = await resolveCatalog({
      canvasUrl: ctx.canvasUrl,
      workspacePath: ctx.workspacePath,
    });
    if ('unavailable' in result) {
      throw new Error(`Catalog unavailable: ${result.unavailable}`);
    }
    const { catalog } = result;
    const components = filterComponentList(catalog.components, input.query).slice(
      0,
      input.limit ?? catalog.components.length,
    );
    return {
      source: catalog.source,
      components: components.map((c) => ({
        id: c.id,
        title: c.title,
        shortName: c.shortName,
        filePath: c.filePath,
        storyCount: c.stories.length,
        ...(c.description ? { description: c.description } : {}),
        ...(c.descriptionLayer ? { descriptionLayer: c.descriptionLayer } : {}),
      })),
    };
  },
};

function filterComponentList(
  components: ComponentCatalog['components'],
  query: string | undefined,
): ComponentCatalog['components'] {
  const tokens = query
    ?.toLowerCase()
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens || tokens.length === 0) return components;
  return components.filter((component) => {
    const haystack = [
      component.id,
      component.title,
      component.shortName,
      component.filePath,
      component.description,
      component.descriptionLayer?.purpose,
      component.descriptionLayer?.agentGuidance,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  });
}

// ---------- list_screen_templates / list_project_templates -------------

const ListScreenTemplatesInput = z.object({}).strict();

export const listScreenTemplates: ServerTool<
  z.infer<typeof ListScreenTemplatesInput>,
  { templates: ScreenTemplate[] }
> = {
  name: 'list_screen_templates',
  description:
    "List screen templates for new-screen tasks: built-in sber-designer recipes plus project-local `.sber-designer/screen-templates/*.screen.md`. Same-id built-in and project templates both appear, tagged by `source`. Use read_screen_template to pull one template's full ASCII layout schema.",
  inputSchema: ListScreenTemplatesInput,
  handler: async (_input, ctx) => ({
    templates: (await resolveScreenTemplates(ctx.workspacePath)).templates,
  }),
};

const ReadScreenTemplateInput = z
  .object({
    id: z.string().min(1),
    source: z.enum(['built-in', 'project']).default('built-in'),
  })
  .strict();

export const readScreenTemplate: ServerTool<
  z.infer<typeof ReadScreenTemplateInput>,
  { template: ScreenTemplate | null },
  z.input<typeof ReadScreenTemplateInput>
> = {
  name: 'read_screen_template',
  description:
    'Read one screen template (full markdown body including the ASCII layout schema) by id and source ("built-in" or "project"). Returns null when no template matches.',
  inputSchema: ReadScreenTemplateInput,
  handler: async (input, ctx) => {
    const { templates } = await resolveScreenTemplates(ctx.workspacePath);
    return { template: findScreenTemplate(templates, input) ?? null };
  },
};

const ListProjectTemplatesInput = z.object({}).strict();

export const listProjectTemplates: ServerTool<
  z.infer<typeof ListProjectTemplatesInput>,
  { templates: ProjectTemplate[] }
> = {
  name: 'list_project_templates',
  description:
    'Compatibility alias for list_screen_templates. Returns built-in screen templates only; project-specific template pages should be discovered through Storybook/catalog.',
  inputSchema: ListProjectTemplatesInput,
  handler: async (_input, ctx) => ({
    templates: await loadProjectTemplates(ctx.workspacePath ?? undefined),
  }),
};

// ---------- list_design_context ----------------------------------------

const ListDesignContextInput = z.object({}).strict();

export const listDesignContext: ServerTool<
  z.infer<typeof ListDesignContextInput>,
  ProjectDesignContext
> = {
  name: 'list_design_context',
  description:
    'Legacy fallback: read DESIGN.md and old component-selection-map.md/project prompt summary from the connected workspace. Prefer get_project_index_status and search_project_index for new work.',
  inputSchema: ListDesignContextInput,
  handler: async (_input, ctx) => {
    if (!ctx.workspacePath) {
      throw new Error('No workspace connected.');
    }
    return loadProjectDesignContext(ctx.workspacePath);
  },
};

// ---------- project index tools ----------------------------------------
