export interface SbiRepresentative {
  boardDirectorsRole: {
    code: string;
    name: string;
  } | null;
  firstName: string;
  lastName: string;
  middleName: string;
  indexNumber: number;
  sbiRepresentativeId: string;
  action?: boolean;
  id: string;
}

export const sbiRepresentativeData: SbiRepresentative[] = [
  {
    boardDirectorsRole: { code: 'PARTICIPANT', name: 'Участник' },
    firstName: 'Александр',
    indexNumber: 1,
    lastName: 'Арбузов',
    middleName: 'Александрович',
    sbiRepresentativeId: '1',
    id: '12345',
  },
  {
    boardDirectorsRole: { code: 'PARTICIPANT', name: 'Участник' },
    firstName: 'Илья',
    indexNumber: 2,
    lastName: 'Ивановский',
    middleName: 'Петрович',
    sbiRepresentativeId: '2',
    id: '23456',
  },
  {
    boardDirectorsRole: { code: 'PARTICIPANT', name: 'Участник' },
    firstName: 'Александр',
    indexNumber: 3,
    lastName: 'Нуждин',
    middleName: 'Сергеевич',
    sbiRepresentativeId: '3',
    id: '34567',
  },
];
