import { KpiCard } from "../../components/cards";
import {
  ChecklistPanel,
  CommentsCard,
  ContactListCard,
  DetailsCard,
  MetricsCard,
  StatusListCard,
  SummaryCard,
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
  Status,
  Tag,
} from "../../components/primitives";
import {
  CardGrid,
  PageStack,
  SplitLayout,
  ThreeColumnGrid,
} from "../../components/page-layouts";
import {
  ChartPanel,
  EntityHeader,
  MetricBar,
  ProgressSteps,
} from "../../components/patterns";
import { DataTable, type DataTableColumn } from "../../components/table";

// ── Meta items ──────────────────────────────────────────────────────────────

const dealMetaItems = [
  { icon: <GlobeIcon />, label: "Сектор", value: "Логистика / складская недвижимость" },
  { icon: <TrendIcon />, label: "Цена сделки", value: "8.95 млрд ₽", mono: true },
  { icon: <PercentIcon />, label: "Target IRR", value: "18.4%", mono: true },
  { icon: <UserIcon />, label: "Deal Lead", value: "Анна Ким" },
];

// ── Asset summary items ─────────────────────────────────────────────────────

const assetSummaryItems = [
  { icon: <BuildingIcon />, label: "Актив", value: "Логистический комплекс «Северный Хаб»" },
  { icon: <GlobeIcon />, label: "Класс / Сектор", value: "A / Логистика" },
  { icon: <HashIcon />, label: "GLA", value: "124 000 м²", mono: true },
  { icon: <CalendarIcon />, label: "Год ввода", value: "2019" },
  { icon: <UsersIcon />, label: "УК", value: "NorthHub Property Management" },
  { icon: <TrendIcon />, label: "NOI 2025", value: "720 млн ₽", mono: true },
];

// ── Buyer items ─────────────────────────────────────────────────────────────

const buyerItems = [
  { icon: <BuildingIcon />, label: "Покупатель", value: "Equitas Real Assets Fund I" },
  { icon: <GlobeIcon />, label: "Тип", value: "Закрытый фонд недвижимости" },
  { icon: <TrendIcon />, label: "Размер фонда", value: "38.2 млрд ₽", mono: true },
  { icon: <TargetIcon />, label: "Dry powder", value: "9.7 млрд ₽", mono: true },
  { icon: <UserIcon />, label: "Partner", value: "Кирилл Воронцов" },
  { icon: <MessageIcon />, label: "Deal Lead", value: "Максим Орлов" },
];

// ── Co-investor items ───────────────────────────────────────────────────────

const coinvestorItems = [
  { icon: <BuildingIcon />, label: "Co-investor", value: "Family Office «Морозов Капитал»" },
  { icon: <TrendIcon />, label: "Equity ticket", value: "0.95 млрд ₽", mono: true },
  { icon: <PercentIcon />, label: "Доля в SPV", value: "20.7% equity" },
  { icon: <UserIcon />, label: "Контакт", value: "Александр Морозов" },
];

// ── Seller items ────────────────────────────────────────────────────────────

const sellerItems = [
  { icon: <BuildingIcon />, label: "Продавец", value: "ООО «СеверИнвест Девелопмент»" },
  { icon: <GlobeIcon />, label: "Тип", value: "Девелопер / владелец" },
  { icon: <MessageIcon />, label: "Причина продажи", value: "Ротация портфеля, снижение долга" },
  { icon: <UserIcon />, label: "Контакт", value: "Олег Лазарев" },
];

// ── Structure items ─────────────────────────────────────────────────────────

const structureItems = [
  { icon: <BuildingIcon />, label: "Тип сделки", value: "Покупка 100% долей SPV" },
  { icon: <ShieldIcon />, label: "Acquisition SPV", value: "ООО «ЭКВ Северный Хаб»" },
  { icon: <TargetIcon />, label: "Target SPV", value: "ООО «Северный Хаб Логистика»" },
  { icon: <GlobeIcon />, label: "Senior lender", value: "Банк «Континент»" },
  { icon: <DocIcon />, label: "Governing law", value: "Российское право" },
];

// ── Sources & Uses ──────────────────────────────────────────────────────────

interface SourcesUsesRow {
  item: string;
  amount: string;
  share: string;
  note: string;
}

const sourcesRows: SourcesUsesRow[] = [
  { item: "Equity фонда", amount: "3.65 млрд ₽", share: "38.2%", note: "Equitas Real Assets Fund I" },
  { item: "Equity co-investor", amount: "0.95 млрд ₽", share: "9.9%", note: "Family Office «Морозов Капитал»" },
  { item: "Senior acquisition debt", amount: "4.75 млрд ₽", share: "49.7%", note: "Банк «Континент»" },
  { item: "Seller deferred payment", amount: "0.20 млрд ₽", share: "2.1%", note: "Выплата через 12 месяцев" },
];

