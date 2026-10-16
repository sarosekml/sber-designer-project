import React from 'react';

import { Button, Divider, Icon, IconButton, TextMultiRow, BadgeCounter } from '@/components/atoms';
import { DictionaryBadge } from '@/components/atoms/DictionaryBadge';
import { Grid } from '@/components/atoms/gridTiles/Grid';
import { Text } from '@/components/atoms/typography/Text';
import { BreadCrumbs } from '@/components/molecules';
import { Tile } from '@/components/molecules/Tiles/Tile';
import { doNothing } from '@/utils';

const request = {
  id: 1344,
  deal: {
    title: '1234. СамолетИнвестПродакшн',
    desk: 'SMB_INDUSTRIALS',
  },
  counterparty: {
    title: 'СамолетИнвестХолдинг inc',
    score: 26,
  },
  contract: {
    type: '2.1.2. Корпоративный договор',
    signDate: '21.08.2019',
    target:
      'Федеральное государственное унитарное предприятие публичное акционерное общество “Новейшие инструментально-самолетные решения...',
  },
  subject: {
    text: 'Справка для нотариуса в отношении отчуждения доли СБИ по опциону, требование о продаже доли',
    type: 'Финансовые вопросы (финансовая отчетность, годовой отчет, бюджет, распределение прибыли, аудитор)',
    legalBasis: 'КУ',
    clientCommittee: 'СД',
    bankCommittee: 'ОС ДИД',
    matrixPoints: ['21', '11'],
    effortCategory: 'К2',
    rmConclusion: 'Не требуется',
  },
  team: {
    cup: 'Дордачев П.В.',
    usi: 'Дибров И.А.',
    risk: 'Дибров И.А.',
    signers: 'Малыгин Е.М., Иванов И.И., Константинопольский Ю.Ю.',
  },
  deadlines: {
    requestDate: '12.01.2021',
    closeDate: '–',
    workingDays: '10',
  },
};

const navigationIcons = [
  'LeftMenu',
  'MainPage',
  'Settings',
  'FileSearch',
  'DocumentCheck',
  'Tasks',
  'MessageText',
  'Calendar',
  'PieChart',
  'Bank',
  'BarChartSquare',
  'FolderCheck',
  'Reports1C',
  'Refresh',
  'Settings',
  'Passport',
] as const;

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f2f8f8',
  color: '#273638',
  display: 'flex',
  fontFamily: 'Inter, Arial, sans-serif',
};

const railStyle: React.CSSProperties = {
  width: 56,
  flex: '0 0 56px',
  minHeight: '100vh',
  background: '#fbfefe',
  borderRight: '1px solid #e6eeee',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '18px 0 14px',
  gap: 18,
};

const railIconStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'grid',
  placeItems: 'center',
  color: '#bdd6d2',
};

const contentShellStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(760px, 1fr) 312px',
  gap: 24,
  padding: '18px 24px 30px',
};

const mainColumnStyle: React.CSSProperties = {
  minWidth: 0,
};

const crumbWrapStyle: React.CSSProperties = {
  marginBottom: 12,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  marginBottom: 14,
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  lineHeight: '36px',
  fontWeight: 700,
  color: '#1f2d31',
  margin: 0,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: '24px',
  fontWeight: 500,
  color: '#26383a',
  margin: '0 0 8px',
};

const tileBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  minHeight: 120,
};

const compactTileBodyStyle: React.CSSProperties = {
  ...tileBodyStyle,
  minHeight: 92,
};

const largeTileBodyStyle: React.CSSProperties = {
  ...tileBodyStyle,
  minHeight: 318,
};

const responseTileBodyStyle: React.CSSProperties = {
  ...tileBodyStyle,
  minHeight: 162,
  alignItems: 'flex-start',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  lineHeight: '16px',
  color: '#7a8a8e',
  marginBottom: 3,
};

const valueStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: '22px',
  color: '#26383a',
  margin: 0,
};

const smallValueStyle: React.CSSProperties = {
  ...valueStyle,
  fontSize: 14,
  lineHeight: '20px',
};

const subjectTypeStyle: React.CSSProperties = {
  ...valueStyle,
  maxWidth: 650,
};

const decisionPanelStyle: React.CSSProperties = {
  background: '#f1f7f7',
  borderRadius: 8,
  padding: '14px 16px',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px 28px',
};

const sidePanelStyle: React.CSSProperties = {
  position: 'sticky',
  top: 18,
  height: 'calc(100vh - 36px)',
  minHeight: 760,
  background: '#ffffff',
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(20, 62, 61, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const sideHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '20px 18px 16px',
};

const sideBodyStyle: React.CSSProperties = {
  flex: 1,
  padding: '20px 20px 0',
};

const sideFooterStyle: React.CSSProperties = {
  borderTop: '1px solid #dce8e7',
  padding: '20px 20px 24px',
};

const statusTrackStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '22px 1fr',
  columnGap: 10,
  minHeight: 76,
};

