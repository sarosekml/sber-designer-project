import React from 'react';
import {
  Button,
  DictionaryBadge,
  Grid,
  Icon,
  IconButton,
  Page,
  Text,
} from '@/components/atoms';
import { BreadCrumbs, TileCard } from '@/components/molecules';
import { Table } from '@/components/organisms';
import type { ColumnsConfig, RowsConfig } from '@/components/organisms/Tables';

/* ── Mock data ── */
const bcs = [
  { name: 'Главная', route: '/' },
  { name: 'Потенциалы DCM', route: '/dcm-potentials' },
  { name: 'Черновик сделки DCM: Кредит № 4B02-04-01669-A-001P', route: '' },
];

const draft = {
  title: 'Черновик сделки DCM: Кредит № 4B02-04-01669-A-001P',
  updatedMeta: 'Изменено 02.07.2025, 10:04, Сергеев И.П.',
};

const client = { name: 'ПАО АФК «Система»', industry: 'Ретейл', km: 'Иванов И.И.', tabNumber: '213456789', tb: 'Среднерусский банк' };
const terms: [string, string][] = [
  ['Сумма финансирования', '20 млн руб.'],
  ['Остаток срочной задолженности', '9,95 млн руб.'],
  ['Невыбранный лимит', '0,5 млн руб.'],
  ['Процентная ставка', '23 %'],
  ['Дата погашения', '12.12.2025'],
  ['Дата выдачи', '12.12.2023'],
  ['Номер договора', '4B02-04-01669-A-001P'],
  ['Является рефинансированием', 'Да'],
  ['Тип кредита', '931 Корпоративное кредитование — возобновляемая кредитная линия'],
];
const holding = { name: 'АФК «Система»', km: 'Петров И.И.', tabNumber: '213456790', tb: 'Среднерусский банк' };
const cmt = 'Пришли к выводу, что можно предложить выпуск облигаций в качестве основного продукта, а также будет дополнительное соглашение на выкуп облигаций банком.';

/* ── Potential table ── */
interface PRow { company: string; amount: string; rate: string; maturity: string; reason: string; product: string; isGroup: boolean; level: number; }
const potCols: ColumnsConfig<PRow> = [
  { name: 'company', title: 'Потенциал', sortingEnabled: false, width: 280 },
  { name: 'amount', title: 'Сумма, млн руб.', sortingEnabled: false, align: 'right', width: 140 },
  { name: 'rate', title: 'Процентная ставка', sortingEnabled: false, align: 'right', width: 140 },
  { name: 'maturity', title: 'Дата погашения', sortingEnabled: false, width: 120 },
  { name: 'reason', title: 'Причина', sortingEnabled: false, width: 220 },
];

const potData: (PRow & { rating?: string; isSelected?: boolean; _level: number })[] = [
  { company: 'АФК «Система» Потенциалов: 5, Сумма к перевороту: 120 млн руб.', amount: '', rate: '', maturity: '', reason: '', product: '', isGroup: true, level: 0, _level: 0 },
  { company: 'ПАО АФК «Система» Потенциалов: 2, Сумма к перевороту: 60 млн руб.', amount: '', rate: '', maturity: '', reason: '', product: '', isGroup: true, level: 1, _level: 1, rating: 'AA' },
  { company: 'Кредит', amount: '20', rate: '23 %', maturity: '15.09.2026', reason: 'Финансирование к погашению', product: 'Кредит', isGroup: false, level: 2, _level: 2, isSelected: true },
  { company: 'Облигация в валюте', amount: '40', rate: 'КС + 1,9 %', maturity: '28.09.2026', reason: 'Финансирование к погашению', product: 'Облигация в валюте', isGroup: false, level: 2, _level: 2 },
  { company: 'ПАО «Мобильные телесистемы» Потенциалов: 2, Сумма к перевороту: 330 млн руб.', amount: '', rate: '', maturity: '', reason: '', product: '', isGroup: true, level: 1, _level: 1, rating: 'AAA' },
  { company: 'Кредит', amount: '20', rate: '19 %', maturity: '10.09.2026', reason: 'Финансирование к погашению', product: 'Кредит', isGroup: false, level: 2, _level: 2 },
  { company: 'Облигация в валюте', amount: '300', rate: 'КС + 3 %', maturity: '01.09.2026', reason: 'Финансирование к погашению', product: 'Облигация в валюте', isGroup: false, level: 2, _level: 2 },
];

