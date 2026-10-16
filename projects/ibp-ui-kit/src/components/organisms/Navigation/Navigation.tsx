/* eslint-disable sonarjs/cognitive-complexity */
import React, { FC, memo, useMemo } from 'react';
import { ClickAwayListener } from '@mui/base';
import { Drawer } from '@mui/material';

import { SxBox, Text } from '@/components/atoms';
import { UserProfile } from '@/components/molecules';
import { getDataTestId } from '@/utils';

import { IconButton } from '../../atoms/IconButton';

import { ExternalLink } from './ExternalLink';
import {
  burgerButtonStyles,
  compartmentStyles,
  dividerStyles,
  getDrawerRootStyles,
  itemWrapperStyles,
  toolbarStyles,
  wrapperStyles,
} from './Navigation.styles';
import { NavigationProps } from './Navigation.types';
import { isInteractionItem } from './Navigation.utils';
import { NavItem } from './NavItem';
import { useNavigation } from './useNavigation';

const ROOT = 'Navigation';

export const Navigation: FC<NavigationProps> = memo((props: NavigationProps) => {
  const {
    opened,
    userProfileInfo,
    filteredItems,
    closeOnClickAway,
    onUserProfileClickCallback,
    toggleNavigation,
    closeNavigation,
  } = useNavigation(props);

  const {
    externalLinkComponent = ExternalLink,
    localLinkComponent,
    dataTestId,
    logoutComponent,
    languageComponent,
  } = props;

  const navItemsList = useMemo(() => {
    return filteredItems.map((item) => {
      return item.items.map((it, index) => {
        const { text, iconCoveredElement, postfixElement, icon, disabled, dataTestId: itemDataTestId, onClick } = it;

        const isInteractionLink = isInteractionItem(it);
        const isExternalLink = isInteractionLink || it.external;
        const isOpenedFirstItem = opened && index === 0 && item.compartment !== '';
        const isClosedFirstItem = !opened && index === 0 && item.compartment !== '';

        const clickCallback = () => {
          if (isInteractionLink) {
            it?.onClickInteraction();
          }
          onClick?.();
          closeNavigation();
        };

        return (
          <>
            {isOpenedFirstItem ? (
              <SxBox sx={compartmentStyles}>
                <Text type={'BodySReg'}>{item.compartment}</Text>
              </SxBox>
            ) : null}
            {isClosedFirstItem ? <SxBox sx={dividerStyles} /> : null}
            <NavItem
              key={index}
              linkComponent={isExternalLink ? externalLinkComponent : localLinkComponent}
              iconCoveredElement={iconCoveredElement}
              postfixElement={postfixElement}
              opened={opened}
              text={text}
              dataTestId={getDataTestId(itemDataTestId, 'NavItem', itemDataTestId ? undefined : index)}
              disabled={disabled}
              icon={icon}
              route={isInteractionLink ? undefined : it.route}
              onClick={clickCallback}
            />
          </>
        );
      });
    });
  }, [closeNavigation, externalLinkComponent, filteredItems, localLinkComponent, opened]);

  return (
    <Drawer data-testid={ROOT + dataTestId} variant="permanent" sx={getDrawerRootStyles({ opened })}>
      <ClickAwayListener
        onClickAway={closeOnClickAway}
        mouseEvent={opened ? undefined : false}
        touchEvent={opened ? undefined : false}
        disableReactTree={true}
      >
        <SxBox sx={wrapperStyles}>
          <SxBox sx={itemWrapperStyles}>
            <SxBox sx={toolbarStyles}>
              <IconButton
                name="LeftMenu"
                onClick={toggleNavigation}
                dataTestId="Burger"
                sx={burgerButtonStyles}
                size={'lg'}
              />
            </SxBox>

            {navItemsList}
          </SxBox>

          <UserProfile
            userProfile={userProfileInfo}
            isOpen={opened}
            dataTestId={'UserProfile'}
            logoutComponent={logoutComponent}
            onAvatarClick={toggleNavigation}
            onUserProfileClick={onUserProfileClickCallback}
            languageComponent={languageComponent}
          />
        </SxBox>
      </ClickAwayListener>
    </Drawer>
  );
});

Navigation.displayName = ROOT;
