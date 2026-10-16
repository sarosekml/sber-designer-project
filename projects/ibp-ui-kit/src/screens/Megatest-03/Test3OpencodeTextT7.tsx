import React from 'react';
import { useTheme } from '@mui/material';

import { BreadCrumbs } from '../../components/molecules/BreadCrumbs/BreadCrumbs';
import { Text } from '../../components/atoms/typography/Text/Text';
import { Tile } from '../../components/molecules/Tiles/Tile/Tile';
import { DictionaryBadge } from '../../components/atoms/DictionaryBadge/DictionaryBadge';
import { BadgeCounter } from '../../components/atoms/BadgeCounter/BadgeCounter';
import { IconButton } from '../../components/atoms/IconButton/IconButton';
import { Button } from '../../components/atoms/buttons/Button/Button';
import { Paper } from '../../components/atoms/Paper/Paper';
import { Divider } from '../../components/atoms/Divider/Divider';
import { Stepper } from '../../components/molecules/steppers/Stepper/Stepper';
import { Grid } from '../../components/atoms/gridTiles';
import { TextMultiRow } from '../../components/atoms/TextMultiRow';
import { Skeleton } from '../../components/atoms/Skeleton';

const noop = () => {};

interface Test3OpencodeTextT7Props {
  isLoading?: boolean;
  error?: string | null;
  onEdit?: (tileId: string) => void;
  onTransfer?: () => void;
  onDocumentsClick?: () => void;
  onBreadcrumbClick?: (route: string) => void;
}

const workflowSteps = [
  { key: 'draft', title: '\u0427\u0435\u0440\u043D\u043E\u0432\u0438\u043A', active: true, completed: true },
  { key: 'in-progress', title: '\u0412 \u0440\u0430\u0431\u043E\u0442\u0435', active: false, completed: false },
  { key: 'approved', title: '\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043E', active: false, completed: false, disabled: true },
];

function SkeletonLine({ width }: { width?: string }) {
  return <Skeleton variant="text" width={width ?? '100%'} height={20} />;
}

function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} width={i === 0 ? '60%' : '80%'} />
      ))}
    </div>
  );
}

function EditButton({ onClick }: { onClick?: () => void }) {
  return <IconButton name="Edit" size="sm" onClick={onClick ?? noop} title={'\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C'} dataTestId="EditButton" />;
}

function FieldRow({ label, value, isLoading }: { label: string; value: string; isLoading?: boolean }) {
  const theme = useTheme();
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <Text type="BodyXSReg" color={theme.palette.Text.TextSecondary}>
          {label}
        </Text>
      )}
      {isLoading ? (
        <SkeletonLine />
      ) : (
        <Text type="BodyMReg">{value || '\u2014'}</Text>
      )}
    </div>
  );
}

function LoadableTile({
  title,
  actions,
  gridSizes,
  isLoading,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  gridSizes?: Record<string, number>;
  isLoading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Tile gridSizes={gridSizes ?? { xs: 12, lg: 3 }} title={title} actions={actions}>
      {isLoading ? <SkeletonBlock lines={3} /> : children}
    </Tile>
  );
}

function ErrorSection({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        gap: 16,
      }}
    >
      <Text type="H5Reg" color="error">
        {message}
      </Text>
      {onRetry && (
        <Button type="outlined" onClick={onRetry}>
          {'\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C'}
        </Button>
      )}
    </div>
  );
}

