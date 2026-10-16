import type { BadgeTone, TagTone } from '../components/primitives';

export interface AssetRow {
  name: string;
  owner: string;
  industry: string;
  tagTone: TagTone;
  value: string;
  change: string;
  status: 'active' | 'paused' | 'archived';
  risk: 'Low' | 'Medium' | 'High';
}

export interface FundRow {
  name: string;
  manager: string;
  aum: string;
  irr: string;
  assets: number;
  priority: 'high' | 'mid' | 'low';
  status: 'active' | 'paused' | 'archived';
}

export interface NewsItem {
  source: string;
  title: string;
  when: string;
  tags?: string[];
  priority?: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  when: string;
  tone: 'danger' | 'warning' | 'success';
}

export interface DealItem {
  id: string;
  client: string;
  description: string;
  industry: string;
  amount: string;
}

export interface ChangeItem {
  field: string;
  oldValue: string;
  newValue: string;
  source: string;
  when: string;
  tone: BadgeTone;
}

export interface CommunicationItem {
  title: string;
  snippet: string;
  counterparty: string;
  when: string;
  tone: BadgeTone;
  status: string;
  people: string[];
}

export interface SearchResultItem {
  type: string;
  title: string;
  description: string;
  meta: string;
  tone: BadgeTone;
}

export const assetRows: AssetRow[] = [
  {
    name: 'Norilsk Nickel',
    owner: 'Interros',
    industry: 'Metals and ore',
    tagTone: 'metal',
    value: '842.6 bn RUB',
    change: '+8.4%',
    status: 'active',
    risk: 'Medium',
  },
  {
    name: 'Port Murmansk',
    owner: 'Northern Logistics Fund',
    industry: 'Capital markets',
    tagTone: 'capital',
    value: '118.4 bn RUB',
    change: '+12.1%',
    status: 'active',
    risk: 'High',
  },
  {
    name: 'Petrovax Pharm',
    owner: 'Pharma Opportunity',
    industry: 'Pharma',
    tagTone: 'pharma',
    value: '64.8 bn RUB',
    change: '+3.9%',
    status: 'active',
    risk: 'Low',
  },
  {
    name: 'Rosa Khutor',
    owner: 'Hospitality Assets',
    industry: 'Hotels and leisure',
    tagTone: 'hotel',
    value: '52.0 bn RUB',
    change: '+2.7%',
    status: 'active',
    risk: 'Low',
  },
  {
    name: 'Rosbank',
    owner: 'Consumer Credit Fund',
    industry: 'Banks',
    tagTone: 'bank',
    value: '231.8 bn RUB',
    change: '-1.1%',
    status: 'paused',
    risk: 'Medium',
  },
  {
    name: 'Tochka Bank',
    owner: 'Digital Holdings',
    industry: 'Banks',
    tagTone: 'bank',
    value: '86.2 bn RUB',
    change: '+7.5%',
    status: 'active',
    risk: 'Medium',
  },
  {
    name: 'Yandex',
    owner: 'Digital Holdings',
    industry: 'IT services',
    tagTone: 'it',
    value: '950.0 bn RUB',
    change: '+14.8%',
    status: 'active',
    risk: 'Medium',
  },
  {
    name: 'Three Volcanoes Park',
    owner: 'Hospitality Assets',
    industry: 'Hotels and leisure',
    tagTone: 'hotel',
    value: '37.4 bn RUB',
    change: '+4.4%',
    status: 'active',
    risk: 'Low',
  },
];

export const fundRows: FundRow[] = [
  {
    name: 'Interros Capital',
    manager: 'Vladimir Potanin',
    aum: '967.7 bn RUB',
    irr: '17.6%',
    assets: 13,
    priority: 'high',
    status: 'active',
  },
  {
    name: 'Sigma Growth',
    manager: 'Dmitry Pavlov',
    aum: '420.4 bn RUB',
    irr: '21.2%',
    assets: 9,
    priority: 'mid',
    status: 'active',
  },
  {
    name: 'Northern Logistics Fund',
    manager: 'Maria Petrova',
    aum: '188.0 bn RUB',
    irr: '18.5%',
    assets: 7,
    priority: 'high',
    status: 'active',
  },
  {
    name: 'Pharma Opportunity',
    manager: 'Alexey Volkov',
    aum: '116.2 bn RUB',
    irr: '13.4%',
    assets: 5,
    priority: 'low',
    status: 'active',
  },
  {
    name: 'Digital Holdings',
    manager: 'Anna Kim',
    aum: '690.9 bn RUB',
    irr: '19.1%',
    assets: 11,
    priority: 'mid',
    status: 'active',
  },
  {
    name: 'Metals Recovery',
    manager: 'Petr Semenov',
    aum: '512.5 bn RUB',
    irr: '11.8%',
    assets: 8,
    priority: 'high',
    status: 'paused',
  },
];

