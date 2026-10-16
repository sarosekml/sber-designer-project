import { expect, test } from 'bun:test';

import { modalSizeFieldErrors, modalSizePatchFromForm } from './modal-size-form';

const committed = { width: '640px', height: 'auto', longContent: 'scroll' as const };

test('field errors flag invalid width/height but ignore blanks', () => {
  expect(modalSizeFieldErrors({ width: '', height: '' })).toEqual({ width: false, height: false });
  expect(modalSizeFieldErrors({ width: '300px', height: 'auto' })).toEqual({
    width: false,
    height: false,
  });
  expect(modalSizeFieldErrors({ width: 'calc(1px)', height: 'nope' })).toEqual({
    width: true,
    height: true,
  });
});

test('patch includes only changed, valid fields', () => {
  expect(
    modalSizePatchFromForm(committed, { width: '300px', height: 'auto', longContent: 'scroll' }),
  ).toEqual({ width: '300px' });
  expect(
    modalSizePatchFromForm(committed, { width: '640px', height: 'auto', longContent: 'grow' }),
  ).toEqual({ longContent: 'grow' });
});

test('an unchanged or all-invalid draft yields no patch', () => {
  expect(
    modalSizePatchFromForm(committed, { width: '640px', height: 'auto', longContent: 'scroll' }),
  ).toBeNull();
  expect(
    modalSizePatchFromForm(committed, { width: 'calc(1px)', height: '', longContent: 'scroll' }),
  ).toBeNull();
});

test('blank fields do not overwrite committed values', () => {
  expect(
    modalSizePatchFromForm(committed, { width: '', height: '', longContent: 'scroll' }),
  ).toBeNull();
});
