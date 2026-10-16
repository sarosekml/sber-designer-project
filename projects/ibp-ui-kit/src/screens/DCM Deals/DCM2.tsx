import React from 'react';
import { Grid, Text, Icon, IconButton, BadgeCounter, ProgressBar } from '@/components/atoms';
import { BreadCrumbs, Card } from '@/components/molecules';
import type { IconName } from '@/components/atoms/Icon/Icon.types';

/* ── Mock data ── */
const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'ECM Pipeline', route: '/ecm-pipeline' },
  { name: 'ECM-125. ООО "Газпром-инвест". Облигации привилегированные', route: '' },
];

const deal = {
  title: 'DCM-2025. ООО "Газпром-инвест". Облигации привилегированные',
  changedDate: '10.05.2025',
  changedTime: '14:32',
  changedBy: 'Иванов И.И.',
};

const client = {
  name: 'ООО "Газпром-инвест"',
  badge: 26,
  km: 'Петров П.П.',
  tabNumber: '123-456-789',
  alias: 'Тот кого нельзя называть',
  useAlias: true,
};

const dealTerms = {
  type: 'DCM',
  product: 'DCM',
  currentYearIncome: 45.2,
  indicativeSize: 500,
  expectedIncome: 12.8,
  expectedIncomeAdj: 8.96,
  expectedDate: '15.12.2025',
  description: 'Размещение привилегированных облигаций ООО "Газпром-инвест" на Московской бирже. Срок размещения — 3 года. Купонный доход — фиксированный с возможностью досрочного погашения по оферте.',
};

const stage = {
  name: 'Согласование коммерческих условий',
  status: 'Активная',
  progress: 45,
  probability: 'Средняя',
  comment: 'Ожидается подписание term sheet с клиентом',
};

const issuer = {
  name: 'ООО "Газпром-инвест"',
  badge: 26,
  km: 'Петров П.П.',
  tabNumber: '123-456-789',
};

const issuance = {
  isin: 'RU000A123456',
  name: 'Россети1Р13',
  nominal: 1000,
  volume: 300000,
  financeAmount: 300,
  currency: 'руб.',
  rate: 'RUONIA + 2 %',
  couponsPerYear: 4,
  issueDate: '15.03.2025',
  maturityDate: '15.03.2028',
  offerDate: '15.03.2026',
  rating: 'AA (АКРА РА) от 13.10.2024',
};

type PaymentDirection = 'in' | 'out';

interface PaymentItem {
  sum: number;
  direction: PaymentDirection;
  date: string;
  status: string;
  paidDate: string;
}

const payments: PaymentItem[] = [
  { sum: 15.2, direction: 'out', date: '15.06.2025', status: 'scheduled', paidDate: '-' },
  { sum: 12.8, direction: 'in', date: '20.06.2025', status: 'processing', paidDate: '-' },
  { sum: 8.5, direction: 'out', date: '15.07.2025', status: 'paid', paidDate: '15.07.2025' },
  { sum: 3.2, direction: 'in', date: '01.08.2025', status: 'paid-with-note', paidDate: '01.08.2025' },
];

const team = {
  dcm: ['Сидоров С.С.', 'Козлова К.К.'],
  manager: 'Сидоров С.С.',
  external: ['Морозов М.М.'],
  externalManager: 'Морозов М.М.',
};

const documents = [
  { category: 'Договоры', count: 12 },
  { category: 'Акты', count: 8 },
  { category: 'Счета', count: 15 },
  { category: 'Счета-фактуры', count: 6 },
  { category: 'Акт сверки', count: 2 },
  { category: 'Прочие документы', count: 24 },
];

/* ── Helpers ── */
const statusMeta: Record<string, { icon: IconName; color: string; label: string }> = {
  scheduled: { icon: 'ClockTimer', color: '#F59E0B', label: 'Запланирован' },
  processing: { icon: 'Refresh', color: '#3B82F6', label: 'В обработке' },
  paid: { icon: 'CheckCircleFilled', color: '#10B981', label: 'Оплачен' },
  'paid-with-note': { icon: 'CheckCircleWarning', color: '#10B981', label: 'Оплачен с замечанием' },
  rejected: { icon: 'CloseCircle', color: '#EF4444', label: 'Отклонён' },
};

