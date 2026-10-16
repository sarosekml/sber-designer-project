import React, { useMemo, useState } from 'react';
import type { ChartData } from 'chart.js';

import {
  BadgeCounter,
  Button,
  ButtonGroup,
  DictionaryBadge,
  Divider,
  Grid,
  Icon,
  IconButton,
  Link,
  Page,
  ProgressBar,
  RiskMetricsBadge,
  SegmentControl,
  SxBox,
  Tab,
  Text,
} from '@/components/atoms';
import type { BadgeColorThemeSx, IconName } from '@/components/atoms';
import {
  Alert,
  Bar,
  BreadCrumbs,
  Card,
  DashboardCard,
  Entity,
  InputText,
  Pie,
  ProductRow,
  Stepper,
  TabsGroup,
} from '@/components/molecules';
import { Table } from '@/components/organisms';
import type { ColumnsConfig, Row } from '@/components/organisms/Tables';
import { theme } from '@/styles';
import type { Sx } from '@/utils';

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';
type ProductId = 'mezzanine' | 'bond' | 'rcf';
type CellValue = string | number | boolean;
type GenericTableRow = Record<string, CellValue>;

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  dataTestId?: string;
}

interface DataTableProps {
  dataTestId: string;
  columns: ColumnsConfig<GenericTableRow>;
  rows: Row<GenericTableRow>[];
  minWidth?: number;
}

interface MetricItem {
  label: string;
  value: string;
}

interface ProductItem {
  id: ProductId;
  title: string;
  subtitle: string;
  limit: string;
  share: string;
  tenor: string;
  rate: string;
  repayment: string;
  purpose: string;
  status: string;
  tone: Tone;
  icon: IconName;
  details: MetricItem[];
  risks: string[];
  mitigants: string[];
}

const deal = {
  id: 'D-2487',
  title: 'D-2487 • СеверПром Металлургия',
  subtitle: 'Структурированное финансирование: мезонин, облигации и кредитная линия',
  borrower: 'АО «СеверПром Металлургия»',
  group: 'СеверПром Group',
  sector: 'Металлургия / промышленное производство',
  region: 'Вологодская область',
  headOffice: 'Череповец',
  type: 'Комплексная структура корпоративного финансирования',
  totalLimit: '24.8 млрд ₽',
  currency: 'RUB',
  tenor: '5 лет',
  period: 'июль 2026 — июнь 2031',
  blendedRate: 'КС + 2.85%',
  expectedYield: '14.2%',
  riskRating: 'BB+',
  pd1y: '0.9%',
  lgd: '42%',
  expectedLoss: '0.38%',
  status: 'На кредитном комитете',
  priority: 'Высокий',
  readiness: 82,
  nextStep: 'Обновить финансовую модель и вынести сделку на комитет',
  committeeDate: '18 июня 2026',
  modelVersion: 'Credit model v3.2',
  lastUpdated: '12 июня 2026, 18:40',
  updatedBy: 'Анна Смирнова',
};

const tabs = [
  { label: 'Обзор', value: 'overview', count: 6 },
  { label: 'Клиент', value: 'client' },
  { label: 'Структура сделки', value: 'structure', count: 3 },
  { label: 'График погашения', value: 'repayment' },
  { label: 'Финансовая модель', value: 'model' },
  { label: 'Риски', value: 'risks', count: 8 },
  { label: 'Ковенанты', value: 'covenants' },
  { label: 'Документы', value: 'documents', count: 11 },
  { label: 'История', value: 'history' },
  { label: 'Команда', value: 'team' },
] as const;

const products: ProductItem[] = [
  {
    id: 'mezzanine',
    title: 'Мезонинное финансирование',
    subtitle: 'CAPEX и модернизация прокатного цеха',
    limit: '6.0 млрд ₽',
    share: '24%',
    tenor: '5 лет',
    rate: 'КС + 5.25%',
    repayment: 'Bullet в конце срока',
    purpose: 'CAPEX и модернизация прокатного цеха',
    status: 'Требует согласования риска',
    tone: 'warning',
    icon: 'BarChartSquare',
    details: [
      { label: 'Старшинство', value: 'Субординированный долг' },
      { label: 'Upfront fee', value: '1.2%' },
      { label: 'Обеспечение', value: 'Корпоративная гарантия СеверПром Group' },
      { label: 'Документация', value: 'Term sheet согласован, intercreditor agreement в работе' },
    ],
    risks: ['субординация к senior debt', 'bullet-погашение в 2031 году', 'зависимость от реализации CAPEX-программы'],
    mitigants: ['повышенная ставка и корпоративная гарантия', 'dividend stopper', 'ежеквартальный контроль DSCR'],
  },
  {
    id: 'bond',
    title: 'Облигационный выпуск',
    subtitle: 'Рефинансирование существующего долга',
    limit: '12.5 млрд ₽',
    share: '50%',
    tenor: '5 лет',
    rate: 'КС + 2.40%',
    repayment: 'Амортизация с 3-го года',
    purpose: 'Рефинансирование существующего долга',
    status: 'Документация в работе',
    tone: 'info',
    icon: 'PresentationChart',
    details: [
      { label: 'Роль банка', value: 'Организатор и якорный инвестор' },
      { label: 'Доля банка', value: 'До 4.0 млрд ₽' },
      { label: 'Предварительный рейтинг', value: 'ruA-' },
      { label: 'План размещения', value: '30 июля 2026' },
    ],
    risks: [
      'рыночное окно может ухудшиться',
      'рост ключевой ставки может повысить купон',
      'недостаточный спрос увеличит долю банка',
    ],
    mitigants: [
      'якорный интерес инвесторов предварительно подтвержден',
      'амортизируемая структура',
      'лимит участия банка в выпуске',
    ],
  },
  {
    id: 'rcf',
    title: 'Возобновляемая кредитная линия',
    subtitle: 'Оборотный капитал и сезонная ликвидность',
    limit: '6.3 млрд ₽',
    share: '26%',
    tenor: '3 года',
    rate: 'КС + 2.10%',
    repayment: 'Транши до 180 дней',
    purpose: 'Оборотный капитал',
    status: 'Условия согласованы',
    tone: 'success',
    icon: 'Refresh',
    details: [
      { label: 'Доступность лимита', value: '24 месяца' },
      { label: 'Fee за невыбранный лимит', value: '0.35%' },
      { label: 'Обеспечение', value: 'Запасы и дебиторская задолженность' },
      { label: 'Мониторинг', value: 'Borrowing base и ежемесячный reporting' },
    ],
    risks: ['качество дебиторской задолженности', 'снижение оборачиваемости запасов', 'рост потребности в ликвидности'],
    mitigants: ['borrowing base', 'контроль поступлений на счета банка', 'залог запасов и дебиторской задолженности'],
  },
];

const kpiCards = [
  { title: deal.totalLimit, text: 'Общий лимит · 3 продукта' },
  { title: deal.blendedRate, text: 'Средневзвешенная ставка по структуре' },
  { title: deal.tenor, text: 'Срок финансирования до июня 2031' },
  { title: deal.expectedYield, text: 'Доходность выше бенчмарка на 1.4 п.п.' },
  { title: deal.riskRating, text: 'Risk rating · внутренняя модель v7.4' },
  { title: '3.1x', text: 'Debt / EBITDA · ковенантный лимит ≤ 3.5x' },
  { title: '18.6%', text: 'RAROC по структуре сделки' },
  { title: '131%', text: 'Покрытие обеспечением' },
];

const summaryRows: Row<GenericTableRow>[] = [
  { parameter: 'Клиент', value: deal.borrower, parameter2: 'Группа', value2: deal.group },
  { parameter: 'Отрасль', value: deal.sector, parameter2: 'Регион', value2: deal.region },
  { parameter: 'Тип сделки', value: deal.type, parameter2: 'Валюта', value2: deal.currency },
  { parameter: 'Общий лимит', value: deal.totalLimit, parameter2: 'Период', value2: deal.period },
  {
    parameter: 'Blended ставка',
    value: deal.blendedRate,
    parameter2: 'Ожидаемая доходность',
    value2: deal.expectedYield,
  },
  {
    parameter: 'Риск-рейтинг',
    value: deal.riskRating,
    parameter2: 'PD 1Y / LGD',
    value2: `${deal.pd1y} / ${deal.lgd}`,
  },
  { parameter: 'Expected Loss', value: deal.expectedLoss, parameter2: 'Дата комитета', value2: deal.committeeDate },
  {
    parameter: 'Ответственный банкир',
    value: 'Иван Петров',
    parameter2: 'Кредитный аналитик',
    value2: 'Анна Смирнова',
  },
  { parameter: 'Risk manager', value: 'Дмитрий Волков', parameter2: 'DCM', value2: 'Павел Егоров' },
];

const productRows: Row<GenericTableRow>[] = products.map((product) => ({
  product: product.title,
  limit: product.limit,
  share: product.share,
  tenor: product.tenor,
  rate: product.rate,
  repayment: product.repayment,
  purpose: product.purpose,
  status: product.status,
}));

const aggregateRows: Row<GenericTableRow>[] = [
  { metric: 'Общий лимит', value: '24.8 млрд ₽', metric2: 'Средневзвешенная ставка', value2: 'КС + 2.85%' },
  { metric: 'Средневзвешенный срок', value: '4.6 года', metric2: 'Средневзвешенная комиссия', value2: '1.05%' },
  { metric: 'Ожидаемая комиссия банка', value: '420 млн ₽', metric2: 'Доля senior debt', value2: '76%' },
  { metric: 'Доля subordinated debt', value: '24%', metric2: 'Балансовый риск банка', value2: '16.8 млрд ₽' },
  { metric: 'Риск через рынок капитала', value: '8.0 млрд ₽', metric2: 'Cross-sell потенциал', value2: 'Высокий' },
];

