export interface ParsedToolArguments {
  ok: true;
  value: unknown;
  repaired: boolean;
}

export interface InvalidToolArguments {
  ok: false;
  detail: string;
}

export function parseToolArguments(
  raw: string | undefined,
): ParsedToolArguments | InvalidToolArguments {
  const source = raw?.trim();
  if (!source) return { ok: true, value: {}, repaired: false };

  const parsed = parseJson(source);
  if (!parsed.ok) return invalidJsonDetail(parsed.detail);

  const unwrapped = unwrapNestedArguments(parsed.value);
  if (!unwrapped) return { ok: true, value: parsed.value, repaired: false };

  const nested = parseJson(unwrapped);
  if (!nested.ok) {
    return {
      ok: false,
      detail: [
        'Tool arguments were wrapped as {"arguments":"..."} but the nested value is not valid JSON.',
        `Nested JSON.parse failed: ${nested.detail}`,
        toolJsonHint(),
      ].join(' '),
    };
  }

  return { ok: true, value: nested.value, repaired: true };
}

export function invalidToolJsonRecoveryDetail(
  toolName: string,
  detail: string,
  attempt: number,
): string {
  if (toolName !== 'write_file' || attempt < 2) return detail;
  return [
    detail,
    'Recovery: compact_write_required.',
    'After repeated malformed write_file JSON, call write_file once with contentsLines only.',
    'Keep the draft under 120 lines, omit optional sections, and save a compact valid screen before doing more validation.',
  ].join(' ');
}

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false; detail: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

function unwrapNestedArguments(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.arguments !== 'string') return null;
  const keys = Object.keys(record);
  return keys.length === 1 ? record.arguments : null;
}

function invalidJsonDetail(detail: string): InvalidToolArguments {
  return {
    ok: false,
    detail: [
      `Tool arguments are not valid JSON. JSON.parse failed: ${detail}`,
      toolJsonHint(),
    ].join(' '),
  };
}

function toolJsonHint(): string {
  return [
    'Call the tool with a JSON object matching its schema.',
    'For write_file use {"path":"src/file.tsx","contents":"..."} directly, escape all quotes/newlines, and do not wrap the payload in an "arguments" field.',
    'For large multiline write_file payloads, prefer {"path":"src/file.tsx","contentsLines":["line 1","line 2"]} to avoid one giant escaped string.',
    'If the file is large, reduce the screen to a smaller valid composition instead of emitting malformed JSON.',
  ].join(' ');
}
