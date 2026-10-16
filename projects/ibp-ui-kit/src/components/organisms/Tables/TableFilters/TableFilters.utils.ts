export const getStaticFilters = <Filter extends object>(
  staticFilterKeys: (keyof Filter)[],
  filters?: Filter,
): Filter => {
  return staticFilterKeys?.reduce((acc, key) => {
    return { ...acc, [key]: filters?.[key] ?? undefined };
  }, {} as Filter);
};
