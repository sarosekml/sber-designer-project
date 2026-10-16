# Page: DcmDraftDealPage

Repo-local eval brief distilled from the live task file
`/Users/dev/Work Dev/ibp-ui-kit/tmp/test-cases/DcmDraftDealPage.md`.
The original full-resolution screenshot is intentionally kept local.

## Route

- Path: `TBD` — proposed route:
  `/dcm-potentials/:potentialId/draft-deal/:draftDealId`
- Entry component: `DcmDraftDealPage`
- Breadcrumbs:
  `Главная / Потенциалы DCM / Черновик сделки DCM: {productType} № {dealNumber}`
- Page mode: draft deal view with edit and conversion actions.

## Purpose

DCM draft deal page for reviewing a pre-created deal draft based on a selected
credit/potential. The page shows client and holding context, current credit
terms, ratings and public issues, editable comments, and the full list of
holding potentials. The main user goal is to verify the draft and convert it
into a DCM deal using the primary action `Перевести в сделку DCM`.

## Layout

```text
Page (dataTestId="DcmDraftDealPage")
├── DraftDealHeader
│   ├── BreadCrumbs
│   ├── title: Черновик сделки DCM: Кредит № 4B02-04-01669-A-001P
│   ├── edit title IconButton
│   ├── primary Button: Перевести в сделку DCM
│   ├── more actions IconButton
│   └── updated meta: Изменено 02.07.2025, 10:04, Сергеев И.П.
└── DcmDraftDealGrid
    ├── ClientInfoTile
    ├── CreditTermsTile
    ├── HoldingInfoTile
    ├── CommentsTile
    └── HoldingPotentialsTile
```

Desktop layout is a two-column card grid. `Клиент` and `Холдинг` live in the
left column; `Условия кредита` and `Комментарии` live in the right column;
`Потенциалы холдинга` spans the full width below the cards.

## Components

### Header

- `BreadCrumbs`: `Главная / Потенциалы DCM / Черновик сделки DCM: Кредит № 4B02-04-01669-A-001P`
- `Text` title: `Черновик сделки DCM: Кредит № 4B02-04-01669-A-001P`
- `IconButton` pencil: edit draft title/main parameters.
- `Button` primary/accent with start icon:
  `Перевести в сделку DCM`.
- `IconButton` more menu: additional draft-level actions.
- `Text` metadata with status/check icon:
  `Изменено 02.07.2025, 10:04, Сергеев И.П.`

### ClientInfoTile

- UI kit components: `TileCard`, `Text`, `DictionaryBadge`, `Button`,
  `IconButton`, `Divider`.
- Title: `Клиент`.
- Header action: arrow icon to client profile/details page.

Fields:

| Label             | Value                |
| ----------------- | -------------------- |
| `Наименование`    | `ПАО АФК «Система»`  |
| `Отрасль`         | `Ретейл`             |
| `КМ`              | `Иванов И.И.`        |
| `Табельный номер` | `213456789`          |
| `ТБ`              | `Среднерусский банк` |

Rating block:

- Public rating row: badge `AA` plus
  `Стабильный АКРА от 12.11.2025, Подтвержден`.
- Public rating row: badge `ruAAA` plus
  `РА Эксперт от 10.10.2024, Повышен`.
- Internal rating: `AAA`.
- Spread: `180 bps`.
- Public issues: `Да`.
- Link/action: `Посмотреть текущие выпуски`.

### CreditTermsTile

- UI kit components: `TileCard`, `Text`.
- Title: `Условия кредита`.

| Label                           | Value                                                             |
| ------------------------------- | ----------------------------------------------------------------- |
| `Сумма финансирования`          | `20 млн руб.`                                                     |
| `Остаток срочной задолженности` | `9,95 млн руб.`                                                   |
| `Невыбранный лимит`             | `0,5 млн руб.`                                                    |
| `Процентная ставка`             | `23 %`                                                            |
| `Дата погашения`                | `12.12.2025`                                                      |
| `Дата выдачи`                   | `12.12.2023`                                                      |
| `Номер договора`                | `4B02-04-01669-A-001P`                                            |
| `Является рефинансированием`    | `Да`                                                              |
| `Тип кредита`                   | `931 Корпоративное кредитование - возобновляемая кредитная линия` |

### HoldingInfoTile

- UI kit components: `TileCard`, `Text`, `IconButton`.
- Title: `Холдинг`.
- Header action: arrow icon to holding profile/details page.

| Label             | Value                |
| ----------------- | -------------------- |
| `Наименование`    | `АФК «Система»`      |
| `КМ Холдинга`     | `Петров И.И.`        |
| `Табельный номер` | `213456790`          |
| `ТБ`              | `Среднерусский банк` |

### CommentsTile

- UI kit components: `TileCard`, `Text`, `IconButton`, optional editor.
- Title: `Комментарии`.
- Header action: pencil icon.
- Display text:
  `Пришли к выводу, что можно предложить выпуск облигаций в качестве основного продукта, а также будет дополнительное соглашение на выкуп облигаций банком.`
