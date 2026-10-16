import React, { memo, useCallback } from 'react';
import { Theme, useTheme } from '@mui/material';

import { Button, Grid, IconButton, Tooltip, ValueBadge } from '@/components/atoms';
import { ListCounter } from '@/components/atoms/Counter/ListCounter';

import { defaultChipsTrimmingLength, defaultFiltersChipsLocalization } from './FiltersChips.const';
import { clearAllFiltersChipStyles, filterChipStyles, filtersExpandedButtonStyles } from './FiltersChips.styles';
import { FiltersChipsProps } from './FiltersChips.types';
import { useFiltersChips } from './useFiltersChips';

const root = 'FiltersChips';

export const FiltersChips = memo(<Filter extends object>(props: FiltersChipsProps<Filter>) => {
  const theme = useTheme<Theme>();
  const {
    onClearFilters,
    trimmingLength = defaultChipsTrimmingLength,
    localization = defaultFiltersChipsLocalization,
    staticFilterKeys,
  } = props;
  const { visibleChipModels, chipsSize, showAllFilters, expanded, isEmptyFilters } = useFiltersChips(props);
  const isReadyToExpand = !isEmptyFilters && chipsSize > trimmingLength;

  const onClearAllFilters = useCallback(() => onClearFilters(), [onClearFilters]);

  return (
    <>
      {!isEmptyFilters && (
        <Grid sx={clearAllFiltersChipStyles}>
          <Tooltip dataTestId="ClearAllFilters" title={localization.clearAllFilters} isHint>
            <Button
              size="xs"
              color="primary"
              type="outlined"
              onClick={onClearAllFilters}
              dataTestId={`${root}_ClearAll`}
              startIcon={'FilterReset'}
            />
          </Tooltip>
        </Grid>
      )}

      {visibleChipModels.map((filter) => {
        const filterStrId = filter.filterIds[0].toString();
        const isStaticFilter = staticFilterKeys?.includes(filterStrId as keyof Filter);

        return (
          <Grid key={root + filterStrId} sx={filterChipStyles}>
            <Tooltip dataTestId={filterStrId} title={filter.label} isHint>
              <ValueBadge
                size="sm"
                variant="outlined"
                value={filter.label}
                onDelete={!isStaticFilter ? () => onClearFilters(filter.filterIds) : undefined}
                dataTestId={root + '_' + filterStrId}
                component={'Chip'}
              />
            </Tooltip>
          </Grid>
        );
      })}

      {!expanded && isReadyToExpand && (
        <ListCounter
          count={chipsSize - trimmingLength}
          cutCount={0}
          size={'sm'}
          sx={{ color: theme.palette.Text.TextPrimary }}
        />
      )}

      {isReadyToExpand && (
        <Grid sx={filtersExpandedButtonStyles}>
          <IconButton
            dataTestId={`ShowAllFilters`}
            name={expanded ? 'ChevronUp' : 'ChevronDown'}
            size={'sm'}
            onClick={showAllFilters}
          />
        </Grid>
      )}
    </>
  );
});

FiltersChips.displayName = root;
