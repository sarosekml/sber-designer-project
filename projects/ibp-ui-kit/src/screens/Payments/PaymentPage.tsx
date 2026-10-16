import React, { MouseEvent, ReactNode, useState } from 'react';
import { Menu, MenuItem } from '@mui/material';

import { Button } from '@/components/atoms/buttons/Button';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { IconButton } from '@/components/atoms/IconButton';
import { Paper } from '@/components/atoms/Paper';
import { SxBox } from '@/components/atoms/SxBox';
import { Text } from '@/components/atoms/typography';

type BreadcrumbItem = {
  href: string | null;
  label: string;
};

type AmountField = {
  label: string;
  suffix?: string;
  value: string;
};

type InfoField = {
  externalLink?: boolean;
  label: string;
  type?: 'tag';
  value: string;
};

type DocumentItem = {
  label: string;
  name: string;
  type: 'document' | 'pdf' | 'xlsx';
};

type PaymentPageData = {
  actions: {
    edit: {
      label: string;
    };
    menu: string[];
    primary: {
      disabled: boolean;
      label: string;
    };
  };
  amount: {
    fields: AmountField[];
    title: string;
  };
  breadcrumbs: BreadcrumbItem[];
  checker: {
    fields: InfoField[];
    title: string;
  };
  counterparty: {
    fields: InfoField[];
    title: string;
  };
  deal: {
    fields: InfoField[];
    title: string;
  };
  documents: {
    items: DocumentItem[];
    title: string;
  };
  payment: {
    registryLabel: string;
    status: string;
    statusType: 'expected';
    title: string;
  };
  purpose: {
    text: string;
    title: string;
  };
};

const paymentPageData: PaymentPageData = {
  breadcrumbs: [
    { label: 'Главная', href: '#' },
    { label: 'Реестр платежей', href: '#' },
    { label: 'Платеж от 30.07.2024', href: null },
  ],

  payment: {
    title: 'Платеж от 30.07.2024',
    status: 'Ожидаемый',
    statusType: 'expected',
    registryLabel: 'В реестр',
  },

  amount: {
    title: 'Сумма',
    fields: [
      {
        label: 'Сумма с НДС, руб.',
        value: '5 792 800,29',
        suffix: 'руб.',
      },
      {
        label: 'НДС 20%, руб.',
        value: '1 448 200,07',
        suffix: 'руб.',
      },
      {
        label: 'Сумма без НДС, руб.',
        value: '7 241 045,36',
        suffix: 'руб.',
      },
    ],
  },

  counterparty: {
    title: 'Контрагент',
    fields: [
      {
        label: 'Платежный контрагент',
        value: 'ООО "Ромашка"',
      },
      {
        label: 'ИНН',
        value: '6123012938',
      },
      {
        label: 'КПП',
        value: '33432423423',
      },
      {
        label: 'КПП КН',
        value: '33432423423',
      },
    ],
  },

  deal: {
    title: 'Сделка',
    fields: [
      {
        label: '№ сделки',
        value: 'M&A Сделка №45697354',
        externalLink: true,
      },
      {
        label: 'Тип сделки',
        value: 'sell-side',
        type: 'tag',
      },
    ],
  },

  purpose: {
    title: 'Назначение платежа',
    text: 'Услуги организатора по Соглашению "№456321" от "12.09.2024" об организации размещения облигаций',
  },

  documents: {
    title: 'Документы',
    items: [
      {
        label: 'Договор',
        name: 'Договор № 3764 от 20.03.2025.pdf',
        type: 'pdf',
      },
      {
        label: 'Акт',
        name: '№456321 от 12.09.2024',
        type: 'document',
      },
      {
        label: 'Счет-фактура',
        name: '№456334567321 от 24.01.2025',
        type: 'document',
      },
      {
        label: 'Счет',
        name: 'Счет №324 к Акту от 27.03.2025.xlsx',
        type: 'xlsx',
      },
    ],
  },

  checker: {
    title: 'Проверяющий',
    fields: [
      {
        label: 'ФИО',
        value: 'Иванов Иван Иванович',
      },
      {
        label: 'Должность',
        value: 'Старший кредитный контролер',
      },
      {
        label: 'Департамент',
        value: 'Департамент кредитного контроля',
      },
    ],
  },

  actions: {
    primary: {
      label: 'На подтверждение',
      disabled: true,
    },
    edit: {
      label: 'Редактировать',
    },
    menu: ['Дублировать платеж', 'Скачать данные', 'История изменений'],
  },
};

