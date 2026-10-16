import React, { useState } from 'react';

import { Button, DictionaryBadge, Grid, Icon, IconButton, SxBox, Text, Title } from '@/components/atoms';
import type { BadgeColorThemeSx, IconName } from '@/components/atoms';
import { BreadCrumbs } from '@/components/molecules';
import { Table } from '@/components/organisms';
import type { ColumnsConfig, RowsConfig } from '@/components/organisms/Tables';
import type { Sx } from '@/utils';

/* -- Types -- */
interface PaymentRow {
  date: string;
  sum: string;
  vat: string;
  sumWithoutVat: string;
  direction: string;
  status: string;
  counterparty: string;
  inn: string;
  purpose: string;
}

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface Payment {
  date: string;
  sum: number;
  vat: number;
  sumWithoutVat: number;
  direction: 'in' | 'out';
  status: 'scheduled' | 'processing' | 'paid' | 'paid-with-note' | 'rejected';
  counterparty: string;
  inn: string;
  purpose: string;
}

interface Totals {
  totalSum: number;
  totalVat: number;
  totalWithoutVat: number;
}

/* -- Mock data -- */
const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'M&A Pipeline', route: '/pipeline' },
  { name: '325. Сделка от 25.04.2024', route: '/deal/325' },
  { name: 'График платежей', route: '' },
];

const payments: Payment[] = [
  {
    date: '15.06.2025',
    sum: 15200000,
    vat: 2533333.33,
    sumWithoutVat: 12666666.67,
    direction: 'out',
    status: 'scheduled',
    counterparty: 'ООО "Ромашка"',
    inn: '7701234567',
    purpose: 'Услуги организатора по Соглашению №456321',
  },
  {
    date: '20.06.2025',
    sum: 12800000,
    vat: 2133333.33,
    sumWithoutVat: 10666666.67,
    direction: 'in',
    status: 'processing',
    counterparty: 'ПАО "Газпром"',
    inn: '7736050003',
    purpose: 'Поступление средств по договору займа №789',
  },
  {
    date: '15.07.2025',
    sum: 8500000,
    vat: 1416666.67,
    sumWithoutVat: 7083333.33,
    direction: 'out',
    status: 'paid',
    counterparty: 'ООО "Ромашка"',
    inn: '7701234567',
    purpose: 'Оплата консультационных услуг по сделке',
  },
  {
    date: '01.08.2025',
    sum: 3200000,
    vat: 533333.33,
    sumWithoutVat: 2666666.67,
    direction: 'in',
    status: 'paid-with-note',
    counterparty: 'АО "Альфа-Банк"',
    inn: '7702567543',
    purpose: 'Частичное досрочное погашение задолженности',
  },
  {
    date: '10.08.2025',
    sum: 5600000,
    vat: 933333.33,
    sumWithoutVat: 4666666.67,
    direction: 'out',
    status: 'rejected',
    counterparty: 'ООО "СтройИнвест"',
    inn: '7709123456',
    purpose: 'Оплата строительно-монтажных работ по объекту',
  },
  {
    date: '01.09.2025',
    sum: 9500000,
    vat: 1583333.33,
    sumWithoutVat: 7916666.67,
    direction: 'in',
    status: 'scheduled',
    counterparty: 'ООО "ТехноПром"',
    inn: '7712345678',
    purpose: 'Поступление по договору лизинга оборудования',
  },
];

/* -- Helpers -- */
const statusMeta: Record<Payment['status'], { label: string; tone: Tone }> = {
  'scheduled': { label: 'Ожидаемый', tone: 'warning' },
  'processing': { label: 'В обработке', tone: 'info' },
  'paid': { label: 'Оплачен', tone: 'success' },
  'paid-with-note': { label: 'Оплачен с замечанием', tone: 'success' },
  'rejected': { label: 'Отклонён', tone: 'error' },
};

