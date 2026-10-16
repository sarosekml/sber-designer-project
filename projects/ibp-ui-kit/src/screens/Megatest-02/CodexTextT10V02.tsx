import React from 'react';
import { BadgeCounter, DictionaryBadge, Grid, Icon, IconButton, ProgressBar, Text } from '@/components/atoms';
import type { IconName } from '@/components/atoms/Icon/Icon.types';
import type { BadgeColorThemeSx } from '@/components/atoms/DictionaryBadge';
import { BreadCrumbs } from '@/components/molecules';
import { Tile } from '@/components/molecules/Tiles/Tile';

const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'ECM Pipeline', route: '/ecm-pipeline' },
  { name: 'ECM-125. ООО "Газпром-инвест". Облигации привилегированные', route: '' },
];

const deal = {
  title: 'DCM-2025. ООО "Газпром-инвест". Облигации привилегированные',
  changedDate: '21.02.2025',
  changedTime: '01:08',
  changedBy: 'Иванов П.П.',
};

const client = {
  name: 'ООО "Газпром-инвест"',
  badge: 26,
  badgeTone: 'error' as const,
  manager: 'Иванов И.И.',
  employeeId: '213456789',
  alias: 'Тот кого нельзя называть',
  useAlias: true,
};

const issuer = {
  name: 'ООО "Россети Финанс"',
  badge: 26,
  badgeTone: 'success' as const,
  manager: 'Петрова А.В.',
  employeeId: '217654321',
};

const dealTerms = {
  type: 'DCM',
  product: 'DCM',
  currentYearIncome: '32,76',
  indicativeSize: '1,5',
  expectedIncome: '32,76',
  expectedIncomeWithProbability: '2,50',
  expectedIncomeDate: '13.06.2024',
  description:
    'Собственник уехал в Майами. Прогнозы по бизнесу умеренно негативные, в том числе из-за ухудшения контроля: МСФО не готовили, цифрам из РСБУ сильно доверять не стоит.',
};

const stage = {
  name: 'Согласование коммерческих условий',
  status: 'Активная',
  progress: 0,
  probability: 'Низкая',
  comment: 'На неделе с 5 февраля планируется site visit, идёт подготовка маркетинговых документов.',
};

const issueTerms = {
  isin: 'RU000A0JSGV0',
  name: 'Россети1Р13',
  nominal: '1 000 руб.',
  volume: '300 000',
  financeAmount: '300,00 млн руб.',
  rate: 'RUONIA + 2 %',
  couponsPerYear: '12',
  issueDate: '10.10.2020',
  maturityDate: '15.10.2028',
  offerDate: '15.10.2025',
  rating: 'AA (АКРА РА) от 13.10.2024',
};

type PaymentDirection = 'in' | 'out';

interface PaymentItem {
  amount: string;
  direction: PaymentDirection;
  date: string;
  status: 'scheduled' | 'processing' | 'paid' | 'partial' | 'rejected' | 'paidWithNote';
  paidDate: string;
}

const payments: PaymentItem[] = [
  { amount: '4,7', direction: 'out', date: '28.07.2024', status: 'scheduled', paidDate: '–' },
  { amount: '1,4', direction: 'in', date: '28.08.2024', status: 'processing', paidDate: '–' },
  { amount: '3,2', direction: 'out', date: '28.09.2024', status: 'paid', paidDate: '06.03.2026' },
  { amount: '5,1', direction: 'out', date: '28.10.2024', status: 'paidWithNote', paidDate: '06.03.2026' },
  { amount: '9,7', direction: 'in', date: '28.11.2024', status: 'rejected', paidDate: '–' },
];

