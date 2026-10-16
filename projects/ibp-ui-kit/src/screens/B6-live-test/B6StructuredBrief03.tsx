import React from 'react';
import { Box } from '@mui/material';
import { Text, Icon, IconButton, BadgeCounter, ProgressBar } from '@/components/atoms';
import { BreadCrumbs } from '@/components/molecules';
import { Tile } from '@/components/molecules/Tiles/Tile';

/* ── Mock data ── */
const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'Сделки', route: '/deals' },
  { name: 'Сделка № 2025-089. ООО «НефтеХим Транзит»', route: '' },
];

const deal = {
  id: '2025-089',
  title: 'Сделка № 2025-089. ООО «НефтеХим Транзит»',
  changedDate: '22.10.2025',
  changedTime: '09:18',
  changedBy: 'Иванов С.П.',
};

const client = {
  name: 'ООО «НефтеХим Транзит»',
  badge: 21,
  inn: '7736012345',
  kpp: '773601001',
  ogrn: '1057700123456',
  km: 'Иванов С.П.',
  segment: 'Крупный бизнес',
  region: 'Центральный ФО',
};

const dealParams = {
  type: 'Кредитная сделка',
  product: 'Возобновляемая кредитная линия',
  currency: 'RUB',
  amount: 1_200_000_000,
  rate: 'КС + 3,0%',
  term: '36 мес.',
  expectedDate: '28.02.2026',
  purpose:
    'Пополнение оборотных средств и финансирование экспортных контрактов на поставку нефтепродуктов в страны СНГ',
};

const stage = {
  name: 'Кредитный анализ',
  status: 'Активная',
  progress: 65,
  probability: 'Средняя',
  startDate: '15.08.2025',
  plannedCloseDate: '28.02.2026',
  comment:
    'Проведён финансовый анализ. Получены положительные заключения риск-подразделения. Ожидается решение кредитного комитета.',
};

const description = {
  summary:
    'Предоставление возобновляемой кредитной линии ООО «НефтеХим Транзит» для пополнения оборотных средств и финансирования экспортных контрактов на поставку нефтепродуктов в страны СНГ. Общий лимит линии — 1,2 млрд руб. сроком на 36 месяцев.',
  background:
    'Клиент — один из крупнейших трейдеров нефтепродуктов в Центральном федеральном округе, работает с банком с 2016 г. Объём контрактов на 2025–2026 гг. составляет более 5 млрд руб. Действующая кредитная линия заканчивается 31.12.2025.',
  risks:
    'Валютные риски по экспортным контрактам (хеджируются форвардами), отраслевая волатильность цен на нефтепродукты, санкционные риски контрагентов. Минимизация: мониторинг финансовых ковенант, поручительство бенефициаров, залог товаров в обороте.',
};

const team = {
  manager: 'Иванов С.П.',
  analyst: 'Петрова А.В.',
  riskManager: 'Кузнецов Д.М.',
  legal: 'Соколова Е.И.',
  creditOfficer: 'Новиков А.Л.',
  supervisor: 'Васильев Р.Г.',
};

/* ── Helpers ── */
function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        mb: 1.5,
      }}
    >
      <Text type="BodyXSReg" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Box sx={{ textAlign: 'right', maxWidth: '60%' }}>{children}</Box>
    </Box>
  );
}

const noop = () => {};

