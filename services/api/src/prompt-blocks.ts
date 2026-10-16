/**
 * Prompt block renderers (0136 R12 — extracted from prompt-builder.ts).
 *
 * Everything here turns already-resolved state into a string: the editor
 * block, the project-profile contract, the visual-design and selected-target
 * blocks, comments and tasks context, the component catalog and screen
 * templates.
 *
 * Pure by construction — no I/O, no awaits. `prompt-builder.ts` decides which
 * blocks apply to a profile and in what order; this module decides how each
 * one reads. Prompt text is a product contract replayed by the eval fixtures,
 * so the strings here are unchanged by the move.
 */
import {
  HTML_DESIGN_SYSTEM_PATHS,
  modalLayoutContractLines,
  screenSurface,
  type ComponentEntry,
  type ScreenTemplate,
} from '@sber-designer/shared-types';
import { getProject } from './project-store';
import { getState } from './state-store';

interface ActiveScreenCatalogHint {
  title: string;
  filePath: string;
  storyName: string;
}

export function renderEditorBlock(
  state: ReturnType<typeof getState>,
  activeScreenHint?: ActiveScreenCatalogHint | null,
): string {
  const lines = ['## Editor state'];
  lines.push(`- mode: \`${state.mode ?? 'interact'}\``);
  if (state.projectName) lines.push(`- project: \`${state.projectName}\``);
  if (state.workspacePath) lines.push(`- workspacePath: \`${state.workspacePath}\``);
  if (state.canvasUrl) lines.push(`- canvasUrl: ${state.canvasUrl}`);
  if (!isHtmlFirstEditorState(state)) {
    lines.push(
      '- generatedScreenConvention: keep Storybook files as thin wrappers under `src/stories/screens/<folder>/`; put editable page code in `src/screens/<folder>/`; use `Ungrouped` as the default folder when no other folder is selected; make screen name, story title/id, story file, and implementation file share the same readable name; do not append random/hash suffixes; use `New screen NN` (`NewScreenNN.tsx`) only for untitled screens; when registering a generated screen, pass both `filePath` and `implementationFilePath` to `screen_create`',
    );
  }
  lines.push(
    '- contentFidelityLanguage: keep product UI copy in the language of the user brief or specification unless the user explicitly requests a translation; do not silently anglicize domain labels',
  );
  lines.push(
    '- contentFidelityFacts: preserve names, amounts, dates, identifiers, and status labels verbatim; if a source fact is ambiguous, retain it and flag the uncertainty instead of inventing a replacement',
  );
  if (isHtmlFirstEditorState(state)) {
    lines.push(
      '- htmlScreenIndexContract: `index.html` is the managed Screens Index/project home; for new HTML pages, design-system screens, imports, and reference-to-screen tasks, create or edit `pages/<slug>.html` unless the user explicitly asks to edit Index/index.html; do not place a large screen in `index.html` by default because sber-designer updates index links automatically',
    );
  }
  lines.push(
    '- iconNameGuard: before using project `<Icon iconName="...">`, call `get_indexed_icon` or read `.sber-designer/design-index/icon-candidates.jsonl`; only `project-icon-prop` names are valid for string props. Use `project-asset` and `project-file` directly. If the result is `external-icon-reference`, call `materialize_indexed_icon` first and import only the returned project-local asset. `lucide-fallback` names require a `lucide-react` import and are not valid project Icon prop values unless also listed as `project-icon-prop`.',
  );
  if (state.activeScreen) {
    lines.push(`- activeScreen: \`${state.activeScreen.name}\` (${state.activeScreen.id})`);
    lines.push(`- activeScreenKind: \`${state.activeScreen.kind}\``);
    if (screenSurface(state.activeScreen) === 'modal') {
      lines.push(
        '- activeScreenSurface: `modal` — this screen is an overlay dialog. Keep its modal contract (viewport-filling backdrop, centered `data-sd-modal-window` dialog, transparent page background, header/body/footer regions, size in the contract CSS variables). Do NOT expand it into a full-screen page or change its surface unless the user explicitly asks.',
      );
    }
    if (state.activeScreen.folder)
      lines.push(`- activeScreenFolder: \`${state.activeScreen.folder}\``);
    if (state.activeScreen.storyId) {
      lines.push(`- activeScreenStoryId: \`${state.activeScreen.storyId}\``);
    }
    if (state.activeScreen.filePath) {
      lines.push(`- activeScreenFile: \`${state.activeScreen.filePath}\``);
    }
    if (state.activeScreen.implementationFilePath) {
      lines.push(
        `- activeScreenImplementationFile: \`${state.activeScreen.implementationFilePath}\``,
      );
    }
    if (activeScreenHint) {
      lines.push(
        `- activeScreenStorySource: \`${activeScreenHint.filePath}\` (${activeScreenHint.title} / ${activeScreenHint.storyName})`,
      );
    }
    if (state.activeScreen.description) {
      lines.push(`- activeScreenDescription: ${compactLine(state.activeScreen.description, 360)}`);
    }
    lines.push(
      '- activeScreenScope: active — inspect this screen/story first for targeted edits; avoid reading unrelated screens unless needed',
    );
  }
  if (state.assistantTaskIntent) {
    const intent = state.assistantTaskIntent;
    lines.push(`- assistantTaskIntent: \`${intent.kind}\``);
    lines.push(`- targetScreenId: \`${intent.targetScreenId}\``);
    if (intent.kind === 'edit-current-screen') {
      const activeFilePath = state.activeScreen?.filePath ?? null;
      const activeImplementationFilePath = state.activeScreen?.implementationFilePath ?? null;
      const activePageFile =
        state.activeScreen?.kind === 'page' &&
        isHtmlFilePath(activeImplementationFilePath ?? activeFilePath)
          ? (activeImplementationFilePath ?? activeFilePath)
          : null;
      const targetImplementationFile = activePageFile ?? activeImplementationFilePath;
      const targetStoryFile = activePageFile ? null : activeFilePath;
      if (targetImplementationFile) {
        lines.push(`- targetImplementationFile: \`${targetImplementationFile}\``);
      }
      if (targetStoryFile) {
        lines.push(`- targetStoryFile: \`${targetStoryFile}\``);
      }
      lines.push('- taskWriteScope: replace or patch the active screen implementation file only');
      lines.push(
        '- taskWriteGuard: do not call screen_create; do not create another screen; do not rename the active screen (its `name`) unless the user explicitly asked — use screen_update only for description/folder metadata, or for an explicitly requested rename via the storybook-screen-rename skill',
      );
      lines.push(
        '- allowedWriteTargets: use only targetImplementationFile and targetStoryFile from this context; do not invent a prettier replacement filename',
      );
      const currentScreenWriteTargets = uniqueStrings([targetImplementationFile, targetStoryFile]);
      if (currentScreenWriteTargets.length > 0) {
        lines.push(
          currentScreenWriteTargets.length === 1
            ? `- currentScreenWriteContract: the only writable file for this request is \`${currentScreenWriteTargets[0]}\`; do not create or rewrite other screen files during a current-screen edit`
            : `- currentScreenWriteContract: the only writable files for this request are ${currentScreenWriteTargets
                .map((path) => `\`${path}\``)
                .join(
                  ' and ',
                )}; never write to component source/story files under \`src/components/**\` during a current-screen edit`,
        );
      }
      if (targetImplementationFile) {
        lines.push(
          activePageFile
            ? `- currentScreenPrimaryOutput: write the generated HTML page UI into \`${targetImplementationFile}\``
            : `- currentScreenPrimaryOutput: write the generated screen UI into \`${targetImplementationFile}\`; component and atom stories are read-only examples, not output targets`,
        );
      }
      if (activePageFile) {
        lines.push(
          `- currentHtmlPageGuard: keep this follow-up on \`${activePageFile}\`; do not create another HTML page unless the user explicitly asks`,
        );
      }
      if (targetStoryFile) {
        lines.push(
          `- currentScreenStoryIdGuard: keep \`${targetStoryFile}\` as a thin wrapper with its existing Storybook title/id unless the user explicitly asks to rename the Storybook story; if you change its title, you must also call screen_update with the matching storyId`,
        );
      }
      lines.push(
        '- attachmentTargetRule: attached files are requirements only, including images; user text and target scope decide where the result is written',
      );
      lines.push(
        '- templateWrapperRule: if the implementation file is only a wrapper around a template/story, replace that implementation file with the new Design-readable screen and keep the existing story wrapper and screen registration',
      );
    } else {
      lines.push(`- targetScreenName: \`${intent.targetName}\``);
      lines.push(`- targetScreenFolder: \`${intent.targetFolder}\``);
      lines.push(`- targetStoryId: \`${intent.targetStoryId}\``);
      lines.push(`- targetStoryFile: \`${intent.targetStoryFilePath}\``);
      if (intent.targetImplementationFilePath) {
        lines.push(`- targetImplementationFile: \`${intent.targetImplementationFilePath}\``);
      }
      lines.push(
        '- taskWriteScope: edit the target implementation file first; keep the Storybook wrapper thin and do not register another screen',
      );
      lines.push(
        '- targetStoryImportRule: compute all relative imports from targetStoryFile; do not copy relative import paths from other stories without recomputing them',
      );
      lines.push(
        '- targetStoryValidation: write_file rejects TypeScript/JS files with unresolved relative imports',
      );
      if (intent.kind === 'create-screen-from-story') {
        lines.push(`- sourceStory: \`${intent.sourceStoryId}\``);
        if (intent.sourceStoryFilePath) {
          lines.push(`- sourceStoryFile: \`${intent.sourceStoryFilePath}\``);
        }
        lines.push('- sourceStoryMode: read-only');
      }
    }
  }
  if (state.selection) {
    lines.push(
      `- selection: \`${state.selection.tagName.toLowerCase()}\` at \`${state.selection.loc}\``,
    );
    if (state.selection.text)
      lines.push(`- selectionText: ${compactLine(state.selection.text, 220)}`);
    if (state.selection.selector) {
      lines.push(`- selectionSelector: \`${compactLine(state.selection.selector, 220)}\``);
    }
    if (state.selection.componentName) {
      lines.push(`- selectionComponent: \`${state.selection.componentName}\``);
    }
    if (state.selection.componentLoc) {
      lines.push(`- selectionComponentSource: \`${state.selection.componentLoc}\``);
    }
    const attributes = renderSelectionAttributes(state.selection.attributes);
    if (attributes) lines.push(`- selectionAttributes: ${attributes}`);
    lines.push(
      `- selectionScope: active — apply the user's next edit request to this selected element unless they clearly ask for a broader change`,
    );
    lines.push(
      `- selectionBounds: ${Math.round(state.selection.rect.width)}×${Math.round(
        state.selection.rect.height,
      )}`,
    );
  } else {
    lines.push('- selection: none');
  }
  if (state.selectedComment) {
    lines.push(`- selectedComment: \`${state.selectedComment.id}\``);
    lines.push(`- selectedCommentScreenId: \`${state.selectedComment.screenId}\``);
    lines.push(`- selectedCommentStatus: \`${state.selectedComment.status}\``);
    lines.push(
      `- selectedCommentAnchor: ${state.selectedComment.anchor.x.toFixed(
        4,
      )}, ${state.selectedComment.anchor.y.toFixed(4)}`,
    );
    lines.push(`- selectedCommentText: ${compactLine(state.selectedComment.body, 360)}`);
    if (state.selectedComment.selector) {
      lines.push(
        `- selectedCommentSelector: \`${compactLine(state.selectedComment.selector, 220)}\``,
      );
    }
    if (state.selectedComment.elementText) {
      lines.push(
        `- selectedCommentElementText: ${compactLine(state.selectedComment.elementText, 220)}`,
      );
    }
    lines.push(
      '- selectedCommentScope: active — resolve this review note against the active screen first',
    );
  } else {
    lines.push('- selectedComment: none');
  }
  return lines.join('\n');
}

