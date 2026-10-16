/** Insert tab: catalog-aware component insertion via assistant prompts. */
import { useState } from 'react';

import type { DesignInspectResult } from '@/lib/design-types';
import { resolveInsertPolicy } from '@/lib/insert-policy';
import { useChat } from '@/hooks/useChat';
import { useCatalogStore } from '@/stores/catalog-store';
import { useChatStore } from '@/stores/chat-store';

import { AssistantFallback, buildFallbackPrompt, Control } from './shared';

export function InsertTab({ info }: { info: DesignInspectResult }) {
  const catalog = useCatalogStore((s) => s.catalog);
  const { send } = useChat();
  const pending = useChatStore((s) => s.pending);
  const [placement, setPlacement] = useState<'inside' | 'before' | 'after'>('inside');
  const components = catalog?.components.slice(0, 80) ?? [];

  if (!info.target.filePath) {
    return (
      <AssistantFallback
        reason="Insertion needs a source-backed selected target."
        prompt={buildFallbackPrompt(info, 'Insert a component near this selected target.')}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <Control label="Placement">
        <select
          value={placement}
          onChange={(event) =>
            setPlacement(event.currentTarget.value as 'inside' | 'before' | 'after')
          }
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="inside">Inside selected container</option>
          <option value="before">Before selected element</option>
          <option value="after">After selected element</option>
        </select>
      </Control>
      {components.length === 0 ? (
        <p className="text-xs text-muted-foreground">No catalog components are loaded yet.</p>
      ) : (
        <div className="grid gap-1.5">
          {components.map((component) => (
            <button
              key={component.id}
              type="button"
              disabled={pending}
              onClick={() => {
                const policy = resolveInsertPolicy({
                  kind: 'catalog-component',
                  componentName: component.shortName,
                  filePath: component.filePath,
                });
                void send(
                  [
                    '[visual-design-insert]',
                    `Insert ${component.shortName} ${placement} the selected element.`,
                    `Selected source: ${info.target.filePath}:${info.target.line}:${info.target.column}`,
                    `Selected target: ${info.target.tagName.toLowerCase()} ${info.target.componentName ? `(${info.target.componentName})` : ''}`,
                    `Use catalog component ${component.title} from ${component.filePath}.`,
                    `Insert policy: ${policy.mode}; ${policy.reason}`,
                    'Keep existing layout style. Apply a narrow patch only.',
                  ].join('\n'),
                );
              }}
              className="rounded-md border border-border bg-card px-3 py-2 text-left text-xs transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{component.shortName}</span>
                <span className="text-[10px] text-muted-foreground">assistant · {placement}</span>
              </div>
              <div
                className="mt-0.5 truncate text-[10px] text-muted-foreground"
                title={component.filePath}
              >
                {component.filePath}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
