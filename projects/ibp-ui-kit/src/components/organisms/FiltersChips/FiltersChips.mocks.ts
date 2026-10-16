import { FilterChipConfig } from './FiltersChips.types';
import { FormData, formDataLabels } from '../FormConstructor/FormConstructor.mocks';

export const filtersChipsConfig: Record<string, FilterChipConfig<FormData>> = {
  amount: { label: formDataLabels.amount, variant: 'amount' },
  branches: { label: formDataLabels.branches, variant: 'branch' },
  creationDate: { label: formDataLabels.creationDate, variant: 'creationDate' },
  currencies: {
    label: formDataLabels.currency,
    variant: 'currencies',
  },
  departments: { label: formDataLabels.departments, variant: 'departments' },
  desks: { label: formDataLabels.desks, variant: 'desks' },
  isActive: { label: formDataLabels.isActive, variant: 'isActive' },
  lastUpdate: { label: formDataLabels.lastUpdate, variant: 'lastUpdate' },
  price: { label: formDataLabels.price, variant: 'price' },
  project: { label: formDataLabels.project, variant: 'project' },
};