const usesRows: SourcesUsesRow[] = [
  { item: "Цена покупки актива", amount: "8.95 млрд ₽", share: "93.7%", note: "Purchase price за 100% SPV" },
  { item: "Transaction costs", amount: "0.22 млрд ₽", share: "2.3%", note: "Advisors, legal, tax, lender fees" },
  { item: "Initial capex reserve", amount: "0.38 млрд ₽", share: "4.0%", note: "Кровля, HVAC, energy efficiency" },
];

const suColumns: DataTableColumn<SourcesUsesRow>[] = [
  { key: "item", header: "Статья", cell: (r) => r.item },
  { key: "amount", header: "Сумма", cell: (r) => <span className="tnum">{r.amount}</span>, align: "right" },
  { key: "share", header: "Доля", cell: (r) => <span className="tnum">{r.share}</span>, align: "right" },
  { key: "note", header: "Комментарий", cell: (r) => r.note },
];

// ── Debt service forecast ───────────────────────────────────────────────────

interface DebtRow {
  year: string;
  interest: string;
  principal: string;
  service: string;
  dscr: string;
  balance: string;
}

const debtRows: DebtRow[] = [
  { year: "2026 H2", interest: "0.31", principal: "0.00", service: "0.31", dscr: "1.61x", balance: "4.75" },
  { year: "2027", interest: "0.67", principal: "0.00", service: "0.67", dscr: "1.82x", balance: "4.75" },
  { year: "2028", interest: "0.64", principal: "0.55", service: "1.19", dscr: "1.48x", balance: "4.20" },
  { year: "2029", interest: "0.55", principal: "0.75", service: "1.30", dscr: "1.46x", balance: "3.45" },
  { year: "2030", interest: "0.43", principal: "0.85", service: "1.28", dscr: "1.55x", balance: "2.60" },
  { year: "2031 Exit", interest: "0.21", principal: "2.60", service: "2.81", dscr: "Exit", balance: "0.00" },
];

const debtColumns: DataTableColumn<DebtRow>[] = [
  { key: "year", header: "Год", cell: (r) => r.year, width: 90 },
  { key: "interest", header: "Проценты", cell: (r) => <span className="tnum">{r.interest}</span>, align: "right" },
  { key: "principal", header: "Погашение", cell: (r) => <span className="tnum">{r.principal}</span>, align: "right" },
  { key: "service", header: "Debt service", cell: (r) => <span className="tnum">{r.service}</span>, align: "right" },
  { key: "dscr", header: "DSCR", cell: (r) => <span className="tnum">{r.dscr}</span>, align: "right" },
  { key: "balance", header: "Остаток", cell: (r) => <span className="tnum">{r.balance}</span>, align: "right" },
];

// ── Financial model ─────────────────────────────────────────────────────────

interface FinModelRow {
  metric: string;
  y2026: string;
  y2027: string;
  y2028: string;
  y2029: string;
  y2030: string;
  y2031: string;
}

const finModelRows: FinModelRow[] = [
  { metric: "Occupancy", y2026: "96%", y2027: "97%", y2028: "97%", y2029: "96%", y2030: "96%", y2031: "96%" },
  { metric: "Rental income", y2026: "1.12", y2027: "1.25", y2028: "1.37", y2029: "1.49", y2030: "1.60", y2031: "1.69" },
  { metric: "OPEX", y2026: "−0.34", y2027: "−0.38", y2028: "−0.42", y2029: "−0.46", y2030: "−0.49", y2031: "−0.52" },
  { metric: "NOI", y2026: "0.78", y2027: "0.87", y2028: "0.95", y2029: "1.03", y2030: "1.11", y2031: "1.18" },
  { metric: "Debt service", y2026: "−0.31", y2027: "−0.67", y2028: "−1.19", y2029: "−1.30", y2030: "−1.28", y2031: "−2.81" },
  { metric: "CF to equity", y2026: "0.12", y2027: "0.00", y2028: "−0.33", y2029: "−0.37", y2030: "−0.27", y2031: "9.10" },
];

const finModelColumns: DataTableColumn<FinModelRow>[] = [
  { key: "metric", header: "Показатель", cell: (r) => r.metric, width: 140 },
  { key: "y2026", header: "2026E", cell: (r) => <span className="tnum">{r.y2026}</span>, align: "right" },
  { key: "y2027", header: "2027E", cell: (r) => <span className="tnum">{r.y2027}</span>, align: "right" },
  { key: "y2028", header: "2028E", cell: (r) => <span className="tnum">{r.y2028}</span>, align: "right" },
  { key: "y2029", header: "2029E", cell: (r) => <span className="tnum">{r.y2029}</span>, align: "right" },
  { key: "y2030", header: "2030E", cell: (r) => <span className="tnum">{r.y2030}</span>, align: "right" },
  { key: "y2031", header: "2031 Exit", cell: (r) => <span className="tnum">{r.y2031}</span>, align: "right" },
];

