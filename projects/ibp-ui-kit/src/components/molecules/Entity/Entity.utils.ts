import { EntitySize } from './Entity.types';

export const getMainTextSize = (size?: EntitySize) => {
  return size === 'xl' ? 'H4StrongSmb' : 'BodyMReg';
};

export const getSubTextSize = (size?: EntitySize) => {
  return size === 'xl' ? 'BodySReg' : 'BodyXSReg';
};
