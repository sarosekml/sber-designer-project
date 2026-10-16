import React, { useState, useCallback } from 'react';
import { BreadCrumbs, Stepper } from '@/components/molecules';
import type { StepItem } from '@/components/molecules/steppers/Stepper/Stepper.types';
import { Tile } from '@/components/molecules/Tiles/Tile';
import { Button, Divider, Icon, IconButton, BadgeCounter, TextMultiRow } from '@/components/atoms';
import { Text } from '@/components/atoms/typography/Text';
import { DictionaryBadge } from '@/components/atoms/DictionaryBadge';
import { Grid } from '@/components/atoms/gridTiles/Grid';
import { doNothing } from '@/utils';

// ---------------------------------------------------------------------------
// Mock data — CorporateRequestDetailsDto
// ---------------------------------------------------------------------------

interface MockCorporateRequest {
  id: number;
  status: 'draft' | 'in-progress' | 'approved';
  deal: { id: number; displayName: string; desk: string };
  counterparty: { id: number; name: string; badgeValue: number };
  contract: {
    id: number;
    type: string;
    signDate: string;
    targetCounterpartyName: string;
  };
  requestSubject: {
    description: string;
    type: string;
    decisionAttributes: {
      legalBasis: string;
      clientCommittee: string;
      bankCommittee: string;
      decisionMatrixPoints: string[];
      laborCategory: string;
      riskManagerConclusion: string;
    };
  };
  team: {
    cupEmployee: string;
    usiEmployee: string;
    riskManager: string;
    signatories: string[];
  };
  dates: {
    requestDate: string;
    closeDate: string | null;
    workingDaysInProgress: number;
  };
  customerResponse: {
    text: string | null;
    documentsCount: number;
  };
}

const mockRequest: MockCorporateRequest = {
  id: 1344,
  status: 'draft',
  deal: { id: 1234, displayName: '1234. СамолетИнвестПродакшн', desk: 'SMB INDUSTRIALS' },
  counterparty: { id: 567, name: 'СамолетИнвестХолдинг inc', badgeValue: 26 },
  contract: {
    id: 890,
    type: '2.1.2. Корпоративный договор',
    signDate: '21.08.2019',
    targetCounterpartyName:
      'Федеральное государственное унитарное предприятие публичное акционерное общество «Новейшие инструментально-самолетные решения...',
  },
  requestSubject: {
    description:
      'Справка для нотариуса в отношении отчуждения доли СБИ по опциону, требование о продаже доли',
    type: 'Финансовые вопросы (финансовая отчетность, годовой отчет, бюджет, распределение прибыли, аудитор)',
    decisionAttributes: {
      legalBasis: 'КУ',
      clientCommittee: 'СД',
      bankCommittee: 'ОС ДИД',
      decisionMatrixPoints: ['21', '11'],
      laborCategory: 'К2',
      riskManagerConclusion: 'Не требуется',
    },
  },
  team: {
    cupEmployee: 'Дордачев П.В.',
    usiEmployee: 'Дибров И.А.',
    riskManager: 'Дибров И.А.',
    signatories: ['Малыгин Е.М.', 'Иванов И.И.', 'Константинопольский Ю.Ю.'],
  },
  dates: {
    requestDate: '12.01.2021',
    closeDate: null,
    workingDaysInProgress: 10,
  },
  customerResponse: {
    text: null,
    documentsCount: 0,
  },
};

// ---------------------------------------------------------------------------
// Workflow stepper config
// ---------------------------------------------------------------------------

const workflowSteps: StepItem[] = [
  { key: 'draft', title: 'Черновик', active: true, completed: true },
  { key: 'in-progress', title: 'В работе', active: false, completed: false },
  { key: 'approved', title: 'Согласовано', active: false, completed: false, disabled: true },
];

// ---------------------------------------------------------------------------
// Shared inline styles
// ---------------------------------------------------------------------------

