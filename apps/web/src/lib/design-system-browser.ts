import type {
  ProjectAgentNote,
  ProjectDesignSystemBrowser,
  ProjectSetupQuestion,
} from './api-client';

export type DesignSystemBrowserCategory =
  | 'all'
  | 'components'
  | 'tokens'
  | 'icons'
  | 'assets'
  | 'screens'
  | 'routes'
  | 'notes'
  | 'health';

export type DesignSystemBrowserItemKind =
  | 'health'
  | 'component'
  | 'token'
  | 'icon'
  | 'asset'
  | 'screen'
  | 'route'
  | 'note';

export interface DesignSystemBrowserItem {
  id: string;
  kind: DesignSystemBrowserItemKind;
  category: Exclude<DesignSystemBrowserCategory, 'all'>;
  title: string;
  subtitle: string;
  meta: string;
  status: 'ready' | 'missing' | 'warning' | 'stale';
  searchText: string;
  noteCount?: number;
  componentId?: string;
  sourcePath?: string | undefined;
  preview: {
    kind: DesignSystemBrowserItemKind | 'color';
    label: string;
    value?: string;
  };
  actions: { id: string; label: string; value: string }[];
  noteId?: string;
  noteText?: string;
  noteIntent?: ProjectAgentNote['intent'];
  descriptionView?: ComponentDescriptionView;
  details: { label: string; value: string }[];
}

export interface ComponentDescriptionView {
  purpose: string;
  provenance: 'sidecar' | 'projection' | 'indexed' | 'mined';
  status: 'draft' | 'confirmed' | 'unknown';
  updatedAt?: string;
  keywords: string[];
  guidance: string[];
  diverged: boolean;
  diagnostics: string[];
}

export interface DesignSystemBrowserFilter {
  category: DesignSystemBrowserCategory;
  query: string;
}

