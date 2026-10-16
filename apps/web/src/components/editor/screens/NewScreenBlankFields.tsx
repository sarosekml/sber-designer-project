import { CircleHelp, FilePlus2, SquareStack } from 'lucide-react';
import type {
  DesignBriefDensity,
  ModalDefaults,
  ModalLongContent,
  ProjectScreenSurface,
  ScreenTemplate,
} from '@sber-designer/shared-types';

import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  NO_SCREEN_TEMPLATE_ID,
  screenTemplateKey,
  screenTemplateOptionLabel,
} from '@/lib/new-screen-flow';
import { NEW_SCREEN_FOLDER_OPTION } from '@/lib/screen-folders';
import { cn } from '@/lib/utils';
import { Field } from './dialog-shared';
import { GenerationRunOptions } from './GenerationRunOptions';
import { ModalCreationFields } from './ModalCreationFields';

export function NewScreenBlankFields({
  name,
  onNameChange,
  selectedFolderValue,
  creationFolders,
  onFolderChange,
  brief,
  onBriefChange,
  designPalette,
  onDesignPaletteChange,
  designTypography,
  onDesignTypographyChange,
  designLayout,
  onDesignLayoutChange,
  designMood,
  onDesignMoodChange,
  designDensity,
  onDesignDensityChange,
  designConstraints,
  onDesignConstraintsChange,
  selectedSurface,
  onSurfaceChange,
  selectedTemplateKey,
  onTemplateChange,
  templates,
  builtInTemplates,
  projectTemplates,
  selectedTemplatePreview,
  modalDefaults,
  modalWidth,
  modalHeight,
  modalLongContent,
  modalWidthInvalid,
  modalHeightInvalid,
  onModalWidthChange,
  onModalHeightChange,
  onModalLongContentChange,
  directionPicker,
  wireframe,
  designJury,
  onDirectionPickerChange,
  onWireframeChange,
  onDesignJuryChange,
  templatesLoading,
  busy,
  error,
}: {
  name: string;
  onNameChange: (value: string) => void;
  selectedFolderValue: string;
  creationFolders: readonly string[];
  onFolderChange: (value: string) => void;
  brief: string;
  onBriefChange: (value: string) => void;
  designPalette: string;
  onDesignPaletteChange: (value: string) => void;
  designTypography: string;
  onDesignTypographyChange: (value: string) => void;
  designLayout: string;
  onDesignLayoutChange: (value: string) => void;
  designMood: string;
  onDesignMoodChange: (value: string) => void;
  designDensity: DesignBriefDensity | '';
  onDesignDensityChange: (value: DesignBriefDensity | '') => void;
  designConstraints: string;
  onDesignConstraintsChange: (value: string) => void;
  selectedSurface: ProjectScreenSurface;
  onSurfaceChange: (surface: ProjectScreenSurface) => void;
  selectedTemplateKey: string;
  onTemplateChange: (key: string) => void;
  templates: ScreenTemplate[];
  builtInTemplates: ScreenTemplate[];
  projectTemplates: ScreenTemplate[];
  selectedTemplatePreview: ScreenTemplate | null;
  modalDefaults: ModalDefaults;
  modalWidth: string;
  modalHeight: string;
  modalLongContent: ModalLongContent;
  modalWidthInvalid: boolean;
  modalHeightInvalid: boolean;
  onModalWidthChange: (value: string) => void;
  onModalHeightChange: (value: string) => void;
  onModalLongContentChange: (value: ModalLongContent) => void;
  directionPicker: boolean;
  wireframe: boolean;
  designJury: boolean;
  onDirectionPickerChange: (checked: boolean) => void;
  onWireframeChange: (checked: boolean) => void;
  onDesignJuryChange: (checked: boolean) => void;
  templatesLoading: boolean;
  busy: boolean;
  error: string | null;
}) {
  const isModalSurface = selectedSurface === 'modal';
  return (
    <div className="grid min-w-0 gap-3">
      <Field label="Screen name">
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Checkout review"
        />
      </Field>
      <FolderSelect
        value={selectedFolderValue}
        folders={creationFolders}
        disabled={busy}
        onChange={onFolderChange}
      />
      <Field label="Assistant instruction (optional)">
        <Textarea
          value={brief}
          onChange={(event) => onBriefChange(event.target.value)}
          placeholder="Describe what Assistant should build, or leave empty to create an empty canvas."
          rows={4}
          className="max-h-[calc(10lh+1rem+2px)] resize-none overflow-y-auto"
        />
      </Field>
      <details className="rounded-md border border-border bg-card px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-foreground">
          Design brief (optional)
        </summary>
        <p className="mt-1 text-xs text-muted-foreground">
          Set only the choices that matter. Assistant will resolve the rest from the project.
        </p>
        <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
          <Field label="Palette">
            <Input
              value={designPalette}
              onChange={(event) => onDesignPaletteChange(event.target.value)}
              placeholder="Muted neutrals with one blue accent"
              maxLength={400}
              disabled={busy}
            />
          </Field>
          <Field label="Typography">
            <Input
              value={designTypography}
              onChange={(event) => onDesignTypographyChange(event.target.value)}
              placeholder="Use the project type scale"
              maxLength={400}
              disabled={busy}
            />
          </Field>
          <Field label="Layout">
            <Input
              value={designLayout}
              onChange={(event) => onDesignLayoutChange(event.target.value)}
              placeholder="Two-column review layout"
              maxLength={400}
              disabled={busy}
            />
          </Field>
          <Field label="Mood">
            <Input
              value={designMood}
              onChange={(event) => onDesignMoodChange(event.target.value)}
              placeholder="Calm and operational"
              maxLength={400}
              disabled={busy}
            />
          </Field>
          <Field label="Density">
            <div className="[&_[data-slot=native-select-wrapper]]:w-full">
              <NativeSelect
                value={designDensity}
                onChange={(event) =>
                  onDesignDensityChange(event.target.value as DesignBriefDensity | '')
                }
                className="h-10 w-full"
                disabled={busy}
              >
                <NativeSelectOption value="">Use project default</NativeSelectOption>
                <NativeSelectOption value="compact">Compact</NativeSelectOption>
                <NativeSelectOption value="balanced">Balanced</NativeSelectOption>
                <NativeSelectOption value="spacious">Spacious</NativeSelectOption>
              </NativeSelect>
            </div>
          </Field>
          <Field label="Constraints (one per line)">
            <Textarea
              value={designConstraints}
              onChange={(event) => onDesignConstraintsChange(event.target.value)}
              placeholder={'Keep the current navigation\nShow loading and empty states'}
              rows={3}
              maxLength={2400}
              className="resize-none"
              disabled={busy}
            />
          </Field>
        </div>
      </details>
      <Field label="Type">
        <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 text-xs">
          {(['page', 'modal'] as const).map((surface) => (
            <button
              key={surface}
              type="button"
              onClick={() => onSurfaceChange(surface)}
              disabled={busy}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1 transition-colors',
                selectedSurface === surface
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {surface === 'page' ? (
                <FilePlus2 className="size-3" />
              ) : (
                <SquareStack className="size-3" />
              )}
              {surface === 'page' ? 'Screen' : 'Modal'}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Template" labelHint={<ScreenTemplateHelp />}>
        <div className="[&_[data-slot=native-select-wrapper]]:w-full">
          <NativeSelect
            value={selectedTemplateKey}
            onChange={(event) => onTemplateChange(event.target.value)}
            className="h-10 w-full"
          >
            <NativeSelectOption value={NO_SCREEN_TEMPLATE_ID}>Without template</NativeSelectOption>
            {builtInTemplates.length > 0 && (
              <NativeSelectOptGroup label="Built-in">
                {builtInTemplates.map((template) => (
                  <NativeSelectOption
                    key={`built-in:${template.id}`}
                    value={screenTemplateKey(template)}
                  >
                    {screenTemplateOptionLabel(template, templates)}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            )}
            {projectTemplates.length > 0 && (
              <NativeSelectOptGroup label="Project">
                {projectTemplates.map((template) => (
                  <NativeSelectOption
                    key={`project:${template.id}`}
                    value={screenTemplateKey(template)}
                  >
                    {screenTemplateOptionLabel(template, templates)}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            )}
          </NativeSelect>
        </div>
      </Field>
      {selectedTemplatePreview?.layoutSchema && (
        <pre className="max-h-48 overflow-auto whitespace-pre rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-tight text-muted-foreground">
          {selectedTemplatePreview.layoutSchema}
        </pre>
      )}
      {isModalSurface && (
        <ModalCreationFields
          defaults={modalDefaults}
          width={modalWidth}
          height={modalHeight}
          longContent={modalLongContent}
          widthInvalid={modalWidthInvalid}
          heightInvalid={modalHeightInvalid}
          disabled={busy}
          onWidthChange={onModalWidthChange}
          onHeightChange={onModalHeightChange}
          onLongContentChange={onModalLongContentChange}
        />
      )}
      <GenerationRunOptions
        directionPicker={directionPicker}
        wireframe={wireframe}
        designJury={designJury}
        disabled={busy}
        onDirectionPickerChange={onDirectionPickerChange}
        onWireframeChange={onWireframeChange}
        onDesignJuryChange={onDesignJuryChange}
      />
      {projectTemplates.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add reusable layouts as{' '}
          <span className="font-mono">.sber-designer/screen-templates/*.screen.md</span> files in
          the connected project to see them here.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Leaving the instruction empty creates an empty editable screen and does not start Assistant.
      </p>
      {templatesLoading && <p className="text-xs text-muted-foreground">Loading templates...</p>}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </div>
      )}
    </div>
  );
}

function ScreenTemplateHelp() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Where to find and add screen templates"
          className="inline-grid size-4 shrink-0 cursor-help place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" align="start" sideOffset={6} className="max-w-96 p-4 text-left">
        <div className="grid gap-2 text-balance">
          <p className="text-sm font-semibold leading-tight text-popover-foreground">
            Where screen templates come from
          </p>
          <p className="text-popover-foreground/70">
            Ready-to-use recipes appear in this menu under{' '}
            <strong className="font-semibold text-popover-foreground">Built-in</strong>. Their
            source files ship with sber-designer in{' '}
            <code className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[11px] text-popover-foreground">
              packages/agent-kit/kit/screen-templates/*.screen.md
            </code>
            .
          </p>
          <p className="text-popover-foreground/70">
            Team templates appear under{' '}
            <strong className="font-semibold text-popover-foreground">Project</strong>. To add your
            own, create{' '}
            <code className="break-all rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[11px] text-popover-foreground">
              {'<project>/.sber-designer/screen-templates/<name>.screen.md'}
            </code>{' '}
            and reopen this dialog.
          </p>
          <p className="text-popover-foreground/70">
            Required frontmatter:{' '}
            <code className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[11px] text-popover-foreground">
              name
            </code>{' '}
            and{' '}
            <code className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[11px] text-popover-foreground">
              description
            </code>
            . Use{' '}
            <code className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[11px] text-popover-foreground">
              TEMPLATE.screen.md
            </code>{' '}
            as the format reference; the body describes intent, layout, regions, states, and
            component guidance.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function FolderSelect({
  value,
  folders,
  disabled,
  onChange,
}: {
  value: string;
  folders: readonly string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Folder">
      <div className="[&_[data-slot=native-select-wrapper]]:w-full">
        <NativeSelect
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-10 w-full"
        >
          {folders.map((folder) => (
            <NativeSelectOption key={folder} value={folder}>
              {folder}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value={NEW_SCREEN_FOLDER_OPTION}>New folder</NativeSelectOption>
        </NativeSelect>
      </div>
    </Field>
  );
}
