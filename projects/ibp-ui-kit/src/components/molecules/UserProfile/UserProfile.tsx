import React, { FC, memo } from 'react';
import { Avatar } from '@mui/material';

import { Grid } from '@/components/atoms';
import { getDataTestId } from '@/utils';

import { getUserProfileStyles } from './UserProfile.styles';
import { UserProfileProps } from './UserProfile.types';

export const UserProfile: FC<UserProfileProps> = memo(
  ({
    userProfile,
    dataTestId,
    logoutComponent,
    onAvatarClick,
    isOpen,
    onUserProfileClick,
    languageComponent,
  }: UserProfileProps) => {
    const {
      userContainer,
      avatar,
      userName,
      userPosition,
      logout,
      userInfoWrapper,
      userInfo,
      deskInfo,
      languageComponentSx,
    } = getUserProfileStyles(isOpen);

    const firstName = userProfile?.firstName.substring(0, 1);
    const lastName = userProfile?.lastName.substring(0, 1);

    return (
      <Grid sx={userContainer} dataTestId={getDataTestId(dataTestId)}>
        <Grid container sx={userInfoWrapper}>
          <Grid item dataTestId={getDataTestId(dataTestId, 'Avatar')}>
            <Avatar sx={avatar} onClick={onAvatarClick}>
              {firstName}
              {lastName}
            </Avatar>
          </Grid>
          <Grid item dataTestId={getDataTestId(dataTestId, 'Info')} sx={userInfo} onClick={onUserProfileClick}>
            <Grid
              dataTestId={getDataTestId(dataTestId, 'UserName')}
              sx={userName}
            >{`${userProfile?.firstName} ${userProfile?.lastName}`}</Grid>
            <Grid
              dataTestId={getDataTestId(dataTestId, 'UserPosition')}
              sx={userPosition}
            >{`${userProfile?.position}`}</Grid>
            {userProfile.desks.length === 0 ? null : (
              <Grid item dataTestId={getDataTestId(dataTestId, 'DeskInfo')} sx={deskInfo}>
                {userProfile.desks.length >= 2
                  ? `${userProfile?.desks?.[0]?.name} +${userProfile?.desks?.length - 1}`
                  : `${userProfile?.desks?.[0]?.name}`}
              </Grid>
            )}
          </Grid>
        </Grid>
        <Grid sx={logout} dataTestId={'Logout'}>
          {languageComponent ? <Grid sx={languageComponentSx}>{languageComponent}</Grid> : null}
          {logoutComponent}
        </Grid>
      </Grid>
    );
  },
);

UserProfile.displayName = 'UserProfile';