const repaymentRows: Row<GenericTableRow>[] = [
  {
    period: '2026 H2',
    principal: '0.4 млрд ₽',
    interest: '0.9 млрд ₽',
    payment: '1.3 млрд ₽',
    debt: '24.4 млрд ₽',
    dscr: '1.54x',
    comment: 'Выдача финансирования и старт процентных выплат',
  },
  {
    period: '2027',
    principal: '1.2 млрд ₽',
    interest: '2.8 млрд ₽',
    payment: '4.0 млрд ₽',
    debt: '23.2 млрд ₽',
    dscr: '1.35x',
    comment: 'Погашение краткосрочных траншей кредитной линии',
  },
  {
    period: '2028',
    principal: '3.6 млрд ₽',
    interest: '2.6 млрд ₽',
    payment: '6.2 млрд ₽',
    debt: '19.6 млрд ₽',
    dscr: '1.49x',
    comment: 'Старт амортизации облигационного выпуска',
  },
  {
    period: '2029',
    principal: '4.8 млрд ₽',
    interest: '2.2 млрд ₽',
    payment: '7.0 млрд ₽',
    debt: '14.8 млрд ₽',
    dscr: '1.58x',
    comment: 'Плановое снижение долговой нагрузки',
  },
  {
    period: '2030',
    principal: '6.2 млрд ₽',
    interest: '1.7 млрд ₽',
    payment: '7.9 млрд ₽',
    debt: '8.6 млрд ₽',
    dscr: '1.66x',
    comment: 'Основной пик амортизации облигаций',
  },
  {
    period: '2031 H1',
    principal: '8.6 млрд ₽',
    interest: '0.8 млрд ₽',
    payment: '9.4 млрд ₽',
    debt: '0 млрд ₽',
    dscr: '1.72x',
    comment: 'Погашение мезонина и финальный расчет',
  },
];

const repaymentByProductRows: Row<GenericTableRow>[] = [
  { period: '2026 H2', mezzanine: '—', bond: '—', rcf: '0.4 млрд ₽', total: '0.4 млрд ₽' },
  { period: '2027', mezzanine: '—', bond: '—', rcf: '1.2 млрд ₽', total: '1.2 млрд ₽' },
  { period: '2028', mezzanine: '—', bond: '2.5 млрд ₽', rcf: '1.1 млрд ₽', total: '3.6 млрд ₽' },
  { period: '2029', mezzanine: '—', bond: '3.8 млрд ₽', rcf: '1.0 млрд ₽', total: '4.8 млрд ₽' },
  { period: '2030', mezzanine: '—', bond: '5.2 млрд ₽', rcf: '1.0 млрд ₽', total: '6.2 млрд ₽' },
  { period: '2031 H1', mezzanine: '6.0 млрд ₽', bond: '1.0 млрд ₽', rcf: '1.6 млрд ₽', total: '8.6 млрд ₽' },
];

const useOfFundsRows: Row<GenericTableRow>[] = [
  {
    direction: 'Модернизация производственных мощностей',
    amount: '9.2 млрд ₽',
    share: '37%',
    source: 'Мезонин + облигации',
  },
  { direction: 'Рефинансирование существующего долга', amount: '8.5 млрд ₽', share: '34%', source: 'Облигации' },
  { direction: 'Пополнение оборотного капитала', amount: '4.3 млрд ₽', share: '17%', source: 'Кредитная линия' },
  { direction: 'Резерв ликвидности', amount: '1.8 млрд ₽', share: '7%', source: 'Кредитная линия' },
  {
    direction: 'Комиссии, выпуск облигаций, юридическое сопровождение',
    amount: '1.0 млрд ₽',
    share: '4%',
    source: 'Все продукты',
  },
  { direction: 'Итого', amount: '24.8 млрд ₽', share: '100%', source: '—' },
];

const financialRows: Row<GenericTableRow>[] = [
  {
    metric: 'Выручка',
    y2024: '118.4 млрд ₽',
    y2025: '126.9 млрд ₽',
    y2026: '139.5 млрд ₽',
    y2027: '151.3 млрд ₽',
    y2028: '162.7 млрд ₽',
  },
  {
    metric: 'EBITDA',
    y2024: '19.6 млрд ₽',
    y2025: '21.4 млрд ₽',
    y2026: '24.1 млрд ₽',
    y2027: '27.8 млрд ₽',
    y2028: '31.2 млрд ₽',
  },
  { metric: 'EBITDA margin', y2024: '16.6%', y2025: '16.9%', y2026: '17.3%', y2027: '18.4%', y2028: '19.2%' },
  {
    metric: 'Чистый долг',
    y2024: '42.8 млрд ₽',
    y2025: '47.6 млрд ₽',
    y2026: '74.2 млрд ₽',
    y2027: '71.5 млрд ₽',
    y2028: '64.8 млрд ₽',
  },
  { metric: 'Debt / EBITDA', y2024: '2.2x', y2025: '2.2x', y2026: '3.1x', y2027: '2.6x', y2028: '2.1x' },
  {
    metric: 'FCF',
    y2024: '4.1 млрд ₽',
    y2025: '3.8 млрд ₽',
    y2026: '2.6 млрд ₽',
    y2027: '5.9 млрд ₽',
    y2028: '8.4 млрд ₽',
  },
  {
    metric: 'CAPEX',
    y2024: '7.8 млрд ₽',
    y2025: '9.1 млрд ₽',
    y2026: '15.4 млрд ₽',
    y2027: '12.6 млрд ₽',
    y2028: '9.7 млрд ₽',
  },
  {
    metric: 'Cash balance',
    y2024: '6.4 млрд ₽',
    y2025: '5.9 млрд ₽',
    y2026: '4.8 млрд ₽',
    y2027: '6.1 млрд ₽',
    y2028: '8.9 млрд ₽',
  },
];

const debtStructureRows: Row<GenericTableRow>[] = [
  { category: 'Краткосрочные кредиты', before: '18.2 млрд ₽', after: '7.4 млрд ₽', change: '-10.8 млрд ₽' },
  { category: 'Долгосрочные кредиты', before: '24.6 млрд ₽', after: '31.1 млрд ₽', change: '+6.5 млрд ₽' },
  { category: 'Облигации', before: '0.0 млрд ₽', after: '12.5 млрд ₽', change: '+12.5 млрд ₽' },
  { category: 'Мезонин', before: '0.0 млрд ₽', after: '6.0 млрд ₽', change: '+6.0 млрд ₽' },
  { category: 'Кредитная линия', before: '5.8 млрд ₽', after: '6.3 млрд ₽', change: '+0.5 млрд ₽' },
  { category: 'Итого долг', before: '48.6 млрд ₽', after: '57.3 млрд ₽', change: '+8.7 млрд ₽' },
];

const economicsRows: Row<GenericTableRow>[] = [
  { metric: 'Interest income за 5 лет', value: '8.4 млрд ₽', metric2: 'Fee income', value2: '420 млн ₽' },
  { metric: 'Upfront fee', value: '248 млн ₽', metric2: 'Commitment fee', value2: '72 млн ₽' },
  { metric: 'DCM fee', value: '100 млн ₽', metric2: 'Expected loss', value2: '94 млн ₽' },
  { metric: 'Economic capital', value: '2.9 млрд ₽', metric2: 'RWA impact', value2: '17.3 млрд ₽' },
  { metric: 'RAROC', value: '18.6%', metric2: 'Net contribution', value2: '1.7 млрд ₽' },
];

const productEconomicsRows: Row<GenericTableRow>[] = [
  {
    product: 'Мезонин',
    interest: '2.9 млрд ₽',
    fee: '72 млн ₽',
    raroc: '21.4%',
    comment: 'Высокая маржа, повышенный риск',
  },
  {
    product: 'Облигации',
    interest: '2.1 млрд ₽',
    fee: '100 млн ₽',
    raroc: '15.2%',
    comment: 'DCM fee + якорное участие',
  },
  {
    product: 'Кредитная линия',
    interest: '3.4 млрд ₽',
    fee: '248 млн ₽',
    raroc: '17.8%',
    comment: 'Доход зависит от utilization',
  },
];

const scenarioRows: Row<GenericTableRow>[] = [
  {
    scenario: 'Базовый',
    ebitda: '27.8 млрд ₽',
    debtEbitda: '2.6x',
    dscr: '1.62x',
    cash: '6.1 млрд ₽',
    status: 'Комфортный запас',
  },
  {
    scenario: 'Негативный',
    ebitda: '22.9 млрд ₽',
    debtEbitda: '3.1x',
    dscr: '1.31x',
    cash: '3.2 млрд ₽',
    status: 'Близко к минимальному уровню',
  },
  {
    scenario: 'Стресс',
    ebitda: '19.4 млрд ₽',
    debtEbitda: '3.7x',
    dscr: '1.08x',
    cash: '1.1 млрд ₽',
    status: 'Нарушение ковенантов',
  },
];