const directionMeta: Record<Payment['direction'], { icon: IconName; label: string; iconSx: Sx; textSx: Sx }> = {
  in: {
    icon: 'ArrowNarrowDownLeft',
    label: 'Входящий',
    iconSx: (muiTheme) => ({ color: muiTheme.palette.Success.Success, fontSize: 16 }),
    textSx: (muiTheme) => ({ color: muiTheme.palette.Success.Success }),
  },
  out: {
    icon: 'ArrowNarrowUpRight',
    label: 'Исходящий',
    iconSx: (muiTheme) => ({ color: muiTheme.palette.Error.Error, fontSize: 16 }),
    textSx: (muiTheme) => ({ color: muiTheme.palette.Error.Error }),
  },
};

const badgeColor: Record<Tone, BadgeColorThemeSx> = {
  success: (muiTheme) => ({
    backgroundColor: muiTheme.palette.Success.SuccessBG,
    borderColor: muiTheme.palette.Success.Success,
    textColor: muiTheme.palette.Success.SuccessDark,
  }),
  warning: (muiTheme) => ({
    backgroundColor: muiTheme.palette.Warning.WarningBG,
    borderColor: muiTheme.palette.Warning.Warning,
    textColor: muiTheme.palette.Warning.WarningDark,
  }),
  error: (muiTheme) => ({
    backgroundColor: muiTheme.palette.Error.ErrorBG,
    borderColor: muiTheme.palette.Error.Error,
    textColor: muiTheme.palette.Error.ErrorDark,
  }),
  info: (muiTheme) => ({
    backgroundColor: muiTheme.palette.Info.InfoBG,
    borderColor: muiTheme.palette.Info.Info,
    textColor: muiTheme.palette.Info.InfoDark,
  }),
  neutral: (muiTheme) => ({
    backgroundColor: muiTheme.palette.Disabled.DisabledBG,
    borderColor: muiTheme.palette.Border.BorderPrimary,
    textColor: muiTheme.palette.Text.TextSecondary,
  }),
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('ru-RU', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatCompact = (value: number): string => `${(value / 1_000_000).toFixed(2)} млн руб`;

const calculateTotals = (items: Payment[]): Totals =>
  items.reduce(
    (acc, payment) => ({
      totalSum: acc.totalSum + payment.sum,
      totalVat: acc.totalVat + payment.vat,
      totalWithoutVat: acc.totalWithoutVat + payment.sumWithoutVat,
    }),
    { totalSum: 0, totalVat: 0, totalWithoutVat: 0 },
  );

const totals = calculateTotals(payments);

/* -- Table helpers -- */
function DirectionCell({ direction }: { direction: Payment['direction'] }) {
  const meta = directionMeta[direction];
  return (
    <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
      <Icon name={meta.icon} size="sm" sx={meta.iconSx} />
      <Text type="BodyXSReg" sx={meta.textSx}>
        {meta.label}
      </Text>
    </Grid>
  );
}

function StatusCell({ status }: { status: Payment['status'] }) {
  const meta = statusMeta[status];
  return (
    <DictionaryBadge
      code={status}
      name={meta.label}
      component="Chip"
      dataTestId={`PaymentStatus-${status}`}
      hoverable={false}
      size="sm"
      type="read"
      variant="outlined"
      colorThemeSx={badgeColor[meta.tone]}
    />
  );
}

const tableColumns: ColumnsConfig<PaymentRow> = [
  { name: 'date', title: 'Дата', width: 110 },
  { name: 'sum', title: 'Сумма, руб.', align: 'right', width: 150 },
  { name: 'vat', title: 'НДС, руб.', align: 'right', width: 140 },
  { name: 'sumWithoutVat', title: 'Сумма без НДС, руб.', align: 'right', width: 170 },
  { name: 'direction', title: 'Направление', width: 130 },
  { name: 'status', title: 'Статус', width: 170 },
  { name: 'counterparty', title: 'Платёжный контрагент', width: 200, wordWrapEnabled: true },
  { name: 'inn', title: 'ИНН плательщика', width: 140 },
  { name: 'purpose', title: 'Назначение платежа', width: 280, wordWrapEnabled: true },
];

const paymentRows: RowsConfig<PaymentRow> = payments.map((payment) => {
  const rowData: PaymentRow = {
    date: payment.date,
    sum: formatCurrency(payment.sum),
    vat: formatCurrency(payment.vat),
    sumWithoutVat: formatCurrency(payment.sumWithoutVat),
    direction: directionMeta[payment.direction].label,
    status: statusMeta[payment.status].label,
    counterparty: payment.counterparty,
    inn: payment.inn,
    purpose: payment.purpose,
  };

  return {
    data: rowData,
    cells: {
      date: rowData.date,
      sum: rowData.sum,
      vat: rowData.vat,
      sumWithoutVat: rowData.sumWithoutVat,
      direction: {
        data: rowData.direction,
        render: () => <DirectionCell direction={payment.direction} />,
        exportRender: () => rowData.direction,
      },
      status: {
        data: rowData.status,
        render: () => <StatusCell status={payment.status} />,
        exportRender: () => rowData.status,
      },
      counterparty: rowData.counterparty,
      inn: rowData.inn,
      purpose: {
        data: rowData.purpose,
        render: () => (
          <Text
            type="BodyXSReg"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {rowData.purpose}
          </Text>
        ),
        exportRender: () => rowData.purpose,
      },
    },
  };
});

/* -- Styles -- */
const pageSx: Sx = (muiTheme) => ({
  minHeight: '100vh',
  backgroundColor: muiTheme.palette.BG?.BGPageLinearStart ?? muiTheme.palette.background?.default,
  px: { xs: 2, md: 3 },
  py: 3,
});

const topBarSx: Sx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  mb: 2,
};

const actionBarSx: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  mb: 2,
};