const sidebarItems: {
  active?: boolean;
  badge?: string;
  dividerAfter?: boolean;
  icon: IconName;
  label: string;
}[] = [
  { icon: 'LeftMenu', label: 'Меню', dividerAfter: true },
  { icon: 'MainPage', label: 'Главная' },
  { icon: 'DocumentUnread', label: 'Документы' },
  { icon: 'Layer03', label: 'Модули' },
  { icon: 'PaymentsIb', label: 'Платежи', active: true },
  { icon: 'Building03', label: 'Компании', dividerAfter: true },
  { icon: 'Registry', label: 'Реестр' },
  { icon: 'Calendar', label: 'Календарь', badge: '7' },
  { icon: 'Settings', label: 'Настройки' },
  { icon: 'Filter', label: 'Контролы' },
];

function Sidebar() {
  return (
    <SxBox
      component="aside"
      aria-label="Навигация"
      sx={(theme) => ({
        alignItems: 'center',
        backgroundColor: theme.palette.BG.BGMainMenu,
        borderRight: `1px solid ${theme.palette.Border.BorderLight}`,
        bottom: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        left: 0,
        minHeight: '100vh',
        padding: theme.spacing(1.5, 0.75),
        position: 'fixed',
        top: 0,
        width: 48,
        zIndex: theme.zIndex.drawer,
      })}
    >
      <SxBox sx={{ alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 0.75, width: '100%' }}>
        {sidebarItems.map((item) => (
          <React.Fragment key={item.label}>
            <SidebarIcon item={item} />
            {item.dividerAfter && <SidebarDivider />}
          </React.Fragment>
        ))}
      </SxBox>
      <SxBox sx={{ flexGrow: 1 }} />
      <SidebarAvatar />
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
        'backgroundColor': item.active ? theme.palette.Primary.PrimaryBG : 'transparent',
        'border': 'none',
        'borderRadius': theme.spacing(2),
        'color': item.active ? theme.palette.Primary.Primary : theme.palette.Secondary.SecondaryDark,
        'cursor': 'pointer',
        'display': 'flex',
        'height': 34,
        'justifyContent': 'center',
        'padding': 0,
        'position': 'relative',
        'transition': 'background-color 120ms ease, color 120ms ease',
        'width': 34,
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
      {item.badge && (
        <SxBox
          component="span"
          sx={(theme) => ({
            alignItems: 'center',
            backgroundColor: theme.palette.Primary.Primary,
            border: `1px solid ${theme.palette.BG.BGPopup}`,
            borderRadius: '50%',
            color: theme.palette.Text.TextOnDark,
            display: 'flex',
            fontFamily: theme.typography.ButtonXS.fontFamily,
            fontSize: 9,
            height: 14,
            justifyContent: 'center',
            lineHeight: '14px',
            position: 'absolute',
            right: 2,
            top: 2,
            width: 14,
          })}
        >
          {item.badge}
        </SxBox>
      )}
    </SxBox>
  );
}

function SidebarDivider() {
  return (
    <SxBox
      sx={(theme) => ({
        backgroundColor: theme.palette.Border.BorderLight,
        height: 1,
        margin: theme.spacing(0.5, 0),
        width: 24,
      })}
    />
  );
}

