import React from 'react';
import type { SxProps, Theme } from '@mui/material';

import { Button, DictionaryBadge, Icon, IconButton, Page } from '@/components/atoms';
import { BreadCrumbs, TileCard } from '@/components/molecules';

type DetailRow = {
  label: string;
  value: React.ReactNode;
};

type DocumentRow = {
  type: string;
  value: string;
  downloadable?: boolean;
};

const noop = () => {};

const breadcrumbItems = [
  { name: 'Главная', route: '/' },
  { name: 'M&A Pipeline', route: '/ma-pipeline' },
  { name: '325. Сделка от 25.04.2024', route: '/ma-pipeline/325' },
  { name: 'График платежей', route: '/ma-pipeline/325/payment-schedule' },
  { name: 'Платеж от 30.07.2024', route: '' },
];

const navItems = [
  { icon: '⌂', label: 'Главная' },
  { icon: '≡', label: 'M&A Pipeline', active: true },
  { icon: '◫', label: 'Сделки' },
  { icon: '▤', label: 'Задачи' },
  { icon: '⚙', label: 'Настройки' },
];

const amountRows: DetailRow[] = [
  { label: 'Сумма с НДС, руб.', value: <Money value={'5\u00a0792\u00a0800,29'} /> },
  { label: 'НДС 20%, руб.', value: <Money value={'1\u00a0448\u00a0200,07'} /> },
  { label: 'Сумма без НДС, руб.', value: <Money value={'7\u00a0241\u00a0045,36'} /> },
];

const counterpartyRows: DetailRow[] = [
  { label: 'Платежный контрагент', value: 'ООО "Ромашка"' },
  { label: 'ИНН', value: '6123012938' },
  { label: 'КПП', value: '33432423423' },
  { label: 'КПП КН', value: '33432423423' },
];

const taskRows: DetailRow[] = [
  { label: 'Номер объекта', value: '№ IB34769' },
  { label: 'Исполнитель', value: 'Иванов С.П.' },
  {
    label: 'Статус',
    value: (
      <DictionaryBadge
        code="completed"
        name="Выполнено"
        component="Chip"
        variant="outlined"
        type="read"
        dataTestId="PaymentRelatedTaskStatus"
      />
    ),
  },
];

const documents: DocumentRow[] = [
  { type: 'Договор', value: 'Договор № 3764 от 20.03.2025.pdf', downloadable: true },
  { type: 'Акт', value: '№456321 от 12.09.2024', downloadable: true },
  { type: 'Счет-фактура', value: '\u2013' },
  { type: 'Счет', value: '\u2013' },
];

