import {
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  DocIcon,
  PercentIcon,
  ShieldIcon,
} from '../components/icons';
import { GlobeIcon, TrendIcon, UserIcon } from '../components/meta-list';
import { Badge } from '../components/primitives';

export const borrowerItems = [
  { icon: <BuildingIcon />, label: 'Компания', value: 'АО «СеверПром Металлургия»' },
  { icon: <GlobeIcon />, label: 'Отрасль', value: 'Металлургия / пром. производство' },
  { icon: <UserIcon />, label: 'CEO', value: 'Алексей Ковалёв' },
];

export const creditTermItems = [
  { icon: <TrendIcon />, label: 'Сумма', value: '18 500 000 000 ₽', mono: true },
  { icon: <CalendarIcon />, label: 'Срок', value: '5 лет' },
  { icon: <PercentIcon />, label: 'Ставка', value: 'КС + 2.15%' },
];

export const contactItems = [
  { icon: <UserIcon />, label: 'Банкир', value: 'Иван Петров' },
  { icon: <UserIcon />, label: 'Аналитик', value: 'Анна Смирнова' },
  { icon: <DocIcon />, label: 'Пакет', value: 'Комитет 18 июня' },
];

export const collateralItems = [
  { id: 'plant', icon: <ShieldIcon />, title: 'Производственный комплекс', description: '12.4 млрд ₽' },
  { id: 'warehouse', icon: <ShieldIcon />, title: 'Складская инфраструктура', description: '5.8 млрд ₽' },
  { id: 'equipment', icon: <ShieldIcon />, title: 'Оборудование', description: '6.2 млрд ₽' },
];

export const covenantItems = [
  { id: 'debt', icon: <CheckIcon />, title: 'Долг / EBITDA', description: '≤ 3.5x', value: 'OK' },
  { id: 'ifrs', icon: <DocIcon />, title: 'Отчётность МСФО', description: 'Ежеквартально', value: 'Pending' },
];

export const timelineItems = [
  { title: 'Заявка подана', text: 'Клиент подал заявку на кредит.', when: '12 января 2026' },
  {
    title: 'Due diligence',
    text: 'Юридическая и финансовая проверка завершена.',
    when: '22 апреля 2026',
    tone: 'warning' as const,
  },
  {
    title: 'Комитет',
    text: 'Пакет документов направлен членам комитета.',
    when: '15 мая 2026',
    tone: 'violet' as const,
  },
];

export const feedEvents = [
  {
    type: 'News',
    title: 'Capex guidance updated',
    text: 'Source signal attached to two active asset rows.',
    when: '2 hours ago',
    tone: 'info' as const,
  },
  {
    type: 'Task',
    title: 'Legal review requested',
    text: 'Minority protections need a committee-ready paragraph.',
    when: '3 hours ago',
    tone: 'warning' as const,
  },
];

export const participantSections = [
  {
    label: 'Participants',
    items: [
      <Badge tone="violet" key="vp">VP</Badge>,
      <Badge tone="success" key="ak">AK</Badge>,
    ],
  },
  {
    label: 'Key topics',
    items: [
      <Badge tone="neutral" key="nn">Norilsk Nickel</Badge>,
      <Badge tone="neutral" key="pm">Port Murmansk</Badge>,
    ],
  },
];