function SidebarAvatar() {
  return (
    <SxBox
      sx={(theme) => ({
        alignItems: 'center',
        backgroundColor: theme.palette.Primary.PrimaryBG,
        border: `1px solid ${theme.palette.Secondary.Secondary}`,
        borderRadius: '50%',
        color: theme.palette.Primary.PrimaryDark,
        display: 'flex',
        fontFamily: theme.typography.ButtonXS.fontFamily,
        fontSize: 11,
        fontWeight: 600,
        height: 32,
        justifyContent: 'center',
        letterSpacing: 0,
        lineHeight: '16px',
        width: 32,
      })}
    >
      ИБ
    </SxBox>
  );
}

function MainLayout({ children }: { children: ReactNode }) {
  return (
    <SxBox
      component="main"
      sx={(theme) => ({
        'backgroundColor': theme.palette.BG.BGPageLinearEnd,
        'boxSizing': 'border-box',
        'color': theme.palette.Text.TextPrimary,
        'marginLeft': '48px',
        'minHeight': '100vh',
        'padding': theme.spacing(3.5, 5, 6),
        'width': 'calc(100vw - 48px)',
        '@media (max-width: 900px)': {
          padding: theme.spacing(3, 3, 5),
        },
      })}
    >
      {children}
    </SxBox>
  );
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <SxBox
      component="nav"
      aria-label="Breadcrumbs"
      sx={(theme) => ({
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(3),
        minHeight: 20,
      })}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={item.label}>
            {item.href && !isLast ? (
              <SxBox
                component="a"
                href={item.href}
                onClick={(event) => {
                  event.preventDefault();
                  console.log('Navigate breadcrumb:', item.href);
                }}
                sx={(theme) => ({
                  'color': theme.palette.Text.TextSecondary,
                  'fontFamily': theme.typography.BodySReg.fontFamily,
                  'fontSize': 13,
                  'letterSpacing': 0,
                  'lineHeight': '20px',
                  'textDecoration': 'none',
                  '&:hover': {
                    color: theme.palette.Primary.PrimaryDark,
                    textDecoration: 'underline',
                  },
                  '&:focus-visible': {
                    borderRadius: theme.spacing(0.5),
                    outline: `2px solid ${theme.palette.Primary.Primary}`,
                    outlineOffset: 2,
                  },
                })}
              >
                {item.label}
              </SxBox>
            ) : (
              <SxBox
                component="span"
                sx={(theme) => ({
                  color: theme.palette.Text.TextPrimary,
                  fontFamily: theme.typography.BodySReg.fontFamily,
                  fontSize: 13,
                  letterSpacing: 0,
                  lineHeight: '20px',
                })}
              >
                {item.label}
              </SxBox>
            )}
            {!isLast && (
              <SxBox
                component="span"
                aria-hidden="true"
                sx={(theme) => ({
                  color: theme.palette.Text.TextSecondary,
                  fontFamily: theme.typography.BodySReg.fontFamily,
                  fontSize: 13,
                  lineHeight: '20px',
                })}
              >
                /
              </SxBox>
            )}
          </React.Fragment>
        );
      })}
    </SxBox>
  );
}

