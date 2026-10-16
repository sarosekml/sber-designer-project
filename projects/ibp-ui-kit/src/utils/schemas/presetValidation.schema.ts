import * as yup from 'yup';
import { SchemaOf } from 'yup';

import { emptyArray, FilterPreset, i18n, sharedYup } from '@sber-ibp/core';

export const presetValidationSchema = (filterPresets?: FilterPreset<unknown>[], preset?: FilterPreset<unknown>) =>
  sharedYup.getCashedSchema<SchemaOf<Pick<FilterPreset<unknown>, 'name'>>>(() =>
    yup.object({
      name: yup
        .string()
        .required()
        .test('isUnique', i18n.t<string>('Name must be unique'), (value) => {
          if (!value) return true;

          const otherFilterPresetNames =
            (preset
              ? filterPresets?.filter((item) => item.objectId !== preset.objectId).map((item) => item.name)
              : filterPresets?.map((item) => item.name)) ?? emptyArray;

          return !otherFilterPresetNames.includes(value);
        }),
    }),
  );