const statusLineStyle: React.CSSProperties = {
  width: 1,
  height: 38,
  background: '#d7e5e3',
  justifySelf: 'center',
  marginTop: 8,
};

const statusDotStyle: React.CSSProperties = {
  width: 17,
  height: 17,
  borderRadius: '50%',
  border: '1px solid #aebfbe',
  background: '#ffffff',
  marginTop: 2,
};

const activeStatusDotStyle: React.CSSProperties = {
  ...statusDotStyle,
  display: 'grid',
  placeItems: 'center',
  borderColor: '#09b0a4',
  background: '#09b0a4',
  color: '#ffffff',
};

const activeStatusLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: 24,
  borderRadius: 14,
  background: '#e5eeee',
  color: '#26383a',
  padding: '0 12px',
  fontSize: 16,
  lineHeight: '24px',
};

const statusLabelStyle: React.CSSProperties = {
  color: '#59696c',
  fontSize: 16,
  lineHeight: '24px',
};

const disabledStatusLabelStyle: React.CSSProperties = {
  ...statusLabelStyle,
  color: '#a9b3b5',
};

const mutedBadgeTheme = {
  backgroundColor: '#eceff1',
  borderColor: '#d4d9dc',
  textColor: '#26383a',
};

const amberBadgeTheme = {
  backgroundColor: '#fff1d7',
  borderColor: '#f4d49a',
  textColor: '#b36b00',
};

function Field({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div>
      {label ? <Text style={labelStyle}>{label}</Text> : null}
      {typeof children === 'string' ? <Text style={valueStyle}>{children}</Text> : children}
    </div>
  );
}

function DecisionField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text style={labelStyle}>{label}</Text>
      <Text style={smallValueStyle}>{value}</Text>
    </div>
  );
}

function EditAction({ title }: { title: string }) {
  return <IconButton name="Edit" size="sm" title={title} onClick={doNothing} />;
}

function StatusRow({
  active,
  disabled,
  final,
  label,
}: {
  active?: boolean;
  disabled?: boolean;
  final?: boolean;
  label: string;
}) {
  return (
    <div style={{ ...statusTrackStyle, minHeight: final ? 28 : statusTrackStyle.minHeight }}>
      <div>
        <div style={active ? activeStatusDotStyle : statusDotStyle}>
          {active ? <Icon name="Check" size="sm" color="inherit" /> : null}
        </div>
        {final ? null : <div style={statusLineStyle} />}
      </div>
      <div>
        {active ? (
          <Text style={activeStatusLabelStyle}>{label}</Text>
        ) : (
          <Text style={disabled ? disabledStatusLabelStyle : statusLabelStyle}>{label}</Text>
        )}
      </div>
    </div>
  );
}

