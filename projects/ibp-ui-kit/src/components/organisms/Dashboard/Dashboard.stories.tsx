import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import {
  AdministrationIcon,
  AnalysIcon,
  BindingLeadsIcon,
  CalcFVDashIcon,
  CalendarKpkiIcon,
  CorporateRequestsIcon,
  DashboardsToPipelineIcon,
  DealsIcon,
  LeadSaleIcon,
  MyClientsIcon,
  NecessaryActiveOpportunitiesIcon,
  OneCDashboardIcon,
  PipelineDCPMyDeskOpportunitiesIcon,
  PipelineMyDeskOpportunitiesIcon,
  PlanPaymentsDidIcon,
  PossibleActiveOpportunitiesIcon,
  PossibleLeadsIcon,
  ReservesIcon,
  SalesCampaignsIcon,
  SalesProjectIcon,
  StatementsRegistryIcon,
  TasksIcon,
} from '@/components/atoms/Icon/dashboardIcons';

import { Dashboard } from './Dashboard';

export default {
  title: 'Organisms/Dashboard',
  component: Dashboard,
  parameters: {
    backgrounds: {
      default: 'light swamp',
    },
    docs: {
      description: {
        story: 'Dashboard',
      },
    },
  },
  argTypes: {
    dataTestId: {
      description: 'Dashboard',
    },
  },
} as Meta<typeof Dashboard>;

const Template: StoryFn<typeof Dashboard> = (args) => <Dashboard {...args} />;