- Empty state: `Нет комментариев`.

### HoldingPotentialsTile

- UI kit components: `TileCard`, `Table`, `IconButton`, `DictionaryBadge`,
  `Tooltip`, collapse/expand controls.
- Title: `Потенциалы холдинга`.
- Full-width tile below the two-column cards.

Columns:

| Column              | Content                                                     |
| ------------------- | ----------------------------------------------------------- |
| `Потенциал`         | group names and product types with hierarchical indentation |
| `Сумма, млн руб.`   | amount in million rubles                                    |
| `Процентная ставка` | rate or formula                                             |
| `Дата погашения`    | maturity date                                               |
| `Причина`           | potential reason                                            |
| `Действия`          | row action IconButtons                                      |

Group examples:

- `АФК «Система» Потенциалов: 5, Сумма к перевороту: 120 млн руб.`
- `ПАО АФК «Система» Потенциалов: 2, Сумма к перевороту: 60 млн руб.` + badge `AA`
- `ПАО «Мобильные телесистемы» Потенциалов: 2, Сумма к перевороту: 330 млн руб.` + badge `AAA`

Product rows:

| Parent company                |              Product | Amount |           Rate | Maturity date | Reason                       | State    |
| ----------------------------- | -------------------: | -----: | -------------: | ------------- | ---------------------------- | -------- |
| `ПАО АФК «Система»`           |             `Кредит` |   `20` |         `23 %` | `15.09.2026`  | `Финансирование к погашению` | selected |
| `ПАО АФК «Система»`           | `Облигация в валюте` |   `40` |   `КС + 1,9 %` | `28.09.2026`  | `Финансирование к погашению` | default  |
| `ПАО «Мобильные телесистемы»` |             `Кредит` |   `20` |         `19 %` | `10.09.2026`  | `Финансирование к погашению` | default  |
| `ПАО «Мобильные телесистемы»` | `Облигация в валюте` |  `300` |     `КС + 3 %` | `01.09.2026`  | `Финансирование к погашению` | default  |
| `ПАО «Мобильные телесистемы»` |          `Облигация` |   `10` | `RUONIA + 2 %` | `25.09.2026`  | `Финансирование к погашению` | default  |

Selected row: the current draft basis row is highlighted with pale teal
background. Only one selected row is expected.

## States

- Loading: skeleton title, skeleton metadata, card skeletons, table skeleton;
  primary conversion button disabled.
- Empty: scalar fields use `—`; no ratings show `Нет данных`; no public issues
  show `Нет`; empty comments show `Нет комментариев`; empty potentials show
  `Нет потенциалов холдинга`.
- Error: page-level fatal error with retry; tile-level partial errors keep
  available content; conversion/row-action errors show notification and preserve
  current state.
- Permission-based: conversion, edit pencils, navigation arrows, public issues
  link, employee links, and table row actions are gated by permissions.

## Interactions

### Convert draft to DCM deal

1. User clicks `Перевести в сделку DCM`.
2. System validates the draft and selected potential.
3. If confirmation is required, show confirmation modal with deal type and number.
4. On confirm, run conversion mutation.
5. On success, show success notification and navigate to the DCM deal page or
   replace draft status with converted state.
6. On failure, show error notification and allow retry.

### Other interactions

- Pencil next to the title opens edit flow for draft title/main parameters.
- Pencil in `Комментарии` opens comment editor.
- Arrow icon in `Клиент` or `Холдинг` navigates to the related entity details page.
- `Посмотреть текущие выпуски` opens current public issues for the client.
- Group rows in `Потенциалы холдинга` expand/collapse child rows.
- Row action buttons are disabled while a row-level mutation is in progress.

## Responsive Behavior

- Desktop: two-column card grid; `Потенциалы холдинга` spans full width.
- Tablet: cards may remain two-column if width is sufficient.
- Mobile/narrow: actions wrap or move into menu; cards stack vertically; table
  uses horizontal scroll to preserve readable columns.

## Data Dependencies

- `DcmDraftDealDto`: id, productType, dealNumber, status, updatedAt,
  updatedBy, selectedPotentialId.
- `DcmDraftClientDto`: client identity, manager, ratings, internal rating,
  spread, public issues.
- `DcmCreditTermsDto`: funding amount, debt, limit, rate, dates, contract,
  refinancing, credit type.
- `DcmHoldingDto`: holding identity, manager, territorial bank.
- `DcmDraftCommentDto`: text, updatedAt, updatedBy.
- `HoldingPotentialGroupDto` / `HoldingPotentialRowDto`: tree groups, product
  rows, selected state, warning state, row actions.

## Assumptions

- Exact route, source module locations, API hook names, and permission names must
  be confirmed against the project codebase.
- The selected highlighted potential row is the row used as the basis for the
  current draft deal.
- Yellow corner markers in the table indicate a warning/changed/comment state;
  exact meaning is TBD.
