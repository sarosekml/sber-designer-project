import React from 'react';
import { Grid, Text, Icon, IconButton, BadgeCounter, Button, ProgressBar } from '@/components/atoms';
import { Card } from '@/components/molecules';

/* ── Mock data types ── */
interface Asset {
  id: string;
  name: string;
  year: number;
  volume: number;
  currency: string;
  industry: string;
  subIndustry: string;
  fundName: string;
  fundId: string;
  newsCount: number;
  historyCount: number;
  idea: string;
}

const assets: Asset[] = [
  {
    id: 'A-001', name: 'Облигации Газпром-инвест', year: 2025, volume: 500_000_000,
    currency: 'RUB', industry: 'Нефтегазовый сектор', subIndustry: 'Добыча и переработка',
    fundName: 'Газпром-инвест Фонд', fundId: 'F-001', newsCount: 12, historyCount: 5,
    idea: 'Рефинансирование',
  },
  {
    id: 'A-002', name: 'Акции Росатом', year: 2024, volume: 1_200_000_000,
    currency: 'RUB', industry: 'Энергетика', subIndustry: 'Атомная энергетика',
    fundName: 'Росатом Капитал', fundId: 'F-002', newsCount: 8, historyCount: 3,
    idea: 'Дивидендная доходность',
  },
  {
    id: 'A-003', name: 'Евробонды VTB', year: 2025, volume: 250_000_000,
    currency: 'USD', industry: 'Финансовый сектор', subIndustry: 'Банки',
    fundName: 'VTB International Fund', fundId: 'F-003', newsCount: 4, historyCount: 2,
    idea: 'Повышение рейтинга',
  },
  {
    id: 'A-004', name: 'Акции Яндекс', year: 2024, volume: 850_000_000,
    currency: 'RUB', industry: 'IT и телеком', subIndustry: 'Интернет-платформы',
    fundName: 'Технологический фонд', fundId: 'F-004', newsCount: 15, historyCount: 7,
    idea: 'IPO дочек',
  },
  {
    id: 'A-005', name: 'ОФЗ 26238', year: 2023, volume: 320_000_000,
    currency: 'RUB', industry: 'Государственный сектор', subIndustry: 'Долговые обязательства',
    fundName: 'Газпром-инвест Фонд', fundId: 'F-001', newsCount: 2, historyCount: 1,
    idea: '—',
  },
  {
    id: 'A-006', name: 'Акции Северсталь', year: 2025, volume: 670_000_000,
    currency: 'RUB', industry: 'Металлургия', subIndustry: 'Чёрная металлургия',
    fundName: 'Металлургический фонд', fundId: 'F-005', newsCount: 6, historyCount: 4,
    idea: 'Рост цен на сталь',
  },
];

const industries = ['Все отрасли', 'Нефтегазовый сектор', 'Энергетика', 'Финансовый сектор', 'IT и телеком', 'Металлургия', 'Государственный сектор'];
const industryColors: Record<string, string> = {
  'Нефтегазовый сектор': '#2563EB',
  'Энергетика': '#7C3AED',
  'Финансовый сектор': '#059669',
  'IT и телеком': '#0891B2',
  'Металлургия': '#DC2626',
  'Государственный сектор': '#D97706',
};

function formatVolume(vol: number, currency: string): string {
  const inBillions = vol / 1_000_000_000;
  if (inBillions >= 1) return `${(vol / 1_000_000_000).toFixed(1)} млрд ${currency === 'USD' ? '$' : '₽'}`;
  const inMillions = vol / 1_000_000;
  return `${inMillions.toFixed(0)} млн ${currency === 'USD' ? '$' : '₽'}`;
}

/* ── Table header cell ── */
function Th({ children, sortable = false }: { children: React.ReactNode; sortable?: boolean }) {
  return (
    <Text
      type="BodyXSReg"
      color="text.secondary"
      sx={{
        py: 1.5, px: 1.5, whiteSpace: 'nowrap', userSelect: 'none',
        borderBottom: '1px solid', borderColor: 'divider',
        cursor: sortable ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 0.5,
      }}
    >
      {children}
      {sortable && <Icon name="Sort" size="sm" sx={{ fontSize: 14, color: 'text.disabled' }} />}
    </Text>
  );
}

/* ── Table cell ── */
function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <Grid
      item
      sx={{
        py: 1.5, px: 1.5, whiteSpace: 'nowrap',
        textAlign: align,
        borderBottom: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'center', gap: 0.75,
      }}
    >
      {children}
    </Grid>
  );
}

/* ── Industry badge ── */
function IndustryBadge({ industry }: { industry: string }) {
  const color = industryColors[industry] || '#6B7280';
  return (
    <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
      <Grid sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
      <Text type="BodyXSReg" sx={{ lineHeight: 1.2 }}>{industry}</Text>
    </Grid>
  );
}

