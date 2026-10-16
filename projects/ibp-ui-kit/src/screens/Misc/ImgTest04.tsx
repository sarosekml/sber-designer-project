import React from 'react';
import { Box, Grid, useTheme } from '@mui/material';

import type { IconName } from '@/components/atoms';
import {
  BadgeCounter,
  Button,
  DictionaryBadge,
  Divider,
  Icon,
  IconButton,
  ProgressBar,
  Text,
} from '@/components/atoms';
import { BreadCrumbs, Card } from '@/components/molecules';

const noop = () => undefined;
const EMPTY = '–';

type FieldProps = {
  label: string;
  value?: React.ReactNode;
};

type PanelProps = {
  title: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
  minHeight?: number;
};

type RailItem = {
  icon: IconName;
  active?: boolean;
  counter?: number;
};

const railGroups: RailItem[][] = [
  [{ icon: 'LeftMenu' }, { icon: 'Bank' }],
  [
    { icon: 'Folder' },
    { icon: 'Building' },
    { icon: 'Calendar' },
    { icon: 'DocumentUnread' },
    { icon: 'ListView01' },
    { icon: 'InfoCircle' },
  ],
  [
    { icon: 'DocumentCheck' },
    { icon: 'User', counter: 2 },
    { icon: 'Star' },
    { icon: 'CalendarEdit' },
  ],
  [
    { icon: 'DealsPossibleDeals' },
    { icon: 'Building01' },
    { icon: 'Logout' },
    { icon: 'MessageText' },
  ],
  [
    { icon: 'Building02' },
    { icon: 'Building03' },
    { icon: 'DocumentSigned', counter: 99 },
  ],
  [{ icon: 'Settings' }],
];

function Field({ label, value }: FieldProps) {
  const theme = useTheme();
  const normalizedValue = value === undefined || value === '' || value === null ? EMPTY : value;

  return (
    <Box display={'flex'} flexDirection={'column'} gap={'5px'} minWidth={0}>
      <Text type={'BodyXSReg'} color={theme.palette.Text.TextSecondary}>
        {label}
      </Text>
      {typeof normalizedValue === 'string' || typeof normalizedValue === 'number' ? (
        <Text type={'BodyMReg'} color={theme.palette.Text.TextPrimary}>
          {normalizedValue}
        </Text>
      ) : (
        normalizedValue
      )}
    </Box>
  );
}

function Panel({ title, children, extra, minHeight }: PanelProps) {
  return (
    <Box
      sx={{
        height: '100%',
        '& > .MuiCard-root': {
          height: '100%',
          minHeight,
          borderRadius: '8px',
          border: '1px solid rgba(201, 219, 218, 0.35)',
          boxShadow: 'none',
          backgroundImage: 'none',
        },
        '& .MuiCardHeader-root': {
          px: '24px',
          pt: '22px',
          pb: '10px',
        },
        '& .MuiCardContent-root': {
          px: '24px',
          pt: 0,
          pb: '24px',
        },
      }}
    >
      <Card title={title} extra={extra}>
        {children}
      </Card>
    </Box>
  );
}

function StatusBadge({ text, color }: { text: string; color: string }) {
  return (
    <DictionaryBadge
      component={'Chip'}
      type={'read'}
      variant={'outlined'}
      code={text}
      name={text}
      colorThemeSx={{
        textColor: color,
        borderColor: color,
        backgroundColor: 'transparent',
      }}
    />
  );
}