const paymentStatusMeta: Record<PaymentItem['status'], { icon: IconName; label: string; color: string }> = {
  scheduled: { icon: 'ClockTimer', label: 'Запланирован', color: '#6B7280' },
  processing: { icon: 'ArrowNarrowRight', label: 'В обработке', color: '#1D4ED8' },
  paid: { icon: 'CheckCircleFilled', label: 'Оплачен', color: '#2E7D32' },
  partial: { icon: 'InfoCircle', label: 'Частично оплачен', color: '#1D4ED8' },
  rejected: { icon: 'CloseCircle', label: 'Отклонён', color: '#D32F2F' },
  paidWithNote: { icon: 'InfoCircle', label: 'Оплачен с замечанием', color: '#2E7D32' },
};

const team = {
  dcmEmployees: ['Иванов В.И.', 'Смирнова Е.К.'],
  manager: 'Константинопольский К.К.',
  externalEmployees: ['Юридический департамент', 'Back-office DCM'],
  externalManager: 'Петров К.И.',
};

const documents = [
  { category: 'Договоры', count: 1 },
  { category: 'Акты', count: 8 },
  { category: 'Счета', count: 3 },
  { category: 'Счета-фактуры', count: 2 },
  { category: 'Акт сверки', count: 1 },
  { category: 'Прочие документы', count: 1 },
];

type BadgeTone = 'primary' | 'success' | 'error';

const badgeColorThemes: Record<BadgeTone, BadgeColorThemeSx> = {
  primary: (theme) => ({
    backgroundColor: 'transparent',
    borderColor: theme.palette.Primary.Primary,
    textColor: theme.palette.Primary.PrimaryDark,
    backgroundColorHover: theme.palette.Primary.PrimaryBGLight,
    borderColorHover: theme.palette.Primary.PrimaryDark,
  }),
  success: (theme) => ({
    backgroundColor: theme.palette.Success.SuccessBG,
    borderColor: theme.palette.Success.SuccessDark,
    textColor: theme.palette.Text.TextBlack,
    backgroundColorHover: theme.palette.Success.SuccessBG,
    borderColorHover: theme.palette.Success.SuccessDark,
  }),
  error: (theme) => ({
    backgroundColor: theme.palette.Error.ErrorBG,
    borderColor: theme.palette.Error.ErrorBGDark,
    textColor: theme.palette.Text.TextBlack,
    backgroundColorHover: theme.palette.Error.ErrorBGDark,
    borderColorHover: theme.palette.Error.ErrorDark,
  }),
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Grid container alignItems="baseline" justifyContent="space-between" gap={1} sx={{ mb: 1.25 }}>
      <Text type="BodyXSReg" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Grid item sx={{ minWidth: 0, maxWidth: '62%', textAlign: 'right' }}>
        {children}
      </Grid>
    </Grid>
  );
}

function Amount({ children }: { children: React.ReactNode }) {
  return <Text type="BodyMReg">{children}</Text>;
}

function StatusBadge({ code, name, tone = 'primary' }: { code: string; name?: string; tone?: BadgeTone }) {
  return (
    <DictionaryBadge
      code={code}
      name={name ?? code}
      component="Marker"
      size="sm"
      type="read"
      hoverable={false}
      colorThemeSx={badgeColorThemes[tone]}
    />
  );
}

function EmployeeLink({ value }: { value: string }) {
  return (
    <Grid container alignItems="center" justifyContent="flex-end" gap={0.5} flexWrap="nowrap">
      <Text type="BodyXSReg">{value}</Text>
      <Icon name="LinkExternal" size="sm" sx={{ color: 'primary.main', fontSize: 14 }} />
    </Grid>
  );
}

function DirectionAmount({ direction, amount }: Pick<PaymentItem, 'amount' | 'direction'>) {
  const icon: IconName = direction === 'in' ? 'ArrowNarrowDownRight' : 'ArrowNarrowUpRight';
  const color = direction === 'in' ? '#2E7D32' : '#D32F2F';

  return (
    <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
      <Icon name={icon} size="sm" sx={{ color, fontSize: 16 }} />
      <Text type="BodyXSReg">{amount}</Text>
    </Grid>
  );
}