// ── Scenario table ──────────────────────────────────────────────────────────

interface ScenarioRow {
  scenario: string;
  exitCap: string;
  noi2031: string;
  exitValue: string;
  irr: string;
  moic: string;
  dscrMin: string;
  status: string;
}

const scenarioRows: ScenarioRow[] = [
  { scenario: "Upside", exitCap: "7.75%", noi2031: "1.26", exitValue: "16.26", irr: "23.8%", moic: "2.72x", dscrMin: "1.58x", status: "Сильный upside" },
  { scenario: "Base", exitCap: "8.25%", noi2031: "1.18", exitValue: "12.70", irr: "18.4%", moic: "2.10x", dscrMin: "1.46x", status: "Целевой" },
  { scenario: "Downside", exitCap: "8.75%", noi2031: "1.06", exitValue: "10.85", irr: "13.2%", moic: "1.55x", dscrMin: "1.32x", status: "Ниже target" },
  { scenario: "Stress", exitCap: "9.25%", noi2031: "0.98", exitValue: "9.35", irr: "8.6%", moic: "1.18x", dscrMin: "1.14x", status: "Covenant pressure" },
];

const scenarioColumns: DataTableColumn<ScenarioRow>[] = [
  { key: "scenario", header: "Сценарий", cell: (r) => r.scenario, width: 90 },
  { key: "exitCap", header: "Exit cap", cell: (r) => <span className="tnum">{r.exitCap}</span>, align: "right" },
  { key: "noi2031", header: "NOI 2031", cell: (r) => <span className="tnum">{r.noi2031}</span>, align: "right" },
  { key: "exitValue", header: "Exit value", cell: (r) => <span className="tnum">{r.exitValue}</span>, align: "right" },
  { key: "irr", header: "IRR", cell: (r) => <span className="tnum">{r.irr}</span>, align: "right" },
  { key: "moic", header: "MOIC", cell: (r) => <span className="tnum">{r.moic}</span>, align: "right" },
  { key: "dscrMin", header: "DSCR min", cell: (r) => <span className="tnum">{r.dscrMin}</span>, align: "right" },
  { key: "status", header: "Статус", cell: (r) => r.status },
];

// ── Tenant table ────────────────────────────────────────────────────────────

interface TenantRow {
  tenant: string;
  area: string;
  share: string;
  leaseEnd: string;
  rate: string;
  indexation: string;
  status: string;
}

const tenantRows: TenantRow[] = [
  { tenant: "РитейлЛогистик", area: "38 000 м²", share: "30.6%", leaseEnd: "2031", rate: "740 ₽/м²", indexation: "CPI + 2%", status: "Active" },
  { tenant: "ФармСклад", area: "22 000 м²", share: "17.7%", leaseEnd: "2030", rate: "820 ₽/м²", indexation: "CPI + 1%", status: "Active" },
  { tenant: "Вектор Маркет", area: "17 500 м²", share: "14.1%", leaseEnd: "2029", rate: "690 ₽/м²", indexation: "CPI + 2%", status: "Active" },
  { tenant: "Helios Delivery", area: "14 300 м²", share: "11.5%", leaseEnd: "2028", rate: "710 ₽/м²", indexation: "CPI", status: "Active" },
  { tenant: "GreenTrade", area: "8 800 м²", share: "7.1%", leaseEnd: "2027", rate: "660 ₽/м²", indexation: "CPI", status: "Renewal risk" },
];

const tenantColumns: DataTableColumn<TenantRow>[] = [
  { key: "tenant", header: "Арендатор", cell: (r) => r.tenant },
  { key: "area", header: "Площадь", cell: (r) => <span className="tnum">{r.area}</span>, align: "right" },
  { key: "share", header: "Доля GLA", cell: (r) => <span className="tnum">{r.share}</span>, align: "right" },
  { key: "leaseEnd", header: "Договор до", cell: (r) => r.leaseEnd },
  { key: "rate", header: "Ставка", cell: (r) => <span className="tnum">{r.rate}</span>, align: "right" },
  { key: "indexation", header: "Индексация", cell: (r) => r.indexation },
  { key: "status", header: "Статус", cell: (r) => r.status === "Active" ? <Badge tone="success">{r.status}</Badge> : <Badge tone="warning">{r.status}</Badge> },
];

// ── DD streams ──────────────────────────────────────────────────────────────

