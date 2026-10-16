import React from 'react';
import { Grid, Text, Icon, IconButton, BadgeCounter, ProgressBar } from '@/components/atoms';
import { BreadCrumbs } from '@/components/molecules';
import { Tile } from '@/components/molecules/Tiles/Tile';
import type { IconName } from '@/components/atoms/Icon/Icon.types';

const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'ECM Pipeline', route: '/ecm-pipeline' },
  { name: 'ECM-125. ООО "Газпром-сервис". Акции привилегированные', route: '' },
];

const deal = {
  title: 'DCM-2025. ООО "Газпром-инвест". Облигации привилегированные',
  changedDate: '21.02.2025',
  changedTime: '01:08',
  changedBy: 'Иванов П.П.',
};

const client = {
  name: 'ООО "Ромашка"',
  badge: 26,
  km: 'Иванов И.И.',
  tabNumber: '213456789',
  alias: 'Тот кого нельзя называть',
  useAlias: true,
};

const dealTerms = {
  type: 'DCM',
  product: 'DCM',
  currentYearIncome: '32,76',
  indicativeSize: '1,5',
  expectedIncome: '32,76',
  expectedIncomeAdj: '2,5',
  expectedDate: '13.06.2024',
  description:
    'Собственник уехал в Майами: Прогнозы по бизнесу умеренно негативные, в том числе из-за ухудшения контроля: м с ф о не готовили: цифрам из РСБУ сильно доверять не стоит...',
};

const stage = {
  name: 'Согласование коммерческих условий',
  status: 'Активная',
  progress: 0,
  probability: 'Низкая',
  comment: 'На неделе с 5 февраля планируется site visit, идёт подготовка маркетинговых документов',
};

const issuer = {
  name: 'ООО "Ромашка"',
  badge: 26,
  km: 'Иванов И.И.',
  tabNumber: '213456789',
};

const issuance = {
  isin: 'RU000A0JSGV0',
  name: 'Россети1Р13',
  nominal: '1000',
  volume: '300 000',
  financeAmount: '3 000',
  currency: 'млн руб.',
  rate: 'RUONIA + 2 %',
  couponsPerYear: '12',
  issueDate: '10.10.2020',
  maturityDate: '15.10.2028',
  offerDate: '15.10.2025',
  rating: 'AA (АКРА РА) от 13.10.2024',
};

type PaymentDirection = 'in' | 'out';

interface PaymentItem {
  sum: string;
  direction: PaymentDirection;
  date: string;
  status: string;
  paidDate: string;
}

const payments: PaymentItem[] = [
  { sum: '4,7', direction: 'out', date: '28.07.2024', status: 'scheduled', paidDate: '–' },
  { sum: '1,4', direction: 'in', date: '28.08.2024', status: 'processing', paidDate: '–' },
  { sum: '3,2', direction: 'out', date: '28.09.2024', status: 'paid', paidDate: '06.03.2026' },
  { sum: '5,1', direction: 'out', date: '28.10.2024', status: 'paid-with-note', paidDate: '06.03.2026' },
  { sum: '9,7', direction: 'in', date: '28.11.2024', status: 'rejected', paidDate: '–' },
  { sum: '1,2', direction: 'out', date: '28.12.2024', status: 'paid', paidDate: '06.03.2026' },
];

const team = {
  dcm: 'Иванов В.И.',
  manager: 'Константинопольский К.К.',
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

const statusMeta: Record<string, { icon: IconName; color: string }> = {
  'scheduled': { icon: 'ClockTimer', color: '#9CA3AF' },
  'processing': { icon: 'ArrowNarrowRight', color: '#3B82F6' },
  'paid': { icon: 'CheckCircleFilled', color: '#10B981' },
  'paid-with-note': { icon: 'InfoCircle', color: '#3B82F6' },
  'rejected': { icon: 'CloseCircle', color: '#EF4444' },
};

function DirectionIcon({ direction }: { direction: PaymentDirection }) {
  const icon: IconName = direction === 'in' ? 'ArrowNarrowDownRight' : 'ArrowNarrowUpRight';
  const color = direction === 'in' ? '#10B981' : '#EF4444';
  return <Icon name={icon} size="sm" sx={{ color, fontSize: 16 }} />;
}

function StatusIcon({ status }: { status: string }) {
  const meta = statusMeta[status];
  if (!meta) return <Text type="BodyXSReg">—</Text>;
  return <Icon name={meta.icon} size="sm" sx={{ color: meta.color, fontSize: 18 }} />;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Grid container alignItems="baseline" justifyContent="space-between" sx={{ mb: 1.5 }}>
      <Text type="BodyXSReg" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Grid item sx={{ textAlign: 'right', maxWidth: '60%' }}>
        {children}
      </Grid>
    </Grid>
  );
}

