import React, { memo, useCallback, useEffect, useRef, useState } from 'react';

import { Grid, Tab } from '@/components/atoms';
import { TabsGroup } from '@/components/molecules/Tabs';

import { FieldValues, FormHandler, FormWarnings } from '../../molecules/Inputs';

import { FormCompartmentAnchorView } from './components/FormCompartmentAnchorView';
import { FormNoTabView } from './components/FormNoTabView';
import { FormTabView } from './components/FormTabView';
import { constructorRootSx, getRootSx, getTabsSx } from './FormConstructor.styles';
import { FormConstructorProps } from './FormConstructor.types';
import { countFilterFormValuesByTabs } from './FormConstructor.utils';

export const FormConstructorComponent = <FormType extends FieldValues>({
  formTemplate,
  methods,
  onSubmit,
  formId,
  fromViewType,
  dictionaries,
  formWarnings,
  headerSection,
}: FormConstructorProps<FormType>) => {
  const dataTestId = 'FormConstructorRoot';

  const { forms, maxHeight, minHeight, viewType, fieldsSpacing, fieldsAlignItems } = formTemplate;
  const hasAnchors = viewType === 'anchors';
  const hasTabs = viewType === 'tab' || hasAnchors;

  const tabMap = useRef(new Map());
  const [currentTab, setCurrentTab] = useState(() => {
    return formTemplate.forms[0]?.tabKey;
  });
  const [tabCounterMap, setTabCounterMap] = useState<{ [id: string]: number }>(
    countFilterFormValuesByTabs<FormType>(formTemplate, methods.watch()),
  );

  const tabHandler = useCallback(
    (_event: React.ChangeEvent<any>, value: string) => {
      if (hasAnchors) {
        const item = tabMap.current.get(value);
        if (item) {
          item.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }
      setCurrentTab(value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasAnchors, tabMap.current],
  );

  useEffect(() => {
    const subscription = methods.watch((value) =>
      setTabCounterMap(countFilterFormValuesByTabs<FormType>(formTemplate, value)),
    );
    return () => subscription.unsubscribe();
  }, [methods, formTemplate]);

  let formBody: JSX.Element;
  switch (viewType) {
    case 'anchors':
    case 'no-tab-headers':
      formBody = (
        <Grid>
          {headerSection}
          <FormCompartmentAnchorView
            forms={forms}
            tabMap={tabMap}
            fromViewType={fromViewType}
            spacing={fieldsSpacing}
            dictionaries={dictionaries}
            alignItems={fieldsAlignItems}
          />
        </Grid>
      );
      break;
    case 'tab':
      formBody = (
        <Grid>
          {headerSection}
          <FormTabView
            forms={forms}
            currentTab={currentTab}
            fromViewType={fromViewType}
            spacing={fieldsSpacing}
            dictionaries={dictionaries}
            alignItems={fieldsAlignItems}
          />
        </Grid>
      );
      break;
    case 'no-tab':
    default:
      formBody = (
        <Grid>
          {headerSection}
          <FormNoTabView
            forms={forms}
            fromViewType={fromViewType}
            spacing={fieldsSpacing}
            dictionaries={dictionaries}
            alignItems={fieldsAlignItems}
          />
        </Grid>
      );
  }

  return (
    <Grid container sx={constructorRootSx} dataTestId={dataTestId}>
      {hasTabs ? (
        <Grid item xs={4} sx={getTabsSx(minHeight, maxHeight)} dataTestId={`${dataTestId}__tabs`}>
          <TabsGroup value={currentTab} onChange={tabHandler} dataTestId={formId} orientation={'vertical'}>
            {forms.map((it) => (
              <Tab
                dataTestId={it.tabKey}
                key={it.tabKey}
                label={it.tabName}
                value={it.tabKey}
                orientation={'vertical'}
                iconValue={tabCounterMap[it.tabKey] > 0 ? tabCounterMap[it.tabKey] : undefined}
                disabled={it.disabled}
              />
            ))}
          </TabsGroup>
        </Grid>
      ) : null}
      <Grid item xs={hasTabs ? 8 : 12} sx={getRootSx(hasTabs, minHeight, maxHeight)} dataTestId={`${dataTestId}__body`}>
        <FormHandler formId={formId} dataTestId={formId} methods={methods} onSubmit={onSubmit}>
          {formWarnings ? <FormWarnings {...formWarnings}>{formBody}</FormWarnings> : formBody}
        </FormHandler>
      </Grid>
    </Grid>
  );
};

const FormConstructorUntyped = memo(FormConstructorComponent);
FormConstructorUntyped.displayName = 'FormConstructor';

export const FormConstructor = FormConstructorUntyped as typeof FormConstructorComponent;