const ddStreamItems = [
  { id: "fin-dd", icon: <CheckIcon />, title: "Financial DD", description: "Анна Ким", value: "86%", badge: <Badge tone="info">В работе</Badge> },
  { id: "legal-dd", icon: <PendingIcon />, title: "Legal DD", description: "LegalLine Partners", value: "74%", badge: <Badge tone="info">В работе</Badge> },
  { id: "tax-dd", icon: <PendingIcon />, title: "Tax DD", description: "TaxPro Advisory", value: "70%", badge: <Badge tone="info">В работе</Badge> },
  { id: "tech-dd", icon: <PendingIcon />, title: "Technical DD", description: "BuildCheck Consulting", value: "64%", badge: <Badge tone="danger">Critical</Badge> },
  { id: "comm-dd", icon: <CheckIcon />, title: "Commercial DD", description: "Максим Орлов", value: "91%", badge: <Badge tone="success">Почти готово</Badge> },
  { id: "esg-dd", icon: <PendingIcon />, title: "ESG DD", description: "ESG Lab", value: "58%", badge: <Badge tone="info">В работе</Badge> },
  { id: "kyc-dd", icon: <CheckIcon />, title: "KYC / Compliance", description: "Ольга Сергеева", value: "100%", badge: <Badge tone="success">Готово</Badge> },
];

// ── Conditions precedent ────────────────────────────────────────────────────

const cpItems = [
  { id: "cp-ic", icon: <PendingIcon />, title: "Финальное одобрение IC", description: "24 июня 2026", badge: <Badge tone="info">Запланировано</Badge> },
  { id: "cp-tech", icon: <PendingIcon />, title: "Финализация technical DD", description: "19 июня 2026", badge: <Badge tone="warning">В работе</Badge> },
  { id: "cp-title", icon: <PendingIcon />, title: "Подтверждение title по участку", description: "21 июня 2026", badge: <Badge tone="danger">Critical</Badge> },
  { id: "cp-debt", icon: <PendingIcon />, title: "Согласование debt facility", description: "25 июня 2026", badge: <Badge tone="warning">В работе</Badge> },
  { id: "cp-spa", icon: <PendingIcon />, title: "Подписание SPA", description: "03 июля 2026", badge: <Badge tone="neutral">Ожидается</Badge> },
  { id: "cp-release", icon: <PendingIcon />, title: "Debt release от текущего банка", description: "15 июля 2026", badge: <Badge tone="neutral">Ожидается</Badge> },
];

// ── Approvals ───────────────────────────────────────────────────────────────

const approvalItems = [
  { id: "appr-ak", icon: <CheckIcon />, title: "Анна Ким", description: "Deal lead", badge: <Badge dot tone="success">Согласовано</Badge> },
  { id: "appr-mo", icon: <CheckIcon />, title: "Максим Орлов", description: "Investment Director", badge: <Badge dot tone="success">Согласовано</Badge> },
  { id: "appr-kv", icon: <PendingIcon />, title: "Кирилл Воронцов", description: "Partner", badge: <Badge dot tone="warning">Комментарии</Badge> },
  { id: "appr-mor", icon: <PendingIcon />, title: "Мария Орлова", description: "Legal", badge: <Badge dot tone="info">В работе</Badge> },
  { id: "appr-ir", icon: <PendingIcon />, title: "Илья Романов", description: "Debt financing", badge: <Badge dot tone="info">В работе</Badge> },
  { id: "appr-en", icon: <CheckIcon />, title: "Елена Никифорова", description: "Asset Management", badge: <Badge dot tone="success">Согласовано</Badge> },
];

// ── Documents ───────────────────────────────────────────────────────────────

const docItems = [
  { id: "doc-ic", icon: <DocIcon />, title: "IC memo", description: "v2.4 · 17 июня 2026", badge: <Badge dot tone="info">В работе</Badge> },
  { id: "doc-model", icon: <DocIcon />, title: "Financial model", description: "v5.1 · 16 июня 2026", badge: <Badge dot tone="warning">Требует обновления</Badge> },
  { id: "doc-loi", icon: <DocIcon />, title: "LOI", description: "final · 02 июня 2026", badge: <Badge dot tone="success">Подписан</Badge> },
  { id: "doc-spa", icon: <DocIcon />, title: "SPA draft", description: "v3.0 · 17 июня 2026", badge: <Badge dot tone="warning">Redline</Badge> },
  { id: "doc-debt", icon: <DocIcon />, title: "Debt term sheet", description: "v1.8 · 14 июня 2026", badge: <Badge dot tone="success">Согласован</Badge> },
  { id: "doc-tech", icon: <DocIcon />, title: "Technical DD report", description: "draft · 16 июня 2026", badge: <Badge dot tone="info">В работе</Badge> },
  { id: "doc-val", icon: <DocIcon />, title: "Valuation report", description: "final · 12 июня 2026", badge: <Badge dot tone="success">Получен</Badge> },
];

// ── Open questions ──────────────────────────────────────────────────────────

