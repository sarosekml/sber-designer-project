import React, { useState, useCallback } from 'react';
import { BreadCrumbs } from '../../components/molecules/BreadCrumbs/BreadCrumbs';
import { Entity } from '../../components/molecules/Entity/Entity';
import { PageTabs } from '../../components/molecules/PageTabs/PageTabs';
import { Tile } from '../../components/molecules/Tiles/Tile/Tile';
import { Grid, Text, Icon, Avatar, Button, TextMultiRow } from '../../components/atoms';
import { DashboardGroupHeader } from '../../components/atoms/Header/DashboardGroupHeader/DashboardGroupHeader';

/* ── Mock data ─────────────────────────────────────────────── */

const MOCK_CLIENT = {
  objectId: '12345',
  holdingName: 'Группа «СеверПром»',
  shortName: 'ООО «СеверПром Металлургия»',
  fullName: 'Общество с ограниченной ответственностью «СеверПром Металлургия»',
  isResidentRf: true,
  isKeyClient: true,
};

const MOCK_INDUSTRY = {
  subIndustryName: 'Производство стали',
  industryName: 'Металлургия',
  macroIndustryName: 'Промышленность',
  segmentName: 'Крупный бизнес',
  territorialBankName: 'Северо-Западный банк',
  gosbName: 'ГОСБ 9055',
};

const MOCK_REQUISITES = {
  inn: '7700000001',
  ogrn: '1027700000001',
  kpp: '770001001',
  kppKn: '770001002',
  kio: '12345678',
  crmId: 'CRM-98765',
  legalAddress: '125009, г. Москва, ул. Тверская, д. 7, этаж 5, помещение III, комната 12',
};

const MOCK_DOCUMENTS = [
  { id: 'doc-1', name: 'Годовая отчётность 2025.pdf', uploadedAt: '2026-05-15', hasSummary: true },
  { id: 'doc-2', name: 'Устав ООО «СеверПром Металлургия».pdf', uploadedAt: '2026-04-20', hasSummary: true },
  { id: 'doc-3', name: 'Свидетельство ОГРН.pdf', uploadedAt: '2026-03-10', hasSummary: false },
  { id: 'doc-4', name: 'Договор аренды № 45-А.pdf', uploadedAt: '2026-02-01', hasSummary: false },
];

const MOCK_DOC_SUMMARIES: Record<string, { title: string; pages: string }[]> = {
  'doc-1': [
    { title: 'Бенефициары', pages: 'стр. 3–5' },
    { title: 'Положение на рынке', pages: 'стр. 6–8' },
    { title: 'Финансовое состояние', pages: 'стр. 9–14' },
    { title: 'CF модель', pages: 'стр. 15–18' },
    { title: 'Обязательства', pages: 'стр. 19–22' },
    { title: 'Схема владения', pages: 'стр. 23–24' },
    { title: 'Сотрудничество со Сбером', pages: 'стр. 25–27' },
  ],
  'doc-2': [
    { title: 'Структура управления', pages: 'стр. 2–4' },
    { title: 'Права участников', pages: 'стр. 5–7' },
  ],
};

const MOCK_MAIN_MANAGER = {
  fullName: 'Иванов Иван Иванович',
  personalNumber: 'PN-001',
  roleName: 'Главный клиентский менеджер',
  avatarInitials: 'ИИ',
};

const MOCK_ASSIGNED_DID = {
  fullName: 'Петров Пётр Петрович',
  personalNumber: 'PN-002',
  roleName: 'Старший аналитик ДИД',
  avatarInitials: 'ПП',
};

const MOCK_TEAM = [
  { fullName: 'Сидоров Сидор Сидорович', personalNumber: 'PN-003', roleName: 'Кредитный аналитик', avatarInitials: 'СС' },
  { fullName: 'Кузнецова Анна Викторовна', personalNumber: 'PN-004', roleName: 'Менеджер по рискам', avatarInitials: 'АК' },
  { fullName: 'Смирнов Алексей Дмитриевич', personalNumber: 'PN-005', roleName: 'Юрист', avatarInitials: 'АС' },
];

