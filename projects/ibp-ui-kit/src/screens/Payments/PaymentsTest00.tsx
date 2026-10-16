import React, { useState } from 'react';
import { Grid, Menu, MenuItem } from '@mui/material';

import { BadgeCounter, Button, Divider, Icon, IconButton, Paper, Skeleton, Text } from '@/components/atoms';
import { BreadCrumbs } from '@/components/molecules';
import type { IconName } from '@/components/atoms/Icon/Icon.types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Direction = 'incoming' | 'outgoing';
type PaymentStatus =
  | 'expected'
  | 'processing'
  | 'paid'
  | 'partial'
  | 'rejected'
  | 'paid-with-note';

interface PaymentRow {
  id: number;
  date: string;
  sum: number;
  vat: number;
  sumWithoutVat: number;
  direction: Direction;
  status: PaymentStatus;
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
/*  Mock data — deal context                                           */
/* ------------------------------------------------------------------ */

const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'M&A Pipeline', route: '/ma-pipeline' },
  { name: '325. Сделка от 25.04.2024', route: '/deal/325' },
  { name: 'График платежей', route: '' },
];

/* ------------------------------------------------------------------ */
/*  Dictionary / helpers                                               */
/* ------------------------------------------------------------------ */

const directionMeta: Record<
  Direction,
  { label: string; icon: IconName; color: string }
> = {
  incoming: { label: 'Входящий', icon: 'ArrowNarrowDownRight', color: '#10B981' },
  outgoing: { label: 'Исходящий', icon: 'ArrowNarrowUpRight', color: '#EF4444' },
};

const statusMeta: Record<
  PaymentStatus,
  { label: string; icon: IconName; color: string }
> = {
  expected: { label: 'Ожидаемый', icon: 'ClockTimer', color: '#F59E0B' },
  processing: { label: 'В обработке', icon: 'Refresh', color: '#3B82F6' },
  paid: { label: 'Оплачен', icon: 'CheckCircleFilled', color: '#10B981' },
  partial: { label: 'Частично оплачен', icon: 'CircleFilledPartly', color: '#F59E0B' },
  rejected: { label: 'Отклонён', icon: 'CloseCircle', color: '#EF4444' },
  'paid-with-note': { label: 'Оплачен с замечанием', icon: 'CheckCircleWarning', color: '#10B981' },
};

