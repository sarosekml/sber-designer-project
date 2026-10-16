import { SbiRepresentative } from '@/components/organisms/Tables/Table/mocks/sbiRepresentativeRows';

export const sbiRepresentativeColumns: {
  name: keyof SbiRepresentative | 'action';
  title: string;
  align?: 'left' | 'center' | 'right';
}[] = [
  {
    name: 'indexNumber',
    title: '№',
  },
  {
    name: 'lastName',
    title: 'Фамилия',
  },
  {
    name: 'firstName',
    title: 'Имя',
  },
  {
    name: 'middleName',
    title: 'Отчество',
  },
  {
    name: 'boardDirectorsRole',
    title: 'Роль в СД',
  },
  { name: 'id', title: 'ID' },
  {
    name: 'action',
    title: ' ',
    align: 'right',
  },
];