const MOCK_RELATED_PERSONS = [
  { id: 'rp-1', fullName: 'Морозов Владимир Сергеевич', relations: ['Конечный бенефициар', 'Бенефициар владелец'], avatarInitials: 'ВМ' },
  { id: 'rp-2', fullName: 'Громова Елена Игоревна', relations: ['Бенефициар владелец'], avatarInitials: 'ЕГ' },
  { id: 'rp-3', fullName: 'Титов Роман Александрович', relations: ['Поручитель'], avatarInitials: 'РТ' },
  { id: 'rp-4', fullName: 'Зайцева Ольга Николаевна', relations: ['Конечный бенефициар', 'Поручитель', 'Залогодатель'], avatarInitials: 'ОЗ' },
];

const MOCK_GIGA_REFERENCE = {
  aboutClient: `ООО «СеверПром Металлургия» — одно из крупнейших металлургических предприятий Северо-Западного региона. Основано в 2005 году. Специализируется на производстве горячекатаного и холоднокатаного стального проката.`,
  lpr: `Генеральный директор — Морозов Владимир Сергеевич (с 2018 г.). Главный бухгалтер — Громова Елена Игоревна. Состав совета директоров включает 7 человек, председатель — Морозов В.С.`,
  cooperation: `Клиент Сбера с 2010 года. Действующие продукты: кредитная линия (лимит 5 млрд руб.), зарплатный проект (2 500+ сотрудников), эквайринг, депозиты. Среднемесячные обороты по счетам — 1.2 млрд руб.`,
  recommendations: `• Рассмотреть увеличение кредитного лимита до 7 млрд руб. в связи с расширением производства.\n• Предложить продукт «Банковские гарантии» для участия в тендерах.\n• Провести встречу для обсуждения инвестиционного кредитования нового цеха.`,
};

/* ── Tab config ────────────────────────────────────────────── */

type TabKey = 'general' | 'deals' | 'financials' | 'goals' | 'credits' | 'cashflow';

const TAB_LIST: TabKey[] = ['general', 'deals', 'financials', 'goals', 'credits', 'cashflow'];

const ROUTE_MAP: Record<TabKey, { name: string; pagePath: string; route: string }> = {
  general:    { name: 'Общая информация',        pagePath: '/clients-app/my-clients/12345',           route: '/clients-app/my-clients/:objectId' },
  deals:      { name: 'Сделки',                   pagePath: '/clients-app/my-clients/12345/deals',      route: '/clients-app/my-clients/:objectId/deals' },
  financials: { name: 'Финансовые показатели',    pagePath: '/clients-app/my-clients/12345/financials', route: '/clients-app/my-clients/:objectId/financials' },
  goals:      { name: 'Цели',                      pagePath: '/clients-app/my-clients/12345/goals',      route: '/clients-app/my-clients/:objectId/goals' },
  credits:    { name: 'Кредиты',                   pagePath: '/clients-app/my-clients/12345/credits',    route: '/clients-app/my-clients/:objectId/credits' },
  cashflow:   { name: 'Cash Flow',                 pagePath: '/clients-app/my-clients/12345/cashflow',   route: '/clients-app/my-clients/:objectId/cashflow' },
};

/* ── Helpers ───────────────────────────────────────────────── */

const noop = () => {};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/* ── Sub-components ───────────────────────────────────────── */

interface InfoBadgeProps {
  initials: string;
  mainText: string;
  secondaryText?: string;
  postMainText?: string;
}

