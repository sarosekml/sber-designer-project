export type CanvasRuntimeHealthStatus = 'ok' | 'failed' | 'warning' | 'unavailable';

export interface CanvasRuntimeHealthInput {
  rootFound: boolean;
  bodyText: string;
  consoleErrors: string[];
  evidenceJsCapable?: boolean | undefined;
  sourceMarkerFound?: boolean | undefined;
  sourcePath?: string | undefined;
  sourceHash?: string | undefined;
  storyId?: string | undefined;
  domSnapshot?: string | undefined;
}

export interface CanvasRuntimeHealth {
  status: CanvasRuntimeHealthStatus;
  reason: string;
  reasonCode?:
    | 'runtime_error'
    | 'screen_root_missing'
    | 'runtime_root_unproven'
    | 'runtime_root_marker_mismatch'
    | 'browser_evidence_unavailable'
    | 'preview_unavailable';
  errorText?: string;
  evidenceSource?: 'chrome' | 'storybook-http' | 'static-html-http';
  weakEvidence?: boolean;
  httpStatus?: number;
  evidenceJsCapable?: boolean;
  sourceMarkerFound?: boolean;
  sourcePath?: string;
  sourceHash?: string;
  storyId?: string;
  domSnapshot?: string;
}

const RUNTIME_ERROR_PATTERNS = [
  /Cannot find module/i,
  /Module not found/i,
  /Failed to fetch dynamically imported module/i,
  /Element type is invalid/i,
  /Uncaught\s+(?:Error|TypeError|ReferenceError|SyntaxError)/i,
  /ReferenceError:/i,
  /SyntaxError:/i,
  /TypeError:/i,
  /Cannot\s+read\s+(?:properties|property)\s+of\s+(?:undefined|null)/i,
  /addEventListener\s+is\s+not\s+a\s+function/i,
  /removeEventListener\s+is\s+not\s+a\s+function/i,
];

export function isRuntimeErrorEvidenceText(value: string): boolean {
  return RUNTIME_ERROR_PATTERNS.some((pattern) => pattern.test(value));
}

export function classifyCanvasRuntimeHealth(input: CanvasRuntimeHealthInput): CanvasRuntimeHealth {
  const evidence = [...input.consoleErrors, input.bodyText]
    .map((value) => value.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
  const errorText = evidence.find((line) => isRuntimeErrorEvidenceText(line));
  if (errorText) {
    return {
      status: 'failed',
      reason: compact(`Canvas runtime error: ${errorText}`),
      reasonCode: 'runtime_error',
      errorText: compact(errorText),
    };
  }
  if (!input.rootFound) {
    const evidenceJsCapable = input.evidenceJsCapable ?? true;
    const sourceMarkerFound = input.sourceMarkerFound === true;
    if (!evidenceJsCapable) {
      return {
        status: 'warning',
        reason:
          'Runtime screen root was not proven because this probe cannot execute preview JavaScript. Configure browser render evidence before treating this as a failed screen root.',
        reasonCode: 'runtime_root_unproven',
        weakEvidence: true,
        evidenceJsCapable,
        sourceMarkerFound,
        ...(input.sourcePath ? { sourcePath: input.sourcePath } : {}),
        ...(input.sourceHash ? { sourceHash: input.sourceHash } : {}),
        ...(input.storyId ? { storyId: input.storyId } : {}),
      };
    }
    if (sourceMarkerFound) {
      return {
        status: 'warning',
        reason:
          'Runtime screen root marker mismatch: source contains data-sd-screen-root, but JS-capable preview evidence did not expose it in the rendered DOM.',
        reasonCode: 'runtime_root_marker_mismatch',
        weakEvidence: false,
        evidenceJsCapable,
        sourceMarkerFound,
        ...(input.sourcePath ? { sourcePath: input.sourcePath } : {}),
        ...(input.sourceHash ? { sourceHash: input.sourceHash } : {}),
        ...(input.storyId ? { storyId: input.storyId } : {}),
        ...(input.domSnapshot ? { domSnapshot: compact(input.domSnapshot) } : {}),
      };
    }
    if (input.bodyText.trim().length > 0) {
      return {
        status: 'failed',
        reason:
          'No data-sd-screen-root was found, but Storybook returned non-empty content without runtime error evidence.',
        reasonCode: 'screen_root_missing',
        evidenceJsCapable,
        sourceMarkerFound,
      };
    }
    return {
      status: 'failed',
      reason: 'No data-sd-screen-root was found after canvas load.',
      reasonCode: 'screen_root_missing',
      evidenceJsCapable,
      sourceMarkerFound,
    };
  }
  return {
    status: 'ok',
    reason: 'Canvas rendered a screen root without runtime error evidence.',
  };
}

function compact(value: string): string {
  const trimmed = value.replace(/\s+/gu, ' ').trim();
  return trimmed.length > 220 ? `${trimmed.slice(0, 217)}...` : trimmed;
}
