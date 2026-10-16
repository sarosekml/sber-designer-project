import type { ProjectFlowEdge } from '@sber-designer/shared-types';

export function buildFlowTrigger(
  kind: ProjectFlowEdge['trigger']['kind'],
  value: { clickLabel: string; clickSelector: string; linkHref: string; manualLabel: string },
): ProjectFlowEdge['trigger'] | null {
  switch (kind) {
    case 'click': {
      const trigger: { kind: 'click'; selector?: string; label?: string } = { kind: 'click' };
      const selector = value.clickSelector.trim();
      const label = value.clickLabel.trim();
      if (selector) trigger.selector = selector;
      if (label) trigger.label = label;
      return trigger;
    }
    case 'link': {
      const href = value.linkHref.trim();
      return href ? { kind: 'link', href } : null;
    }
    case 'on-mount':
      return { kind: 'on-mount' };
    case 'manual': {
      const label = value.manualLabel.trim();
      return label ? { kind: 'manual', label } : { kind: 'manual' };
    }
  }
}
