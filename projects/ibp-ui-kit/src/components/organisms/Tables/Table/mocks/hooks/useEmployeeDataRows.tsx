import React from 'react';

import { DictionaryBadge, Grid, Icon, SxBox } from '@/components/atoms';
import { convertDictionaryToString, ListCounter } from '@/components/atoms/Counter';
import { TextMultiRow } from '@/components/atoms/TextMultiRow';
import { Tooltip } from '@/components/atoms/Tooltip';
import { InputDate } from '@/components/molecules/Inputs';
import { RowsConfig, RowView, TableColorSchema } from '@/components/organisms/Tables/Table';
import { rolesMock } from '@/components/organisms/Tables/Table/mocks/rolesMock';
import { EmployeeData, EmployeeDataWithDetails } from '@/components/organisms/Tables/Table/mocks/types';

const lorem =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

export const prepareEmployeeDataRowTemplate =
  (rowColorSchema?: TableColorSchema): ((row: EmployeeDataWithDetails, index: number) => RowView<EmployeeData>) =>
  (row, index) => ({
    colorSchema: rowColorSchema,
    data: row,
    cells: {
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
        colorSchema: {
          default: 'red',
          focus: 'blue',
          hover: 'darkred',
        },
        render: () => (
          <TextMultiRow noTooltip dataTestId={'stories'}>
            {row.fullName}
          </TextMultiRow>
        ),
      },

      role: {
        render: () => (
          <TextMultiRow dataTestId={'stories'}>
            {rolesMock?.find((it) => it.name === row.role)?.roleName ?? ''}
          </TextMultiRow>
        ),
      },

      comment: {
        render: () => <TextMultiRow dataTestId={'stories'}>{lorem}</TextMultiRow>,
      },

      lastEntrance: {
        render: () => (
          <InputDate
            value={new Date(row.lastEntrance).toLocaleString()}
            postfix={<Icon name={'AlertTriangle'} color={'warning'} size={'sm'} />}
          />
        ),
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
          const items = row.desks;
          const count = items.length;
          const cutCount = 2;
          const tooltipItems = convertDictionaryToString(items.slice(cutCount));

          return (
            <Grid container width={'100%'} gap={1}>
              {items.slice(0, cutCount).map((it) => (
                <DictionaryBadge
                  name={it.name}
                  code={it.code}
                  dataTestId={it.code}
                  key={it.code}
                  size={'sm'}
                  component={'Marker'}
                />
              ))}
              <Grid item>
                <Tooltip title={tooltipItems}>
                  <ListCounter count={count} cutCount={cutCount} size={'sm'} />
                </Tooltip>
              </Grid>
            </Grid>
          );
        },
      },
      details: row.details,
      cards: {
        data: row.cards,
        render: (cards) => (
          <Grid container spacing={3}>
            {(cards as unknown as string[])?.map((it, i) => (
              <Grid item sizes={{ xs: 12 }} key={i}>
                {it}
              </Grid>
            ))}
          </Grid>
        ),
        exportRender: (cards) => (cards as unknown as { card: string; i: number }[]).map((it) => it.card).join(','),
      },
    },
  });

export const useEmployeeDataRows = (
  data: EmployeeData[],
  rowColorSchema?: TableColorSchema,
): RowsConfig<EmployeeData> => {
  const rowTemplate = prepareEmployeeDataRowTemplate(rowColorSchema);
  return data?.map(rowTemplate);
};

export const useEmployeeDataWithDetailsRows = (
  data: EmployeeDataWithDetails[],
  rowColorSchema?: TableColorSchema,
): RowsConfig<EmployeeDataWithDetails> => {
  const rowTemplate = prepareEmployeeDataRowTemplate(rowColorSchema);
  return data?.map(rowTemplate);
};