function PaymentStatus({ status }: { status: PaymentItem['status'] }) {
  const meta = paymentStatusMeta[status];

  return (
    <Grid container alignItems="center" gap={0.5} flexWrap="nowrap" title={meta.label}>
      <Icon name={meta.icon} size="sm" sx={{ color: meta.color, fontSize: 17 }} />
      <Text type="BodyXSReg" sx={{ display: { xs: 'none', xl: 'block' } }}>
        {meta.label}
      </Text>
    </Grid>
  );
}

function PersonSummary({
  name,
  badge,
  badgeTone,
  manager,
  employeeId,
}: {
  name: string;
  badge: number;
  badgeTone: BadgeTone;
  manager: string;
  employeeId: string;
}) {
  return (
    <>
      <Grid container alignItems="center" gap={1} sx={{ mb: 1.5 }} flexWrap="nowrap">
        <Text type="BodyMReg" sx={{ minWidth: 0 }}>
          {name}
        </Text>
        <StatusBadge code={String(badge)} tone={badgeTone} />
      </Grid>
      <FieldRow label="КМ">
        <Text type="BodyXSReg">{manager}</Text>
      </FieldRow>
      <FieldRow label="Табельный номер">
        <EmployeeLink value={employeeId} />
      </FieldRow>
    </>
  );
}

