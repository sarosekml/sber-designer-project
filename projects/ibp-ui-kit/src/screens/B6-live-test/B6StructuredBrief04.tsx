import React from 'react';
import { Box } from '@mui/material';
import { Text, Title, Icon, IconButton, Divider, Button, Paper } from '@/components/atoms';
import { BreadCrumbs } from '@/components/molecules';
import { Tile } from '@/components/molecules/Tiles/Tile';

const noop = () => {};

const breadcrumbs = [
  { name: 'Главная', route: '/' },
  { name: 'Платежи', route: '/payments' },
  { name: 'Платёж № 2025-089', route: '' },
];

const client = {
  name: 'ООО «ТехПромСнаб»',
  inn: '7729012345',
  kpp: '772901001',
  ogrn: '1207700123456',
  address: 'г. Москва, ул. Ленинская Слобода, д. 19, этаж 5, офис 501',
  phone: '+7 (495) 123-45-67',
  email: 'finance@techpromsnab.ru',
};

const payment = {
  number: '2025-089',
  date: '30.07.2025',
  amount: '4 250 000,00 ₽',
  currency: 'RUB',
  dueDate: '28.08.2025',
  bank: 'ПАО «Сбербанк»',
  bik: '044525225',
  account: '40702810400000123456',
  corrAccount: '30101810400000000225',
  recipient: 'ООО «ТехПромСнаб»',
  recipientInn: '7729012345',
  contract: 'Договор поставки № ТП-2025/0471 от 15.05.2025',
  purpose: 'Оплата поставленного оборудования по Спецификации № 3 от 20.07.2025',
  priority: 'Срочно',
};

const documents = [
  { name: 'Счёт на оплату № 347 от 22.07.2025', icon: 'File' as const, date: '22.07.2025', size: '245 КБ' },
  { name: 'Счёт-фактура № 348 от 22.07.2025', icon: 'File' as const, date: '22.07.2025', size: '312 КБ' },
  { name: 'Спецификация № 3 от 20.07.2025', icon: 'File' as const, date: '20.07.2025', size: '1,2 МБ' },
];

const labelSx = { minWidth: 200 };
const fieldGridSx = { display: 'grid', gridTemplateColumns: '200px 1fr', rowGap: 1.5 };

