import React from 'react';
import { Box, Grid, useTheme } from '@mui/material';

import {
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

/** Label-over-value field used across every card on the deal page. */
function Field({ label, value }: FieldProps) {
  const theme = useTheme();

  return (
    <Box display={'flex'} flexDirection={'column'} gap={'4px'}>
      <Text type={'BodyXSReg'} color={theme.palette.Text.TextSecondary}>
        {label}
      </Text>
      {typeof value === 'string' || typeof value === 'number' || value == null ? (
        <Text type={'BodyMReg'} color={theme.palette.Text.TextPrimary}>
          {value === undefined || value === '' || value === null ? EMPTY : value}
        </Text>
      ) : (
        value
      )}
    </Box>
  );
}

/** Compact status pill, colored via the deal's semantic palette. */
function StatusBadge({
  text,
  color,
}: {
  text: string;
  color: string;
}) {
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

export function ImgTest03() {
  const theme = useTheme();

  return (
    <Box
      data-sd-screen-root="true"
      aria-label={'img test 03'}
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.BG?.BGPage ?? '#F2F7F7',
        px: 4,
        py: 3,
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

      {/* Page header */}
      <Box
        display={'flex'}
        alignItems={'flex-start'}
        justifyContent={'space-between'}
        mt={2}
        mb={3}
      >
        <Box>
          <Box display={'flex'} alignItems={'center'} gap={'8px'}>
            <Text type={'H3StrongSmb'} color={theme.palette.Text.TextPrimary}>
              124185. Serg_22-06
            </Text>
            <Icon name={'Edit'} size={'sm'} color={theme.palette.Text.TextSecondary} />
          </Box>
          <Box display={'flex'} alignItems={'center'} gap={'6px'} mt={'4px'}>
            <Icon name={'Edit'} size={'sm'} color={theme.palette.Text.TextSecondary} />
            <Text type={'BodyXSReg'} color={theme.palette.Text.TextSecondary}>
              Изменено 24.06.2026, 14:43, Обедиентов П.И.
            </Text>
          </Box>
        </Box>
        <IconButton name={'MoreDots'} size={'md'} onClick={noop} dataTestId={'DealMenu'} />
      </Box>

      {/* Row 1 — Client / General info / Stage */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Card title={'Клиент'} extra={<Icon name={'ArrowRight'} size={'sm'} color={theme.palette.Text.TextSecondary} />}>
            <Box display={'flex'} flexDirection={'column'} gap={'16px'}>
              <Field
                label={'Клиент'}
                value={
                  <Box display={'flex'} alignItems={'center'} gap={'8px'}>
                    <Text type={'BodyMReg'} color={theme.palette.Text.TextPrimary}>
                      ООО «ТЕСТОВЫЙ КЛИЕНТ ОНЛАЙНА (НЕ ТРОГАТЬ) - …»
                    </Text>
                  </Box>
                }
              />
              <Field label={'КМ'} />
              <Field label={'Табельный номер'} />
              <Field label={'Название клиента'} />
              <Box display={'flex'} alignItems={'center'} gap={'8px'}>
                <input type={'checkbox'} readOnly />
                <Text type={'BodyMReg'} color={theme.palette.Text.TextPrimary}>
                  Использовать как псевдоним
                </Text>
              </Box>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card title={'Общая информация'} extra={<Icon name={'Edit'} size={'sm'} color={theme.palette.Text.TextSecondary} />}>
            <Grid container spacing={3}>
              <Grid item xs={4}>
                <Field
                  label={'Тип сделки'}
                  value={<StatusBadge text={'sell-side'} color={theme.palette.Info.Info} />}
                />
              </Grid>
              <Grid item xs={4}>
                <Field
                  label={'Статус мандата'}
                  value={<StatusBadge text={'Контакта с клиентом не было'} color={theme.palette.Error.Error} />}
                />
              </Grid>
              <Grid item xs={4}>
                <Field label={'Срок мандата'} />
              </Grid>
              <Grid item xs={12}>
                <Field label={'Условия мандата'} />
              </Grid>
              <Grid item xs={4}>
                <Field label={'Доход текущего года'} value={`${EMPTY} млн руб.`} />
              </Grid>
              <Grid item xs={4}>
                <Field label={'Индикативный размер сделки'} value={'0 млн руб.'} />
              </Grid>
              <Grid item xs={4} />
              <Grid item xs={4}>
                <Field label={'Ожидаемый доход'} />
              </Grid>
              <Grid item xs={4}>
                <Field label={'Ожидаемый доход с учетом вероятности'} />
              </Grid>
              <Grid item xs={4}>
                <Field label={'Ожидаемая дата дохода'} />
              </Grid>
              <Grid item xs={12}>
                <Field label={'Финансирование'} />
              </Grid>
              <Grid item xs={12}>
                <Field label={'Описание'} />
              </Grid>
            </Grid>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card title={'Стадия'} extra={<Icon name={'Edit'} size={'sm'} color={theme.palette.Text.TextSecondary} />}>
            <Box display={'flex'} flexDirection={'column'} gap={'16px'}>
              <Field label={'Стадия'} value={'Продажа M&A услуги клиенту'} />
              <Field
                label={'Статус'}
                value={<StatusBadge text={'Активная'} color={theme.palette.Success.Success} />}
              />
              <Box>
                <ProgressBar value={0} label={'0%'} />
                <Text type={'BodyXSReg'} color={theme.palette.Text.TextSecondary}>
                  Вероятность сделки: Низкая
                </Text>
              </Box>
              <Field label={'Текущий статус'} />
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Row 2 — Target / Compatibility / Deal team */}
      <Grid container spacing={2} mt={0}>
        <Grid item xs={12} md={6}>
          <Card title={'Таргет'} extra={<Icon name={'Edit'} size={'sm'} color={theme.palette.Text.TextSecondary} />}>
            <Grid container spacing={3}>
              <Grid item xs={4}>
                <Field label={'Компания-цель'} value={'Serg_22-06'} />
              </Grid>
              <Grid item xs={4}>
                <Field label={'ИНН'} />
              </Grid>
              <Grid item xs={4}>
                <Field label={'Доля продажи'} value={'100 %'} />
              </Grid>
              <Grid item xs={12}>
                <Field label={'Описание'} />
              </Grid>
              <Grid item xs={3}>
                <Field label={'Выручка'} />
              </Grid>
              <Grid item xs={3}>
                <Field label={'EBITDA'} />
              </Grid>
              <Grid item xs={3}>
                <Field label={'Чистый долг'} />
              </Grid>
              <Grid item xs={3}>
                <Field label={'EqV'} />
              </Grid>
              <Grid item xs={6}>
                <Field label={'Отрасль'} />
              </Grid>
              <Grid item xs={6}>
                <Field label={'География'} />
              </Grid>
            </Grid>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card title={'Совместность'} extra={<Icon name={'Maximize'} size={'sm'} color={theme.palette.Text.TextSecondary} />}>
            <Box display={'flex'} flexDirection={'column'} gap={'16px'}>
              <Field label={'Подключённые ТБ'} />
              <Field label={'Подключённые дески'} />
              <Field label={'Участвующие подразделения'} />
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card title={'Команда сделки'}>
            <Button type={'accent'} onClick={noop}>
              Заполнить
            </Button>
          </Card>
        </Grid>
      </Grid>

      {/* Row 3 — Buyers */}
      <Box mt={2}>
        <Card title={'Покупатели'}>
          <Box display={'flex'} gap={'12px'}>
            <Button type={'accent'} onClick={noop}>
              Связь со сделкой buy-side
            </Button>
            <Button type={'outlined'} onClick={noop}>
              Добавить нового покупателя
            </Button>
          </Box>
        </Card>
      </Box>

      {/* Row 4 — Payment schedule / Documents / Change history */}
      <Grid container spacing={2} mt={0}>
        <Grid item xs={12} md={4}>
          <Card title={'График платежей'}>
            <Text type={'BodyMReg'} color={theme.palette.Text.TextSecondary}>
              Не заполнено
            </Text>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card title={'Документы'}>
            <Box minHeight={'80px'} />
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card title={'История изменений'} extra={<Icon name={'ArrowRight'} size={'sm'} color={theme.palette.Text.TextSecondary} />}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Field label={'Время изменения'} value={'24.06.2026, 14:43'} />
              </Grid>
              <Grid item xs={6}>
                <Field label={'Автор изменений'} value={'Обедиентов П.И.'} />
              </Grid>
              <Grid item xs={12}>
                <Divider orientation={'horizontal'} flexItem color={'light'} />
              </Grid>
              <Grid item xs={6}>
                <Field label={'Время создания'} value={'22.06.2026, 16:35'} />
              </Grid>
              <Grid item xs={6}>
                <Field label={'Создатель сделки'} value={'Обедиентов П.И.'} />
              </Grid>
            </Grid>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