function isHtmlFirstEditorState(state: ReturnType<typeof getState>): boolean {
  const project = getProject();
  const activePath =
    state.activeScreen?.implementationFilePath ?? state.activeScreen?.filePath ?? '';
  const activeHtmlPage =
    state.activeScreen?.kind === 'page' && activePath.toLowerCase().endsWith('.html');
  if (activeHtmlPage) return true;
  if (project.projectKind !== 'html-first') return false;
  const stateWorkspace = state.workspacePath?.trim();
  if (!stateWorkspace) return true;
  return project.workspacePath === stateWorkspace;
}

export function renderProjectProfileContractBlock(state: ReturnType<typeof getState>): string {
  const htmlFirst = isHtmlFirstEditorState(state);
  const isModal = screenSurface(state.activeScreen) === 'modal';
  const blocks: string[] = [];
  if (htmlFirst) {
    const activePath =
      state.activeScreen?.implementationFilePath ?? state.activeScreen?.filePath ?? 'index.html';
    const depth = Math.max(0, activePath.replace(/\\/gu, '/').split('/').length - 1);
    const prefix = depth > 0 ? '../'.repeat(depth) : './';
    blocks.push(
      [
        '## HTML/CSS Project Profile Contract',
        '',
        '- The active screen is a static semantic HTML page backed by the project CSS catalog.',
        `- Write the complete page to \`${activePath}\`; keep exactly one \`data-sd-screen-root\` and do not create another screen.`,
        `- Link the existing stylesheets as \`${prefix}${HTML_DESIGN_SYSTEM_PATHS.tokensCss}\` and \`${prefix}${HTML_DESIGN_SYSTEM_PATHS.componentsCss}\`; do not invent an aggregate stylesheet path.`,
        '- Reuse indexed catalog classes and token-backed custom properties such as `var(--color-*)` before adding page-local CSS.',
        '- Implement every visible reference region with real markup. Do not leave placeholder assets, TODOs, or comments standing in for charts, cards, icons, tables, or other visible content.',
        '- Use inline SVG or CSS geometry for reference icons and charts when the catalog has no asset.',
        '- If names, amounts, dates, or percentages are copied from an attached reference, preserve them verbatim and add one source comment: `<!-- Reference-backed content from the attached image. -->`.',
        '- Use HTML source, craft, and static canvas checks for validation; component-tree compatibility checks do not apply to this profile.',
      ].join('\n'),
    );
  }
  // Modal surface amendment applies to both profiles (Р-8). Reuses the shared
  // contract so edit/follow-up runs keep the scrim/window/size/region shape.
  if (isModal) {
    blocks.push(modalLayoutContractLines({ profile: htmlFirst ? 'html' : 'react' }).join('\n'));
  }
  return blocks.join('\n\n');
}

