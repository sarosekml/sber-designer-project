import React from 'react';
import {
  Box,
  Breadcrumbs,
  Button as MuiButton,
  Chip,
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

import { Button as KitButton } from '../../components/atoms/buttons/Button';

type Direction = 'incoming' | 'outgoing';

type PaymentStatus = 'expected' | 'processing' | 'paid' | 'partial' | 'issue';

interface Payment {
  id: string;
  date: string;
  amount: number;
  vat: number;
  amountWithoutVat: number;
  direction: Direction;
  status: PaymentStatus;
  counterparty: string;
  inn: string;
  purpose: string;
}

const payments: Payment[] = [
  {
    id: 'pay-001',
    date: '14.06.2024',
    amount: 18500000,
    vat: 3083333.33,
    amountWithoutVat: 15416666.67,
    direction: 'incoming',
    status: 'expected',
    counterparty: 'ООО "Ромашка"',
    inn: '7708123456',
    purpose: 'Услуги организатора по соглашению N 456321',
  },
  {
    id: 'pay-002',
    date: '28.06.2024',
    amount: 12400000,
    vat: 2066666.67,
    amountWithoutVat: 10333333.33,
    direction: 'incoming',
    status: 'paid',
    counterparty: 'АО "Северный актив"',
    inn: '7812123456',
    purpose: 'Поступление вознаграждения за сопровождение сделки',
  },
  {
    id: 'pay-003',
    date: '03.07.2024',
    amount: 7200000,
    vat: 1200000,
    amountWithoutVat: 6000000,
    direction: 'outgoing',
    status: 'processing',
    counterparty: 'ООО "Правовой центр"',
    inn: '9715123456',
    purpose: 'Оплата консультационных услуг по due diligence',
  },
  {
    id: 'pay-004',
    date: '12.07.2024',
    amount: 4150000,
    vat: 691666.67,
    amountWithoutVat: 3458333.33,
    direction: 'outgoing',
    status: 'partial',
    counterparty: 'ПАО "Инфраструктура"',
    inn: '7704556677',
    purpose: 'Частичная оплата расходов на подготовку акта сверки',
  },
  {
    id: 'pay-005',
    date: '22.07.2024',
    amount: 980000,
    vat: 163333.33,
    amountWithoutVat: 816666.67,
    direction: 'incoming',
    status: 'issue',
    counterparty: 'ООО "Финансовый партнер"',
    inn: '503812345678',
    purpose: 'Корректировка платежа: требуется проверка назначения и ИНН плательщика',
  },
];

const directionLabels: Record<Direction, string> = {
  incoming: 'Входящий',
  outgoing: 'Исходящий',
};

const statusLabels: Record<PaymentStatus, string> = {
  expected: 'Ожидаемый',
  processing: 'В обработке',
  paid: 'Оплачен',
  partial: 'Частично оплачен',
  issue: 'С замечанием',
};

const statusStyles: Record<PaymentStatus, { backgroundColor: string; color: string }> = {
  expected: { backgroundColor: '#EEF4FF', color: '#1D4ED8' },
  processing: { backgroundColor: '#FFF7E6', color: '#B45309' },
  paid: { backgroundColor: '#EAF7EE', color: '#17803D' },
  partial: { backgroundColor: '#F0F0FF', color: '#5145CD' },
  issue: { backgroundColor: '#FFF1F2', color: '#BE123C' },
};

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const totals = payments.reduce(
  (acc, payment) => ({
    amount: acc.amount + payment.amount,
    vat: acc.vat + payment.vat,
    amountWithoutVat: acc.amountWithoutVat + payment.amountWithoutVat,
  }),
  { amount: 0, vat: 0, amountWithoutVat: 0 },
);

const summaryItems = [
  { label: 'Сумма', value: totals.amount },
  { label: 'НДС', value: totals.vat },
  { label: 'Сумма без НДС', value: totals.amountWithoutVat },
];

const filterChips = ['Период: июнь-июль 2024', 'Статус: все', 'Направление: все'];

const columns = [
  'Дата',
  'Сумма, руб.',
  'НДС, руб.',
  'Сумма без НДС, руб.',
  'Направление',
  'Статус',
  'Платежный контрагент',
  'ИНН плательщика',
  'Назначение платежа',
];

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function formatMillion(value: number) {
  return `${compactFormatter.format(value / 1000000)} млн руб`;
}

export function PaymentsTest01() {
  return (
    <Box
      component="main"
      data-sd-screen-root="true"
      aria-label="График платежей"
      sx={{
        minHeight: '100vh',
        backgroundColor: '#F4F6F8',
        color: '#111827',
        px: { xs: 2, md: 4 },
        py: 3,
      }}
    >
      <Stack data-sd-section="payment-schedule-page" spacing={2} sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Paper
          data-sd-section="payment-schedule-header"
          elevation={0}
          sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: { xs: 2, md: 3 } }}
        >
          <Stack spacing={2}>
            <Breadcrumbs aria-label="Навигация по сделке" sx={{ fontSize: 13 }}>
              <Link underline="hover" color="text.secondary" href="#">
                Главная
              </Link>
              <Link underline="hover" color="text.secondary" href="#">
                M&A Pipeline
              </Link>
              <Link underline="hover" color="text.secondary" href="#">
                325. Сделка от 25.04.2024
              </Link>
              <Typography color="text.primary" fontSize={13}>
                График платежей
              </Typography>
            </Breadcrumbs>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography variant="h4" component="h1" fontWeight={700}>
                  График платежей
                </Typography>
                <Typography color="text.secondary" mt={0.5}>
                  Реестр платежей по сделке 325. Сделка от 25.04.2024
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <KitButton type="outlined">В сделку</KitButton>
                <KitButton type="outlined">Данные для акта сверки</KitButton>
                <KitButton>Добавить платеж</KitButton>
              </Stack>
            </Stack>
          </Stack>
        </Paper>

        <Paper
          data-sd-section="payment-schedule-controls"
          elevation={0}
          sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 2 }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            spacing={2}
          >
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
              <KitButton type="outlined">Фильтр</KitButton>
              {filterChips.map((chip) => (
                <Chip key={chip} label={chip} size="small" sx={{ backgroundColor: '#F3F4F6' }} />
              ))}
            </Stack>

            <Typography color="text.secondary" fontSize={14}>
              Найдено 242 платежа, показаны 1-50
            </Typography>
          </Stack>
        </Paper>

        <Paper
          data-sd-section="payment-schedule-registry"
          elevation={0}
          sx={{ border: '1px solid #E5E7EB', borderRadius: 2, overflow: 'hidden' }}
        >
          <TableContainer sx={{ maxHeight: 620 }}>
            <Table stickyHeader aria-label="Реестр платежей по сделке" sx={{ minWidth: 1280 }}>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column}
                      sx={{
                        backgroundColor: '#F9FAFB',
                        color: '#4B5563',
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <span>{column}</span>
                        <Box component="span" aria-hidden="true" color="#9CA3AF">
                          ↕
                        </Box>
                      </Stack>
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ backgroundColor: '#F9FAFB', width: 48, color: '#4B5563' }}>
                    <IconButton aria-label="Настроить колонки" size="small">
                      ⋮
                    </IconButton>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} hover>
                    <TableCell>{payment.date}</TableCell>
                    <TableCell align="right">{formatMoney(payment.amount)}</TableCell>
                    <TableCell align="right">{formatMoney(payment.vat)}</TableCell>
                    <TableCell align="right">{formatMoney(payment.amountWithoutVat)}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${payment.direction === 'incoming' ? '↙' : '↗'} ${directionLabels[payment.direction]}`}
                        size="small"
                        sx={{
                          backgroundColor: payment.direction === 'incoming' ? '#EAF7EE' : '#FFF7E6',
                          color: payment.direction === 'incoming' ? '#17803D' : '#B45309',
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabels[payment.status]}
                        size="small"
                        sx={{ ...statusStyles[payment.status], fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 190 }}>{payment.counterparty}</TableCell>
                    <TableCell>{payment.inn}</TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 320,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={payment.purpose}
                    >
                      {payment.purpose}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton aria-label={`Действия по платежу ${payment.id}`} size="small">
                        ⋮
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider />

          <Stack
            data-sd-section="payment-schedule-footer"
            direction={{ xs: 'column', lg: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', lg: 'center' }}
            spacing={2}
            sx={{ p: 2 }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              {summaryItems.map((item) => (
                <Box
                  key={item.label}
                  data-sd-section="payment-total"
                  sx={{
                    minWidth: 170,
                    border: '1px solid #E5E7EB',
                    borderRadius: 1.5,
                    px: 2,
                    py: 1.25,
                    backgroundColor: '#FAFAFA',
                  }}
                >
                  <Typography color="text.secondary" fontSize={13}>
                    {item.label}
                  </Typography>
                  <Typography fontWeight={700}>{formatMillion(item.value)}</Typography>
                </Box>
              ))}
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography color="text.secondary" fontSize={14}>
                  Показывать строк:
                </Typography>
                <Select
                  size="small"
                  value={50}
                  onChange={() => undefined}
                  sx={{ width: 88, backgroundColor: '#FFFFFF' }}
                >
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </Stack>

              <Typography color="text.secondary" fontSize={14}>
                50 из 242
              </Typography>

              <Stack direction="row" alignItems="center" spacing={0.5}>
                <IconButton aria-label="Предыдущая страница" size="small">
                  ‹
                </IconButton>
                {[1, 2, 3].map((page) => (
                  <MuiButton key={page} size="small" variant={page === 1 ? 'contained' : 'text'} sx={{ minWidth: 36 }}>
                    {page}
                  </MuiButton>
                ))}
                <Typography color="text.secondary">...</Typography>
                {[14, 15, 16].map((page) => (
                  <MuiButton key={page} size="small" variant="text" sx={{ minWidth: 36 }}>
                    {page}
                  </MuiButton>
                ))}
                <IconButton aria-label="Следующая страница" size="small">
                  ›
                </IconButton>
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
