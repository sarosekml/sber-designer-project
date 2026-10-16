import React from 'react';
import { Grid } from '@mui/material';
import {
  Text,
  Icon,
  IconButton,
  Page,
  ProgressBar,
  BadgeCounter,
  DictionaryBadge,
  Title,
} from '@/components/atoms';
import { BreadCrumbs } from '@/components/molecules';
import { BaseTile } from '@/components/molecules/Tiles';
import { Table } from '@/components/organisms/Tables';

/* ── Mock data (replace with real API bindings) ── */
const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'ECM Pipeline', route: '/ecm-pipeline' },
  { name: 'ECM-125. ООО «Газпром-инвест». Облигации привилегированные', route: '' },
];

interface PaymentRow {
  amount: string;
  date: string;
  status: string;
  paidDate: string;
}

const paymentColumns: { name: keyof PaymentRow; title: string }[] = [
  { name: 'amount', title: 'Сумма с НДС, млн руб.' },
  { name: 'date', title: 'Дата' },
  { name: 'status', title: 'Статус' },
  { name: 'paidDate', title: 'Дата оплаты' },
];

const paymentRows: PaymentRow[] = [
  { amount: '↗ 12.50', date: '15.09.2026', status: 'Ожидает', paidDate: '–' },
  { amount: '↗ 8.30', date: '01.12.2026', status: 'В обработке', paidDate: '–' },
  { amount: '↙ 5.75', date: '10.03.2027', status: 'Оплачен', paidDate: '10.03.2027' },
  { amount: '↗ 20.00', date: '20.06.2027', status: 'Отклонён', paidDate: '–' },
];

const documents = [
  { category: 'Договоры', count: 12 },
  { category: 'Акты', count: 5 },
  { category: 'Счета', count: 8 },
  { category: 'Счета-фактуры', count: 3 },
  { category: 'Акт сверки', count: 1 },
  { category: 'Прочие документы', count: 7 },
];