const dashboardData = [
  {
    cards: [
      {
        access: true,
        disabled: true,
        text: 'Сделки с продуктами ДИД и/или А-риском',
        title: 'Обязательные сделки',
        url: '/some-app/',
        icon: NecessaryActiveOpportunitiesIcon,
      },
      {
        access: true,
        disabled: true,
        text: 'Прочие сделки в Банке от 1 млрд руб. ',
        title: 'Возможные сделки',
        url: '/some-app/',
        icon: PossibleActiveOpportunitiesIcon,
      },
      {
        access: true,
        disabled: false,
        text: 'Сделки с продуктами ДИД, А-риском и прочие',
        title: 'Сделки',
        url: '/some-app/',
        icon: PossibleActiveOpportunitiesIcon,
      },
      {
        access: true,
        disabled: true,
        text: 'Продуктовые предложения ДКК, ДККК, ДГР и ДИД',
        title: 'Проекты продаж CIB',
        url: '/some-app/',
        icon: SalesProjectIcon,
      },
      {
        access: true,
        disabled: true,
        text: 'Потенциалы ДИД, отправленные на проработку в рабочее место КМ',
        title: 'Кампании продаж',
        url: '/some-app/',
        icon: SalesCampaignsIcon,
      },
      {
        access: true,
        disabled: true,
        text: 'Первые драфты будущих сделок ДИД',
        title: 'Потенциалы ДИД в ТБ',
        url: '/some-app/',
        icon: LeadSaleIcon,
      },
      {
        access: true,
        disabled: false,
        text: 'Компании роста, Топ-клиенты, продукты ДИД и ИК/ПФ от 5 млрд руб.',
        title: 'Обязательные сделки',
        url: '/some-app/',
        icon: BindingLeadsIcon,
      },
      {
        access: true,
        disabled: false,
        text: 'ИК/ПФ от 1 до 5 млрд руб.',
        title: 'Возможные лиды',
        url: '/some-app/',
        icon: PossibleLeadsIcon,
      },
    ],
    title: 'Маршрутизация',
  },
  {
    cards: [
      {
        access: true,
        disabled: false,
        text: 'Все сделки моего деска',
        title: 'Pipeline',
        url: '/deals-app',
        icon: PipelineMyDeskOpportunitiesIcon,
      },

      {
        access: true,
        disabled: false,
        text: 'Все сделки моего деска ЦКП',
        title: 'Pipeline DCP',
        url: '/b3-opportunities-app/pipeline-dcp/my-desk-opportunities',
        icon: PipelineDCPMyDeskOpportunitiesIcon,
      },

      {
        access: true,
        disabled: false,
        text: 'Перечень сделок, обсуждаемых на Комитете',
        title: 'Календарь КПКИ',
        url: '/some-app/',
        icon: CalendarKpkiIcon,
      },

      {
        access: true,
        disabled: false,
        text: 'Список сделок в работе',
        title: 'Дашборды по Pipeline',
        url: '/some-app/',
        icon: DashboardsToPipelineIcon,
      },
    ],
    title: 'Pipeline',
  },
  {
    cards: [
      {
        access: true,
        disabled: true,
        text: 'Все активные сделки ДИД',
        title: 'Текущий портфель ДИД',
        url: '/some-app/',
        icon: DealsIcon,
      },
      {
        access: true,
        disabled: false,
        text: 'Плановые платежи по сделкам ГК СБИ',
        title: 'CF СБИ',
        url: '/some-app/',
        icon: PlanPaymentsDidIcon,
      },
      {
        access: true,
        disabled: true,
        text: 'Реестр корпоративных запросов',
        title: 'Корпоративные запросы',
        url: '/some-app/',
        icon: CorporateRequestsIcon,
      },
    ],
    title: 'Текущий портфель',
  },
  {
    cards: [
      {
        access: true,
        disabled: true,
        text: 'Все задачи моего деска',
        title: 'Задачи',
        url: '/some-app/',
        icon: TasksIcon,
      },
      {
        access: true,
        disabled: false,
        text: 'Работа с моими клиентами',
        title: 'Мои клиенты',
        url: '/some-app/',
        icon: MyClientsIcon,
      },
    ],
    title: 'Задачи',
  },
  {
    cards: [
      {
        access: true,
        disabled: false,
        text: 'Сводная информация по сделкам',
        title: 'Отчёты Qliksense',
        url: '/some-app/',
        icon: DashboardsToPipelineIcon,
      },
      {
        access: true,
        disabled: true,
        text: 'Справочники и другая информация',
        title: 'Администрирование',
        url: '/some-app/',
        icon: AdministrationIcon,
      },
    ],
    title: 'Администрирование',
  },
  {
    cards: [
      {
        access: true,
        disabled: true,
        text: 'Формирование и передача ежемесячных отчетов',
        title: 'Отчеты 1С/Navision',
        url: '/some-app/',
        icon: OneCDashboardIcon,
      },
      {
        access: true,
        disabled: false,
        text: 'Справочники и другая информация',
        title: 'Реестр выписок',
        url: '/some-app/',
        icon: StatementsRegistryIcon,
      },
      {
        access: true,
        disabled: false,
        title: 'Резервы',
        url: '/some-app/',
        icon: ReservesIcon,
      },
      {
        access: true,
        disabled: false,
        title: 'Доходы/расходы сделок СБИ',
        url: '/some-app/',
        icon: AnalysIcon,
      },
      {
        access: true,
        disabled: false,
        title: 'Расчёт FV',
        url: '/some-app/',
        icon: CalcFVDashIcon,
      },
    ],
    title: 'Отчеты',
  },
  {
    cards: [
      {
        access: true,
        disabled: true,
        text: 'Справочники и другая информация',
        title: 'Сделки M&A',
        url: '/some-app/',
        icon: AdministrationIcon,
      },
    ],
    title: 'M&A',
  },
];
const dashboardDataWithoutTitle = [
  {
    cards: [
      {
        access: true,
        disabled: true,
        text: 'Cделки, в которых я добавлен в команду сделки',
        title: 'Мои сделки',
        url: '/some-app/',
        icon: NecessaryActiveOpportunitiesIcon,
      },
      {
        access: true,
        disabled: false,
        text: 'Все сделки моего деска',
        title: 'Сделки деска',
        url: '/some-app/',
        icon: PipelineMyDeskOpportunitiesIcon,
      },
      {
        access: true,
        disabled: true,
        text: 'Все сделки моего деска',
        title: 'Сделки деска',
        url: '/some-app/',
        icon: PipelineMyDeskOpportunitiesIcon,
      },
    ],
  },
  {
    cards: [
      {
        access: true,
        disabled: false,
        text: 'Все активные сделки ДИД',
        title: 'Текущий портфель ДИД',
        url: '/deals-app',
        icon: DealsIcon,
      },
    ],
  },
];

export const AMain = Template.bind({});
AMain.args = {
  dashboardData,
  dataTestId: 'Home',
};

export const BWithoutTitle = Template.bind({});
BWithoutTitle.args = {
  dashboardData: dashboardDataWithoutTitle,
  dataTestId: 'Home',
};