const questionItems = [
  { id: "q-title", icon: <PendingIcon />, title: "Подтвердить title по участку", description: "Мария Орлова · 21 июня", badge: <Badge tone="danger">Critical</Badge> },
  { id: "q-roof", icon: <PendingIcon />, title: "Финализировать roof / HVAC capex", description: "BuildCheck · 19 июня", badge: <Badge tone="danger">Critical</Badge> },
  { id: "q-debt", icon: <PendingIcon />, title: "Получить debt credit approval", description: "Илья Романов · 25 июня", badge: <Badge tone="warning">High</Badge> },
  { id: "q-warranty", icon: <PendingIcon />, title: "Согласовать seller warranties", description: "Мария Орлова · 20 июня", badge: <Badge tone="warning">High</Badge> },
  { id: "q-green", icon: <PendingIcon />, title: "Подтвердить renewals GreenTrade", description: "Максим Орлов · 21 июня", badge: <Badge tone="info">Medium</Badge> },
];

// ── Risk profile ────────────────────────────────────────────────────────────

const riskItems = [
  { id: "r-val", icon: <ShieldIcon />, title: "Valuation risk", description: "Чувствительность к exit cap rate", badge: <Badge tone="warning">Средний</Badge> },
  { id: "r-conc", icon: <ShieldIcon />, title: "Tenant concentration", description: "Топ-3 = 62% GLA", badge: <Badge tone="danger">Средний / Высокий</Badge> },
  { id: "r-tech", icon: <ShieldIcon />, title: "Technical capex risk", description: "Кровля и HVAC", badge: <Badge tone="warning">Средний</Badge> },
  { id: "r-title", icon: <ShieldIcon />, title: "Title risk", description: "Вспомогательный участок", badge: <Badge tone="warning">Средний</Badge> },
  { id: "r-fin", icon: <ShieldIcon />, title: "Financing risk", description: "Debt approval pending", badge: <Badge tone="warning">Средний</Badge> },
  { id: "r-rate", icon: <ShieldIcon />, title: "Interest rate risk", description: "Плавающая ставка", badge: <Badge tone="warning">Средний</Badge> },
];

// ── Next actions ────────────────────────────────────────────────────────────

const actionItems = [
  { id: "act-dd", icon: <PendingIcon />, title: "Получить technical DD report", description: "BuildCheck · 19 июня", badge: <Badge tone="warning">В работе</Badge> },
  { id: "act-spa", icon: <PendingIcon />, title: "Согласовать SPA warranties", description: "Мария Орлова · 20 июня", badge: <Badge tone="warning">В работе</Badge> },
  { id: "act-debt", icon: <PendingIcon />, title: "Подтвердить debt approval timeline", description: "Илья Романов · 20 июня", badge: <Badge tone="warning">В работе</Badge> },
  { id: "act-tenant", icon: <PendingIcon />, title: "Звонок с anchor tenant", description: "Максим Орлов · 21 июня", badge: <Badge tone="info">Запланировано</Badge> },
  { id: "act-ic", icon: <PendingIcon />, title: "Обновить IC memo v3", description: "Анна Ким · 22 июня", badge: <Badge tone="info">В работе</Badge> },
];

// ── Pipeline steps ──────────────────────────────────────────────────────────

const pipelineSteps = [
  { title: "Idea sourcing", text: "Завершено", done: true },
  { title: "NDA", text: "Завершено", done: true },
  { title: "Initial screening", text: "Завершено", done: true },
  { title: "LOI", text: "Завершено", done: true },
  { title: "Due diligence", text: "В работе", active: true },
  { title: "Investment committee", text: "Запланирован" },
  { title: "SPA signing", text: "Ожидается" },
  { title: "Financing approval", text: "В работе" },
  { title: "Closing", text: "Ожидается" },
  { title: "Post-closing integration", text: "Ожидается" },
];

// ── Screen ──────────────────────────────────────────────────────────────────