export function renderVisualDesignBlock(state: ReturnType<typeof getState>): string {
  const draftChanges = state.visualDesign?.draftChanges ?? [];
  if (state.mode !== 'design' && draftChanges.length === 0) return '';
  if (!state.selection && draftChanges.length === 0) return '';
  const lines = ['## Visual design context'];
  lines.push('The user is in Design mode or has a staged visual draft.');
  if (state.selection) {
    lines.push(
      `- selectedVisualTarget: \`${state.selection.componentName ?? state.selection.tagName.toLowerCase()}\` at \`${state.selection.loc}\``,
    );
    if (state.selection.sourceKind) {
      lines.push(`- selectedSourceKind: \`${state.selection.sourceKind}\``);
    }
    if (state.selection.text) {
      lines.push(`- selectedText: ${compactLine(state.selection.text, 220)}`);
    }
    if (state.selection.domPath) {
      lines.push(`- selectedDomPath: \`${compactLine(state.selection.domPath, 260)}\``);
    }
    if (state.selection.selector) {
      lines.push(`- selectedSelector: \`${compactLine(state.selection.selector, 220)}\``);
    }
    if (state.selection.componentPath?.length) {
      lines.push(`- selectedComponentPath: ${state.selection.componentPath.join(' > ')}`);
    }
    if (state.selection.selectionNotice) {
      lines.push(`- selectedResolution: ${compactLine(state.selection.selectionNotice, 260)}`);
    }
    if (state.selection.sourceKind === 'dom-fallback') {
      lines.push(
        '- selectedBaselineRule: DOM fallback selection is still valid agent context; search by selector, text, attributes, active screen, and nearby component source before editing.',
      );
    }
  }
  if (draftChanges.length === 0) {
    lines.push('- pendingVisualDraft: none');
    return lines.join('\n');
  }
  lines.push(
    `- pendingVisualDraft: ${draftChanges.length} change${draftChanges.length === 1 ? '' : 's'}`,
  );
  for (const change of draftChanges.slice(0, 12)) {
    const loc = change.loc
      ? `${change.filePath ?? 'file'}:${change.loc.line}:${change.loc.column}`
      : (change.filePath ?? 'unknown source');
    lines.push(`  - ${change.kind}: ${compactLine(change.label, 180)} (${loc})`);
  }
  if (draftChanges.length > 12) {
    lines.push(`  - ${draftChanges.length - 12} more visual draft changes omitted.`);
  }
  lines.push(
    '- visualDraftRule: if asked to apply or repair this draft, keep edits scoped to these target files and locations.',
  );
  return lines.join('\n');
}

