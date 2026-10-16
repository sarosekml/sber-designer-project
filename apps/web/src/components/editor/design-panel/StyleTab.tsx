/** Style tab: token-aware style editing with assistant fallback. */
import { AlertTriangle, Loader2 } from 'lucide-react';

import {
  designCapabilityAllows,
  designCapabilityReason,
  hasDesignSourceTarget,
} from '@/lib/design-capabilities';
import type { DesignInspectResult, DesignToken } from '@/lib/design-types';
import { useDesignStore } from '@/stores/design-store';

import {
  AssistantFallback,
  buildFallbackPrompt,
  Control,
  draftClassName,
  draftStyleValue,
  InlineNotice,
  LockedNotice,
  ReadOnlyRow,
  Section,
  targetLoc,
} from './shared';

export function StyleTab({ info }: { info: DesignInspectResult }) {
  const tokens = useDesignStore((s) => s.tokens);
  const tokensLoading = useDesignStore((s) => s.tokensLoading);
  const tokensError = useDesignStore((s) => s.tokensError);
  const changes = useDesignStore((s) => s.draftChanges);
  const upsertChange = useDesignStore((s) => s.upsertChange);
  const target = info.target;
  const loc = targetLoc(target);
  const filePath = target.filePath;
  const sourceReady = hasDesignSourceTarget(info) && Boolean(target.filePath && loc);

  if (!sourceReady || !filePath || !loc) {
    return (
      <AssistantFallback
        reason={designCapabilityReason(
          info,
          ['style', 'className'],
          'This selection cannot be styled safely.',
        )}
        prompt={buildFallbackPrompt(info, 'Change styling on the selected target.')}
      />
    );
  }

  const styleEditable =
    designCapabilityAllows(info, 'style', 'set-style') && info.styles?.styleEditable !== false;
  const classNameEditable =
    designCapabilityAllows(info, 'className', 'set-class-token') &&
    info.styles?.classNameEditable !== false;
  const styleLockedReason = designCapabilityReason(info, ['style'], 'Style prop is read-only.');
  const classNameLockedReason = designCapabilityReason(
    info,
    ['className'],
    'Expression-based className is read-only.',
  );

  if (!styleEditable && !classNameEditable) {
    return (
      <AssistantFallback
        reason={designCapabilityReason(
          info,
          ['style', 'className'],
          'This selection cannot be styled safely.',
        )}
        prompt={buildFallbackPrompt(info, 'Change styling on the selected target.')}
      />
    );
  }

  const noTokens =
    tokens.colors.length + tokens.spacing.length + tokens.radius.length + tokens.shadows.length ===
    0;

  const setStyle = (property: string, value: string, label: string) => {
    upsertChange(
      value
        ? {
            kind: 'set-style',
            targetId: target.id,
            filePath,
            loc,
            property,
            value,
            label,
          }
        : {
            kind: 'remove-style',
            targetId: target.id,
            filePath,
            loc,
            property,
            label,
          },
    );
  };

  return (
    <div className="grid gap-4">
      {tokensLoading && (
        <InlineNotice
          icon={Loader2}
          title="Loading tokens"
          detail="Reading design-index, CSS variables and Tailwind config."
          spin
        />
      )}
      {tokensError && (
        <InlineNotice
          tone="warning"
          icon={AlertTriangle}
          title="Tokens unavailable"
          detail={tokensError}
        />
      )}
      {noTokens && !tokensLoading && (
        <InlineNotice
          tone="warning"
          icon={AlertTriangle}
          title="Raw values enabled"
          detail="No indexed tokens were found. MVP allows raw CSS values with a visual draft warning."
        />
      )}
      {!styleEditable && <LockedNotice reason={info.styles?.styleReason ?? styleLockedReason} />}
      {!info.styles?.styleObject && styleEditable && (
        <InlineNotice
          tone="warning"
          icon={AlertTriangle}
          title="Creates inline style"
          detail="No editable style object exists, so Apply will create a narrow inline style prop."
        />
      )}

      <Section title="Background">
        <StyleValueControl
          label="Background color"
          value={
            draftStyleValue(changes, target.id, 'backgroundColor') ??
            info.styles?.styleObject?.backgroundColor ??
            ''
          }
          tokens={tokens.colors}
          disabled={!styleEditable}
          onChange={(value) => setStyle('backgroundColor', value, 'Background color')}
        />
      </Section>
      <Section title="Typography">
        <StyleValueControl
          label="Text color"
          value={
            draftStyleValue(changes, target.id, 'color') ?? info.styles?.styleObject?.color ?? ''
          }
          tokens={tokens.colors}
          disabled={!styleEditable}
          onChange={(value) => setStyle('color', value, 'Text color')}
        />
      </Section>
      <Section title="Spacing">
        {['padding', 'margin', 'gap'].map((property) => (
          <StyleValueControl
            key={property}
            label={property}
            value={
              draftStyleValue(changes, target.id, property) ??
              info.styles?.styleObject?.[property] ??
              ''
            }
            tokens={tokens.spacing}
            disabled={!styleEditable}
            onChange={(value) => setStyle(property, value, property)}
          />
        ))}
      </Section>
      <Section title="Border">
        <StyleValueControl
          label="Radius"
          value={
            draftStyleValue(changes, target.id, 'borderRadius') ??
            info.styles?.styleObject?.borderRadius ??
            ''
          }
          tokens={tokens.radius}
          disabled={!styleEditable}
          onChange={(value) => setStyle('borderRadius', value, 'Radius')}
        />
      </Section>
      <Section title="Class name">
        {classNameEditable ? (
          <textarea
            value={draftClassName(changes, target.id) ?? info.styles?.className ?? ''}
            onChange={(event) =>
              upsertChange({
                kind: 'set-class-token',
                targetId: target.id,
                filePath,
                loc,
                tokenGroup: 'className',
                ...(info.styles?.className ? { previousClass: info.styles.className } : {}),
                nextClass: event.currentTarget.value,
                label: 'Class name',
              })
            }
            rows={3}
            className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <ReadOnlyRow
            label="className"
            reason={info.styles?.classNameReason ?? classNameLockedReason}
          />
        )}
      </Section>
    </div>
  );
}

function StyleValueControl({
  label,
  value,
  tokens,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  tokens: DesignToken[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Control label={label}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        <select
          value={tokens.some((token) => token.value === value) ? value : ''}
          disabled={disabled || tokens.length === 0}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        >
          <option value="">Token…</option>
          {tokens.map((token) => (
            <option key={token.id} value={token.value}>
              {token.name}
            </option>
          ))}
        </select>
      </div>
    </Control>
  );
}