function PageHeader({ data }: { data: PaymentPageData }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(anchorEl);

  const handleOpenMenu = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    console.log('Open payment actions');
  };

  const handleCloseMenu = () => setAnchorEl(null);

  return (
    <SxBox
      component="header"
      sx={(theme) => ({
        'alignItems': 'center',
        'display': 'flex',
        'gap': theme.spacing(3),
        'justifyContent': 'space-between',
        'marginBottom': theme.spacing(3),
        'minHeight': 48,
        '@media (max-width: 1100px)': {
          alignItems: 'flex-start',
          flexDirection: 'column',
        },
      })}
    >
      <SxBox
        sx={(theme) => ({
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          gap: theme.spacing(2),
          minWidth: 0,
        })}
      >
        <SxBox
          component="h1"
          sx={(theme) => ({
            color: theme.palette.Text.TextPrimary,
            fontFamily: theme.typography.H4StrongSmb.fontFamily,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: '32px',
            margin: 0,
          })}
        >
          {data.payment.title}
        </SxBox>
        <TitleIndicator />
        <StatusPill label={data.payment.status} />
        <Button
          dataTestId="PaymentDetailBackToRegistry"
          type="outlined"
          color="primary"
          size="xs"
          startIcon="ArrowNarrowLeft"
          onClick={() => console.log('Navigate to payment registry')}
          sx={(theme) => ({
            backgroundColor: theme.palette.BG.BGPopup,
          })}
        >
          {data.payment.registryLabel}
        </Button>
      </SxBox>

      <SxBox
        sx={(theme) => ({
          'alignItems': 'center',
          'display': 'flex',
          'flexWrap': 'wrap',
          'gap': theme.spacing(2),
          'justifyContent': 'flex-end',
          '@media (max-width: 1100px)': {
            justifyContent: 'flex-start',
          },
        })}
      >
        <Button
          dataTestId="PaymentDetailSubmit"
          type="outlined"
          color="primary"
          size="sm"
          startIcon="ClockTimer"
          disabled={data.actions.primary.disabled}
          sx={(theme) => ({
            'backgroundColor': theme.palette.Disabled.DisabledBG,
            'height': 32,
            '&:disabled, &:disabled:hover': {
              backgroundColor: theme.palette.Disabled.DisabledBG,
              borderColor: theme.palette.Disabled.DisabledBorder,
              color: theme.palette.Disabled.Disabled,
            },
          })}
        >
          {data.actions.primary.label}
        </Button>
        <Button
          dataTestId="PaymentDetailEdit"
          type="outlined"
          color="primary"
          size="sm"
          startIcon="Edit"
          onClick={() => console.log('Edit payment')}
          sx={(theme) => ({
            backgroundColor: theme.palette.BG.BGPopup,
            height: 32,
          })}
        >
          {data.actions.edit.label}
        </Button>
        <IconButton
          dataTestId="PaymentDetailActions"
          name="MoreDots"
          title="Дополнительные действия"
          onClick={handleOpenMenu}
          sx={(theme) => ({
            'backgroundColor': theme.palette.BG.BGPopup,
            'border': `1px solid ${theme.palette.Primary.Primary}`,
            'borderRadius': theme.spacing(1.5),
            'height': 32,
            'width': 32,
            '& .IconButton_icon__controller': {
              color: theme.palette.Primary.Primary,
            },
            '&:hover': {
              backgroundColor: theme.palette.Primary.PrimaryBG,
            },
          })}
        />
        <Menu
          anchorEl={anchorEl}
          open={isMenuOpen}
          onClose={handleCloseMenu}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          PaperProps={{
            sx: (theme) => ({
              border: `1px solid ${theme.palette.Border.BorderLight}`,
              borderRadius: theme.spacing(2),
              boxShadow: '0 8px 24px rgba(40, 50, 55, 0.08)',
              marginTop: theme.spacing(1),
              minWidth: 204,
            }),
          }}
        >
          {data.actions.menu.map((action) => (
            <MenuItem
              key={action}
              onClick={() => {
                console.log('Payment action:', action);
                handleCloseMenu();
              }}
              sx={(theme) => ({
                color: theme.palette.Text.TextPrimary,
                fontFamily: theme.typography.BodySReg.fontFamily,
                fontSize: 14,
                minHeight: 36,
              })}
            >
              {action}
            </MenuItem>
          ))}
        </Menu>
      </SxBox>
    </SxBox>
  );
}

