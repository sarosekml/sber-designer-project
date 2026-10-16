/** Layers tab: DOM/layer tree with selection sync into the editor. */
import { Layers3 } from 'lucide-react';

import type { LayerNode } from '@/lib/design-types';
import { cn } from '@/lib/utils';
import { useDesignStore } from '@/stores/design-store';
import { useEditorStore } from '@/stores/editor-store';

import { InlineNotice, layerToSelectedNode } from './shared';

export function LayersTab() {
  const tree = useDesignStore((s) => s.layerTree);
  const selected = useEditorStore((s) => s.selected);
  const setSelected = useEditorStore((s) => s.setSelected);
  const setTab = useDesignStore((s) => s.setTab);
  if (!tree) {
    return (
      <InlineNotice
        icon={Layers3}
        title="No layer tree yet"
        detail="Move over the canvas or wait for the live DOM tree to sync."
      />
    );
  }
  return (
    <div className="grid gap-1 text-xs">
      <LayerRow
        node={tree}
        depth={0}
        selectedKey={selected?.domPath ?? selected?.loc ?? null}
        onSelect={(node) => {
          setSelected(layerToSelectedNode(node));
          setTab('inspect');
        }}
      />
    </div>
  );
}

function LayerRow({
  node,
  depth,
  selectedKey,
  onSelect,
}: {
  node: LayerNode;
  depth: number;
  selectedKey: string | null;
  onSelect: (node: LayerNode) => void;
}) {
  const active = selectedKey === node.domPath || selectedKey === node.loc;
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={cn(
          'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
          active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <span className="min-w-0 truncate">
          <span className="font-mono">{node.componentName ?? node.tagName.toLowerCase()}</span>
          {node.text && <span className="ml-1 opacity-70">{node.text}</span>}
        </span>
        <span className="text-[10px] opacity-70">
          {node.sourceScope ?? 'unknown'} · {Math.round(node.rect.width)}x
          {Math.round(node.rect.height)}
        </span>
      </button>
      {node.children.map((child) => (
        <LayerRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}
