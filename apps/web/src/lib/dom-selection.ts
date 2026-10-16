/** Reject placeholder ids emitted by component wrappers with a missing id prefix. */
export function isUsableDomTestId(value: string | null | undefined): value is string {
  const normalized = value?.trim() ?? '';
  return Boolean(
    normalized &&
    !/^(?:undefined|null|nan)(?:[_-]|$)/i.test(normalized) &&
    !/\[object\s+object\]/i.test(normalized),
  );
}
