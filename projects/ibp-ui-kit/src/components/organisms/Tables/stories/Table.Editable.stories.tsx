import React, { useCallback, useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Button } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';

import { FormHandler } from '@/components/molecules/Inputs';
import { Table } from '@/components/organisms/Tables';
import { useEditableRows } from '@/components/organisms/Tables/Table/mocks/hooks/useEditableRows';
import { useGetInitialSbiRowData } from '@/components/organisms/Tables/Table/mocks/hooks/useGetInitialSbiRowData';
import { sbiRepresentativeColumns } from '@/components/organisms/Tables/Table/mocks/sbiRepresentativeColumns';

import { SbiRepresentative, sbiRepresentativeData } from '../Table/mocks/sbiRepresentativeRows';

export default {
  title: 'Organisms/Table/Editable',
  component: Table,
  parameters: {
    viewMode: 'canvas',
  },
  argTypes: {
    isEditMode: {
      description: 'Режим редактирования таблицы',
    },
    rowProps: {
      description: 'Свойства строк таблицы (обработчики кликов и т.д.)',
    },
  },
} as Meta;

interface SbiForm {
  rows: SbiRepresentative[];
}

export const EditableRow: StoryFn = () => {
  const [isEditMode, setEditMode] = useState(false);
  const [selectedRow, setSelectedRow] = useState<string | number | undefined>();
  const getInitialRowData = useGetInitialSbiRowData();

  const methods = useForm<SbiForm>({
    defaultValues: { rows: sbiRepresentativeData },
    shouldUnregister: true,
  });

  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: 'rows',
  });

  const rowsWatcher = methods.watch();

  const handleDeleteRow = useCallback(
    (id: number) => {
      remove(id);
    },
    [remove],
  );

  const tableRows = useEditableRows(fields, isEditMode, handleDeleteRow);

  const handleAddRow = useCallback(() => {
    if (tableRows.length) {
      append(getInitialRowData(tableRows.length));
    } else {
      methods.reset({ rows: [getInitialRowData(0)] });
    }
  }, [append, getInitialRowData, methods, tableRows.length]);

  useEffect(() => {
    if (typeof selectedRow !== 'number') return;
    const { rows } = rowsWatcher;
    const currentRow = rows?.[selectedRow];
    console.log(currentRow?.lastName);
  }, [rowsWatcher, selectedRow]);

  const handleSubmit = useCallback((form: SbiForm) => {
    console.log('form', form.rows);
  }, []);

  const enableEditMode = useCallback(() => setEditMode(!isEditMode), [isEditMode]);

  return (
    <FormHandler
      formId={'SbiRepresentative'}
      methods={methods}
      dataTestId={'SbiRepresentativeForm'}
      onSubmit={handleSubmit}
    >
      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={enableEditMode}>Изменить</Button>
        </div>

        <div>
          <Table
            isEditMode={isEditMode}
            rowProps={{
              defaultSelectedRowIndex: 1,
              onRowClick: (row, selectedRowId) => {
                setSelectedRow(selectedRowId);
                console.log(row.indexNumber, selectedRowId);
              },
              onDoubleRowClick: (row, selectedRowId) => console.log(row.indexNumber, selectedRowId),
            }}
            dataTestId="SbiRepresentative"
            columns={sbiRepresentativeColumns}
            rows={tableRows}
          />
        </div>

        {isEditMode && (
          <div>
            <Button onClick={handleAddRow}>Добавить</Button>
          </div>
        )}
      </div>
    </FormHandler>
  );
};

EditableRow.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Для корректной работы редактирования таблицы должны быть соблюдены следующие условия: \n' +
        '\n* Для редактируемых ячеек в `rows` должны быть заданы методы `render` и `editRender`. Метод `editRender` должен возвращать компонент формы (например, InputTextHandler - см. formHandlers). Метод `render` должен возвращать такой же компонент, но c readOnly стилями. \n' +
        '\n* Задан пропс `isEditMode`. Если он равен `true`, то для рендера ячеек выделенной строки будет использоваться `editRender`.' +
        '\n* В `useForm` необходимо передать `shouldUnregister: true`.' +
        '\n* Для случая, когда массив строк стал пуст, в обработчике добавления новой строки (вне таблицы) необходимо вызывать `reset`, содержащий только новую строку(см. `handleAddRow`). Иначе помимо нового элемента, будут добавлены все элементы из defaultValues формы.',
    },
  },
};
