import React, { useState } from 'react';

import {
  BadgeCounter,
  Button,
  DictionaryBadge,
  Grid,
  Icon,
  IconButton,
  Paper,
  Skeleton,
  Text,
  Tooltip,
  Page,
} from '@/components/atoms';
import type { BadgeColorThemeSx, IconName } from '@/components/atoms';
import { BreadCrumbs } from '@/components/molecules';
import { Table } from '@/components/organisms';
import type { ColumnsConfig, RowsConfig } from '@/components/organisms/Tables';
import type { Sx } from '@/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ScreenState = 'loading' | 'error' | 'empty' | 'ready';
type Direction = 'in' | 'out';
type PayStatus = 'scheduled' | 'processing' | 'paid' | 'paid-with-note' | 'rejected';
type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface Payment {
  id: string;
  date: string;
  sum: number;
  vat: number;
  sumWithoutVat: number;
  direction: Direction;
  status: PayStatus;
  counterparty: string;
  inn: string;
  purpose: string;
}

interface Totals {
  sum: number;
  vat: number;
  sumWithoutVat: number;
}

/* ------------------------------------------------------------------ */
/*  Mock data — deal context & payments                                */
/* ------------------------------------------------------------------ */

const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'M&A Pipeline', route: '/pipeline' },
  { name: '325. Сделка от 25.04.2024', route: '/deal/325' },
  { name: 'График платежей', route: '' },
];

