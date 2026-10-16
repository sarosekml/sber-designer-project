import { FieldValues } from '@/components/molecules';
import { FormConstructorProps } from '@/components/organisms/FormConstructor';
import { DtoToFormConverter, FormToDtoConverter, TableFilterFormDictionaries } from '@/components/organisms/Tables';

export interface FiltersModalFormConstructorProps<Filter extends object, FormType extends FieldValues>
  extends FormConstructorProps<FormType> {
  dtoToForm: DtoToFormConverter<Filter, FormType>;
  dictionariesMap: TableFilterFormDictionaries<FormType>;
  formToDto: FormToDtoConverter<Filter, FormType>;
  openEditPresetsModal: () => void;
  enablePresets?: boolean;
}