export const taskItems: TaskItem[] = [
  {
    id: 'Task 1789',
    title: 'Adjust deal amount for ABS infrastructure note',
    when: '2 hours ago',
    tone: 'danger',
  },
  {
    id: 'Task 1289',
    title: 'Add client ownership data to Port Murmansk file',
    when: '3 hours ago',
    tone: 'warning',
  },
  {
    id: 'Task 1264',
    title: 'Audit data for the new logistics partner',
    when: 'yesterday',
    tone: 'success',
  },
  {
    id: 'Task 1187',
    title: 'Prepare committee memo for Arctic route thesis',
    when: '2 days ago',
    tone: 'success',
  },
];

export const newsItems: NewsItem[] = [
  {
    source: 'Norilsk Nickel',
    title: 'Strategic asset merger announced with revised capex guidance',
    when: '2 hours ago',
    tags: ['Strategic', 'Stakeholder'],
    priority: true,
  },
  {
    source: 'Central Bank',
    title: 'Key rate reduced by 50 bps, easing pressure on debt service',
    when: '4 hours ago',
    tags: ['Macro'],
  },
  {
    source: 'RBC Investments',
    title: 'Fintech regulatory updates may influence upcoming IPO plans',
    when: 'Mar 31, 2026',
    tags: ['Regulatory'],
    priority: true,
  },
  {
    source: 'Bloomberg Finance',
    title: 'Southeast Asia expansion shows accelerated quarterly efficiency',
    when: 'Apr 6, 2026',
    tags: ['Growth'],
  },
];

export const dealItems: DealItem[] = [
  {
    id: 'D-1042',
    client: 'Port Murmansk',
    description: 'Minority stake acquisition with contracted terminal revenue',
    industry: 'Logistics',
    amount: '18.4 bn RUB',
  },
  {
    id: 'D-0981',
    client: 'Petrovax Pharm',
    description: 'Follow-on investment before phase III approval',
    industry: 'Pharma',
    amount: '6.2 bn RUB',
  },
  {
    id: 'D-0876',
    client: 'Tochka Bank',
    description: 'Structured note for digital bank growth portfolio',
    industry: 'Banks',
    amount: '12.8 bn RUB',
  },
];

export const changeItems: ChangeItem[] = [
  {
    field: 'Beneficiary',
    oldValue: 'Old beneficiary group',
    newValue: 'Interros holding perimeter',
    source: 'AI source match',
    when: '2 hours ago',
    tone: 'warning',
  },
  {
    field: 'Investment team',
    oldValue: 'No legal reviewer assigned',
    newValue: 'Maria Petrova added as legal reviewer',
    source: 'Team directory',
    when: '5 hours ago',
    tone: 'info',
  },
  {
    field: 'Asset valuation',
    oldValue: '812.4 bn RUB',
    newValue: '842.6 bn RUB',
    source: 'Quarterly report',
    when: 'yesterday',
    tone: 'success',
  },
];

export const communicationItems: CommunicationItem[] = [
  {
    title: 'Q1 report discussion with Vladimir Potanin',
    snippet:
      'Reviewed Norilsk Nickel results, discussed 2026 investment plan, and agreed on Port Murmansk follow-up.',
    counterparty: 'Interros',
    when: 'yesterday, 16:42',
    tone: 'success',
    status: 'Done',
    people: ['VP', 'PS'],
  },
  {
    title: 'Sigma Growth onboarding documentation',
    snippet: 'Sent deal template, compliance procedure, and contact map for the team.',
    counterparty: 'Sigma Growth',
    when: 'Mar 31, 2026',
    tone: 'info',
    status: 'Sent',
    people: ['DP'],
  },
  {
    title: 'Due diligence request for Port Murmansk',
    snippet: 'Legal team response expected by Apr 30. Key docs include charter and reports.',
    counterparty: 'Port Murmansk',
    when: 'Mar 20, 2026',
    tone: 'warning',
    status: 'Waiting',
    people: ['MP'],
  },
  {
    title: 'AI committee brief for May 2',
    snippet: 'Assistant prepared a summary of three open ideas with confidence above 80%.',
    counterparty: 'Internal',
    when: 'Mar 19, 2026',
    tone: 'violet',
    status: 'Draft',
    people: ['AI'],
  },
];

export const searchResults: SearchResultItem[] = [
  {
    type: 'Asset',
    title: 'Port Murmansk',
    description: 'Logistics asset with active acquisition idea and open due diligence request.',
    meta: 'Capital markets - 18.4 bn RUB',
    tone: 'success',
  },
  {
    type: 'Idea',
    title: 'Northern route expansion',
    description: 'AI-generated thesis for terminal operators and cold-chain infrastructure.',
    meta: '91% confidence - committee draft',
    tone: 'violet',
  },
  {
    type: 'Fund',
    title: 'Northern Logistics Fund',
    description: 'Growth-stage infrastructure fund focused on ports and industrial assets.',
    meta: '7 assets - 188.0 bn RUB',
    tone: 'info',
  },
  {
    type: 'Communication',
    title: 'Due diligence request for Port Murmansk',
    description: 'Open request with legal follow-up and source document list.',
    meta: 'Waiting - Mar 20, 2026',
    tone: 'warning',
  },
];
