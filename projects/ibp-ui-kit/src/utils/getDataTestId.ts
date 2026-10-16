export const getDataTestId = (
  externalTestId?: string,
  ...suffixes: (string | number | undefined)[]
): string | undefined => {
  // @ts-ignore validSuffixes type is (string | undefined)[]
  const validSuffixes: string[] = suffixes?.filter(Boolean) ?? [];
  if (!externalTestId && !validSuffixes.length) return undefined;
  if (!externalTestId) return suffixes.join('_');
  if (!validSuffixes.length) return externalTestId;
  return [externalTestId, ...validSuffixes].filter(Boolean).join('_');
};
