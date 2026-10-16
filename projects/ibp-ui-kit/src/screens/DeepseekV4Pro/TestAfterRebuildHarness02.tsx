import React from 'react';
import { Box } from '@mui/material';
import { Text, Icon, IconButton, Page, Divider, DictionaryBadge, Link } from '@/components/atoms';
import { Button } from '@/components/atoms/buttons/Button/Button';
import { BreadCrumbs } from '@/components/molecules';
import { BaseTile } from '@/components/molecules/Tiles';
import { Table } from '@/components/organisms/Tables';
import { Navigation } from '@/components/organisms';
import type { NavigationItemsType } from '@/components/organisms';

/* ── Navigation stub ── */
const LocalLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <Link href={href} underline="none">{children}</Link>
);

const navItems: NavigationItemsType[] = [{ compartment: '', items: [] }];

/* ── Breadcrumbs ── */
const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'Потенциалы DCM', route: '/dcm-potentials' },
  { name: 'Черновик сделки DCM: Кредит № 4B02-04-01669-A-001P', route: '' },
];

/* ── Ratings data ── */
const publicRatings = [
  { badge: 'AA', text: 'Стабильный АКРА от 12.11.2025, Подтвержден' },
  { badge: 'ruAAA', text: 'РА Эксперт от 10.10.2024, Повышен' },
];