const mockPayments: Payment[] = [
  {
    id: 'pmt-001',
    date: '15.06.2025',
    sum: 15_200_000,
    vat: 2_533_333.33,
    sumWithoutVat: 12_666_666.67,
    direction: 'out',
    status: 'scheduled',
    counterparty: 'ООО "Ромашка"',
    inn: '7701234567',
    purpose: 'Услуги организатора по Соглашению №456321 от 12.03.2025',
  },
  {
    id: 'pmt-002',
    date: '20.06.2025',
    sum: 12_800_000,
    vat: 2_133_333.33,
    sumWithoutVat: 10_666_666.67,
    direction: 'in',
    status: 'processing',
    counterparty: 'ПАО "Газпром"',
    inn: '7736050003',
    purpose: 'Поступление средств по договору займа №789-ДЗ/2025',
  },
  {
    id: 'pmt-003',
    date: '15.07.2025',
    sum: 8_500_000,
    vat: 1_416_666.67,
    sumWithoutVat: 7_083_333.33,
    direction: 'out',
    status: 'paid',
    counterparty: 'ООО "Ромашка"',
    inn: '7701234567',
    purpose: 'Оплата консультационных услуг по сделке M&A',
  },
  {
    id: 'pmt-004',
    date: '01.08.2025',
    sum: 3_200_000,
    vat: 533_333.33,
    sumWithoutVat: 2_666_666.67,
    direction: 'in',
    status: 'paid-with-note',
    counterparty: 'АО "Альфа-Банк"',
    inn: '7702567543',
    purpose: 'Частичное досрочное погашение задолженности по кредитной линии',
  },
  {
    id: 'pmt-005',
    date: '10.08.2025',
    sum: 5_600_000,
    vat: 933_333.33,
    sumWithoutVat: 4_666_666.67,
    direction: 'out',
    status: 'rejected',
    counterparty: 'ООО "СтройИнвест"',
    inn: '7709123456',
    purpose: 'Оплата строительно-монтажных работ по объекту Северный-2',
  },
  {
    id: 'pmt-006',
    date: '01.09.2025',
    sum: 9_500_000,
    vat: 1_583_333.33,
    sumWithoutVat: 7_916_666.67,
    direction: 'in',
    status: 'scheduled',
    counterparty: 'ООО "ТехноПром"',
    inn: '7712345678',
    purpose: 'Поступление по договору лизинга оборудования SMB-200',
  },
  {
    id: 'pmt-007',
    date: '15.09.2025',
    sum: 22_100_000,
    vat: 3_683_333.33,
    sumWithoutVat: 18_416_666.67,
    direction: 'out',
    status: 'processing',
    counterparty: 'ООО "Юридическое бюро"',
    inn: '7734567890',
    purpose: 'Юридическое сопровождение сделки по соглашению №789012-ЮР',
  },
  {
    id: 'pmt-008',
    date: '01.10.2025',
    sum: 4_800_000,
    vat: 800_000,
    sumWithoutVat: 4_000_000,
    direction: 'in',
    status: 'paid',
    counterparty: 'АО "ФинансГрупп"',
    inn: '7719876543',
    purpose: 'Возврат излишне уплаченных процентов по договору займа',
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers — format, totals, meta                                    */
/* ------------------------------------------------------------------ */

function formatCurrency(value: number): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMillions(value: number): string {
  return `${(value / 1_000_000).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} млн руб.`;
}

function computeTotals(items: Payment[]): Totals {
  return items.reduce(
    (acc, p) => ({
      sum: acc.sum + p.sum,
      vat: acc.vat + p.vat,
      sumWithoutVat: acc.sumWithoutVat + p.sumWithoutVat,
    }),
    { sum: 0, vat: 0, sumWithoutVat: 0 },
  );
}

const directionMeta: Record<Direction, { icon: IconName; label: string }> = {
  in: { icon: 'ArrowNarrowDownLeft', label: 'Входящий' },
  out: { icon: 'ArrowNarrowUpRight', label: 'Исходящий' },
};

const statusMeta: Record<PayStatus, { label: string; tone: Tone }> = {
  scheduled: { label: 'Ожидаемый', tone: 'warning' },
  processing: { label: 'В обработке', tone: 'info' },
  paid: { label: 'Оплачен', tone: 'success' },
  'paid-with-note': { label: 'Оплачен с замечанием', tone: 'success' },
  rejected: { label: 'Отклонён', tone: 'error' },
};

const badgeColorTheme: Record<Tone, BadgeColorThemeSx> = {
  success: (t) => ({
    backgroundColor: t.palette.Success.SuccessBG,
    borderColor: t.palette.Success.Success,
    textColor: t.palette.Success.SuccessDark,
  }),
  warning: (t) => ({
    backgroundColor: t.palette.Warning.WarningBG,
    borderColor: t.palette.Warning.Warning,
    textColor: t.palette.Warning.WarningDark,
  }),
  error: (t) => ({
    backgroundColor: t.palette.Error.ErrorBG,
    borderColor: t.palette.Error.Error,
    textColor: t.palette.Error.ErrorDark,
  }),
  info: (t) => ({
    backgroundColor: t.palette.Info.InfoBG,
    borderColor: t.palette.Info.Info,
    textColor: t.palette.Info.InfoDark,
  }),
  neutral: (t) => ({
    backgroundColor: t.palette.Disabled.DisabledBG,
    borderColor: t.palette.Border.BorderPrimary,
    textColor: t.palette.Text.TextSecondary,
  }),
};

/* ------------------------------------------------------------------ */
/*  Custom cell renderers                                              */
/* ------------------------------------------------------------------ */

function DirectionCell({ direction }: { direction: Direction }) {
  const meta = directionMeta[direction];
  const isIncoming = direction === 'in';
  return (
    <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
      <Icon
        name={meta.icon}
        size="sm"
        sx={(t) => ({
          color: isIncoming ? t.palette.Success.Success : t.palette.Error.Error,
          fontSize: 16,
        })}
      />
      <Text
        type="BodyXSReg"
        sx={(t) => ({
          color: isIncoming ? t.palette.Success.Success : t.palette.Error.Error,
        })}
      >
        {meta.label}
      </Text>
    </Grid>
  );
}

function StatusCell({ status }: { status: PayStatus }) {
  const meta = statusMeta[status];
  return (
    <DictionaryBadge
      code={status}
      name={meta.label}
      component="Chip"
      dataTestId={`status-${status}`}
      hoverable={false}
      size="sm"
      type="read"
      variant="outlined"
      colorThemeSx={badgeColorTheme[meta.tone]}
    />
  );
}

function PurposeCell({ text }: { text: string }) {
  return (
    <Tooltip title={text}>
      <Text
        type="BodyXSReg"
        sx={{
          maxWidth: 260,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
        }}
      >
        {text}
      </Text>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/*  Table column configuration                                        */
/* ------------------------------------------------------------------ */

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

const columns: ColumnsConfig<PaymentRow> = [
  { name: 'date', title: 'Дата', sortingEnabled: true, width: 100 },
  { name: 'sum', title: 'Сумма, руб.', sortingEnabled: true, align: 'right', width: 145 },
  { name: 'vat', title: 'НДС, руб.', sortingEnabled: true, align: 'right', width: 135 },
  { name: 'sumWithoutVat', title: 'Сумма без НДС, руб.', sortingEnabled: true, align: 'right', width: 170 },
  { name: 'direction', title: 'Направление', sortingEnabled: true, width: 125 },
  { name: 'status', title: 'Статус', sortingEnabled: true, width: 165 },
  { name: 'counterparty', title: 'Платёжный контрагент', sortingEnabled: true, width: 200, wordWrapEnabled: true },
  { name: 'inn', title: 'ИНН плательщика', sortingEnabled: true, width: 140 },
  { name: 'purpose', title: 'Назначение платежа', sortingEnabled: true, width: 280, wordWrapEnabled: true },
];

function buildRows(payments: Payment[]): RowsConfig<PaymentRow> {
  return payments.map((payment) => {
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
          render: () => <PurposeCell text={payment.purpose} />,
          exportRender: () => rowData.purpose,
        },
      },
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Page styles                                                        */
/* ------------------------------------------------------------------ */

const pageBgSx: Sx = (t) => ({
  backgroundColor: t.palette.BG?.BGPageLinearStart ?? t.palette.background?.default,
});

/* ------------------------------------------------------------------ */
/*  State sub-components                                               */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <main data-sd-screen-root="true" aria-label="График платежей" style={{ minHeight: '100vh' }}>
      <Page sx={pageBgSx} dataTestId="PaymentSchedulePage">
        <Grid sx={{ mb: 2 }}>
          <Skeleton variant="text" width={320} height={20} />
        </Grid>
        <Grid container alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Grid container alignItems="center" gap={2}>
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="circular" width={28} height={28} />
          </Grid>
          <Grid container gap={1}>
            <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" width={180} height={36} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" width={150} height={36} sx={{ borderRadius: 1 }} />
          </Grid>
        </Grid>
        <Skeleton variant="rectangular" width={160} height={36} sx={{ borderRadius: 1, mb: 2 }} />
        <Paper sx={{ mb: 2, p: 0 }}>
          <Skeleton variant="rectangular" width="100%" height={400} />
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Skeleton variant="rectangular" width="100%" height={40} />
        </Paper>
      </Page>
    </main>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <main
      data-sd-screen-root="true"
      aria-label="График платежей"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
    >
      <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 480 }}>
        <Icon name="AlertCircle" size="lg" sx={{ color: '#EF4444', fontSize: 48, mb: 2 }} />
        <Text type="H4StrongSmb" sx={{ mb: 1 }}>
          Ошибка загрузки
        </Text>
        <Text type="BodyMReg" color="text.secondary" sx={{ mb: 3 }}>
          Не удалось загрузить реестр платежей. Проверьте соединение и повторите попытку.
        </Text>
        <Button type="accent" onClick={onRetry}>
          Повторить
        </Button>
      </Paper>
    </main>
  );
}

function EmptyState() {
  return (
    <main data-sd-screen-root="true" aria-label="График платежей" style={{ minHeight: '100vh' }}>
      <Page sx={pageBgSx} dataTestId="PaymentSchedulePage">
        <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} dataTestId="empty-breadcrumbs" />
        <Grid container alignItems="center" justifyContent="space-between" sx={{ mt: 2, mb: 1 }}>
          <Grid container alignItems="center" gap={2}>
            <Text type="H3StrongSmb">График платежей</Text>
            <BadgeCounter counter={0} size="sm" />
          </Grid>
          <Grid container gap={1}>
            <Button type="outlined" size="sm" startIcon="ArrowNarrowLeft">
              В сделку
            </Button>
            <Button type="accent" size="sm" startIcon="Add">
              Добавить платёж
            </Button>
          </Grid>
        </Grid>
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Icon name="Folder" size="lg" sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Text type="H4StrongSmb" sx={{ mb: 1 }}>
            Нет платежей
          </Text>
          <Text type="BodyMReg" color="text.secondary">
            По данной сделке ещё не добавлено ни одного платежа.
          </Text>
        </Paper>
      </Page>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen component                                              */
/* ------------------------------------------------------------------ */

export function PeymentsTest05() {
  const [screenState] = useState<ScreenState>('ready');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const totalPages = Math.ceil(mockPayments.length / pageSize);

  /* ── Guard: loading ── */
  if (screenState === 'loading') return <LoadingState />;

  /* ── Guard: error ── */
  if (screenState === 'error') {
    return <ErrorState onRetry={() => window.location.reload()} />;
  }

  /* ── Guard: empty ── */
  if (screenState === 'empty') return <EmptyState />;

  /* ── Ready ── */
  const payments = mockPayments;
  const totals = computeTotals(payments);
  const rows = buildRows(payments);

  return (
    <main data-sd-screen-root="true" aria-label="График платежей" style={{ minHeight: '100vh' }}>
      <Page sx={pageBgSx} dataTestId="PaymentSchedulePage">
        {/* Breadcrumbs */}
        <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} dataTestId="Breadcrumbs" />

        {/* Header: title + badge + actions */}
        <Grid container alignItems="center" justifyContent="space-between" sx={{ mt: 2, mb: 1 }}>
          <Grid container alignItems="center" gap={2}>
            <Text type="H3StrongSmb">График платежей</Text>
            <BadgeCounter counter={payments.length} size="sm" />
          </Grid>
          <Grid container alignItems="center" gap={1}>
            <Button type="outlined" size="sm" dataTestId="go-to-deal">
              <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
                <Icon name="ArrowNarrowLeft" size="sm" sx={{ fontSize: 14 }} />
                <span>В сделку</span>
              </Grid>
            </Button>
            <Button type="outlined" size="sm" dataTestId="reconciliation-data">
              Данные для акта сверки
            </Button>
            <Button type="accent" size="sm" dataTestId="add-payment" startIcon="Add">
              Добавить платёж
            </Button>
          </Grid>
        </Grid>

        {/* Filter */}
        <Button type="outlined" size="sm" startIcon="Filter" dataTestId="filter-button" sx={{ mb: 2 }}>
          Фильтр
        </Button>

        {/* Table card */}
        <Paper sx={{ mb: 1 }}>
          <Table<PaymentRow, object>
            columns={columns}
            dataTestId="PaymentScheduleTable"
            isBordered
            rows={rows}
            tableConfig={{ hasStickyHeader: true }}
          />
        </Paper>

        {/* Footer: totals + pagination */}
        <Paper sx={{ px: 3, py: 1.75 }}>
          <Grid container alignItems="center" justifyContent="space-between">
            {/* Totals */}
            <Grid container alignItems="center" gap={4} flexWrap="nowrap">
              <Grid container alignItems="baseline" gap={0.75} flexWrap="nowrap">
                <Text type="BodyXSReg" color="text.secondary">
                  Сумма:
                </Text>
                <Text type="BodySReg" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatMillions(totals.sum)}
                </Text>
              </Grid>
              <Grid container alignItems="baseline" gap={0.75} flexWrap="nowrap">
                <Text type="BodyXSReg" color="text.secondary">
                  НДС:
                </Text>
                <Text type="BodySReg" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatMillions(totals.vat)}
                </Text>
              </Grid>
              <Grid container alignItems="baseline" gap={0.75} flexWrap="nowrap">
                <Text type="BodyXSReg" color="text.secondary">
                  Сумма без НДС:
                </Text>
                <Text type="BodySReg" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatMillions(totals.sumWithoutVat)}
                </Text>
              </Grid>
            </Grid>

            {/* Pagination */}
            <Grid container alignItems="center" gap={1.5} flexWrap="nowrap">
              <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
                <Text type="BodyXSReg" color="text.secondary">
                  Показывать строк:
                </Text>
                <Text
                  type="BodyXSReg"
                  sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {pageSize}
                </Text>
              </Grid>
              <Text type="BodyXSReg" color="text.secondary">
                1–{Math.min(pageSize, payments.length)} из {payments.length}
              </Text>
              <IconButton
                name="ChevronLeft"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                title="Предыдущая страница"
              />
              <Text type="BodyXSReg">
                {page} из {totalPages}
              </Text>
              <IconButton
                name="ChevronRight"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                title="Следующая страница"
              />
            </Grid>
          </Grid>
        </Paper>
      </Page>
    </main>
  );
}