const rateSensitivityRows: Row<GenericTableRow>[] = [
  { change: '-100 б.п.', rate: 'КС + 2.85%, ниже база', expense: '7.8 млрд ₽', dscr: '1.78x', status: 'Улучшение' },
  { change: 'Базовый уровень', rate: 'КС + 2.85%', expense: '8.7 млрд ₽', dscr: '1.62x', status: 'OK' },
  { change: '+100 б.п.', rate: 'КС + 2.85%, выше база', expense: '9.6 млрд ₽', dscr: '1.46x', status: 'OK' },
  {
    change: '+250 б.п.',
    rate: 'КС + 2.85%, стресс',
    expense: '11.1 млрд ₽',
    dscr: '1.22x',
    status: 'Близко к нарушению',
  },
];

const riskRows: Row<GenericTableRow>[] = [
  { metric: 'Внутренний рейтинг', value: deal.riskRating, metric2: 'PD 1Y', value2: deal.pd1y },
  { metric: 'LGD', value: deal.lgd, metric2: 'Expected Loss', value2: deal.expectedLoss },
  { metric: 'Sector risk', value: 'Средний', metric2: 'Country risk', value2: 'Низкий' },
  { metric: 'FX risk', value: 'Низкий', metric2: 'Liquidity risk', value2: 'Средний' },
  { metric: 'Refinancing risk', value: 'Средний', metric2: 'Interest rate risk', value2: 'Средний' },
  { metric: 'ESG risk', value: 'Умеренный', metric2: 'Documentation risk', value2: 'Средний' },
];

const covenantRows: Row<GenericTableRow>[] = [
  { covenant: 'Debt / EBITDA', limit: '≤ 3.5x', forecast: '3.1x', status: 'OK' },
  { covenant: 'EBITDA / Interest', limit: '≥ 2.5x', forecast: '3.2x', status: 'OK' },
  { covenant: 'DSCR', limit: '≥ 1.25x', forecast: '1.35x', status: 'OK' },
  { covenant: 'Минимальный cash balance', limit: '≥ 1.5 млрд ₽', forecast: '2.1 млрд ₽', status: 'OK' },
  {
    covenant: 'Ограничение дивидендов',
    limit: 'при Debt / EBITDA > 3.0x',
    forecast: 'требуется включить',
    status: 'В работе',
  },
  {
    covenant: 'Запрет на дополнительный обеспеченный долг',
    limit: 'без согласия банка',
    forecast: 'включен',
    status: 'OK',
  },
  {
    covenant: 'Insurance covenant',
    limit: 'ежегодное подтверждение',
    forecast: 'требуется обновить',
    status: 'В работе',
  },
];

const covenantHeadroomRows: Row<GenericTableRow>[] = [
  { metric: 'Debt / EBITDA', limit: '3.5x', forecast: '3.1x', headroom: '0.4x' },
  { metric: 'EBITDA / Interest', limit: '2.5x', forecast: '3.2x', headroom: '0.7x' },
  { metric: 'DSCR', limit: '1.25x', forecast: '1.35x', headroom: '0.10x' },
  { metric: 'Cash balance', limit: '1.5 млрд ₽', forecast: '2.1 млрд ₽', headroom: '0.6 млрд ₽' },
];

const collateralRows: Row<GenericTableRow>[] = [
  { asset: 'Производственный комплекс, г. Череповец', value: '12.4 млрд ₽', product: 'Senior debt' },
  { asset: 'Складская инфраструктура', value: '5.8 млрд ₽', product: 'Senior debt' },
  { asset: 'Оборудование прокатного цеха', value: '6.7 млрд ₽', product: 'Senior debt / CAPEX' },
  { asset: 'Запасы сырья и готовой продукции', value: '4.2 млрд ₽', product: 'Кредитная линия' },
  { asset: 'Дебиторская задолженность', value: '3.5 млрд ₽', product: 'Кредитная линия' },
  { asset: 'Корпоративная гарантия СеверПром Group', value: '—', product: 'Мезонин' },
];

const approvalRows: Row<GenericTableRow>[] = [
  {
    role: 'Кредитный аналитик',
    name: 'Анна Смирнова',
    status: 'Согласовано',
    comment: 'Модель подготовлена, требуется обновление ставки',
  },
  {
    role: 'Риск-менеджер',
    name: 'Дмитрий Волков',
    status: 'Комментарии',
    comment: 'Добавить dividend stopper и стресс-расчет',
  },
  {
    role: 'Юридический департамент',
    name: 'Мария Орлова',
    status: 'В работе',
    comment: 'Intercreditor agreement в подготовке',
  },
  { role: 'Казначейство', name: 'Сергей Никитин', status: 'Согласовано', comment: 'Лимит фондирования подтвержден' },
  {
    role: 'DCM / рынки капитала',
    name: 'Павел Егоров',
    status: 'В работе',
    comment: 'Ожидается подтверждение рейтинга выпуска',
  },
  {
    role: 'Старший банкир',
    name: 'Иван Петров',
    status: 'Согласовано',
    comment: 'Клиент ожидает решение до конца июня',
  },
  { role: 'Комплаенс', name: 'Ольга Сергеева', status: 'Согласовано', comment: 'KYC актуален' },
];

const documentRows: Row<GenericTableRow>[] = [
  { document: 'Credit memo v3.2', status: 'Готово', updated: '12 июня 2026', owner: 'Анна Смирнова' },
  { document: 'Финансовая модель', status: 'Требуется обновление', updated: '11 июня 2026', owner: 'Анна Смирнова' },
  { document: 'Term sheet', status: 'Согласован с клиентом', updated: '10 июня 2026', owner: 'Иван Петров' },
  { document: 'Договор кредитной линии', status: 'В работе', updated: '12 июня 2026', owner: 'Мария Орлова' },
  { document: 'Решение о выпуске облигаций', status: 'В работе', updated: '9 июня 2026', owner: 'Павел Егоров' },
  { document: 'Проспект облигаций', status: 'В работе', updated: '9 июня 2026', owner: 'Павел Егоров' },
  { document: 'Intercreditor agreement', status: 'В работе', updated: '12 июня 2026', owner: 'Мария Орлова' },
  { document: 'Отчет об оценке залога', status: 'Получен', updated: '7 июня 2026', owner: 'Иван Петров' },
  { document: 'KYC refresh', status: 'Готово', updated: '28 апреля 2026', owner: 'Комплаенс' },
];

const questionRows: Row<GenericTableRow>[] = [
  {
    question: 'Обновить финансовую модель с новой ключевой ставкой',
    responsible: 'Анна Смирнова',
    deadline: '14 июня 2026',
    status: 'В работе',
    impact: 'Блокирует committee pack',
  },
  {
    question: 'Подтвердить рейтинг облигационного выпуска',
    responsible: 'Павел Егоров',
    deadline: '16 июня 2026',
    status: 'Ожидается',
    impact: 'Влияет на купон',
  },
  {
    question: 'Согласовать intercreditor agreement',
    responsible: 'Мария Орлова',
    deadline: '17 июня 2026',
    status: 'В работе',
    impact: 'Блокирует мезонин',
  },
  {
    question: 'Включить dividend stopper в документацию',
    responsible: 'Дмитрий Волков',
    deadline: '15 июня 2026',
    status: 'Комментарии риска',
    impact: 'Критично для риска',
  },
  {
    question: 'Обновить страховой полис по оборудованию',
    responsible: 'Иван Петров',
    deadline: '17 июня 2026',
    status: 'Ожидается от клиента',
    impact: 'Условие выдачи',
  },
  {
    question: 'Подтвердить лимит участия банка в облигациях',
    responsible: 'Казначейство',
    deadline: '16 июня 2026',
    status: 'В работе',
    impact: 'Влияет на RWA',
  },
];

const nextActionRows: Row<GenericTableRow>[] = [
  {
    action: 'Обновить финансовую модель с новой ключевой ставкой',
    owner: 'Анна Смирнова',
    deadline: '14 июня 2026',
    status: 'В работе',
  },
  {
    action: 'Подтвердить рейтинг облигационного выпуска',
    owner: 'Павел Егоров',
    deadline: '16 июня 2026',
    status: 'Ожидается',
  },
  {
    action: 'Согласовать intercreditor agreement',
    owner: 'Мария Орлова',
    deadline: '17 июня 2026',
    status: 'В работе',
  },
  {
    action: 'Включить dividend stopper в документацию',
    owner: 'Дмитрий Волков',
    deadline: '15 июня 2026',
    status: 'Комментарии риска',
  },
  {
    action: 'Подтвердить лимит участия банка в облигациях',
    owner: 'Казначейство',
    deadline: '16 июня 2026',
    status: 'В работе',
  },
];

const portfolioRows: Row<GenericTableRow>[] = [
  {
    metric: 'Экспозиция на группу',
    before: '8.6 млрд ₽',
    after: '25.4 млрд ₽',
    comment: 'Увеличение за счет новых продуктов',
  },
  { metric: 'Доля в отраслевом лимите', before: '12%', after: '21%', comment: 'В пределах лимита' },
  { metric: 'Доля в лимите на группу', before: '34%', after: '78%', comment: 'Близко к верхнему диапазону' },
  { metric: 'RWA impact', before: '6.1 млрд ₽', after: '17.3 млрд ₽', comment: 'Требуется подтверждение капитала' },
  { metric: 'Концентрация на металлургии', before: '9.4%', after: '11.8%', comment: 'Умеренный рост' },
];

