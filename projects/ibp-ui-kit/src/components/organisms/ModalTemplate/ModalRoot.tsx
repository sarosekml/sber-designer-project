import React, { memo, useCallback, useRef, useState } from 'react';

import { useEventApiListener } from '@sber-ibp/core';

import { Grid } from '@/components/atoms';

import {
  ModalComponent,
  ModalComponentDefinition,
  ModalFsdComponent,
  ModalFsdComponentDefinition,
  ModalFsdRootEvents,
  ModalRootEvents,
  ModalRootProps,
} from './makeModal.types';

export const ModalRoot = memo((props: ModalRootProps) => {
  type MComponentDefinition = ModalComponentDefinition<unknown> | ModalFsdComponentDefinition<unknown>;
  type MComponent = ModalComponent<unknown> | ModalFsdComponent<unknown>;
  type MRootEvents = ModalRootEvents<unknown> | ModalFsdRootEvents<unknown>;

  const modalsReference = useRef([] as MComponentDefinition[]);
  const [currentModals, setCurrentModals] = useState(modalsReference.current);

  const openModal = useCallback(
    (newDefinition: MComponentDefinition) => {
      modalsReference.current = [
        ...modalsReference.current.filter((definition) => definition.Component !== newDefinition.Component),
        newDefinition,
      ];
      setCurrentModals(modalsReference.current);
    },
    [setCurrentModals],
  );

  const closeModal = useCallback(
    (component: MComponent) => {
      modalsReference.current = modalsReference.current.filter((definition) => definition.Component !== component);
      setCurrentModals(modalsReference.current);
    },
    [setCurrentModals],
  );

  useEventApiListener<MRootEvents>(
    (event) => {
      switch (event.eventId) {
        case 'openModal':
          return openModal(event.data);
        case 'closeModal':
          return closeModal(event.data);
        default:
          return;
      }
    },
    [closeModal, openModal],
    props.listeningKey,
  );

  return (
    <Grid>
      {currentModals.map((definition, index) => {
        const { Component, data } = definition;
        return (
          <Component
            key={index}
            data={data}
            closeModal={() => closeModal(Component)}
            reopenModal={() => openModal(definition)}
            openModalWith={(data) => openModal({ Component, data })}
          />
        );
      })}
    </Grid>
  );
});

ModalRoot.displayName = 'ModalRoot';