function formatCurrency(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMillions(value: number): string {
  return (value / 1_000_000).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ------------------------------------------------------------------ */
/*  Mock data — payments                                               */
/* ------------------------------------------------------------------ */

const mockPayments: PaymentRow[] = [
  { id: 1, date: '15.05.2025', sum: 5792800.29, vat: 965466.72, sumWithoutVat: 4827333.57, direction: 'incoming', status: 'paid', counterparty: 'ООО "Ромашка"', inn: '6123012938', purpose: 'Оплата организационных услуг по Соглашению №456321 от 12.09.2024' },
  { id: 2, date: '20.05.2025', sum: 3200000.00, vat: 533333.33, sumWithoutVat: 2666666.67, direction: 'outgoing', status: 'expected', counterparty: 'ПАО "Сбербанк"', inn: '7707083893', purpose: 'Выплата комиссии за организацию выпуска' },
  { id: 3, date: '01.06.2025', sum: 12500000.00, vat: 2083333.33, sumWithoutVat: 10416666.67, direction: 'outgoing', status: 'processing', counterparty: 'АО "Альфа-Банк"', inn: '7728168971', purpose: 'Погашение основной суммы долга по кредитному договору №КД-2023/456' },
  { id: 4, date: '10.06.2025', sum: 890000.50, vat: 148333.42, sumWithoutVat: 741667.08, direction: 'incoming', status: 'paid', counterparty: 'ООО "ТехноИнвест"', inn: '5032123456', purpose: 'Поступление процентов по займу' },
  { id: 5, date: '15.06.2025', sum: 4850000.00, vat: 808333.33, sumWithoutVat: 4041666.67, direction: 'outgoing', status: 'paid-with-note', counterparty: 'ООО "КонсалтПро"', inn: '7712345678', purpose: 'Консультационные услуги по структурированию сделки' },
  { id: 6, date: '20.06.2025', sum: 2100000.00, vat: 350000.00, sumWithoutVat: 1750000.00, direction: 'incoming', status: 'rejected', counterparty: 'АО "ФинансГрупп"', inn: '7719876543', purpose: 'Возврат ошибочно перечисленных средств' },
  { id: 7, date: '25.06.2025', sum: 7345000.00, vat: 1224166.67, sumWithoutVat: 6120833.33, direction: 'outgoing', status: 'expected', counterparty: 'ООО "Юридическое бюро"', inn: '7734567890', purpose: 'Юридическое сопровождение сделки по Соглашению №789012' },
  { id: 8, date: '01.07.2025', sum: 15600000.00, vat: 2600000.00, sumWithoutVat: 13000000.00, direction: 'outgoing', status: 'partial', counterparty: 'ПАО "ВТБ"', inn: '7702070139', purpose: 'Частичное досрочное погашение кредитной линии' },
  { id: 9, date: '05.07.2025', sum: 3400000.00, vat: 566666.67, sumWithoutVat: 2833333.33, direction: 'incoming', status: 'expected', counterparty: 'ООО "Новые Технологии"', inn: '5045123987', purpose: 'Авансовый платёж по договору поставки оборудования' },
  { id: 10, date: '10.07.2025', sum: 9800000.00, vat: 1633333.33, sumWithoutVat: 8166666.67, direction: 'outgoing', status: 'processing', counterparty: 'ООО "Ромашка"', inn: '6123012938', purpose: 'Окончательный расчёт по Договору подряда №ДП-2024/987' },
];

function computeTotals(payments: PaymentRow[]): Totals {
  return payments.reduce(
    (acc, p) => ({
      sum: acc.sum + p.sum,
      vat: acc.vat + p.vat,
      sumWithoutVat: acc.sumWithoutVat + p.sumWithoutVat,
    }),
    { sum: 0, vat: 0, sumWithoutVat: 0 },
  );
}

/* ------------------------------------------------------------------ */
/*  Direction cell                                                     */
/* ------------------------------------------------------------------ */

function DirectionCell({ direction }: { direction: Direction }) {
  const meta = directionMeta[direction];
  return (
    <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
      <Icon name={meta.icon} size="sm" sx={{ color: meta.color, fontSize: 16 }} />
      <Text type="BodyXSReg">{meta.label}</Text>
    </Grid>
  );
}

/* ------------------------------------------------------------------ */
/*  Status cell                                                        */
/* ------------------------------------------------------------------ */

function StatusCell({ status }: { status: PaymentStatus }) {
  const meta = statusMeta[status];
  return (
    <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
      <Icon name={meta.icon} size="sm" sx={{ color: meta.color, fontSize: 16 }} />
      <Text type="BodyXSReg">{meta.label}</Text>
    </Grid>
  );
}

/* ------------------------------------------------------------------ */
/*  Purpose cell with tooltip via title attr                           */
/* ------------------------------------------------------------------ */

function PurposeCell({ text, maxChars = 30 }: { text: string; maxChars?: number }) {
  const truncated = text.length > maxChars ? text.slice(0, maxChars) + '…' : text;
  return (
    <span title={text}>
      <Text type="BodyXSReg" sx={{ cursor: 'default', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {truncated}
      </Text>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Table column heading                                               */
/* ------------------------------------------------------------------ */

const columns = [
  { key: 'date', label: 'Дата', width: 90 },
  { key: 'sum', label: 'Сумма, руб.', width: 120 },
  { key: 'vat', label: 'НДС, руб.', width: 110 },
  { key: 'sumWithoutVat', label: 'Сумма без НДС, руб.', width: 130 },
  { key: 'direction', label: 'Направление', width: 120 },
  { key: 'status', label: 'Статус', width: 150 },
  { key: 'counterparty', label: 'Платёжный контрагент', width: 160 },
  { key: 'inn', label: 'ИНН плательщика', width: 130 },
  { key: 'purpose', label: 'Назначение платежа', width: 240 },
  { key: 'menu', label: '', width: 40 },
] as const;

/* ------------------------------------------------------------------ */
/*  Sort icon helper                                                   */
/* ------------------------------------------------------------------ */

function SortIcon() {
  return <Icon name="Sort" size="sm" sx={{ fontSize: 14, ml: 0.25, color: 'text.disabled', verticalAlign: 'middle' }} />;
}

/* ------------------------------------------------------------------ */
/*  Main screen component                                              */
/* ------------------------------------------------------------------ */

type ScreenState = 'loading' | 'ready' | 'empty' | 'error';

export function PaymentsTest00() {
  const [screenState] = useState<ScreenState>('ready');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const totalPages = Math.ceil(mockPayments.length / pageSize);

  const payments = mockPayments;
  const totals = computeTotals(payments);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  /* ── Loading state ── */
  if (screenState === 'loading') {
    return (
      <main data-sd-screen-root="true" aria-label="График платежей" style={{ minHeight: '100vh', background: '#F5F5F5', padding: 24 }}>
        <Grid sx={{ mb: 2 }}>
          <Skeleton variant="text" width={300} height={20} />
        </Grid>
        <Grid sx={{ mb: 3 }}>
          <Skeleton variant="text" width={400} height={32} />
        </Grid>
        <Grid sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}>
          <Skeleton variant="rectangular" width="100%" height={400} />
        </Grid>
        <Grid sx={{ borderRadius: 1, overflow: 'hidden' }}>
          <Skeleton variant="rectangular" width="100%" height={48} />
        </Grid>
      </main>
    );
  }

  /* ── Error state ── */
  if (screenState === 'error') {
    return (
      <main data-sd-screen-root="true" aria-label="График платежей" style={{ minHeight: '100vh', background: '#F5F5F5', display: 'grid', placeItems: 'center' }}>
        <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 480 }}>
          <Icon name="AlertCircle" size="lg" sx={{ color: '#EF4444', fontSize: 48, mb: 2 }} />
          <Text type="H4StrongSmb" sx={{ mb: 1 }}>Ошибка загрузки</Text>
          <Text type="BodyMReg" color="text.secondary" sx={{ mb: 3 }}>
            Не удалось загрузить реестр платежей. Попробуйте обновить страницу.
          </Text>
          <Button type="accent" onClick={() => window.location.reload()}>Повторить</Button>
        </Paper>
      </main>
    );
  }

  /* ── Empty state ── */
  if (screenState === 'empty') {
    return (
      <main data-sd-screen-root="true" aria-label="График платежей" style={{ minHeight: '100vh', background: '#F5F5F5' }}>
        <Grid sx={{ px: 3, pt: 2 }}>
          <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} />
        </Grid>
        <Grid sx={{ px: 3, py: 2 }}>
          <Grid container alignItems="center" justifyContent="space-between">
            <Text type="H3StrongSmb">График платежей</Text>
            <Grid container gap={1}>
              <Button type="outlined">В сделку</Button>
              <Button type="outlined">Данные для акта сверки</Button>
              <Button type="accent">Добавить платёж</Button>
            </Grid>
          </Grid>
        </Grid>
        <Paper sx={{ mx: 3, p: 6, textAlign: 'center' }}>
          <Icon name="Folder" size="lg" sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Text type="H4StrongSmb" sx={{ mb: 1 }}>Нет платежей</Text>
          <Text type="BodyMReg" color="text.secondary">По данной сделке ещё не добавлено ни одного платежа.</Text>
        </Paper>
      </main>
    );
  }

  /* ── Ready state ── */
  return (
    <main
      data-sd-screen-root="true"
      aria-label="График платежей"
      style={{ minHeight: '100vh', background: '#F5F5F5' }}
    >
      {/* Breadcrumbs */}
      <Grid sx={{ px: 3, pt: 2, pb: 0 }}>
        <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} />
      </Grid>

      {/* Page header */}
      <Grid sx={{ px: 3, py: 2 }}>
        <Grid container alignItems="center" justifyContent="space-between" flexWrap="nowrap">
          <Grid container alignItems="center" gap={2} flexWrap="nowrap">
            <Text type="H3StrongSmb">График платежей</Text>
            <BadgeCounter counter={mockPayments.length} size="sm" />
          </Grid>
          <Grid container alignItems="center" gap={1} flexWrap="nowrap">
            <Button type="outlined" size="sm">
              <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
                <Icon name="ArrowNarrowLeft" size="sm" sx={{ fontSize: 14 }} />
                <span>В сделку</span>
              </Grid>
            </Button>
            <Button type="outlined" size="sm">Данные для акта сверки</Button>
            <Button type="accent" size="sm">Добавить платёж</Button>
          </Grid>
        </Grid>
      </Grid>

      {/* Filter bar */}
      <Grid sx={{ px: 3, pb: 1.5 }}>
        <Button type="outlined" size="sm" startIcon="Filter">
          Фильтр
        </Button>
      </Grid>

      {/* Table */}
      <Paper sx={{ mx: 3, mb: 0 }}>
        {/* Table header */}
        <Grid
          container
          alignItems="center"
          sx={{
            px: 2,
            py: 1.25,
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
          }}
        >
          {columns.map((col) => (
            <Grid
              key={col.key}
              item
              sx={{
                width: col.width,
                flexShrink: 0,
                cursor: col.key === 'menu' ? 'default' : 'pointer',
                userSelect: 'none',
              }}
              onClick={col.key !== 'menu' ? () => {} : undefined}
            >
              <Text type="BodyXSReg" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                {col.label}
                {col.key !== 'menu' && <SortIcon />}
              </Text>
            </Grid>
          ))}
        </Grid>

        {/* Table body */}
        {payments.map((row, idx) => (
          <Grid
            key={row.id}
            container
            alignItems="center"
            sx={{
              px: 2,
              py: 1.25,
              borderBottom: idx < payments.length - 1 ? '1px solid #F3F4F6' : 'none',
              '&:hover': { backgroundColor: '#F9FAFB' },
            }}
          >
            <Grid item sx={{ width: 90, flexShrink: 0 }}>
              <Text type="BodyXSReg">{row.date}</Text>
            </Grid>
            <Grid item sx={{ width: 120, flexShrink: 0 }}>
              <Text type="BodyXSReg" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(row.sum)}</Text>
            </Grid>
            <Grid item sx={{ width: 110, flexShrink: 0 }}>
              <Text type="BodyXSReg" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(row.vat)}</Text>
            </Grid>
            <Grid item sx={{ width: 130, flexShrink: 0 }}>
              <Text type="BodyXSReg" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(row.sumWithoutVat)}</Text>
            </Grid>
            <Grid item sx={{ width: 120, flexShrink: 0 }}>
              <DirectionCell direction={row.direction} />
            </Grid>
            <Grid item sx={{ width: 150, flexShrink: 0 }}>
              <StatusCell status={row.status} />
            </Grid>
            <Grid item sx={{ width: 160, flexShrink: 0 }}>
              <Text type="BodyXSReg">{row.counterparty}</Text>
            </Grid>
            <Grid item sx={{ width: 130, flexShrink: 0 }}>
              <Text type="BodyXSReg" sx={{ fontFamily: 'monospace' }}>{row.inn}</Text>
            </Grid>
            <Grid item sx={{ width: 240, flexShrink: 0 }}>
              <PurposeCell text={row.purpose} />
            </Grid>
            <Grid item sx={{ width: 40, flexShrink: 0 }}>
              <IconButton name="MoreDots" size="sm" onClick={handleMenuOpen} title="Действия" />
            </Grid>
          </Grid>
        ))}
      </Paper>

      {/* Row action menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleMenuClose}>Редактировать</MenuItem>
        <MenuItem onClick={handleMenuClose}>Удалить</MenuItem>
        <MenuItem onClick={handleMenuClose}>Просмотреть</MenuItem>
      </Menu>

      {/* Footer: totals + pagination */}
      <Paper sx={{ mx: 3, mt: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        <Grid
          container
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 3, py: 1.75 }}
        >
          {/* Totals */}
          <Grid container alignItems="center" gap={4} flexWrap="nowrap">
            <Grid container alignItems="baseline" gap={0.75} flexWrap="nowrap">
              <Text type="BodyXSReg" color="text.secondary">Сумма:</Text>
              <Text type="BodySReg" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMillions(totals.sum)} млн руб.
              </Text>
            </Grid>
            <Grid container alignItems="baseline" gap={0.75} flexWrap="nowrap">
              <Text type="BodyXSReg" color="text.secondary">НДС:</Text>
              <Text type="BodySReg" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMillions(totals.vat)} млн руб.
              </Text>
            </Grid>
            <Grid container alignItems="baseline" gap={0.75} flexWrap="nowrap">
              <Text type="BodyXSReg" color="text.secondary">Сумма без НДС:</Text>
              <Text type="BodySReg" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMillions(totals.sumWithoutVat)} млн руб.
              </Text>
            </Grid>
          </Grid>

          {/* Pagination */}
          <Grid container alignItems="center" gap={1.5} flexWrap="nowrap">
            <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
              <Text type="BodyXSReg" color="text.secondary">Показывать строк:</Text>
              <Text type="BodyXSReg" sx={{ cursor: 'pointer', textDecoration: 'underline' }}>{pageSize}</Text>
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
    </main>
  );
}
