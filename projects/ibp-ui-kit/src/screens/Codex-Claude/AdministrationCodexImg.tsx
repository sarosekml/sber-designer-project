import React from 'react';

import { Icon, type IconName } from '@/components/atoms/Icon';
import { Paper } from '@/components/atoms/Paper';
import { SxBox } from '@/components/atoms/SxBox';

type LinkGroup = {
  items: string[];
  title?: string;
};

type AdministrationCard = {
  description: string;
  groups: LinkGroup[];
  title: string;
};

type SectionColumn = {
  cards: AdministrationCard[];
  label: string;
};

const sidebarItems: {
  icon: IconName;
  label: string;
}[] = [
  { icon: 'LeftMenu', label: 'Меню' },
  { icon: 'MainPage', label: 'Главная' },
  { icon: 'Layer03', label: 'Разделы' },
  { icon: 'DocumentUnread', label: 'Документы' },
  { icon: 'PaymentsIb', label: 'Платежи' },
  { icon: 'Registry', label: 'Справочники' },
  { icon: 'Building03', label: 'Объекты' },
  { icon: 'Filter', label: 'Фильтры' },
  { icon: 'Calendar', label: 'Календарь' },
  { icon: 'Layer03', label: 'Аналитика' },
  { icon: 'Building03', label: 'Портфель' },
  { icon: 'Registry', label: 'Отчеты' },
  { icon: 'DocumentUnread', label: 'Проверки' },
  { icon: 'Settings', label: 'Настройки' },
  { icon: 'Filter', label: 'Безопасность' },
];

const sections: SectionColumn[] = [
  {
    label: 'Бизнес-справочники',
    cards: [
      {
        title: 'Справочники',
        description: 'Бизнес-справочники, используемые в сделках',
        groups: [
          { items: ['Риск-сегмент'] },
          { title: 'Сотрудники', items: ['Департаменты', 'Макроотрасли', 'Дески'] },
          {
            title: 'Задачи',
            items: ['Объекты задач', 'Типы задач', 'Группы типов задач', 'Статусы задач', 'Категории задач'],
          },
          { title: 'География', items: ['Города', 'Регионы'] },
          { title: 'Документы', items: ['Типы документов'] },
        ],
      },
    ],
  },
  {
    label: 'Бизнес-данные',
    cards: [
      {
        title: 'Сотрудники',
        description: 'Список и детальная информация о сотрудниках',
        groups: [{ items: ['Сотрудники', 'Дески', 'Департаменты'] }],
      },
      {
        title: 'Клиенты',
        description: 'Список контрагентов из всех сделок',
        groups: [{ items: ['Клиенты', 'Связанные физические лица'] }],
      },
      {
        title: 'Финансы',
        description: 'Финансовые данные по сделкам',
        groups: [{ items: ['Средняя ETC'] }],
      },
    ],
  },
  {
    label: 'Настройки процессов',
    cards: [
      {
        title: 'Системные настройки',
        description: 'Настройки и администрирование системы',
        groups: [{ items: ['Группы настроек', 'Микросервисы', 'Настройки'] }],
      },
      {
        title: 'Уведомления',
        description: 'Настройки и администрирование уведомлений',
        groups: [{ items: ['Журнал уведомлений', 'Шаблоны уведомлений'] }],
      },
      {
        title: 'Документы',
        description: 'Список контрагентов из всех сделок',
        groups: [{ items: ['Папки документов', 'Сценарии'] }],
      },
      {
        title: 'Доступность сервисов',
        description: 'Проверка доступности сервисов',
        groups: [{ items: ['Доступно сервисов 29/29'] }],
      },
    ],
  },
];

function Sidebar() {
  return (
    <SxBox
      component="aside"
      aria-label="Основная навигация"
      sx={(theme) => ({
        alignItems: 'center',
        backgroundColor: theme.palette.BG.BGMainMenu,
        borderRight: `1px solid ${theme.palette.Border.BorderLight}`,
        bottom: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        left: 0,
        padding: theme.spacing(1.25, 0.75),
        position: 'fixed',
        top: 0,
        width: 56,
        zIndex: theme.zIndex.drawer,
      })}
    >
      <SxBox
        sx={(theme) => ({
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing(1.75),
          width: '100%',
        })}
      >
        {sidebarItems.map((item) => (
          <SidebarIcon key={item.label} item={item} />
        ))}
      </SxBox>
      <SxBox sx={{ flexGrow: 1 }} />
      <SxBox
        sx={(theme) => ({
          alignItems: 'center',
          backgroundColor: theme.palette.Primary.PrimaryDark,
          borderRadius: '50%',
          color: theme.palette.Text.TextOnDark,
          display: 'flex',
          fontFamily: theme.typography.ButtonXS.fontFamily,
          fontSize: 11,
          fontWeight: 600,
          height: 22,
          justifyContent: 'center',
          lineHeight: '16px',
          marginBottom: theme.spacing(1.25),
          width: 22,
        })}
      >
        АП
      </SxBox>
    </SxBox>
  );
}

