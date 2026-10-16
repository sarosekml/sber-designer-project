import React from 'react';
import { BreadCrumbs } from '@/components/molecules';
import { Tile } from '@/components/molecules/Tiles/Tile';
import { Button, Icon, IconButton } from '@/components/atoms';
import { Text } from '@/components/atoms/typography/Text';
import { DictionaryBadge } from '@/components/atoms/DictionaryBadge';
import { Grid } from '@/components/atoms/gridTiles/Grid';
import { doNothing } from '@/utils';

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'M&A Pipeline', route: '/pipeline' },
  { name: '325. Сделка от 25.04.2024', route: '/deal/325' },
  { name: 'График платежей', route: '/deal/325/payment-schedule' },
  { name: 'Платеж от 30.07.2024', route: '' },
];

/* ------------------------------------------------------------------ */
/*  PaymentSchedulePaymentPage (active screen payload)                 */
/* ------------------------------------------------------------------ */

export function DeepseekApiTestT13() {
  return (
    <main
      data-sd-screen-root="true"
      aria-label="Платеж от 30.07.2024"
      style={{ minHeight: '100vh', background: '#f5f7fa', color: '#1a1a1a', padding: '24px 32px' }}
    >
      {/* Breadcrumbs */}
      <BreadCrumbs
        dataTestId="PaymentPageBreadcrumbs"
        navigationSchema={breadcrumbs}
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
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text type="H4StrongSmb">Платеж от 30.07.2024</Text>
            <Icon name="Check" sx={{ color: '#2e7d32', fontSize: 20 }} />
          </div>
          <DictionaryBadge
            code="expected"
            name="Ожидаемый"
            component="Chip"
            size="sm"
            type="read"
            variant="outlined"
          />
          <Button type="transparent" startIcon="ArrowLeft" onClick={doNothing}>
            В график платежей
          </Button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button type="outlined" startIcon="Refresh" onClick={doNothing}>
            На проверку
          </Button>
          <Button type="outlined" startIcon="Edit" onClick={doNothing}>
            Редактировать
          </Button>
          <IconButton name="MoreDots" size="md" title="Действия" dataTestId="payment-more-actions" />
        </div>
      </div>

      {/* Top row: Сумма, Контрагент, Сделка */}
      <Grid container spacing={3} style={{ marginBottom: 24 }}>
        {/* Сумма */}
        <Grid item xs={4}>
          <Tile title="Сумма" dataTestId="tile-sum">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <Text style={{ color: '#757575', fontSize: 13 }}>Сумма с НДС, руб.</Text>
                  <Text style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
                    5 792 800,29 <span style={{ fontWeight: 400, color: '#757575' }}>руб.</span>
                  </Text>
                </div>
                <div>
                  <Text style={{ color: '#757575', fontSize: 13 }}>НДС 20%, руб.</Text>
                  <Text style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
                    1 448 200,07 <span style={{ fontWeight: 400, color: '#757575' }}>руб.</span>
                  </Text>
                </div>
              </div>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>Сумма без НДС, руб.</Text>
                <Text style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
                  7 241 045,36 <span style={{ fontWeight: 400, color: '#757575' }}>руб.</span>
                </Text>
              </div>
            </div>
          </Tile>
        </Grid>

        {/* Контрагент */}
        <Grid item xs={4}>
          <Tile title="Контрагент" dataTestId="tile-counterparty">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>Платежный контрагент</Text>
                <Text style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>ООО &quot;Ромашка&quot;</Text>
              </div>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>ИНН</Text>
                <Text style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>6123012938</Text>
              </div>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>КПП</Text>
                <Text style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>33432423423</Text>
              </div>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>КПП КН</Text>
                <Text style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>33432423423</Text>
              </div>
            </div>
          </Tile>
        </Grid>

        {/* Сделка */}
        <Grid item xs={4}>
          <Tile title="Сделка" dataTestId="tile-deal">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>№ сделки</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: 500 }}>M&A Сделка №45697354</Text>
                  <Icon name="LinkExternal" sx={{ color: '#1976d2', fontSize: 16 }} />
                </div>
              </div>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>Тип сделки</Text>
                <div style={{ marginTop: 4 }}>
                  <DictionaryBadge
                    code="sell-side"
                    name="sell-side"
                    component="Chip"
                    size="sm"
                    type="read"
                    variant="outlined"
                  />
                </div>
              </div>
            </div>
          </Tile>
        </Grid>
      </Grid>

      {/* Bottom row: Назначение платежа, Связанная задача, Документы */}
      <Grid container spacing={3}>
        {/* Назначение платежа */}
        <Grid item xs={4}>
          <Tile title="Назначение платежа" dataTestId="tile-purpose">
            <Text style={{ fontSize: 15, lineHeight: 1.5 }}>
              Услуги организатора по Соглашению &quot;№ 456321&quot; от &quot;12.09.2024&quot; об организации размещения облигаций
            </Text>
          </Tile>
        </Grid>

        {/* Связанная задача */}
        <Grid item xs={4}>
          <Tile title="Связанная задача" dataTestId="tile-task">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>Номер объекта</Text>
                <Text style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>№ IB34769</Text>
              </div>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>Исполнитель</Text>
                <Text style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>Иванов С.П.</Text>
              </div>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>Статус</Text>
                <div style={{ marginTop: 4 }}>
                  <DictionaryBadge
                    code="done"
                    name="Выполнено"
                    component="Chip"
                    size="sm"
                    type="read"
                    variant="outlined"
                  />
                </div>
              </div>
            </div>
          </Tile>
        </Grid>

        {/* Документы */}
        <Grid item xs={4}>
          <Tile title="Документы" dataTestId="tile-docs">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>Договор</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: 500 }}>Договор № 3764 от 20.03.2025.pdf</Text>
                  <Icon name="Download" sx={{ color: '#1976d2', fontSize: 16, cursor: 'pointer' }} />
                </div>
              </div>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>Акт</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: 500 }}>№456321 от 12.09.2024</Text>
                  <Icon name="Download" sx={{ color: '#1976d2', fontSize: 16, cursor: 'pointer' }} />
                </div>
              </div>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>Счет-фактура</Text>
                <Text style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>–</Text>
              </div>
              <div>
                <Text style={{ color: '#757575', fontSize: 13 }}>Счет</Text>
                <Text style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>–</Text>
              </div>
            </div>
          </Tile>
        </Grid>
      </Grid>
    </main>
  );
}
