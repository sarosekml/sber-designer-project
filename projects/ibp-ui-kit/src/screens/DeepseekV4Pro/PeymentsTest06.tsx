import React, { useState } from 'react';

import {
  BadgeCounter,
  Button,
  DictionaryBadge,
  Grid,
  Icon,
  IconButton,
  Paper,
  Page,
  Skeleton,
  Text,
  Tooltip,
} from '@/components/atoms';
import type { BadgeColorThemeSx, IconName } from '@/components/atoms';
import { BreadCrumbs } from '@/components/molecules';
import { Table } from '@/components/organisms';
import type { ColumnsConfig, RowsConfig } from '@/components/organisms/Tables';

/* ------------------------------------------------------------------ */
/*  Types / mock data                                                 */
/* ------------------------------------------------------------------ */

type Direction = 'in' | 'out';
type PayStatus = 'scheduled' | 'processing' | 'paid' | 'paid-with-note' | 'rejected';
type Tone = 'success' | 'warning' | 'error' | 'info';

interface Payment {
  id: string; date: string; sum: number; vat: number; sumWithoutVat: number;
  direction: Direction; status: PayStatus; counterparty: string; inn: string; purpose: string;
}

const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'M&A Pipeline', route: '/pipeline' },
  { name: '325. Сделка от 25.04.2024', route: '/deal/325' },
  { name: 'График платежей', route: '' },
];

const mockPayments: Payment[] = [
  { id: 'pmt-001', date: '15.06.2025', sum: 15200000, vat: 2533333.33, sumWithoutVat: 12666666.67, direction: 'out', status: 'scheduled', counterparty: 'ООО «Ромашка»', inn: '7701234567', purpose: 'Услуги организатора по Соглашению №456321 от 12.03.2025' },
  { id: 'pmt-002', date: '20.06.2025', sum: 12800000, vat: 2133333.33, sumWithoutVat: 10666666.67, direction: 'in', status: 'processing', counterparty: 'ПАО «Газпром»', inn: '7736050003', purpose: 'Поступление средств по договору займа №789-ДЗ/2025' },
  { id: 'pmt-003', date: '15.07.2025', sum: 8500000, vat: 1416666.67, sumWithoutVat: 7083333.33, direction: 'out', status: 'paid', counterparty: 'ООО «Ромашка»', inn: '7701234567', purpose: 'Оплата консультационных услуг по сделке M&A' },
  { id: 'pmt-004', date: '01.08.2025', sum: 3200000, vat: 533333.33, sumWithoutVat: 2666666.67, direction: 'in', status: 'paid-with-note', counterparty: 'АО «Альфа-Банк»', inn: '7702567543', purpose: 'Частичное досрочное погашение задолженности по кредитной линии' },
  { id: 'pmt-005', date: '10.08.2025', sum: 5600000, vat: 933333.33, sumWithoutVat: 4666666.67, direction: 'out', status: 'rejected', counterparty: 'ООО «СтройИнвест»', inn: '7709123456', purpose: 'Оплата строительно-монтажных работ по объекту Северный-2' },
  { id: 'pmt-006', date: '01.09.2025', sum: 9500000, vat: 1583333.33, sumWithoutVat: 7916666.67, direction: 'in', status: 'scheduled', counterparty: 'ООО «ТехноПром»', inn: '7712345678', purpose: 'Поступление по договору лизинга оборудования SMB-200' },
  { id: 'pmt-007', date: '15.09.2025', sum: 22100000, vat: 3683333.33, sumWithoutVat: 18416666.67, direction: 'out', status: 'processing', counterparty: 'ООО «Юридическое бюро»', inn: '7734567890', purpose: 'Юридическое сопровождение сделки по соглашению №789012-ЮР' },
  { id: 'pmt-008', date: '01.10.2025', sum: 4800000, vat: 800000, sumWithoutVat: 4000000, direction: 'in', status: 'paid', counterparty: 'АО «ФинансГрупп»', inn: '7719876543', purpose: 'Возврат излишне уплаченных процентов по договору займа' },
];

/* ------------------------------------------------------------------ */
/*  Meta / formatters                                                 */
/* ------------------------------------------------------------------ */

