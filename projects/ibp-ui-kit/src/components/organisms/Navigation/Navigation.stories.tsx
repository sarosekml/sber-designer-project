import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { i18n } from '@sber-ibp/core';

import {
  BadgeCounter,
  ContextMenuButton,
  ContextMenuItem,
  IconButton,
  Link,
  NavigationProps,
  Tooltip,
} from '@/index';

import { Navigation } from './Navigation';

const wrapperInlineStories = {
  transform: 'scale(1)',
  height: '45vh',
};

export default {
  title: 'Organisms/Navigation',
  component: Navigation,
  argTypes: {
    dataTestId: {
      description: 'Navigation',
    },
  },
} as Meta<typeof Navigation>;

const Template: StoryFn<typeof Navigation> = (args) => <Navigation {...args} />;

const onChangeLanguage = (lang: string) => async () => {
  await i18n.changeLanguage(lang);
  location.reload();
};
const languageOptions: ContextMenuItem[] = [
  {
    value: 'Русский',
    action: void onChangeLanguage('ru-RU'),
    isDisabled: i18n.language === 'ru-RU',
  },
  {
    value: 'English',
    action: void onChangeLanguage('en-US'),
    isDisabled: i18n.language === 'en-US',
  },
];

const props: NavigationProps = {
  items: [
    {
      compartment: '',
      items: [
        {
          access: true,
          icon: 'MainPage',
          route: '#',
          text: 'Главная',
        },
      ],
    },
    {
      compartment: 'Маршрутизация',
      items: [
        {
          access: true,
          icon: 'DealsPossibleDeals',
          text: 'Возможные сделки',
          route: '#',
          iconCoveredElement: <BadgeCounter counter={0} size={'sm'} />,
          postfixElement: <BadgeCounter counter={0} size={'md'} />,
        },
        {
          access: true,
          icon: 'ImportantDeals',
          route: '#',
          text: 'Обязательные сделки',
          iconCoveredElement: <BadgeCounter counter={1} size={'sm'} />,
          postfixElement: <BadgeCounter counter={1} size={'md'} />,
        },
        {
          access: true,
          icon: 'SalesProjects',
          route: '#',
          text: 'Проекты продаж',
          iconCoveredElement: <BadgeCounter counter={55} size={'sm'} />,
          postfixElement: <BadgeCounter counter={55} size={'md'} />,
        },
        {
          access: true,
          icon: 'SalesCompany',
          route: '#',
          text: 'Кампании продаж',
          iconCoveredElement: <BadgeCounter counter={123_456} size={'sm'} />,
          postfixElement: <BadgeCounter counter={123_456} size={'md'} />,
        },
      ],
    },
    {
      compartment: 'Pipeline',
      items: [
        {
          access: true,
          icon: 'Pipeline',
          route: '#',
          text: 'Пайплайн',
        },
        {
          access: true,
          icon: 'CkpPipeline',
          route: '#',
          text: 'Пайплайн ЦКП',
        },
        {
          access: true,
          icon: 'MnaPipeline',
          route: '#',
          text: 'M&A пайплайн',
        },
        {
          access: true,
          disabled: true,
          icon: 'KpkiCal',
          route: '#',
          text: 'Календарь КПКИ',
        },
      ],
    },
    {
      compartment: 'Текущий портфель',
      items: [
        {
          access: true,
          icon: 'CurrentDepo',
          route: '#',
          text: 'Текущий портфель ДИД',
          disabled: true,
        },
        {
          access: true,
          icon: 'CashFlow',
          route: '#',
          text: 'Cash Flow СБИ',
        },
        {
          access: true,
          icon: 'CorporateTransactions',
          route: '#',
          text: 'Корпоративные запросы',
        },
      ],
    },
    {
      compartment: 'Администрирование',
      items: [
        {
          access: true,
          icon: 'Settings',
          route: '#',
          text: 'Администрирование',
        },
        {
          access: true,
          external: false,
          icon: 'QliksenseReports',
          route: '#',
          text: 'Отчеты Qliksense',
        },
      ],
    },
    {
      compartment: 'Задачи',
      items: [
        {
          access: true,
          external: false,
          icon: 'Tasks',
          onClickInteraction: () => alert('Проверка функционала!'),
          text: 'Задачи',
        },
        {
          access: true,
          external: false,
          icon: 'ClientSearch',
          route: '#',
          text: 'Поиск клиентов в ЕПК',
        },
      ],
    },
  ],
  dataTestId: 'stories',
  userProfile: {
    firstName: 'Kirill',
    lastName: 'Laptev',
    position: 'Analyst',
  },
  localLinkComponent: Link,
  logoutComponent: (
    <Link dataTestId="storiesLink" severity="default" href="/openid-connect-auth/logout" display={'flex'}>
      <IconButton dataTestId="storiesIconButton" name={'Logout'} />
    </Link>
  ),
  languageComponent: (
    <Tooltip title={i18n.t<string>('Change language')} placement={'top'}>
      <ContextMenuButton icon={'Global'} items={languageOptions} onSelectItem={(item) => item.action?.()} />
    </Tooltip>
  ),
  onUserProfileClick: () => console.log('onProfileTextClick'),
};

export const Main = Template.bind({});

Main.args = {
  ...props,
};

Main.parameters = {
  docs: {
    iframeHeight: 100,
    prepareForInline: (storyFn: StoryFn<typeof Navigation>, args: NavigationProps) => {
      const Story = storyFn;
      return (
        <div style={wrapperInlineStories}>
          <Story {...args} />
        </div>
      );
    },
  },
  backgrounds: {
    default: 'light swamp',
  },
};
