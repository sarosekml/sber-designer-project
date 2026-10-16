import React from 'react';
import { Box } from '@mui/material';

import { Page, Link, Title } from '../../components/atoms';
import { DashboardGroupHeader } from '../../components/atoms/Header';
import { BreadCrumbs } from '../../components/molecules';
import { Tile } from '../../components/molecules/Tiles/Tile';
import { Navigation } from '../../components/organisms';
import type { NavigationItemsType } from '../../components/organisms';

/* ------------------------------------------------------------------ */
/*  Navigation items stub — replace with real routes when available    */
/* ------------------------------------------------------------------ */

const LocalLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <Link href={href} underline="none">{children}</Link>
);

const navItems: NavigationItemsType[] = [
  {
    compartment: '',
    items: [],
  },
];

/* ------------------------------------------------------------------ */
/*  Breadcrumb schema                                                    */
/* ------------------------------------------------------------------ */

const breadcrumbSchema = [
  { name: 'Главная', route: '/' },
  { name: 'Администрирование', route: '' },
];

/* ------------------------------------------------------------------ */
/*  Section link data                                                    */
/* ------------------------------------------------------------------ */

interface SectionLink {
  label: string;
  href: string;
}

interface SectionCardData {
  title: string;
  subtitle: string;
  links: SectionLink[];
}

interface SectionGroup {
  groupTitle: string;
  sections: SectionCardData[];
}

const adminSections: SectionGroup[] = [
  {
    groupTitle: 'Бизнес-справочники',
    sections: [
      {
        title: 'Справочники',
        subtitle: 'Бизнес-справочники, используемые в сделках',
        links: [{ label: 'Риск-сегмент', href: '/admin/risk-segment' }],
      },
      {
        title: 'Сотрудники',
        subtitle: '',
        links: [
          { label: 'Департаменты', href: '/admin/departments' },
          { label: 'Макроотрасли', href: '/admin/macro-industries' },
          { label: 'Дески', href: '/admin/desks' },
        ],
      },
      {
        title: 'Задачи',
        subtitle: '',
        links: [
          { label: 'Объекты задач', href: '/admin/task-objects' },
          { label: 'Типы задач', href: '/admin/task-types' },
          { label: 'Группы типов задач', href: '/admin/task-type-groups' },
          { label: 'Статусы задач', href: '/admin/task-statuses' },
          { label: 'Категории задач', href: '/admin/task-categories' },
        ],
      },
      {
        title: 'География',
        subtitle: '',
        links: [
          { label: 'Города', href: '/admin/cities' },
          { label: 'Регионы', href: '/admin/regions' },
        ],
      },
      {
        title: 'Документы',
        subtitle: '',
        links: [{ label: 'Типы документов', href: '/admin/document-types' }],
      },
    ],
  },
  {
    groupTitle: 'Бизнес-данные',
    sections: [
      {
        title: 'Сотрудники',
        subtitle: 'Список и детальная информация о сотрудниках',
        links: [
          { label: 'Сотрудники', href: '/admin/employees' },
          { label: 'Дески', href: '/admin/desks' },
          { label: 'Департаменты', href: '/admin/departments' },
        ],
      },
      {
        title: 'Клиенты',
        subtitle: 'Список контрагентов из всех сделок',
        links: [
          { label: 'Клиенты', href: '/admin/clients' },
          { label: 'Связанные физические лица', href: '/admin/related-individuals' },
        ],
      },
      {
        title: 'Финансы',
        subtitle: 'Финансовые данные по сделкам',
        links: [{ label: 'Средняя ЕТС', href: '/admin/avg-etc' }],
      },
    ],
  },
  {
    groupTitle: 'Настройки процессов',
    sections: [
      {
        title: 'Системные настройки',
        subtitle: 'Настройки и администрирование системы',
        links: [
          { label: 'Группы настроек', href: '/admin/settings-groups' },
          { label: 'Микросервисы', href: '/admin/microservices' },
          { label: 'Настройки', href: '/admin/settings' },
        ],
      },
      {
        title: 'Уведомления',
        subtitle: 'Настройки и администрирование уведомлений',
        links: [
          { label: 'Журнал уведомлений', href: '/admin/notification-log' },
          { label: 'Шаблоны уведомлений', href: '/admin/notification-templates' },
        ],
      },
      {
        title: 'Документы',
        subtitle: 'Список контрагентов из всех сделок',
        links: [
          { label: 'Папки документов', href: '/admin/document-folders' },
          { label: 'Сценарии', href: '/admin/scenarios' },
        ],
      },
      {
        title: 'Доступность сервисов',
        subtitle: 'Проверка доступности сервисов',
        links: [{ label: 'Доступно сервисов 29/29', href: '/admin/service-availability' }],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Reusable SectionCard (Tile m)                                        */
/* ------------------------------------------------------------------ */

const SectionCard: React.FC<SectionCardData> = ({ title, subtitle, links }) => (
  <Tile
    title={title}
    subtitle={subtitle || undefined}
    size="md"
    dataTestId={`admin-section-${title}`}
  >
    <Box>
      {links.map((link) => (
        <Box key={link.label} sx={{ py: 0.5 }}>
          <Link href={link.href} underline="none">
            {link.label}
          </Link>
        </Box>
      ))}
    </Box>
  </Tile>
);

/* ------------------------------------------------------------------ */
/*  Page root                                                            */
/* ------------------------------------------------------------------ */

export function RiskMetrics() {
  const handleBreadcrumbClick = (route: string) => {
    // stub — replace with real routing
  };

  return (
    <Box
      data-sd-screen-root="true"
      aria-label="Администрирование"
      sx={(theme) => ({ display: 'flex', minHeight: '100vh', backgroundColor: theme.palette.BG.BGPageLinearEnd })}
    >
      {/* Left navigation rail */}
      <Navigation
        items={navItems}
        localLinkComponent={LocalLink}
        dataTestId="admin-navigation"
      />

      {/* Main content */}
      <Page type="all" dataTestId="admin-page">
        {/* Breadcrumbs */}
        <Box sx={{ mb: 2 }}>
          <BreadCrumbs
            navigationSchema={breadcrumbSchema}
            onClickLink={handleBreadcrumbClick}
            dataTestId="admin-breadcrumbs"
          />
        </Box>

        {/* Page title */}
        <Title type="title" gutterBottom>{'Администрирование'}</Title>

        {/* Sections loop */}
        {adminSections.map((group, gi) => (
          <Box key={group.groupTitle}>
            <Box sx={{ mt: gi === 0 ? 1 : 5, mb: 3 }}>
              <DashboardGroupHeader dataTestId={`group-${gi}`}>
                {group.groupTitle}
              </DashboardGroupHeader>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 3,
              }}
            >
              {group.sections.map((section) => (
                <SectionCard key={section.title} {...section} />
              ))}
            </Box>
          </Box>
        ))}
      </Page>
    </Box>
  );
}
