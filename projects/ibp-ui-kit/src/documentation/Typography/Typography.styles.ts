import { Theme } from '@mui/material';

export const getStyles = (theme: Theme) => ({
  card: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: theme.spacing(15),
  },
  root: {
    marginBottom: theme.spacing(6),
    flexDirection: 'column',
  },
  header: {
    fontSize: theme.spacing(3.5),
    color: '#858C91',
    padding: theme.spacing(8.5, 0, 6, 0),
  },
});
