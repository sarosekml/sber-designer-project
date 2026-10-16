import { mGrey } from '@/styles/colors';
import { Sx } from '@/utils';

export const colorListStyles: Record<'card' | 'root' | 'hex' | 'cardHeader' | 'colorImg' | 'textColumn', Sx> = {
  textColumn: { display: 'flex', flexDirection: 'column', gap: '5px' },
  card: {
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${mGrey[200]}`,
    paddingBottom: '20px',
  },
  root: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 20px 4px 25px',
    gap: '12px',
  },
  hex: {
    weight: '400',
    color: mGrey[300],
  },
  cardHeader: {
    fontSize: '20px',
    borderBottom: `1px solid ${mGrey[300]}`,
    width: '100%',
    padding: '16px 0px 17px 28px',
    fontWeight: '500',
    marginBottom: '14px',
  },
  colorImg: {
    width: '48px',
    height: '48px',
    borderRadius: '4px',
    border: `1px solid ${mGrey[200]}`,
  },
};
