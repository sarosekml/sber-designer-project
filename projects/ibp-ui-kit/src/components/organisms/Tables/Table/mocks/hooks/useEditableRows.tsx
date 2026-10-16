import React, { useCallback, useMemo } from 'react';

import { IconButton } from '@/components/atoms/IconButton';
import { Text } from '@/components/atoms/typography/Text/Text';
import {
  InputAutocompleteFormHandler,
  InputTextFormHandler,
  singleInputAutocompleteDictionaryProps,
} from '@/components/molecules/Inputs';
import { Row } from '@/components/organisms/Tables/Table';
import { SbiRepresentative } from '@/components/organisms/Tables/Table/mocks/sbiRepresentativeRows';
import { TextTypes } from '@/styles/theme/typography';
import { MediumSizeType } from '@/types';

export const fontVariants: Record<MediumSizeType, TextTypes> = {
  lg: 'BodyLReg',
  md: 'BodyMReg',
  sm: 'BodySReg',
};

export const useEditableRows = (data: SbiRepresentative[], isEditMode: boolean, handleDelete: (id: number) => void) => {
  const getIndexNumber = useCallback(
    (i) => (
      <Text dataTestId={`rows.${i}.indexNumber`} type={fontVariants['sm']}>
        п.{i + 1}
      </Text>
    ),
    [],
  );

  const getAutocompleteSelectHandler = useCallback(
    (i: number, disabled: boolean, name = 'boardDirectorsRole') => (
      <InputAutocompleteFormHandler
        {...singleInputAutocompleteDictionaryProps}
        size={'sm'}
        name={`rows.${i}.${name}`}
        dataTestId={`rows.${i}.${name}`}
        options={[
          { code: 'PARTICIPANT', name: 'Участник' },
          { code: 'BOSS', name: 'Владелец' },
        ]}
        disabled={disabled}
      />
    ),
    [],
  );

  return useMemo(
    () =>
      data?.map(
        (row, i) =>
          ({
            action: {
              render: () =>
                isEditMode ? (
                  <IconButton
                    size={'sm'}
                    name={'MinusCircle'}
                    dataTestId={`rows.${i}.deleteButton`}
                    onClick={() => handleDelete(i)}
                  />
                ) : null,
            },

            boardDirectorsRole: {
              render: () => getAutocompleteSelectHandler(i, true),
              editRender: () => getAutocompleteSelectHandler(i, false),
            },

            firstName: {
              render: () => <InputTextFormHandler viewType="read" name={`rows.${i}.firstName`} size={'sm'} />,
              editRender: () => <InputTextFormHandler name={`rows.${i}.firstName`} size={'sm'} />,
            },

            indexNumber: {
              data: i + 1,
              render: () => getIndexNumber(i),
              editRender: () => getIndexNumber(i),
            },

            lastName: {
              render: () => <InputTextFormHandler viewType="read" name={`rows.${i}.lastName`} size={'sm'} />,
              editRender: () => <InputTextFormHandler name={`rows.${i}.lastName`} size={'sm'} />,
            },

            middleName: {
              render: () => <InputTextFormHandler viewType="read" name={`rows.${i}.middleName`} size={'sm'} />,
              editRender: () => <InputTextFormHandler name={`rows.${i}.middleName`} size={'sm'} />,
            },

            sbiRepresentativeId: row.sbiRepresentativeId,

            id: {
              render: () => <InputTextFormHandler viewType={'read'} name={`rows.${i}.id`} size={'sm'} />,
              editRender: () => (
                <InputTextFormHandler viewType={'read'} name={`rows.${i}.id`} size={'sm'} isColoredBg />
              ),
            },
          } as Row<SbiRepresentative>),
      ),
    [data, data.length, isEditMode],
  );
};
