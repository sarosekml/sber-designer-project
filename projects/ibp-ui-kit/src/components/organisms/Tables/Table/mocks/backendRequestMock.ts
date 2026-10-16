import { SearchRequestDto } from '@sber-ibp/core';

import { rowsMock } from '@/components/organisms/Tables/Table/mocks/rowsMock';
import { EmployeeData } from '@/components/organisms/Tables/Table/mocks/types';

const dataMock = [...rowsMock];

export const backendRequestMock = <Filter extends object>(
  config: SearchRequestDto<Filter>,
  mockData?: EmployeeData[],
) => {
  const { sort, offset, limit = 0 } = config.paging ?? {};
  const { filters } = config;

  const sorting = sort?.split(',')?.map((it) => ({
    direction: it[0],
    columnName: it.slice(1, it.length),
  }));

  const compare = (a: EmployeeData, b: EmployeeData) => {
    if (!sorting?.[0]) return 0;
    const { columnName } = sorting[0];

    if (a[columnName] === b[columnName]) return 0;

    if (sorting[0]?.direction === '+') {
      return a[columnName] > b[columnName] ? 1 : -1;
    } else {
      return a[columnName] < b[columnName] ? 1 : -1;
    }
  };

  /** @todo Uncomment after filters adding */
  //const filters = config.body.filter as Record<string, Record<string, FilterSimpleTypes> | FilterSimpleTypes>;

  return new Promise<{ rows: EmployeeData[]; totalCount: number }>((resolve) =>
    setTimeout(() => {
      const sortedMock = (mockData || dataMock)?.sort(compare);
      const filteredRows = sortedMock.filter((it) =>
        Object.keys(it).every((key) => !filters?.[key] || it[key] === filters[key]),
      );

      /** @todo Uncomment after filters adding */
      // const filteredMock = sortedMock.filter((row) => {
      //   const totalFinancingAmount = parseInt(
      //     (row as Record<string, BaseData>).totalFinancingAmount.toString().replace(/\s/g, ''),
      //   );
      //
      //   const cost = filters.cost as Record<string, FilterSimpleTypes>;
      //   const from = cost?.from ? cost?.from <= totalFinancingAmount : true;
      //   const to = cost?.to ? cost?.to >= totalFinancingAmount : true;
      //   const name = filters.opportunityIdLike
      //     ? row?.id.toString().includes(filters.opportunityIdLike.toString())
      //     : true;
      //   return from && to && name;
      // });
      let sliceEnd = (offset || 0) + limit;
      sliceEnd = sliceEnd < sortedMock.length ? sliceEnd : sortedMock.length; //filteredMock -> sortedMock
      const pageRows = limit ? filteredRows?.slice(offset, sliceEnd) : filteredRows;

      resolve({ rows: pageRows, totalCount: filteredRows.length });
    }, 500),
  );
};
