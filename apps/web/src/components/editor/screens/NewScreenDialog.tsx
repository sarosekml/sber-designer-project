/** Add-a-screen dialog: blank and from-Storybook flows. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus2, Layers } from 'lucide-react';
import {
  MODAL_FALLBACK_DEFAULTS,
  normalizeModalDefaults,
  parseModalDimension,
  type DesignBriefDensity,
  type ModalDefaults,
  type ModalLongContent,
  type ProjectScreen,
  type ProjectScreenSurface,
  type ScreenTemplate,
} from '@sber-designer/shared-types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ensureStorybookStoryReady } from '@/lib/storybook-readiness';
import {
  filterTemplatesForSurface,
  isTemplateCompatibleWithSurface,
  NO_SCREEN_TEMPLATE_ID,
  normalizeAssistantInstruction,
  resolveTemplateModalLongContent,
  selectScreenTemplateByKey,
  shouldAskAssistantForNewScreen,
} from '@/lib/new-screen-flow';
import {
  fetchScreenTemplates,
  fetchProjectDesignSystemBrowser,
  pushEditorState,
  saveProjectToApi,
  writeFile,
  type ProjectProfileFile,
} from '@/lib/api-client';
import {
  buildGeneratedScreenMetadata,
  buildGeneratedScreenStoryWrapper,
  buildStorybookTemplateCopy,
  buildStorybookTemplateImplementation,
  buildUniqueGeneratedScreenName,
  listScreenCreationFolders,
  relativeImportPath,
  resolveScreenCreationFolder,
  UNGROUPED_SCREEN_FOLDER,
} from '@/lib/screen-folders';
import {
  buildBlankModalHtml,
  buildBlankModalReactImplementation,
  buildModalStoryWrapper,
} from '@/lib/modal-scaffold';
import { useChat } from '@/hooks/useChat';
import { useSandboxSession } from '@/hooks/useSandboxSession';
import { useCatalogStore } from '@/stores/catalog-store';
import { useChatStore } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import {
  type CatalogStory,
  catalogStories,
  withProjectScreenCreationFolder,
} from '@/lib/screen-panel-actions';
import { NewScreenBlankFields } from './NewScreenBlankFields';
import { NewScreenCatalogFields, NewScreenDialogFooter } from './NewScreenDialogSections';
import {
  blankHtmlPageTemplate,
  blankImplementationTemplate,
  buildBlankHtmlScreenPrompt,
  buildBlankScreenPrompt,
  buildHtmlPageScreenMetadata,
  buildNewScreenDesignBrief,
} from './new-screen-dialog-helpers';
import {
  buildNewScreenDialogOpeningState,
  resolveNewScreenGenerationDispatch,
  resolveNewScreenGenerationRunDefaults,
  type NewScreenDialogEntry,
} from './new-screen-dialog-state';

export {
  buildBlankScreenPrompt,
  buildNewScreenDesignBrief,
  generationOptionsForNewScreen,
} from './new-screen-dialog-helpers';
export {
  buildNewScreenDialogOpeningState,
  resolveNewScreenGenerationDispatch,
  resolveNewScreenGenerationRunDefaults,
  type NewScreenDialogEntry,
} from './new-screen-dialog-state';

export function NewScreenDialog({
  open,
  onOpenChange,
  initialEntry = 'blank',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEntry?: NewScreenDialogEntry;
}) {
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const setBaseline = useProjectStore((s) => s.setBaseline);
  const setActiveScreenId = useEditorStore((s) => s.setActiveScreenId);
  const setCanvasView = useEditorStore((s) => s.setCanvasView);
  const setAssistantTaskIntent = useEditorStore((s) => s.setAssistantTaskIntent);
  const setPendingGenerationRequest = useEditorStore((s) => s.setPendingGenerationRequest);
  const setStorybookReloadPending = useEditorStore((s) => s.setStorybookReloadPending);
  const catalog = useCatalogStore((s) => s.catalog);
  const pending = useChatStore((s) => s.pending);
  const session = useSandboxStore((s) => s.session);
  const { createSession } = useSandboxSession();
  const { send, presentDirectionPicker } = useChat();
  const [tab, setTab] = useState<'blank' | 'catalog'>('blank');
  const [name, setName] = useState('New screen');
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ScreenTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(NO_SCREEN_TEMPLATE_ID);
  const [selectedSurface, setSelectedSurface] = useState<ProjectScreenSurface>('page');
  const [modalWidth, setModalWidth] = useState('');
  const [modalHeight, setModalHeight] = useState('');
  const [modalLongContent, setModalLongContent] = useState<ModalLongContent>('scroll');
  const modalLongContentTouchedRef = useRef(false);
  const [startWithWireframe, setStartWithWireframe] = useState(false);
  const [runDesignJury, setRunDesignJury] = useState(false);
  const [useDirectionPicker, setUseDirectionPicker] = useState(false);
  const generationRunOptionsRef = useRef({
    directionPicker: false,
    wireframe: false,
    designJury: false,
  });
  const [designPalette, setDesignPalette] = useState('');
  const [designTypography, setDesignTypography] = useState('');
  const [designLayout, setDesignLayout] = useState('');
  const [designMood, setDesignMood] = useState('');
  const [designDensity, setDesignDensity] = useState<DesignBriefDensity | ''>('');
  const [designConstraints, setDesignConstraints] = useState('');
  const [selectedStory, setSelectedStory] = useState<CatalogStory | null>(null);
  const [selectedFolderValue, setSelectedFolderValue] = useState(UNGROUPED_SCREEN_FOLDER);
  const [projectProfile, setProjectProfile] = useState<ProjectProfileFile | null>(null);

  const stories = catalogStories(catalog);
  const creationFolders = useMemo(
    () => listScreenCreationFolders(project?.screens ?? []),
    [project?.screens],
  );
  const resolvedFolder = useMemo(
    () =>
      resolveScreenCreationFolder({
        selectedValue: selectedFolderValue,
        existingFolders: creationFolders,
        fallbackFolder: project?.screenCreation?.lastFolder,
      }),
    [creationFolders, project?.screenCreation?.lastFolder, selectedFolderValue],
  );
  const visibleTemplates = templates.filter((template) => template.status !== 'deprecated');
  // Filter templates to the chosen surface (0132): page templates never appear
  // for a modal and vice-versa; "Without template" stays available to both.
  const surfaceTemplates = filterTemplatesForSurface(visibleTemplates, selectedSurface);
  const builtInTemplates = surfaceTemplates.filter((template) => template.source === 'built-in');
  const projectTemplates = surfaceTemplates.filter((template) => template.source === 'project');
  const selectedTemplatePreview = selectScreenTemplateByKey(templates, selectedTemplateKey);
  const isModalSurface = selectedSurface === 'modal';
  // Base defaults for placeholders + submit: the selected modal template's
  // contract, else the product fallback (640px × auto, scroll).
  const modalDefaultsBase: ModalDefaults =
    (isModalSurface ? selectedTemplatePreview?.modalDefaults : undefined) ??
    MODAL_FALLBACK_DEFAULTS;
  const modalWidthError =
    isModalSurface &&
    modalWidth.trim() !== '' &&
    !parseModalDimension(modalWidth, { allowAuto: false }).ok;
  const modalHeightError =
    isModalSurface &&
    modalHeight.trim() !== '' &&
    !parseModalDimension(modalHeight, { allowAuto: true }).ok;
  const modalFieldsInvalid = modalWidthError || modalHeightError;
  const designBrief = useMemo(
    () =>
      buildNewScreenDesignBrief({
        palette: designPalette,
        typography: designTypography,
        layout: designLayout,
        mood: designMood,
        density: designDensity,
        constraints: designConstraints,
      }),
    [designConstraints, designDensity, designLayout, designMood, designPalette, designTypography],
  );

  const handleSurfaceChange = (surface: ProjectScreenSurface) => {
    if (surface === selectedSurface) return;
    setSelectedSurface(surface);
    // Drop a now-incompatible template selection (Р-9); "Without template" fits both.
    const current = selectScreenTemplateByKey(templates, selectedTemplateKey);
    if (current && !isTemplateCompatibleWithSurface(current, surface)) {
      setSelectedTemplateKey(NO_SCREEN_TEMPLATE_ID);
    }
    if (!modalLongContentTouchedRef.current) {
      setModalLongContent(
        resolveTemplateModalLongContent({
          current: modalLongContent,
          touched: false,
          template: surface === 'modal' ? current : null,
        }),
      );
    }
  };

  const handleTemplateChange = (key: string) => {
    setSelectedTemplateKey(key);
    if (modalLongContentTouchedRef.current) return;
    const template = selectScreenTemplateByKey(templates, key);
    setModalLongContent(
      resolveTemplateModalLongContent({
        current: modalLongContent,
        touched: false,
        template,
      }),
    );
  };

  const resolveModalDefaults = (): ModalDefaults =>
    normalizeModalDefaults(
      { width: modalWidth, height: modalHeight, longContent: modalLongContent },
      modalDefaultsBase,
    ).value;

  const requestScreenGeneration = async (
    prompt: string,
    dispatch: ReturnType<typeof resolveNewScreenGenerationDispatch>,
  ) => {
    if (dispatch.kind === 'send') {
      const generation = dispatch.requestOptions.generation ?? null;
      setPendingGenerationRequest(generation);
      try {
        await send(prompt, [], dispatch.requestOptions);
      } finally {
        if (useEditorStore.getState().pendingGenerationRequest === generation) {
          setPendingGenerationRequest(null);
        }
      }
      return;
    }
    await presentDirectionPicker(prompt, dispatch.payload);
  };

  const ensureCreatedStoryReady = async (storyId: string) => {
    setStorybookReloadPending(true);
    void pushEditorState({ storybookReloadPending: true });
    try {
      return await ensureStorybookStoryReady({
        storyId,
        previewUrl: session?.previewUrl ?? null,
        workspacePath: session?.workspacePath ?? null,
        setCatalog: useCatalogStore.getState().setCatalog,
        createSession,
      });
    } finally {
      setStorybookReloadPending(false);
      void pushEditorState({ storybookReloadPending: false });
    }
  };

  useEffect(() => {
    if (!open) return;
    setSelectedStory(null);
    const openingState = buildNewScreenDialogOpeningState({
      entry: initialEntry,
      screenName: buildUniqueGeneratedScreenName(
        initialEntry === 'prototype'
          ? 'Prototype'
          : initialEntry === 'greybox'
            ? 'Greybox'
            : 'New screen',
        useProjectStore.getState().project?.screens ?? [],
      ),
    });
    setTab(openingState.tab);
    setName(openingState.name);
    setBrief(openingState.brief);
    const nextProject = useProjectStore.getState().project;
    const generationDefaults = resolveNewScreenGenerationRunDefaults(
      initialEntry,
      useEditorStore.getState().generationDefaults,
    );
    const nextGenerationRunOptions = {
      directionPicker: generationDefaults.directionPicker,
      wireframe: generationDefaults.wireframe || openingState.startWithWireframe,
      designJury: generationDefaults.designJury,
    };
    generationRunOptionsRef.current = nextGenerationRunOptions;
    setStartWithWireframe(nextGenerationRunOptions.wireframe);
    setRunDesignJury(nextGenerationRunOptions.designJury);
    setUseDirectionPicker(nextGenerationRunOptions.directionPicker);
    setDesignPalette('');
    setDesignTypography('');
    setDesignLayout('');
    setDesignMood('');
    setDesignDensity('');
    setDesignConstraints('');
    const nextCreationFolders = listScreenCreationFolders(nextProject?.screens ?? []);
    setSelectedFolderValue(
      resolveScreenCreationFolder({
        selectedValue: nextProject?.screenCreation?.lastFolder ?? UNGROUPED_SCREEN_FOLDER,
        existingFolders: nextCreationFolders,
      }),
    );
    setSelectedSurface('page');
    setModalWidth('');
    setModalHeight('');
    setModalLongContent('scroll');
    modalLongContentTouchedRef.current = false;
    const ac = new AbortController();
    setTemplatesLoading(true);
    setSelectedTemplateKey(NO_SCREEN_TEMPLATE_ID);
    setProjectProfile(null);
    void fetchScreenTemplates(session?.workspacePath ?? undefined, ac.signal)
      .then((next) => {
        setTemplates(next);
      })
      .catch(() => {
        setTemplates([]);
        setSelectedTemplateKey(NO_SCREEN_TEMPLATE_ID);
      })
      .finally(() => setTemplatesLoading(false));
    if (nextProject?.workspacePath) {
      void fetchProjectDesignSystemBrowser({ workspacePath: nextProject.workspacePath }, ac.signal)
        .then((browser) => setProjectProfile(browser.projectProfile))
        .catch(() => setProjectProfile(null));
    }
    return () => ac.abort();
  }, [initialEntry, open, session?.workspacePath]);

  const handlePinSelectedStory = async () => {
    if (!project || !selectedStory) return;
    const id = `screen-${Date.now()}-${selectedStory.story.id}`;
    const screen: ProjectScreen = {
      id,
      name: name.trim() || `${selectedStory.component.shortName} · ${selectedStory.story.name}`,
      kind: 'story',
      storyId: selectedStory.story.id,
      folder: resolvedFolder,
    };
    const nextProject = withProjectScreenCreationFolder(
      { ...project, screens: [...project.screens, screen] },
      resolvedFolder,
    );
    setBusy(true);
    setError(null);
    try {
      const saved = await saveProjectToApi(nextProject);
      setProject(saved);
      setBaseline(saved);
      setActiveScreenId(id);
      setCanvasView('screen');
      setAssistantTaskIntent(null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateFromStory = async () => {
    if (!project || !selectedStory) return;
    const screenName = buildUniqueGeneratedScreenName(name, project.screens);
    const metadata = buildGeneratedScreenMetadata({ name: screenName, folder: resolvedFolder });
    const screen: ProjectScreen = {
      id: `screen-${Date.now()}-${metadata.screenSlug}`,
      name: metadata.cleanName,
      kind: 'story',
      storyId: metadata.storyId,
      filePath: metadata.filePath,
      implementationFilePath: metadata.implementationFilePath,
      folder: metadata.folder,
      description: `Created from Storybook template: ${selectedStory.story.id}`,
    };
    const nextProject = withProjectScreenCreationFolder(
      { ...project, screens: [...project.screens, screen] },
      metadata.folder,
    );
    setBusy(true);
    setError(null);
    try {
      await writeFile(
        metadata.implementationFilePath,
        buildStorybookTemplateImplementation({
          componentName: metadata.componentName,
          sourceStoryId: selectedStory.story.id,
          sourceFilePath: selectedStory.component.filePath,
          targetFilePath: metadata.implementationFilePath,
        }),
      );
      await writeFile(
        metadata.filePath,
        buildStorybookTemplateCopy({
          screenName: metadata.cleanName,
          componentName: metadata.componentName,
          storyTitle: metadata.storyTitle,
          sourceStoryId: selectedStory.story.id,
          sourceFilePath: selectedStory.component.filePath,
          targetFilePath: metadata.filePath,
        }),
      );
      const saved = await saveProjectToApi(nextProject);
      setProject(saved);
      setBaseline(saved);
      setActiveScreenId(screen.id);
      setCanvasView('screen');
      const indexStatus = await ensureCreatedStoryReady(metadata.storyId);
      if (indexStatus === 'timeout') {
        setError(
          'Screen was created, but Storybook is not connected yet. Restart the project preview to index the new story.',
        );
        return;
      }
      setAssistantTaskIntent({
        kind: 'create-screen-from-story',
        targetScreenId: screen.id,
        sourceStoryId: selectedStory.story.id,
        sourceStoryFilePath: selectedStory.component.filePath,
        targetName: metadata.cleanName,
        targetFolder: metadata.folder,
        targetStoryFilePath: metadata.filePath,
        targetImplementationFilePath: metadata.implementationFilePath,
        targetStoryId: metadata.storyId,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleBlank = async () => {
    if (!project || busy) return;
    if (project.projectKind === 'html-first' || projectProfile?.kind === 'html-css') {
      await handleBlankHtml();
      return;
    }
    const screenName = buildUniqueGeneratedScreenName(name, project.screens);
    const metadata = buildGeneratedScreenMetadata({ name: screenName, folder: resolvedFolder });
    const assistantInstruction = normalizeAssistantInstruction(brief);
    const selectedTemplate = selectScreenTemplateByKey(templates, selectedTemplateKey);
    const isModal = selectedSurface === 'modal';
    const modalDefaults = resolveModalDefaults();
    const generationRunOptions = generationRunOptionsRef.current;
    const generationDispatch = resolveNewScreenGenerationDispatch({
      directionPicker: generationRunOptions.directionPicker,
      wireframe: generationRunOptions.wireframe,
      critique: generationRunOptions.designJury,
      designBrief,
      surface: selectedSurface,
      ...(isModal ? { modal: modalDefaults } : {}),
    });
    const screen: ProjectScreen = {
      id: `screen-${Date.now()}-${metadata.screenSlug}`,
      name: metadata.cleanName,
      kind: 'story',
      ...(isModal ? { surface: 'modal' as const } : {}),
      storyId: metadata.storyId,
      filePath: metadata.filePath,
      implementationFilePath: metadata.implementationFilePath,
      folder: metadata.folder,
      description:
        assistantInstruction ||
        (selectedTemplate ? `Template: ${selectedTemplate.name}` : 'Empty generated screen'),
      ...(selectedTemplate
        ? { template: { id: selectedTemplate.id, source: selectedTemplate.source } }
        : {}),
    };
    const nextProject = withProjectScreenCreationFolder(
      { ...project, screens: [...project.screens, screen] },
      metadata.folder,
    );
    setBusy(true);
    setError(null);
    try {
      await writeFile(
        metadata.implementationFilePath,
        isModal
          ? buildBlankModalReactImplementation({
              name: metadata.cleanName,
              componentName: metadata.componentName,
              defaults: modalDefaults,
            })
          : blankImplementationTemplate(metadata.cleanName, metadata.componentName),
      );
      await writeFile(
        metadata.filePath,
        isModal
          ? buildModalStoryWrapper({
              screenName: metadata.cleanName,
              storyTitle: metadata.storyTitle,
              componentName: metadata.componentName,
              componentImportPath: relativeImportPath(
                metadata.filePath,
                metadata.implementationFilePath,
              ),
            })
          : buildGeneratedScreenStoryWrapper({
              screenName: metadata.cleanName,
              storyTitle: metadata.storyTitle,
              componentName: metadata.componentName,
              componentImportPath: relativeImportPath(
                metadata.filePath,
                metadata.implementationFilePath,
              ),
            }),
      );
      const saved = await saveProjectToApi(nextProject);
      setProject(saved);
      setBaseline(saved);
      setActiveScreenId(screen.id);
      setCanvasView('screen');
      const indexStatus = await ensureCreatedStoryReady(metadata.storyId);
      if (indexStatus === 'timeout') {
        setError(
          'Screen was created, but Storybook is not connected yet. Restart the project preview to index the new story.',
        );
        return;
      }
      if (assistantInstruction || startWithWireframe || designBrief) {
        setAssistantTaskIntent({
          kind: 'fill-generated-screen',
          targetScreenId: screen.id,
          targetName: metadata.cleanName,
          targetFolder: metadata.folder,
          targetStoryFilePath: metadata.filePath,
          targetImplementationFilePath: metadata.implementationFilePath,
          targetStoryId: metadata.storyId,
        });
      } else {
        setAssistantTaskIntent(null);
      }
      onOpenChange(false);
      if (
        startWithWireframe ||
        designBrief ||
        shouldAskAssistantForNewScreen({ instruction: assistantInstruction, chatPending: pending })
      ) {
        const prompt = buildBlankScreenPrompt({
          name: metadata.cleanName,
          storyFilePath: metadata.filePath,
          implementationFilePath: metadata.implementationFilePath,
          folder: metadata.folder,
          storyId: metadata.storyId,
          storyTitle: metadata.storyTitle,
          instruction: assistantInstruction,
          components: catalog?.components ?? [],
          template: selectedTemplate,
          designBrief,
          surface: selectedSurface,
          ...(isModal ? { modalDefaults } : {}),
        });
        await requestScreenGeneration(prompt, generationDispatch);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleBlankHtml = async () => {
    if (!project || busy) return;
    const screenName = buildUniqueGeneratedScreenName(name, project.screens);
    const metadata = buildHtmlPageScreenMetadata({
      name: screenName,
      folder: resolvedFolder,
      profile: projectProfile,
    });
    const assistantInstruction = normalizeAssistantInstruction(brief);
    const selectedTemplate = selectScreenTemplateByKey(templates, selectedTemplateKey);
    const isModal = selectedSurface === 'modal';
    const modalDefaults = resolveModalDefaults();
    const generationRunOptions = generationRunOptionsRef.current;
    const generationDispatch = resolveNewScreenGenerationDispatch({
      directionPicker: generationRunOptions.directionPicker,
      wireframe: generationRunOptions.wireframe,
      critique: generationRunOptions.designJury,
      designBrief,
      surface: selectedSurface,
      ...(isModal ? { modal: modalDefaults } : {}),
    });
    const screen: ProjectScreen = {
      id: `screen-${Date.now()}-${metadata.screenSlug}`,
      name: metadata.cleanName,
      kind: 'page',
      ...(isModal ? { surface: 'modal' as const } : {}),
      filePath: metadata.filePath,
      implementationFilePath: metadata.filePath,
      folder: metadata.folder,
      description:
        assistantInstruction || (isModal ? 'Empty modal screen' : 'Empty HTML page screen'),
      ...(selectedTemplate
        ? { template: { id: selectedTemplate.id, source: selectedTemplate.source } }
        : {}),
    };
    const nextProject = withProjectScreenCreationFolder(
      { ...project, screens: [...project.screens, screen] },
      metadata.folder,
    );
    setBusy(true);
    setError(null);
    try {
      await writeFile(
        metadata.filePath,
        isModal
          ? buildBlankModalHtml({ name: metadata.cleanName, defaults: modalDefaults })
          : blankHtmlPageTemplate(metadata.cleanName),
      );
      const saved = await saveProjectToApi(nextProject);
      setProject(saved);
      setBaseline(saved);
      setActiveScreenId(screen.id);
      setCanvasView('screen');
      setAssistantTaskIntent(null);
      await createSession(project.workspacePath);
      onOpenChange(false);
      if (
        startWithWireframe ||
        designBrief ||
        shouldAskAssistantForNewScreen({ instruction: assistantInstruction, chatPending: pending })
      ) {
        await requestScreenGeneration(
          buildBlankHtmlScreenPrompt({
            name: metadata.cleanName,
            filePath: metadata.filePath,
            folder: metadata.folder,
            instruction: assistantInstruction,
            designBrief,
            surface: selectedSurface,
            ...(isModal ? { modalDefaults } : {}),
          }),
          generationDispatch,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] w-[min(760px,calc(100vw-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <DialogHeader
          data-slot="new-screen-dialog-header"
          className="min-w-0 shrink-0 border-b border-border px-6 py-5 pr-12"
        >
          <DialogTitle>Add a screen or modal</DialogTitle>
          <DialogDescription>
            Create an empty screen or modal, ask Assistant to build one, or start from a Storybook
            story.
          </DialogDescription>
        </DialogHeader>

        <div data-slot="new-screen-dialog-body" className="min-h-0 overflow-y-auto px-6 py-4">
          <div className="inline-flex w-fit rounded-md border border-border p-0.5 text-xs">
            {[
              { id: 'blank' as const, label: 'Blank screen', icon: FilePlus2 },
              { id: 'catalog' as const, label: 'From Storybook', icon: Layers },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 transition-colors',
                  tab === id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3" />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === 'blank' ? (
              <NewScreenBlankFields
                name={name}
                onNameChange={setName}
                selectedFolderValue={selectedFolderValue}
                creationFolders={creationFolders}
                onFolderChange={setSelectedFolderValue}
                brief={brief}
                onBriefChange={setBrief}
                designPalette={designPalette}
                onDesignPaletteChange={setDesignPalette}
                designTypography={designTypography}
                onDesignTypographyChange={setDesignTypography}
                designLayout={designLayout}
                onDesignLayoutChange={setDesignLayout}
                designMood={designMood}
                onDesignMoodChange={setDesignMood}
                designDensity={designDensity}
                onDesignDensityChange={setDesignDensity}
                designConstraints={designConstraints}
                onDesignConstraintsChange={setDesignConstraints}
                selectedSurface={selectedSurface}
                onSurfaceChange={handleSurfaceChange}
                selectedTemplateKey={selectedTemplateKey}
                onTemplateChange={handleTemplateChange}
                templates={templates}
                builtInTemplates={builtInTemplates}
                projectTemplates={projectTemplates}
                selectedTemplatePreview={selectedTemplatePreview}
                modalDefaults={modalDefaultsBase}
                modalWidth={modalWidth}
                modalHeight={modalHeight}
                modalLongContent={modalLongContent}
                modalWidthInvalid={modalWidthError}
                modalHeightInvalid={modalHeightError}
                onModalWidthChange={setModalWidth}
                onModalHeightChange={setModalHeight}
                onModalLongContentChange={(value) => {
                  modalLongContentTouchedRef.current = true;
                  setModalLongContent(value);
                }}
                directionPicker={useDirectionPicker}
                wireframe={startWithWireframe}
                designJury={runDesignJury}
                onDirectionPickerChange={(checked) => {
                  generationRunOptionsRef.current.directionPicker = checked;
                  setUseDirectionPicker(checked);
                }}
                onWireframeChange={(checked) => {
                  generationRunOptionsRef.current.wireframe = checked;
                  setStartWithWireframe(checked);
                }}
                onDesignJuryChange={(checked) => {
                  generationRunOptionsRef.current.designJury = checked;
                  setRunDesignJury(checked);
                }}
                templatesLoading={templatesLoading}
                busy={busy}
                error={error}
              />
            ) : (
              <NewScreenCatalogFields
                stories={stories}
                selectedStory={selectedStory}
                error={error}
                name={name}
                selectedFolderValue={selectedFolderValue}
                creationFolders={creationFolders}
                resolvedFolder={resolvedFolder}
                busy={busy}
                onNameChange={setName}
                onFolderChange={setSelectedFolderValue}
                onStorySelect={(story) => {
                  setSelectedStory(story);
                  setName(`${story.component.shortName} · ${story.story.name}`);
                }}
              />
            )}
          </div>
        </div>

        <NewScreenDialogFooter
          tab={tab}
          busy={busy}
          projectAvailable={Boolean(project)}
          modalFieldsInvalid={modalFieldsInvalid}
          shouldAskAssistant={Boolean(brief.trim() || startWithWireframe || designBrief)}
          isModalSurface={isModalSurface}
          selectedStory={selectedStory}
          name={name}
          onClose={() => onOpenChange(false)}
          onCreateBlank={() => void handleBlank()}
          onBack={() => setSelectedStory(null)}
          onPinStory={() => void handlePinSelectedStory()}
          onCreateFromStory={() => void handleCreateFromStory()}
        />
      </DialogContent>
    </Dialog>
  );
}