export function buildDesignSystemBrowserItems(
  browser: ProjectDesignSystemBrowser | null,
): DesignSystemBrowserItem[] {
  if (!browser) return [];
  const items: DesignSystemBrowserItem[] = [
    profileItem(browser),
    setupQuestionsItem(browser.setupQuestions),
    ...browser.components.map((component) => componentItem(component)),
    ...browser.tokens.map((token) => ({
      id: `token:${token.id}`,
      kind: 'token' as const,
      category: 'tokens' as const,
      title: token.name,
      subtitle: token.value,
      meta: `${token.kind} · ${token.source}`,
      status: 'ready' as const,
      searchText: joinSearch([token.name, token.value, token.kind, token.source, token.filePath]),
      sourcePath: token.filePath,
      preview: {
        kind: token.kind === 'color' ? ('color' as const) : ('token' as const),
        label: token.name,
        value: token.value,
      },
      actions: compactActions([
        { id: 'copy-token', label: 'Copy token', value: token.name },
        { id: 'copy-value', label: 'Copy value', value: token.value },
        { id: 'copy-source', label: 'Copy source', value: token.filePath },
      ]),
      details: [
        { label: 'Value', value: token.value },
        { label: 'Kind', value: token.kind },
        { label: 'Source', value: token.filePath },
      ],
    })),
    ...(browser.iconCandidates ?? []).map((icon) => {
      const tags = icon.tags ?? [];
      const validFor = icon.validFor ?? [];
      return {
        id: `icon-candidate:${icon.id}`,
        kind: 'icon' as const,
        category: 'icons' as const,
        title: icon.name,
        subtitle:
          icon.source === 'project-icon-prop'
            ? `<${icon.componentName ?? 'Icon'} ${icon.propName ?? 'iconName'}="${icon.name}" />`
            : (icon.importName ?? icon.filePath ?? icon.source),
        meta: `${icon.source} · ${validFor.join(', ')}`,
        status: icon.confidence === 'fallback' ? ('warning' as const) : ('ready' as const),
        searchText: joinSearch([
          icon.name,
          icon.source,
          icon.componentName,
          icon.propName,
          icon.importName,
          icon.importSource,
          icon.filePath,
          validFor.join(' '),
          ...tags,
        ]),
        sourcePath: icon.filePath,
        preview: { kind: 'icon' as const, label: icon.name, value: icon.source },
        actions: compactActions([
          icon.source === 'project-icon-prop'
            ? {
                id: 'copy-jsx',
                label: 'Copy JSX',
                value: `<${icon.componentName ?? 'Icon'} ${icon.propName ?? 'iconName'}="${icon.name}" />`,
              }
            : null,
          icon.importName
            ? { id: 'copy-import', label: 'Copy import', value: icon.importName }
            : null,
          icon.filePath ? { id: 'copy-source', label: 'Copy source', value: icon.filePath } : null,
        ]),
        details: [
          { label: 'Source', value: icon.source },
          { label: 'Valid for', value: validFor.join(', ') },
          { label: 'Confidence', value: icon.confidence },
          { label: 'File', value: icon.filePath ?? 'none' },
        ],
      };
    }),
    ...(browser.icons?.projectIcons.map((icon) => ({
      id: `icon:${icon.id}`,
      kind: 'icon' as const,
      category: 'icons' as const,
      title: icon.name,
      subtitle: icon.importName,
      meta: 'project icon',
      status: 'ready' as const,
      searchText: joinSearch([icon.name, icon.importName, icon.filePath]),
      sourcePath: icon.filePath,
      preview: { kind: 'icon' as const, label: icon.name },
      actions: compactActions([
        { id: 'copy-import', label: 'Copy import', value: icon.importName },
        { id: 'copy-source', label: 'Copy source', value: icon.filePath },
      ]),
      details: [
        { label: 'Import', value: icon.importName },
        { label: 'Source', value: icon.filePath },
      ],
    })) ?? []),
    ...browser.assets.map((asset) => ({
      id: `asset:${asset.id}`,
      kind: 'asset' as const,
      category: 'assets' as const,
      title: asset.name,
      subtitle: asset.filePath,
      meta: `${asset.kind} · ${asset.usageMode}`,
      status: 'ready' as const,
      searchText: joinSearch([asset.name, asset.filePath, asset.kind, ...asset.tags]),
      sourcePath: asset.filePath,
      preview: { kind: 'asset' as const, label: asset.name, value: asset.kind },
      actions: compactActions([
        { id: 'copy-path', label: 'Copy path', value: asset.filePath },
        asset.importName
          ? { id: 'copy-import', label: 'Copy import', value: asset.importName }
          : null,
      ]),
      details: [
        { label: 'Kind', value: asset.kind },
        { label: 'Usage', value: asset.usageMode },
        { label: 'Source', value: asset.filePath },
      ],
    })),
    ...browser.screens.map((screen) => ({
      id: `screen:${screen.id}`,
      kind: 'screen' as const,
      category: 'screens' as const,
      title: screen.name,
      subtitle: screen.implementationPath,
      meta: `${screen.designReadableStatus} · ${screen.source}`,
      status:
        screen.designReadableStatus === 'needs-review' ? ('warning' as const) : ('ready' as const),
      searchText: joinSearch([
        screen.name,
        screen.implementationPath,
        screen.storyPath,
        screen.routePath,
        screen.source,
      ]),
      sourcePath: screen.implementationPath,
      preview: { kind: 'screen' as const, label: screen.name, value: screen.designReadableStatus },
      actions: compactActions([
        { id: 'copy-source', label: 'Copy source', value: screen.implementationPath },
        screen.storyPath
          ? { id: 'copy-story', label: 'Copy story', value: screen.storyPath }
          : null,
        screen.routePath
          ? { id: 'copy-route', label: 'Copy route', value: screen.routePath }
          : null,
      ]),
      details: [
        { label: 'Implementation', value: screen.implementationPath },
        { label: 'Story', value: screen.storyPath ?? 'none' },
        { label: 'Route', value: screen.routePath ?? 'none' },
      ],
    })),
    ...browser.routes.map((route) => ({
      id: `route:${route.id}`,
      kind: 'route' as const,
      category: 'routes' as const,
      title: route.routePath,
      subtitle: route.filePath,
      meta: route.source,
      status: 'ready' as const,
      searchText: joinSearch([route.routePath, route.filePath, route.source]),
      sourcePath: route.filePath,
      preview: { kind: 'route' as const, label: route.routePath },
      actions: compactActions([
        { id: 'copy-route', label: 'Copy route', value: route.routePath },
        { id: 'copy-source', label: 'Copy source', value: route.filePath },
      ]),
      details: [
        { label: 'Path', value: route.routePath },
        { label: 'Source', value: route.filePath },
      ],
    })),
    ...browser.agentNotes.map((note) => noteItem(note)),
  ];
  return items;
}

export function filterDesignSystemBrowserItems(
  items: DesignSystemBrowserItem[],
  filter: DesignSystemBrowserFilter,
): DesignSystemBrowserItem[] {
  const query = filter.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter.category !== 'all' && item.category !== filter.category) return false;
    if (!query) return true;
    return item.searchText.includes(query);
  });
}

