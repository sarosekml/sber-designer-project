import React from 'react';
import { Box, Grid } from '@mui/material';

import { Button, Icon, Text } from '@/components/atoms';
import type { IconName } from '@/components/atoms/Icon/Icon.types';
import { BreadCrumbs } from '@/components/molecules';
import { Tile } from '@/components/molecules/Tiles/Tile';
import type { GridSizes } from '@/types';

const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'Реестр платежей', route: '/payments' },
  { name: 'Платеж от 30.07.2024', route: '' },
];

const navItems: IconName[] = [
  'LeftMenu',
  'MainPage',
  'FileCheck',
  'Layer03',
  'DocumentCheck',
  'FolderCheck',
  'DocumentUnread',
  'Calendar',
  'Settings',
  'Filter',
];

const amountRows = [
  { label: 'Сумма с НДС, руб.', value: '5 792 800,29 руб.' },
  { label: 'НДС 20%, руб.', value: '1 448 200,07 руб.', muted: true },
  { label: 'Сумма без НДС, руб.', value: '7 241 045,36 руб.' },
];

const counterpartyRows = [
  { label: 'Платежный контрагент', value: 'ООО "Ромашка"' },
  { label: 'ИНН', value: '6123012938' },
  { label: 'КПП', value: '33432423423' },
  { label: 'КПП КН', value: '33432423423' },
];

const taskRows = [
  { label: 'Номер объекта', value: '№ IB34769' },
  { label: 'Исполнитель', value: 'Иванов С.П.' },
];

const documents = [
  { label: 'Договор', value: 'Договор № 3764 от 20.03.2025.pdf' },
  { label: 'Акт', value: '№456321 от 12.09.2024' },
  { label: 'Счет-фактура', value: '№456334567321 от 24.01.2025' },
  { label: 'Счет', value: 'Счет №324 к Акту от 27.03.2025.xlsx' },
];

const tileCardSelector = '& > .dmb-uikit-MuiCard-root, & > .MuiCard-root';

function noop() {}

function PageCard({
  title,
  children,
  minHeight = 216,
  gridSizes,
  dataTestId,
}: {
  title: string;
  children: React.ReactNode;
  minHeight?: number;
  gridSizes?: GridSizes;
  dataTestId: string;
}) {
  return (
    <Tile
      title={title}
      dataTestId={dataTestId}
      gridSizes={gridSizes}
      sx={{
        minHeight,
        [tileCardSelector]: {
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(219, 232, 229, 0.72)',
          borderRadius: '8px',
          boxShadow: '0 1px 0 rgba(18, 48, 43, 0.02)',
          overflow: 'hidden',
        },
      }}
    >
      {children}
    </Tile>
  );
}

function FieldValue({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Text type="BodyXSReg" sx={{ color: '#7A8C88', mb: 0.6, fontSize: 13, lineHeight: '18px' }}>
        {label}
      </Text>
      <Text
        type="BodyLReg"
        sx={{
          color: muted ? '#7E8D8A' : '#263A37',
          fontSize: 19,
          lineHeight: '26px',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Text>
    </Box>
  );
}

function StatusPill({
  icon,
  label,
  color,
  background = '#F7FFFD',
}: {
  icon?: IconName;
  label: string;
  color: string;
  background?: string;
}) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.55,
        height: 24,
        borderRadius: 12,
        border: `1px solid ${color}`,
        backgroundColor: background,
        color,
        px: 1,
        fontSize: 14,
        lineHeight: '20px',
        whiteSpace: 'nowrap',
      }}
    >
      {icon && <Icon name={icon} size="sm" color={color} sx={{ fontSize: 17 }} />}
      {label}
    </Box>
  );
}

function Sidebar() {
  return (
    <Box
      component="aside"
      aria-label="Навигация"
      sx={{
        position: 'fixed',
        inset: '0 auto 0 0',
        width: 56,
        backgroundColor: '#FAFDFD',
        borderRight: '1px solid #E6EFED',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 1,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', pt: 2 }}>
        {navItems.map((icon, index) => (
          <Box
            key={`${icon}-${index}`}
            sx={{
              width: '100%',
              minHeight: index === 0 ? 44 : 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: index > 0 && [1, 2, 4, 7].includes(index) ? '1px solid #E4EEEC' : 'none',
            }}
          >
            <Box
              sx={{
                width: 48,
                height: index === 4 ? 44 : 40,
                borderRadius: index === 4 ? '8px' : '4px',
                backgroundColor: index === 4 ? '#EEF6F5' : 'transparent',
                color: index === 4 ? '#7DB0AA' : '#C5D7D4',
                display: 'grid',
                placeItems: 'center',
                position: 'relative',
              }}
            >
              <Icon
                name={icon}
                size="md"
                color={index === 4 ? '#7DB0AA' : '#C5D7D4'}
                sx={{ fontSize: index === 0 ? 23 : 22 }}
              />
              {icon === 'Calendar' && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 7,
                    right: 8,
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    backgroundColor: '#18B3A5',
                    color: '#FFFFFF',
                    fontSize: 9,
                    lineHeight: '13px',
                    textAlign: 'center',
                    fontWeight: 700,
                  }}
                >
                  7
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          mt: 'auto',
          mb: 9,
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: '#F0F6F5',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Text type="BodyXSReg" sx={{ color: '#9FB4B0', fontSize: 10, lineHeight: '12px' }}>
          ИБ
        </Text>
      </Box>
    </Box>
  );
}

function Header() {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 2,
        mb: 4,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ mb: 3 }}>
          <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={noop} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Text type="H3StrongSmb" sx={{ color: '#243331', fontSize: 30, lineHeight: '38px' }}>
            Платеж от 30.07.2024
          </Text>
          <Icon name="ArrowNarrowDownLeft" size="sm" color="#57B061" sx={{ fontSize: 19 }} />
          <StatusPill icon="ArrowCircleRight" label="Счет сформирован" color="#1B8ACB" background="#F5FBFF" />
          <StatusPill icon="ArrowNarrowLeft" label="В реестр платежей" color="#2AAEA2" />
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          pt: { xs: 0, lg: 6 },
        }}
      >
        <Button type="outlined" size="sm" startIcon="ArrowCircleRight" onClick={noop}>
          Подтвердить отправку счета клиенту
        </Button>
        <Button type="outlined" size="sm" color="error" startIcon="CloseCircle" onClick={noop}>
          Отменить
        </Button>
      </Box>
    </Box>
  );
}

