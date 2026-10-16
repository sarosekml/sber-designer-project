import React from 'react';

import { Grid, Icon, SxBox } from '@/components/atoms';
import { Tooltip } from '@/components/atoms/Tooltip';
import { dateToIsoDate } from '@/components/molecules/Inputs/InputDate/InputDateUtils/InputDate.utils';
import { Row } from '@/components/organisms/Tables/Table';
import { rolesMock } from '@/components/organisms/Tables/Table/mocks/rolesMock';
import { EmployeeData } from '@/components/organisms/Tables/Table/mocks/types';

import {
  getMarkersList,
  getMultilineText,
  getTextWithTooltip,
  noEmptyDatePresenter,
  noEmptyTextPresenter,
} from '../../../utils/cellUtils';

const lorem = ['Первый коммент', 'Второй коммент', 'Третий коммент', 'Четвертый коммент'];

export const useTableUtilsDataRows = (data: EmployeeData[]): Row<EmployeeData>[] => {
  return data?.map<Row<EmployeeData>>((row, index) => ({
    active: {
      render: () => (
        <Icon
          name={row.active ? 'Check' : 'Blocked'}
          color={row.active ? 'primary' : 'secondary'}
          dataTestId={`TableExample_Row_Cell_${index}`}
        />
      ),
      exportRender: () => (row.active ? 'Активный' : 'Заблокированный'),
    },

    personalNumber: row.personalNumber,
    fullName: {
      render: () => noEmptyTextPresenter({ value: row.fullName }),
    },

    role: {
      render: () => {
        const roles = rolesMock?.find((it) => it.name === row.role)?.roleName ?? '';
        return getTextWithTooltip(roles, 'role');
      },
    },

    comment: {
      render: () => getMultilineText({ value: lorem }),
    },

    lastEntrance: {
      render: () => {
        const date = row.lastEntrance % 2 !== 0 ? dateToIsoDate(new Date(row?.lastEntrance)) : undefined;
        return noEmptyDatePresenter({
          value: date,
          postfix: <Icon name={'AlertTriangle'} color={'warning'} size={'sm'} />,
        });
      },
    },
    id: {
      render: () => (
        <Tooltip title={row.id} dataTestId={'stories'} type="hint">
          <SxBox>{row.id}</SxBox>
        </Tooltip>
      ),
    },

    desks: {
      render: () => {
        const desks = row.lastEntrance % 2 === 0 ? row.desks : [];
        return getMarkersList({ value: desks, isTooltipColumnView: true });
      },
    },

    cards: {
      data: row.cards.map((it, index) => ({ card: it, i: index })),
      render: (cards) => (
        <Grid container spacing={3}>
          {(cards as { card: string; i: number }[])?.map((it) => (
            <Grid item sizes={{ xs: 12 }} key={it.i}>
              {it.card}
            </Grid>
          ))}
        </Grid>
      ),
    },
  }));
};