function profileItem(browser: ProjectDesignSystemBrowser): DesignSystemBrowserItem {
  const profile = browser.projectProfile;
  const missingCount = browser.setupQuestions.filter(
    (question) => question.status === 'missing',
  ).length;
  return {
    id: 'health:project-profile',
    kind: 'health',
    category: 'health',
    title: 'Project profile',
    subtitle: profile
      ? `${profile.kind} · ${profile.packageManager} · ${profile.frameworks.join(', ') || 'framework unknown'}`
      : 'Profile artifact is missing',
    meta: missingCount > 0 ? `${missingCount} unresolved setup questions` : 'ready',
    status: profile ? (missingCount > 0 ? 'warning' : 'ready') : 'missing',
    searchText: joinSearch([
      'project profile',
      profile?.kind,
      profile?.componentModel,
      profile?.renderProbe,
      profile?.packageManager,
      ...(profile?.frameworks ?? []),
      ...(profile?.sourceRoots ?? []),
      ...(profile?.styling ?? []),
    ]),
    preview: { kind: 'health', label: profile ? 'Profile' : 'Missing' },
    actions: compactActions([
      profile
        ? { id: 'copy-profile', label: 'Copy profile', value: profileSummary(profile) }
        : null,
    ]),
    details: [
      { label: 'Project kind', value: profile?.kind ?? 'unknown' },
      { label: 'Screen unit', value: profile?.screenUnit.sourceGlob ?? 'unknown' },
      { label: 'Story required', value: profile?.screenUnit.storyRequired ? 'yes' : 'no' },
      { label: 'Component model', value: profile?.componentModel ?? 'unknown' },
      { label: 'Render probe', value: profile?.renderProbe ?? 'unknown' },
      { label: 'Package manager', value: profile?.packageManager ?? 'unknown' },
      { label: 'Frameworks', value: profile?.frameworks.join(', ') || 'unknown' },
      { label: 'Source roots', value: profile?.sourceRoots.join(', ') || 'unknown' },
      { label: 'Styling', value: profile?.styling.join(', ') || 'unknown' },
    ],
  };
}

function setupQuestionsItem(questions: ProjectSetupQuestion[]): DesignSystemBrowserItem {
  const missing = questions.filter((question) => question.status === 'missing');
  return {
    id: 'health:setup-questions',
    kind: 'health',
    category: 'health',
    title: 'Setup questions',
    subtitle:
      missing.length > 0
        ? missing.map((question) => question.label).join(', ')
        : 'No unresolved setup questions',
    meta: missing.length > 0 ? `${missing.length} missing` : 'ready',
    status: missing.length > 0 ? 'warning' : 'ready',
    searchText: joinSearch([
      'setup questions',
      ...questions.map((question) => question.label),
      ...questions.map((question) => question.answer),
    ]),
    preview: { kind: 'health', label: missing.length > 0 ? `${missing.length} missing` : 'Ready' },
    actions: compactActions([
      {
        id: 'copy-questions',
        label: 'Copy questions',
        value: questions
          .map((question) => `${question.label}: ${question.answer ?? question.status}`)
          .join('\n'),
      },
    ]),
    details: questions.map((question) => ({
      label: question.label,
      value: question.answer ?? question.status,
    })),
  };
}

function noteItem(note: ProjectAgentNote): DesignSystemBrowserItem {
  const componentId = note.targetType === 'component' ? note.targetId : undefined;
  return {
    id: `note:${note.id}`,
    kind: 'note',
    category: 'notes',
    title: note.note,
    subtitle: `${note.targetType}${note.targetId ? ` · ${note.targetId}` : ''}`,
    meta: `${note.intent} · ${note.source}`,
    status: 'ready',
    searchText: joinSearch([note.note, note.targetType, note.targetId, note.intent, note.source]),
    ...(componentId ? { componentId } : {}),
    preview: { kind: 'note', label: note.intent },
    actions: compactActions([
      { id: 'copy-note', label: 'Copy note', value: note.note },
      { id: 'copy-context', label: 'Copy context', value: noteContext(note) },
    ]),
    noteId: note.id,
    noteText: note.note,
    noteIntent: note.intent,
    details: [
      { label: 'Intent', value: note.intent },
      { label: 'Target', value: note.targetId ?? note.targetType },
      { label: 'Source', value: note.source },
    ],
  };
}