const InfoBadge: React.FC<InfoBadgeProps> = ({ initials, mainText, secondaryText, postMainText }) => (
  <Grid container alignItems="center" spacing={1.5} sx={{ py: 0.5 }}>
    <Grid item>
      <Avatar name={initials} size="md" />
    </Grid>
    <Grid item xs>
      <Grid container alignItems="baseline" spacing={0.5}>
        <Grid item>
          <Text type="BodyMReg">{mainText}</Text>
        </Grid>
        {postMainText && (
          <Grid item>
            <Text type="BodySReg" color="textSecondary">{postMainText}</Text>
          </Grid>
        )}
      </Grid>
      {secondaryText && (
        <Text type="BodySReg" color="textSecondary">{secondaryText}</Text>
      )}
    </Grid>
  </Grid>
);

interface FieldRowProps {
  label: string;
  value?: string;
  iconName?: string;
}

const FieldRow: React.FC<FieldRowProps> = ({ label, value, iconName }) => (
  <Grid container alignItems="center" spacing={1.5} sx={{ py: 0.5 }}>
    {iconName && (
      <Grid item>
        <Avatar variant="rounded" size="sm" sx={{ bgcolor: 'rgba(0,128,128,0.1)', width: 32, height: 32 }}>
          <Icon name={iconName as any} size="sm" color="primary" />
        </Avatar>
      </Grid>
    )}
    <Grid item xs>
      <Text type="BodySReg" color="textSecondary">{label}</Text>
      <Text type="BodyMReg">{value || '—'}</Text>
    </Grid>
  </Grid>
);

/* ── Tile: Industry ───────────────────────────────────────── */

const IndustryInfoTile: React.FC = () => {
  const fields: FieldRowProps[] = [
    { label: 'Подотрасль', value: MOCK_INDUSTRY.subIndustryName, iconName: 'Factory01' },
    { label: 'Отрасль', value: MOCK_INDUSTRY.industryName, iconName: 'Factory01' },
    { label: 'Макроотрасль', value: MOCK_INDUSTRY.macroIndustryName, iconName: 'Factory01' },
    { label: 'Сегмент', value: MOCK_INDUSTRY.segmentName, iconName: 'Factory01' },
    { label: 'Территориальный банк', value: MOCK_INDUSTRY.territorialBankName, iconName: 'Factory01' },
    { label: 'ГОСБ из ЕПК', value: MOCK_INDUSTRY.gosbName, iconName: 'Factory01' },
  ];
  return (
    <Tile title="Отрасль" subtitle="Источник: Платформа ДИД" dataTestId="IndustryInfoTile">
      {fields.map((f, i) => <FieldRow key={i} {...f} />)}
    </Tile>
  );
};

/* ── Tile: Requisites ─────────────────────────────────────── */

const RequisitesInfoTile: React.FC = () => {
  const leftFields: FieldRowProps[] = [
    { label: 'ИНН', value: MOCK_REQUISITES.inn },
    { label: 'ОГРН', value: MOCK_REQUISITES.ogrn },
    { label: 'КПП', value: MOCK_REQUISITES.kpp },
  ];
  const rightFields: FieldRowProps[] = [
    { label: 'КПП КН', value: MOCK_REQUISITES.kppKn },
    { label: 'КИО', value: MOCK_REQUISITES.kio },
    { label: 'CRM ID', value: MOCK_REQUISITES.crmId },
  ];
  return (
    <Tile title="Реквизиты" subtitle="Источник: Платформа ДИД" dataTestId="RequisitesInfoTile">
      <Grid container spacing={2}>
        <Grid item xs={6}>
          {leftFields.map((f, i) => <FieldRow key={i} {...f} />)}
        </Grid>
        <Grid item xs={6}>
          {rightFields.map((f, i) => <FieldRow key={i} {...f} />)}
        </Grid>
      </Grid>
      <FieldRow label="Юридический адрес" value={MOCK_REQUISITES.legalAddress} />
    </Tile>
  );
};

/* ── Tile: Documents ──────────────────────────────────────── */

