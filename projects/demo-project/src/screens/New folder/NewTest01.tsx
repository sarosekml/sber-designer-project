import React, { useState } from 'react';
import { AppShell, Breadcrumbs, PageHeader } from '../../components/layout';
import { FilterPanel, PageStack } from '../../components/page-layouts';
import { Button, SearchField, SegmentedControl, Badge, Spinner } from '../../components/primitives';
import { DataTable, type DataTableColumn } from '../../components/table';

/* ── Данные договоров (BRD / demo) ── */

type ContractRow = {
  id: string;
  number: string;
  name: string;
  counterparty: string;
  amount: string;
  date: string;
  status: 'active' | 'paused' | 'archived';
  statusLabel: string;
  manager: string;
};

const contractRows: ContractRow[] = [
  { id: '1', number: 'Д-2025/0147', name: 'Поставка ИТ-оборудования', counterparty: 'ООО «ТехноСервис»', amount: '12 450 000', date: '15.03.2025', status: 'active', statusLabel: 'Действует', manager: 'Иванов А.В.', },
  { id: '2', number: 'Д-2025/0152', name: 'Аренда офисных помещений', counterparty: 'АО «Бизнес-Центр»', amount: '8 200 000', date: '01.02.2025', status: 'active', statusLabel: 'Действует', manager: 'Петрова Е.С.', },
  { id: '3', number: 'Д-2025/0161', name: 'Разработка мобильного приложения', counterparty: 'ООО «Диджитал Солюшнс»', amount: '24 700 000', date: '20.04.2025', status: 'paused', statusLabel: 'На согласовании', manager: 'Смирнов Д.К.', },
  { id: '4', number: 'Д-2024/0983', name: 'Услуги консалтинга', counterparty: 'ИП Кузнецов М.Р.', amount: '3 150 000', date: '10.11.2024', status: 'archived', statusLabel: 'Истёк', manager: 'Иванов А.В.', },
  { id: '5', number: 'Д-2025/0174', name: 'Поставка серверного оборудования', counterparty: 'ООО «СерверТех»', amount: '56 800 000', date: '05.05.2025', status: 'active', statusLabel: 'Действует', manager: 'Козлов Р.Н.', },
  { id: '6', number: 'Д-2025/0182', name: 'Лицензии на ПО', counterparty: 'ЗАО «СофтЛайн»', amount: '4 900 000', date: '12.06.2025', status: 'active', statusLabel: 'Действует', manager: 'Петрова Е.С.', },
  { id: '7', number: 'Д-2024/0912', name: 'Услуги охраны', counterparty: 'ООО «ЧОП Гарант»', amount: '1 800 000', date: '01.09.2024', status: 'archived', statusLabel: 'Расторгнут', manager: 'Смирнов Д.К.', },
  { id: '8', number: 'Д-2025/0191', name: 'Рекламные услуги', counterparty: 'ООО «МедиаГрупп»', amount: '6 350 000', date: '18.07.2025', status: 'paused', statusLabel: 'На подписании', manager: 'Козлов Р.Н.', },
];

/* ── Соответствие статусов тонам Badge ── */

const statusToneMap: Record<ContractRow['status'], 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  archived: 'neutral',
};

/* ── Колонки таблицы ── */

const contractColumns: DataTableColumn<ContractRow>[] = [
  { key: 'number', header: '№ договора', cell: (row) => <strong>{row.number}</strong>, sortable: true, width: 160, },
  { key: 'name', header: 'Наименование', cell: (row) => row.name, },
  { key: 'counterparty', header: 'Контрагент', cell: (row) => row.counterparty, },
  { key: 'amount', header: 'Сумма, ₽', cell: (row) => <span className="tnum">{row.amount}</span>, align: 'right', width: 150, },
  { key: 'date', header: 'Дата', cell: (row) => row.date, width: 120, },
  { key: 'status', header: 'Статус', cell: (row) => <Badge tone={statusToneMap[row.status]}>{row.statusLabel}</Badge>, width: 170, },
  { key: 'manager', header: 'Ответственный', cell: (row) => row.manager, width: 150, },
];

/* ── Состояния экрана ── */

type ViewState = 'loading' | 'empty' | 'error' | 'data';

/* ── Экран ── */

export function NewTest01() {
  const [viewState] = useState<ViewState>('data');

  return (
    <main data-sd-screen-root="true">
      <AppShell screenId="screen-1783021130674-new-test-01" section="Договоры">
            <Breadcrumbs items={['Главная', 'Договоры']} />
            <PageHeader
              title="Реестр договоров"
              subtitle="Всего: 8 договоров · обновлено 18.07.2025, 10:31"
              actions={<>
                <Button variant="secondary" size="sm">Импорт</Button>
                <Button size="sm">Создать договор</Button>
              </>}
            />
            <PageStack gap="md">
              <FilterPanel>
                <div className="demo-filter-bar">
                  <SearchField placeholder="Поиск по номеру, названию или контрагенту" />
                  <SegmentedControl active="Все" items={['Все', 'Действует', 'На согласовании', 'Истёк']} />
                </div>
      
                {/* Состояние загрузки */}
                {viewState === 'loading' && (
                  <div
                    style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}
                    role="status"
                    aria-label="Загрузка договоров"
                    aria-live="polite"
                    aria-busy={true}
                    aria-atomic={true} aria-relevant="additions text"
                  >
                    <Spinner />
                    <span style={{ marginLeft: 12, color: 'var(--color-text-secondary)' }}>Загрузка договоров…</span>
                  </div>
                )}
      
                {/* Состояние пустого списка */}
                {viewState === 'empty' && (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-secondary)' }}>
                    <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 8 }}>Договоры не найдены</p>
                    <p>Измените параметры фильтра или создайте новый договор.</p>
                  </div>
                )}
      
                {/* Состояние ошибки */}
                {viewState === 'error' && (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-danger)' }}>
                    <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 8 }}>Ошибка загрузки</p>
                    <p>Не удалось загрузить список договоров. Попробуйте обновить страницу.</p>
                    <Button variant="secondary" size="sm" style={{ marginTop: 12 }}>Повторить</Button>
                  </div>
                )}
      
                {/* Основные данные */}
                {viewState === 'data' && (
                  <DataTable
                    title="Договоры"
                    meta="8 записей"
                    columns={contractColumns}
                    rows={contractRows}
                    getRowId={(row) => row.id}
                    pagination={{ label: '1–8 из 8', pages: [1], activePage: 1 }}
                    selectable
                    selectedCount={0}
                    actions={<>
                      <Button size="sm" variant="ghost">Фильтр</Button>
                      <Button size="sm" variant="secondary">Экспорт</Button>
                    </>}
                  />
                )}
              </FilterPanel>
            </PageStack>
          </AppShell>
    </main>
  );
}
