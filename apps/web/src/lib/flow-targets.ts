export interface FlowTargetCandidate {
  id: string;
  tagName: string;
  text?: string;
  selector?: string;
  componentName?: string;
  componentLoc?: string;
  attributes?: Record<string, string>;
}

interface FlowTargetsResultEvent {
  type: 'sber-designer:flow-targets-result';
  requestId: number;
  targets: FlowTargetCandidate[];
}

let nextRequestId = 1;

export function filterFlowTargets(
  targets: readonly FlowTargetCandidate[],
  query: string,
): FlowTargetCandidate[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...targets];
  return targets.filter((target) => searchableText(target).includes(needle));
}

export function listFlowTargetsFromIframe(
  iframe: HTMLIFrameElement | null,
  query: string,
): Promise<FlowTargetCandidate[]> {
  const targetWindow = iframe?.contentWindow;
  if (!targetWindow) return Promise.resolve([]);

  const requestId = nextRequestId++;
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as Partial<FlowTargetsResultEvent> | null;
      if (!data || data.type !== 'sber-designer:flow-targets-result') return;
      if (data.requestId !== requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(Array.isArray(data.targets) ? data.targets : []);
    };
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve([]);
    }, 1200);
    window.addEventListener('message', onMessage);
    targetWindow.postMessage({ type: 'sber-designer:list-flow-targets', requestId, query }, '*');
  });
}

function searchableText(target: FlowTargetCandidate): string {
  const attrs = target.attributes
    ? Object.entries(target.attributes).flatMap(([key, value]) => [key, value])
    : [];
  return [
    target.tagName,
    target.text,
    target.selector,
    target.componentName,
    target.componentLoc,
    ...attrs,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