export function renderSelectedTargetHardContractBlock(state: ReturnType<typeof getState>): string {
  const selection = state.selection;
  if (!selection) return '';
  const lines = [
    '## Selected target (hard contract)',
    '',
    'The user sent this request with a canvas element selected. For scoped edit requests, the selected DOM/source element is the hard target.',
    `- targetTag: \`${selection.tagName.toLowerCase()}\``,
    `- targetLoc: \`${selection.loc}\``,
  ];
  if (selection.sourceKind) lines.push(`- targetSourceKind: \`${selection.sourceKind}\``);
  if (selection.text) lines.push(`- targetText: ${compactLine(selection.text, 220)}`);
  if (selection.selector) {
    lines.push(`- targetSelector: \`${compactLine(selection.selector, 220)}\``);
  }
  if (selection.componentName) lines.push(`- targetComponent: \`${selection.componentName}\``);
  if (selection.componentLoc) lines.push(`- targetComponentSource: \`${selection.componentLoc}\``);
  if (selection.domPath) lines.push(`- targetDomPath: \`${compactLine(selection.domPath, 260)}\``);
  if (selection.componentPath?.length) {
    lines.push(`- targetComponentPath: ${selection.componentPath.join(' > ')}`);
  }
  lines.push(
    '- hardTargetRule: do not satisfy a scoped request by editing a nearby, visually similar, or same-role element.',
    '- hardTargetFallback: if the selected target cannot be resolved safely, ask for clarification instead of editing another element.',
  );
  return lines.join('\n');
}

