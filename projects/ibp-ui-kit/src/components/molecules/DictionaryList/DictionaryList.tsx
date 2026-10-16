import React, { useCallback, useMemo, useState } from 'react';

import { Grid, Tooltip } from '@/components/atoms';
import { convertDictionaryToString, ListCounter } from '@/components/atoms/Counter';
import { DictionaryBadge } from '@/components/atoms/DictionaryBadge';
import { IconButton } from '@/components/atoms/IconButton';
import { getDataTestId } from '@/utils';

import { expandedButtonStyles } from './DictionaryList.styles';
import { DictionaryListProps } from './DictionaryList.types';

/**
 * Most of the time it's enough to use ValueList, if you have only values and
 * no need to use code in the click-callbacks, otherwise if you want to
 * show exactly the list of Dictionary items dto you can use DictionaryList as:
 * @example
 * <DictionaryList data={[{code: '1', name: '1'}, {code: '2', name: '2'}]}/>
 * @example
 * <ValueList data={[1, 2, 3, 'hello']}/>
 */
export const DictionaryList = ({
  data,
  limit,
  dataTestId,
  spacing = 1,
  onItemClick,
  onItemDelete,
  expandable,
  sx,
  ...defaultItemProps
}: DictionaryListProps) => {
  const shouldUseCounter = limit && data.length > limit;
  const [expanded, setExpanded] = useState(false);
  const changeExpanded = useCallback(() => setExpanded(!expanded), [expanded]);

  const allItems = useMemo(() => {
    if (expanded || limit === 0) {
      return {
        itemsInChips: data,
        otherItems: [],
      };
    }
    const itemsInChips = data.slice(0, limit);
    const otherItems = data.slice(limit);
    const tooltipTitle = convertDictionaryToString(otherItems);
    return { itemsInChips, otherItems: tooltipTitle };
  }, [limit, data, expanded]);

  return (
    <Grid
      dataTestId={getDataTestId(dataTestId, 'DictionaryList')}
      container
      alignItems={'center'}
      spacing={spacing}
      sx={sx}
    >
      {allItems.itemsInChips.map((it, index) => (
        <Grid item key={it.code} maxWidth={'100%'}>
          <DictionaryBadge
            name={it.name}
            code={it.code}
            variant={it.variant ?? defaultItemProps.itemVariant}
            colorThemeSx={it.colorThemeSx ?? defaultItemProps.itemColorThemeSx}
            type={it.type ?? defaultItemProps.itemType}
            component={defaultItemProps.itemComponent}
            size={it.size ?? defaultItemProps.itemSize}
            disabled={it.disabled ?? defaultItemProps.itemDisabled}
            className={[it.className, defaultItemProps.itemClassName].filter(Boolean).join(' ')}
            sx={it.sx ?? defaultItemProps.itemSx}
            startIcon={it.startIcon ?? defaultItemProps.itemStartIcon}
            endIcon={it.endIcon ?? defaultItemProps.itemEndIcon}
            dataTestId={`${dataTestId}_DictionaryList_${index}`}
            onClick={onItemClick}
            onDelete={onItemDelete}
          />
        </Grid>
      ))}

      {shouldUseCounter && !expanded ? (
        <Grid item>
          <Tooltip title={allItems.otherItems}>
            <ListCounter
              count={data.length}
              cutCount={limit}
              size={defaultItemProps.itemSize}
              type={defaultItemProps.itemType}
            />
          </Tooltip>
        </Grid>
      ) : null}

      {shouldUseCounter && expandable ? (
        <Grid sx={expandedButtonStyles}>
          <IconButton
            dataTestId={getDataTestId(dataTestId, 'expand_icon')}
            name={expanded ? 'ChevronUp' : 'ChevronDown'}
            size={'sm'}
            onClick={changeExpanded}
          />
        </Grid>
      ) : null}
    </Grid>
  );
};

DictionaryList.displayName = 'DictionaryList';
