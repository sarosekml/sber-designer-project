import React from 'react';

import { Button, DictionaryBadge, Icon, SxBox, Text, Title } from '@/components/atoms';
import type { IconName } from '@/components/atoms';
import { BaseTile, BreadCrumbs } from '@/components/molecules';
import { Table } from '@/components/organisms';
import type { ColumnsConfig, RowsConfig } from '@/components/organisms/Tables';
import type { Sx } from '@/utils';

type Payment = { date: string; sum: number; direction: 'in' | 'out'; status: 'scheduled' | 'paid' | 'overdue' | 'partial'; counterparty: string };

const breadcrumbs = [
  { name: 'Главная', route: '/' }, { name: 'M&A Pipeline', route: '/pipeline' },
  { name: '325. Сделка от 25.04.2024', route: '/deal/325' }, { name: 'График платежей', route: '' },
];

const payments: Payment[] = [
  { date: '15.06.2025', sum: 15_200_000, direction: 'out', status: 'scheduled', counterparty: 'ООО «Ромашка»' },
  { date: '20.06.2025', sum: 12_800_000, direction: 'in', status: 'paid', counterparty: 'ПАО «Газпром»' },
  { date: '15.07.2025', sum: 8_500_000, direction: 'out', status: 'paid', counterparty: 'ООО «Ромашка»' },
  { date: '01.08.2025', sum: 3_200_000, direction: 'in', status: 'overdue', counterparty: 'АО «Альфа-Банк»' },
  { date: '10.08.2025', sum: 5_600_000, direction: 'out', status: 'scheduled', counterparty: 'ООО «СтройИнвест»' },
  { date: '01.09.2025', sum: 9_500_000, direction: 'in', status: 'partial', counterparty: 'ООО «ТехноПром»' },
  { date: '15.10.2025', sum: 4_100_000, direction: 'out', status: 'scheduled', counterparty: 'АО «СберЛизинг»' },
  { date: '01.12.2025', sum: 7_300_000, direction: 'in', status: 'paid', counterparty: 'ООО «ИнвестГрупп»' },
];

const STATUS: Record<Payment['status'], { label: string; tone: 'success' | 'warning' | 'error' | 'info' }> = {
  scheduled: { label: 'Плановый', tone: 'info' }, paid: { label: 'Оплачен', tone: 'success' },
  overdue: { label: 'Просрочен', tone: 'error' }, partial: { label: 'Частично', tone: 'warning' },
};

const badgeSx = (tone: string) => (t: any) => ({ backgroundColor: t.palette[tone]?.[`${tone}BG`], borderColor: t.palette[tone]?.[tone], textColor: t.palette[tone]?.[`${tone}Dark`] });

const fmt = (v: number) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const compact = (v: number) => `${(v / 1_000_000).toFixed(2)} млн руб`;
const total = payments.reduce((a, p) => a + p.sum, 0);
const paid = payments.filter((p) => p.status === 'paid').length;
const sched = payments.filter((p) => p.status === 'scheduled').length;
const ovd = payments.filter((p) => p.status === 'overdue').length;

const dirMeta: Record<Payment['direction'], { icon: IconName; label: string; color: string }> = {
  in: { icon: 'ArrowNarrowDownLeft', label: 'Входящий', color: 'Success' },
  out: { icon: 'ArrowNarrowUpRight', label: 'Исходящий', color: 'Error' },
};

const columns: ColumnsConfig<any> = [
  { name: 'date', title: 'Дата платежа', width: 120 },
  { name: 'counterparty', title: 'Контрагент', width: 260, wordWrapEnabled: true },
  { name: 'status', title: 'Статус', width: 160 },
  { name: 'sum', title: 'Сумма, руб.', align: 'right', width: 160 },
];

const rows: RowsConfig<any> = payments.map((p) => {
  const dm = dirMeta[p.direction]; const sm = STATUS[p.status];
  return {
    data: { date: p.date, counterparty: `${dm.label} · ${p.counterparty}`, status: sm.label, sum: fmt(p.sum) },
    cells: {
      date: p.date,
      counterparty: { data: `${dm.label} · ${p.counterparty}`,
        render: () => (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name={dm.icon} size="sm" sx={(t: any) => ({ color: t.palette[dm.color]?.[dm.color], fontSize: 16 })} />
            <Text type="BodyXSReg">{p.counterparty}</Text>
          </span>),
        exportRender: () => p.counterparty,
      },
      status: { data: sm.label,
        render: () => <DictionaryBadge code={p.status} name={sm.label} component="Chip" size="sm" type="read" variant="outlined" colorThemeSx={badgeSx(sm.tone === 'success' ? 'Success' : sm.tone === 'warning' ? 'Warning' : sm.tone === 'error' ? 'Error' : 'Info')} />,
        exportRender: () => sm.label,
      },
      sum: fmt(p.sum),
    },
  };
});

const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <Text type="BodyXSReg" sx={{ color: 'Text.TextSecondary' }}>{label}</Text>
    <Title type="subTitle" sx={color ? { color: `${color}.${color}` } as Sx : undefined}>{value}</Title>
  </span>
);

export function ImageTest() {
  return (
    <main data-sd-screen-root="true" aria-label="Payment Schedule" style={{ minHeight: '100vh' }}>
      <SxBox sx={(t) => ({ minHeight: '100vh', backgroundColor: t.palette.BG?.BGPageLinearStart, px: { xs: 2, md: 3 }, py: 3 })}>
        <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} />

        <SxBox sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, mt: 1 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Title type="title">График платежей</Title>
            <DictionaryBadge code="active" name="Действующая" component="Chip" size="sm" type="read" variant="outlined" colorThemeSx={badgeSx('Success')} />
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button type="outlined" startIcon="ArrowLeft">В сделку</Button>
            <Button type="outlined">Данные для акта сверки</Button>
            <Button type="accent" startIcon="Add">Добавить платёж</Button>
          </span>
        </SxBox>

        <SxBox sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
          <BaseTile title="Сумма графиков" size="md">
            <span style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap', padding: '8px 0' }}>
              <Stat label="Сумма" value={compact(total)} />
              <Stat label="НДС" value={compact(total * 0.2)} />
              <Stat label="Сумма без НДС" value={compact(total / 1.2)} />
            </span>
          </BaseTile>
          <BaseTile title="Статистика платежей" size="md">
            <span style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap', padding: '8px 0' }}>
              <Stat label="Всего платежей" value={String(payments.length)} />
              <Stat label="Оплачено" value={String(paid)} color="Success" />
              <Stat label="Плановые" value={String(sched)} color="Info" />
              <Stat label="Просрочено" value={String(ovd)} color="Error" />
            </span>
          </BaseTile>
        </SxBox>

        <BaseTile title="График платежей" size="lg">
          <SxBox sx={{ overflowX: 'auto', minWidth: 800 }}>
            <Table<any, object> columns={columns} dataTestId="PaymentScheduleTable" isBordered rows={rows} tableConfig={{ hasStickyHeader: true }} />
          </SxBox>
          <SxBox sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 2, borderTop: '1px solid', borderColor: 'Border.BorderPrimary' }}>
            <Text type="BodyXSReg">Показывать строк: 50  |  1–{payments.length} из {payments.length}</Text>
          </SxBox>
        </BaseTile>
      </SxBox>
    </main>
  );
}
