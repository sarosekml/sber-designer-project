import React from 'react';

import { BadgeCounter, Button, Grid, Icon, Paper, Text } from '@/components/atoms';
import type { IconName } from '@/components/atoms/Icon/Icon.types';
import { BreadCrumbs } from '@/components/molecules';

type PaymentDirection = 'in' | 'out';
type PaymentStatus = 'planned' | 'paid' | 'review';

interface PaymentRow {
  id: string;
  date: string;
  counterparty: string;
  amount: string;
  direction: PaymentDirection;
  status: PaymentStatus;
}

const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'M&A Pipeline', route: '/ma-pipeline' },
  { name: '325. Сделка от 25.04.2024', route: '/deal/325' },
  { name: 'График платежей', route: '' },
];

const payments: PaymentRow[] = [
  {
    id: 'PAY-1201',
    date: '15.06.2026',
    counterparty: 'ООО "Ромашка"',
    amount: '5 792 800,29 ₽',
    direction: 'in',
    status: 'paid',
  },
  {
    id: 'PAY-1202',
    date: '20.06.2026',
    counterparty: 'ПАО "Сбербанк"',
    amount: '3 200 000,00 ₽',
    direction: 'out',
    status: 'planned',
  },
  {
    id: 'PAY-1203',
    date: '01.07.2026',
    counterparty: 'АО "Альфа-Банк"',
    amount: '12 500 000,00 ₽',
    direction: 'out',
    status: 'review',
  },
];

const directionMeta: Record<PaymentDirection, { label: string; icon: IconName; color: string }> = {
  in: { label: 'Входящий', icon: 'ArrowNarrowDownRight', color: 'success.main' },
  out: { label: 'Исходящий', icon: 'ArrowNarrowUpRight', color: 'error.main' },
};

const statusMeta: Record<PaymentStatus, { label: string; icon: IconName; color: string }> = {
  planned: { label: 'Ожидается', icon: 'ClockTimer', color: 'warning.main' },
  paid: { label: 'Оплачен', icon: 'CheckCircleFilled', color: 'success.main' },
  review: { label: 'На проверке', icon: 'AlertCircle', color: 'info.main' },
};

function DirectionCell({ direction }: { direction: PaymentDirection }) {
  const meta = directionMeta[direction];

  return (
    <Grid container alignItems="center" gap={0.75} flexWrap="nowrap">
      <Icon name={meta.icon} size="sm" sx={{ color: meta.color, fontSize: 16 }} />
      <Text type="BodyXSReg">{meta.label}</Text>
    </Grid>
  );
}

function StatusCell({ status }: { status: PaymentStatus }) {
  const meta = statusMeta[status];

  return (
    <Grid container alignItems="center" gap={0.75} flexWrap="nowrap">
      <Icon name={meta.icon} size="sm" sx={{ color: meta.color, fontSize: 16 }} />
      <Text type="BodyXSReg">{meta.label}</Text>
    </Grid>
  );
}

export function PaymentsTest03() {
  return (
    <main
      data-sd-screen-root="true"
      aria-label="Payments-test-03"
      style={{ minHeight: '100vh', background: '#F5F5F5' }}
    >
      <Grid sx={{ px: 3, pt: 2, pb: 1 }}>
        <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} />
      </Grid>

      <Grid sx={{ px: 3, pb: 2 }}>
        <Grid container alignItems="center" justifyContent="space-between" gap={2}>
          <Grid container alignItems="center" gap={1.5} flexWrap="nowrap">
            <Text type="H3StrongSmb">График платежей</Text>
            <BadgeCounter counter={payments.length} size="sm" />
          </Grid>
          <Grid container alignItems="center" gap={1} flexWrap="nowrap">
            <Button type="outlined" size="sm" startIcon="ArrowNarrowLeft">
              В сделку
            </Button>
            <Button type="accent" size="sm" startIcon="Add">
              Добавить платёж
            </Button>
          </Grid>
        </Grid>
      </Grid>

      <Paper sx={{ mx: 3, overflow: 'hidden' }}>
        <Grid container sx={{ px: 2, py: 1.25, backgroundColor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          {['Дата', 'Контрагент', 'Сумма', 'Направление', 'Статус'].map((column) => (
            <Grid key={column} item xs={column === 'Контрагент' ? 3 : 2.25}>
              <Text type="BodyXSReg" color="text.secondary">
                {column}
              </Text>
            </Grid>
          ))}
        </Grid>

        {payments.map((payment) => (
          <Grid
            key={payment.id}
            container
            alignItems="center"
            sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Grid item xs={2.25}>
              <Text type="BodyXSReg">{payment.date}</Text>
            </Grid>
            <Grid item xs={3}>
              <Text type="BodyXSReg">{payment.counterparty}</Text>
            </Grid>
            <Grid item xs={2.25}>
              <Text type="BodyXSReg" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {payment.amount}
              </Text>
            </Grid>
            <Grid item xs={2.25}>
              <DirectionCell direction={payment.direction} />
            </Grid>
            <Grid item xs={2.25}>
              <StatusCell status={payment.status} />
            </Grid>
          </Grid>
        ))}
      </Paper>
    </main>
  );
}