const complianceRows: Row<GenericTableRow>[] = [
  { check: 'KYC refresh', status: 'Готово', date: '28 апреля 2026' },
  { check: 'Санкционный скрининг', status: 'Готово', date: '10 июня 2026' },
  { check: 'UBO check', status: 'Готово', date: '10 июня 2026' },
  { check: 'AML review', status: 'Готово', date: '11 июня 2026' },
  { check: 'PEP check', status: 'Без совпадений', date: '11 июня 2026' },
  { check: 'ESG questionnaire', status: 'Получен', date: '6 июня 2026' },
  { check: 'Adverse media', status: 'Нет критичных совпадений', date: '12 июня 2026' },
];

const esgRows: Row<GenericTableRow>[] = [
  { metric: 'ESG risk', value: 'Умеренный' },
  { metric: 'Экологический риск отрасли', value: 'Повышенный' },
  { metric: 'ESG questionnaire', value: 'Получен' },
  { metric: 'CAPEX на снижение выбросов', value: '2.4 млрд ₽' },
  { metric: 'Планируемое снижение энергоемкости', value: '8% к 2028' },
  { metric: 'Экологические штрафы за 24 месяца', value: 'Нет существенных' },
  { metric: 'Требуется ESG covenant', value: 'Да, reporting annually' },
];

const timeline = [
  {
    date: '04 мая 2026',
    event: 'Получен запрос клиента',
    responsible: 'Иван Петров',
    status: 'Завершено',
    tone: 'success' as Tone,
  },
  {
    date: '08 мая 2026',
    event: 'Проведен первичный анализ',
    responsible: 'Анна Смирнова',
    status: 'Завершено',
    tone: 'success' as Tone,
  },
  {
    date: '15 мая 2026',
    event: 'Согласована предварительная структура',
    responsible: 'Иван Петров',
    status: 'Завершено',
    tone: 'success' as Tone,
  },
  {
    date: '03 июня 2026',
    event: 'Подготовлена финансовая модель',
    responsible: 'Анна Смирнова',
    status: 'Завершено',
    tone: 'success' as Tone,
  },
  {
    date: '10 июня 2026',
    event: 'Получены комментарии риска',
    responsible: 'Дмитрий Волков',
    status: 'Завершено',
    tone: 'success' as Tone,
  },
  {
    date: '14 июня 2026',
    event: 'Плановое обновление модели',
    responsible: 'Анна Смирнова',
    status: 'В работе',
    tone: 'warning' as Tone,
  },
  {
    date: '18 июня 2026',
    event: 'Кредитный комитет',
    responsible: 'Комитет',
    status: 'Запланировано',
    tone: 'info' as Tone,
  },
  {
    date: '30 июля 2026',
    event: 'Первая выборка / размещение облигаций',
    responsible: 'Иван Петров / Павел Егоров',
    status: 'Ожидается',
    tone: 'neutral' as Tone,
  },
];

const comments = [
  {
    author: 'Анна Смирнова',
    date: '12 июня 2026, 18:40',
    text: 'Нужно обновить модель после корректировки ставки ЦБ и пересчитать DSCR.',
    role: 'Кредитный аналитик',
  },
  {
    author: 'Дмитрий Волков',
    date: '12 июня 2026, 16:15',
    text: 'По стресс-сценарию требуется добавить ограничение на дивиденды.',
    role: 'Риск-менеджер',
  },
  {
    author: 'Павел Егоров',
    date: '12 июня 2026, 14:30',
    text: 'Предварительный интерес инвесторов к облигациям подтвержден, ориентир купона приемлемый.',
    role: 'DCM',
  },
  {
    author: 'Мария Орлова',
    date: '11 июня 2026, 19:10',
    text: 'Нужно уточнить порядок субординации мезонина и intercreditor agreement.',
    role: 'Юрист',
  },
];

const alerts = [
  {
    title: 'Финансовая модель устарела после изменения ставки',
    owner: 'Анна Смирнова',
    deadline: '14 июня 2026',
    severity: 'warning' as const,
  },
  {
    title: 'Dividend stopper еще не включен в документацию',
    owner: 'Дмитрий Волков',
    deadline: '15 июня 2026',
    severity: 'error' as const,
  },
  {
    title: 'Intercreditor agreement не согласован',
    owner: 'Мария Орлова',
    deadline: '17 июня 2026',
    severity: 'warning' as const,
  },
  {
    title: 'Рейтинг облигационного выпуска ожидается',
    owner: 'Павел Егоров',
    deadline: '16 июня 2026',
    severity: 'info' as const,
  },
];

const riskFactors = [
  'зависимость от цен на металл',
  'высокий CAPEX в 2026–2027',
  'повышенная долговая нагрузка в первый год',
  'риск роста ключевой ставки',
  'субординация мезонина',
  'риск недоразмещения облигационного выпуска',
];

const mitigants = [
  'долгосрочные контракты с ключевыми покупателями',
  'диверсификация инструментов финансирования',
  'амортизационная структура облигаций',
  'залог активов, запасов и дебиторской задолженности',
  'корпоративная гарантия группы',
  'borrowing base и cash sweep',
];

const chartRadius = {
  bottomLeft: 4,
  bottomRight: 4,
  topLeft: 4,
  topRight: 4,
};

const repaymentChartData: ChartData<'bar' | 'line'> = {
  labels: ['2026 H2', '2027', '2028', '2029', '2030', '2031 H1'],
  datasets: [
    {
      label: 'Остаток долга',
      type: 'line',
      data: [24.4, 23.2, 19.6, 14.8, 8.6, 0],
      borderColor: theme.palette.Chart.CBlue,
      borderWidth: 2,
      pointRadius: 3,
    },
    {
      label: 'Основной долг',
      data: [0.4, 1.2, 3.6, 4.8, 6.2, 8.6],
      stack: 'payments',
      backgroundColor: theme.palette.Chart.CGreen,
      hoverBackgroundColor: theme.palette.Chart.CGreenDark,
      borderRadius: chartRadius,
      barThickness: 24,
    },
    {
      label: 'Проценты / купоны',
      data: [0.9, 2.8, 2.6, 2.2, 1.7, 0.8],
      stack: 'payments',
      backgroundColor: theme.palette.Chart.COrange,
      hoverBackgroundColor: theme.palette.Chart.COrangeDark,
      borderRadius: chartRadius,
      barThickness: 24,
    },
  ],
};

const allocationPieData = {
  labels: ['Мезонин', 'Облигации', 'Кредитная линия'],
  datasets: [
    {
      data: [24, 50, 26],
      backgroundColor: [theme.palette.Product.POrange, theme.palette.Product.PBlue, theme.palette.Product.PGreen],
    },
  ],
};

const pageSx: Sx = (muiTheme) => ({
  minHeight: '100vh',
  backgroundColor: muiTheme.palette.BG.BGPageLinearStart,
  px: { xs: 2, md: 3 },
  py: 3,
});

const topBarSx: Sx = {
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  mb: 2,
  rowGap: 2,
};

const mutedTextSx: Sx = (muiTheme) => ({
  color: muiTheme.palette.Text.TextSecondary,
});

const sectionStackSx: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const tableWrapSx: Sx = {
  overflowX: 'auto',
};

const cardBodySx: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const compactListSx: Sx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
};

const badgeColor: Record<Tone, BadgeColorThemeSx> = {
  success: (muiTheme) => ({
    backgroundColor: muiTheme.palette.Success.SuccessBG,
    borderColor: muiTheme.palette.Success.Success,
    textColor: muiTheme.palette.Success.SuccessDark,
  }),
  warning: (muiTheme) => ({
    backgroundColor: muiTheme.palette.Warning.WarningBG,
    borderColor: muiTheme.palette.Warning.Warning,
    textColor: muiTheme.palette.Warning.WarningDark,
  }),
  error: (muiTheme) => ({
    backgroundColor: muiTheme.palette.Error.ErrorBG,
    borderColor: muiTheme.palette.Error.Error,
    textColor: muiTheme.palette.Error.ErrorDark,
  }),
  info: (muiTheme) => ({
    backgroundColor: muiTheme.palette.Info.InfoBG,
    borderColor: muiTheme.palette.Info.Info,
    textColor: muiTheme.palette.Info.InfoDark,
  }),
  neutral: (muiTheme) => ({
    backgroundColor: muiTheme.palette.Disabled.DisabledBG,
    borderColor: muiTheme.palette.Border.BorderPrimary,
    textColor: muiTheme.palette.Text.TextSecondary,
  }),
};

const summaryColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'parameter', title: 'Параметр', width: 180, wordWrapEnabled: true },
  { name: 'value', title: 'Значение', width: 260, wordWrapEnabled: true },
  { name: 'parameter2', title: 'Параметр', width: 180, wordWrapEnabled: true },
  { name: 'value2', title: 'Значение', width: 260, wordWrapEnabled: true },
];

const productColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'product', title: 'Продукт', width: 220, wordWrapEnabled: true },
  { name: 'limit', title: 'Лимит / объем', align: 'right', width: 130 },
  { name: 'share', title: 'Доля', align: 'right', width: 90 },
  { name: 'tenor', title: 'Срок', width: 90 },
  { name: 'rate', title: 'Ставка / купон', width: 130 },
  { name: 'repayment', title: 'Погашение', width: 180, wordWrapEnabled: true },
  { name: 'purpose', title: 'Назначение', width: 260, wordWrapEnabled: true },
  { name: 'status', title: 'Статус', width: 190, wordWrapEnabled: true },
];

const pairColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'metric', title: 'Показатель', width: 220, wordWrapEnabled: true },
  { name: 'value', title: 'Значение', width: 170, wordWrapEnabled: true },
  { name: 'metric2', title: 'Показатель', width: 220, wordWrapEnabled: true },
  { name: 'value2', title: 'Значение', width: 170, wordWrapEnabled: true },
];

const repaymentColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'period', title: 'Период', width: 110 },
  { name: 'principal', title: 'Основной долг', align: 'right', width: 140 },
  { name: 'interest', title: 'Проценты / купоны', align: 'right', width: 160 },
  { name: 'payment', title: 'Общий платеж', align: 'right', width: 140 },
  { name: 'debt', title: 'Остаток долга', align: 'right', width: 140 },
  { name: 'dscr', title: 'DSCR', align: 'right', width: 90 },
  { name: 'comment', title: 'Комментарий', width: 300, wordWrapEnabled: true },
];

const repaymentByProductColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'period', title: 'Период', width: 110 },
  { name: 'mezzanine', title: 'Мезонин', align: 'right', width: 150 },
  { name: 'bond', title: 'Облигации', align: 'right', width: 150 },
  { name: 'rcf', title: 'Кредитная линия', align: 'right', width: 160 },
  { name: 'total', title: 'Итого основной долг', align: 'right', width: 180 },
];

const useOfFundsColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'direction', title: 'Направление', width: 320, wordWrapEnabled: true },
  { name: 'amount', title: 'Сумма', align: 'right', width: 130 },
  { name: 'share', title: 'Доля', align: 'right', width: 90 },
  { name: 'source', title: 'Источник финансирования', width: 220, wordWrapEnabled: true },
];

const financialColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'metric', title: 'Показатель', width: 180, wordWrapEnabled: true },
  { name: 'y2024', title: '2024', align: 'right', width: 130 },
  { name: 'y2025', title: '2025', align: 'right', width: 130 },
  { name: 'y2026', title: '2026П', align: 'right', width: 130 },
  { name: 'y2027', title: '2027П', align: 'right', width: 130 },
  { name: 'y2028', title: '2028П', align: 'right', width: 130 },
];

const debtStructureColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'category', title: 'Категория долга', width: 240, wordWrapEnabled: true },
  { name: 'before', title: 'До сделки', align: 'right', width: 150 },
  { name: 'after', title: 'После сделки', align: 'right', width: 150 },
  { name: 'change', title: 'Изменение', align: 'right', width: 130 },
];

const productEconomicsColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'product', title: 'Продукт', width: 180 },
  { name: 'interest', title: 'Interest income', align: 'right', width: 150 },
  { name: 'fee', title: 'Fee income', align: 'right', width: 130 },
  { name: 'raroc', title: 'RAROC', align: 'right', width: 100 },
  { name: 'comment', title: 'Комментарий', width: 260, wordWrapEnabled: true },
];

const scenarioColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'scenario', title: 'Сценарий', width: 140 },
  { name: 'ebitda', title: 'EBITDA 2027', align: 'right', width: 140 },
  { name: 'debtEbitda', title: 'Debt / EBITDA', align: 'right', width: 130 },
  { name: 'dscr', title: 'DSCR', align: 'right', width: 90 },
  { name: 'cash', title: 'Cash buffer', align: 'right', width: 130 },
  { name: 'status', title: 'Статус', width: 220, wordWrapEnabled: true },
];

const rateSensitivityColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'change', title: 'Изменение ключевой ставки', width: 190, wordWrapEnabled: true },
  { name: 'rate', title: 'Blended ставка', width: 190, wordWrapEnabled: true },
  { name: 'expense', title: 'Interest expense 2027', align: 'right', width: 170 },
  { name: 'dscr', title: 'DSCR 2027', align: 'right', width: 120 },
  { name: 'status', title: 'Статус', width: 160 },
];

const covenantColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'covenant', title: 'Ковенант', width: 260, wordWrapEnabled: true },
  { name: 'limit', title: 'Лимит', align: 'right', width: 170, wordWrapEnabled: true },
  { name: 'forecast', title: 'Прогноз', align: 'right', width: 160, wordWrapEnabled: true },
  { name: 'status', title: 'Статус', align: 'right', width: 110 },
];

const covenantHeadroomColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'metric', title: 'Метрика', width: 180 },
  { name: 'limit', title: 'Лимит', align: 'right', width: 130 },
  { name: 'forecast', title: 'Прогноз', align: 'right', width: 130 },
  { name: 'headroom', title: 'Headroom', align: 'right', width: 130 },
];

const collateralColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'asset', title: 'Объект обеспечения', width: 280, wordWrapEnabled: true },
  { name: 'value', title: 'Оценка', align: 'right', width: 130 },
  { name: 'product', title: 'Применяется к продукту', width: 190, wordWrapEnabled: true },
];

const approvalColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'role', title: 'Роль', width: 180, wordWrapEnabled: true },
  { name: 'name', title: 'Имя', width: 150 },
  { name: 'status', title: 'Статус', width: 130 },
  { name: 'comment', title: 'Комментарий', width: 300, wordWrapEnabled: true },
];

const documentColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'document', title: 'Документ', width: 260, wordWrapEnabled: true },
  { name: 'status', title: 'Статус', width: 170, wordWrapEnabled: true },
  { name: 'updated', title: 'Обновлен', width: 140 },
  { name: 'owner', title: 'Ответственный', width: 160 },
];

const questionColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'question', title: 'Вопрос', width: 310, wordWrapEnabled: true },
  { name: 'responsible', title: 'Ответственный', width: 150 },
  { name: 'deadline', title: 'Deadline', width: 140 },
  { name: 'status', title: 'Статус', width: 160, wordWrapEnabled: true },
  { name: 'impact', title: 'Влияние', width: 220, wordWrapEnabled: true },
];

const nextActionColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'action', title: 'Действие', width: 300, wordWrapEnabled: true },
  { name: 'owner', title: 'Ответственный', width: 150 },
  { name: 'deadline', title: 'Deadline', width: 140 },
  { name: 'status', title: 'Статус', width: 150 },
];

const portfolioColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'metric', title: 'Показатель', width: 220, wordWrapEnabled: true },
  { name: 'before', title: 'До сделки', align: 'right', width: 130 },
  { name: 'after', title: 'После сделки', align: 'right', width: 130 },
  { name: 'comment', title: 'Комментарий', width: 250, wordWrapEnabled: true },
];

const complianceColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'check', title: 'Проверка', width: 220 },
  { name: 'status', title: 'Статус', width: 180 },
  { name: 'date', title: 'Дата', width: 150 },
];

const esgColumns: ColumnsConfig<GenericTableRow> = [
  { name: 'metric', title: 'Показатель', width: 260, wordWrapEnabled: true },
  { name: 'value', title: 'Значение', width: 240, wordWrapEnabled: true },
];

const noop = () => undefined;

const getToneForStatus = (status: string): Tone => {
  const normalized = status.toLowerCase();

  if (
    normalized.includes('готов') ||
    normalized.includes('согласован') ||
    normalized.includes('ok') ||
    normalized.includes('получен')
  ) {
    return 'success';
  }

  if (normalized.includes('комментар') || normalized.includes('треб') || normalized.includes('блок')) {
    return 'error';
  }

  if (normalized.includes('работ') || normalized.includes('ожида')) {
    return 'warning';
  }

  return 'neutral';
};

const StatusBadge = ({ label, tone = getToneForStatus(label), dataTestId = 'StatusBadge' }: StatusBadgeProps) => (
  <DictionaryBadge
    code={label}
    name={label}
    component="Chip"
    dataTestId={dataTestId}
    hoverable={false}
    size="sm"
    type="read"
    variant="outlined"
    colorThemeSx={badgeColor[tone]}
  />
);

const DataTable = ({ dataTestId, columns, rows, minWidth = 720 }: DataTableProps) => (
  <SxBox sx={tableWrapSx}>
    <SxBox sx={{ minWidth }}>
      <Table<GenericTableRow, object>
        columns={columns}
        dataTestId={dataTestId}
        isBordered
        rows={rows}
        tableConfig={{ hasStickyHeader: false }}
      />
    </SxBox>
  </SxBox>
);

const MetricGrid = ({ items }: { items: MetricItem[] }) => (
  <Grid container spacing={1.5}>
    {items.map(({ label, value }) => (
      <Grid item xs={12} sm={6} md={4} key={`${label}-${value}`}>
        <SxBox sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Text type="BodyXSReg" sx={mutedTextSx}>
            {label}
          </Text>
          <Text type="BodySStrongSmb">{value}</Text>
        </SxBox>
      </Grid>
    ))}
  </Grid>
);

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <SxBox sx={{ mb: 2 }}>
    <Text type="H5StrongSmb">{title}</Text>
    {subtitle && (
      <Text type="BodySReg" sx={mutedTextSx}>
        {subtitle}
      </Text>
    )}
  </SxBox>
);

const InlineList = ({ items }: { items: string[] }) => (
  <SxBox component="ul" sx={{ ...compactListSx, m: 0, pl: 2.5 }}>
    {items.map((item) => (
      <SxBox component="li" key={item}>
        <Text type="BodySReg">{item}</Text>
      </SxBox>
    ))}
  </SxBox>
);