function DirectionIcon({ direction }: { direction: PaymentDirection }) {
  const icon: IconName = direction === 'in' ? 'ArrowNarrowDownRight' : 'ArrowNarrowUpRight';
  const color = direction === 'in' ? '#10B981' : '#EF4444';
  return <Icon name={icon} size="sm" sx={{ color, fontSize: 16 }} />;
}

function StatusIcon({ status }: { status: string }) {
  const meta = statusMeta[status];
  if (!meta) return <Text type="BodyXSReg">—</Text>;
  return (
    <Icon name={meta.icon} size="sm" sx={{ color: meta.color, fontSize: 16 }} />
  );
}

/* ── Label-value row ── */
function FieldRow({ label, children, color }: { label: string; children: React.ReactNode; color?: string }) {
  return (
    <Grid container alignItems="baseline" justifyContent="space-between" sx={{ mb: 1.5 }}>
      <Text type="BodyXSReg" color={color ?? 'text.secondary'} sx={{ flexShrink: 0, mr: 1 }}>
        {label}
      </Text>
      <Grid item sx={{ textAlign: 'right', maxWidth: '65%' }}>
        {children}
      </Grid>
    </Grid>
  );
}

function CardNav({ onNavigate, onEdit }: { onNavigate?: () => void; onEdit?: () => void }) {
  return (
    <Grid container gap={0.5} flexWrap="nowrap">
      {onNavigate && (
        <IconButton name="ArrowNarrowRight" size="sm" onClick={onNavigate} title="Перейти" />
      )}
      {onEdit && (
        <IconButton name="Edit" size="sm" onClick={onEdit} title="Редактировать" />
      )}
    </Grid>
  );
}