export function CodexTextT10() {
  return (
    <main data-sd-screen-root="true" aria-label="Codex-text-T10" style={styles.screen}>
      <aside aria-label="Основная навигация" style={styles.sidebar}>
        <div style={styles.logo}>IBP</div>
        <nav style={styles.navList}>
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
              onClick={noop}
              style={{
                ...styles.navButton,
                ...(item.active ? styles.navButtonActive : undefined),
              }}
            >
              {item.icon}
            </button>
          ))}
        </nav>
      </aside>

      <Page dataTestId="PaymentSchedulePaymentPage" sx={pageSx}>
        <header style={styles.header}>
          <BreadCrumbs
            dataTestId="PaymentSchedulePaymentPage"
            navigationSchema={breadcrumbItems}
            onClickLink={noop}
            sx={breadcrumbsSx}
          />

          <div style={styles.titleRow}>
            <div style={styles.titleCluster}>
              <h1 style={styles.title}>Платеж от 30.07.2024</h1>
              <span aria-hidden="true" style={styles.paymentMarker}>
                <Icon name="PaymentsIb" color="success" size="md" />
              </span>
              <DictionaryBadge
                code="expected"
                name="Ожидаемый"
                component="Chip"
                variant="outlined"
                type="read"
                dataTestId="PaymentStatus"
              />
            </div>

            <div style={styles.actions}>
              <Button dataTestId="BackToPaymentSchedule" type="outlined" startIcon="ArrowLeft" onClick={noop}>
                В график платежей
              </Button>
              <Button dataTestId="SubmitPaymentReview" type="outlined" startIcon="Send" onClick={noop}>
                На проверку
              </Button>
              <Button dataTestId="EditPayment" type="outlined" startIcon="Edit" onClick={noop}>
                Редактировать
              </Button>
              <IconButton
                dataTestId="PaymentMoreActions"
                name="MoreDots"
                title="Дополнительные действия"
                onClick={noop}
              />
            </div>
          </div>
        </header>

        <section aria-label="Детали платежа" style={styles.grid}>
          <PaymentTile title="Сумма" dataTestId="PaymentAmountTile">
            <DetailRows rows={amountRows} />
          </PaymentTile>

          <PaymentTile title="Контрагент" dataTestId="PaymentCounterpartyTile">
            <DetailRows rows={counterpartyRows} />
          </PaymentTile>

          <PaymentTile title="Сделка" dataTestId="PaymentDealTile">
            <DetailRows
              rows={[
                {
                  label: '№ сделки',
                  value: (
                    <button type="button" onClick={noop} style={styles.linkValue}>
                      M&A Сделка №45697354
                      <Icon name="LinkExternal" color="primary" size="sm" />
                    </button>
                  ),
                },
                {
                  label: 'Тип сделки',
                  value: (
                    <DictionaryBadge
                      code="sell-side"
                      name="sell-side"
                      component="Chip"
                      variant="outlined"
                      type="read"
                      dataTestId="PaymentDealType"
                    />
                  ),
                },
              ]}
            />
          </PaymentTile>

          <PaymentTile title="Назначение платежа" dataTestId="PaymentPurposeTile">
            <p style={styles.purposeText}>
              Услуги организатора по Соглашению "№456321" от "12.09.2024" об организации размещения облигаций
            </p>
          </PaymentTile>

          <PaymentTile title="Связанная задача" dataTestId="PaymentRelatedTaskTile">
            <DetailRows rows={taskRows} />
          </PaymentTile>

          <PaymentTile title="Документы" dataTestId="PaymentDocumentsTile" wide>
            <div style={styles.documentGrid}>
              {documents.map((document) => (
                <div key={document.type} style={styles.documentRow}>
                  <span style={styles.label}>{document.type}</span>
                  <div style={styles.documentValueRow}>
                    <span style={document.downloadable ? styles.documentValue : styles.emptyValue}>
                      {document.value}
                    </span>
                    {document.downloadable && (
                      <IconButton
                        dataTestId={`Download${document.type}`}
                        name="Download"
                        title={`Скачать ${document.type}`}
                        onClick={noop}
                        size="sm"
                        color="info"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </PaymentTile>
        </section>
      </Page>
    </main>
  );
}

function PaymentTile({
  title,
  children,
  wide,
  dataTestId,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  dataTestId: string;
}) {
  return (
    <TileCard
      title={title}
      dataTestId={dataTestId}
      size="lg"
      variant="elevation"
      sx={wide ? tileCardWideSx : tileCardSx}
    >
      {children}
    </TileCard>
  );
}

function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <dl style={styles.rows}>
      {rows.map((row) => (
        <div key={row.label} style={styles.row}>
          <dt style={styles.label}>{row.label}</dt>
          <dd style={styles.value}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Money({ value }: { value: string }) {
  return (
    <span>
      {value}
      <span style={styles.currency}> руб.</span>
    </span>
  );
}

const pageSx: SxProps<Theme> = {
  flex: '1 1 auto',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '28px 32px 36px',
  background: '#f3f6f8',
};

const breadcrumbsSx: SxProps<Theme> = {
  'minHeight': 24,
  '& .MuiBreadcrumbs-ol': {
    alignItems: 'center',
    rowGap: '6px',
  },
};

const tileCardSx: SxProps<Theme> = {
  gridColumn: 'span 4',
  minWidth: 0,
  minHeight: 232,
  borderRadius: '8px',
  boxShadow: '0 1px 2px rgba(20, 32, 43, 0.04)',
};

const tileCardWideSx: SxProps<Theme> = {
  gridColumn: 'span 6',
  minWidth: 0,
  minHeight: 232,
  borderRadius: '8px',
  boxShadow: '0 1px 2px rgba(20, 32, 43, 0.04)',
};

const styles: Record<string, React.CSSProperties> = {
  screen: {
    minHeight: '100vh',
    display: 'flex',
    background: '#f3f6f8',
    color: '#1f2933',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  sidebar: {
    width: 72,
    minHeight: '100vh',
    flex: '0 0 72px',
    background: '#ffffff',
    borderRight: '1px solid #dfe7ec',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '18px 12px',
    gap: 24,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    background: '#0f8f7f',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0,
  },
  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  },
  navButton: {
    width: 48,
    height: 48,
    border: 0,
    borderRadius: 8,
    background: 'transparent',
    color: '#61727f',
    cursor: 'pointer',
    fontSize: 20,
  },
  navButtonActive: {
    background: '#dff5f0',
    color: '#087c6d',
  },
  content: {
    flex: '1 1 auto',
    minWidth: 0,
    padding: '28px 32px 36px',
  },
  header: {
    marginBottom: 24,
  },
  breadcrumbs: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 24,
    color: '#6b7c88',
    fontSize: 14,
  },
  breadcrumbDivider: {
    color: '#93a1aa',
  },
  breadcrumbLink: {
    border: 0,
    padding: 0,
    background: 'transparent',
    color: '#207d75',
    font: 'inherit',
    cursor: 'pointer',
  },
  breadcrumbCurrent: {
    color: '#5d6b76',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    marginTop: 18,
  },
  titleCluster: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 280,
  },
  title: {
    margin: 0,
    color: '#16232c',
    fontSize: 28,
    lineHeight: '36px',
    fontWeight: 650,
    letterSpacing: 0,
  },
  paymentMarker: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    background: '#e5f7ee',
    color: '#13965f',
    fontSize: 18,
    fontWeight: 700,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    maxWidth: '100%',
    borderRadius: 8,
    padding: '4px 10px',
    fontSize: 14,
    lineHeight: '20px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  badgeNeutral: {
    border: '1px solid #c9d4dc',
    background: '#ffffff',
    color: '#53636f',
  },
  badgeSuccess: {
    background: '#dff6e8',
    color: '#167244',
  },
  badgeInfo: {
    border: '1px solid #9fc8ef',
    background: '#f4f9ff',
    color: '#1d64a8',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: 8,
    border: '1px solid #0f8f7f',
    background: '#ffffff',
    color: '#087c6d',
    padding: '0 14px',
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: 0,
    cursor: 'pointer',
  },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: 8,
    border: '1px solid #d1dde5',
    background: '#ffffff',
    color: '#4d5f6c',
    fontSize: 24,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    gap: 20,
    alignItems: 'stretch',
  },
  tile: {
    gridColumn: 'span 4',
    minWidth: 0,
    minHeight: 232,
    background: '#ffffff',
    border: '1px solid #e1e8ee',
    borderRadius: 8,
    padding: 24,
    boxShadow: '0 1px 2px rgba(20, 32, 43, 0.04)',
  },
  tileWide: {
    gridColumn: 'span 6',
  },
  tileTitle: {
    margin: '0 0 22px',
    color: '#1f2933',
    fontSize: 18,
    lineHeight: '24px',
    fontWeight: 650,
    letterSpacing: 0,
  },
  rows: {
    margin: 0,
    display: 'grid',
    gap: 18,
  },
  row: {
    display: 'grid',
    gap: 5,
  },
  label: {
    color: '#71808b',
    fontSize: 13,
    lineHeight: '18px',
    fontWeight: 400,
  },
  value: {
    margin: 0,
    minWidth: 0,
    color: '#202b35',
    fontSize: 16,
    lineHeight: '22px',
    fontWeight: 500,
    overflowWrap: 'break-word',
  },
  currency: {
    color: '#71808b',
    fontWeight: 400,
  },
  linkValue: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 0,
    padding: 0,
    background: 'transparent',
    color: '#126f68',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  externalMark: {
    color: '#3f8f86',
    fontSize: 14,
  },
  purposeText: {
    margin: 0,
    color: '#202b35',
    fontSize: 16,
    lineHeight: '24px',
    fontWeight: 500,
    overflowWrap: 'break-word',
  },
  documentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '22px 28px',
  },
  documentRow: {
    display: 'grid',
    gap: 6,
    minWidth: 0,
  },
  documentValueRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minWidth: 0,
  },
  documentValue: {
    minWidth: 0,
    color: '#126f68',
    fontSize: 15,
    lineHeight: '22px',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  },
  emptyValue: {
    color: '#6b7c88',
    fontSize: 16,
    lineHeight: '22px',
  },
  downloadButton: {
    width: 32,
    height: 32,
    flex: '0 0 32px',
    borderRadius: 8,
    border: '1px solid #d6e2e8',
    background: '#ffffff',
    color: '#087c6d',
    fontSize: 18,
    cursor: 'pointer',
  },
};
