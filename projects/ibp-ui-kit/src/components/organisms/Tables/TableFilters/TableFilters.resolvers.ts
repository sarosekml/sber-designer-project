import { FieldValues } from 'react-hook-form';

import {
  baseDataResolver,
  FilterLabelResolver,
  isDictionaryArray,
  isTargetedResolver,
  TargetedLabelResolver,
  UniversalResolver,
} from './TableFilterChips';
import { TableFilterFormDictionaries } from './TableFilterModal';
import { ExtendedFilterChipConfig, ExtendedFilterChipsConfig } from './TableFilters.types';

/**
 * Simplified similarity check to heuristically detect which dictionary we should select.
 * Generally it shouldn't be the case when two dictionaries can have equal codes,
 * so this is applied for 5 of 100 cases. To 100% safety please use `dictionaryName` in
 * the ExtendedChipsConfig.
 */
const calcSimpleSimilarity = (rawAttr: string, rawHint: string): number => {
  const attr = rawAttr.toLowerCase();
  const hint = rawHint.toLowerCase();
  for (let i = 0; i < hint.length; i++) {
    const prefix = hint.substring(0, hint.length - i);
    const postfix = hint.substring(i, hint.length);

    const halfI = Math.floor(i / 2);
    const root = hint.substring(halfI, hint.length - halfI);

    if (attr.indexOf(prefix) !== -1 || attr.indexOf(postfix) !== -1 || attr.indexOf(root) !== -1) {
      return (
        ((hint.length - i) / hint.length) *
        (1 - Math.abs(hint.length - attr.length) / Math.max(hint.length, attr.length))
      );
    }
  }
  return 0;
};

const makeByHintComparator =
  (hint: string) =>
  ([attr1]: [string, string], [attr2]: [string, string]) => {
    const c1 = calcSimpleSimilarity(attr1, hint);
    const c2 = calcSimpleSimilarity(attr2, hint);
    return c2 - c1;
  };

export const makeDictionaryUniversalResolver = <Dictionaries extends object>(
  dictionaries: Dictionaries,
): UniversalResolver => {
  const codeToName = new Map<string, Map<string, string>>();
  for (const key in dictionaries) {
    if (!Object.hasOwn(dictionaries, key)) continue;
    const dictionary = dictionaries[key];
    if (!isDictionaryArray(dictionary)) continue;

    for (const it of dictionary) {
      if (!codeToName.has(it.code)) {
        codeToName.set(it.code, new Map());
      }
      const alternatives = codeToName.get(it.code)!;
      alternatives.set(key, it.name);
    }
  }

  return (code: string, hint?: string) => {
    if (typeof code !== 'string') return null;
    const alternatives = Array.from(codeToName.get(code)?.entries() ?? []);

    if (hint && alternatives.length > 1) {
      const comparator = makeByHintComparator(hint);
      alternatives.sort(comparator);
    }
    return alternatives[0]?.[1] ?? null;
  };
};

export const makeDictionaryTargetedResolvers = <Filter extends object, FormType extends FieldValues>(
  filtersChipsConfig: ExtendedFilterChipsConfig<Filter, FormType>,
  dictionaries: TableFilterFormDictionaries<FormType>,
  existingResolvers?: FilterLabelResolver<Filter>[],
): FilterLabelResolver<Filter>[] => {
  const ignoredTargets = new Set(
    existingResolvers?.map((it) => (isTargetedResolver(it) ? it.target : undefined)).filter(Boolean),
  );
  const targetedResolvers: TargetedLabelResolver<Filter>[] = [];
  const entries = Array.from(Object.entries(filtersChipsConfig)) as [
    keyof Filter,
    ExtendedFilterChipConfig<Filter, FormType>,
  ][];
  for (const [name, config] of entries) {
    if (config.dictionaryName && dictionaries[config.dictionaryName] && !ignoredTargets.has(name)) {
      const dictionary = dictionaries[config.dictionaryName];

      if (!isDictionaryArray(dictionary)) continue;

      targetedResolvers.push({
        target: name,
        resolve: (value) => {
          if (!value) return '';
          const selectedCodes = new Set(value instanceof Array ? value : [value]);
          return dictionary
            .filter((it) => selectedCodes.has(it.code))
            .map((it) => it.name)
            .join(', ');
        },
      } as TargetedLabelResolver<Filter>);
    } else if (config.preventResolving) {
      targetedResolvers.push({
        target: name,
        resolve: baseDataResolver,
      } as TargetedLabelResolver<Filter>);
    }
  }
  return targetedResolvers;
};