export function ComplianceDashboardNew() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['value']>('overview');
  const [expandedProduct, setExpandedProduct] = useState<ProductId>('mezzanine');
  const [periodView, setPeriodView] = useState(0);
  const [paymentView, setPaymentView] = useState(2);
  const [documentFilter, setDocumentFilter] = useState(0);
  const [approvalFilter, setApprovalFilter] = useState(0);
  const [commentDraft, setCommentDraft] = useState('');

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === expandedProduct) ?? products[0],
    [expandedProduct],
  );

  const approvalDoneCount = approvalRows.filter((row) => row.status === 'Согласовано').length;
  const criticalQuestionCount = questionRows.filter(
    (row) => `${row.impact}`.includes('Блокирует') || `${row.impact}`.includes('Критично'),
  ).length;

  return (
    <main data-sd-screen-root="true" aria-label="D-2487 СеверПром Металлургия structured credit deal">
      <Page sx={pageSx} dataTestId="StructuredCreditDealPage">
        <Grid container sx={topBarSx} spacing={2}>
          <Grid item xs={12} md={7}>
            <BreadCrumbs
              dataTestId="DealBreadcrumbs"
              navigationSchema={[
                { name: 'Deals', route: '/deals' },
                { name: 'Structured Finance', route: '/deals/structured-finance' },
                { name: deal.id, route: `/deals/${deal.id}` },
                { name: 'СеверПром Металлургия', route: '' },
              ]}
              onClickLink={noop}
            />
            <SxBox sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              <Text type="H3StrongSmb">{deal.title}</Text>
              <RiskMetricsBadge rating={deal.riskRating} problemZone="Watchlist" dataTestId="DealRiskRating" />
            </SxBox>
            <Text type="BodyMReg" sx={mutedTextSx}>
              {deal.subtitle}
            </Text>
            <SxBox sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
              <StatusBadge label={`${deal.priority} приоритет`} tone="warning" dataTestId="PriorityBadge" />
              <StatusBadge label={deal.status} tone="info" dataTestId="DealStatusBadge" />
              <StatusBadge label="Требуется обновление модели" tone="error" dataTestId="ModelStatusBadge" />
              <StatusBadge label={`Комитет ${deal.committeeDate}`} tone="neutral" dataTestId="CommitteeBadge" />
            </SxBox>
          </Grid>

          <Grid item xs={12} md={5}>
            <SxBox
              sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, flexWrap: 'wrap', gap: 1 }}
            >
              <ButtonGroup type="outlined" size="sm">
                <Button dataTestId="Export" startIcon="Download">
                  Экспорт
                </Button>
                <Button dataTestId="CreateMemo" startIcon="FileSigned">
                  Создать memo
                </Button>
                <Button dataTestId="OpenTermSheet" startIcon="FileSearch">
                  Term sheet
                </Button>
              </ButtonGroup>
              <Button dataTestId="RefreshModel" size="sm" startIcon="Refresh" type="accent">
                Обновить модель
              </Button>
              <Button dataTestId="SendCommittee" size="sm" startIcon="Send" type="accent">
                На комитет
              </Button>
            </SxBox>
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={9}>
            <SxBox sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Text type="BodyXSReg" sx={mutedTextSx}>
                Последнее обновление: {deal.lastUpdated}
              </Text>
              <Text type="BodyXSReg" sx={mutedTextSx}>
                Автор: {deal.updatedBy}
              </Text>
              <Text type="BodyXSReg" sx={mutedTextSx}>
                Версия данных: {deal.modelVersion}
              </Text>
              <Text type="BodyXSReg" color={theme.palette.Primary.PrimaryDark}>
                Готовность к комитету: {deal.readiness}%
              </Text>
            </SxBox>
          </Grid>
          <Grid item xs={12} md={3}>
            <ProgressBar dataTestId="Readiness" value={deal.readiness} label="Готовность к кредитному комитету" />
          </Grid>
        </Grid>

        <Alert dataTestId="ModelUpdateAlert" severity="warning" title="Есть блокеры комитета" isOpen expandable={false}>
          <Text type="BodySReg">
            Финансовая модель должна быть обновлена до 14 июня 2026. Dividend stopper и intercreditor agreement остаются
            ключевыми условиями до отправки материалов на комитет.
          </Text>
        </Alert>

        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12}>
            <Card
              dataTestId="DealSummaryCard"
              title="Summary сделки"
              subtitle="Ключевые параметры клиента, лимита, рейтинга и следующего шага"
              extra={<StatusBadge label="82% ready" tone="info" dataTestId="SummaryReadyBadge" />}
            >
              <SxBox sx={cardBodySx}>
                <DataTable dataTestId="SummaryTable" columns={summaryColumns} rows={summaryRows} minWidth={900} />
                <Text type="BodySReg" sx={mutedTextSx}>
                  Комплексное финансирование для модернизации производственных мощностей, рефинансирования части
                  текущего долга, пополнения оборотного капитала и финансирования инвестиционной программы клиента на
                  2026-2030 годы.
                </Text>
              </SxBox>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <TabsGroup
              dataTestId="DealTabs"
              value={activeTab}
              variant="scrollable"
              onChange={(_, value) => setActiveTab(value as (typeof tabs)[number]['value'])}
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  label={tab.label}
                  iconValue={'count' in tab ? tab.count : undefined}
                />
              ))}
            </TabsGroup>
          </Grid>

          {kpiCards.map((card) => (
            <Grid item xs={12} sm={6} md={3} key={card.text}>
              <DashboardCard dataTestId={`Kpi_${card.title}`} disabled={false} title={card.title} text={card.text} />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12} lg={8}>
            <SxBox sx={sectionStackSx}>
              <Card
                dataTestId="ClientSummary"
                title="Summary по клиенту"
                headerIcon={<Icon name="Building02" color="info" />}
              >
                <SxBox sx={cardBodySx}>
                  <MetricGrid
                    items={[
                      { label: 'Компания', value: deal.borrower },
                      { label: 'ИНН / ОГРН', value: '7700000000 / 1027700000001' },
                      { label: 'Головной офис', value: deal.headOffice },
                      { label: 'CEO / CFO', value: 'Алексей Ковалёв / Наталья Белова' },
                      { label: 'Сотрудники', value: '12 400' },
                      { label: 'Отношения с банком', value: '9 лет' },
                      { label: 'Текущая экспозиция банка', value: '8.6 млрд ₽' },
                      { label: 'Доля банка в долговом портфеле', value: '18%' },
                      { label: 'Просрочки за 36 месяцев', value: 'Нет' },
                      { label: 'Wallet share / Cross-sell', value: '22% / High' },
                      { label: 'Последний KYC review', value: 'Апрель 2026' },
                      { label: 'Основные продукты', value: 'РКО, ЗП, валютный контроль, trade finance' },
                    ]}
                  />
                  <Alert
                    dataTestId="ClientSummaryFinding"
                    severity="info"
                    title="Аналитический вывод"
                    isOpen
                    expandable={false}
                  >
                    <Text type="BodySReg">
                      Клиент стратегический для банка, кредитная история положительная, операционная устойчивость
                      высокая. Основной риск связан с ценами на металл и уровнем ключевой ставки.
                    </Text>
                  </Alert>
                </SxBox>
              </Card>

              <Card
                dataTestId="ProductStructure"
                title="Структура кредитных продуктов"
                subtitle="Три продукта разделены по лимиту, сроку, погашению и статусу согласования"
                headerIcon={<Icon name="Bank" color="info" />}
              >
                <SxBox sx={cardBodySx}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={8}>
                      <SxBox sx={compactListSx}>
                        {products.map((product) => (
                          <ProductRow
                            key={product.id}
                            dataTestId={`ProductRow_${product.id}`}
                            title={product.title}
                            subtitle={`${product.limit} · ${product.share} · ${product.rate} · ${product.repayment}`}
                            active={expandedProduct === product.id}
                            variant="bordered"
                            hasSpot={product.tone === 'warning'}
                            titlePrefix={<Icon name={product.icon} color="info" />}
                            titlePostfix={
                              <StatusBadge
                                label={product.status}
                                tone={product.tone}
                                dataTestId={`ProductStatus_${product.id}`}
                              />
                            }
                            actions={
                              <IconButton
                                dataTestId={`ExpandProduct_${product.id}`}
                                name={expandedProduct === product.id ? 'ChevronUp' : 'ChevronDown'}
                                size="sm"
                                title="Раскрыть детали продукта"
                              />
                            }
                            onClick={() => setExpandedProduct(product.id)}
                          />
                        ))}
                      </SxBox>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <SxBox sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Pie dataTestId="ProductAllocationPie" data={allocationPieData} width={190} height={190} />
                      </SxBox>
                      <SxBox sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
                        {products.map((product) => (
                          <StatusBadge
                            key={product.id}
                            label={`${product.title.split(' ')[0]} ${product.share}`}
                            tone={product.tone}
                          />
                        ))}
                      </SxBox>
                    </Grid>
                  </Grid>

                  <DataTable dataTestId="ProductTable" columns={productColumns} rows={productRows} minWidth={1300} />
                  <DataTable
                    dataTestId="AggregateStructureTable"
                    columns={pairColumns}
                    rows={aggregateRows}
                    minWidth={800}
                  />

                  <SxBox
                    sx={(muiTheme) => ({
                      border: `1px solid ${muiTheme.palette.Border.BorderLight}`,
                      borderRadius: 1,
                      p: 2,
                    })}
                  >
                    <SectionTitle title={selectedProduct.title} subtitle={selectedProduct.subtitle} />
                    <MetricGrid items={selectedProduct.details} />
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                      <Grid item xs={12} md={6}>
                        <Text type="BodySStrongSmb" gutterBottom>
                          Ключевые риски
                        </Text>
                        <InlineList items={selectedProduct.risks} />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Text type="BodySStrongSmb" gutterBottom>
                          Mitigants
                        </Text>
                        <InlineList items={selectedProduct.mitigants} />
                      </Grid>
                    </Grid>
                  </SxBox>
                </SxBox>
              </Card>

              <Card
                dataTestId="RepaymentSchedule"
                title="График погашения на 5 лет"
                subtitle="Stacked bar для платежей и line chart для остатка долга"
                headerIcon={<Icon name="BarLineChart" color="info" />}
              >
                <SxBox sx={cardBodySx}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                      <SegmentControl
                        dataTestId="RepaymentPeriodSwitch"
                        selectedIndex={periodView}
                        onIndexChange={setPeriodView}
                        size="sm"
                        segmentsText={['Годовой', 'Квартальный']}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <SegmentControl
                        dataTestId="PaymentTypeSwitch"
                        selectedIndex={paymentView}
                        onIndexChange={setPaymentView}
                        size="sm"
                        segmentsText={['Основной долг', 'Проценты', 'Общий платеж']}
                      />
                    </Grid>
                  </Grid>
                  <Grid container spacing={1}>
                    {[
                      ['Minimum DSCR', '1.35x'],
                      ['Average DSCR', '1.62x'],
                      ['Пик долговой нагрузки', '2027'],
                      ['Пиковый платеж', '2031 H1'],
                      ['Минимальный cash buffer', '2.1 млрд ₽'],
                      ['Полное погашение', '2031'],
                    ].map(([label, value]) => (
                      <Grid item xs={6} md={4} key={label}>
                        <DashboardCard
                          dataTestId={`RepaymentIndicator_${label}`}
                          disabled={false}
                          title={value}
                          text={label}
                        />
                      </Grid>
                    ))}
                  </Grid>
                  <Bar
                    dataTestId="RepaymentChart"
                    data={repaymentChartData}
                    width="100%"
                    height="280px"
                    params={{ showLegend: true, displayMax: 28, maintainAspectRatio: false, disabledZoom: true }}
                  />
                  <DataTable
                    dataTestId="RepaymentTable"
                    columns={repaymentColumns}
                    rows={repaymentRows}
                    minWidth={1200}
                  />
                  <DataTable
                    dataTestId="RepaymentByProductTable"
                    columns={repaymentByProductColumns}
                    rows={repaymentByProductRows}
                    minWidth={760}
                  />
                </SxBox>
              </Card>

              <Card
                dataTestId="UseOfFunds"
                title="Использование средств"
                headerIcon={<Icon name="PieChart" color="info" />}
              >
                <SxBox sx={cardBodySx}>
                  <DataTable
                    dataTestId="UseOfFundsTable"
                    columns={useOfFundsColumns}
                    rows={useOfFundsRows}
                    minWidth={760}
                  />
                  <Alert dataTestId="UseOfFundsFinding" severity="success" title="Вывод" isOpen expandable={false}>
                    <Text type="BodySReg">
                      CAPEX повышает производительность, рефинансирование удлиняет долг, кредитная линия закрывает
                      сезонный разрыв ликвидности и снижает риск кассового разрыва в 2026-2027.
                    </Text>
                  </Alert>
                </SxBox>
              </Card>

              <Card
                dataTestId="Financials"
                title="Финансовые показатели клиента"
                headerIcon={<Icon name="ArrowTrendUp" color="success" />}
              >
                <SxBox sx={cardBodySx}>
                  <DataTable
                    dataTestId="FinancialsTable"
                    columns={financialColumns}
                    rows={financialRows}
                    minWidth={850}
                  />
                  <Alert dataTestId="FinancialFinding" severity="info" title="Вывод" isOpen expandable={false}>
                    <Text type="BodySReg">
                      EBITDA растет за счет модернизации, Debt / EBITDA остается ниже лимита 3.5x, FCF временно
                      снижается из-за CAPEX и восстанавливается с 2027 года.
                    </Text>
                  </Alert>
                </SxBox>
              </Card>

              <Card dataTestId="DebtStructure" title="Долговая структура до и после сделки">
                <SxBox sx={cardBodySx}>
                  <DataTable
                    dataTestId="DebtStructureTable"
                    columns={debtStructureColumns}
                    rows={debtStructureRows}
                    minWidth={700}
                  />
                  <Text type="BodySReg" sx={mutedTextSx}>
                    Доля краткосрочного долга снижается, появляется рыночный инструмент финансирования, структура долга
                    становится длиннее при сохранении leverage в допустимых лимитах.
                  </Text>
                </SxBox>
              </Card>

              <Card
                dataTestId="Economics"
                title="Экономика сделки для банка"
                headerIcon={<Icon name="Bank" color="info" />}
              >
                <SxBox sx={cardBodySx}>
                  <DataTable dataTestId="EconomicsTable" columns={pairColumns} rows={economicsRows} minWidth={800} />
                  <DataTable
                    dataTestId="ProductEconomicsTable"
                    columns={productEconomicsColumns}
                    rows={productEconomicsRows}
                    minWidth={840}
                  />
                  <Alert dataTestId="EconomicsFinding" severity="success" title="Вывод" isOpen expandable={false}>
                    <Text type="BodySReg">
                      Сделка привлекательна за счет процентного дохода, комиссий, DCM-дохода и cross-sell. RAROC выше
                      hurdle rate, но требует контроля ковенантов и документирования mitigants.
                    </Text>
                  </Alert>
                </SxBox>
              </Card>

              <Card dataTestId="ScenarioAnalysis" title="Сценарный анализ и чувствительность к ставке">
                <SxBox sx={cardBodySx}>
                  <DataTable dataTestId="ScenarioTable" columns={scenarioColumns} rows={scenarioRows} minWidth={850} />
                  <DataTable
                    dataTestId="RateSensitivityTable"
                    columns={rateSensitivityColumns}
                    rows={rateSensitivityRows}
                    minWidth={840}
                  />
                  <Text type="BodySReg" sx={mutedTextSx}>
                    Основной риск - одновременное падение цен на металл и рост ключевой ставки. В стресс-сценарии
                    требуется waiver, ограничение дивидендов или частичное досрочное погашение.
                  </Text>
                </SxBox>
              </Card>

              <Card dataTestId="PortfolioContext" title="Портфельный контекст банка">
                <SxBox sx={cardBodySx}>
                  <DataTable
                    dataTestId="PortfolioTable"
                    columns={portfolioColumns}
                    rows={portfolioRows}
                    minWidth={760}
                  />
                  <Text type="BodySReg" sx={mutedTextSx}>
                    Сделка увеличивает концентрацию на группе и отрасли, но остается в рамках лимитов. Балансовая
                    нагрузка снижается через облигационный выпуск и распределение части риска на рынок капитала.
                  </Text>
                </SxBox>
              </Card>

              <Card dataTestId="CommitteeRecommendation" title="Рекомендация кредитного аналитика">
                <SxBox sx={cardBodySx}>
                  <Alert
                    dataTestId="CommitteeRecommendationAlert"
                    severity="success"
                    title="Одобрить сделку с условиями"
                    isOpen
                    expandable={false}
                  >
                    <Text type="BodySReg">
                      Рекомендуется вынести сделку на кредитный комитет с предложенной структурой финансирования на
                      сумму 24.8 млрд ₽. Комбинация мезонина, облигационного выпуска и возобновляемой кредитной линии
                      распределяет риски между продуктами и обеспечивает клиенту ликвидность для инвестиционной
                      программы.
                    </Text>
                  </Alert>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Text type="BodySStrongSmb" gutterBottom>
                        Аргументы за
                      </Text>
                      <InlineList
                        items={[
                          'стратегический клиент с положительной кредитной историей',
                          'достаточное покрытие обеспечением',
                          'Debt / EBITDA в пределах ковенанта',
                          'RAROC выше внутреннего hurdle rate',
                          'облигации снижают прямую балансовую нагрузку банка',
                        ]}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Text type="BodySStrongSmb" gutterBottom>
                        Условия одобрения
                      </Text>
                      <InlineList
                        items={[
                          'включить dividend stopper при Debt / EBITDA > 3.0x',
                          'закрепить минимальный cash balance 1.5 млрд ₽',
                          'подтвердить рейтинг облигационного выпуска',
                          'согласовать intercreditor agreement',
                          'обновить финансовую модель перед комитетом',
                        ]}
                      />
                    </Grid>
                  </Grid>
                </SxBox>
              </Card>
            </SxBox>
          </Grid>

          <Grid item xs={12} lg={4}>
            <SxBox sx={sectionStackSx}>
              <Card
                dataTestId="DealStatus"
                title="Статус сделки"
                subtitle="Pipeline подготовки к кредитному комитету"
                extra={<StatusBadge label={deal.status} tone="info" />}
              >
                <SxBox sx={cardBodySx}>
                  <ProgressBar dataTestId="StatusReadiness" value={deal.readiness} label="Готовность к комитету" />
                  <Stepper
                    dataTestId="DealPipelineStepper"
                    orientation="vertical"
                    readonly
                    steps={[
                      { key: 'analysis', title: 'Первичный анализ', completed: true, active: false },
                      { key: 'structuring', title: 'Структурирование', completed: true, active: false },
                      {
                        key: 'model',
                        title: 'Финансовая модель',
                        completed: false,
                        active: true,
                        helperText: 'В работе',
                      },
                      { key: 'risk', title: 'Риск-анализ', completed: false, active: false, helperText: 'В работе' },
                      {
                        key: 'committee',
                        title: 'Кредитный комитет',
                        completed: false,
                        active: false,
                        helperText: deal.committeeDate,
                      },
                      { key: 'signing', title: 'Подписание', completed: false, active: false },
                      { key: 'funding', title: 'Выдача / размещение', completed: false, active: false },
                    ]}
                  />
                  <MetricGrid
                    items={[
                      { label: 'Следующий шаг', value: deal.nextStep },
                      { label: 'Deadline', value: '14 июня 2026' },
                      { label: 'Ответственный', value: 'Анна Смирнова' },
                      { label: 'Блокер', value: 'Финальное согласование dividend stopper' },
                    ]}
                  />
                </SxBox>
              </Card>

              <Card dataTestId="NextActions" title="Следующие действия">
                <SxBox sx={cardBodySx}>
                  <Alert
                    dataTestId="CriticalDeadline"
                    severity="warning"
                    title="14 июня 2026"
                    isOpen
                    expandable={false}
                  >
                    <Text type="BodySReg">Обновить модель до отправки материалов на комитет.</Text>
                  </Alert>
                  <DataTable
                    dataTestId="NextActionsTable"
                    columns={nextActionColumns}
                    rows={nextActionRows}
                    minWidth={740}
                  />
                </SxBox>
              </Card>

              <Card
                dataTestId="RiskProfile"
                title="Риск-профиль"
                extra={<RiskMetricsBadge rating={deal.riskRating} problemZone="Watchlist" />}
              >
                <SxBox sx={cardBodySx}>
                  <DataTable dataTestId="RiskProfileTable" columns={pairColumns} rows={riskRows} minWidth={700} />
                  <Divider orientation="horizontal" flexItem={false} />
                  <Text type="BodySStrongSmb">Ключевые риск-факторы</Text>
                  <InlineList items={riskFactors} />
                  <Text type="BodySStrongSmb">Mitigants</Text>
                  <InlineList items={mitigants} />
                </SxBox>
              </Card>

              <Card dataTestId="Covenants" title="Ковенанты">
                <SxBox sx={cardBodySx}>
                  <DataTable dataTestId="CovenantsTable" columns={covenantColumns} rows={covenantRows} minWidth={760} />
                  <DataTable
                    dataTestId="CovenantHeadroomTable"
                    columns={covenantHeadroomColumns}
                    rows={covenantHeadroomRows}
                    minWidth={600}
                  />
                  <Text type="BodySReg" sx={mutedTextSx}>
                    Запас по DSCR ограничен. Нужно зафиксировать dividend stopper и минимальный cash balance до
                    комитета.
                  </Text>
                </SxBox>
              </Card>

              <Card dataTestId="Collateral" title="Обеспечение">
                <SxBox sx={cardBodySx}>
                  <DataTable
                    dataTestId="CollateralTable"
                    columns={collateralColumns}
                    rows={collateralRows}
                    minWidth={680}
                  />
                  <MetricGrid
                    items={[
                      { label: 'Общая оценочная стоимость', value: '32.6 млрд ₽' },
                      { label: 'Покрытие общего лимита', value: '131%' },
                      { label: 'Покрытие senior debt', value: '176%' },
                      { label: 'Последняя оценка', value: 'Май 2026' },
                    ]}
                  />
                </SxBox>
              </Card>

              <Card
                dataTestId="Approvals"
                title="Согласования"
                extra={<BadgeCounter counter={approvalDoneCount} size="sm" />}
              >
                <SxBox sx={cardBodySx}>
                  <SegmentControl
                    dataTestId="ApprovalFilter"
                    selectedIndex={approvalFilter}
                    onIndexChange={setApprovalFilter}
                    size="sm"
                    segmentsText={['Все', 'Риск', 'Юристы']}
                  />
                  <Text type="BodySReg" sx={mutedTextSx}>
                    {approvalDoneCount} из 7 согласований завершены, 2 в работе, 1 с комментариями.
                  </Text>
                  <DataTable dataTestId="ApprovalsTable" columns={approvalColumns} rows={approvalRows} minWidth={820} />
                </SxBox>
              </Card>

              <Card dataTestId="Documents" title="Документы">
                <SxBox sx={cardBodySx}>
                  <SegmentControl
                    dataTestId="DocumentFilter"
                    selectedIndex={documentFilter}
                    onIndexChange={setDocumentFilter}
                    size="sm"
                    segmentsText={['Все', 'Мезонин', 'Облигации']}
                  />
                  <DataTable dataTestId="DocumentsTable" columns={documentColumns} rows={documentRows} minWidth={780} />
                  <Link dataTestId="CreditMemoLink" href="#" severity="info" size="sm">
                    Скачать credit memo
                  </Link>
                </SxBox>
              </Card>

              <Card
                dataTestId="OpenQuestions"
                title="Открытые вопросы"
                extra={<BadgeCounter counter={criticalQuestionCount} size="sm" />}
              >
                <SxBox sx={cardBodySx}>
                  <Text type="BodySReg" color={theme.palette.Error.ErrorDark}>
                    Критичных: {criticalQuestionCount} · ближайший deadline: 14 июня 2026
                  </Text>
                  <DataTable
                    dataTestId="OpenQuestionsTable"
                    columns={questionColumns}
                    rows={questionRows}
                    minWidth={900}
                  />
                </SxBox>
              </Card>

              <Card dataTestId="ComplianceKyc" title="Комплаенс / KYC">
                <SxBox sx={cardBodySx}>
                  <DataTable
                    dataTestId="ComplianceTable"
                    columns={complianceColumns}
                    rows={complianceRows}
                    minWidth={560}
                  />
                  <Text type="BodySReg" sx={mutedTextSx}>
                    Сделка не заблокирована с точки зрения KYC / AML / санкционного риска.
                  </Text>
                </SxBox>
              </Card>

              <Card dataTestId="EsgFactors" title="ESG и экологические факторы">
                <SxBox sx={cardBodySx}>
                  <DataTable dataTestId="EsgTable" columns={esgColumns} rows={esgRows} minWidth={540} />
                  <Text type="BodySReg" sx={mutedTextSx}>
                    Отраслевой ESG-риск повышенный, но часть CAPEX направлена на снижение энергоемкости. Рекомендуется
                    ежегодная ESG-отчетность в пакете ковенантов.
                  </Text>
                </SxBox>
              </Card>

              <Card dataTestId="Alerts" title="Alerts / предупреждения">
                <SxBox sx={compactListSx}>
                  {alerts.map((alert) => (
                    <Alert
                      key={alert.title}
                      dataTestId={`Alert_${alert.title}`}
                      severity={alert.severity}
                      title={alert.title}
                      isOpen
                      expandable={false}
                    >
                      <Text type="BodyXSReg">
                        {alert.owner} · {alert.deadline}
                      </Text>
                    </Alert>
                  ))}
                </SxBox>
              </Card>
            </SxBox>
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12} lg={6}>
            <Card dataTestId="Timeline" title="Timeline сделки" headerIcon={<Icon name="Calendar" color="info" />}>
              <SxBox sx={compactListSx}>
                {timeline.map((item) => (
                  <SxBox
                    key={`${item.date}-${item.event}`}
                    sx={(muiTheme) => ({
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr auto',
                      gap: 1.5,
                      alignItems: 'center',
                      borderBottom: `1px solid ${muiTheme.palette.Border.BorderLight}`,
                      pb: 1,
                    })}
                  >
                    <Text type="BodyXSReg" sx={mutedTextSx}>
                      {item.date}
                    </Text>
                    <SxBox>
                      <Text type="BodySStrongSmb">{item.event}</Text>
                      <Text type="BodyXSReg" sx={mutedTextSx}>
                        {item.responsible}
                      </Text>
                    </SxBox>
                    <StatusBadge label={item.status} tone={item.tone} />
                  </SxBox>
                ))}
              </SxBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card dataTestId="TeamComments" title="Комментарии команды" headerIcon={<Icon name="Mail" color="info" />}>
              <SxBox sx={cardBodySx}>
                <Grid container spacing={1.5}>
                  {comments.map((comment) => (
                    <Grid item xs={12} key={`${comment.author}-${comment.date}`}>
                      <Entity
                        dataTestId={`Comment_${comment.author}`}
                        size="md"
                        avatar={{ variant: 'rounded', icon: <Icon name="UserCircle" color="info" /> }}
                        header={`${comment.role} · ${comment.date}`}
                        text={comment.author}
                        subHeader={{ items: [comment.text], max: 1 }}
                      />
                    </Grid>
                  ))}
                </Grid>
                <InputText
                  dataTestId="NewComment"
                  name="newComment"
                  label="Новый комментарий"
                  multiline
                  rows={3}
                  placeholder="Упомяните участника команды или свяжите комментарий с документом"
                  value={commentDraft}
                  onChange={(value) => setCommentDraft(value ?? '')}
                  viewType="edit"
                />
                <SxBox>
                  <Button dataTestId="AddComment" size="sm" startIcon="Send">
                    Добавить комментарий
                  </Button>
                </SxBox>
              </SxBox>
            </Card>
          </Grid>
        </Grid>
      </Page>
    </main>
  );
}

ComplianceDashboardNew.displayName = 'ComplianceDashboardNew';