export function CodexTextT10V02() {
  return (
    <main
      data-sd-screen-root="true"
      aria-label="Deal Card — Карточка сделки"
      style={{ minHeight: '100vh', background: '#F5F5F5', color: '#111827' }}
    >
      <Grid sx={{ px: { xs: 2, md: 3 }, pt: 2 }}>
        <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} />
      </Grid>

      <Grid sx={{ px: { xs: 2, md: 3 }, py: 1.5 }}>
        <Grid container alignItems="flex-start" justifyContent="space-between" gap={2}>
          <Grid item xs={12} lg={8}>
            <Grid container alignItems="center" gap={1} flexWrap="nowrap">
              <Text type="H3StrongSmb" sx={{ minWidth: 0 }}>
                {deal.title}
              </Text>
              <IconButton name="Edit" size="sm" onClick={() => {}} title="Редактировать заголовок" />
            </Grid>
          </Grid>
          <Grid item xs={12} lg="auto">
            <Grid container alignItems="center" justifyContent={{ xs: 'flex-start', lg: 'flex-end' }} gap={0.75}>
              <Icon name="CheckCircleFilled" size="sm" sx={{ color: '#2E7D32', fontSize: 15 }} />
              <Text type="BodyXSReg" color="text.secondary">
                Изменено {deal.changedDate}, {deal.changedTime}, {deal.changedBy}
              </Text>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ px: { xs: 2, md: 3 }, pb: 4 }}>
        <Grid item xs={12} md={4}>
          <Tile
            title="Клиент"
            dataTestId="tile-client"
            actions={<IconButton name="ArrowNarrowRight" size="sm" onClick={() => {}} title="Перейти к клиенту" />}
          >
            <PersonSummary {...client} />
            <FieldRow label="Название клиента">
              <Text type="BodyXSReg">{client.alias}</Text>
            </FieldRow>
            <FieldRow label="Использовать как псевдоним">
              <Grid container alignItems="center" justifyContent="flex-end" gap={0.5} flexWrap="nowrap">
                <Icon
                  name={client.useAlias ? 'CheckBox' : 'CheckBoxBlank'}
                  size="sm"
                  sx={{ color: client.useAlias ? 'primary.main' : 'text.disabled', fontSize: 18 }}
                />
                <Text type="BodyXSReg" color={client.useAlias ? 'text.primary' : 'text.disabled'}>
                  Включено
                </Text>
              </Grid>
            </FieldRow>
          </Tile>
        </Grid>

        <Grid item xs={12} md={5}>
          <Tile title="Условия сделки" dataTestId="tile-deal-terms">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FieldRow label="Тип сделки">
                  <StatusBadge code={dealTerms.type} />
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FieldRow label="Продукт">
                  <Text type="BodyXSReg">{dealTerms.product}</Text>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FieldRow label="Доход текущего года">
                  <Amount>{dealTerms.currentYearIncome} млн руб.</Amount>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FieldRow label="Индикативный размер сделки">
                  <Amount>{dealTerms.indicativeSize} млн руб.</Amount>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FieldRow label="Ожидаемый доход">
                  <Amount>{dealTerms.expectedIncome} млн руб.</Amount>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FieldRow label="С учётом вероятности">
                  <Amount>{dealTerms.expectedIncomeWithProbability} млн руб.</Amount>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FieldRow label="Дата дохода">
                  <Amount>{dealTerms.expectedIncomeDate}</Amount>
                </FieldRow>
              </Grid>
            </Grid>
            <Grid sx={{ mt: 0.5 }}>
              <Text type="BodyXSReg" color="text.secondary" sx={{ mb: 0.5 }}>
                Описание
              </Text>
              <Text
                type="BodyXSReg"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {dealTerms.description}
              </Text>
            </Grid>
          </Tile>
        </Grid>

        <Grid item xs={12} md={3}>
          <Tile
            title="Стадия"
            dataTestId="tile-stage"
            actions={<IconButton name="Edit" size="sm" onClick={() => {}} title="Редактировать стадию" />}
          >
            <FieldRow label="Стадия">
              <Text type="BodyXSReg">{stage.name}</Text>
            </FieldRow>
            <FieldRow label="Статус">
              <StatusBadge code="active" name={stage.status} tone="success" />
            </FieldRow>
            <Grid sx={{ mb: 1.5 }}>
              <Grid container justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Text type="BodyXSReg" color="text.secondary">
                  Прогресс
                </Text>
                <Text type="BodyXSReg">{stage.progress}%</Text>
              </Grid>
              <ProgressBar value={stage.progress} />
            </Grid>
            <FieldRow label="Вероятность сделки">
              <Text type="BodyXSReg">{stage.probability}</Text>
            </FieldRow>
            <Grid>
              <Text type="BodyXSReg" color="text.secondary" sx={{ mb: 0.5 }}>
                Комментарий
              </Text>
              <Text type="BodyXSReg">{stage.comment}</Text>
            </Grid>
          </Tile>
        </Grid>

        <Grid item xs={12} md={4}>
          <Tile
            title="Эмитент"
            dataTestId="tile-issuer"
            actions={<IconButton name="ArrowNarrowRight" size="sm" onClick={() => {}} title="Перейти к эмитенту" />}
          >
            <PersonSummary {...issuer} />
          </Tile>
        </Grid>

        <Grid item xs={12} md={5}>
          <Tile
            title="Условия выпуска"
            dataTestId="tile-issue-terms"
            actions={<IconButton name="Edit" size="sm" onClick={() => {}} title="Редактировать условия выпуска" />}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FieldRow label="ISIN">
                  <Text type="BodyXSReg">{issueTerms.isin}</Text>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FieldRow label="Наименование">
                  <Text type="BodyXSReg">{issueTerms.name}</Text>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FieldRow label="Номинальная стоимость">
                  <Amount>{issueTerms.nominal}</Amount>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FieldRow label="Объём выпуска">
                  <Amount>{issueTerms.volume}</Amount>
                </FieldRow>
              </Grid>
            </Grid>
            <FieldRow label="Сумма финансирования, валюта номинала">
              <Amount>{issueTerms.financeAmount}</Amount>
            </FieldRow>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FieldRow label="Процентная ставка">
                  <Amount>{issueTerms.rate}</Amount>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FieldRow label="Кол-во купонов в год">
                  <Amount>{issueTerms.couponsPerYear}</Amount>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FieldRow label="Дата выпуска">
                  <Text type="BodyXSReg">{issueTerms.issueDate}</Text>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FieldRow label="Дата оферты">
                  <Text type="BodyXSReg">{issueTerms.offerDate}</Text>
                </FieldRow>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FieldRow label="Дата погашения">
                  <Text type="BodyXSReg">{issueTerms.maturityDate}</Text>
                </FieldRow>
              </Grid>
            </Grid>
            <FieldRow label="Рейтинг эмиссии">
              <Grid container alignItems="center" justifyContent="flex-end" gap={0.5} flexWrap="nowrap">
                <StatusBadge code="AA" tone="success" />
                <Text type="BodyXSReg">(АКРА РА) от 13.10.2024</Text>
              </Grid>
            </FieldRow>
          </Tile>
        </Grid>

        <Grid item xs={12} md={3}>
          <Tile
            title="График платежей"
            dataTestId="tile-payments"
            actions={
              <IconButton name="ArrowNarrowRight" size="sm" onClick={() => {}} title="Открыть график платежей" />
            }
          >
            <Grid container sx={{ mb: 1 }}>
              <Grid item xs={3}>
                <Text type="BodyXSReg" color="text.secondary">
                  Сумма
                </Text>
              </Grid>
              <Grid item xs={3}>
                <Text type="BodyXSReg" color="text.secondary">
                  Дата
                </Text>
              </Grid>
              <Grid item xs={3}>
                <Text type="BodyXSReg" color="text.secondary">
                  Статус
                </Text>
              </Grid>
              <Grid item xs={3}>
                <Text type="BodyXSReg" color="text.secondary">
                  Оплата
                </Text>
              </Grid>
            </Grid>
            {payments.map((payment, index) => (
              <Grid
                key={`${payment.date}-${index}`}
                container
                alignItems="center"
                sx={{ borderTop: index === 0 ? 'none' : '1px solid #E5E7EB', py: 0.75 }}
              >
                <Grid item xs={3}>
                  <DirectionAmount amount={payment.amount} direction={payment.direction} />
                </Grid>
                <Grid item xs={3}>
                  <Text type="BodyXSReg">{payment.date}</Text>
                </Grid>
                <Grid item xs={3}>
                  <PaymentStatus status={payment.status} />
                </Grid>
                <Grid item xs={3}>
                  <Text type="BodyXSReg">{payment.paidDate}</Text>
                </Grid>
              </Grid>
            ))}
          </Tile>
        </Grid>

        <Grid item xs={12} md={4}>
          <Tile
            title="Команда сделки"
            dataTestId="tile-team"
            actions={<IconButton name="Edit" size="sm" onClick={() => {}} title="Редактировать команду" />}
          >
            <Text type="BodyXSReg" color="text.secondary" sx={{ mb: 0.5 }}>
              Сотрудники DCM
            </Text>
            <Text type="BodyMReg" sx={{ mb: 1.5 }}>
              {team.dcmEmployees.join(', ')}
            </Text>
            <Text type="BodyXSReg" color="text.secondary" sx={{ mb: 0.5 }}>
              Менеджер
            </Text>
            <Text type="BodyMReg" sx={{ mb: 1.5 }}>
              {team.manager}
            </Text>
            <Text type="BodyXSReg" color="text.secondary" sx={{ mb: 0.5 }}>
              Сотрудники сторонних подразделений
            </Text>
            <Text type="BodyMReg" sx={{ mb: 1.5 }}>
              {team.externalEmployees.join(', ')}
            </Text>
            <Text type="BodyXSReg" color="text.secondary" sx={{ mb: 0.5 }}>
              Менеджер сторонний
            </Text>
            <Text type="BodyMReg">{team.externalManager}</Text>
          </Tile>
        </Grid>

        <Grid item xs={12} md={4}>
          <Tile
            title="Документы"
            dataTestId="tile-documents"
            actions={<IconButton name="ArrowNarrowRight" size="sm" onClick={() => {}} title="Открыть документы" />}
          >
            {documents.map((document) => (
              <Grid
                key={document.category}
                container
                alignItems="center"
                justifyContent="space-between"
                sx={{ borderBottom: '1px solid #E5E7EB', py: 0.75 }}
              >
                <Text type="BodyMReg">{document.category}</Text>
                <BadgeCounter counter={document.count} size="sm" />
              </Grid>
            ))}
          </Tile>
        </Grid>
      </Grid>
    </main>
  );
}
