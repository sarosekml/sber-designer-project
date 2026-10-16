import { useMemo } from 'react';

import { useEventApi } from '@sber-ibp/core';

import {
  ModalComponent,
  ModalControls,
  ModalFsdComponent,
  ModalFsdRootEvents,
  ModalRootEvents,
} from './makeModal.types';

// (!) Please don't delete ModalControls<Data> - the typings are important here. We prevent
// (!) users from errors - you can't call openModal if there are required props.
export const useModalWithListeningKey = <Data>(
  Modal: ModalComponent<Data> | ModalFsdComponent<Data>,
  listeningKey: string,
): ModalControls<Data> => {
  const { trigger } = useEventApi<ModalRootEvents<Data> | ModalFsdRootEvents<Data>>(listeningKey);

  return useMemo(() => {
    return {
      closeModal: () => trigger('closeModal', Modal),
      /** We want to allow this method only if there is no data for modal
       * in the same time it's can be defined only on the typings level and can't be checked
       * before it's used on the js-level so we just cast it to `any`
       * eslint-disable-next-line @typescript-eslint/no-explicit-any */
      openModal: (() =>
        trigger('openModal', {
          Component: Modal,
          data: undefined as any,
        })) as any,
      /** using lists of keys to provide or not to provide this parameter */
      openModalWith: (data: Data) => trigger('openModal', { Component: Modal, data }),
    };
  }, [Modal, trigger]);
};

/**
 * @param listeningKey - unique string key
 *
 * @example
 * const useModal = makeModalUtil('opportunity-app');
 * const { openModal, closeModal, openModalWith } = useModal(CommentItemModal);
 */
export const makeUseModal =
  (listeningKey: string) =>
  <Data>(Modal: ModalComponent<Data> | ModalFsdComponent<Data>): ModalControls<Data> =>
    useModalWithListeningKey(Modal, listeningKey);
