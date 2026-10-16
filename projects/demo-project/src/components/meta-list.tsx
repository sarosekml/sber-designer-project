import type { ReactNode } from 'react';

export interface MetaListItem {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
}

export function MetaList({
  items,
  columns = 2,
  className = '',
}: {
  items: MetaListItem[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl className={['meta-list', `meta-list-${columns}`, className].filter(Boolean).join(' ')}>
      {items.map((item, index) => (
        <MetaItem
          icon={item.icon}
          key={`${String(item.label)}-${index}`}
          label={item.label}
          mono={item.mono ?? false}
          value={item.value}
        />
      ))}
    </dl>
  );
}

export function MetaItem({
  icon,
  label,
  value,
  mono = false,
  className = '',
}: MetaListItem & { className?: string }) {
  return (
    <div className={['meta-item', className].filter(Boolean).join(' ')}>
      <div aria-hidden="true" className="meta-item-icon">
        {icon}
      </div>
      <div className="meta-item-body">
        <dt className="meta-item-label">{label}</dt>
        <dd className={['meta-item-value', mono ? 'tnum' : ''].filter(Boolean).join(' ')}>
          {value}
        </dd>
      </div>
    </div>
  );
}

export const fundMetaItems: MetaListItem[] = [
  {
    icon: <GlobeIcon />,
    label: 'Geography',
    value: 'Russian Federation',
  },
  {
    icon: <TrendIcon />,
    label: 'Investment volume',
    value: '987.65 bn RUB',
    mono: true,
  },
  {
    icon: <MessageIcon />,
    label: 'E-mail',
    value: 'invest-ideas@interos.ru',
  },
  {
    icon: <UserIcon />,
    label: 'Beneficiary',
    value: 'Vladimir Potanin',
  },
];

export function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function TrendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 17 9 11l4 4 8-8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M14 7h7v7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function MessageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4h16v12H5.2L4 17.2z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
