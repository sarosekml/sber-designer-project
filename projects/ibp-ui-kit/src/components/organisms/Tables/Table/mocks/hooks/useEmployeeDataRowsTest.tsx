import React from 'react';

import { TextMultiRow } from '@/components/atoms/TextMultiRow';
import { Row } from '@/components/organisms/Tables/Table';

import { CitiesType, UserData } from '../types';

export const useEmployeeDataRowsTest = (data: UserData[]): Row<Omit<UserData, 'cities'> & CitiesType>[] => {
  return data?.flatMap((row: UserData) => {
    return row.cities?.map((subRow: CitiesType, subRowIndex) => {
      return {
        personalNumber: {
          render: () => <TextMultiRow>{row.personalNumber}</TextMultiRow>,
          rowSpan: subRowIndex === 0 ? row.cities.length : undefined,
          skipRender: subRowIndex !== 0,
        },
        fullName: {
          render: () => <TextMultiRow>{row.fullName}</TextMultiRow>,
          rowSpan: subRowIndex === 0 ? row.cities.length : undefined,
          skipRender: subRowIndex !== 0,
        },
        name: {
          render: () => subRow.name,
          data: subRow.name,
          isAfterRowspan: true,
        },
        code: subRow.code,
      };
    });
  });
};