function componentItem(
  component: ProjectDesignSystemBrowser['components'][number],
): DesignSystemBrowserItem {
  const descriptionView = componentDescriptionView(component);
  const details = [
    { label: 'Source', value: component.filePath },
    { label: 'Stories', value: String(component.storyCount) },
    { label: 'Tags', value: component.tags.join(', ') || 'none' },
    { label: 'Notes', value: String(component.noteCount) },
    ...(descriptionView
      ? [
          { label: 'Description', value: descriptionView.purpose },
          {
            label: 'Description source',
            value: `${descriptionView.provenance}${descriptionView.diverged ? ' · diverged' : ''}`,
          },
          { label: 'Description status', value: descriptionView.status },
          ...(descriptionView.updatedAt
            ? [{ label: 'Description updated', value: descriptionView.updatedAt }]
            : []),
          ...(descriptionView.diagnostics.length > 0
            ? [{ label: 'Description diagnostics', value: descriptionView.diagnostics.join(' | ') }]
            : []),
        ]
      : []),
  ];
  return {
    id: `component:${component.id}`,
    kind: 'component',
    category: 'components',
    title: component.shortName,
    subtitle: component.title,
    meta: `${component.storyCount} stories · ${component.confidence} confidence`,
    status: component.confidence === 'low' || descriptionView?.diverged ? 'warning' : 'ready',
    searchText: joinSearch([
      component.shortName,
      component.title,
      component.filePath,
      descriptionView?.purpose,
      descriptionView?.provenance,
      ...(descriptionView?.keywords ?? []),
      ...(descriptionView?.guidance ?? []),
      ...(descriptionView?.diagnostics ?? []),
      ...component.tags,
      ...component.groupIds,
    ]),
    noteCount: component.noteCount,
    componentId: component.id,
    sourcePath: component.filePath,
    preview: { kind: 'component', label: component.shortName },
    actions: compactActions([
      { id: 'copy-source', label: 'Copy source', value: component.filePath },
      component.stories[0]
        ? { id: 'copy-story', label: 'Copy story', value: component.stories[0].id }
        : null,
      descriptionView
        ? { id: 'copy-description', label: 'Copy description', value: descriptionView.purpose }
        : null,
      { id: 'copy-context', label: 'Copy context', value: componentContext(component) },
    ]),
    details,
    ...(descriptionView ? { descriptionView } : {}),
  };
}

function componentDescriptionView(
  component: ProjectDesignSystemBrowser['components'][number],
): ComponentDescriptionView | undefined {
  const layer = component.descriptionLayer;
  if (!layer) return undefined;
  const purpose = layer.purpose.trim();
  if (!purpose) return undefined;
  const diagnostics = component.descriptionSource?.diagnostics ?? [];
  const diverged = diagnostics.some((diagnostic) =>
    /sources diverge|description-diverged/iu.test(diagnostic),
  );
  return {
    purpose,
    provenance: component.descriptionSource?.provenance ?? (layer.status ? 'indexed' : 'mined'),
    status: layer.status ?? 'unknown',
    ...(layer.updatedAt ? { updatedAt: layer.updatedAt } : {}),
    keywords: layer.keywords ?? [],
    guidance: layer.agentGuidance ?? [],
    diverged,
    diagnostics,
  };
}

function compactActions(
  actions: Array<{ id: string; label: string; value: string } | null>,
): { id: string; label: string; value: string }[] {
  return actions.filter((action): action is { id: string; label: string; value: string } =>
    Boolean(action?.value),
  );
}

function componentContext(component: ProjectDesignSystemBrowser['components'][number]): string {
  const description = componentDescriptionView(component);
  return [
    `Component: ${component.shortName}`,
    `Title: ${component.title}`,
    `Source: ${component.filePath}`,
    `Stories: ${component.stories.map((story) => story.id).join(', ') || 'none'}`,
    ...(description
      ? [
          `Description: ${description.purpose}`,
          `Description source: ${description.provenance}${description.diverged ? ' (diverged)' : ''}`,
        ]
      : []),
  ].join('\n');
}

function noteContext(note: ProjectAgentNote): string {
  return [
    `Agent note: ${note.note}`,
    `Target: ${note.targetType}${note.targetId ? ` ${note.targetId}` : ''}`,
    `Intent: ${note.intent}`,
  ].join('\n');
}

function profileSummary(
  profile: NonNullable<ProjectDesignSystemBrowser['projectProfile']>,
): string {
  return [
    `Project kind: ${profile.kind}`,
    `Screen unit: ${profile.screenUnit.sourceGlob}`,
    `Story required: ${profile.screenUnit.storyRequired ? 'yes' : 'no'}`,
    `Component model: ${profile.componentModel}`,
    `Render probe: ${profile.renderProbe}`,
    `Package manager: ${profile.packageManager}`,
    `Frameworks: ${profile.frameworks.join(', ') || 'unknown'}`,
    `Source roots: ${profile.sourceRoots.join(', ') || 'unknown'}`,
    `Styling: ${profile.styling.join(', ') || 'unknown'}`,
  ].join('\n');
}

function joinSearch(values: Array<string | number | null | undefined>): string {
  return values
    .filter((value): value is string | number => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase();
}
