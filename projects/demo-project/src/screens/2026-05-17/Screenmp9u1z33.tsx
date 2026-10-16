import { KpiCard } from "../../components/cards";
import {
  DetailsCard,
  MetricsCard,
  StatusListCard,
  TimelineCard,
} from "../../components/business-cards";
import {
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  DocIcon,
  HashIcon,
  PendingIcon,
  PercentIcon,
  ShieldIcon,
  TargetIcon,
  UsersIcon,
} from "../../components/icons";
import {
  AppShell,
  Breadcrumbs,
  PageHeader,
  Tabs,
} from "../../components/layout";
import {
  GlobeIcon,
  MessageIcon,
  MetaList,
  TrendIcon,
  UserIcon,
} from "../../components/meta-list";
import {
  Avatar,
  Badge,
  Button,
  PriorityBadge,
  Tag,
} from "../../components/primitives";
import {
  CardGrid,
  PageStack,
  SplitLayout,
  ThreeColumnGrid,
} from "../../components/page-layouts";
import { DataTable, type DataTableColumn } from "../../components/table";
import { EntityHeader } from "../../components/patterns";

const dealMetaItems = [
  { icon: <GlobeIcon />, label: "Отрасль", value: "Металлургия" },
  { icon: <TrendIcon />, label: "Сумма", value: "18.5 млрд ₽", mono: true },
  { icon: <PercentIcon />, label: "Ставка", value: "КС + 2.15%" },
  { icon: <UserIcon />, label: "Банкир", value: "Иван Петров" },
];

const borrowerItems = [
  {
    icon: <BuildingIcon />,
    label: "Компания",
    value: "АО «СеверПром Металлургия»",
  },
  {
    icon: <GlobeIcon />,
    label: "Отрасль",
    value: "Металлургия / пром. производство",
  },
  { icon: <UsersIcon />, label: "Группа", value: "СеверПром Group" },
  { icon: <HashIcon />, label: "ИНН", value: "7700000000", mono: true },
  { icon: <UserIcon />, label: "CEO", value: "Алексей Ковалёв" },
];

const creditTermItems = [
  {
    icon: <TrendIcon />,
    label: "Сумма",
    value: "18 500 000 000 ₽",
    mono: true,
  },
  { icon: <GlobeIcon />, label: "Валюта", value: "RUB" },
  { icon: <CalendarIcon />, label: "Срок", value: "5 лет (до июня 2030)" },
  {
    icon: <PercentIcon />,
    label: "Ставка",
    value: "Ключевая ставка ЦБ + 2.15%",
  },
  {
    icon: <MessageIcon />,
    label: "Тип",
    value: "Срочный корпоративный кредит",
  },
  {
    icon: <TargetIcon />,
    label: "Цель",
    value: "Модернизация, рефинансирование, оборотный капитал",
  },
];

interface EconRow {
  year: string;
  interest: string;
  fees: string;
  total: string;
  provisions: string;
  net: string;
}

const econRows: EconRow[] = [
  {
    year: "2026",
    interest: "1 110",
    fees: "185",
    total: "1 295",
    provisions: "−92",
    net: "1 203",
  },
  {
    year: "2027",
    interest: "1 295",
    fees: "92",
    total: "1 387",
    provisions: "−74",
    net: "1 313",
  },
  {
    year: "2028",
    interest: "1 110",
    fees: "55",
    total: "1 165",
    provisions: "−55",
    net: "1 110",
  },
  {
    year: "2029",
    interest: "925",
    fees: "37",
    total: "962",
    provisions: "−37",
    net: "925",
  },
  {
    year: "2030",
    interest: "740",
    fees: "18",
    total: "758",
    provisions: "−18",
    net: "740",
  },
];

const econColumns: DataTableColumn<EconRow>[] = [
  { key: "year", header: "Год", cell: (r) => r.year, width: 80 },
  {
    key: "interest",
    header: "Процентный доход",
    cell: (r) => <span className="tnum">{r.interest}</span>,
    align: "right",
  },
  {
    key: "fees",
    header: "Комиссии",
    cell: (r) => <span className="tnum">{r.fees}</span>,
    align: "right",
  },
  {
    key: "total",
    header: "Всего доход",
    cell: (r) => <span className="tnum">{r.total}</span>,
    align: "right",
  },
  {
    key: "provisions",
    header: "Резервы",
    cell: (r) => <span className="tnum text-danger">{r.provisions}</span>,
    align: "right",
  },
  {
    key: "net",
    header: "Чистый результат",
    cell: (r) => <span className="tnum text-strong">{r.net}</span>,
    align: "right",
  },
];