export function OpencodeTextT7V02() {
  return (
    <main
      data-sd-screen-root="true"
      aria-label="Deal Card — Карточка сделки"
      style={{ minHeight: '100vh', background: '#F5F5F5' }}
    >
      <Grid sx={{ width: '100%', maxWidth: 1360, mx: 'auto', px: { xs: 2, md: 3 }, pt: 2, pb: 4 }}>
        <Grid sx={{ pb: 1 }}>
          <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} />
        </Grid>

        <Grid sx={{ py: 1 }}>
          <Grid container alignItems="flex-start" justifyContent="space-between" gap={2}>
            <Grid item xs={12} lg={8}>
              <Grid container alignItems="center" gap={1.5} flexWrap="nowrap">
                <Text type="H3StrongSmb" sx={{ minWidth: 0 }}>
                  {deal.title}
                </Text>
                <IconButton name="Edit" size="sm" title="Редактировать заголовок" />
              </Grid>
            </Grid>
            <Grid item xs={12} lg="auto">
              <Grid container alignItems="center" justifyContent={{ xs: 'flex-start', lg: 'flex-end' }} gap={0.5}>
                <Icon name="CheckCircleFilled" size="sm" sx={{ color: '#10B981', fontSize: 14 }} />
                <Text type="BodyXSReg" color="text.secondary">
                  Изменено {deal.changedDate}, {deal.changedTime}, {deal.changedBy}
                </Text>
              </Grid>
            </Grid>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          {/* ── Row 1 ── */}
          <Grid item xs={12} md={4}>
            <Tile
              title="Клиент"
              dataTestId="tile-client"
              actions={<IconButton name="ArrowNarrowRight" size="sm" onClick={() => {}} title="Перейти" />}
            >
              <Grid container alignItems="center" gap={1} sx={{ mb: 1.5 }}>
                <Text type="BodyMReg">{client.name}</Text>
                <BadgeCounter counter={client.badge} size="sm" />
              </Grid>
              <FieldRow label="КМ">
                <Text type="BodyXSReg">{client.km}</Text>
              </FieldRow>
              <FieldRow label="Табельный номер">
                <Grid container alignItems="center" gap={0.5} justifyContent="flex-end">
                  <Text type="BodyXSReg">{client.tabNumber}</Text>
                  <Icon name="LinkExternal" size="sm" sx={{ fontSize: 14, color: 'primary.main', cursor: 'pointer' }} />
                </Grid>
              </FieldRow>
              <FieldRow label="Название клиента">
                <Text type="BodyXSReg">{client.alias}</Text>
              </FieldRow>
              <FieldRow label="Использовать как псевдоним">
                <Grid container alignItems="center" gap={0.5} justifyContent="flex-end">
                  <Icon
                    name={client.useAlias ? 'CheckBox' : 'CheckBoxBlank'}
                    size="sm"
                    sx={{ fontSize: 18, color: client.useAlias ? 'primary.main' : 'text.disabled' }}
                  />
                  <Text type="BodyXSReg" color={client.useAlias ? 'text.primary' : 'text.disabled'}>
                    Использовать как псевдоним
                  </Text>
                </Grid>
              </FieldRow>
            </Tile>
          </Grid>

          <Grid item xs={12} md={5}>
            <Tile title="Условия сделки" dataTestId="tile-deal-terms">
              <Grid container spacing={2} sx={{ mb: 1.5 }}>
                <Grid item xs={6}>
                  <FieldRow label="Тип сделки">
                    <Grid
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        px: 1,
                        py: 0.25,
                        border: '1px solid #3B82F6',
                        borderRadius: 12,
                        color: '#3B82F6',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {dealTerms.type}
                    </Grid>
                  </FieldRow>
                </Grid>
                <Grid item xs={6}>
                  <FieldRow label="Продукт">
                    <Text type="BodyXSReg">{dealTerms.product}</Text>
                  </FieldRow>
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mb: 1.5 }}>
                <Grid item xs={6}>
                  <FieldRow label="Доход текущего года">
                    <Text type="BodyMReg">
                      {dealTerms.currentYearIncome}{' '}
                      <Text type="BodyXSReg" color="text.secondary">
                        млн руб.
                      </Text>
                    </Text>
                  </FieldRow>
                </Grid>
                <Grid item xs={6}>
                  <FieldRow label="Индикативный размер сделки">
                    <Text type="BodyMReg">
                      {dealTerms.indicativeSize}{' '}
                      <Text type="BodyXSReg" color="text.secondary">
                        млн руб.
                      </Text>
                    </Text>
                  </FieldRow>
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mb: 1.5 }}>
                <Grid item xs={4}>
                  <FieldRow label="Ожидаемый доход">
                    <Text type="BodyMReg">
                      {dealTerms.expectedIncome}{' '}
                      <Text type="BodyXSReg" color="text.secondary">
                        млн руб.
                      </Text>
                    </Text>
                  </FieldRow>
                </Grid>
                <Grid item xs={4}>
                  <FieldRow label="Ожидаемый доход с учётом вероятности">
                    <Text type="BodyMReg">
                      {dealTerms.expectedIncomeAdj}{' '}
                      <Text type="BodyXSReg" color="text.secondary">
                        млн руб.
                      </Text>
                    </Text>
                  </FieldRow>
                </Grid>
                <Grid item xs={4}>
                  <FieldRow label="Ожидаемая дата дохода">
                    <Text type="BodyMReg">{dealTerms.expectedDate}</Text>
                  </FieldRow>
                </Grid>
              </Grid>
              <FieldRow label="Описание">
                <Text type="BodyXSReg" sx={{ textAlign: 'right' }}>
                  {dealTerms.description}
                </Text>
              </FieldRow>
            </Tile>
          </Grid>

          <Grid item xs={12} md={3}>
            <Tile
              title="Стадия"
              dataTestId="tile-stage"
              actions={<IconButton name="Edit" size="sm" onClick={() => {}} title="Редактировать" />}
            >
              <FieldRow label="Стадия">
                <Text type="BodyXSReg">{stage.name}</Text>
              </FieldRow>
              <FieldRow label="Статус">
                <Grid
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1.5,
                    py: 0.25,
                    border: '1px solid #D1D5DB',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                >
                  {stage.status}
                </Grid>
              </FieldRow>
              <Grid sx={{ mb: 1.5 }}>
                <ProgressBar value={stage.progress} />
                <Text type="BodyXSReg" color="text.secondary" sx={{ mt: 0.5 }}>
                  Вероятность сделки: {stage.probability}
                </Text>
              </Grid>
              <FieldRow label="Комментарий">
                <Text type="BodyXSReg" sx={{ textAlign: 'right' }}>
                  {stage.comment}
                </Text>
              </FieldRow>
            </Tile>
          </Grid>

          {/* ── Row 2 ── */}

          <Grid item xs={12} md={4}>
            <Tile
              title="Эмитент"
              dataTestId="tile-issuer"
              actions={<IconButton name="ArrowNarrowRight" size="sm" onClick={() => {}} title="Перейти" />}
            >
              <Grid container alignItems="center" gap={1} sx={{ mb: 1.5 }}>
                <Text type="BodyMReg">{issuer.name}</Text>
                <BadgeCounter counter={issuer.badge} size="sm" />
              </Grid>
              <FieldRow label="КМ">
                <Text type="BodyXSReg">{issuer.km}</Text>
              </FieldRow>
              <FieldRow label="Табельный номер">
                <Grid container alignItems="center" gap={0.5} justifyContent="flex-end">
                  <Text type="BodyXSReg">{issuer.tabNumber}</Text>
                  <Icon name="LinkExternal" size="sm" sx={{ fontSize: 14, color: 'primary.main', cursor: 'pointer' }} />
                </Grid>
              </FieldRow>
            </Tile>
          </Grid>

          <Grid item xs={12} md={5}>
            <Tile
              title="Условия выпуска"
              dataTestId="tile-issuance"
              actions={<IconButton name="Edit" size="sm" onClick={() => {}} title="Редактировать" />}
            >
              <Grid container spacing={2} sx={{ mb: 1.5 }}>
                <Grid item xs={6}>
                  <FieldRow label="ISIN">
                    <Text type="BodyXSReg">{issuance.isin}</Text>
                  </FieldRow>
                </Grid>
                <Grid item xs={6}>
                  <FieldRow label="Наименование">
                    <Text type="BodyXSReg">{issuance.name}</Text>
                  </FieldRow>
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mb: 1.5 }}>
                <Grid item xs={6}>
                  <FieldRow label="Номинальная стоимость">
                    <Text type="BodyMReg">
                      {issuance.nominal}{' '}
                      <Text type="BodyXSReg" color="text.secondary">
                        руб.
                      </Text>
                    </Text>
                  </FieldRow>
                </Grid>
                <Grid item xs={6}>
                  <FieldRow label="Объем выпуска">
                    <Text type="BodyMReg">{issuance.volume}</Text>
                  </FieldRow>
                </Grid>
              </Grid>
              <FieldRow label="Сумма финансирования, валюта номинала">
                <Text type="BodyMReg">
                  {issuance.financeAmount}{' '}
                  <Text type="BodyXSReg" color="text.secondary">
                    {issuance.currency}
                  </Text>
                </Text>
              </FieldRow>
              <Grid container spacing={2} sx={{ mb: 1.5 }}>
                <Grid item xs={6}>
                  <FieldRow label="Процентная ставка">
                    <Text type="BodyMReg">{issuance.rate}</Text>
                  </FieldRow>
                </Grid>
                <Grid item xs={6}>
                  <FieldRow label="Кол-во купонов в год">
                    <Text type="BodyMReg">{issuance.couponsPerYear}</Text>
                  </FieldRow>
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mb: 1.5 }}>
                <Grid item xs={6}>
                  <FieldRow label="Дата выпуска">
                    <Text type="BodyXSReg">{issuance.issueDate}</Text>
                  </FieldRow>
                </Grid>
                <Grid item xs={6}>
                  <FieldRow label="Дата погашения">
                    <Text type="BodyXSReg">{issuance.maturityDate}</Text>
                  </FieldRow>
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FieldRow label="Дата оферты">
                    <Text type="BodyXSReg">{issuance.offerDate}</Text>
                  </FieldRow>
                </Grid>
                <Grid item xs={6}>
                  <FieldRow label="Рейтинг эмиссии">
                    <Grid container alignItems="center" gap={0.5} justifyContent="flex-end">
                      <Grid
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 20,
                          borderRadius: 4,
                          backgroundColor: '#E8F5E9',
                          color: '#2E7D32',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        AA
                      </Grid>
                      <Text type="BodyXSReg">(АКРА РА) от 13.10.2024</Text>
                    </Grid>
                  </FieldRow>
                </Grid>
              </Grid>
            </Tile>
          </Grid>

          <Grid item xs={12} md={3}>
            <Tile
              title="График платежей"
              dataTestId="tile-payments"
              actions={<IconButton name="ArrowNarrowRight" size="sm" onClick={() => {}} title="Перейти" />}
            >
              <Grid container sx={{ mb: 1 }}>
                <Grid item xs={3}>
                  <Text type="BodyXSReg" color="text.secondary">
                    Сумма с НДС, млн руб.
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
                    Дата оплаты
                  </Text>
                </Grid>
              </Grid>
              {payments.map((p, i) => (
                <Grid
                  key={i}
                  container
                  alignItems="center"
                  sx={{ mb: 1.25, borderBottom: '1px solid #F0F0F0', pb: 1.25 }}
                >
                  <Grid item xs={3}>
                    <Grid container alignItems="center" gap={0.5}>
                      <DirectionIcon direction={p.direction} />
                      <Text type="BodyMReg">{p.sum}</Text>
                    </Grid>
                  </Grid>
                  <Grid item xs={3}>
                    <Text type="BodyMReg">{p.date}</Text>
                  </Grid>
                  <Grid item xs={3}>
                    <StatusIcon status={p.status} />
                  </Grid>
                  <Grid item xs={3}>
                    <Text type="BodyMReg">{p.paidDate}</Text>
                  </Grid>
                </Grid>
              ))}
            </Tile>
          </Grid>

          {/* ── Row 3 ── */}

          <Grid item xs={12} md={4}>
            <Tile
              title="Команда сделки"
              dataTestId="tile-team"
              actions={<IconButton name="Edit" size="sm" onClick={() => {}} title="Редактировать" />}
            >
              <Text type="BodyXSReg" color="text.secondary" sx={{ mb: 0.5 }}>
                Сотрудники DCM
              </Text>
              <Text type="BodyMReg" sx={{ mb: 1.5 }}>
                {team.dcm}
              </Text>
              <Text type="BodyXSReg" color="text.secondary" sx={{ mb: 0.5 }}>
                Менеджер
              </Text>
              <Text type="BodyMReg" sx={{ mb: 1.5 }}>
                {team.manager}
              </Text>
              <Text type="BodyXSReg" color="text.secondary" sx={{ mb: 0.5, mt: 1 }}>
                Сотрудники сторонних подразделений
              </Text>
              <Text type="BodyXSReg" color="text.secondary" sx={{ mb: 0.5 }}>
                Менеджер
              </Text>
              <Text type="BodyMReg">{team.externalManager}</Text>
            </Tile>
          </Grid>

          <Grid item xs={12} md={4}>
            <Tile
              title="Документы"
              dataTestId="tile-documents"
              actions={<IconButton name="ArrowNarrowRight" size="sm" onClick={() => {}} title="Перейти" />}
            >
              {documents.map((d, i) => (
                <Grid key={i} container alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Text type="BodyMReg">{d.category}</Text>
                  <Grid
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      backgroundColor: '#F0F0F0',
                      fontSize: 12,
                      color: '#6B7280',
                    }}
                  >
                    {d.count}
                  </Grid>
                </Grid>
              ))}
            </Tile>
          </Grid>
        </Grid>
      </Grid>
    </main>
  );
}