const DocumentsInfoTile: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleSummary = useCallback((docId: string) => {
    setExpandedId((prev) => (prev === docId ? null : docId));
  }, []);

  return (
    <Tile title="Документы" subtitle="Источник: ЭКД" dataTestId="DocumentsInfoTile">
      {MOCK_DOCUMENTS.map((doc) => {
        const isExpanded = expandedId === doc.id;
        const summary = MOCK_DOC_SUMMARIES[doc.id];
        return (
          <div key={doc.id}>
            <Grid container alignItems="center" sx={{ py: 1 }}>
              <Grid item>
                <Avatar variant="rounded" size="sm" sx={{ bgcolor: 'rgba(0,128,128,0.1)', width: 36, height: 36, mr: 1.5 }}>
                  <Icon name="File" size="sm" color="primary" />
                </Avatar>
              </Grid>
              <Grid item xs>
                <Text type="BodyMReg">{doc.name}</Text>
                <Text type="BodySReg" color="textSecondary">{formatDate(doc.uploadedAt)}</Text>
              </Grid>
              <Grid item>
                <Button type="outlined" size="sm" onClick={noop}>Открыть</Button>
              </Grid>
            </Grid>
            {doc.hasSummary && (
              <div style={{ marginLeft: 52, marginBottom: 8 }}>
                <Button type="transparent" size="xs" onClick={() => toggleSummary(doc.id)}>
                  {isExpanded ? 'Скрыть саммари' : 'Показать саммари'}
                </Button>
              </div>
            )}
            {isExpanded && summary && (
              <div style={{ marginLeft: 52, marginBottom: 12, padding: '12px 16px', background: '#f5f7f7', borderRadius: 8 }}>
                <Text type="BodyMReg" sx={{ fontWeight: 600, mb: 1 }}>Саммари по документу:</Text>
                {summary.map((s, i) => (
                  <Text key={i} type="BodySReg" sx={{ display: 'block', mb: 0.5 }}>
                    {s.title} — {s.pages}
                  </Text>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Tile>
  );
};

/* ── Tile: Employee (reused for manager / DID / team) ─────── */

interface EmployeeTileProps {
  title: string;
  dataTestId: string;
  employee?: { fullName: string; personalNumber: string; roleName?: string; avatarInitials: string };
  team?: { fullName: string; personalNumber: string; roleName?: string; avatarInitials: string }[];
}

const EmployeeTile: React.FC<EmployeeTileProps> = ({ title, dataTestId, employee, team }) => {
  const items = team || (employee ? [employee] : []);
  return (
    <Tile title={title} dataTestId={dataTestId}>
      {items.length === 0 ? (
        <Text type="BodySReg" color="textSecondary">Нет данных</Text>
      ) : (
        items.map((emp, i) => (
          <InfoBadge
            key={i}
            initials={emp.avatarInitials}
            mainText={emp.fullName}
            postMainText={emp.personalNumber}
            secondaryText={emp.roleName}
          />
        ))
      )}
    </Tile>
  );
};

/* ── Tile: Related Physical Persons ───────────────────────── */

const RelatedPhysicalPersonsTile: React.FC = () => {
  return (
    <Tile title="Связанные физические лица" dataTestId="RelatedPhysicalPersonsTile">
      {MOCK_RELATED_PERSONS.length === 0 ? (
        <Text type="BodySReg" color="textSecondary">Нет данных</Text>
      ) : (
        MOCK_RELATED_PERSONS.map((person) => {
          const showCounter = person.relations.length > 2;
          const visibleRelations = showCounter ? person.relations.slice(0, 1) : person.relations;
          const hiddenCount = person.relations.length - 1;
          return (
            <InfoBadge
              key={person.id}
              initials={person.avatarInitials}
              mainText={person.fullName}
              secondaryText={[
                ...visibleRelations,
                ...(showCounter ? [`+${hiddenCount}`] : []),
              ].join(', ')}
            />
          );
        })
      )}
    </Tile>
  );
};

/* ── Tile: GigaReference ──────────────────────────────────── */

const GigaReferenceTile: React.FC = () => {
  const sections: { key: string; title: string; content?: string }[] = [
    { key: 'about', title: 'О клиенте', content: MOCK_GIGA_REFERENCE.aboutClient },
    { key: 'lpr', title: 'ЛПР', content: MOCK_GIGA_REFERENCE.lpr },
    { key: 'cooperation', title: 'Сотрудничество', content: MOCK_GIGA_REFERENCE.cooperation },
    { key: 'recommendations', title: 'Рекомендации', content: MOCK_GIGA_REFERENCE.recommendations },
  ].filter((s) => s.content);

  return (
    <Tile title="GigaСправка" subtitle="Источник: ДКК360, Gigachat" dataTestId="GigaReferenceTile">
      {sections.length === 0 ? (
        <Text type="BodySReg" color="textSecondary">Нет данных</Text>
      ) : (
        sections.map((section) => (
          <div key={section.key} style={{ marginBottom: 16 }}>
            <DashboardGroupHeader dataTestId={`GigaSection-${section.key}`}>
              {section.title}
            </DashboardGroupHeader>
            <TextMultiRow dataTestId={`GigaContent-${section.key}`}>
              {section.content}
            </TextMultiRow>
          </div>
        ))
      )}
    </Tile>
  );
};

/* ── Main page ────────────────────────────────────────────── */

export function ClientInfoPageTest02() {
  return (
    <main
      data-sd-screen-root="true"
      aria-label="Client Info Page"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f5f7f7 0%, #f2f7f7 100%)',
        padding: '24px 32px',
      }}
    >
      {/* Breadcrumbs */}
      <BreadCrumbs
        dataTestId="ClientInfoBreadcrumbs"
        navigationSchema={[
          { name: 'Главная', route: '/' },
          { name: 'Клиенты', route: '/clients' },
          { name: MOCK_CLIENT.shortName, route: '' },
        ]}
        onClickLink={noop}
      />

      {/* Header */}
      <Entity
        dataTestId="ClientEntity"
        avatar={{ variant: 'rounded', icon: <Icon name="Factory01" size="lg" color="primary" /> }}
        header={MOCK_CLIENT.holdingName}
        text={MOCK_CLIENT.shortName}
        badges={{
          items: [
            ...(MOCK_CLIENT.isResidentRf ? ['Резидент РФ'] : []),
            ...(MOCK_CLIENT.isKeyClient ? ['Ключевой клиент'] : []),
          ],
          badge: { component: 'Chip' },
        }}
      />

      {/* Tabs */}
      <div style={{ marginTop: 16 }}>
        <PageTabs
          dataTestId="ClientPageTabs"
          tabList={TAB_LIST as unknown as string[]}
          routeMap={ROUTE_MAP}
          locationPathname={ROUTE_MAP.general.pagePath}
          navigateCallback={noop}
        />
      </div>

      {/* Content grid */}
      <div style={{ marginTop: 24, overflow: 'auto', paddingTop: 12 }}>
        <Grid container spacing={4}>
          {/* Column 1: Industry, Requisites, Documents */}
          <Grid item xs={12} md={4}>
            <Grid container spacing={2}>
              <IndustryInfoTile />
              <RequisitesInfoTile />
              <DocumentsInfoTile />
            </Grid>
          </Grid>

          {/* Column 2: People */}
          <Grid item xs={12} md={4}>
            <Grid container spacing={2}>
              <EmployeeTile
                title="Главный клиентский менеджер"
                dataTestId="MainClientManagerTile"
                employee={MOCK_MAIN_MANAGER}
              />
              <EmployeeTile
                title="Закрепленный сотрудник ДИД"
                dataTestId="AssignedDidEmployeeTile"
                employee={MOCK_ASSIGNED_DID}
              />
              <EmployeeTile
                title="Команда клиента"
                dataTestId="ClientTeamTile"
                team={MOCK_TEAM}
              />
              <RelatedPhysicalPersonsTile />
            </Grid>
          </Grid>

          {/* Column 3: GigaReference */}
          <Grid item xs={12} md={4}>
            <Grid container spacing={2}>
              <GigaReferenceTile />
            </Grid>
          </Grid>
        </Grid>
      </div>
    </main>
  );
}
