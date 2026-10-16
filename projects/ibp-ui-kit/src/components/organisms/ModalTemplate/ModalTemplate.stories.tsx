import React, { memo, useCallback } from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { Grid } from '@/components/atoms';
import { Button } from '@/components/atoms/buttons';
import { SxBox } from '@/components/atoms/SxBox';

import { ModalComponent } from './makeModal.types';
import { makeUseModal } from './makeUseModal';
import { ModalRoot } from './ModalRoot';
import { ModalTemplate } from './ModalTemplate';

export default {
  title: 'Organisms/ModalTemplate',
  component: ModalTemplate,
} as Meta;

/**
 * This is declaration of your modals listenKey and create instance of useModal hook -
 * you should use it in one global place in utils locally, for example
 * */
const listeningKey = 'ui-kit-test';
const useModal = makeUseModal(listeningKey);

interface TestModalProps {
  testType: 'type1' | 'type2';
}

const TestModal: ModalComponent<TestModalProps> = memo(({ closeModal, data: { testType } }) => {
  return (
    <ModalTemplate
      name={'TestModal'}
      closeModal={closeModal}
      width={500}
      height={300}
      actions={<Button onClick={closeModal}>Close</Button>}
    >
      <SxBox component="div">
        <SxBox component="div">Here can be any content - usually for our system it is form</SxBox>
        {testType === 'type1' ? <SxBox component="div">Type 1</SxBox> : <SxBox component="div">Type 2</SxBox>}
      </SxBox>
    </ModalTemplate>
  );
});

const Template: StoryFn<typeof ModalTemplate> = () => {
  const { openModalWith } = useModal(TestModal);

  const openModalWithProps = useCallback(() => {
    openModalWith({
      testType: 'type2',
    });
  }, []);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        {/* This is general registration for all of your modals in the app,
        you should use in the root file of application (App.tsx) */}
        <ModalRoot listeningKey={listeningKey} />
      </Grid>
      <Grid item xs={12}>
        <Button dataTestId={'OpenTestModal'} onClick={openModalWithProps}>
          Open test modal
        </Button>
      </Grid>
    </Grid>
  );
};

export const BaseModalExample = Template.bind({});