/* ── Main component ── */
export function B6StructuredBrief03() {
  return (
    <main
      data-sd-screen-root="true"
      aria-label={'Сделка № 2025-089'}
      style={{ minHeight: '100vh', background: '#F5F5F5' }}
    >
      {/* Breadcrumbs */}
      <Box sx={{ px: 3, pt: 2, pb: 0 }}>
        <BreadCrumbs navigationSchema={breadcrumbs} onClickLink={noop} />
      </Box>

      {/* Page Header */}
      <Box sx={{ px: 3, py: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'nowrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Text type="H3StrongSmb">{deal.title}</Text>
            <IconButton name="Edit" size="sm" title="Редактировать заголовок" />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Icon name="CheckCircleFilled" size="sm" sx={{ color: '#10B981', fontSize: 14 }} />
            <Text type="BodyXSReg" color="text.secondary">
              Изменено {deal.changedDate}, {deal.changedTime}, {deal.changedBy}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Cards — two-column flex layout */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          px: 3,
          pb: 4,
        }}
      >
        {/* Column 1 */}
        <Box
          sx={{
            flex: '1 1 320px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {/* Карточка: Клиент */}
          <Tile
            title="Клиент"
            dataTestId="tile-client"
            actions={
              <IconButton name="Edit" size="sm" onClick={noop} title="Редактировать" />
            }
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Text type="BodyMReg">{client.name}</Text>
              <BadgeCounter counter={client.badge} size="sm" />
            </Box>
            <FieldRow label="ИНН">
              <Text type="BodyXSReg">{client.inn}</Text>
            </FieldRow>
            <FieldRow label="КПП">
              <Text type="BodyXSReg">{client.kpp}</Text>
            </FieldRow>
            <FieldRow label="ОГРН">
              <Text type="BodyXSReg">{client.ogrn}</Text>
            </FieldRow>
            <FieldRow label="Клиентский менеджер">
              <Text type="BodyXSReg">{client.km}</Text>
            </FieldRow>
            <FieldRow label="Сегмент">
              <Text type="BodyXSReg">{client.segment}</Text>
            </FieldRow>
            <FieldRow label="Регион">
              <Text type="BodyXSReg">{client.region}</Text>
            </FieldRow>
          </Tile>

          {/* Карточка: Стадия */}
          <Tile
            title="Стадия"
            dataTestId="tile-stage"
            actions={
              <IconButton name="Edit" size="sm" onClick={noop} title="Редактировать" />
            }
          >
            <FieldRow label="Текущая стадия">
              <Text type="BodyXSReg">{stage.name}</Text>
            </FieldRow>
            <FieldRow label="Статус">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                  }}
                />
                <Text type="BodyXSReg">{stage.status}</Text>
              </Box>
            </FieldRow>
            <FieldRow label="Прогресс">
              <Box sx={{ flex: 1, maxWidth: 180 }}>
                <ProgressBar value={stage.progress} label={`${stage.progress}%`} />
              </Box>
            </FieldRow>
            <FieldRow label="Вероятность сделки">
              <Text type="BodyXSReg">{stage.probability}</Text>
            </FieldRow>
            <FieldRow label="Дата начала">
              <Text type="BodyXSReg">{stage.startDate}</Text>
            </FieldRow>
            <FieldRow label="Плановая дата закрытия">
              <Text type="BodyXSReg">{stage.plannedCloseDate}</Text>
            </FieldRow>
            <FieldRow label="Комментарий">
              <Text
                type="BodyXSReg"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {stage.comment}
              </Text>
            </FieldRow>
          </Tile>

          {/* Карточка: Команда */}
          <Tile
            title="Команда"
            dataTestId="tile-team"
            actions={
              <IconButton name="Edit" size="sm" onClick={noop} title="Редактировать" />
            }
          >
            <FieldRow label="Менеджер сделки">
              <Text type="BodyXSReg">{team.manager}</Text>
            </FieldRow>
            <FieldRow label="Аналитик">
              <Text type="BodyXSReg">{team.analyst}</Text>
            </FieldRow>
            <FieldRow label="Риск-менеджер">
              <Text type="BodyXSReg">{team.riskManager}</Text>
            </FieldRow>
            <FieldRow label="Юрист">
              <Text type="BodyXSReg">{team.legal}</Text>
            </FieldRow>
            <FieldRow label="Кредитный инспектор">
              <Text type="BodyXSReg">{team.creditOfficer}</Text>
            </FieldRow>
            <FieldRow label="Куратор">
              <Text type="BodyXSReg">{team.supervisor}</Text>
            </FieldRow>
          </Tile>
        </Box>

        {/* Column 2 */}
        <Box
          sx={{
            flex: '1 1 320px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {/* Карточка: Параметры сделки */}
          <Tile
            title="Параметры сделки"
            dataTestId="tile-params"
            actions={
              <IconButton name="Edit" size="sm" onClick={noop} title="Редактировать" />
            }
          >
            <FieldRow label="Тип сделки">
              <Text type="BodyXSReg">{dealParams.type}</Text>
            </FieldRow>
            <FieldRow label="Продукт">
              <Text type="BodyXSReg">{dealParams.product}</Text>
            </FieldRow>
            <FieldRow label="Сумма">
              <Text type="BodyXSReg">
                {dealParams.amount.toLocaleString('ru-RU')} {dealParams.currency}
              </Text>
            </FieldRow>
            <FieldRow label="Ставка">
              <Text type="BodyXSReg">{dealParams.rate}</Text>
            </FieldRow>
            <FieldRow label="Срок">
              <Text type="BodyXSReg">{dealParams.term}</Text>
            </FieldRow>
            <FieldRow label="Ожидаемая дата">
              <Text type="BodyXSReg">{dealParams.expectedDate}</Text>
            </FieldRow>
            <FieldRow label="Целевое назначение">
              <Text
                type="BodyXSReg"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {dealParams.purpose}
              </Text>
            </FieldRow>
          </Tile>

          {/* Карточка: Описание */}
          <Tile
            title="Описание"
            dataTestId="tile-description"
            actions={
              <IconButton name="Edit" size="sm" onClick={noop} title="Редактировать" />
            }
          >
            <FieldRow label="Суть сделки">
              <Text
                type="BodyXSReg"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {description.summary}
              </Text>
            </FieldRow>
            <FieldRow label="Контекст">
              <Text
                type="BodyXSReg"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {description.background}
              </Text>
            </FieldRow>
            <FieldRow label="Риски">
              <Text
                type="BodyXSReg"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {description.risks}
              </Text>
            </FieldRow>
          </Tile>
        </Box>
      </Box>
    </main>
  );
}
