import { Breadcrumbs } from './layout';
import { Avatar, Button, CommandSearch } from './primitives';

const railItems = [
  { label: 'Home', icon: HomeIcon },
  { label: 'Apps', icon: GridIcon },
  { label: 'Portfolio', icon: LayersIcon, active: true },
  { label: 'Charts', icon: ChartIcon },
  { label: 'Filter settings', icon: SlidersIcon },
];

const sidebarGroups = [
  {
    title: 'Portfolio',
    items: ['Overview', 'Funds', 'Assets', 'Deals'],
  },
  {
    title: 'Research',
    items: ['News', 'AI Ideas', 'Analytics'],
  },
];

export function BaseScreenTemplate() {
  return (
    <div className="base-screen-template" data-template="base-screen">
      <aside className="base-screen-rail" aria-label="Main menu">
        <div className="base-screen-brand">E</div>
        <nav className="base-screen-rail-nav" aria-label="Primary navigation">
          {railItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                aria-label={item.label}
                className={item.active ? 'is-active' : ''}
                iconOnly
                key={item.label}
                size="sm"
                variant="ghost"
              >
                <Icon />
              </Button>
            );
          })}
        </nav>
        <Avatar size="sm" tone="emerald">
          PS
        </Avatar>
      </aside>

      <aside className="base-screen-sidebar" aria-label="Menu sections">
        {sidebarGroups.map((group) => (
          <section className="base-screen-nav-group" key={group.title}>
            <div className="nav-group-title">{group.title}</div>
            {group.items.map((item) => (
              <a
                className={`nav-item ${item === 'Overview' ? 'active' : ''}`}
                data-sd-flow-id={navFlowId(item)}
                data-sd-label={item}
                data-sd-nav-group={group.title}
                href="#"
                key={item}
              >
                <span className="dot" />
                {item}
              </a>
            ))}
          </section>
        ))}
      </aside>

      <main className="base-screen-main">
        <header className="base-screen-toolbar">
          <Breadcrumbs items={['Home', 'Funds', 'Interros']} />
          <div className="base-screen-actions">
            <CommandSearch placeholder="Search..." shortcut={null} />
            <Button aria-label="Notifications" iconOnly size="md" variant="secondary">
              <BellIcon />
            </Button>
            <Avatar size="sm" tone="violet">
              AK
            </Avatar>
          </div>
        </header>

        <section className="base-screen-content" aria-label="Content area">
          <div className="base-screen-work-area">
            <span>work area</span>
          </div>
        </section>
      </main>
    </div>
  );
}

function navFlowId(label: string): string {
  return `nav-${label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 9.5 12 3l9 6.5V21h-6v-7H9v7H3z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="m12 3 9 4.5-9 4.5-9-4.5zm-9 9 9 4.5 9-4.5M3 16.5 12 21l9-4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4v16h16M7 15l3-3 4 4 5-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h7m4 0h5M4 17h5m4 0h7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="13" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="11" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M13.7 21a2 2 0 0 1-3.4 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
