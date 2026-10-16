import React, { memo, useMemo } from 'react';

import { AlertInModalProps, Modal } from '@/components/molecules';

import { ModalBaseComponentProps } from './Modal.types';

const modalLabels = {
  'An unknown error occurred': 'Произошла неизвестная ошибка',
};

/**
 * Base Modal template.
 *
 * * This component is template for Modal in any micro frontend
 * * This component is scalable and doesn't have dependencies with other applications
 * * Developer can extend this component, if it is necessary
 *
 * Structure:
 * * Modal.tsx - UI of the Modal template.
 * * Modal.slice - Redux storage implementation to create an unlimited number of Modals.
 * * Modal.selectors - Selector which return ModalState data for current Modal.
 * * Modal.types - Typings for Modal.
 * * useModal - Hook which present API of the Modal.
 *
 * Provide modal to redux:
 * * Add modalReducer from Modal.slice to the combine reducers in your application
 * */
export const ModalTemplate = memo((props: ModalBaseComponentProps) => {
  const { errors, alertTopProps, ...modalTemplateProps } = props;

  const alertProps: AlertInModalProps | undefined = useMemo(() => {
    if (!errors || errors.length === 0) return;
    return {
      dataTestId: 'ModalErrorAlert',
      message:
        errors.length === 1
          ? errors[0] ?? modalLabels['An unknown error occurred']
          : errors.map((error, index) => `${index + 1}) ${error}`).join('\n'),
      severity: 'error',
    };
  }, [errors]);

  return <Modal {...modalTemplateProps} visible={true} alertTopProps={alertTopProps ?? alertProps} />;
});

ModalTemplate.displayName = 'Modal';