const footerSx: Sx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  mt: 2,
  pt: 2,
  borderTop: '1px solid',
  borderColor: 'Border.BorderPrimary',
};

const totalsSx: Sx = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
};

/* -- Main component -- */
export function PaymentsTest02() {
  const [pageSize] = useState(50);

  return (
    <main data-sd-screen-root="true" aria-label="Payment Schedule" style={{ minHeight: '100vh' }}>
      <SxBox sx={pageSx}>
        <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} />

        <SxBox sx={topBarSx}>
          <Title type="title">График платежей</Title>
          <Grid container alignItems="center" gap={1} flexWrap="nowrap">
            <Button type="outlined" dataTestId="go-to-deal">
              В сделку
            </Button>
            <Button type="outlined" dataTestId="reconciliation-data">
              Данные для акта сверки
            </Button>
            <Button type="accent" dataTestId="add-payment" startIcon="Add">
              Добавить платёж
            </Button>
          </Grid>
        </SxBox>

        <SxBox sx={actionBarSx}>
          <Button type="outlined" dataTestId="filter-button" startIcon="Filter">
            Фильтр
          </Button>
        </SxBox>

        <SxBox sx={{ overflowX: 'auto' }}>
          <SxBox sx={{ minWidth: 1000 }}>
            <Table<PaymentRow, object>
              columns={tableColumns}
              dataTestId="PaymentScheduleTable"
              isBordered
              rows={paymentRows}
              tableConfig={{ hasStickyHeader: true }}
            />
          </SxBox>
        </SxBox>

        <SxBox sx={footerSx}>
          <SxBox sx={totalsSx}>
            <Text type="BodySReg">
              <Text type="BodySReg" sx={{ fontWeight: 600 }}>
                Сумма:
              </Text>{' '}
              {formatCompact(totals.totalSum)}
            </Text>
            <Text type="BodySReg">
              <Text type="BodySReg" sx={{ fontWeight: 600 }}>
                НДС:
              </Text>{' '}
              {formatCompact(totals.totalVat)}
            </Text>
            <Text type="BodySReg">
              <Text type="BodySReg" sx={{ fontWeight: 600 }}>
                Сумма без НДС:
              </Text>{' '}
              {formatCompact(totals.totalWithoutVat)}
            </Text>
          </SxBox>

          <Grid container alignItems="center" gap={1.5} flexWrap="nowrap">
            <Text type="BodyXSReg">Показывать строк: {pageSize}</Text>
            <Text type="BodyXSReg">
              1–{payments.length} из {payments.length}
            </Text>
            <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
              <IconButton name="ArrowBlockLeft" size="sm" aria-label="Предыдущая" title="Предыдущая" disabled />
              <IconButton name="ArrowBlockRight" size="sm" aria-label="Следующая" title="Следующая" />
            </Grid>
          </Grid>
        </SxBox>
      </SxBox>
    </main>
  );
}
