import { uuid } from '@sber-ibp/core';

export const useGetInitialSbiRowData = () => {
  return (maxIndex?: number) => ({
    boardDirectorsRole: null,
    firstName: '',
    indexNumber: maxIndex ? maxIndex + 1 : 1,
    lastName: '',
    middleName: '',
    sbiRepresentativeId: '',
    id: uuid(),
  });
};
