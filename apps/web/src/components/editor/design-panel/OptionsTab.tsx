/** Options tab: component props editing with assistant fallback. */
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  designCapabilityAllows,
  designCapabilityReason,
  hasDesignSourceTarget,
} from '@/lib/design-capabilities';
import type { DesignInspectResult, DesignPropInfo } from '@/lib/design-types';
import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/stores/chat-store';
import { useDesignStore } from '@/stores/design-store';

import {
  AssistantFallback,
  buildFallbackPrompt,
  Control,
  draftChildrenText,
  draftPropValue,
  ReadOnlyRow,
  Section,
  targetLoc,
} from './shared';

const COMMON_ATTRIBUTES = [
  'id',
  'aria-label',
  'title',
  'href',
  'target',
  'data-testid',
  'data-sd-flow-id',
];

export function OptionsTab({ info }: { info: DesignInspectResult }) {
  const upsertChange = useDesignStore((s) => s.upsertChange);
  const changes = useDesignStore((s) => s.draftChanges);
  const { send } = useChat();
  const pending = useChatStore((s) => s.pending);
  const target = info.target;
  const loc = targetLoc(target);
  const filePath = target.filePath;
  const sourceReady = hasDesignSourceTarget(info) && Boolean(target.filePath && loc);

  if (!sourceReady || !filePath || !loc) {
    return (
      <AssistantFallback
        reason={designCapabilityReason(
          info,
          ['text', 'props'],
          'This selection cannot be edited safely through Options.',
        )}
        prompt={buildFallbackPrompt(info, 'Change options on the selected target.')}
      />
    );
  }

  const textEditable =
    designCapabilityAllows(info, 'text', 'set-children-text') &&
    info.jsx?.childrenEditable !== false;
  const propsEditable =
    designCapabilityAllows(info, 'props', 'set-prop') ||
    designCapabilityAllows(info, 'props', 'remove-prop');
  const textLockedReason = designCapabilityReason(
    info,
    ['text'],
    'Text cannot be edited safely through Options.',
  );
  const propsLockedReason = designCapabilityReason(
    info,
    ['props'],
    'Props cannot be edited safely through Options.',
  );

  if (!textEditable && !propsEditable) {
    return (
      <AssistantFallback
        reason={designCapabilityReason(
          info,
          ['text', 'props'],
          'This selection cannot be edited safely through Options.',
        )}
        prompt={buildFallbackPrompt(info, 'Change options on the selected target.')}
      />
    );
  }

  const childrenText =
    draftChildrenText(changes, target.id) ?? info.jsx?.childrenText ?? target.text ?? '';
  const editableProps = propsEditable
    ? (info.jsx?.props.filter((prop) => prop.editable && prop.name !== 'style') ?? [])
    : [];
  const propsByName = new Map((info.jsx?.props ?? []).map((prop) => [prop.name, prop]));

  return (
    <div className="grid gap-4">
      {textEditable ? (
        <Control label="Text content">
          <textarea
            value={childrenText}
            onChange={(event) =>
              upsertChange({
                kind: 'set-children-text',
                targetId: target.id,
                filePath,
                loc,
                text: event.currentTarget.value,
                label: 'Text content',
              })
            }
            rows={3}
            className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </Control>
      ) : (
        <ReadOnlyRow label="Text content" reason={info.jsx?.childrenReason ?? textLockedReason} />
      )}

      {propsEditable ? (
        <>
          <Section title="Props">
            {editableProps.length === 0 && (
              <p className="text-xs text-muted-foreground">No simple editable props found.</p>
            )}
            {editableProps.map((prop) => (
              <PropControl key={prop.name} prop={prop} info={info} />
            ))}
          </Section>

          <Section title="Common attributes">
            {COMMON_ATTRIBUTES.map((name) => {
              const prop = propsByName.get(name);
              const current = draftPropValue(changes, target.id, name) ?? prop?.value ?? '';
              return (
                <Control key={name} label={name}>
                  <input
                    value={current}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      upsertChange(
                        value
                          ? {
                              kind: 'set-prop',
                              targetId: target.id,
                              filePath,
                              loc,
                              name,
                              value: JSON.stringify(value),
                              label: name,
                            }
                          : {
                              kind: 'remove-prop',
                              targetId: target.id,
                              filePath,
                              loc,
                              name,
                              label: name,
                            },
                      );
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                  />
                </Control>
              );
            })}
          </Section>
        </>
      ) : (
        <ReadOnlyRow label="Props" reason={propsLockedReason} />
      )}

      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          void send(
            buildFallbackPrompt(
              info,
              'Apply a more complex prop/options edit to this selected target.',
            ),
          )
        }
      >
        <Sparkles className="size-3.5" />
        Ask Assistant
      </Button>
    </div>
  );
}

function PropControl({ prop, info }: { prop: DesignPropInfo; info: DesignInspectResult }) {
  const upsertChange = useDesignStore((s) => s.upsertChange);
  const changes = useDesignStore((s) => s.draftChanges);
  const target = info.target;
  const loc = targetLoc(target);
  if (!target.filePath || !loc) return null;
  const current = draftPropValue(changes, target.id, prop.name) ?? prop.value ?? '';

  if (prop.kind === 'boolean') {
    return (
      <label className="flex h-8 items-center justify-between rounded-md border border-border bg-card px-2 text-xs">
        <span className="font-mono">{prop.name}</span>
        <input
          type="checkbox"
          checked={current === 'true'}
          onChange={(event) =>
            upsertChange({
              kind: 'set-prop',
              targetId: target.id,
              filePath: target.filePath!,
              loc,
              name: prop.name,
              value: event.currentTarget.checked ? 'true' : 'false',
              label: prop.name,
            })
          }
        />
      </label>
    );
  }

  return (
    <Control label={prop.name}>
      <input
        type={prop.kind === 'number' ? 'number' : 'text'}
        value={current}
        onChange={(event) =>
          upsertChange({
            kind: 'set-prop',
            targetId: target.id,
            filePath: target.filePath!,
            loc,
            name: prop.name,
            value:
              prop.kind === 'number'
                ? event.currentTarget.value || '0'
                : JSON.stringify(event.currentTarget.value),
            label: prop.name,
          })
        }
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
      />
    </Control>
  );
}
