import { useCallback, useMemo, useState } from 'react';

import { NavigationProps } from './Navigation.types';

export const useNavigation = ({ userProfile, items, onUserProfileClick }: NavigationProps) => {
  const [opened, setOpened] = useState(false);

  const userProfileInfo = useMemo(
    () => ({
      firstName: userProfile?.firstName ?? '',
      lastName: userProfile?.lastName ?? '',
      position: userProfile?.position ?? '',
      desks: userProfile?.desks ?? [],
    }),
    [userProfile],
  );

  const filteredItems = useMemo(
    () => items.filter((it) => it.items.filter((item) => item.access).length !== 0),
    [items],
  );

  const toggleNavigation = useCallback(() => {
    setOpened(!opened);
  }, [opened]);

  const closeNavigation = useCallback(() => setOpened(false), []);

  const closeOnClickAway = useCallback(() => {
    if (!opened) return;
    setOpened(false);
  }, [opened]);

  const onUserProfileClickCallback = useCallback(() => {
    onUserProfileClick?.();
    closeNavigation();
  }, [closeNavigation, onUserProfileClick]);

  return useMemo(
    () => ({
      opened,
      userProfileInfo,
      filteredItems,
      closeOnClickAway,
      onUserProfileClickCallback,
      toggleNavigation,
      closeNavigation,
    }),
    [
      opened,
      userProfileInfo,
      filteredItems,
      closeOnClickAway,
      onUserProfileClickCallback,
      toggleNavigation,
      closeNavigation,
    ],
  );
};