function fmtCurrency(v: number) { return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtMillion(v: number) { return `${(v / 1_000_000).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} млн руб.`; }

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

const toneColors: Record<Tone, BadgeColorThemeSx> = {
  success: (t) => ({ backgroundColor: t.palette.Success.SuccessBG, borderColor: t.palette.Success.Success, textColor: t.palette.Success.SuccessDark }),
  warning: (t) => ({ backgroundColor: t.palette.Warning.WarningBG, borderColor: t.palette.Warning.Warning, textColor: t.palette.Warning.WarningDark }),
  error: (t) => ({ backgroundColor: t.palette.Error.ErrorBG, borderColor: t.palette.Error.Error, textColor: t.palette.Error.ErrorDark }),
  info: (t) => ({ backgroundColor: t.palette.Info.InfoBG, borderColor: t.palette.Info.Info, textColor: t.palette.Info.InfoDark }),
};

/* ------------------------------------------------------------------ */
/*  Cell renderers                                                    */
/* ------------------------------------------------------------------ */

function DirectionCell({ direction }: { direction: Direction }) {
  const m = directionMeta[direction];
  return (
    <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
      <Icon name={m.icon} size="sm" sx={(t) => ({ color: direction === 'in' ? t.palette.Success.Success : t.palette.Error.Error, fontSize: 16 })} />
      <Text type="BodyXSReg" sx={(t) => ({ color: direction === 'in' ? t.palette.Success.Success : t.palette.Error.Error })}>{m.label}</Text>
    </Grid>
  );
}

function StatusCell({ status }: { status: PayStatus }) {
  const m = statusMeta[status];
  return <DictionaryBadge code={status} name={m.label} component="Chip" size="sm" type="read" variant="outlined" colorThemeSx={toneColors[m.tone]} hoverable={false} dataTestId={`status-${status}`} />;
}

function PurposeCell({ text }: { text: string }) {
  return (
    <Tooltip title={text}>
      <Text type="BodyXSReg" sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{text}</Text>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/*  Table config                                                      */
/* ------------------------------------------------------------------ */

interface PaymentRow { date: string; sum: string; vat: string; sumWithoutVat: string; direction: string; status: string; counterparty: string; inn: string; purpose: string; }

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
  return payments.map((payment) => ({
    data: {
      date: payment.date, sum: fmtCurrency(payment.sum), vat: fmtCurrency(payment.vat),
      sumWithoutVat: fmtCurrency(payment.sumWithoutVat),
      direction: directionMeta[payment.direction].label,
      status: statusMeta[payment.status].label,
      counterparty: payment.counterparty, inn: payment.inn, purpose: payment.purpose,
    },
    cells: {
      date: payment.date,
      sum: fmtCurrency(payment.sum),
      vat: fmtCurrency(payment.vat),
      sumWithoutVat: fmtCurrency(payment.sumWithoutVat),
      direction: { data: directionMeta[payment.direction].label, render: () => <DirectionCell direction={payment.direction} />, exportRender: () => directionMeta[payment.direction].label },
      status: { data: statusMeta[payment.status].label, render: () => <StatusCell status={payment.status} />, exportRender: () => statusMeta[payment.status].label },
      counterparty: payment.counterparty,
      inn: payment.inn,
      purpose: { data: payment.purpose, render: () => <PurposeCell text={payment.purpose} />, exportRender: () => payment.purpose },
    },
  }));
}

function computeTotals(items: Payment[]) {
  return items.reduce((acc, p) => ({ sum: acc.sum + p.sum, vat: acc.vat + p.vat, sumWithoutVat: acc.sumWithoutVat + p.sumWithoutVat }), { sum: 0, vat: 0, sumWithoutVat: 0 });
}

/* ------------------------------------------------------------------ */
/*  State views                                                       */
/* ------------------------------------------------------------------ */

function LoadingSkeleton() {
  return (
    <Page sx={(t) => ({ backgroundColor: t.palette.BG?.BGPageLinearStart })} dataTestId="PaymentSchedulePage">
      <Skeleton variant="text" width={320} height={20} sx={{ mb: 2 }} />
      <Grid container alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Skeleton variant="text" width={200} height={32} />
        <Grid container gap={1}>
          {[100, 180, 150].map((w, i) => <Skeleton key={i} variant="rectangular" width={w} height={36} sx={{ borderRadius: 1 }} />)}
        </Grid>
      </Grid>
      <Skeleton variant="rectangular" width={160} height={36} sx={{ borderRadius: 1, mb: 2 }} />
      <Paper sx={{ mb: 2 }}><Skeleton variant="rectangular" width="100%" height={400} /></Paper>
      <Paper sx={{ p: 2 }}><Skeleton variant="rectangular" width="100%" height={40} /></Paper>
    </Page>
  );
}

function ErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <main data-sd-screen-root="true" aria-label="График платежей" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 480 }}>
        <Icon name="AlertCircle" size="lg" sx={(t) => ({ color: t.palette.Error.Error, fontSize: 48, mb: 2 })} />
        <Text type="H4StrongSmb" sx={{ mb: 1 }}>Ошибка загрузки</Text>
        <Text type="BodyMReg" color="text.secondary" sx={{ mb: 3 }}>Не удалось загрузить реестр платежей. Проверьте соединение и повторите попытку.</Text>
        <Button type="accent" onClick={onRetry}>Повторить</Button>
      </Paper>
    </main>
  );
}

