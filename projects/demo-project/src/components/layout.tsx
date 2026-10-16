import { Fragment, type ReactNode } from "react";

import { Avatar, Button } from "./primitives";

export interface AppShellProps {
  section?: string;
  screenId?: string;
  children: ReactNode;
}

const navGroups = [
  {
    title: "Workspace",
    items: ["Overview", "Feed", "Dashboards"],
  },
  {
    title: "Portfolio",
    items: ["Funds", "Assets", "Deals"],
  },
  {
    title: "Research",
    items: ["AI Ideas", "Analytics", "Changes"],
  },
  {
    title: "Tools",
    items: ["Communications", "Search"],
  },
];

export function AppShell({
  section = "Overview",
  screenId,
  children,
}: AppShellProps) {
  return (
    <div className="demo-shell" data-sd-screen-id={screenId}>
      <aside className="demo-side">
        <div className="side-brand">
          <div className="brand-mark">EQ</div>
          <div>
            <div className="brand-name">Equitas</div>
            <div className="brand-sub">Investment CRM</div>
          </div>
        </div>
        {navGroups.map((group) => (
          <div className="nav-group" key={group.title}>
            <div className="nav-group-title">{group.title}</div>
            {group.items.map((item) => {
              const flowId = navFlowId(item);
              return (
                <a
                  aria-label={`${group.title}: ${item}`}
                  className={`nav-item ${item === section ? "active" : ""}`}
                  data-sd-flow-id={flowId}
                  data-sd-label={item}
                  data-sd-nav-group={group.title}
                  data-testid={flowId}
                  href="#"
                  key={item}
                >
                  <span className="dot" />
                  {item}
                </a>
              );
            })}
          </div>
        ))}
        <div className="side-foot">
          <div className="demo-story-row">
            <Avatar size="sm" tone="violet">
              AK
            </Avatar>
            <div>
              <div className="brand-name">Anna Kim</div>
              <div className="brand-sub">Lead analyst</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="demo-main">{children}</main>
    </div>
  );
}

function navFlowId(label: string): string {
  return `nav-${label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="demo-top">
      <div>
        <h1 className="demo-page-title">{title}</h1>
        {subtitle ? <p className="demo-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="demo-story-row">{actions}</div> : null}
    </div>
  );
}

export function Breadcrumbs({
  items,
  className = "",
}: {
  items: string[];
  className?: string;
}) {
  return (
    <nav className={["crumbs", className].filter(Boolean).join(" ")}>
      {items.map((item, index) => (
        <Fragment key={`${item}-${index}`}>
          {index > 0 ? <span className="sep">/</span> : null}
          {index === items.length - 1 ? (
            <span className="current">{item}</span>
          ) : (
            <a href="#">{item}</a>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

export function Tabs({
  items,
  active,
  className = "",
}: {
  items: { label: string; count?: number }[];
  active: string;
  className?: string;
}) {
  return (
    <div className={["tabs", className].filter(Boolean).join(" ")}>
      {items.map((item) => (
        <a
          className={`tab ${item.label === active ? "is-active" : ""}`}
          href="#"
          key={item.label}
        >
          {item.label}
          {item.count !== undefined ? (
            <span className="count">{item.count}</span>
          ) : null}
        </a>
      ))}
    </div>
  );
}

export function TopToolbar() {
  return (
    <div className="demo-story-row">
      <Button variant="secondary" size="sm">
        Export
      </Button>
      <Button size="sm">Add idea</Button>
    </div>
  );
}
