import React, { useMemo, useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { CheckboxTableItem } from '../../../components/CheckboxTable/CheckboxTable.types';
import { ColumnVisibilityManagerContext } from '../ColumnVisibilityManagerPlugin.context';

import { Overlay } from './Overlay';

// === Конфигурация колонок ===
const TABLE_CONFIG = [
  { name: 'potentialId', title: 'Potential ID' },
  { name: 'clientShortName', title: 'Client' },
  { name: 'holdingName', title: 'Holding' },
  { name: 'inn', title: 'TIN' },
  { name: 'sourceTypeName', title: 'Type of potential' },
  { name: 'isGrowthCompanyUcp', title: 'Growth Company UCP' },
  { name: 'isGrowthCompany', title: 'Growth Company' },
  { name: 'isTopClient', title: 'Top Client' },
  { name: 'priorityQuarter', title: 'Quarter priority RD' },
  { name: 'industryName', title: 'Industry' },
  { name: 'macroIndustryName', title: 'Macroindustry' },
  { name: 'subIndustryName', title: 'Subindustry' },
  { name: 'keyClient', title: 'Key Client' },
  { name: 'segmentName', title: 'Segment' },
  { name: 'branchCode', title: 'RB' },
  { name: 'gosbName', title: 'Head office' },
  { name: 'clientManagerFullName', title: 'Client manager' },
  { name: 'sponsor', title: 'Sponsor' },
  { name: 'beneficiariesInfo', title: 'Beneficiaries and LPR' },
  { name: 'income', title: 'Income, m. RUB' },
  { name: 'ebitda', title: 'EBITDA, m. RUB' },
  { name: 'ebit', title: 'EBIT, m. RUB' },
  { name: 'profit', title: 'Profit, m. RUB' },
  { name: 'debt', title: 'Debt, m. RUB' },
  { name: 'ebitdaMargin', title: 'Margin EBITDA, %' },
  { name: 'debtDividedByEbitda', title: 'Debt / EBITDA' },
  { name: 'debtDividedByEbit', title: 'Debt / EBIT' },
  { name: 'idea', title: 'Deal Idea' },
  { name: 'description', title: 'Description' },
  { name: 'statusCode', title: 'Status' },
  { name: 'stageCode', title: 'Stage' },
  { name: 'statusComment', title: 'Comment on status' },
  { name: 'desks', title: 'Desk' },
  { name: 'director', title: 'Director' },
  { name: 'vp', title: 'VP' },
  { name: 'consultantAnalyst', title: 'Consultant / Analyst' },
  { name: 'regionalDirector', title: 'Regional Director' },
  { name: 'createDate', title: 'Create date' },
  { name: 'lastActivityDate', title: 'Last activity date' },
  { name: 'availabilityOfProtocols', title: 'Availability of meeting protocols' },
  { name: 'countProtocols', title: 'Number of meeting protocols' },
  { name: 'availabilityOfOffersFromPotential', title: 'Availability of created leads for KM' },
  { name: 'countOffersFromPotential', title: 'Number of leads created for KM' },
  { name: 'offerId', title: 'Sale ID' },
  { name: 'opportunityId', title: 'DID Deal ID' },
  { name: 'kfulOpportunityId', title: 'KFUL Deal PPRB ID' },
];

const DEFAULT_COLUMN_ORDER = [...TABLE_CONFIG].sort((a, b) => a.title.localeCompare(b.title)).map((col) => col.name);

const DEFAULT_HIDDEN_COLUMNS = [
  'inn',
  'isGrowthCompanyUcp',
  'isGrowthCompany',
  'isTopClient',
  'priorityQuarter',
  'macroIndustryName',
  'subIndustryName',
  'keyClient',
  'segmentName',
  'sponsor',
  'beneficiariesInfo',
  'ebit',
  'profit',
  'ebitdaMargin',
  'debtDividedByEbitda',
  'debtDividedByEbit',
  'idea',
  'statusComment',
  'desks',
  'director',
  'vp',
  'consultantAnalyst',
  'regionalDirector',
  'lastActivityDate',
  'availabilityOfProtocols',
  'countProtocols',
  'availabilityOfOffersFromPotential',
  'countOffersFromPotential',
  'offerId',
  'opportunityId',
  'kfulOpportunityId',
];

const shuffleArray = <T,>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const INITIAL_COLUMN_ORDER = shuffleArray([...TABLE_CONFIG.map((col) => col.name)]);

const OverlayStory = (args: { withReset?: boolean }) => {
  const [hiddenColumnNames, setHiddenColumnNames] = useState<string[]>([...DEFAULT_HIDDEN_COLUMNS]);
  const [columnOrder, setColumnOrder] = useState<string[]>([...INITIAL_COLUMN_ORDER]);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);

  const mockColumns = useMemo<CheckboxTableItem[]>(() => {
    const columnMap = new Map(TABLE_CONFIG.map((col) => [col.name, col]));
    return columnOrder.map((name) => {
      const col = columnMap.get(name);
      if (!col) return { label: name, checked: true };
      return {
        label: col.title,
        checked: !hiddenColumnNames.includes(name),
        disabled: false,
      };
    });
  }, [columnOrder, hiddenColumnNames]);

  const handleCancel = () => setIsOverlayVisible(false);
  const handleSave = () => setIsOverlayVisible(false);

  const handleReset = () => {
    setHiddenColumnNames([...DEFAULT_HIDDEN_COLUMNS]);
    setColumnOrder([...DEFAULT_COLUMN_ORDER]);
  };

  const handleToggleAll = () => {
    const allHidden = hiddenColumnNames.length === TABLE_CONFIG.length;
    const newHidden = allHidden ? [] : TABLE_CONFIG.map((c) => c.name);
    setHiddenColumnNames(newHidden);
  };

  const handleToggle = (label: string) => {
    const column = TABLE_CONFIG.find((col) => col.title === label);
    if (!column) return;

    setHiddenColumnNames((prev) =>
      prev.includes(column.name) ? prev.filter((name) => name !== column.name) : [...prev, column.name],
    );
  };

  return (
    <div style={{ padding: 20, maxWidth: 500 }}>
      <ColumnVisibilityManagerContext.Provider
        value={{
          isOverlayVisible,
          hiddenColumnNames,
          actualHiddenColumnNames: DEFAULT_HIDDEN_COLUMNS,
          onCancelVisibilityChanges: handleCancel,
          onSaveVisibilityChanges: handleSave,
          onResetTableSettings: args.withReset ? handleReset : undefined,
          onToggleAllVisibility: handleToggleAll,
          onToggle: handleToggle,
          openVisibilitySettings: () => setIsOverlayVisible(true),
          setHiddenColumnNames,
        }}
      >
        <Overlay visible={true} target={document.body} onHide={() => {}}>
          {mockColumns as unknown as React.ReactNode}
        </Overlay>
      </ColumnVisibilityManagerContext.Provider>
    </div>
  );
};

const meta: Meta<typeof OverlayStory> = {
  title: 'Organisms/Tables/ColumnVisibility/Overlay',
  component: OverlayStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    withReset: {
      control: 'boolean',
      description: 'Показывать кнопку сброса настроек',
      defaultValue: true,
    },
  },
};

export default meta;

const Template: StoryFn<typeof OverlayStory> = (args) => <OverlayStory {...args} />;

export const Default = Template.bind({});
Default.args = {
  withReset: true,
};

export const WithoutResetButton = Template.bind({});
WithoutResetButton.args = {
  withReset: false,
};
