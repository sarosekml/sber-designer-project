import React, { useState, useCallback } from 'react';
import { BreadCrumbs } from '../../components/molecules/BreadCrumbs/BreadCrumbs';
import { TabsGroup } from '../../components/molecules/Tabs/TabsGroup/TabsGroup';
import { Tab } from '../../components/atoms/Tab/Tab';
import { Entity } from '../../components/molecules/Entity/Entity';
import { DashboardGroupHeader } from '../../components/atoms/Header/DashboardGroupHeader/DashboardGroupHeader';
import { Tile } from '../../components/molecules/Tiles/Tile/Tile';
import { Text } from '../../components/atoms/typography/Text/Text';

const TABS = [
  'Общая информация',
  'Сделки',
  'Финансовые показатели',
  'Цели',
  'Кредиты',
  'Cash Flow',
];

const noop = () => {};

export function ClientInfoPageTest01() {
  const [activeTab, setActiveTab] = useState('0');
  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
  }, []);

  return (
    <main
      data-sd-screen-root="true"
      aria-label="Client Info Page"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f5f7f7 0%, #f2f7f7 100%)',
        padding: '24px 32px',
      }}
    >
      <BreadCrumbs
        dataTestId="ClientInfoBreadcrumbs"
        navigationSchema={[
          { name: 'Clients', route: '/clients' },
          { name: 'Corporate', route: '/clients/corporate' },
          { name: 'ООО «СеверПром Металлургия»', route: '' },
        ]}
        onClickLink={noop}
      />

      <Entity
        dataTestId="ClientEntity"
        avatar={{ variant: 'rounded', icon: 'СМ' }}
        header="ООО «СеверПром Металлургия»"
        text="ИНН 7700000001 · ОГРН 1027700000001"
      />

      <div style={{ marginTop: 24 }}>
        <TabsGroup value={activeTab} onChange={handleTabChange} dataTestId="ClientTabs">
          {TABS.map((label, i) => (
            <Tab key={i} label={label} value={String(i)} />
          ))}
        </TabsGroup>
      </div>

      <div style={{ marginTop: 24 }}>
        <DashboardGroupHeader dataTestId="GigaSpravkaHeader">
          GigaSpravka
        </DashboardGroupHeader>
        <Tile title="GigaSpravka" sx={{ marginTop: '12px' }}>
          <Text>
            General client information from GigaSpravka: industry, region, financial
            indicators, connections, and reputation.
          </Text>
        </Tile>
      </div>
    </main>
  );
}