function Rail() {
  const theme = useTheme();
  const iconColor = theme.palette.Primary.PrimaryDark;

  return (
    <Box
      component={'aside'}
      aria-label={'Навигация'}
      sx={{
        width: 56,
        flex: '0 0 56px',
        minHeight: '100vh',
        backgroundColor: '#ffffff',
        borderRight: '1px solid rgba(208, 226, 225, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: '14px',
        gap: '13px',
      }}
    >
      {railGroups.map((group, groupIndex) => (
        <Box
          key={groupIndex}
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '13px',
            pb: groupIndex === railGroups.length - 1 ? 0 : '13px',
            borderBottom:
              groupIndex === railGroups.length - 1 ? 'none' : '1px solid rgba(208, 226, 225, 0.6)',
          }}
        >
          {group.map((item) => (
            <Box
              key={`${groupIndex}-${item.icon}`}
              sx={{
                position: 'relative',
                width: 32,
                height: 32,
                borderRadius: '8px',
                display: 'grid',
                placeItems: 'center',
                color: iconColor,
                backgroundColor: item.active ? 'rgba(76, 174, 167, 0.12)' : 'transparent',
              }}
            >
              <Icon name={item.icon} size={'sm'} color={iconColor} />
              {item.counter ? (
                <Box sx={{ position: 'absolute', top: -5, right: -8 }}>
                  <BadgeCounter counter={item.counter} size={'sm'} />
                </Box>
              ) : null}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

export function ImgTest04() {
  const theme = useTheme();
  const iconColor = theme.palette.Primary.PrimaryDark;
  const pageBg = theme.palette.BG.BGPageLinearEnd;

  return (
    <Box
      data-sd-screen-root="true"
      aria-label={'img test 04'}
      sx={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: pageBg,
        color: theme.palette.Text.TextPrimary,
      }}
    >
      <Rail />

      <Box
        component={'main'}
        sx={{
          flex: 1,
          minWidth: 0,
          px: { xs: 2, md: '24px' },
          pt: '18px',
          pb: '28px',
        }}
      >
        <BreadCrumbs
          dataTestId={'DealBreadcrumbs'}
          navigationSchema={[
            { name: 'Главная', route: '/' },
            { name: 'M&A Pipeline', route: '/pipeline' },
            { name: '124185. Serg_22-06 от 22.06.2026', route: '' },
          ]}
          onClickLink={noop}
        />

        <Box display={'flex'} justifyContent={'space-between'} alignItems={'flex-start'} mt={'12px'} mb={'16px'}>
          <Box minWidth={0}>
            <Box display={'flex'} alignItems={'center'} gap={'8px'}>
              <Text type={'H3StrongSmb'} color={theme.palette.Text.TextPrimary}>
                124185. Serg_22-06
              </Text>
              <Icon name={'Edit'} size={'sm'} color={iconColor} />
            </Box>
            <Box display={'flex'} alignItems={'center'} gap={'6px'} mt={'4px'}>
              <Icon name={'InfoCircle'} size={'sm'} color={iconColor} />
              <Text type={'BodyXSReg'} color={theme.palette.Text.TextSecondary}>
                Изменено 24.06.2026, 14:43, Обедиентов П.И.
              </Text>
            </Box>
          </Box>
          <IconButton name={'MoreDots'} size={'md'} onClick={noop} dataTestId={'DealMenu'} />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} lg={3}>
            <Panel
              title={'Клиент'}
              minHeight={500}
              extra={<Icon name={'ArrowRight'} size={'sm'} color={iconColor} />}
            >
              <Box display={'flex'} flexDirection={'column'} gap={'18px'}>
                <Field
                  label={'Клиент'}
                  value={
                    <Box display={'flex'} alignItems={'center'} gap={'8px'} minWidth={0}>
                      <Text type={'BodyMReg'} color={theme.palette.Text.TextPrimary}>
                        ООО "ТЕСТОВЫЙ КЛИЕНТ ОНЛАЙНА (НЕ ТРОГАТЬ) - …
                      </Text>
                      <BadgeCounter counter={13} size={'sm'} />
                    </Box>
                  }
                />
                <Field label={'КМ'} />
                <Field label={'Табельный номер'} />
                <Field label={'Название клиента'} />
                <Box display={'flex'} alignItems={'center'} gap={'12px'} pt={'4px'}>
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 18,
                      height: 18,
                      border: '2px solid rgba(132, 189, 185, 0.55)',
                      borderRadius: '2px',
                      backgroundColor: '#ffffff',
                    }}
                  />
                  <Text type={'BodyMReg'} color={theme.palette.Text.TextPrimary}>
                    Использовать как псевдоним
                  </Text>
                </Box>
              </Box>
            </Panel>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Panel
              title={'Общая информация'}
              minHeight={500}
              extra={<Icon name={'Edit'} size={'sm'} color={iconColor} />}
            >
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Field
                    label={'Тип сделки'}
                    value={<StatusBadge text={'sell-side'} color={theme.palette.Info.Info} />}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Field
                    label={'Статус мандата'}
                    value={<StatusBadge text={'Контакта с клиентом не было'} color={theme.palette.Error.Error} />}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Field label={'Срок мандата'} />
                </Grid>
                <Grid item xs={12}>
                  <Field label={'Условия мандата'} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Field label={'Доход текущего года'} value={`${EMPTY} млн руб.`} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Field label={'Индикативный размер сделки'} value={'0 млн руб.'} />
                </Grid>
                <Grid item xs={12} md={4} />
                <Grid item xs={12} md={4}>
                  <Field label={'Ожидаемый доход'} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Field label={'Ожидаемый доход с учетом вероятности'} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Field label={'Ожидаемая дата дохода'} />
                </Grid>
                <Grid item xs={12}>
                  <Field label={'Финансирование'} />
                </Grid>
                <Grid item xs={12}>
                  <Field label={'Описание'} />
                </Grid>
              </Grid>
            </Panel>
          </Grid>

          <Grid item xs={12} lg={3}>
            <Panel
              title={'Стадия'}
              minHeight={500}
              extra={<Icon name={'Edit'} size={'sm'} color={iconColor} />}
            >
              <Box display={'flex'} flexDirection={'column'} gap={'20px'}>
                <Field label={'Стадия'} value={'Продажа M&A услуги клиенту'} />
                <Field
                  label={'Статус'}
                  value={<StatusBadge text={'Активная'} color={theme.palette.Success.Success} />}
                />
                <Box>
                  <ProgressBar value={0} label={'Вероятность сделки: Низкая'} />
                </Box>
                <Field label={'Текущий статус'} />
              </Box>
            </Panel>
          </Grid>
        </Grid>

        <Grid container spacing={2} mt={0}>
          <Grid item xs={12} lg={7}>
            <Panel
              title={'Таргет'}
              minHeight={360}
              extra={<Icon name={'Edit'} size={'sm'} color={iconColor} />}
            >
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Field label={'Компания-цель'} value={'Serg_22-06'} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Field label={'ИНН'} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Field label={'Доля продажи'} value={'100 %'} />
                </Grid>
                <Grid item xs={12}>
                  <Field label={'Описание'} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Field label={'Выручка'} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Field label={'EBITDA'} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Field label={'Чистый долг'} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Field label={'EqV'} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Field label={'Отрасль'} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Field label={'География'} />
                </Grid>
              </Grid>
            </Panel>
          </Grid>

          <Grid item xs={12} lg={2}>
            <Panel
              title={'Совместность'}
              minHeight={360}
              extra={<Icon name={'Maximize'} size={'sm'} color={iconColor} />}
            >
              <Box display={'flex'} flexDirection={'column'} gap={'24px'}>
                <Field label={'Подключённые ТБ'} />
                <Field label={'Подключённые дески'} />
                <Field label={'Участвующие подразделения'} />
              </Box>
            </Panel>
          </Grid>

          <Grid item xs={12} lg={3}>
            <Panel title={'Команда сделки'} minHeight={360}>
              <Button type={'accent'} onClick={noop}>
                Заполнить
              </Button>
            </Panel>
          </Grid>
        </Grid>

        <Box mt={2}>
          <Panel title={'Покупатели'} minHeight={138}>
            <Box display={'flex'} flexWrap={'wrap'} gap={'12px'}>
              <Button type={'accent'} onClick={noop}>
                Связь со сделкой buy-side
              </Button>
              <Button type={'outlined'} onClick={noop}>
                Добавить нового покупателя
              </Button>
            </Box>
          </Panel>
        </Box>

        <Grid container spacing={2} mt={0}>
          <Grid item xs={12} lg={3}>
            <Panel title={'График платежей'} minHeight={220}>
              <Text type={'BodyMReg'} color={theme.palette.Text.TextSecondary}>
                Не заполнено
              </Text>
            </Panel>
          </Grid>

          <Grid item xs={12} lg={4.5}>
            <Panel title={'Документы'} minHeight={220}>
              <Box minHeight={'84px'} />
            </Panel>
          </Grid>

          <Grid item xs={12} lg={4.5}>
            <Panel
              title={'История изменений'}
              minHeight={220}
              extra={<Icon name={'ArrowRight'} size={'sm'} color={iconColor} />}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Field label={'Время изменения'} value={'24.06.2026, 14:43'} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Field label={'Автор изменений'} value={'Обедиентов П.И.'} />
                </Grid>
                <Grid item xs={12}>
                  <Divider orientation={'horizontal'} flexItem color={'light'} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Field label={'Время создания'} value={'22.06.2026, 16:35'} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Field label={'Создатель сделки'} value={'Обедиентов П.И.'} />
                </Grid>
              </Grid>
            </Panel>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
