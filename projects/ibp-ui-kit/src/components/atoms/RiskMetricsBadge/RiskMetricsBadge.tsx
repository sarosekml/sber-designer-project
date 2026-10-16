import React, { memo } from 'react';

import { dashSymbol } from '@sber-ibp/core';

import { BadgeColorThemeSx, ValueBadge } from '../DictionaryBadge';
import { SxBox } from '../SxBox';
import { Tooltip } from '../Tooltip';

import { defaultColorSchemas } from './RiskMetricsBadge.const';
import { ClientRiskMetrics } from './RiskMetricsBadge.types';

interface Props extends ClientRiskMetrics {
  dataTestId?: string;
  colorScheme?: Record<string, BadgeColorThemeSx>;
}

const ROOT = 'RiskMetricsBadge';

export const RiskMetricsBadge = memo((props: Props) => {
  const { rating, problemZone, dataTestId, colorScheme } = props;

  if (!rating && !problemZone) return null;

  const activeColorScheme = problemZone
    ? colorScheme?.[problemZone] ?? defaultColorSchemas[problemZone]
    : defaultColorSchemas['Default'];

  return (
    <SxBox>
      <Tooltip dataTestId={dataTestId ?? ROOT} placement="top" title={'Рейтинг и зона проблемности'}>
        <ValueBadge
          component={'Marker'}
          value={`${rating || dashSymbol}`}
          size={'sm'}
          colorThemeSx={activeColorScheme}
        />
      </Tooltip>
    </SxBox>
  );
});

RiskMetricsBadge.displayName = ROOT;
