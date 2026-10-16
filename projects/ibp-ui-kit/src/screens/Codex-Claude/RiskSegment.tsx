import React from 'react';
import {
  Box,
  Breadcrumbs,
  Divider,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';

interface RiskSegment {
  code: string;
  name: string;
  profile: string;
  ckpCode: string;
}

const riskSegments: RiskSegment[] = [
  {
    code: 'GOVERNMENT_RF',
    name: 'Правительство (РФ)',
    profile: 'Непроектный',
    ckpCode: 'Правительство (РФ)',
  },
  {
    code: 'GOVERNMENT_SBER',
    name: 'Правительство (страна присутствия дочерних банков ПАО Сбербанк)',
    profile: 'Непроектный',
    ckpCode: 'Правительство (ДБ)',
  },
  {
    code: 'GOVERNMENT_OTHER',
    name: 'Правительство (прочие страны)',
    profile: 'Непроектный',
    ckpCode: 'Правительство (пр страны)',
  },
  {
    code: 'CENTRAL_BANK_RF',
    name: 'Центральный банк (РФ)',
    profile: 'Непроектный',
    ckpCode: 'Центральный банк (РФ)',
  },
  {
    code: 'CENTRAL_BANK_SBER',
    name: 'Центр. банк (стр. присутствия доч. банков ПАО Сбербанк)',
    profile: 'Непроектный',
    ckpCode: 'Центральный банк (ДБ)',
  },
  {
    code: 'CENTRAL_BANK_OTHER',
    name: 'Центральный банк (прочие страны)',
    profile: 'Непроектный',
    ckpCode: 'Центральный банк (пр страны)',
  },
  {
    code: 'ASSET_GROUP_WITH_RISK',
    name: 'Международный финансовый институт НЕ относящийся к группе активов с риском 0%',
    profile: 'Непроектный',
    ckpCode: 'Межд фин инст НЕ отн к активам',
  },
  {
    code: 'ASSET_GROUP_WITHOUT_RISK',
    name: 'Международный финансовый институт относящийся к группе активов с риском 0%',
    profile: 'Непроектный',
    ckpCode: 'Межд фин инст отн к активам',
  },
  {
    code: 'FIN_PROJECT',
    name: 'Проектное финансирование',
    profile: 'Проектный',
    ckpCode: 'FIN_PROJECT',
  },
  {
    code: 'NATIONAL_DEVELOP_BANK',
    name: 'Национальный банк развития',
    profile: 'Непроектный',
    ckpCode: 'Национальный банк развития',
  },
  {
    code: 'BANK_OR_CREDIT_ORG',
    name: 'Банк, кредитно-депозитная небанковская кредитная организация',
    profile: 'Непроектный',
    ckpCode: 'Банк, кредитная организация',
  },
  {
    code: 'BANK_SBER',
    name: 'Дочерний банк Сбербанка',
    profile: 'Непроектный',
    ckpCode: 'Дочерний банк Сбербанка',
  },
  {
    code: 'LEASING_SBER',
    name: 'Дочерняя лизинговая компания ПАО Сбербанк',
    profile: 'Непроектный',
    ckpCode: 'Сбербанк-Лизинг',
  },
  {
    code: 'PAYMENT_CLEARING_ORG',
    name: 'Центральный платёжный клиринговый контрагент',
    profile: 'Непроектный',
    ckpCode: 'Центр. плат. кл. контр.',
  },
  {
    code: 'BROKER_INVEST_COMPANY',
    name: 'Брокер, дилер, инвестиционная компания',
    profile: 'Непроектный',
    ckpCode: 'Брокер, дилер, инвест комп',
  },
  {
    code: 'MANAGEMENT_COMPANY_TRUST',
    name: 'Управляющая компания (доверительное управление)',
    profile: 'Непроектный',
    ckpCode: 'Управляющая компания',
  },
  {
    code: 'FUND',
    name: 'Фонд',
    profile: 'Непроектный',
    ckpCode: 'Фонд',
  },
  {
    code: 'MANAGEMENT_COMPANY_FUND',
    name: 'Управл. компания Фонда прямых инвестиций, мезонинного фонда',
    profile: 'Непроектный',
    ckpCode: 'Управл. комп. ФПИ, МФ',
  },
];

const columns = [
  { id: 'code', label: 'Код риск-сегмента', width: '19%' },
  { id: 'name', label: 'Наименование риск-сегмента', width: '43%' },
  { id: 'profile', label: 'Риск-профиль', width: '19%' },
  { id: 'ckpCode', label: 'Код ЦКП', width: '19%' },
];

const navItems = [
  { label: 'Главная', icon: <HomeOutlinedIcon /> },
  { label: 'Администрирование', icon: <SettingsOutlinedIcon />, active: true },
  { label: 'Настройки', icon: <TuneOutlinedIcon /> },
];

export function RiskSegment() {
  return (
    <Box
      component="main"
      data-sd-screen-root="true"
      aria-label="Риск-сегмент"
      sx={{
        minHeight: '100vh',
        backgroundColor: '#F4F8F8',
        color: '#293537',
        display: 'flex',
        fontFamily: 'SB Sans Text, Arial, sans-serif',
      }}
    >
      <Box
        component="aside"
        data-sd-section="left-navigation"
        aria-label="Основная навигация"
        sx={{
          width: 56,
          flex: '0 0 56px',
          minHeight: '100vh',
          backgroundColor: '#F8FBFB',
          borderRight: '1px solid #EEF3F3',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 1.75,
        }}
      >
        <IconButton aria-label="Открыть меню" size="small" sx={{ color: '#A6C3C1', mb: 3.5 }}>
          <MenuIcon fontSize="small" />
        </IconButton>

        <Stack spacing={2.5} alignItems="center" sx={{ width: '100%' }}>
          {navItems.map((item) => (
            <IconButton
              key={item.label}
              aria-label={item.label}
              size="small"
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1.75,
                color: item.active ? '#2F9089' : '#AEC9C7',
                backgroundColor: item.active ? '#E7F2F1' : 'transparent',
                '&:hover': { backgroundColor: item.active ? '#E7F2F1' : '#EEF6F5' },
              }}
            >
              {React.cloneElement(item.icon, { fontSize: 'small' })}
            </IconButton>
          ))}
        </Stack>

        <Box
          sx={{
            mt: 'auto',
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: '#E8F0EF',
            color: '#8CA5A3',
            display: 'grid',
            placeItems: 'center',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          ИБ
        </Box>
      </Box>

      <Box
        data-sd-section="risk-segment-page"
        sx={{
          flex: 1,
          minWidth: 0,
          px: { xs: 2, md: 3 },
          pt: 2.25,
          pb: 2.5,
        }}
      >
        <Stack spacing={1.75} sx={{ minWidth: 0 }}>
          <Breadcrumbs
            aria-label="Хлебные крошки"
            separator="/"
            sx={{
              color: '#7C8A8C',
              fontSize: 14,
              lineHeight: '20px',
              '& .MuiBreadcrumbs-separator': { mx: 1, color: '#A7B2B4' },
            }}
          >
            <Link underline="none" color="inherit" href="#">
              Главная
            </Link>
            <Link underline="none" color="inherit" href="#">
              Администрирование
            </Link>
            <Typography component="span" sx={{ color: '#293537', fontSize: 14, fontWeight: 600 }}>
              Риск-сегмент
            </Typography>
          </Breadcrumbs>

          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontSize: 30,
              lineHeight: '36px',
              fontWeight: 800,
              letterSpacing: 0,
              color: '#1F292B',
            }}
          >
            Риск-сегмент
          </Typography>

          <Paper
            data-sd-section="risk-segment-table-panel"
            elevation={0}
            sx={{
              borderRadius: 1.5,
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
              boxShadow: 'none',
            }}
          >
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table aria-label="Справочник риск-сегментов" sx={{ minWidth: 1180, tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow>
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        sx={{
                          width: column.width,
                          height: 48,
                          px: 2,
                          py: 0,
                          borderBottom: '1px solid #C7D1D1',
                          color: '#7E8C8E',
                          fontSize: 14,
                          fontWeight: 500,
                          lineHeight: '20px',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        {column.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {riskSegments.map((segment) => (
                    <TableRow
                      key={segment.code}
                      hover
                      sx={{
                        height: 48,
                        '&:last-of-type td': { borderBottomColor: '#C7D1D1' },
                        '&:hover td': { backgroundColor: '#F8FBFB' },
                      }}
                    >
                      <TableCell sx={bodyCellSx}>{segment.code}</TableCell>
                      <TableCell sx={bodyCellSx}>{segment.name}</TableCell>
                      <TableCell sx={bodyCellSx}>{segment.profile}</TableCell>
                      <TableCell sx={bodyCellSx}>{segment.ckpCode}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ borderColor: '#D5DDDD' }} />

            <Stack
              data-sd-section="risk-segment-pagination"
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="flex-end"
              spacing={3}
              sx={{
                minHeight: 48,
                px: 2,
                py: { xs: 1.25, md: 0 },
                backgroundColor: '#FFFFFF',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography sx={{ color: '#4E5D5F', fontSize: 15 }}>Показывать строк:</Typography>
                <Select
                  aria-label="Количество строк"
                  variant="standard"
                  value={50}
                  disableUnderline
                  onChange={() => undefined}
                  sx={{
                    minWidth: 42,
                    color: '#4E5D5F',
                    fontSize: 15,
                    '& .MuiSelect-select': { py: 0 },
                  }}
                >
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </Stack>

              <Typography sx={{ color: '#4E5D5F', fontSize: 15 }}>1 из 5</Typography>

              <Stack direction="row" alignItems="center" spacing={0.75}>
                <IconButton aria-label="Предыдущая страница" size="small" sx={paginationIconSx}>
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
                {[1, 2, 3, 4, 5].map((page) => (
                  <Box
                    key={page}
                    component="button"
                    aria-current={page === 1 ? 'page' : undefined}
                    sx={{
                      width: 24,
                      height: 24,
                      border: 0,
                      borderRadius: '50%',
                      backgroundColor: 'transparent',
                      color: page === 1 ? '#215B56' : '#344244',
                      fontSize: 16,
                      fontWeight: page === 1 ? 800 : 500,
                      lineHeight: '24px',
                      p: 0,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {page}
                  </Box>
                ))}
                <IconButton aria-label="Следующая страница" size="small" sx={paginationIconSx}>
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}

const bodyCellSx = {
  height: 48,
  px: 2,
  py: 0,
  borderBottom: '1px solid #E4EAEA',
  color: '#344244',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const paginationIconSx = {
  width: 28,
  height: 28,
  color: '#AFC5C3',
};