function buildRows(): RowsConfig<PRow> {
  return potData.map((r) => ({
    data: { company: r.company, amount: r.amount, rate: r.rate, maturity: r.maturity, reason: r.reason, product: r.product, isGroup: r.isGroup, level: r.level },
    cells: {
      company: { data: r.company, render: () => (
        <Grid container alignItems="center" gap={1} sx={{ pl: r._level * 3 }}>
          {r._level < 2 && <Icon name={r._level === 0 ? 'ChevronDown' : 'ChevronRight'} size="sm" />}
          <Text type={r._level < 2 ? 'BodySReg' : 'BodyXSReg'} sx={{ fontWeight: r._level < 2 ? 600 : 400 }}>{r.company}</Text>
          {r.rating && <DictionaryBadge code={r.rating} name={r.rating} component="Chip" size="sm" type="read" variant="outlined" />}
          {r.isSelected && <Text type="BodyXSReg" color="text.secondary" sx={{ ml: 1 }}>— выбран</Text>}
        </Grid>
      ), exportRender: () => r.company },
      amount: r.amount,
      rate: r.rate,
      maturity: r.maturity,
      reason: r.reason,
      product: r.product,
      isGroup: r.isGroup,
      level: r.level,
    },
  }));
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <Grid container justifyContent="space-between" alignItems="flex-start" sx={{ py: 0.5 }}>
      <Text type="BodyXSReg" color="text.secondary">{label}</Text>
      <Text type="BodyXSReg" sx={{ maxWidth: '60%', textAlign: 'right' }}>{value || '—'}</Text>
    </Grid>
  );
}