export function DealD3174SevernyHab() {
  return (
    <AppShell
      screenId="screen-deal-d3174-severny-hab"
      section="Deals"
    >
      <Breadcrumbs items={["Deals", "D-3174", "Покупка актива «Северный Хаб»"]} />

      <PageHeader
        title="D-3174 · Покупка актива «Северный Хаб»"
        subtitle="Equitas Real Assets Fund I приобретает 100% SPV, владеющего логистическим комплексом класса A в Московской области"
        actions={
          <>
            <Button variant="secondary">Экспорт</Button>
            <Button variant="secondary">Создать IC memo</Button>
            <Button>Отправить на IC</Button>
          </>
        }
      />

      <PageStack gap="md">
        {/* ── Entity Header ─────────────────────────────────────────────── */}
        <EntityHeader
          actions={
            <>
              <Avatar tone="violet">АК</Avatar>
              <Avatar tone="blue">МО</Avatar>
              <Avatar tone="amber">КВ</Avatar>
            </>
          }
          eyebrow={
            <>
              <Tag tone="capital">Логистика</Tag>
              <PriorityBadge tone="high">Высокий приоритет</PriorityBadge>
              <Badge dot tone="warning">Due diligence</Badge>
              <Badge dot tone="info">SPA negotiation</Badge>
            </>
          }
          logo="СХ"
          meta={<MetaList columns={4} items={dealMetaItems} />}
          subtitle="Equitas Real Assets Fund I + Family Office «Морозов Капитал» · Покупка 100% SPV · 8.95 млрд ₽ · Target IRR 18.4%"
          title="Логистический комплекс «Северный Хаб»"
        />

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <Tabs
          active="Обзор"
          items={[
            { label: "Обзор" },
            { label: "Актив", count: 5 },
            { label: "Покупатель" },
            { label: "Структура", count: 3 },
            { label: "Оценка" },
            { label: "Фин. модель" },
            { label: "Due diligence", count: 7 },
            { label: "Риски", count: 6 },
            { label: "Документы", count: 13 },
            { label: "История", count: 17 },
            { label: "Команда", count: 11 },
          ]}
        />

        {/* ── KPI Row 1 ────────────────────────────────────────────────── */}
        <CardGrid>
          <KpiCard label="Transaction value" value="8.95" unit="млрд ₽" delta="Цена актива без closing costs" />
          <KpiCard label="Total funding need" value="9.55" unit="млрд ₽" delta="Цена + расходы + capex reserve" />
          <KpiCard label="Equity contribution" value="4.60" unit="млрд ₽" delta="Фонд 3.65 + co-investor 0.95" />
          <KpiCard label="Senior debt" value="4.75" unit="млрд ₽" delta="LTV 53% на закрытии" />
          <KpiCard label="Target IRR" value="18.4" unit="%" delta="Базовый сценарий, hold 5 лет" />
          <KpiCard label="Target MOIC" value="2.1" unit="x" delta="На выходе в 2031" />
        </CardGrid>

        {/* ── KPI Row 2 ────────────────────────────────────────────────── */}
        <CardGrid>
          <KpiCard label="NOI 2025" value="720" unit="млн ₽" delta="Стабилизированный NOI" />
          <KpiCard label="Occupancy" value="94" unit="%" delta="Вакансия 7 400 м²" />
          <KpiCard label="WAULT" value="4.8" unit="года" delta="По ключевым арендаторам" />
          <KpiCard label="Entry cap rate" value="8.0" unit="%" delta="NOI / transaction value" />
          <KpiCard label="DSCR 2027E" value="1.82" unit="x" delta="После стабилизации" />
          <KpiCard label="Готовность к IC" value="76" unit="%" delta="5 открытых вопросов" />
        </CardGrid>

        {/* ── Main two-column layout ────────────────────────────────────── */}
        <SplitLayout gap="md">
          {/* ── LEFT: Analytical column ─────────────────────────────────── */}
          <PageStack gap="md">
            {/* Summary по активу */}
            <DetailsCard title="Summary по активу" items={assetSummaryItems} />

            <SummaryCard
              title="Характеристика актива"
              text="«Северный Хаб» — стабилизированный логистический комплекс класса A с высоким уровнем заполняемости, длинным WAULT и диверсифицированной арендной базой. Актив расположен рядом с ключевыми транспортными коридорами юга Московской области."
            />

            {/* Покупатель и продавец */}
            <ThreeColumnGrid>
              <DetailsCard title="Покупатель" items={buyerItems} />
              <DetailsCard title="Co-investor" items={coinvestorItems} />
              <DetailsCard title="Продавец" items={sellerItems} />
            </ThreeColumnGrid>

            {/* Структура сделки */}
            <DetailsCard title="Структура сделки" items={structureItems} />

            <SummaryCard
              title="Transaction mechanics"
              text="Equitas Real Assets Fund I и co-investor вносят equity в acquisition SPV, который привлекает senior debt и покупает 100% долей Target SPV. Существующий долг рефинансируется при closing. Часть суммы — на escrow до закрытия title issue."
            />

            {/* Sources & Uses */}
            <DataTable
              columns={suColumns}
              getRowId={(r) => r.item}
              rows={sourcesRows}
              title="Sources (Источники финансирования)"
            />

            <DataTable
              columns={suColumns}
              getRowId={(r) => r.item}
              rows={usesRows}
              title="Uses (Использование средств)"
            />

            {/* Долговое финансирование */}
            <DataTable
              columns={debtColumns}
              getRowId={(r) => r.year}
              meta="млрд ₽ · прогноз"
              rows={debtRows}
              title="Debt service forecast"
            />

            {/* Valuation */}
            <ThreeColumnGrid>
              <MetricsCard
                title="Valuation metrics"
                items={[
                  { label: "Entry cap rate", progress: 80, tone: "accent", value: "8.0%" },
                  { label: "Stabilized cap rate", progress: 97, tone: "info", value: "9.7%" },
                  { label: "Цена за м² GLA", progress: 72, tone: "accent", value: "72 177 ₽" },
                  { label: "Дисконт к оценке", progress: 16, tone: "success", value: "1.6%" },
                ]}
              />
              <MetricsCard
                title="Cap rate sensitivity"
                items={[
                  { label: "Exit 7.50% → IRR", progress: 88, tone: "success", value: "21.9%" },
                  { label: "Exit 8.25% → IRR", progress: 74, tone: "accent", value: "18.4%" },
                  { label: "Exit 8.50% → IRR", progress: 68, tone: "warning", value: "17.1%" },
                  { label: "Exit 9.00% → IRR", progress: 59, tone: "danger", value: "14.8%" },
                ]}
              />
              <SummaryCard
                title="Вывод по оценке"
                text="Цена сделки в диапазоне рыночных аналогов, подтверждена независимой оценкой. Entry cap rate 8.0% справедлив для актива класса A с WAULT 4.8 года."
              />
            </ThreeColumnGrid>

            {/* Tenant mix */}
            <DataTable
              columns={tenantColumns}
              getRowId={(r) => r.tenant}
              rows={tenantRows}
              title="Tenant mix (Арендаторы)"
            />

            {/* Финансовая модель */}
            <DataTable
              columns={finModelColumns}
              getRowId={(r) => r.metric}
              meta="млрд ₽ · прогноз 5 лет"
              rows={finModelRows}
              title="Финансовая модель актива"
            />

            <ChartPanel
              comparisonValues={[0.78, 0.87, 0.95, 1.03, 1.11, 1.18]}
              meta="NOI trend"
              title="NOI forecast 2026–2031"
              values={[0.72, 0.78, 0.87, 0.95, 1.03, 1.11]}
            />

            {/* Доходность сделки */}
            <ThreeColumnGrid>
              <MetricsCard
                title="Return metrics"
                items={[
                  { label: "Gross IRR", progress: 74, tone: "accent", value: "18.4%" },
                  { label: "Net IRR to fund", progress: 64, tone: "info", value: "15.9%" },
                  { label: "MOIC", progress: 84, tone: "accent", value: "2.1x" },
                  { label: "Cash yield 2027E", progress: 38, tone: "success", value: "9.5%" },
                ]}
              />
              <MetricsCard
                title="Создание стоимости"
                items={[
                  { label: "NOI growth", progress: 42, tone: "accent", value: "0.42x" },
                  { label: "Leverage", progress: 35, tone: "info", value: "0.35x" },
                  { label: "Cap rate / exit", progress: 28, tone: "success", value: "0.28x" },
                  { label: "Capex value", progress: 12, tone: "warning", value: "0.12x" },
                ]}
              />
              <SummaryCard
                title="Вывод по доходности"
                text="Сделка достигает целевых показателей фонда в base case. Основной возврат капитала — на exit в 2031. Net proceeds to equity: 9.10 млрд ₽."
              />
            </ThreeColumnGrid>

            {/* Сценарный анализ */}
            <DataTable
              columns={scenarioColumns}
              getRowId={(r) => r.scenario}
              rows={scenarioRows}
              title="Сценарный анализ"
            />

            <SummaryCard
              title="Вывод по сценариям"
              text="Сделка достигает целевых показателей в base case и имеет upside при сжатии cap rate. Downside снижает IRR ниже target, но сохраняет положительную доходность. Stress требует contingency plan."
            />

            {/* Post-closing plan */}
            <ChecklistPanel
              title="100-day plan"
              items={[
                { label: "Передача управления asset manager (Day 1–15)", checked: false },
                { label: "Tenant communication plan (Day 1–30)", checked: false },
                { label: "Capex tender по roof / HVAC (Day 15–60)", checked: false },
                { label: "Lease-up вакантных площадей (Day 30–100)", checked: false },
                { label: "OPEX optimization (Day 30–100)", checked: false },
                { label: "Insurance update (Day 1–45)", checked: false },
                { label: "ESG baseline measurement (Day 30–90)", checked: false },
                { label: "Debt covenant reporting setup (Day 1–60)", checked: false },
              ]}
            />

            {/* Exit strategy */}
            <SummaryCard
              title="Exit strategy"
              badge={<Badge tone="success">Основной сценарий</Badge>}
              text="Продажа институциональному инвестору в 2030–2031. Exit NOI: 1.175 млрд ₽, exit cap rate: 8.25%, gross exit value: 12.70 млрд ₽, net proceeds to equity: 9.10 млрд ₽."
            />

            {/* Recommendation */}
            <SummaryCard
              title="Рекомендация для Investment Committee"
              badge={<Badge tone="success">Одобрить с условиями</Badge>}
              text="Рекомендуется вынести сделку на IC с предложением одобрить приобретение 100% долей в ООО «Северный Хаб Логистика». Актив соответствует стратегии фонда, обеспечивает целевую доходность 18.4% IRR и 2.1x MOIC. Одобрение при условии закрытия critical DD items, подтверждения debt financing и усиления SPA warranties."
            />
          </PageStack>

          {/* ── RIGHT: Operational column ───────────────────────────────── */}
          <PageStack gap="md">
            {/* Статус сделки */}
            <StatusListCard
              title="Статус сделки"
              action={<span className="tnum text-strong">76%</span>}
              items={[
                { id: "st-ready", icon: <TargetIcon />, title: "Готовность к IC", value: "76%", badge: <Badge tone="warning">5 вопросов</Badge> },
                { id: "st-dd", icon: <DocIcon />, title: "DD completion", value: "71%", badge: <Badge tone="info">В работе</Badge> },
                { id: "st-spa", icon: <DocIcon />, title: "SPA readiness", value: "58%", badge: <Badge tone="warning">Redline</Badge> },
                { id: "st-fin", icon: <TrendIcon />, title: "Financing readiness", value: "64%", badge: <Badge tone="info">В работе</Badge> },
                { id: "st-next", icon: <CalendarIcon />, title: "Следующий milestone", description: "Investment Committee · 24 июня 2026", badge: <Badge tone="violet">IC</Badge> },
              ]}
            />

            {/* Pipeline */}
            <StatusListCard title="Pipeline сделки" items={[]} />
            <div style={{ padding: "0 4px" }}>
              <ProgressSteps items={pipelineSteps} />
            </div>

            {/* Alerts / Red flags */}
            <StatusListCard
              title="Alerts / Red flags"
              items={[
                { id: "alert-title", icon: <PendingIcon />, title: "Title issue по участку не закрыт", description: "Legal memo + escrow protection", badge: <Badge tone="danger">Critical</Badge> },
                { id: "alert-tech", icon: <PendingIcon />, title: "Technical DD не финализирован", description: "Final report до 19 июня", badge: <Badge tone="danger">Critical</Badge> },
                { id: "alert-debt", icon: <PendingIcon />, title: "Debt approval pending", description: "Credit approval до 25 июня", badge: <Badge tone="warning">High</Badge> },
                { id: "alert-anchor", icon: <PendingIcon />, title: "Anchor tenant break option 2029", description: "Tenant meeting до IC", badge: <Badge tone="info">Medium</Badge> },
              ]}
            />

            {/* Следующие действия */}
            <StatusListCard
              title="Следующие действия"
              items={actionItems}
            />

            {/* Риск-профиль */}
            <StatusListCard
              title="Риск-профиль"
              items={riskItems}
            />

            {/* Due diligence status */}
            <StatusListCard
              title="Due diligence status"
              items={ddStreamItems}
            />

            {/* Conditions precedent */}
            <StatusListCard
              title="Conditions precedent"
              items={cpItems}
            />

            {/* Согласования */}
            <StatusListCard
              title="Согласования"
              items={approvalItems}
            />

            {/* Документы */}
            <StatusListCard
              title="Документы"
              items={docItems}
            />

            {/* Открытые вопросы */}
            <StatusListCard
              title="Открытые вопросы"
              items={questionItems}
            />

            {/* Команда сделки */}
            <ContactListCard
              title="Команда сделки"
              items={[
                { initials: "КВ", name: "Кирилл Воронцов", role: "Partner", tone: "violet" },
                { initials: "МО", name: "Максим Орлов", role: "Investment Director", tone: "blue" },
                { initials: "АК", name: "Анна Ким", role: "Deal Lead", tone: "emerald" },
                { initials: "ВЛ", name: "Виктор Лебедев", role: "Financial Analyst", tone: "amber" },
                { initials: "МОр", name: "Мария Орлова", role: "Legal Lead", tone: "rose" },
                { initials: "ИР", name: "Илья Романов", role: "Debt Lead", tone: "blue" },
                { initials: "ЕН", name: "Елена Никифорова", role: "Asset Manager", tone: "emerald" },
              ]}
            />

            {/* Timeline */}
            <TimelineCard
              title="Timeline сделки"
              items={[
                { title: "LOI подписан", text: "Подписан Letter of Intent с продавцом.", when: "02 июня 2026", tone: "success" },
                { title: "Data room открыт", text: "Открыт доступ к data room для due diligence.", when: "05 июня 2026", tone: "info" },
                { title: "Full DD запущен", text: "Запущены все DD workstreams.", when: "10 июня 2026", tone: "info" },
                { title: "SPA draft redline v3", text: "Третья итерация SPA redline.", when: "17 июня 2026", tone: "warning" },
                { title: "Technical DD report", text: "Ожидается финальный technical DD report.", when: "19 июня 2026", tone: "violet" },
                { title: "Investment Committee", text: "Запланировано заседание IC.", when: "24 июня 2026", tone: "violet" },
                { title: "SPA signing", text: "Планируемое подписание SPA.", when: "03 июля 2026" },
                { title: "Closing", text: "Планируемое закрытие сделки.", when: "31 июля 2026" },
              ]}
            />

            {/* Комментарии команды */}
            <CommentsCard title="Комментарии команды" />
          </PageStack>
        </SplitLayout>
      </PageStack>
    </AppShell>
  );
}