/* ── Holding potentials table (mock data) ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const potentialsColumns: any = [
  { name: 'potential', title: 'Потенциал' },
  { name: 'amount', title: 'Сумма, млн руб.' },
  { name: 'rate', title: 'Процентная ставка' },
  { name: 'maturityDate', title: 'Дата погашения' },
  { name: 'reason', title: 'Причина' },
  { name: 'actions', title: 'Действия' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const potentialsRows: any[] = [
  { potential: 'АФК «Система» Потенциалов: 5, Сумма: 120 млн руб.', amount: '', rate: '', maturityDate: '', reason: '', actions: '' },
  { potential: '  ПАО АФК «Система» Потенциалов: 2, Сумма: 60 млн руб.', amount: '', rate: '', maturityDate: '', reason: '', actions: '' },
  { potential: '    Кредит', amount: '20', rate: '23 %', maturityDate: '15.09.2026', reason: 'Финансирование к погашению', actions: '' },
  { potential: '    Облигация в валюте', amount: '40', rate: 'КС + 1,9 %', maturityDate: '28.09.2026', reason: 'Финансирование к погашению', actions: '' },
  { potential: '  ПАО «МТС» Потенциалов: 3, Сумма: 330 млн руб.', amount: '', rate: '', maturityDate: '', reason: '', actions: '' },
  { potential: '    Кредит', amount: '20', rate: '19 %', maturityDate: '10.09.2026', reason: 'Финансирование к погашению', actions: '' },
  { potential: '    Облигация в валюте', amount: '300', rate: 'КС + 3 %', maturityDate: '01.09.2026', reason: 'Финансирование к погашению', actions: '' },
  { potential: '    Облигация', amount: '10', rate: 'RUONIA + 2 %', maturityDate: '25.09.2026', reason: 'Финансирование к погашению', actions: '' },
];

/* ── Screen ── */
export function TestAfterRebuildHarness02() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Navigation items={navItems} localLinkComponent={LocalLink} dataTestId="DcmDraftDealNavigation" />

      <Page dataTestId="DcmDraftDealPage" sx={{ backgroundColor: 'var(--BGPageLinearStart, #f5f5f5)', minHeight: '100vh', flex: 1 }}>
        <BreadCrumbs dataTestId="DcmDraftDealBreadcrumbs" navigationSchema={breadcrumbs} onClickLink={() => {}} />

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Text type="H4StrongSmb">Черновик сделки DCM: Кредит № 4B02-04-01669-A-001P</Text>
            <IconButton name="Edit" dataTestId="EditDraftTitle" size="lg" />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button type="accent" startIcon="DocumentCheck">Перевести в сделку DCM</Button>
            <IconButton name="MoreDots" dataTestId="DraftMoreActions" size="lg" />
          </Box>
        </Box>

        {/* Meta line */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
          <Icon name="CheckCircle" />
          <Text type="BodySReg">Изменено 02.07.2025, 10:04, Сергеев И.П.</Text>
        </Box>

        {/* Content — Tile cards in a flex-wrap box */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {/* ClientInfoTile */}
          <BaseTile title="Клиент" size="md" variant="outlined" actions={<IconButton name="ArrowBlockRight" dataTestId="GoToClient" />} sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 300 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Text type="BodyMReg">Наименование: ПАО АФК «Система»</Text>
              <Text type="BodyMReg">Отрасль: Ретейл</Text>
              <Text type="BodyMReg">КМ: Иванов И.И.</Text>
              <Text type="BodyMReg">Табельный номер: 213456789</Text>
              <Text type="BodyMReg">ТБ: Среднерусский банк</Text>
              <Divider orientation="horizontal" flexItem />
              <Text type="BodySReg" sx={{ fontWeight: 600 }}>Рейтинг</Text>
              <Text type="BodySReg" sx={{ fontWeight: 600 }}>Публичный</Text>
              {publicRatings.map((r, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DictionaryBadge code={r.badge} name={r.badge} component="Chip" variant="outlined" size="sm" />
                  <Text type="BodySReg">{r.text}</Text>
                </Box>
              ))}
              <Text type="BodySReg">Расчетный по внутренним рейтингам в Сбере</Text>
              <DictionaryBadge code="AAA" name="AAA" component="Chip" variant="outlined" size="sm" />
              <Text type="BodySReg">Расчетный спред: 180 bps</Text>
              <Divider orientation="horizontal" flexItem />
              <Text type="BodyMReg">Публичные выпуски: Да</Text>
              <Button type="outlined" size="xs">Посмотреть текущие выпуски</Button>
            </Box>
          </BaseTile>

          {/* CreditTermsTile */}
          <BaseTile title="Условия кредита" size="md" variant="outlined" sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 300 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Text type="BodyMReg">Сумма финансирования: 20 млн руб.</Text>
              <Text type="BodyMReg">Остаток срочной задолженности: 9,95 млн руб.</Text>
              <Text type="BodyMReg">Невыбранный лимит: 0,5 млн руб.</Text>
              <Text type="BodyMReg">Процентная ставка: 23 %</Text>
              <Text type="BodyMReg">Дата погашения: 12.12.2025</Text>
              <Text type="BodyMReg">Дата выдачи: 12.12.2023</Text>
              <Text type="BodyMReg">Номер договора: 4B02-04-01669-A-001P</Text>
              <Text type="BodyMReg">Является рефинансированием: Да</Text>
              <Text type="BodyMReg">Тип кредита: 931 Корпоративное кредитование — возобновляемая кредитная линия</Text>
            </Box>
          </BaseTile>

          {/* HoldingInfoTile */}
          <BaseTile title="Холдинг" size="md" variant="outlined" actions={<IconButton name="ArrowBlockRight" dataTestId="GoToHolding" />} sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 300 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Text type="BodyMReg">Наименование: АФК «Система»</Text>
              <Text type="BodyMReg">КМ Холдинга: Петров И.И.</Text>
              <Text type="BodyMReg">Табельный номер: 213456790</Text>
              <Text type="BodyMReg">ТБ: Среднерусский банк</Text>
            </Box>
          </BaseTile>

          {/* CommentsTile */}
          <BaseTile title="Комментарии" size="md" variant="outlined" actions={<IconButton name="Edit" dataTestId="EditComment" />} sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 300 }}>
            <Text type="BodyMReg">
              Пришли к выводу, что можно предложить выпуск облигаций в качестве основного продукта, а также будет дополнительное соглашение на выкуп облигаций банком.
            </Text>
          </BaseTile>

          {/* HoldingPotentialsTile */}
          <BaseTile title="Потенциалы холдинга" size="md" variant="outlined" sx={{ flex: '1 1 100%' }}>
            <Table dataTestId="DcmDraftDeal_HoldingPotentials" columns={potentialsColumns} rows={potentialsRows} />
          </BaseTile>
        </Box>
      </Page>
    </Box>
  );
}