/* ── Screen ── */
export function TestAfterRebuildHarness01() {
  const pg = (t: any) => ({ backgroundColor: t.palette.BG?.BGPageLinearStart ?? t.palette.background?.default, minHeight: '100vh' });

  return (
    <main data-sd-screen-root="true" aria-label="Черновик сделки DCM">
      <Page sx={pg} dataTestId="DcmDraftDealPage">
        <BreadCrumbs navigationSchema={bcs} onClickLink={() => {}} dataTestId="DcmDraftDealBreadcrumbs" />

        {/* Header */}
        <Grid container alignItems="center" justifyContent="space-between" sx={{ mt: 2, mb: 0.5, gap: 2, flexWrap: 'nowrap' }}>
          <Grid container alignItems="center" gap={1} sx={{ width: 'auto', minWidth: 0, flex: '1 1 auto' }}>
            <Text type="H4StrongSmb">{draft.title}</Text>
            <IconButton name="Edit" size="sm" title="Редактировать черновик" />
          </Grid>
          <Grid container alignItems="center" justifyContent="flex-end" gap={1} sx={{ width: 'auto', flex: '0 0 auto', ml: 'auto' }}>
            <Button type="accent" size="sm" startIcon="File">Перевести в сделку DCM</Button>
            <IconButton name="MoreDots" size="sm" title="Дополнительные действия" />
          </Grid>
        </Grid>
        <Grid container alignItems="center" gap={0.75} sx={{ mb: 2 }}>
          <Icon name="CheckCircle" size="sm" sx={(t: any) => ({ color: t.palette.Success?.Success, fontSize: 14 })} />
          <Text type="BodyXSReg" color="text.secondary">{draft.updatedMeta}</Text>
        </Grid>

        {/* Content grid */}
        <Grid container spacing={2}>
          {/* Row 1 */}
          <Grid item xs={6}>
            <TileCard title="Клиент" dataTestId="ClientInfoTile" size="md"
              actions={<IconButton name="ArrowNarrowRight" size="sm" title="Открыть клиента" />}>
              <FieldRow label="Наименование" value={client.name} />
              <FieldRow label="Отрасль" value={client.industry} />
              <FieldRow label="КМ" value={client.km} />
              <Grid container justifyContent="space-between" sx={{ py: 0.5 }}>
                <Text type="BodyXSReg" color="text.secondary">Табельный номер</Text>
                <Grid container alignItems="center" gap={0.5}><Text type="BodyXSReg">{client.tabNumber}</Text><Icon name="Link" size="sm" /></Grid>
              </Grid>
              <FieldRow label="ТБ" value={client.tb} />
              <Text type="BodyXSReg" sx={{ mt: 1.5, mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>Рейтинг</Text>
              <Text type="BodyXSReg" color="text.secondary" sx={{ mb: 0.25 }}>Публичный</Text>
              <Grid container alignItems="center" gap={1} sx={{ mb: 0.25 }}>
                <DictionaryBadge code="AA" name="AA" component="Chip" size="sm" type="read" variant="outlined" />
                <Text type="BodyXSReg">Стабильный АКРА от 12.11.2025, Подтвержден</Text>
              </Grid>
              <Grid container alignItems="center" gap={1}>
                <DictionaryBadge code="ruAAA" name="ruAAA" component="Chip" size="sm" type="read" variant="outlined" />
                <Text type="BodyXSReg">РА Эксперт от 10.10.2024, Повышен</Text>
              </Grid>
              <FieldRow label="Расчетный по внутренним рейтингам в Сбере" value="AAA" />
              <FieldRow label="Расчетный спред" value="180 bps" />
              <Grid sx={{ mt: 1.5, mb: 0.5, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
                <FieldRow label="Публичные выпуски" value="Да" />
                <Button type="transparent" size="xs" onClick={() => {}} sx={{ mt: 0.5 }}>Посмотреть текущие выпуски</Button>
              </Grid>
            </TileCard>
          </Grid>
          <Grid item xs={6}>
            <TileCard title="Условия кредита" dataTestId="CreditTermsTile" size="md">
              {terms.map(([label, value]) => (<FieldRow key={label} label={label} value={value} />))}
            </TileCard>
          </Grid>

          {/* Row 2 */}
          <Grid item xs={6}>
            <TileCard title="Холдинг" dataTestId="HoldingInfoTile" size="md"
              actions={<IconButton name="ArrowNarrowRight" size="sm" title="Открыть холдинг" />}>
              <FieldRow label="Наименование" value={holding.name} />
              <FieldRow label="КМ Холдинга" value={holding.km} />
              <Grid container justifyContent="space-between" sx={{ py: 0.5 }}>
                <Text type="BodyXSReg" color="text.secondary">Табельный номер</Text>
                <Grid container alignItems="center" gap={0.5}><Text type="BodyXSReg">{holding.tabNumber}</Text><Icon name="Link" size="sm" /></Grid>
              </Grid>
              <FieldRow label="ТБ" value={holding.tb} />
            </TileCard>
          </Grid>
          <Grid item xs={6}>
            <TileCard title="Комментарии" dataTestId="CommentsTile" size="md"
              actions={<IconButton name="Edit" size="sm" title="Редактировать комментарий" />}>
              <Text type="BodyXSReg">{cmt}</Text>
            </TileCard>
          </Grid>

          {/* Row 3 — full width */}
          <Grid item xs={12}>
            <TileCard title="Потенциалы холдинга" dataTestId="HoldingPotentialsTile" size="md">
              <Table<PRow, object>
                columns={potCols}
                dataTestId="HoldingPotentialsTable"
                isBordered
                rows={buildRows()}
                tableConfig={{ hasStickyHeader: true }}
              />
            </TileCard>
          </Grid>
        </Grid>
      </Page>
    </main>
  );
}