function TitleIndicator() {
  return (
    <SxBox
      aria-hidden="true"
      sx={(theme) => ({
        alignItems: 'center',
        backgroundColor: theme.palette.Primary.PrimaryBG,
        borderRadius: '50%',
        display: 'flex',
        height: 20,
        justifyContent: 'center',
        width: 20,
      })}
    >
      <Icon name="ArrowNarrowUpRight" color="primary" size="sm" sx={{ height: 14, width: 14 }} />
    </SxBox>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <SxBox
      component="span"
      sx={(theme) => ({
        alignItems: 'center',
        backgroundColor: theme.palette.Primary.PrimaryBG,
        border: `1px solid ${theme.palette.Secondary.Secondary}`,
        borderRadius: theme.spacing(5),
        color: theme.palette.Primary.PrimaryDark,
        display: 'inline-flex',
        fontFamily: theme.typography.ButtonS.fontFamily,
        fontSize: 14,
        gap: theme.spacing(1),
        height: 28,
        letterSpacing: 0,
        lineHeight: '20px',
        padding: theme.spacing(0, 2),
      })}
    >
      <Icon name="ClockTimer" color="primary" size="sm" sx={{ height: 16, width: 16 }} />
      {label}
    </SxBox>
  );
}

function Card({ children, className, title }: { children: ReactNode; className?: string; title: string }) {
  return (
    <Paper
      className={className}
      elevation={0}
      sx={(theme) => ({
        backgroundColor: theme.palette.BG.BGPopup,
        border: `1px solid ${theme.palette.Border.BorderLight}`,
        borderRadius: theme.spacing(2),
        boxShadow: '0 1px 2px rgba(40, 50, 55, 0.02)',
        boxSizing: 'border-box',
        minHeight: 184,
        padding: theme.spacing(5.5, 6),
      })}
    >
      <Text
        type="H4StrongSmb"
        sx={(theme) => ({
          color: theme.palette.Text.TextPrimary,
          fontSize: 20,
          lineHeight: '28px',
          marginBottom: theme.spacing(5),
        })}
      >
        {title}
      </Text>
      {children}
    </Paper>
  );
}

function InfoFieldView({ field }: { field: AmountField | InfoField }) {
  return (
    <SxBox sx={{ minWidth: 0 }}>
      <Text
        type="BodyXSReg"
        sx={(theme) => ({
          color: theme.palette.Text.TextSecondary,
          fontSize: 12,
          lineHeight: '16px',
          marginBottom: theme.spacing(1.5),
        })}
      >
        {field.label}
      </Text>
      {'type' in field && field.type === 'tag' ? (
        <TypeTag value={field.value} />
      ) : 'externalLink' in field && field.externalLink ? (
        <DealLink value={field.value} />
      ) : (
        <Text
          type="BodyMReg"
          sx={(theme) => ({
            color: theme.palette.Text.TextPrimary,
            fontSize: 16,
            lineHeight: '22px',
            overflowWrap: 'break-word',
          })}
        >
          {field.value}
          {'suffix' in field && field.suffix && (
            <SxBox
              component="span"
              sx={(theme) => ({
                color: theme.palette.Text.TextSecondary,
                marginLeft: theme.spacing(1),
              })}
            >
              {field.suffix}
            </SxBox>
          )}
        </Text>
      )}
    </SxBox>
  );
}

function AmountCard({ data }: { data: PaymentPageData['amount'] }) {
  return (
    <Card title={data.title} className="amount-card">
      <SxBox
        sx={(theme) => ({
          'display': 'grid',
          'gap': theme.spacing(5, 6),
          'gridTemplateColumns': '1fr 1fr',
          '@media (max-width: 900px)': {
            gridTemplateColumns: '1fr',
          },
        })}
      >
        {data.fields.map((field) => (
          <InfoFieldView key={field.label} field={field} />
        ))}
      </SxBox>
    </Card>
  );
}

function CounterpartyCard({ data }: { data: PaymentPageData['counterparty'] }) {
  return (
    <Card title={data.title} className="counterparty-card">
      <SxBox
        sx={(theme) => ({
          'display': 'grid',
          'gap': theme.spacing(5, 6),
          'gridTemplateColumns': '1fr 1fr',
          '@media (max-width: 900px)': {
            gridTemplateColumns: '1fr',
          },
        })}
      >
        {data.fields.map((field) => (
          <InfoFieldView key={field.label} field={field} />
        ))}
      </SxBox>
    </Card>
  );
}