function EmptyView() {
  return (
    <Page sx={(t) => ({ backgroundColor: t.palette.BG?.BGPageLinearStart })} dataTestId="PaymentSchedulePage">
      <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} dataTestId="Breadcrumbs" />
      <Grid container alignItems="center" justifyContent="space-between" sx={{ mt: 2, mb: 2 }}>
        <Grid container alignItems="center" gap={2}>
          <Text type="H3StrongSmb">График платежей</Text><BadgeCounter counter={0} size="sm" />
        </Grid>
        <Grid container gap={1}>
          <Button type="outlined" size="sm">В сделку</Button>
          <Button type="outlined" size="sm">Данные для акта сверки</Button>
          <Button type="accent" size="sm" startIcon="Add">Добавить платёж</Button>
        </Grid>
      </Grid>
      <Paper sx={{ p: 6, textAlign: 'center' }}>
        <Icon name="Folder" size="lg" sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Text type="H4StrongSmb" sx={{ mb: 1 }}>Нет платежей</Text>
        <Text type="BodyMReg" color="text.secondary">По данной сделке ещё не добавлено ни одного платежа.</Text>
      </Paper>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                       */
/* ------------------------------------------------------------------ */

export function PeymentsTest06() {
  const [screenState] = useState<'loading' | 'error' | 'empty' | 'ready'>('ready');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const totalPages = Math.ceil(mockPayments.length / pageSize);

  if (screenState === 'loading') return <LoadingSkeleton />;
  if (screenState === 'error') return <ErrorView onRetry={() => window.location.reload()} />;
  if (screenState === 'empty') return <EmptyView />;

  const payments = mockPayments;
  const totals = computeTotals(payments);
  const rows = buildRows(payments);
  const pageSx = (t: any) => ({ backgroundColor: t.palette.BG?.BGPageLinearStart ?? t.palette.background?.default });

  return (
    <main data-sd-screen-root="true" aria-label="График платежей" style={{ minHeight: '100vh' }}>
      <Page sx={pageSx} dataTestId="PaymentSchedulePage">
        <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} dataTestId="Breadcrumbs" />

        {/* Header */}
        <Grid container alignItems="center" justifyContent="space-between" sx={{ mt: 2, mb: 1 }}>
          <Grid container alignItems="center" gap={2}>
            <Text type="H3StrongSmb">График платежей</Text>
            <BadgeCounter counter={payments.length} size="sm" />
          </Grid>
          <Grid container alignItems="center" gap={1}>
            <Button type="outlined" size="sm" dataTestId="go-to-deal" startIcon="ArrowNarrowLeft">В сделку</Button>
            <Button type="outlined" size="sm" dataTestId="reconciliation-data">Данные для акта сверки</Button>
            <Button type="accent" size="sm" dataTestId="add-payment" startIcon="Add">Добавить платёж</Button>
          </Grid>
        </Grid>

        {/* Filter */}
        <Button type="outlined" size="sm" startIcon="Filter" dataTestId="filter-button" sx={{ mb: 2 }}>Фильтр</Button>

        {/* Table */}
        <Paper sx={{ mb: 1 }}>
          <Table<PaymentRow, object>
            columns={columns} dataTestId="PaymentScheduleTable" isBordered
            rows={rows}
            tableConfig={{ hasStickyHeader: true }}
          />
        </Paper>

        {/* Footer: totals + pagination */}
        <Paper sx={{ px: 3, py: 1.75 }}>
          <Grid container alignItems="center" justifyContent="space-between">
            <Grid container alignItems="center" gap={4} flexWrap="nowrap">
              {[
                ['Сумма:', fmtMillion(totals.sum)],
                ['НДС:', fmtMillion(totals.vat)],
                ['Сумма без НДС:', fmtMillion(totals.sumWithoutVat)],
              ].map(([label, value]) => (
                <Grid key={label} container alignItems="baseline" gap={0.75} flexWrap="nowrap">
                  <Text type="BodyXSReg" color="text.secondary">{label}</Text>
                  <Text type="BodySReg" sx={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Text>
                </Grid>
              ))}
            </Grid>

            {/* Pagination */}
            <Grid container alignItems="center" gap={1.5} flexWrap="nowrap">
              <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
                <Text type="BodyXSReg" color="text.secondary">Показывать строк:</Text>
                <Text type="BodyXSReg" sx={{ cursor: 'pointer', textDecoration: 'underline' }}>{pageSize}</Text>
              </Grid>
              <Text type="BodyXSReg" color="text.secondary">1–{Math.min(pageSize, payments.length)} из {payments.length}</Text>
              <IconButton name="ChevronLeft" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} title="Предыдущая страница" />
              <Text type="BodyXSReg">{page} из {totalPages}</Text>
              <IconButton name="ChevronRight" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} title="Следующая страница" />
            </Grid>
          </Grid>
        </Paper>
      </Page>
    </main>
  );
}