export function B6StructuredBrief04() {
  return (
    <main data-sd-screen-root="true" aria-label="Платёж № 2025-089">
      {/* Breadcrumbs */}
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <BreadCrumbs
          navigationSchema={breadcrumbs}
          onClickLink={noop}
          dataTestId="PaymentBreadcrumbs"
        />
      </Box>

      {/* Page header */}
      <Box sx={{ px: 3, pb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Icon name="CashFlow" size="lg" color="primary" />
        <Title type="title" style={{ margin: 0 }}>
          Платёж № {payment.number}
        </Title>
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          <Button type="outlined" size="sm" startIcon="Edit" onClick={noop}>
            Редактировать
          </Button>
          <Button type="accent" size="sm" onClick={noop}>Исполнить</Button>
        </Box>
      </Box>

      {/* Compact summary strip */}
      <Box sx={{ px: 3, pb: 3 }}>
        <Paper sx={{ p: 2.5, display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'stretch' }}>
          {/* Amount — prominent */}
          <Box sx={{ flex: '1 1 auto', minWidth: 170, px: 2 }}>
            <Text type="BodyMReg" color="secondary">Сумма платежа</Text>
            <Title type="subTitle" style={{ margin: 0, fontWeight: 700, fontSize: 22 }}>
              {payment.amount}
            </Title>
          </Box>
          <Divider orientation="vertical" flexItem />
          {/* Date + Due date */}
          <Box sx={{ flex: '1 1 auto', minWidth: 140, px: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box>
              <Text type="BodyMReg" color="secondary">Дата создания</Text>
              <Text type="BodyMReg" style={{ fontWeight: 500 }}>{payment.date}</Text>
            </Box>
            <Box>
              <Text type="BodyMReg" color="secondary">Срок оплаты</Text>
              <Text type="BodyMReg" style={{ fontWeight: 500 }}>{payment.dueDate}</Text>
            </Box>
          </Box>
          <Divider orientation="vertical" flexItem />
          {/* Priority */}
          <Box sx={{ flex: '1 1 auto', minWidth: 100, px: 2 }}>
            <Text type="BodyMReg" color="secondary">Приоритет</Text>
            <Text type="BodyMReg" color="error" style={{ fontWeight: 600 }}>{payment.priority}</Text>
          </Box>
          <Divider orientation="vertical" flexItem />
          {/* Bank */}
          <Box sx={{ flex: '1 1 auto', minWidth: 200, px: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box>
              <Text type="BodyMReg" color="secondary">Банк</Text>
              <Text type="BodyMReg" style={{ fontWeight: 500 }}>{payment.bank}</Text>
            </Box>
            <Box>
              <Text type="BodyMReg" color="secondary">БИК</Text>
              <Text type="BodyMReg">{payment.bik}</Text>
            </Box>
          </Box>
          <Divider orientation="vertical" flexItem />
          {/* Recipient */}
          <Box sx={{ flex: '1 1 auto', minWidth: 170, px: 2 }}>
            <Text type="BodyMReg" color="secondary">Получатель</Text>
            <Text type="BodyMReg" style={{ fontWeight: 500 }}>{payment.recipient}</Text>
            <Text type="BodyMReg" color="secondary" style={{ fontSize: 12 }}>ИНН {payment.recipientInn}</Text>
          </Box>
        </Paper>
      </Box>

      {/* Two-column workspace */}
      <Box sx={{ px: 3, pb: 3, display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
        {/* Left column — Payment parameters */}
        <Box sx={{ flex: '3 1 0%', minWidth: 0 }}>
          <Tile
            title="Параметры платежа"
            size="md"
            dataTestId="tile-payment"
            actions={<IconButton name="Edit" size="sm" onClick={noop} title="Редактировать" />}
          >
            <Box sx={{ px: 1, pb: 0.5 }}>
              {/* Основные параметры */}
              <Text type="BodyMReg" style={{ fontWeight: 600, marginBottom: 8 }}>
                Основные параметры
              </Text>
              <Box sx={fieldGridSx}>
                <Text type="BodyMReg" color="secondary">Номер платежа</Text>
                <Text type="BodyMReg" style={{ fontWeight: 500 }}>№ {payment.number} от {payment.date}</Text>
                <Text type="BodyMReg" color="secondary">Сумма</Text>
                <Text type="BodyMReg" style={{ fontWeight: 600, fontSize: 16 }}>{payment.amount}</Text>
                <Text type="BodyMReg" color="secondary">Срок оплаты</Text>
                <Text type="BodyMReg">{payment.dueDate}</Text>
                <Text type="BodyMReg" color="secondary">Приоритет</Text>
                <Text type="BodyMReg" style={{ fontWeight: 600 }}>{payment.priority}</Text>
              </Box>

              <Box sx={{ my: 2.5 }}>
                <Divider orientation="horizontal" flexItem />
              </Box>

              {/* Банковские реквизиты */}
              <Text type="BodyMReg" style={{ fontWeight: 600, marginBottom: 8 }}>
                Банковские реквизиты
              </Text>
              <Box sx={fieldGridSx}>
                <Text type="BodyMReg" color="secondary">Банк</Text>
                <Text type="BodyMReg">{payment.bank}</Text>
                <Text type="BodyMReg" color="secondary">БИК</Text>
                <Text type="BodyMReg">{payment.bik}</Text>
                <Text type="BodyMReg" color="secondary">Расчётный счёт</Text>
                <Text type="BodyMReg">{payment.account}</Text>
                <Text type="BodyMReg" color="secondary">Корреспондентский счёт</Text>
                <Text type="BodyMReg">{payment.corrAccount}</Text>
              </Box>

              <Box sx={{ my: 2.5 }}>
                <Divider orientation="horizontal" flexItem />
              </Box>

              {/* Получатель и основание */}
              <Text type="BodyMReg" style={{ fontWeight: 600, marginBottom: 8 }}>
                Получатель и основание
              </Text>
              <Box sx={fieldGridSx}>
                <Text type="BodyMReg" color="secondary">Получатель</Text>
                <Text type="BodyMReg">{payment.recipient}</Text>
                <Text type="BodyMReg" color="secondary">ИНН получателя</Text>
                <Text type="BodyMReg">{payment.recipientInn}</Text>
                <Text type="BodyMReg" color="secondary">Договор</Text>
                <Text type="BodyMReg">{payment.contract}</Text>
                <Text type="BodyMReg" color="secondary">Назначение платежа</Text>
                <Text type="BodyMReg">{payment.purpose}</Text>
              </Box>
            </Box>
          </Tile>
        </Box>

        {/* Right column — Client + Documents */}
        <Box sx={{ flex: '2 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Client */}
          <Tile
            title="Клиент (контрагент)"
            size="md"
            dataTestId="tile-client"
            actions={<IconButton name="Edit" size="sm" onClick={noop} title="Редактировать" />}
          >
            <Box sx={{ px: 1, pb: 0.5 }}>
              <Text type="BodyMReg" style={{ fontWeight: 600 }}>{client.name}</Text>
              <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 1.5 }}>
                <Text type="BodyMReg" color="secondary">ИНН</Text>
                <Text type="BodyMReg">{client.inn}</Text>
                <Text type="BodyMReg" color="secondary">КПП</Text>
                <Text type="BodyMReg">{client.kpp}</Text>
                <Text type="BodyMReg" color="secondary">ОГРН</Text>
                <Text type="BodyMReg">{client.ogrn}</Text>
                <Text type="BodyMReg" color="secondary">Адрес</Text>
                <Text type="BodyMReg">{client.address}</Text>
                <Text type="BodyMReg" color="secondary">Телефон</Text>
                <Text type="BodyMReg">{client.phone}</Text>
                <Text type="BodyMReg" color="secondary">Email</Text>
                <Text type="BodyMReg">{client.email}</Text>
              </Box>
            </Box>
          </Tile>

          {/* Documents */}
          <Tile
            title="Приложенные документы"
            size="md"
            dataTestId="tile-documents"
          >
            <Box sx={{ px: 1, pb: 0.5 }}>
              {documents.map((doc, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <Box sx={{ my: 1.5 }}>
                      <Divider orientation="horizontal" flexItem />
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Icon name={doc.icon} size="md" color="action" />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Text type="BodyMReg" style={{ lineHeight: 1.3 }}>{doc.name}</Text>
                      <Text type="BodyMReg" color="secondary" style={{ fontSize: 12 }}>
                        {doc.date} · {doc.size}
                      </Text>
                    </Box>
                    <IconButton name="Download" size="sm" onClick={noop} title="Скачать" />
                  </Box>
                </React.Fragment>
              ))}
            </Box>
          </Tile>
        </Box>
      </Box>
    </main>
  );
}