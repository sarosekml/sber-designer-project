import { getDataTestId } from './getDataTestId';

it('tests getDataTestId', () => {
  expect(getDataTestId('Some', 'Component')).toEqual('Some_Component');
  expect(getDataTestId('Some', 'Component', 'Subcomponent')).toEqual('Some_Component_Subcomponent');
  expect(getDataTestId('Some', undefined)).toEqual('Some');
  expect(getDataTestId(undefined, 'Component', 'Subcomponent')).toEqual('Component_Subcomponent');
  expect(getDataTestId(undefined, undefined)).toEqual(undefined);
  expect(getDataTestId(undefined, 'Component', 1)).toEqual('Component_1');
  expect(getDataTestId('Component', 1)).toEqual('Component_1');
});
