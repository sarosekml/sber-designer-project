import React from 'react';
import { Grid } from '@mui/material';
import { Text, Icon, IconButton, Page } from '@/components/atoms';
import { Button } from '@/components/atoms/buttons/Button/Button';
import { BreadCrumbs } from '@/components/molecules';
import { BaseTile } from '@/components/molecules/Tiles';
import { Table } from '@/components/organisms/Tables';

/* ── Breadcrumbs ── */
const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'Потенциалы DCM', route: '/dcm-potentials' },
  { name: 'Черновик сделки DCM: Кредит № 4B02-04-01669-A-001P', route: '' },
];

/* ── Holding potentials table columns & rows ── */
const potentialsColumns = [
  { name: 'potential', title: 'Потенциал' },
  { name: 'amount', title: 'Сумма, млн руб.' },
  { name: 'rate', title: 'Процентная ставка' },
  { name: 'maturityDate', title: 'Дата погашения' },
  { name: 'reason', title: 'Причина' },
  { name: 'actions', title: 'Действия' },
];

const potentialsRows = [
  { potential: 'АФК «Система» Потенциалов: 5, Сумма: 120 млн руб.', amount: '', rate: '', maturityDate: '', reason: '', actions: '' },
  { potential: '  ПАО АФК «Система» Потенциалов: 2, Сумма: 60 млн руб.', amount: '', rate: '', maturityDate: '', reason: '', actions: '' },
  { potential: '    Кредит', amount: '20', rate: '23 %', maturityDate: '15.09.2026', reason: 'Финансирование к погашению', actions: '' },
  { potential: '    Облигация в валюте', amount: '40', rate: 'КС + 1,9 %', maturityDate: '28.09.2026', reason: 'Финансирование к погашению', actions: '' },
  { potential: '  ПАО «МТС» Потенциалов: 3, Сумма: 330 млн руб.', amount: '', rate: '', maturityDate: '', reason: '', actions: '' },
  { potential: '    Кредит', amount: '20', rate: '19 %', maturityDate: '10.09.2026', reason: 'Финансирование к погашению', actions: '' },
  { potential: '    Облигация в валюте', amount: '300', rate: 'КС + 3 %', maturityDate: '01.09.2026', reason: 'Финансирование к погашению', actions: '' },
];

/* ── Screen ── */
export function DCMDraftTest01() {
  return (
    <Page dataTestId="DcmDraftDealPage" sx={{ backgroundColor: 'var(--BGPageLinearStart, #f5f5f5)', minHeight: '100vh' }}>
      <BreadCrumbs dataTestId="DcmDraftDealBreadcrumbs" navigationSchema={breadcrumbs} onClickLink={() => {}} />

      <Grid container alignItems="center" justifyContent="space-between" sx={{ mt: 2, mb: 1 }}>
        <Grid container alignItems="center" gap={1}>
          <Text type="H4StrongSmb">Черновик сделки DCM: Кредит № 4B02-04-01669-A-001P</Text>
          <IconButton name="Edit" dataTestId="EditDraftTitle" size="lg" />
        </Grid>
        <Grid container gap={1}>
          <Button type="accent" startIcon="DocumentCheck">Перевести в сделку DCM</Button>
          <IconButton name="MoreDots" dataTestId="DraftMoreActions" size="lg" />
        </Grid>
      </Grid>

      <Grid container alignItems="center" gap={0.5} sx={{ mb: 2 }}>
        <Icon name="CheckCircle" />
        <Text type="BodySReg">Изменено 02.07.2025, 10:04, Сергеев И.П.</Text>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={6}>
          <BaseTile title="Клиент" size="md" variant="outlined" actions={<IconButton name="ArrowBlockRight" dataTestId="GoToClient" />}>
            <Grid container direction="column" gap={1}>
              <Text type="BodyMReg">Наименование: ПАО АФК «Система»</Text>
              <Text type="BodyMReg">Отрасль: Ретейл</Text>
              <Text type="BodyMReg">КМ: Иванов И.И.</Text>
              <Text type="BodyMReg">Табельный номер: 213456789</Text>
              <Text type="BodyMReg">ТБ: Среднерусский банк</Text>
            </Grid>
          </BaseTile>
        </Grid>

        <Grid item xs={6}>
          <BaseTile title="Условия кредита" size="md" variant="outlined">
            <Grid container direction="column" gap={1}>
              <Text type="BodyMReg">Сумма финансирования: 20 млн руб.</Text>
              <Text type="BodyMReg">Остаток задолженности: 9,95 млн руб.</Text>
              <Text type="BodyMReg">Процентная ставка: 23 %</Text>
              <Text type="BodyMReg">Дата погашения: 12.12.2025</Text>
              <Text type="BodyMReg">Номер договора: 4B02-04-01669-A-001P</Text>
              <Text type="BodyMReg">Тип: 931 Корпоративное кредитование</Text>
            </Grid>
          </BaseTile>
        </Grid>

        <Grid item xs={6}>
          <BaseTile title="Холдинг" size="md" variant="outlined" actions={<IconButton name="ArrowBlockRight" dataTestId="GoToHolding" />}>
            <Grid container direction="column" gap={1}>
              <Text type="BodyMReg">Наименование: АФК «Система»</Text>
              <Text type="BodyMReg">КМ Холдинга: Петров И.И.</Text>
              <Text type="BodyMReg">Табельный номер: 213456790</Text>
              <Text type="BodyMReg">ТБ: Среднерусский банк</Text>
            </Grid>
          </BaseTile>
        </Grid>

        <Grid item xs={6}>
          <BaseTile title="Комментарии" size="md" variant="outlined" actions={<IconButton name="Edit" dataTestId="EditComment" />}>
            <Text type="BodyMReg">
              Пришли к выводу, что можно предложить выпуск облигаций в качестве основного продукта, а также будет дополнительное соглашение на выкуп облигаций банком.
            </Text>
          </BaseTile>
        </Grid>

        <Grid item xs={12}>
          <BaseTile title="Потенциалы холдинга" size="md" variant="outlined">
            <Table dataTestId="DcmDraftDeal_HoldingPotentials" columns={potentialsColumns} rows={potentialsRows} />
          </BaseTile>
        </Grid>
      </Grid>
    </Page>
  );
}