export function Test3CodexCliTextT10() {
  return (
    <main data-sd-screen-root="true" aria-label={`Корпоративный запрос ${request.id}`} style={pageStyle}>
      <aside aria-label="Навигация" style={railStyle}>
        {navigationIcons.map((name, index) => (
          <div key={`${name}-${index}`} style={{ ...railIconStyle, marginTop: index === 1 ? 16 : 0 }}>
            <Icon name={name} size="md" color="inherit" />
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#6ea8a4',
            color: '#ffffff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          АП
        </div>
      </aside>

      <div style={contentShellStyle}>
        <section style={mainColumnStyle}>
          <div style={crumbWrapStyle}>
            <BreadCrumbs
              dataTestId="CorporateRequestBreadcrumbs"
              navigationSchema={[
                { name: 'Главная', route: '/' },
                { name: 'Реестр корпзапросов', route: '/corporate-requests' },
                { name: `Запрос ${request.id}`, route: '' },
              ]}
              onClickLink={doNothing}
            />
          </div>

          <header style={headerStyle}>
            <Text style={titleStyle}>Корпоративный запрос {request.id}</Text>
            <DictionaryBadge
              code="draft"
              name="Черновик"
              component="Chip"
              size="sm"
              type="read"
              variant="outlined"
              colorThemeSx={mutedBadgeTheme}
            />
          </header>

          <Text style={sectionTitleStyle}>Общая информация</Text>

          <Grid container spacing={2}>
            <Tile title="Сделка" gridSizes={{ xs: 3 }} actions={<EditAction title="Редактировать сделку" />}>
              <div style={compactTileBodyStyle}>
                <Field>{request.deal.title}</Field>
                <Field label="Деск">
                  <Text style={valueStyle}>{request.deal.desk}</Text>
                </Field>
              </div>
            </Tile>

            <Tile title="Контрагент" gridSizes={{ xs: 3 }} actions={<EditAction title="Редактировать контрагента" />}>
              <div style={compactTileBodyStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Text style={valueStyle}>{request.counterparty.title}</Text>
                  <BadgeCounter counter={request.counterparty.score} size="md" />
                </div>
              </div>
            </Tile>

            <Tile title="Договор" gridSizes={{ xs: 6 }} actions={<EditAction title="Редактировать договор" />}>
              <div style={compactTileBodyStyle}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px', gap: 24 }}>
                  <Field label="Корпоративный договор">
                    <Text style={valueStyle}>{request.contract.type}</Text>
                  </Field>
                  <Field label="Дата подписания">
                    <Text style={valueStyle}>{request.contract.signDate}</Text>
                  </Field>
                </div>
                <Field label="Контрагент-цель">
                  <TextMultiRow lineClamp={2}>{request.contract.target}</TextMultiRow>
                </Field>
              </div>
            </Tile>
          </Grid>

          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Tile
              title="Суть запроса"
              gridSizes={{ xs: 6 }}
              actions={<EditAction title="Редактировать суть запроса" />}
            >
              <div style={largeTileBodyStyle}>
                <Text style={valueStyle}>{request.subject.text}</Text>
                <Divider orientation="horizontal" flexItem />
                <Field label="Тип запроса">
                  <Text style={subjectTypeStyle}>{request.subject.type}</Text>
                </Field>

                <div style={decisionPanelStyle}>
                  <DecisionField label="Юридическое обоснование запроса" value={request.subject.legalBasis} />
                  <div>
                    <Text style={labelStyle}>Пункты матрицы принятия решений</Text>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {request.subject.matrixPoints.map((point) => (
                        <DictionaryBadge
                          key={point}
                          code={point}
                          name={point}
                          component="Chip"
                          size="sm"
                          type="read"
                          variant="outlined"
                          colorThemeSx={mutedBadgeTheme}
                        />
                      ))}
                    </div>
                  </div>
                  <DecisionField label="КО Клиента" value={request.subject.clientCommittee} />
                  <div>
                    <Text style={labelStyle}>Категория трудозатратности</Text>
                    <DictionaryBadge
                      code={request.subject.effortCategory}
                      name={request.subject.effortCategory}
                      component="Chip"
                      size="sm"
                      type="read"
                      variant="outlined"
                      colorThemeSx={amberBadgeTheme}
                    />
                  </div>
                  <DecisionField label="КО Банка" value={request.subject.bankCommittee} />
                  <DecisionField label="Заключение РМ" value={request.subject.rmConclusion} />
                </div>
              </div>
            </Tile>

            <Tile title="Команда" gridSizes={{ xs: 3 }} actions={<EditAction title="Редактировать команду" />}>
              <div style={largeTileBodyStyle}>
                <Field label="Сотрудник ЦУП">{request.team.cup}</Field>
                <Field label="Сотрудник УСИ">{request.team.usi}</Field>
                <Field label="Сотрудник рисков (РМ)">{request.team.risk}</Field>
                <Field label="Подписант">
                  <Text style={valueStyle}>{request.team.signers}</Text>
                </Field>
              </div>
            </Tile>

            <Tile title="Сроки" gridSizes={{ xs: 3 }} actions={<EditAction title="Редактировать сроки" />}>
              <div style={largeTileBodyStyle}>
                <Field label="Дата запроса">{request.deadlines.requestDate}</Field>
                <Field label="Дата закрытия">{request.deadlines.closeDate}</Field>
                <Field label="Рабочих дней в работе">{request.deadlines.workingDays}</Field>
              </div>
            </Tile>
          </Grid>

          <Text style={{ ...sectionTitleStyle, marginTop: 22 }}>Работа над запросом</Text>

          <Grid container spacing={2}>
            <Tile
              title="Ответ клиенту"
              gridSizes={{ xs: 6 }}
              actions={<EditAction title="Редактировать ответ клиенту" />}
            >
              <div style={responseTileBodyStyle}>
                <Button type="outlined" size="sm" startIcon="Attach" onClick={doNothing}>
                  Документы
                </Button>
              </div>
            </Tile>
          </Grid>
        </section>

        <aside aria-label="Работа над запросом" style={sidePanelStyle}>
          <div style={sideHeaderStyle}>
            <Text style={{ fontSize: 19, lineHeight: '26px', fontWeight: 700, color: '#26383a' }}>
              Работа над запросом
            </Text>
            <IconButton name="MoreDots" size="sm" title="Дополнительные действия" onClick={doNothing} />
          </div>
          <Divider orientation="horizontal" flexItem />

          <div style={sideBodyStyle}>
            <StatusRow active label="Черновик" />
            <StatusRow label="В работе" />
            <StatusRow disabled final label="Согласовано" />
          </div>

          <div style={sideFooterStyle}>
            <Button type="outlined" fullWidth onClick={doNothing} size="sm" startIcon="Add">
              Передать в работу
            </Button>
          </div>
        </aside>
      </div>
    </main>
  );
}