/* ── Main component ── */
export function DCM2() {
  return (
    <main
      data-sd-screen-root="true"
      aria-label="Deal Card — Карточка сделки"
      style={{ minHeight: '100vh', background: '#F5F5F5' }}
    >
      {/* Breadcrumbs */}
      <Grid sx={{ px: 3, pt: 2, pb: 0 }}>
        <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={() => {}} />
      </Grid>

      {/* Page Header */}
      <Grid sx={{ px: 3, py: 1.5 }}>
        <Grid container alignItems="center" justifyContent="space-between" flexWrap="nowrap">
          <Grid container alignItems="center" gap={1.5} flexWrap="nowrap">
            <Text type="H3StrongSmb">{deal.title}</Text>
            <IconButton name="Edit" size="sm" title="Редактировать заголовок" />
          </Grid>
          <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
            <Icon name="CheckCircleFilled" size="sm" sx={{ color: '#10B981', fontSize: 14 }} />
            <Text type="BodyXSReg" color="text.secondary">
              Изменено {deal.changedDate}, {deal.changedTime}, {deal.changedBy}
            </Text>
          </Grid>
        </Grid>
      </Grid>

      {/* Cards grid */}
      <Grid container spacing={2} sx={{ px: 3, pb: 4 }}>
        {/* Column 1 */}
        <Grid item xs={12} md={6}>
          <Grid container spacing={2}>
            {/* Клиент */}
            <Grid item xs={12}>
              <Card
                title="Клиент"
                extra={<CardNav onNavigate={() => {}} />}
              >
                <Grid container alignItems="center" gap={1} sx={{ mb: 1.5 }}>
                  <Text type="BodyMReg">{client.name}</Text>
                  <BadgeCounter counter={client.badge} size="sm" />
                </Grid>
                <FieldRow label="КМ"><Text type="BodyXSReg">{client.km}</Text></FieldRow>
                <FieldRow label="Табельный номер">
                  <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
                    <Text type="BodyXSReg">{client.tabNumber}</Text>
                    <Icon name="LinkExternal" size="sm" sx={{ fontSize: 14, color: 'primary.main', cursor: 'pointer' }} />
                  </Grid>
                </FieldRow>
                <FieldRow label="Название клиента"><Text type="BodyXSReg">{client.alias}</Text></FieldRow>
                <FieldRow label="Использовать как псевдоним">
                  <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
                    <Icon
                      name={client.useAlias ? 'CheckBox' : 'CheckBoxBlank'}
                      size="sm"
                      sx={{ fontSize: 18, color: client.useAlias ? 'primary.main' : 'text.disabled' }}
                    />
                    <Text type="BodyXSReg" color={client.useAlias ? 'text.primary' : 'text.disabled'}>
                      {client.useAlias ? 'Да' : 'Нет'}
                    </Text>
                  </Grid>
                </FieldRow>
              </Card>
            </Grid>

            {/* Стадия */}
            <Grid item xs={12}>
              <Card
                title="Стадия"
                extra={<CardNav onEdit={() => {}} />}
              >
                <FieldRow label="Стадия"><Text type="BodyXSReg">{stage.name}</Text></FieldRow>
                <FieldRow label="Статус">
                  <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
                    <Grid sx={{
                      width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', flexShrink: 0,
                    }} />
                    <Text type="BodyXSReg">{stage.status}</Text>
                  </Grid>
                </FieldRow>
                <FieldRow label="Прогресс">
                  <Grid container alignItems="center" gap={1} sx={{ minWidth: 160 }}>
                    <ProgressBar value={stage.progress} />
                  </Grid>
                </FieldRow>
                <FieldRow label="Вероятность сделки"><Text type="BodyXSReg">{stage.probability}</Text></FieldRow>
                <FieldRow label="Комментарий">
                  <Text type="BodyXSReg" sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    maxWidth: 200,
                  }}>
                    {stage.comment}
                  </Text>
                </FieldRow>
              </Card>
            </Grid>

            {/* Условия выпуска */}
            <Grid item xs={12}>
              <Card
                title="Условия выпуска"
                extra={<CardNav onEdit={() => {}} />}
              >
                <FieldRow label="ISIN"><Text type="BodyXSReg" sx={{ fontFamily: 'monospace' }}>{issuance.isin}</Text></FieldRow>
                <FieldRow label="Наименование"><Text type="BodyXSReg">{issuance.name}</Text></FieldRow>
                <FieldRow label="Номинальная стоимость"><Text type="BodyXSReg">{issuance.nominal.toLocaleString()} {issuance.currency}.</Text></FieldRow>
                <FieldRow label="Объём выпуска"><Text type="BodyXSReg">{issuance.volume.toLocaleString()} шт.</Text></FieldRow>
                <FieldRow label="Сумма финансирования"><Text type="BodyXSReg">{issuance.financeAmount} млн {issuance.currency}.</Text></FieldRow>
                <FieldRow label="Процентная ставка"><Text type="BodyXSReg">{issuance.rate}</Text></FieldRow>
                <FieldRow label="Кол-во купонов в год"><Text type="BodyXSReg">{issuance.couponsPerYear}</Text></FieldRow>
                <FieldRow label="Дата выпуска"><Text type="BodyXSReg">{issuance.issueDate}</Text></FieldRow>
                <FieldRow label="Дата погашения"><Text type="BodyXSReg">{issuance.maturityDate}</Text></FieldRow>
                <FieldRow label="Дата оферты"><Text type="BodyXSReg">{issuance.offerDate}</Text></FieldRow>
                <FieldRow label="Рейтинг эмиссии"><Text type="BodyXSReg">{issuance.rating}</Text></FieldRow>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Column 2 */}
        <Grid item xs={12} md={6}>
          <Grid container spacing={2}>
            {/* Условия сделки */}
            <Grid item xs={12}>
              <Card title="Условия сделки">
                <FieldRow label="Тип сделки"><Text type="BodyXSReg">{dealTerms.type}</Text></FieldRow>
                <FieldRow label="Продукт"><Text type="BodyXSReg">{dealTerms.product}</Text></FieldRow>
                <FieldRow label="Доход текущего года"><Text type="BodyXSReg">{dealTerms.currentYearIncome} млн руб.</Text></FieldRow>
                <FieldRow label="Индикативный размер сделки"><Text type="BodyXSReg">{dealTerms.indicativeSize} млн руб.</Text></FieldRow>
                <FieldRow label="Ожидаемый доход"><Text type="BodyXSReg">{dealTerms.expectedIncome} млн руб.</Text></FieldRow>
                <FieldRow label="Ожидаемый доход с учётом вероятности"><Text type="BodyXSReg">{dealTerms.expectedIncomeAdj} млн руб.</Text></FieldRow>
                <FieldRow label="Ожидаемая дата дохода"><Text type="BodyXSReg">{dealTerms.expectedDate}</Text></FieldRow>
                <FieldRow label="Описание">
                  <Text
                    type="BodyXSReg"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      maxWidth: 240,
                    }}
                  >
                    {dealTerms.description}
                  </Text>
                </FieldRow>
              </Card>
            </Grid>

            {/* Эмитент */}
            <Grid item xs={12}>
              <Card
                title="Эмитент"
                extra={<CardNav onNavigate={() => {}} />}
              >
                <Grid container alignItems="center" gap={1} sx={{ mb: 1.5 }}>
                  <Text type="BodyMReg">{issuer.name}</Text>
                  <BadgeCounter counter={issuer.badge} size="sm" />
                </Grid>
                <FieldRow label="КМ"><Text type="BodyXSReg">{issuer.km}</Text></FieldRow>
                <FieldRow label="Табельный номер">
                  <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
                    <Text type="BodyXSReg">{issuer.tabNumber}</Text>
                    <Icon name="LinkExternal" size="sm" sx={{ fontSize: 14, color: 'primary.main', cursor: 'pointer' }} />
                  </Grid>
                </FieldRow>
              </Card>
            </Grid>

            {/* График платежей */}
            <Grid item xs={12}>
              <Card
                title="График платежей"
                extra={<CardNav onNavigate={() => {}} />}
              >
                <Grid container sx={{ borderBottom: '1px solid #E5E7EB', pb: 0.75, mb: 0.75 }}>
                  <Grid item xs={4}><Text type="BodyXSReg" color="text.secondary">Сумма с НДС, млн руб.</Text></Grid>
                  <Grid item xs={2}><Text type="BodyXSReg" color="text.secondary">Дата</Text></Grid>
                  <Grid item xs={3}><Text type="BodyXSReg" color="text.secondary">Статус</Text></Grid>
                  <Grid item xs={3}><Text type="BodyXSReg" color="text.secondary">Дата оплаты</Text></Grid>
                </Grid>
                {payments.map((p, i) => (
                  <Grid
                    container
                    key={i}
                    alignItems="center"
                    sx={{ py: 0.75, borderBottom: i < payments.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                  >
                    <Grid item xs={4} container alignItems="center" gap={0.5}>
                      <DirectionIcon direction={p.direction} />
                      <Text type="BodyXSReg">{p.sum}</Text>
                    </Grid>
                    <Grid item xs={2}><Text type="BodyXSReg">{p.date}</Text></Grid>
                    <Grid item xs={3} container alignItems="center" gap={0.5}>
                      <StatusIcon status={p.status} />
                      <Text type="BodyXSReg" color="text.secondary">{statusMeta[p.status]?.label ?? '—'}</Text>
                    </Grid>
                    <Grid item xs={3}><Text type="BodyXSReg">{p.paidDate}</Text></Grid>
                  </Grid>
                ))}
              </Card>
            </Grid>

            {/* Команда сделки */}
            <Grid item xs={12}>
              <Card
                title="Команда сделки"
                extra={<CardNav onEdit={() => {}} />}
              >
                <FieldRow label="Сотрудники DCM">
                  <Text type="BodyXSReg">{team.dcm.join(', ')}</Text>
                </FieldRow>
                <FieldRow label="Менеджер">
                  <Text type="BodyXSReg">{team.manager}</Text>
                </FieldRow>
                <FieldRow label="Сторонние подразделения">
                  <Text type="BodyXSReg">{team.external.join(', ')}</Text>
                </FieldRow>
                <FieldRow label="Менеджер (сторонний)">
                  <Text type="BodyXSReg">{team.externalManager}</Text>
                </FieldRow>
              </Card>
            </Grid>

            {/* Документы */}
            <Grid item xs={12}>
              <Card
                title="Документы"
                extra={<CardNav onNavigate={() => {}} />}
              >
                {documents.map((doc, i) => (
                  <Grid
                    key={doc.category}
                    container
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{
                      py: 0.75,
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: '#F9FAFB' },
                      borderBottom: i < documents.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}
                  >
                    <Text type="BodyXSReg">{doc.category}</Text>
                    <BadgeCounter counter={doc.count} size="sm" />
                  </Grid>
                ))}
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </main>
  );
}
