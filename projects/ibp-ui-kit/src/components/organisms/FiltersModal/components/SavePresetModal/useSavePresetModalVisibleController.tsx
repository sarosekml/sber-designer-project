import { useCallback, useState } from 'react';

export const useSavePresetModalVisibleController = () => {
  const [visible, setVisible] = useState(false);

  const openModal = useCallback(() => {
    setVisible(true);
  }, []);
  const closeModal = useCallback(() => {
    setVisible(false);
  }, []);

  return {
    closeModal,
    openModal,
    visible,
  };
};