function DealCard({ data }: { data: PaymentPageData['deal'] }) {
  return (
    <Card title={data.title} className="deal-card">
      <SxBox
        sx={(theme) => ({
          display: 'grid',
          gap: theme.spacing(5),
        })}
      >
        {data.fields.map((field) => (
          <InfoFieldView key={field.label} field={field} />
        ))}
      </SxBox>
    </Card>
  );
}

function DealLink({ value }: { value: string }) {
  return (
    <SxBox
      component="button"
      type="button"
      onClick={() => console.log(`Open deal: ${value}`)}
      sx={(theme) => ({
        'alignItems': 'center',
        'backgroundColor': 'transparent',
        'border': 'none',
        'color': theme.palette.Primary.Primary,
        'cursor': 'pointer',
        'display': 'inline-flex',
        'fontFamily': theme.typography.BodyMReg.fontFamily,
        'fontSize': 16,
        'gap': theme.spacing(1),
        'lineHeight': '22px',
        'padding': 0,
        'textAlign': 'left',
        '&:hover': {
          color: theme.palette.Primary.PrimaryDark,
          textDecoration: 'underline',
        },
        '&:focus-visible': {
          borderRadius: theme.spacing(0.5),
          outline: `2px solid ${theme.palette.Primary.Primary}`,
          outlineOffset: 2,
        },
      })}
    >
      {value}
      <Icon name="LinkExternal" color="inherit" size="sm" sx={{ height: 16, width: 16 }} />
    </SxBox>
  );
}

function TypeTag({ value }: { value: string }) {
  return (
    <SxBox
      component="span"
      sx={(theme) => ({
        backgroundColor: theme.palette.Info.InfoBG,
        border: `1px solid ${theme.palette.Info.InfoLight}`,
        borderRadius: theme.spacing(5),
        color: theme.palette.Info.InfoDark,
        display: 'inline-flex',
        fontFamily: theme.typography.ButtonS.fontFamily,
        fontSize: 14,
        lineHeight: '20px',
        padding: theme.spacing(0.5, 2),
      })}
    >
      {value}
    </SxBox>
  );
}

function PurposeCard({ data }: { data: PaymentPageData['purpose'] }) {
  return (
    <Card title={data.title} className="purpose-card">
      <Text
        type="BodyMReg"
        sx={(theme) => ({
          color: theme.palette.Text.TextPrimary,
          fontSize: 16,
          lineHeight: '24px',
          maxWidth: 620,
        })}
      >
        {data.text}
      </Text>
    </Card>
  );
}

function CheckerCard({ data }: { data: PaymentPageData['checker'] }) {
  return (
    <Card title={data.title} className="checker-card">
      <SxBox
        sx={(theme) => ({
          display: 'grid',
          gap: theme.spacing(5),
        })}
      >
        {data.fields.map((field) => (
          <InfoFieldView key={field.label} field={field} />
        ))}
      </SxBox>
    </Card>
  );
}

function DocumentsCard({ data }: { data: PaymentPageData['documents'] }) {
  return (
    <Card title={data.title} className="documents-card">
      <SxBox
        sx={(theme) => ({
          'display': 'grid',
          'gap': theme.spacing(5, 7),
          'gridTemplateColumns': '1fr 1fr',
          '@media (max-width: 900px)': {
            gridTemplateColumns: '1fr',
          },
        })}
      >
        {data.items.map((item) => (
          <DocumentItemView key={`${item.label}-${item.name}`} item={item} />
        ))}
      </SxBox>
    </Card>
  );
}