export function renderCommentsContextBlock(state: ReturnType<typeof getState>): string {
  const comments = state.commentContext ?? [];
  if (comments.length === 0) {
    return '## Comments context\n\n_No comments are currently attached to the assistant context._';
  }
  const lines = [`## Comments context (${comments.length})`, ''];
  for (const comment of comments.slice(0, 12)) {
    const body = compactLine(comment.body, 360);
    const anchor = `${comment.anchor.x.toFixed(4)}, ${comment.anchor.y.toFixed(4)}`;
    lines.push(`- ${comment.id} on screen \`${comment.screenId}\` at ${anchor}: ${body}`);
    if (comment.selector) {
      lines.push(`  selector: \`${compactLine(comment.selector, 220)}\``);
    }
    if (comment.elementText) {
      lines.push(`  element text: ${compactLine(comment.elementText, 220)}`);
    }
  }
  if (comments.length > 12) {
    lines.push(`- ${comments.length - 12} more comments omitted from prompt.`);
  }
  return lines.join('\n');
}

export function renderTasksContextBlock(state: ReturnType<typeof getState>): string {
  const tasks = state.taskContext ?? [];
  if (tasks.length === 0) {
    return '## Tasks context\n\n_No tasks are currently attached to the assistant context._';
  }
  const lines = [`## Tasks context (${tasks.length})`, ''];
  for (const task of tasks.slice(0, 12)) {
    const title = compactLine(task.title, 240);
    const source = task.url ? `${task.source} ${task.url}` : task.source;
    lines.push(`- ${task.id} (${source}): ${title}`);
    if (task.screenIds.length > 0) {
      lines.push(`  screens: ${task.screenIds.map((screenId) => `\`${screenId}\``).join(', ')}`);
    }
    if (task.status) lines.push(`  status: ${compactLine(task.status, 120)}`);
    if (task.priority) lines.push(`  priority: ${compactLine(task.priority, 120)}`);
    if (task.description) {
      lines.push(`  description: ${compactLine(task.description, 500)}`);
    }
  }
  if (tasks.length > 12) {
    lines.push(`- ${tasks.length - 12} more tasks omitted from prompt.`);
  }
  return lines.join('\n');
}

export function resolveActiveScreenCatalogHint(
  activeScreen: ReturnType<typeof getState>['activeScreen'],
  components: ComponentEntry[],
): ActiveScreenCatalogHint | null {
  if (!activeScreen?.storyId) return null;
  for (const component of components) {
    const story = component.stories.find((candidate) => candidate.id === activeScreen.storyId);
    if (story) {
      return {
        title: component.title,
        filePath: component.filePath,
        storyName: story.name,
      };
    }
  }
  return null;
}

function renderSelectionAttributes(attributes: Record<string, string> | undefined): string {
  if (!attributes) return '';
  const rendered = Object.entries(attributes)
    .filter(([, value]) => value.trim().length > 0)
    .slice(0, 8)
    .map(([key, value]) => `${key}="${compactLine(value, 120)}"`);
  return rendered.join(' ');
}

export function renderCatalogBlock(
  components: ComponentEntry[],
  source: 'storybook' | 'static',
): string {
  if (components.length === 0) {
    if (source === 'static') {
      return '## Catalog\n\n_No default-exported React components found in the workspace._';
    }
    return '## Catalog\n\n_Storybook is up but reports no stories yet._';
  }
  // Compact one-line-per-component format. ~50–100 chars per line, so
  // a 200-component DS fits in <20K chars.
  const lines = components.map((c) => {
    const usageNotes = renderComponentUsageNotes(c);
    if (source === 'static') {
      return `- **${c.shortName}** · ${c.filePath}${usageNotes}`;
    }
    const stories = c.stories.map((s) => s.name).join(', ');
    return `- **${c.shortName}** (${c.title}) · ${c.filePath} · stories: ${
      stories || '—'
    }${usageNotes}`;
  });
  const header =
    source === 'static'
      ? `## Catalog (static AST scan, ${components.length} components)`
      : `## Catalog (${components.length} components)`;
  return `${header}\n\n${lines.join('\n')}`;
}

function renderComponentUsageNotes(component: ComponentEntry): string {
  const layer = component.descriptionLayer;
  if (layer) {
    const usage = layer.usage
      .slice(0, 3)
      .map((item) => `${item.title}: ${item.when}`)
      .join(' | ');
    const guidance = layer.agentGuidance.slice(0, 3).join(' | ');
    return [
      `\n  purpose: ${compactLine(layer.purpose, 280)}`,
      usage ? `\n  usage: ${compactLine(usage, 360)}` : '',
      guidance ? `\n  agent guidance: ${compactLine(guidance, 360)}` : '',
    ].join('');
  }
  if (component.description) {
    return `\n  description: ${compactLine(component.description, 520)}`;
  }
  return '';
}

export function renderScreenTemplatesBlock(
  templates: ScreenTemplate[],
  screenReferencesForbidden = false,
): string {
  const visible = templates.filter((template) => template.status !== 'deprecated');
  if (visible.length === 0) {
    return [
      '## Screen templates',
      '',
      screenReferencesForbidden
        ? '_No screen templates are available. Use the project index, catalog components, tokens, and the explicit brief without inspecting existing screen/page implementations._'
        : '_No screen templates are available. For new screens, use the project index, catalog components, and existing screens._',
    ].join('\n');
  }

  const rendered = visible.map((template) => {
    const roles = template.componentRoles?.map((role) => role.role).join(', ');
    const meta = [template.kind ?? 'custom', template.source].join(' · ');
    return [
      `- ${template.name} (id: ${template.id}, ${meta})`,
      `  ${oneLine(template.description, 200)}`,
      roles ? `  roles: ${oneLine(roles, 200)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  });

  return [
    `## Screen templates (${visible.length})`,
    '',
    'Summaries only. When the user selects a template for a new screen, its full body and ASCII layout schema arrive in the run prompt; call read_screen_template({ id, source }) to pull a full template on demand. When a template is selected, follow its regions and layout; improvise only when a region genuinely does not fit the screen, and note any deviation in your summary.',
    '',
    ...rendered,
  ].join('\n');
}

function oneLine(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1).trimEnd()}…`;
}

export function trimTemplateContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 3_500) return trimmed;
  return `${trimmed.slice(0, 3_500).trim()}\n\n[template truncated]`;
}

export function compactLine(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 3).trim()}...`;
}

function isHtmlFilePath(filePath: string | null | undefined): boolean {
  return Boolean(filePath && /\.html?$/iu.test(filePath));
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