const mutedLabel: React.CSSProperties = {
  fontSize: 12,
  lineHeight: '16px',
  color: '#6b7280',
  marginBottom: 2,
};

const primaryValue: React.CSSProperties = {
  fontSize: 14,
  lineHeight: '20px',
  color: '#111827',
};

const emptyValue: React.CSSProperties = {
  fontSize: 14,
  lineHeight: '20px',
  color: '#9ca3af',
};

const tileBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const fieldRow: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const decisionPanel: React.CSSProperties = {
  background: '#f3f4f6',
  borderRadius: 8,
  padding: '12px 14px',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px 24px',
};

const sidePanel: React.CSSProperties = {
  width: 280,
  flexShrink: 0,
  background: '#ffffff',
  borderRadius: 12,
  padding: '16px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  height: 'fit-content',
  position: 'sticky',
  top: 24,
};

const pageSx: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f5f7fa',
  color: '#111827',
  padding: '24px 32px',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function orDash(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return value;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TileFieldProps {
  label: string;
  value: string;
  clamp?: number;
}

function TileField({ label, value, clamp }: TileFieldProps) {
  const isEmpty = value === null || value === undefined || value === '';
  return (
    <div style={fieldRow}>
      <Text style={mutedLabel}>{label}</Text>
      {isEmpty ? (
        <Text style={emptyValue}>—</Text>
      ) : clamp ? (
        <TextMultiRow lineClamp={clamp}>{value}</TextMultiRow>
      ) : (
        <Text style={primaryValue}>{value}</Text>
      )}
    </div>
  );
}

interface DecisionAttributeProps {
  label: string;
  value: string;
  badge?: boolean;
  badgeColor?: string;
}

function DecisionAttribute({ label, value, badge, badgeColor }: DecisionAttributeProps) {
  return (
    <div style={fieldRow}>
      <Text style={mutedLabel}>{label}</Text>
      {badge ? (
        <DictionaryBadge
          code={value}
          name={value}
          component="Chip"
          size="sm"
          type="read"
          variant="outlined"
        />
      ) : (
        <Text style={{ ...primaryValue, color: badgeColor || primaryValue.color }}>{value}</Text>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CorporateRequestPage
// ---------------------------------------------------------------------------

/**
 * Corporate request detail page.
 * Shows request context: linked deal, counterparty, contract, request subject,
 * decision-making attributes, responsible team, deadlines, and customer response.
 * Right panel provides workflow status stepper and transition action.
 */
export function Test3Ds4proApiTextT10() {
  const [status, setStatus] = useState<MockCorporateRequest['status']>(mockRequest.status);
  const [loadingTransfer, setLoadingTransfer] = useState(false);

  const handleTransferToWork = useCallback(() => {
    setLoadingTransfer(true);
    // Simulate API call
    setTimeout(() => {
      setStatus('in-progress');
      setLoadingTransfer(false);
    }, 800);
  }, []);

  const isDraft = status === 'draft';
  const request = mockRequest;

  const currentSteps = workflowSteps.map((step) => {
    if (status === 'in-progress' && step.key === 'draft') {
      return { ...step, active: false, completed: true };
    }
    if (status === 'in-progress' && step.key === 'in-progress') {
      return { ...step, active: true, completed: true };
    }
    return step;
  });

  const statusBadgeName = status === 'draft' ? 'Черновик' : 'В работе';

  return (
    <main data-sd-screen-root="true" aria-label={`Корпоративный запрос ${request.id}`} style={pageSx}>
      {/* Breadcrumbs */}
      <BreadCrumbs
        dataTestId="CorporateRequestBreadcrumbs"
        navigationSchema={[
          { name: 'Главная', route: '/' },
          { name: 'Реестр корпзапросов', route: '/corporate-requests' },
          { name: `Запрос ${request.id}`, route: '' },
        ]}
        onClickLink={doNothing}
      />

      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 16,
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: 600, lineHeight: '28px', color: '#111827' }}>
            {`Корпоративный запрос ${request.id}`}
          </Text>
          <DictionaryBadge
            code={status}
            name={statusBadgeName}
            component="Chip"
            size="sm"
            type="read"
            variant="outlined"
            dataTestId="CorporateRequestStatusBadge"
          />
        </div>
      </div>

      {/* Workspace: main grid + side panel */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Main content area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Section: Общая информация */}
          <Text
            style={{ fontSize: 16, fontWeight: 600, lineHeight: '24px', color: '#111827', marginBottom: 16 }}
          >
            Общая информация
          </Text>

          {/* Row 1: Deal (3col) + Counterparty (3col) + Contract (6col) */}
          <Grid container spacing={2}>
            <Tile
              title="Сделка"
              dataTestId="CorporateRequestDealTile"
              gridSizes={{ xs: 3 }}
              actions={
                <IconButton name="Edit" size="sm" onClick={doNothing} title="Редактировать сделку" />
              }
            >
              <div style={tileBody}>
                <TileField label="" value={request.deal.displayName} />
                <TileField label="Деск" value={request.deal.desk} />
              </div>
            </Tile>

            <Tile
              title="Контрагент"
              dataTestId="CorporateRequestCounterpartyTile"
              gridSizes={{ xs: 3 }}
              actions={
                <IconButton name="Edit" size="sm" onClick={doNothing} title="Редактировать контрагента" />
              }
            >
              <div style={tileBody}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text style={primaryValue}>{request.counterparty.name}</Text>
                  <BadgeCounter counter={request.counterparty.badgeValue} size="md" />
                </div>
              </div>
            </Tile>

            <Tile
              title="Договор"
              dataTestId="CorporateRequestContractTile"
              gridSizes={{ xs: 6 }}
              actions={
                <IconButton name="Edit" size="sm" onClick={doNothing} title="Редактировать договор" />
              }
            >
              <div style={tileBody}>
                <TileField label="Корпоративный договор" value={request.contract.type} />
                <TileField label="Дата подписания" value={request.contract.signDate} />
                <TileField
                  label="Контрагент-цель"
                  value={request.contract.targetCounterpartyName}
                  clamp={2}
                />
              </div>
            </Tile>
          </Grid>

          {/* Row 2: RequestSubject (6col) + Team (3col) + Deadlines (3col) */}
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Tile
              title="Суть запроса"
              dataTestId="CorporateRequestSubjectTile"
              gridSizes={{ xs: 6 }}
              actions={
                <IconButton name="Edit" size="sm" onClick={doNothing} title="Редактировать суть запроса" />
              }
            >
              <div style={tileBody}>
                {/* Request description */}
                <Text style={primaryValue}>{request.requestSubject.description}</Text>
                <Divider orientation="horizontal" flexItem />

                {/* Request type */}
                <TileField label="Тип запроса" value={request.requestSubject.type} />

                {/* Decision attributes block */}
                <div style={decisionPanel}>
                  <DecisionAttribute
                    label="Юридическое обоснование запроса"
                    value={request.requestSubject.decisionAttributes.legalBasis}
                  />
                  <DecisionAttribute
                    label="КО Клиента"
                    value={request.requestSubject.decisionAttributes.clientCommittee}
                  />
                  <DecisionAttribute
                    label="КО Банка"
                    value={request.requestSubject.decisionAttributes.bankCommittee}
                  />
                  <DecisionAttribute
                    label="Категория трудозатратности"
                    value={request.requestSubject.decisionAttributes.laborCategory}
                    badgeColor="#d97706"
                  />
                  <div style={fieldRow}>
                    <Text style={mutedLabel}>Пункты матрицы принятия решений</Text>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {request.requestSubject.decisionAttributes.decisionMatrixPoints.map((point) => (
                        <DictionaryBadge
                          key={point}
                          code={point}
                          name={point}
                          component="Chip"
                          size="sm"
                          type="read"
                          variant="outlined"
                        />
                      ))}
                    </div>
                  </div>
                  <DecisionAttribute
                    label="Заключение РМ"
                    value={request.requestSubject.decisionAttributes.riskManagerConclusion}
                  />
                </div>
              </div>
            </Tile>

            <Tile
              title="Команда"
              dataTestId="CorporateRequestTeamTile"
              gridSizes={{ xs: 3 }}
              actions={
                <IconButton name="Edit" size="sm" onClick={doNothing} title="Редактировать команду" />
              }
            >
              <div style={tileBody}>
                <TileField label="Сотрудник ЦУП" value={request.team.cupEmployee} />
                <TileField label="Сотрудник УСИ" value={request.team.usiEmployee} />
                <TileField label="Сотрудник рисков (РМ)" value={request.team.riskManager} />
                <TileField label="Подписант" value={request.team.signatories.join(', ')} />
              </div>
            </Tile>

            <Tile
              title="Сроки"
              dataTestId="CorporateRequestDeadlinesTile"
              gridSizes={{ xs: 3 }}
              actions={
                <IconButton name="Edit" size="sm" onClick={doNothing} title="Редактировать сроки" />
              }
            >
              <div style={tileBody}>
                <TileField label="Дата запроса" value={request.dates.requestDate} />
                <TileField label="Дата закрытия" value={orDash(request.dates.closeDate)} />
                <TileField
                  label="Рабочих дней в работе"
                  value={String(request.dates.workingDaysInProgress)}
                />
              </div>
            </Tile>
          </Grid>

          {/* Section: Работа над запросом */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: 600,
              lineHeight: '24px',
              color: '#111827',
              marginTop: 32,
              marginBottom: 16,
            }}
          >
            Работа над запросом
          </Text>

          {/* Row 3: CustomerResponse (6col) */}
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Tile
              title="Ответ клиенту"
              dataTestId="CorporateRequestCustomerResponseTile"
              gridSizes={{ xs: 6 }}
              actions={
                <IconButton name="Edit" size="sm" onClick={doNothing} title="Редактировать ответ клиенту" />
              }
            >
              <div style={tileBody}>
                <Button type="outlined" onClick={doNothing} dataTestId="CorporateRequestDocumentsButton">
                  <Icon name="Attach" />
                  <span style={{ marginLeft: 6 }}>Документы</span>
                </Button>
                {!request.customerResponse.text ? (
                  <div style={{ minHeight: 60, background: '#ffffff', borderRadius: 6 }} />
                ) : (
                  <Text style={primaryValue}>{request.customerResponse.text}</Text>
                )}
              </div>
            </Tile>
          </Grid>

          {/* Page bottom spacer */}
          <div style={{ height: 48 }} />
        </div>

        {/* Right workflow panel */}
        <aside style={sidePanel} data-testid="CorporateRequestWorkflowPanel">
          {/* Panel header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, fontWeight: 600, lineHeight: '22px', color: '#111827' }}>
              Работа над запросом
            </Text>
            <IconButton name="MoreDots" size="sm" onClick={doNothing} title="Дополнительные действия" />
          </div>
          <Divider orientation="horizontal" flexItem />

          {/* Stepper */}
          <Stepper
            dataTestId="CorporateRequestWorkflowStepper"
            orientation="vertical"
            readonly
            steps={currentSteps}
          />

          <Divider orientation="horizontal" flexItem />

          {/* Transition button */}
          {isDraft && (
            <Button
              type="accent"
              onClick={handleTransferToWork}
              disabled={loadingTransfer}
              dataTestId="CorporateRequestTransferButton"
            >
              {loadingTransfer ? 'Передача...' : 'Передать в работу'}
            </Button>
          )}
          {!isDraft && (
            <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', padding: '8px 0' }}>
              Запрос в работе
            </Text>
          )}
        </aside>
      </div>
    </main>
  );
}