function DocumentItemView({ item }: { item: DocumentItem }) {
  const handleDownload = () => console.log('Download document:', item.name);

  return (
    <SxBox sx={{ minWidth: 0 }}>
      <Text
        type="BodyXSReg"
        sx={(theme) => ({
          color: theme.palette.Text.TextSecondary,
          fontSize: 12,
          lineHeight: '16px',
          marginBottom: theme.spacing(1.5),
        })}
      >
        {item.label}
      </Text>
      <SxBox
        sx={(theme) => ({
          alignItems: 'center',
          display: 'grid',
          gap: theme.spacing(1.5),
          gridTemplateColumns: 'minmax(0, 1fr) auto',
        })}
      >
        <SxBox
          component="button"
          type="button"
          onClick={handleDownload}
          sx={(theme) => ({
            'backgroundColor': 'transparent',
            'border': 'none',
            'color': theme.palette.Text.TextPrimary,
            'cursor': 'pointer',
            'fontFamily': theme.typography.BodyMReg.fontFamily,
            'fontSize': 16,
            'lineHeight': '22px',
            'minWidth': 0,
            'overflow': 'hidden',
            'padding': 0,
            'textAlign': 'left',
            'textOverflow': 'ellipsis',
            'whiteSpace': 'nowrap',
            '&:hover': {
              color: theme.palette.Primary.PrimaryDark,
              textDecoration: 'underline',
            },
            '&:focus-visible': {
              borderRadius: theme.spacing(0.5),
              outline: `2px solid ${theme.palette.Primary.Primary}`,
              outlineOffset: 2,
            },
          })}
        >
          {item.name}
        </SxBox>
        <IconButton
          dataTestId={`PaymentDetailDocument${item.type}`}
          name="Download"
          title={`Скачать: ${item.name}`}
          onClick={handleDownload}
          sx={(theme) => ({
            'color': theme.palette.Primary.Primary,
            'height': 24,
            'width': 24,
            '& .IconButton_icon__controller': {
              color: theme.palette.Primary.Primary,
            },
            '&:hover': {
              backgroundColor: theme.palette.Primary.PrimaryBG,
            },
          })}
        />
      </SxBox>
    </SxBox>
  );
}

function CardsGrid({ data }: { data: PaymentPageData }) {
  return (
    <>
      <SxBox
        component="section"
        aria-label="Основные данные платежа"
        sx={(theme) => ({
          'display': 'grid',
          'gap': theme.spacing(3),
          'gridTemplateColumns': 'repeat(3, minmax(0, 1fr))',
          '@media (max-width: 1200px)': {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          },
          '@media (max-width: 900px)': {
            gridTemplateColumns: '1fr',
          },
        })}
      >
        <AmountCard data={data.amount} />
        <CounterpartyCard data={data.counterparty} />
        <DealCard data={data.deal} />
      </SxBox>
      <SxBox
        component="section"
        aria-label="Дополнительные данные платежа"
        sx={(theme) => ({
          'display': 'grid',
          'gap': theme.spacing(3),
          'gridTemplateColumns': 'repeat(3, minmax(0, 1fr))',
          'marginTop': theme.spacing(3),
          '& .purpose-card, & .checker-card, & .documents-card': {
            minHeight: 196,
          },
          '@media (max-width: 1200px)': {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          },
          '@media (max-width: 900px)': {
            gridTemplateColumns: '1fr',
          },
        })}
      >
        <PurposeCard data={data.purpose} />
        <CheckerCard data={data.checker} />
        <DocumentsCard data={data.documents} />
      </SxBox>
    </>
  );
}

export function PaymentPage() {
  return (
    <SxBox
      data-sd-screen-root="true"
      aria-label="Test gen"
      sx={(theme) => ({
        backgroundColor: theme.palette.BG.BGPageLinearEnd,
        minHeight: '100vh',
      })}
    >
      <Sidebar />
      <MainLayout>
        <Breadcrumbs items={paymentPageData.breadcrumbs} />
        <PageHeader data={paymentPageData} />
        <CardsGrid data={paymentPageData} />
      </MainLayout>
    </SxBox>
  );
}