export function Screenmp9u1z33() {
  return (
    <AppShell
      screenId="screen-1779025844704-screen"
      section="Deals"
    >
      <Breadcrumbs items={["Deals", "D-2115 · СеверПром Металлургия"]} />
      <PageHeader
        title="D-2115 · СеверПром Металлургия"
        subtitle="Синдицированный кредит для модернизации производственных мощностей, рефинансирования долга и пополнения оборотного капитала."
        actions={
          <>
            <Button variant="secondary">Экспорт</Button>
            <Button>Отправить на согласование</Button>
            <Button variant="danger">Удалить</Button>
          </>
        }
      />

      <PageStack gap="md">
        <EntityHeader
          actions={
            <>
              <Avatar tone="blue">ИП</Avatar>
              <Avatar tone="emerald">АС</Avatar>
              <Avatar tone="amber">МГ</Avatar>
            </>
          }
          eyebrow={
            <>
              <Tag tone="metal">Металлургия</Tag>
              <PriorityBadge tone="high">Высокий приоритет</PriorityBadge>
              <Badge dot tone="warning">
                На кредитном комитете
              </Badge>
            </>
          }
          logo="СМ"
          meta={<MetaList columns={4} items={dealMetaItems} />}
          subtitle="СеверПром Group · Срочный корпоративный кредит · 5 лет · RUB"
          title="АО «СеверПром Металлургия»"
        />

        <Tabs
          active="Обзор"
          items={[
            { label: "Обзор" },
            { label: "Финансы", count: 5 },
            { label: "Документы", count: 8 },
            { label: "История", count: 12 },
            { label: "Команда", count: 3 },
          ]}
        />

        <CardGrid>
          <KpiCard
            label="Сумма кредита"
            value="18.5"
            unit="млрд ₽"
            delta="Синдицированный"
          />
          <KpiCard
            label="Ставка"
            value="КС + 2.15"
            unit="%"
            delta="Плавающая"
          />
          <KpiCard label="Срок" value="5" unit="лет" delta="Погашение — 2030" />
          <KpiCard
            label="Доходность"
            value="13.5"
            unit="%"
            delta="Выше бенчмарка"
          />
          <KpiCard label="Риск-рейтинг" value="BB+" delta="Внутренний 7.2" />
          <KpiCard label="След. шаг" value="Комитет" delta="18 июня 2026" />
        </CardGrid>

        <ThreeColumnGrid>
          <DetailsCard title="Заёмщик" items={borrowerItems} />
          <DetailsCard title="Условия кредита" items={creditTermItems} />
          <MetricsCard
            title="Риск-профиль"
            meta={<Badge tone="warning">BB+</Badge>}
            items={[
              {
                label: "PD (1 год)",
                progress: 8,
                tone: "warning",
                value: "0.8%",
              },
              { label: "LGD", progress: 45, tone: "warning", value: "45%" },
              {
                label: "Отраслевой риск",
                progress: 55,
                tone: "warning",
                value: "Средний",
              },
              {
                label: "Страновой риск",
                progress: 30,
                tone: "info",
                value: "Низкий",
              },
            ]}
          />
        </ThreeColumnGrid>

        <ThreeColumnGrid>
          <StatusListCard
            title="Обеспечение"
            action={<span className="tnum text-success text-strong">152%</span>}
            items={[
              {
                id: "plant",
                icon: <ShieldIcon />,
                title: "Производственный комплекс, г. Череповец",
                description: "12.4 млрд ₽",
              },
              {
                id: "warehouse",
                icon: <ShieldIcon />,
                title: "Складская инфраструктура",
                description: "5.8 млрд ₽",
              },
              {
                id: "equipment",
                icon: <ShieldIcon />,
                title: "Оборудование (прокатные станы)",
                description: "6.2 млрд ₽",
              },
              {
                id: "guarantee",
                icon: <ShieldIcon />,
                title: "Поручительство СеверПром Group",
                description: "3.8 млрд ₽",
              },
            ]}
          />

          <StatusListCard
            title="Ковенанты"
            items={[
              {
                id: "debt",
                icon: <CheckIcon />,
                title: "Долг / EBITDA",
                description: "≤ 3.5x",
                value: "OK",
              },
              {
                id: "interest",
                icon: <CheckIcon />,
                title: "EBITDA / Проценты",
                description: "≥ 2.5x",
                value: "OK",
              },
              {
                id: "cash",
                icon: <CheckIcon />,
                title: "Мин. остаток на счёте",
                description: "500 млн ₽",
                value: "OK",
              },
              {
                id: "ifrs",
                icon: <PendingIcon />,
                title: "Квартальная отчётность МСФО",
                description: "Ежеквартально",
                value: "Pending",
              },
            ]}
          />

          <StatusListCard
            title="Согласования"
            items={[
              {
                id: "analyst",
                icon: <CheckIcon />,
                title: "Кредитный аналитик",
                description: "Анна Смирнова",
                badge: (
                  <Badge dot tone="success">
                    Согласовано
                  </Badge>
                ),
              },
              {
                id: "risk",
                icon: <CheckIcon />,
                title: "Риск-менеджер",
                description: "Дмитрий Волков",
                badge: (
                  <Badge dot tone="success">
                    Согласовано
                  </Badge>
                ),
              },
              {
                id: "banker",
                icon: <CheckIcon />,
                title: "Старший банкир",
                description: "Иван Петров",
                badge: (
                  <Badge dot tone="success">
                    Согласовано
                  </Badge>
                ),
              },
              {
                id: "committee",
                icon: <PendingIcon />,
                title: "Кредитный комитет",
                description: "Заседание 18 июня",
                badge: (
                  <Badge dot tone="warning">
                    Ожидает
                  </Badge>
                ),
              },
            ]}
          />
        </ThreeColumnGrid>

        <DataTable
          columns={econColumns}
          getRowId={(r) => r.year}
          meta="млн ₽ · прогноз"
          rows={econRows}
          title="Доходность сделки (economics)"
        />

        <SplitLayout>
          <TimelineCard
            title="История сделки"
            items={[
              {
                title: "Заявка подана",
                text: "АО «СеверПром Металлургия» подало заявку на синдицированный кредит.",
                when: "12 января 2026",
              },
              {
                title: "Предварительный анализ",
                text: "Финансовый и отраслевой анализ завершён. Риск-рейтинг BB+ присвоен.",
                when: "2 февраля 2026",
                tone: "info",
              },
              {
                title: "Структурирование",
                text: "Условия согласованы: 18.5 млрд ₽, КС + 2.15%, 5 лет. Пул банков сформирован.",
                when: "18 марта 2026",
                tone: "info",
              },
              {
                title: "Due diligence",
                text: "Юридическая и финансовая проверка завершена. Залоговая масса подтверждена.",
                when: "22 апреля 2026",
                tone: "warning",
              },
              {
                title: "Кредитный комитет",
                text: "Назначено рассмотрение на 18 июня 2026. Пакет документов направлен членам комитета.",
                when: "15 мая 2026",
                tone: "violet",
              },
            ]}
          />

          <StatusListCard
            title="Документы"
            items={[
              {
                id: "application",
                icon: <DocIcon />,
                title: "Кредитная заявка",
                description: "12.01.2026",
                badge: (
                  <Badge dot tone="success">
                    Готов
                  </Badge>
                ),
              },
              {
                id: "model",
                icon: <DocIcon />,
                title: "Финансовая модель (МСФО)",
                description: "05.02.2026",
                badge: (
                  <Badge dot tone="success">
                    Готов
                  </Badge>
                ),
              },
              {
                id: "risk",
                icon: <DocIcon />,
                title: "Заключение риск-анализа",
                description: "14.02.2026",
                badge: (
                  <Badge dot tone="success">
                    Готов
                  </Badge>
                ),
              },
              {
                id: "agreement",
                icon: <DocIcon />,
                title: "Проект кредитного договора",
                description: "20.03.2026",
                badge: (
                  <Badge dot tone="info">
                    Черновик
                  </Badge>
                ),
              },
              {
                id: "dd",
                icon: <DocIcon />,
                title: "Отчёт due diligence",
                description: "22.04.2026",
                badge: (
                  <Badge dot tone="info">
                    Черновик
                  </Badge>
                ),
              },
              {
                id: "memo",
                icon: <DocIcon />,
                title: "Меморандум для комитета",
                description: "15.05.2026",
                badge: (
                  <Badge dot tone="warning">
                    На проверке
                  </Badge>
                ),
              },
            ]}
          />
        </SplitLayout>
      </PageStack>
    </AppShell>
  );
}
