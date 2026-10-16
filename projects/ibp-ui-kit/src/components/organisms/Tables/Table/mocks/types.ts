import { Dictionary } from '@sber-ibp/core';

export interface CitiesType {
  name: string;
  code: number;
}

export interface UserData {
  personalNumber: string;
  fullName: string;
  cities: CitiesType[];
}

export interface EmployeeData {
  active: boolean;
  personalNumber: string;
  fullName: string;
  role: string;
  lastEntrance: number;
  cards: string[];
  id: string;
  comment?: string;
  desks: Dictionary[];
}

export interface EmployeeDetails {
  name: string;
  oldValue?: string;
  newValue?: string;
  isGroup?: boolean;
}
export interface EmployeeDataWithDetails {
  hasDetails?: boolean;
  active: boolean;
  personalNumber: string;
  fullName: string;
  role: string;
  lastEntrance: number;
  cards: string[];
  id: string;
  comment?: string;
  desks: Dictionary[];
  details?: {
    date: EmployeeDetails;
    direction: EmployeeDetails;
    knr: {
      isGroup: boolean;
      name: string;
      paymentknr: {
        name: string;
        oldValue: string;
        newValue: string;
      };
      paymentInn: {
        name: string;
        oldValue: string;
        newValue: string;
      };
    };
  };
}

interface Option {
  code: string;
  name: string;
}
interface Cost {
  from: number;
  to: number;
}
export interface TemplateFilterFields {
  idLike?: string;
  cost?: Cost;
  agreed?: boolean;
  option?: Option;
  filter_1?: string;
  filter_2?: string;
  filter_3?: string;
  filter_4?: string;
  filter_5?: string;
  filter_6?: string;
  filter_7?: string;
  filter_8?: string;
  filter_9?: string;
  filter_10?: string;
}