function SidebarIcon({ item }: { item: (typeof sidebarItems)[number] }) {
  return (
    <SxBox
      component="button"
      type="button"
      title={item.label}
      aria-label={item.label}
      sx={(theme) => ({
        'alignItems': 'center',
        'backgroundColor': 'transparent',
        'border': 'none',
        'borderRadius': theme.spacing(1),
        'color': theme.palette.Secondary.Secondary,
        'cursor': 'pointer',
        'display': 'flex',
        'height': 24,
        'justifyContent': 'center',
        'padding': 0,
        'transition': 'background-color 120ms ease, color 120ms ease',
        'width': 24,
        '&:hover': {
          backgroundColor: theme.palette.Primary.PrimaryBGLight,
          color: theme.palette.Primary.PrimaryDark,
        },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.Primary.Primary}`,
          outlineOffset: 2,
        },
      })}
    >
      <Icon name={item.icon} color="inherit" size="sm" />
    </SxBox>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <SxBox
      sx={(theme) => ({
        alignItems: 'center',
        color: theme.palette.Text.TextSecondary,
        display: 'flex',
        fontFamily: theme.typography.BodySReg.fontFamily,
        fontSize: 14,
        gap: theme.spacing(1),
        lineHeight: '20px',
        marginBottom: theme.spacing(1.5),
        minHeight: 20,
        whiteSpace: 'nowrap',
      })}
    >
      <SxBox component="span">{label}</SxBox>
      <SxBox
        aria-hidden="true"
        sx={(theme) => ({
          backgroundColor: theme.palette.Secondary.SecondaryDark,
          flexGrow: 1,
          height: 1,
          opacity: 0.55,
        })}
      />
    </SxBox>
  );
}

function AdministrationPanel({ card, tall = false }: { card: AdministrationCard; tall?: boolean }) {
  return (
    <Paper
      elevation={0}
      sx={(theme) => ({
        backgroundColor: theme.palette.BG.BGPopup,
        borderRadius: theme.spacing(1),
        boxShadow: '0 8px 22px rgba(40, 50, 55, 0.04)',
        boxSizing: 'border-box',
        minHeight: tall ? 622 : 0,
        padding: theme.spacing(3, 3, 3.25),
      })}
    >
      <SxBox
        component="h2"
        sx={(theme) => ({
          color: theme.palette.Text.TextPrimary,
          fontFamily: theme.typography.H4StrongSmb.fontFamily,
          fontSize: 23,
          fontWeight: 600,
          letterSpacing: 0,
          lineHeight: '30px',
          margin: 0,
        })}
      >
        {card.title}
      </SxBox>
      <SxBox
        sx={(theme) => ({
          color: theme.palette.Text.TextSecondary,
          fontFamily: theme.typography.BodySReg.fontFamily,
          fontSize: 15,
          lineHeight: '22px',
          marginTop: theme.spacing(0.5),
        })}
      >
        {card.description}
      </SxBox>
      <SxBox
        sx={(theme) => ({
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing(2.25),
          marginTop: theme.spacing(2.75),
        })}
      >
        {card.groups.map((group) => (
          <LinkGroupBlock key={group.title ?? group.items.join('-')} group={group} />
        ))}
      </SxBox>
    </Paper>
  );
}

function LinkGroupBlock({ group }: { group: LinkGroup }) {
  return (
    <SxBox>
      {group.title && (
        <SxBox
          sx={(theme) => ({
            color: theme.palette.Text.TextPrimary,
            fontFamily: theme.typography.BodyMStrongSmb.fontFamily,
            fontSize: 16,
            fontWeight: 600,
            lineHeight: '22px',
            marginBottom: theme.spacing(0.75),
          })}
        >
          {group.title}
        </SxBox>
      )}
      <SxBox
        component="ul"
        sx={(theme) => ({
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing(0.5),
          listStyle: 'none',
          margin: 0,
          padding: 0,
        })}
      >
        {group.items.map((item) => (
          <SxBox component="li" key={item}>
            <SxBox
              component="a"
              href="#"
              onClick={(event) => {
                event.preventDefault();
              }}
              sx={(theme) => ({
                'color': theme.palette.Primary.PrimaryDark,
                'display': 'inline-block',
                'fontFamily': theme.typography.BodyMReg.fontFamily,
                'fontSize': 16,
                'lineHeight': '24px',
                'textDecoration': 'none',
                '&:hover': {
                  color: theme.palette.Primary.Primary,
                  textDecoration: 'underline',
                },
                '&:focus-visible': {
                  borderRadius: theme.spacing(0.5),
                  outline: `2px solid ${theme.palette.Primary.Primary}`,
                  outlineOffset: 2,
                },
              })}
            >
              {item}
            </SxBox>
          </SxBox>
        ))}
      </SxBox>
    </SxBox>
  );
}

function BackgroundIllustration() {
  return (
    <SxBox
      aria-hidden="true"
      sx={{
        bottom: -122,
        height: 660,
        opacity: 0.32,
        pointerEvents: 'none',
        position: 'absolute',
        right: -16,
        width: 796,
      }}
    >
      <SxBox
        sx={{
          border: '22px solid #dceae8',
          borderLeftColor: 'transparent',
          borderRadius: '52% 48% 46% 54%',
          height: 318,
          position: 'absolute',
          right: 62,
          top: 26,
          transform: 'rotate(-20deg)',
          width: 562,
        }}
      />
      <SxBox
        sx={{
          backgroundColor: '#d4e4e2',
          height: 34,
          left: 204,
          position: 'absolute',
          top: 280,
          transform: 'skewX(-22deg)',
          width: 190,
        }}
      />
      <SxBox
        sx={{
          border: '10px solid #d4e4e2',
          borderRadius: '50%',
          height: 82,
          left: 358,
          position: 'absolute',
          top: 94,
          width: 82,
        }}
      >
        <SxBox
          sx={{
            border: '7px solid #d4e4e2',
            borderLeftColor: 'transparent',
            borderRadius: '50%',
            height: 42,
            left: 12,
            position: 'absolute',
            top: 12,
            transform: 'rotate(-45deg)',
            width: 42,
          }}
        />
      </SxBox>
      <SxBox
        sx={{
          backgroundColor: '#e1eeec',
          height: 430,
          left: 236,
          position: 'absolute',
          top: 244,
          transform: 'skewY(15deg)',
          width: 200,
        }}
      />
      <SxBox
        sx={{
          backgroundColor: '#eef6f5',
          height: 412,
          left: 420,
          position: 'absolute',
          top: 262,
          transform: 'skewY(-16deg)',
          width: 182,
        }}
      />
      <SxBox
        sx={{
          backgroundColor: '#d7e7e5',
          height: 212,
          left: 592,
          position: 'absolute',
          top: 318,
          transform: 'skewY(-16deg)',
          width: 108,
        }}
      />
      {Array.from({ length: 8 }).map((_, index) => (
        <SxBox
          key={`grid-row-${index}`}
          sx={{
            backgroundColor: '#c4dbd8',
            height: 1,
            left: 256,
            position: 'absolute',
            top: 300 + index * 42,
            transform: 'skewY(15deg)',
            width: 164,
          }}
        />
      ))}
      {Array.from({ length: 6 }).map((_, index) => (
        <SxBox
          key={`grid-column-${index}`}
          sx={{
            backgroundColor: '#c4dbd8',
            height: 344,
            left: 282 + index * 26,
            position: 'absolute',
            top: 286,
            transform: 'skewY(15deg)',
            width: 1,
          }}
        />
      ))}
    </SxBox>
  );
}

export function AdministrationCodexImg() {
  return (
    <SxBox
      component="main"
      data-sd-screen-root="true"
      aria-label="Administration-from-img"
      sx={(theme) => ({
        backgroundColor: theme.palette.BG.BGPageLinearStart,
        boxSizing: 'border-box',
        color: theme.palette.Text.TextPrimary,
        minHeight: '100vh',
        overflow: 'hidden',
        position: 'relative',
      })}
    >
      <Sidebar />
      <BackgroundIllustration />
      <SxBox
        sx={(theme) => ({
          boxSizing: 'border-box',
          marginLeft: '56px',
          minHeight: '100vh',
          padding: theme.spacing(2, 6, 8, 3),
          position: 'relative',
          zIndex: 1,
        })}
      >
        <SxBox
          component="nav"
          aria-label="Хлебные крошки"
          sx={(theme) => ({
            color: theme.palette.Text.TextSecondary,
            fontFamily: theme.typography.BodySReg.fontFamily,
            fontSize: 14,
            lineHeight: '20px',
            marginBottom: theme.spacing(2.75),
          })}
        >
          Главная
        </SxBox>
        <SxBox
          component="h1"
          sx={(theme) => ({
            color: theme.palette.Text.TextPrimary,
            fontFamily: theme.typography.H4StrongSmb.fontFamily,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: '38px',
            margin: 0,
            marginBottom: theme.spacing(2.75),
          })}
        >
          Администрирование
        </SxBox>
        <SxBox
          sx={(theme) => ({
            display: 'grid',
            gap: theme.spacing(2),
            gridTemplateColumns: '442px 442px 442px',
            maxWidth: 1358,
            '@media (max-width: 1500px)': {
              gridTemplateColumns: 'repeat(3, minmax(300px, 1fr))',
            },
            '@media (max-width: 1120px)': {
              gridTemplateColumns: 'repeat(2, minmax(300px, 1fr))',
            },
            '@media (max-width: 760px)': {
              gridTemplateColumns: 'minmax(0, 1fr)',
              maxWidth: 'none',
            },
          })}
        >
          {sections.map((section) => (
            <SxBox key={section.label}>
              <SectionHeading label={section.label} />
              <SxBox
                sx={(theme) => ({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.spacing(2),
                })}
              >
                {section.cards.map((card, index) => (
                  <AdministrationPanel
                    key={card.title}
                    card={card}
                    tall={section.label === 'Бизнес-справочники' && index === 0}
                  />
                ))}
              </SxBox>
            </SxBox>
          ))}
        </SxBox>
      </SxBox>
    </SxBox>
  );
}