export function Test3OpencodeTextT7({
  isLoading = false,
  error = null,
  onEdit,
  onTransfer,
  onDocumentsClick,
  onBreadcrumbClick,
}: Test3OpencodeTextT7Props) {
  const theme = useTheme();

  const editTile = (tileId: string) => () => onEdit?.(tileId);

  const handleBreadcrumbClick = (route: string) => {
    onBreadcrumbClick?.(route);
  };

  if (error) {
    return (
      <main
        data-testid="CorporateRequestPage"
        data-sd-screen-root="true"
        data-sd-mock="true"
        aria-label="test3-opencode-text-T7"
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.palette.BG?.BGPageLinearStart }}
      >
        <Paper sx={{ p: 4, maxWidth: 480, textAlign: 'center' }} elevation={0} dataTestId="CorporateRequestErrorState">
          <ErrorSection message={error} onRetry={() => handleBreadcrumbClick('/corp-requests')} />
        </Paper>
      </main>
    );
  }

  return (
    <main
      data-testid="CorporateRequestPage"
      data-sd-screen-root="true"
      data-sd-mock="true"
      aria-label="test3-opencode-text-T7"
      style={{ minHeight: '100vh', display: 'flex', backgroundColor: theme.palette.BG?.BGPageLinearStart }}
    >
      <Paper
        sx={{
          width: 72,
          minWidth: 72,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 2,
          borderRadius: 0,
        }}
        elevation={0}
        dataTestId="SideNavigation"
      >
        <IconButton name="LeftMenu" size="md" onClick={() => handleBreadcrumbClick('/menu')} dataTestId="SideNavItem_Menu" />
        <div style={{ width: 40, margin: '8px 0' }}>
          <Divider orientation="horizontal" flexItem={false} />
        </div>
        <IconButton name="ARisk" size="md" onClick={() => handleBreadcrumbClick('/risk')} dataTestId="SideNavItem_Risk" />
        <IconButton name="Building02" size="md" onClick={() => handleBreadcrumbClick('/org')} dataTestId="SideNavItem_Org" />
        <div style={{ flex: 1 }} />
        <div style={{ width: 40, margin: '8px 0' }}>
          <Divider orientation="horizontal" flexItem={false} />
        </div>
        <IconButton name="Settings" size="md" onClick={() => handleBreadcrumbClick('/settings')} dataTestId="SideNavItem_Settings" />
      </Paper>

      <div data-testid="CorporateRequestContent" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 32px', gap: 24 }}>
        <BreadCrumbs
          dataTestId="CorporateRequestBreadcrumbs"
          navigationSchema={[
            { name: '\u0413\u043B\u0430\u0432\u043D\u0430\u044F', route: '/' },
            { name: '\u0420\u0435\u0435\u0441\u0442\u0440 \u043A\u043E\u0440\u043F\u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432', route: '/corp-requests' },
            { name: '\u0417\u0430\u043F\u0440\u043E\u0441 1344', route: '' },
          ]}
          onClickLink={handleBreadcrumbClick}
        />

        <div data-testid="CorporateRequestHeader" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isLoading ? (
            <>
              <Skeleton variant="text" width={320} height={32} />
              <Skeleton variant="rectangular" width={100} height={28} />
            </>
          ) : (
            <>
              <Text type="H4StrongSmb">{'\u041A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 1344'}</Text>
              <DictionaryBadge
                component="Chip"
                code="draft"
                name={'\u0427\u0435\u0440\u043D\u043E\u0432\u0438\u043A'}
                variant="filled"
                sx={{
                  backgroundColor: theme.palette.Status?.StGreyLight,
                  color: theme.palette.Text?.TextPrimary,
                }}
              />
            </>
          )}
        </div>

        <div data-testid="CorporateRequestWorkspace" style={{ display: 'flex', gap: 24, flex: 1, alignItems: 'flex-start' }}>
          <div data-testid="CorporateRequestMainArea" style={{ flex: 1 }}>
            {isLoading ? (
              <div style={{ marginBottom: 16 }}><Skeleton variant="text" width={160} height={24} /></div>
            ) : (
              <Text type="H5Reg" sx={{ mb: 2 }} dataTestId="SectionTitle_GeneralInfo">
                {'\u041E\u0431\u0449\u0430\u044F \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F'}
              </Text>
            )}

            <Grid container spacing={3}>
              <LoadableTile
                title={'\u0421\u0434\u0435\u043B\u043A\u0430'}
                gridSizes={{ xs: 12, lg: 3 }}
                actions={!isLoading ? <EditButton onClick={editTile('deal')} /> : undefined}
                isLoading={isLoading}
              >
                <FieldRow label="" value={'1234. \u0421\u0430\u043C\u043E\u043B\u0435\u0442\u0418\u043D\u0432\u0435\u0441\u0442\u041F\u0440\u043E\u0434\u0430\u043A\u0448\u043D'} />
                <FieldRow label={'\u0414\u0435\u0441\u043A'} value="SMB INDUSTRIALS" />
              </LoadableTile>

              <LoadableTile
                title={'\u041A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442'}
                gridSizes={{ xs: 12, lg: 3 }}
                actions={!isLoading ? <EditButton onClick={editTile('counterparty')} /> : undefined}
                isLoading={isLoading}
              >
                <FieldRow label="" value={'\u0421\u0430\u043C\u043E\u043B\u0435\u0442\u0418\u043D\u0432\u0435\u0441\u0442\u0425\u043E\u043B\u0434\u0438\u043D\u0433 inc'} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text type="BodyXSReg" color={theme.palette.Text?.TextSecondary}>{'\u0411\u041A'}</Text>
                  <BadgeCounter counter={26} size="sm" />
                </div>
              </LoadableTile>

              <LoadableTile
                title={'\u0414\u043E\u0433\u043E\u0432\u043E\u0440'}
                gridSizes={{ xs: 12, lg: 6 }}
                actions={!isLoading ? <EditButton onClick={editTile('contract')} /> : undefined}
                isLoading={isLoading}
              >
                <FieldRow
                  label={'\u041A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0434\u043E\u0433\u043E\u0432\u043E\u0440'}
                  value={'2.1.2. \u041A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0434\u043E\u0433\u043E\u0432\u043E\u0440'}
                />
                <FieldRow label={'\u0414\u0430\u0442\u0430 \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u0438\u044F'} value="21.08.2019" />
                <div style={{ marginBottom: 12 }}>
                  <Text type="BodyXSReg" color={theme.palette.Text.TextSecondary}>
                    {'\u041A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442-\u0446\u0435\u043B\u044C'}
                  </Text>
                  <TextMultiRow
                    text={'\u0424\u0435\u0434\u0435\u0440\u0430\u043B\u044C\u043D\u043E\u0435 \u0433\u043E\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0435 \u0443\u043D\u0438\u0442\u0430\u0440\u043D\u043E\u0435 \u043F\u0440\u0435\u0434\u043F\u0440\u0438\u044F\u0442\u0438\u0435 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u043E\u0435 \u0430\u043A\u0446\u0438\u043E\u043D\u0435\u0440\u043D\u043E\u0435 \u043E\u0431\u0449\u0435\u0441\u0442\u0432\u043E \u00AB\u041D\u043E\u0432\u0435\u0439\u0448\u0438\u0435 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u043E-\u0441\u0430\u043C\u043E\u043B\u0435\u0442\u043D\u044B\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u044F...\u00BB'}
                    lineClamp={2}
                    size="md"
                  />
                </div>
              </LoadableTile>

              <LoadableTile
                title={'\u0421\u0443\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441\u0430'}
                gridSizes={{ xs: 12, lg: 6 }}
                actions={!isLoading ? <EditButton onClick={editTile('subject')} /> : undefined}
                isLoading={isLoading}
              >
                <Text type="BodyMReg" sx={{ mb: 2 }}>
                  {'\u0421\u043F\u0440\u0430\u0432\u043A\u0430 \u0434\u043B\u044F \u043D\u043E\u0442\u0430\u0440\u0438\u0443\u0441\u0430 \u0432 \u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u0438 \u043E\u0442\u0447\u0443\u0436\u0434\u0435\u043D\u0438\u044F \u0434\u043E\u043B\u0438 \u0421\u0411\u0418 \u043F\u043E \u043E\u043F\u0446\u0438\u043E\u043D\u0443, \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u0435 \u043E \u043F\u0440\u043E\u0434\u0430\u0436\u0435 \u0434\u043E\u043B\u0438'}
                </Text>
                <div style={{ margin: '16px 0' }}><Divider orientation="horizontal" flexItem={false} /></div>
                <FieldRow
                  label={'\u0422\u0438\u043F \u0437\u0430\u043F\u0440\u043E\u0441\u0430'}
                  value={'\u0424\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B (\u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u0430\u044F \u043E\u0442\u0447\u0435\u0442\u043D\u043E\u0441\u0442\u044C, \u0433\u043E\u0434\u043E\u0432\u043E\u0439 \u043E\u0442\u0447\u0435\u0442, \u0431\u044E\u0434\u0436\u0435\u0442, \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u0438\u0431\u044B\u043B\u0438, \u0430\u0443\u0434\u0438\u0442\u043E\u0440)'}
                />
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    mt: 2,
                    backgroundColor: theme.palette.BG?.BGSecondaryLight,
                  }}
                  elevation={0}
                >
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <FieldRow label={'\u042E\u0440\u0438\u0434\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043E\u0431\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u043F\u0440\u043E\u0441\u0430'} value={'\u041A\u0423'} />
                    </Grid>
                    <Grid item xs={6}>
                      <FieldRow label={'\u041A\u041E \u041A\u043B\u0438\u0435\u043D\u0442\u0430'} value={'\u0421\u0414'} />
                    </Grid>
                    <Grid item xs={6}>
                      <FieldRow label={'\u041A\u041E \u0411\u0430\u043D\u043A\u0430'} value={'\u041E\u0421 \u0414\u0418\u0414'} />
                    </Grid>
                    <Grid item xs={6}>
                      <Text type="BodyXSReg" color={theme.palette.Text?.TextSecondary}>
                        {'\u041F\u0443\u043D\u043A\u0442\u044B \u043C\u0430\u0442\u0440\u0438\u0446\u044B \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u044F \u0440\u0435\u0448\u0435\u043D\u0438\u0439'}
                      </Text>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <DictionaryBadge component="Chip" code="21" name="21" size="sm" />
                        <DictionaryBadge component="Chip" code="11" name="11" size="sm" />
                      </div>
                    </Grid>
                    <Grid item xs={6}>
                      <Text type="BodyXSReg" color={theme.palette.Text?.TextSecondary}>
                        {'\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u0442\u0440\u0443\u0434\u043E\u0437\u0430\u0442\u0440\u0430\u0442\u043D\u043E\u0441\u0442\u0438'}
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        <DictionaryBadge
                          component="Chip"
                          code="K2"
                          name="K2"
                          size="sm"
                          sx={(theme) => ({
                            backgroundColor: theme.palette.Rate?.RLightOrange,
                            color: theme.palette.Product?.POrange,
                            borderColor: theme.palette.Rate?.ROrange,
                          })}
                        />
                      </div>
                    </Grid>
                    <Grid item xs={6}>
                      <FieldRow label={'\u0417\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0420\u041C'} value={'\u041D\u0435 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F'} />
                    </Grid>
                  </Grid>
                </Paper>
              </LoadableTile>

              <LoadableTile
                title={'\u041A\u043E\u043C\u0430\u043D\u0434\u0430'}
                gridSizes={{ xs: 12, lg: 3 }}
                actions={!isLoading ? <EditButton onClick={editTile('team')} /> : undefined}
                isLoading={isLoading}
              >
                <FieldRow label={'\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A \u0426\u0423\u041F'} value={'\u0414\u043E\u0440\u0434\u0430\u0447\u0435\u0432 \u041F.\u0412.'} />
                <FieldRow label={'\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A \u0423\u0421\u0418'} value={'\u0414\u0438\u0431\u0440\u043E\u0432 \u0418.\u0410.'} />
                <FieldRow label={'\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A \u0440\u0438\u0441\u043A\u043E\u0432 (\u0420\u041C)'} value={'\u0414\u0438\u0431\u0440\u043E\u0432 \u0418.\u0410.'} />
                <FieldRow label={'\u041F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u0442'} value={'\u041C\u0430\u043B\u044B\u0433\u0438\u043D \u0415.\u041C., \u0418\u0432\u0430\u043D\u043E\u0432 \u0418.\u0418., \u041A\u043E\u043D\u0441\u0442\u0430\u043D\u0442\u0438\u043D\u043E\u043F\u043E\u043B\u044C\u0441\u043A\u0438\u0439 \u042E.\u042E.'} />
              </LoadableTile>

              <LoadableTile
                title={'\u0421\u0440\u043E\u043A\u0438'}
                gridSizes={{ xs: 12, lg: 3 }}
                actions={!isLoading ? <EditButton onClick={editTile('deadlines')} /> : undefined}
                isLoading={isLoading}
              >
                <FieldRow label={'\u0414\u0430\u0442\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u0430'} value="12.01.2021" />
                <FieldRow label={'\u0414\u0430\u0442\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u0438\u044F'} value={''} />
                <FieldRow label={'\u0420\u0430\u0431\u043E\u0447\u0438\u0445 \u0434\u043D\u0435\u0439 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435'} value="10" />
              </LoadableTile>

              <Grid item xs={12} sx={{ mt: 1, mb: 1 }}>
                {isLoading ? (
                  <Skeleton variant="text" width={200} height={24} />
                ) : (
                  <Text type="H5Reg" dataTestId="SectionTitle_WorkOnRequest">
                    {'\u0420\u0430\u0431\u043E\u0442\u0430 \u043D\u0430\u0434 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u043C'}
                  </Text>
                )}
              </Grid>

              <LoadableTile
                title={'\u041E\u0442\u0432\u0435\u0442 \u043A\u043B\u0438\u0435\u043D\u0442\u0443'}
                gridSizes={{ xs: 12, lg: 6 }}
                actions={!isLoading ? <EditButton onClick={editTile('response')} /> : undefined}
                isLoading={isLoading}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <Button type="outlined" startIcon="FileBasic" onClick={onDocumentsClick ?? noop}>
                    {'\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B'}
                  </Button>
                  <Text type="BodySReg" color={theme.palette.Text?.TextSecondary}>
                    {'\u041D\u0435\u0442 \u043F\u0440\u0438\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043D\u044B\u0445 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u0432'}
                  </Text>
                </div>
              </LoadableTile>
            </Grid>
          </div>

          <Paper
            dataTestId="RequestWorkflowPanel"
            sx={{
              width: 320,
              minWidth: 320,
              display: 'flex',
              flexDirection: 'column',
              alignSelf: 'stretch',
              borderRadius: 2,
            }}
            elevation={0}
          >
            {isLoading ? (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Skeleton variant="text" width={160} height={24} />
                <Divider orientation="horizontal" flexItem={false} />
                <Skeleton variant="rectangular" width="100%" height={48} />
                <Skeleton variant="rectangular" width="100%" height={48} />
                <Skeleton variant="rectangular" width="100%" height={48} />
                <div style={{ flex: 1 }} />
                <Skeleton variant="rectangular" width="100%" height={40} />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px' }}>
                  <Text type="H5Reg">{'\u0420\u0430\u0431\u043E\u0442\u0430 \u043D\u0430\u0434 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u043C'}</Text>
                  <IconButton name="MoreDots" size="sm" onClick={noop} dataTestId="WorkflowPanel_MoreActions" />
                </div>
                <Divider orientation="horizontal" flexItem={false} />

                <div style={{ padding: '24px 24px 16px', flex: 1 }}>
                  <Stepper orientation="vertical" steps={workflowSteps} readonly />
                </div>

                <Divider orientation="horizontal" flexItem={false} />
                <div style={{ padding: '16px 24px' }}>
                  <Button type="accent" fullWidth dataTestId="TransferToWorkButton" onClick={onTransfer ?? noop}>
                    {'\u041F\u0435\u0440\u0435\u0434\u0430\u0442\u044C \u0432 \u0440\u0430\u0431\u043E\u0442\u0443'}
                  </Button>
                </div>
              </>
            )}
          </Paper>
        </div>
      </div>
    </main>
  );
}