/* ── Main component ── */
export function Actives() {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <main
      data-sd-screen-root="true"
      aria-label="Список активов"
      style={{ minHeight: '100vh', background: '#F5F5F5' }}
    >
      {/* Page Header */}
      <Grid sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
        <Grid container alignItems="center" justifyContent="space-between" flexWrap="nowrap">
          <Grid container alignItems="baseline" gap={1.5} flexWrap="nowrap">
            <Text type="H3StrongSmb">Активы</Text>
            <BadgeCounter counter={assets.length} size="sm" />
          </Grid>
          <Grid container gap={1} flexWrap="nowrap">
            <Button type="transparent" size="sm" startIcon="Download">
              Экспорт
            </Button>
            <Button type="accent" size="sm" startIcon="Add">
              Добавить актив
            </Button>
          </Grid>
        </Grid>
      </Grid>

      {/* Filters */}
      <Grid sx={{ px: 3, pb: 1 }}>
        <Grid container alignItems="center" gap={1.5} flexWrap="wrap">
          {/* Search */}
          <Grid
            container
            alignItems="center"
            gap={0.75}
            sx={{
              flex: '1 1 260px', minWidth: 200,
              border: '1px solid', borderColor: 'divider', borderRadius: 1,
              bgcolor: '#fff', px: 1.5, py: 0.75,
            }}
          >
            <Icon name="Search" size="sm" sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Text type="BodyXSReg" color="text.disabled" sx={{ flex: 1 }}>Поиск по названию, ISIN...</Text>
          </Grid>

          {/* Industry filter */}
          <Grid
            container
            alignItems="center"
            gap={0.75}
            sx={{
              border: '1px solid', borderColor: 'divider', borderRadius: 1,
              bgcolor: '#fff', px: 1.5, py: 0.75, cursor: 'pointer',
            }}
          >
            <Text type="BodyXSReg">Отрасль: Все</Text>
            <Icon name="ChevronDown" size="sm" sx={{ fontSize: 14, color: 'text.secondary' }} />
          </Grid>

          {/* Year filter */}
          <Grid
            container
            alignItems="center"
            gap={0.75}
            sx={{
              border: '1px solid', borderColor: 'divider', borderRadius: 1,
              bgcolor: '#fff', px: 1.5, py: 0.75, cursor: 'pointer',
            }}
          >
            <Text type="BodyXSReg">Год: 2023–2025</Text>
            <Icon name="ChevronDown" size="sm" sx={{ fontSize: 14, color: 'text.secondary' }} />
          </Grid>

          {/* Fund filter */}
          <Grid
            container
            alignItems="center"
            gap={0.75}
            sx={{
              border: '1px solid', borderColor: 'divider', borderRadius: 1,
              bgcolor: '#fff', px: 1.5, py: 0.75, cursor: 'pointer',
            }}
          >
            <Text type="BodyXSReg">Фонд: Все</Text>
            <Icon name="ChevronDown" size="sm" sx={{ fontSize: 14, color: 'text.secondary' }} />
          </Grid>

          {selectedIds.size > 0 && (
            <Button type="outlined" size="sm" color="error">
              Отменить {selectedIds.size}
            </Button>
          )}
        </Grid>
      </Grid>

      {/* Table */}
      <Grid sx={{ px: 3, pb: 4 }}>
        <Card title={undefined} extra={undefined}>
          {/* Table header */}
          <Grid container sx={{ px: 1, bgcolor: '#FAFAFA', borderRadius: '4px 4px 0 0' }}>
            <Grid item xs={0.4} sx={{ py: 1.5, px: 1.5 }}>
              <Icon
                name={selectedIds.size === assets.length ? 'CheckBox' : 'CheckBoxBlank'}
                size="sm"
                sx={{ fontSize: 18, color: 'text.disabled', cursor: 'pointer' }}
                onClick={() => {
                  if (selectedIds.size === assets.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(assets.map(a => a.id)));
                  }
                }}
              />
            </Grid>
            <Grid item xs={2.2}><Th sortable>Название</Th></Grid>
            <Grid item xs={1}><Th sortable>Год</Th></Grid>
            <Grid item xs={1.8}><Th sortable>Объем</Th></Grid>
            <Grid item xs={2.2}><Th>Отрасль</Th></Grid>
            <Grid item xs={1.6}><Th>Фонд</Th></Grid>
            <Grid item xs={0.7} sx={{ textAlign: 'center', py: 1.5, px: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <span title="Новости">
                <Icon name="Folder" size="sm" sx={{ fontSize: 15, color: 'text.secondary' }} />
              </span>
            </Grid>
            <Grid item xs={0.7} sx={{ textAlign: 'center', py: 1.5, px: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <span title="История">
                <Icon name="Calendar" size="sm" sx={{ fontSize: 15, color: 'text.secondary' }} />
              </span>
            </Grid>
            <Grid item xs={1.4}><Th>Идея</Th></Grid>
            <Grid item xs={0.4} sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />
          </Grid>

          {/* Table rows */}
          {assets.map((asset) => (
            <Grid
              key={asset.id}
              container
              sx={{
                px: 1,
                transition: 'background 0.1s',
                '&:hover': { bgcolor: '#F9FAFB' },
                bgcolor: selectedIds.has(asset.id) ? '#EFF6FF' : 'transparent',
              }}
            >
              {/* Checkbox */}
              <Grid
                item
                xs={0.4}
                sx={{ py: 1.5, px: 1.5, display: 'flex', alignItems: 'center' }}
                onClick={() => toggleSelect(asset.id)}
              >
                <Icon
                  name={selectedIds.has(asset.id) ? 'CheckBox' : 'CheckBoxBlank'}
                  size="sm"
                  sx={{ fontSize: 18, color: selectedIds.has(asset.id) ? 'primary.main' : 'text.disabled', cursor: 'pointer' }}
                />
              </Grid>

              {/* Name */}
              <Td>
                <Grid
                  container
                  alignItems="center"
                  gap={0.5}
                  flexWrap="nowrap"
                  sx={{ cursor: 'pointer' }}
                >
                  <Text type="BodySReg" color="primary.main" sx={{ fontWeight: 500 }}>
                    {asset.name}
                  </Text>
                  <Icon name="LinkExternal" size="sm" sx={{ fontSize: 12, color: 'primary.light' }} />
                </Grid>
              </Td>

              {/* Year */}
              <Td>
                <Text type="BodyXSReg">{asset.year}</Text>
              </Td>

              {/* Volume */}
              <Td>
                <Grid container flexDirection="column" gap={0.25}>
                  <Text type="BodyXSReg" sx={{ fontWeight: 500 }}>
                    {formatVolume(asset.volume, asset.currency)}
                  </Text>
                </Grid>
              </Td>

              {/* Industry */}
              <Td>
                <Grid container flexDirection="column" gap={0.25}>
                  <IndustryBadge industry={asset.industry} />
                  <Text type="BodyXSReg" color="text.disabled" sx={{ fontSize: 11 }}>
                    {asset.subIndustry}
                  </Text>
                </Grid>
              </Td>

              {/* Fund */}
              <Td>
                <Text type="BodyXSReg" color="primary.main" sx={{ cursor: 'pointer' }}>
                  {asset.fundName}
                </Text>
              </Td>

              {/* News */}
              <Td>
                <BadgeCounter counter={asset.newsCount} size="sm" />
              </Td>

              {/* History */}
              <Td>
                <BadgeCounter counter={asset.historyCount} size="sm" />
              </Td>

              {/* Idea */}
              <Td>
                {asset.idea !== '—' ? (
                  <Text type="BodyXSReg" color="#7C3AED" sx={{ fontStyle: 'italic' }}>
                    {asset.idea}
                  </Text>
                ) : (
                  <Text type="BodyXSReg" color="text.disabled">—</Text>
                )}
              </Td>

              {/* Context menu */}
              <Grid
                item
                xs={0.4}
                sx={{
                  py: 1.5, px: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderBottom: '1px solid', borderColor: 'divider',
                }}
              >
                <IconButton name="MoreDots" size="sm" title="Действия" />
              </Grid>
            </Grid>
          ))}

          {/* Empty row for demonstration if no data */}
          {assets.length === 0 && (
            <Grid container sx={{ px: 1, py: 6 }} justifyContent="center">
              <Grid container flexDirection="column" alignItems="center" gap={1.5}>
                <Icon name="Search" size="md" sx={{ fontSize: 40, color: 'text.disabled' }} />
                <Text type="BodyMReg" color="text.secondary">
                  Активы не найдены
                </Text>
                <Text type="BodyXSReg" color="text.disabled">
                  Попробуйте изменить параметры фильтрации
                </Text>
              </Grid>
            </Grid>
          )}
        </Card>
      </Grid>

      {/* Pagination */}
      <Grid sx={{ px: 3, pb: 4 }}>
        <Grid container alignItems="center" justifyContent="space-between">
          <Text type="BodyXSReg" color="text.secondary">
            Показано {assets.length} из {assets.length} активов
          </Text>
          <Grid container alignItems="center" gap={0.5} flexWrap="nowrap">
            <IconButton name="ChevronLeft" size="sm" title="Назад" disabled />
            <Grid
              sx={{
                minWidth: 32, height: 32, borderRadius: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: 'primary.main', color: '#fff',
              }}
            >
              <Text type="BodyXSReg" sx={{ color: '#fff' }}>1</Text>
            </Grid>
            <IconButton name="ChevronRight" size="sm" title="Вперёд" />
          </Grid>
        </Grid>
      </Grid>
    </main>
  );
}