function DealCard() {
  return (
    <PageCard title="Сделка" dataTestId="PaymentDealTile" gridSizes={{ xs: 12, lg: 4 }}>
      <Box sx={{ display: 'grid', gap: 2.6 }}>
        <Box>
          <Text type="BodyXSReg" sx={{ color: '#7A8C88', mb: 0.6, fontSize: 13, lineHeight: '18px' }}>
            № сделки
          </Text>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <Text type="BodyLReg" sx={{ color: '#263A37', fontSize: 19, lineHeight: '26px' }}>
              M&A Сделка №45697354
            </Text>
            <Icon name="LinkExternal" size="sm" color="#A9CEC8" sx={{ fontSize: 22 }} />
          </Box>
        </Box>
        <Box>
          <Text type="BodyXSReg" sx={{ color: '#7A8C88', mb: 0.8, fontSize: 13, lineHeight: '18px' }}>
            Тип сделки
          </Text>
          <StatusPill label="sell-side" color="#2B92CF" background="#F6FCFF" />
        </Box>
      </Box>
    </PageCard>
  );
}

function DocumentsCard() {
  return (
    <PageCard title="Документы" dataTestId="PaymentDocumentsTile" minHeight={256} gridSizes={{ xs: 12, md: 6 }}>
      <Grid container columnSpacing={8} rowSpacing={2.7}>
        {documents.map((document) => (
          <Grid item xs={12} md={6} key={document.label}>
            <Text type="BodyXSReg" sx={{ color: '#7A8C88', mb: 0.6, fontSize: 13, lineHeight: '18px' }}>
              {document.label}
            </Text>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <Text
                type="BodyLReg"
                sx={{
                  color: '#263A37',
                  fontSize: 19,
                  lineHeight: '26px',
                  overflowWrap: 'anywhere',
                }}
              >
                {document.value}
              </Text>
              <Icon name="Download" size="sm" color="#A9CEC8" sx={{ fontSize: 22, flex: '0 0 auto' }} />
            </Box>
          </Grid>
        ))}
      </Grid>
    </PageCard>
  );
}

export function CodexImgT3T4T9() {
  return (
    <main
      data-sd-screen-root="true"
      aria-label="Платеж от 30.07.2024"
      style={{ minHeight: '100vh', background: '#F3F8F7', color: '#243331' }}
    >
      <Sidebar />
      <Box
        sx={{
          minHeight: '100vh',
          ml: '56px',
          px: { xs: 4, md: 6 },
          pt: 4,
          pb: 6,
        }}
      >
        <Header />

        <Grid container spacing={4}>
          <PageCard title="Сумма" dataTestId="PaymentAmountTile" gridSizes={{ xs: 12, lg: 4 }}>
            <Grid container rowSpacing={2.9} columnSpacing={5}>
              {amountRows.map((row) => (
                <Grid item xs={12} sm={row.label.startsWith('Сумма без') ? 12 : 6} key={row.label}>
                  <FieldValue label={row.label} value={row.value} muted={row.muted} />
                </Grid>
              ))}
            </Grid>
          </PageCard>

          <PageCard title="Контрагент" dataTestId="PaymentCounterpartyTile" gridSizes={{ xs: 12, lg: 4 }}>
            <Grid container rowSpacing={2.9} columnSpacing={5}>
              {counterpartyRows.map((row) => (
                <Grid item xs={12} sm={6} key={row.label}>
                  <FieldValue label={row.label} value={row.value} />
                </Grid>
              ))}
            </Grid>
          </PageCard>

          <DealCard />

          <PageCard
            title="Назначение платежа"
            dataTestId="PaymentPurposeTile"
            minHeight={256}
            gridSizes={{ xs: 12, md: 3 }}
          >
            <Text
              type="BodyLReg"
              sx={{
                color: '#263A37',
                fontSize: 19,
                lineHeight: '27px',
                maxWidth: 405,
              }}
            >
              Услуги организатора по Соглашению "№ 456321" от "12.09.2024" об организации размещения облигаций
            </Text>
          </PageCard>

          <PageCard
            title="Связанная задача"
            dataTestId="PaymentLinkedTaskTile"
            minHeight={256}
            gridSizes={{ xs: 12, md: 3 }}
          >
            <Box sx={{ display: 'grid', gap: 1.75 }}>
              {taskRows.map((row) => (
                <FieldValue key={row.label} label={row.label} value={row.value} />
              ))}
              <Box>
                <Text type="BodyXSReg" sx={{ color: '#7A8C88', mb: 0.6, fontSize: 13, lineHeight: '18px' }}>
                  Статус
                </Text>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: 22,
                    borderRadius: 11,
                    px: 1,
                    backgroundColor: '#DEF4DF',
                    color: '#278342',
                    border: '1px solid #C7EACB',
                    fontSize: 14,
                    lineHeight: '20px',
                  }}
                >
                  Выполнено
                </Box>
              </Box>
            </Box>
          </PageCard>

          <DocumentsCard />
        </Grid>
      </Box>
    </main>
  );
}