/* ── Screen ── */
export function TestNewHarness01() {
  return (
    <Page dataTestId="DealCardPage">
      {/* Breadcrumbs */}
      <BreadCrumbs
        dataTestId="DealCardBreadcrumbs"
        navigationSchema={breadcrumbs}
        onClickLink={() => {}}
      />

      {/* Header */}
      <Grid container alignItems="center" justifyContent="space-between" sx={{ mt: 2, mb: 1 }}>
        <Grid container alignItems="center" gap={1}>
          <Text type="H4StrongSmb">
            DCM-2025. ООО «Газпром-инвест». Облигации привилегированные
          </Text>
          <IconButton name="Edit" dataTestId="EditDealTitle" size="lg" />
        </Grid>
      </Grid>

      {/* Modification metadata */}
      <Grid container alignItems="center" gap={0.5} sx={{ mb: 2 }}>
        <Icon name="CheckCircle" />
        <Text type="BodySReg">Изменено 02.07.2025, 10:04, Сергеев И.П.</Text>
      </Grid>

      {/* TODO: add loading/empty/error states per block when bound to real data */}

      {/* Content grid */}
      <Grid container spacing={2}>

        {/* Block: Client */}
        <Grid item xs={6}>
          <BaseTile
            title="Клиент"
            size="md"
            variant="outlined"
            actions={<IconButton name="ArrowBlockRight" dataTestId="GoToClient" />}
          >
            <Grid container direction="column" gap={1}>
              <Grid container alignItems="center" gap={1}>
                <Text type="BodyMReg">ООО «Газпром-инвест»</Text>
                <DictionaryBadge
                  variant="outlined"
                  type="read"
                  size="sm"
                  component="Chip"
                  name="26"
                  code="26"
                />
              </Grid>
              <Text type="BodyMReg">КМ: Иванов Иван Иванович</Text>
              <Grid container alignItems="center" gap={0.5}>
                <Text type="BodyMReg">Табельный номер: 213456789</Text>
                <IconButton name="ArrowBlockRight" dataTestId="GoToEmployee" size="sm" />
              </Grid>
              <Grid container alignItems="center" gap={1}>
                <Text type="BodySReg">Название клиента:</Text>
                <Text type="BodyMReg">Тот кого нельзя называть</Text>
              </Grid>
              <Grid container alignItems="center" gap={1}>
                <Icon name="CheckCircle" />
                <Text type="BodySReg">Использовать как псевдоним</Text>
              </Grid>
            </Grid>
          </BaseTile>
        </Grid>

        {/* Block: Deal Terms */}
        <Grid item xs={6}>
          <BaseTile title="Условия сделки" size="md" variant="outlined">
            <Grid container direction="column" gap={1}>
              <Grid container alignItems="center" gap={1}>
                <Text type="BodySReg">Тип сделки:</Text>
                <DictionaryBadge variant="outlined" type="read" size="sm" component="Chip" name="DCM" code="DCM" />
              </Grid>
              <Text type="BodyMReg">Продукт: DCM</Text>
              <Text type="BodyMReg">Доход текущего года: 15.2 млн руб.</Text>
              <Text type="BodyMReg">Индикативный размер сделки: 500 млн руб.</Text>
              <Text type="BodyMReg">Ожидаемый доход: 45 млн руб.</Text>
              <Text type="BodyMReg">Ожидаемый доход с учётом вероятности: 27 млн руб.</Text>
              <Text type="BodyMReg">Ожидаемая дата дохода: 15.12.2026</Text>
              <Text type="BodyMReg" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Описание: Выпуск привилегированных облигаций для финансирования...
              </Text>
            </Grid>
          </BaseTile>
        </Grid>

        {/* Block: Stage */}
        <Grid item xs={6}>
          <BaseTile
            title="Стадия"
            size="md"
            variant="outlined"
            actions={<IconButton name="Edit" dataTestId="EditStage" />}
          >
            <Grid container direction="column" gap={1.5}>
              <Text type="BodyMReg">Стадия: Согласование коммерческих условий</Text>
              <Grid container alignItems="center" gap={1}>
                <Text type="BodySReg">Статус:</Text>
                <DictionaryBadge variant="outlined" type="read" size="sm" component="Chip" name="Активная" code="Активная" />
              </Grid>
              <Grid container direction="column" gap={0.5}>
                <Text type="BodySReg">Прогресс</Text>
                <ProgressBar value={25} label="25% (mock)" dataTestId="StageProgress" />
              </Grid>
              <Text type="BodyMReg">Вероятность сделки: Средняя</Text>
              <Text type="BodyMReg" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Комментарий: Ожидается утверждение коммерческих условий...
              </Text>
            </Grid>
          </BaseTile>
        </Grid>

        {/* Block: Issuer */}
        <Grid item xs={6}>
          <BaseTile
            title="Эмитент"
            size="md"
            variant="outlined"
            actions={<IconButton name="ArrowBlockRight" dataTestId="GoToIssuer" />}
          >
            <Grid container direction="column" gap={1}>
              <Grid container alignItems="center" gap={1}>
                <Text type="BodyMReg">АО «Газпром-Снабжение»</Text>
                <DictionaryBadge
                  variant="outlined"
                  type="read"
                  size="sm"
                  component="Chip"
                  name="26"
                  code="26"
                />
              </Grid>
              <Text type="BodyMReg">КМ: Петров Пётр Петрович</Text>
              <Grid container alignItems="center" gap={0.5}>
                <Text type="BodyMReg">Табельный номер: 213456790</Text>
                <IconButton name="ArrowBlockRight" dataTestId="GoToEmployeeIssuer" size="sm" />
              </Grid>
            </Grid>
          </BaseTile>
        </Grid>

        {/* Block: Payment Schedule */}
        <Grid item xs={12}>
          <BaseTile
            title="График платежей"
            size="md"
            variant="outlined"
            actions={<IconButton name="ArrowBlockRight" dataTestId="GoToPayments" />}
          >
            <Table
              dataTestId="DealCardPaymentSchedule"
              columns={paymentColumns}
              rows={paymentRows}
            />
          </BaseTile>
        </Grid>

        {/* Block: Deal Team */}
        <Grid item xs={6}>
          <BaseTile
            title="Команда сделки"
            size="md"
            variant="outlined"
            actions={<IconButton name="Edit" dataTestId="EditTeam" />}
          >
            <Grid container direction="column" gap={1}>
              <Grid container direction="column" gap={0.5}>
                <Title type="SubtitleBody">Сотрудники DCM</Title>
                <Text type="BodySReg">Сергеев И.П., Смирнов А.В.</Text>
              </Grid>
              <Grid container direction="column" gap={0.5}>
                <Title type="SubtitleBody">Менеджер</Title>
                <Text type="BodySReg">Иванов И.И.</Text>
              </Grid>
              <Grid container direction="column" gap={0.5}>
                <Title type="SubtitleBody">Сотрудники сторонних подразделений</Title>
                <Text type="BodySReg">Кузнецов А.А., Попов Д.В.</Text>
              </Grid>
              <Grid container direction="column" gap={0.5}>
                <Title type="SubtitleBody">Менеджер (сторонний)</Title>
                <Text type="BodySReg">Сидоров М.Е.</Text>
              </Grid>
            </Grid>
          </BaseTile>
        </Grid>

        {/* Block: Documents */}
        <Grid item xs={6}>
          <BaseTile
            title="Документы"
            size="md"
            variant="outlined"
            actions={<IconButton name="ArrowBlockRight" dataTestId="GoToDocuments" />}
          >
            <Grid container direction="column" gap={1}>
              {documents.map((doc) => (
                <Grid key={doc.category} container alignItems="center" justifyContent="space-between">
                  <Text type="BodyMReg">{doc.category}</Text>
                  <BadgeCounter size="sm" counter={doc.count} />
                </Grid>
              ))}
            </Grid>
          </BaseTile>
        </Grid>

      </Grid>
    </Page>
  );
}