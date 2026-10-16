# Typography & Colors — code ↔ Pixso mapping

> **Цель:** контракт переименования стилей/токенов в Pixso, чтобы они 1:1 соответствовали `theme.palette.*` и `theme.typography.*` в коде.
>
> **Правило:** имя из кода — канон. Если в Pixso есть лишнее — удаляем. Если в коде нет — обсуждаем (либо в код добавить, либо в Pixso удалить).
>
> **Источники:**
> - Код: `src/styles/theme/palette.ts`, `src/styles/theme/typography.ts`, `src/styles/colors/*.ts`
> - Pixso (выгрузка через Tokens Studio plugin): `tmp/tokens-from-pixso/colors.json`, `tmp/tokens-from-pixso/typography.json`

---

## 0. Naming conventions

В Tokens Studio пути формируются через `/` (нестинг по группам). Регистр и слова — как в коде.

| Что меняется | Pixso сейчас | После | Правило |
|---|---|---|---|
| Разделитель пути | `Local/Status/...` | `palette/Status/...` | top-level group → `palette/` или `typography/` |
| Подчёркивания в именах | `StRed_Light`, `BG_Popup`, `Border_Primary` | `StRedLight`, `BGPopup`, `BorderPrimary` | underscores удаляем, PascalCase |
| Дефисы в типографике | `H6-strong`, `Body-M`, `Body-XL-Strong` | `H6StrongSmb`, `BodyMReg`, `BodyXLStrongSmb` | дефисы удаляем, имя из кода |
| Top-level «Local/Active/Static/Situative» | разные группы для одного слоя | объединяем под `palette/` | в коде всё это `theme.palette.*` |
| `fontFamilies` пустой ключ `""` | `{fontFamilies.}` ссылается в Header'ах | заполнить именем `SBDisplay` | в коде Header'ы используют `fontFamilies.SBDisplay` |
| `fontWeights` ключ `-0` | `{fontWeights.-0}` пустой | разные веса как `regular` (400) / `semibold` (600) | сейчас у Pixso только `sb-sans-interface-1/2`, нужны `Regular` и `Semibold` без префикса |

---

## 1. TYPOGRAPHY — полный маппинг

### 1.1 Header

| Pixso текущее | Pixso fontSize | Pixso lineHeight | Pixso weight | Код имя | Код размеры | Match | Новое имя в Pixso |
|---|---|---|---|---|---|---|---|
| `Header/H1` | 52 | 68 | (`{fontWeights.-0}` empty) | `H1Light` | 52/68/400/SBDisplay | ✅ size | `typography/H1Light` |
| `Header/H2` | 42 | 52 | empty | `H2Light` | 42/52/400/SBDisplay | ✅ size | `typography/H2Light` |
| `Header/H3` | 28 | 32 | empty (regular) | `H3Reg` | 28/32/400/SBDisplay | ✅ size | `typography/H3Reg` |
| `Header/H3-Strong` | 28 | 32 | empty (should be 600) | `H3StrongSmb` | 28/32/600/SBDisplay | ⚠️ weight в Pixso пустой | `typography/H3StrongSmb` |
| `Header/H4` | 22 | 24 | empty (regular) | `H4Reg` | 22/24/400/SBDisplay | ✅ size | `typography/H4Reg` |
| `Header/H4-Strong` | 22 | 24 | empty (600) | `H4StrongSmb` | 22/24/600/SBDisplay | ⚠️ weight | `typography/H4StrongSmb` |
| `Header/H4-Strong-Extensive` | 22 | 28 | empty (600) | `H4StrongExtensiveSmb` | 22/28/600/SBDisplay | ⚠️ weight | `typography/H4StrongExtensiveSmb` |
| `Header/H5` | 18 | 24 | empty (regular) | `H5Reg` | 18/24/400/SBDisplay | ✅ size | `typography/H5Reg` |
| `Header/H5-Strong` | 18 | 24 | empty (600) | `H5StrongSmb` | 18/24/600/SBDisplay | ⚠️ weight | `typography/H5StrongSmb` |
| `Header/H6` | 16 | 20 | empty (regular) | `H6Reg` | 16/20/400/SBDisplay | ✅ size | `typography/H6Reg` |
| `Header/H6-strong` | 16 | 20 | empty (600) | `H6StrongSmb` | 16/20/600/SBDisplay | ⚠️ weight + lowercase в имени | `typography/H6StrongSmb` |

> ⚠️ **Все Header'ы в Pixso ссылаются на пустой `fontFamilies.""` и пустой `fontWeights.""`.** В коде они все используют `fontFamilies.SBDisplay` и `fontWeight: 400 или 600`. Нужно: создать в Pixso primitive'ы `fontFamilies.SBDisplay = "SB Sans Display, sans-serif"`, `fontWeights.Regular = 400`, `fontWeights.Semibold = 600` и перепривязать на них.

### 1.2 Body

| Pixso текущее | Pixso fontSize | Pixso lineHeight | Pixso weight | Код имя | Код размеры | Match | Новое имя в Pixso |
|---|---|---|---|---|---|---|---|
| `Body/Body-XL` | 24 | 32 | Regular (sb-sans-interface-2) | `BodyXLReg` | 24/32/400/SBText | ✅ | `typography/BodyXLReg` |
| `Body/Body-XL-Strong` | 24 | 32 | Semibold | `BodyXLStrongSmb` | 24/32/600/SBText | ✅ | `typography/BodyXLStrongSmb` |
| `Body/Body-L` | 18 | 24 | Regular | `BodyLReg` | 18/24/400/SBText | ✅ | `typography/BodyLReg` |
| `Body/Body-L-Strong` | 18 | 24 | Semibold | `BodyLStrongSmb` | 18/24/600/SBText | ✅ | `typography/BodyLStrongSmb` |
| `Body/Body-M` | 16 | 20 | Regular | `BodyMReg` | 16/20/400/SBText | ✅ | `typography/BodyMReg` |
| `Body/Body-M-Strong` | 16 | 20 | Semibold | `BodyMStrongSmb` | 16/20/600/SBText | ✅ | `typography/BodyMStrongSmb` |
| `Body/Body-M-Extensive` | 16 | 24 | Regular | `BodyMExtensive` | 16/24/400/SBText | ✅ | `typography/BodyMExtensive` |
| `Body/Body-S` | 14 | 16 | Regular | `BodySReg` | 14/16/400/SBText | ✅ | `typography/BodySReg` |
| `Body/Body-S-Strong` | 14 | 16 | Semibold | `BodySStrongSmb` | 14/16/600/SBText | ✅ | `typography/BodySStrongSmb` |
| `Body/Body-S-Eclipse` | 14 | 16 | Regular | — | — | ❌ нет в коде | **обсудить:** добавить в код или удалить из Pixso |
| `Body/Body-S-Numbers` | 14 | 16 | Regular | — | — | ❌ нет в коде | **обсудить:** добавить в код или удалить |
| `Body/Body-XS` | 12 | 16 | Regular | `BodyXSReg` | 12/16/400/SBText | ✅ | `typography/BodyXSReg` |
| `Body/Body-XS-Extensive` | 12 | 20 | Regular | `BodyXSExtensive` | 12/20/400/SBText | ✅ | `typography/BodyXSExtensive` |
| `Body/Body-XS-Low` | 12 | 12 | Regular | — | — | ❌ нет в коде | **обсудить:** добавить или удалить |

> Pixso fontFamily для Body: `sb-sans-interface` — это `SB Sans Text` в коде (`fontFamilies.SBText = 'SB Sans Text, sans-serif'`). Имя в Pixso нужно переименовать в **`SBText`**.

### 1.3 Button

| Pixso текущее | Pixso fontSize | Pixso lineHeight | Pixso weight | Код имя | Код размеры | Match | Новое имя в Pixso |
|---|---|---|---|---|---|---|---|
| `Button/Button-L` | 24 | 32 | empty (regular) | `ButtonL` | 24/32/400/SBScreen | ⚠️ weight + family | `typography/ButtonL` |
| `Button/Button-M` | 16 | 24 | empty | `ButtonM` | 16/24/400/SBScreen | ⚠️ | `typography/ButtonM` |
| `Button/Button-S` | 14 | 20 | empty | `ButtonS` | 14/20/400/SBScreen | ⚠️ | `typography/ButtonS` |
| `Button/Button-XS` | 12 | 16 | empty | `ButtonXS` | 12/16/400/SBScreen | ⚠️ | `typography/ButtonXS` |

> Button'ы в Pixso тоже ссылаются на пустые fontFamily/fontWeight. Нужно привязать на `fontFamilies.SBScreen = "SB Sans Screen, sans-serif"` и `fontWeights.Regular = 400`.

### 1.4 Display — нет в Pixso, есть в коде

| Код имя | Размеры | Действие |
|---|---|---|
| `DisplayL` | 36/48/400/SBTextCond | **ADD в Pixso** |
| `DisplayM` | 24/40/400/SBTextCond | **ADD в Pixso** |
| `DisplayS` | 20/32/400/SBTextCond | **ADD в Pixso** |

> Display-варианты используют font family **`SB Sans Text Cond`** (`fontFamilies.SBTextCond`). Нужно создать в Pixso primitive `fontFamilies.SBTextCond` и три новых typography token'а.

### 1.5 Typography primitives — нужно унифицировать в Pixso

> ⚠️ **Update от 2026-05-03 (см. §4.2):** часть рекомендаций ниже **отменяется**. Пустые `fontFamilies.""` и `fontWeights."-0"` — это артефакт того, что на машине пользователя нет шрифтов Sber, на корп-машине они подцепятся. Поэтому primitives fontFamilies/fontWeights в Pixso мы **НЕ переименовываем и не добавляем** (`SBDisplay/SBScreen/SBTextCond`, `Regular/Semibold` — отменяется). Оставляем 1:1 как сейчас.
>
> Что **остаётся актуальным** из таблицы ниже: переименование числовых ключей `fontSize.0..8` → `fontSize.<px>` и `lineHeights.0..7` → `lineHeights.<px>`, плюс **добавление недостающих** `fontSize.20`, `fontSize.36`, `lineHeights.40`, `lineHeights.48` для Display-вариантов.

| Что у Pixso сейчас | Что должно быть | Действие |
|---|---|---|
| `fontFamilies.""` (пустой) | удалить | drop |
| `fontFamilies.sb-sans-interface = "SB Sans Interface"` | rename → `fontFamilies.SBText = "SB Sans Text, sans-serif"` | rename + correct value |
| — | `fontFamilies.SBDisplay = "SB Sans Display, sans-serif"` | **ADD** (нужен для всех Header'ов) |
| — | `fontFamilies.SBScreen = "SB Sans Screen, sans-serif"` | **ADD** (нужен для всех Button'ов) |
| — | `fontFamilies.SBTextCond = "SB Sans Text Cond, sans-serif"` | **ADD** (нужен для Display) |
| `fontWeights."-0"` (пустой) | удалить | drop |
| `fontWeights.sb-sans-interface-1 = "Semibold"` | rename → `fontWeights.Semibold = 600` | переименовать + значение в число |
| `fontWeights.sb-sans-interface-2 = "Regular"` | rename → `fontWeights.Regular = 400` | rename + numeric |
| `fontSize.0..8` (нумерованные) | переименовать в осмысленные: `fontSize.12, .14, .16, .18, .20, .22, .24, .28, .36, .42, .52` | reorganize |
| `lineHeights.0..7` | переименовать: `lineHeights.12, .16, .20, .24, .28, .32, .40, .48, .52, .68` | reorganize |
| `letterSpacing.0 = 0` | оставить или переименовать в `letterSpacing.0` | ok |
| `paragraphSpacing.0 = 0` | оставить | ok |

> Сейчас в Pixso у нас всего **9 fontSize** primitive'ов, но коду нужно **11** (добавляются `20px` и `36px` для Display'ов). И **8 lineHeights** (нужны `40px` и `48px` для Display'ов).

---

## 2. COLORS — полный маппинг

### 2.1 Active group → palette/Primary, Secondary, Tertiary в коде

> Сейчас в Pixso `Active/*` свалены в одну кучу. Их нужно распределить по `palette.Primary/Secondary/Tertiary` согласно коду.

| Pixso текущее | Hex | Код имя | Match | Новое имя в Pixso |
|---|---|---|---|---|
| `Active/Primary` | `#00aa9b` | `palette.Primary.Primary` (= `emerald[500]`) | ✅ | `palette/Primary/Primary` |
| `Active/PrimaryDark` | `#0a7d6d` | `palette.Primary.PrimaryDark` (= `emerald[700]`) | ✅ | `palette/Primary/PrimaryDark` |
| `Active/PrimaryLight` | `#82cdc6` | `palette.Primary.PrimaryLight` (= `emerald[300]`) | ✅ | `palette/Primary/PrimaryLight` |
| `Active/PrimaryBG` | `#00aa9b0f` | `palette.Primary.PrimaryBG` (= `alpha(emerald[500], 0.06)`) | ✅ | `palette/Primary/PrimaryBG` |
| `Active/PrimaryBGLight` | `#00aa9b08` | `palette.Primary.PrimaryBGLight` (= `alpha(emerald[500], 0.03)`) | ✅ | `palette/Primary/PrimaryBGLight` |
| `Active/PrimaryBGSemyTransparent` | `#ffffff80` | `palette.Primary.PrimaryBGSemiTransparent` (= `alpha(mGrey[50], 0.5)`) | ⚠️ typo `Semy`→`Semi` | `palette/Primary/PrimaryBGSemiTransparent` |
| `Active/Secondary` | `#b8d6d3` | `palette.Secondary.Secondary` (= `emerald[200] = #B8D6D3`) | ✅ | `palette/Secondary/Secondary` |
| `Active/SecondaryDark` | `#639994` | `palette.Secondary.SecondaryDark` (= `emerald[600] = #639994`) | ✅ | `palette/Secondary/SecondaryDark` |
| `Active/SecondaryLight` | `#cde2e0` | `palette.Secondary.SecondaryLight` (= `emerald[100] = #CDE2E0`) | ✅ | `palette/Secondary/SecondaryLight` |
| `Active/SecondaryBG` | `#b8d6d34d` | `palette.Secondary.SecondaryBGDark` (= `alpha(emerald[200], 0.3)`) ≈ `#B8D6D34D` | ✅ | `palette/Secondary/SecondaryBGDark` |
| `Active/SecondaryBGLight` | `#b8d6d326` | `palette.Secondary.SecondaryBG` (= `alpha(emerald[200], 0.15)`) ≈ `#B8D6D326` | ✅ | `palette/Secondary/SecondaryBG` |
| `Active/Tertiary` | `#e5eceb` | `palette.Tertiary.Tertiary` (= `swamp[100] = #E5ECEB`) | ✅ | `palette/Tertiary/Tertiary` |
| `Active/TertiaryDark` | `#7a9994` | `palette.Tertiary.TertiaryDark` (= `swamp[400] = #7A9994`) | ✅ | `palette/Tertiary/TertiaryDark` |
| `Active/TertiaryLight` | `#eef2f1` | `palette.Tertiary.TertiaryLight` (= `swamp[50] = #EEF2F1`) | ✅ | `palette/Tertiary/TertiaryLight` |

### 2.2 Static/BG → palette/BG

| Pixso текущее | Hex | Код имя | Match | Новое имя в Pixso |
|---|---|---|---|---|
| `Static/BG/BG_Popup` | `#ffffff` | `palette.BG.BGPopup` | ✅ | `palette/BG/BGPopup` |
| `Static/BG/BG_Tile` | `#ffffff` | `palette.BG.BGTile` | ✅ | `palette/BG/BGTile` |
| `Static/BG/BG_MainMenu` | `#fefefe` | `palette.BG.BGMainMenu` (= `mGrey[100] = #F5F5F5`) | ⚠️ значение разное | `palette/BG/BGMainMenu` |
| `Static/BG/BG_Hint` | `#283237` | `palette.BG.BGHint` (= `cGrey[800]`) | ✅ | `palette/BG/BGHint` |
| `Static/BG/BG_PAGE` | `linear-gradient(...)` | `palette.BG.BGPageLinearStart`/`BGPageLinearEnd` (два отдельных stop'а) | ⚠️ Pixso хранит как gradient-токен, код — как два цвета | **обсудить:** Tokens Studio gradient или 2 цвета |
| — | — | `palette.BG.BGTableDefault` (= `mGrey[50]`) | ❌ нет в Pixso | ADD |
| — | — | `palette.BG.BGSecondaryLight` (= `emerald[100]`) | ❌ | ADD |
| — | — | `palette.BG.BGTableAccent` (= `amber[50]`) | ❌ | (есть как `Static/BGTable/Accent_Default`) — переместить |

### 2.3 Static/BGTable → palette/BG (BGTable*) в коде

> Эти токены в коде живут под `palette.BG.BGTable*`. Pixso держит отдельной группой.

| Pixso текущее | Hex | Код имя | Match | Новое имя в Pixso |
|---|---|---|---|---|
| `Static/BGTable/Default` | `#ffffff` | `palette.BG.BGTableDefault` (= `mGrey[50]`) | ✅ | `palette/BG/BGTableDefault` |
| `Static/BGTable/Hover` | `#f6fafa` | `palette.BG.BGTableDefaultHover` (= `swamp[A400]`) | ✅ | `palette/BG/BGTableDefaultHover` |
| `Static/BGTable/Focus` | `#deedec` | `palette.BG.BGTableDefaultFocus` (= `swamp[A700]`) | ✅ | `palette/BG/BGTableDefaultFocus` |
| `Static/BGTable/Pinned_Default` | `#f5f7f7` | — (вероятно покрыт `BGPageLinearStart`) | ⚠️ | **обсудить** |
| `Static/BGTable/Pinned_Hover` | `#eef2f1` | — | ❌ | **обсудить:** добавить в код |
| `Static/BGTable/Pinned_Focus` | `#deedec` | — | ❌ | **обсудить** |
| `Static/BGTable/FocusHover` | `#d4e6e5` | — | ❌ | **обсудить** |
| `Static/BGTable/Accent_Default` | `#fff8e1` | `palette.BG.BGTableAccent` (= `amber[50]`) | ✅ | `palette/BG/BGTableAccent` |
| `Static/BGTable/Accent_Hover` | `#fef0c2` | `palette.BG.BGTableAccentHover` (= `amber[A100]`) | ✅ | `palette/BG/BGTableAccentHover` |
| `Static/BGTable/Accent_Focus` | `#fce9ae` | `palette.BG.BGTableAccentFocus` (= `amber[A200]`) | ✅ | `palette/BG/BGTableAccentFocus` |

### 2.4 Static/Text → palette/Text

| Pixso текущее | Hex | Код имя | Match | Новое имя в Pixso |
|---|---|---|---|---|
| `Static/Text/Text_Primary` | `#324844` | `palette.Text.TextPrimary` (= `cGrey[600]`) | ✅ | `palette/Text/TextPrimary` |
| `Static/Text/Text_Secondary` | `#6c8080` | `palette.Text.TextSecondary` (= `cGrey[500]`) | ✅ | `palette/Text/TextSecondary` |
| `Static/Text/Text_Inactive` | `#aab2b1` | `palette.Text.TextInactive` (= `cGrey[300]`) | ✅ | `palette/Text/TextInactive` |
| `Static/Text/Text_Black` | `#283237` | `palette.Text.TextBlack` (= `cGrey[800]`) | ✅ | `palette/Text/TextBlack` |
| `Static/Text/Text_OnDark` | `#ffffff` | `palette.Text.TextOnDark` (= `mGrey[50]`) | ✅ | `palette/Text/TextOnDark` |
| `Static/Text/Text_OnTertiary` | `#617c7c` | `palette.Text.TextOnTertiary` (= `swamp[500]`) | ✅ | `palette/Text/TextOnTertiary` |

### 2.5 Static/Border → palette/Border

| Pixso текущее | Hex | Код имя | Match | Новое имя в Pixso |
|---|---|---|---|---|
| `Static/Border/Border_Primary` | `#b8cccc` | `palette.Border.BorderPrimary` (= `swamp[300]`) | ✅ | `palette/Border/BorderPrimary` |
| `Static/Border/Border_Light` | `#e1ede7` | `palette.Border.BorderLight` (= `swamp[200]`) | ✅ | `palette/Border/BorderLight` |
| `Static/Border/Border_Dark` | `#6c8080` | `palette.Border.BorderDark` (= `swamp[600]`) | ✅ | `palette/Border/BorderDark` |

### 2.6 Situative → palette/Error, Warning, Success, Info, Link, Disabled

#### Error
| Pixso | Hex | Код имя | Match | Новое имя |
|---|---|---|---|---|
| `Situative/Error` | `#e5625c` | `palette.Error.Error` (= `red[300]`) | ✅ | `palette/Error/Error` |
| `Situative/ErrorDark` | `#d32f2f` | `palette.Error.ErrorDark` (= `red[700]`) | ✅ | `palette/Error/ErrorDark` |
| `Situative/ErrorLight` | `#e57373` | `palette.Error.ErrorLight` (= `red[200]`) | ✅ | `palette/Error/ErrorLight` |
| `Situative/ErrorBG` | `#fbeceb` | `palette.Error.ErrorBG` (= `red[A200]`) | ✅ | `palette/Error/ErrorBG` |
| `Situative/ErrorBGLight` | `#fcf1f1` | `palette.Error.ErrorBGLight` (= `red[A100]`) | ✅ | `palette/Error/ErrorBGLight` |
| `Situative/ErrorBGDark` | `#f6d8d7` | `palette.Error.ErrorBGDark` (= `red[A400]`) | ✅ | `palette/Error/ErrorBGDark` |

#### Warning
| Pixso | Hex | Код имя | Match | Новое имя |
|---|---|---|---|---|
| `Situative/Warning` | `#ffb300` | `palette.Warning.Warning` (= `amber[600]`) | ✅ | `palette/Warning/Warning` |
| `Situative/WarningDark` | `#ff8f00` | `palette.Warning.WarningDark` (= `amber[800]`) | ✅ | `palette/Warning/WarningDark` |
| `Situative/WarningLight` | `#ffca28` | `palette.Warning.WarningLight` (= `amber[400]`) | ✅ | `palette/Warning/WarningLight` |
| `Situative/WarningBG` | `#fff8e1` | `palette.Warning.WarningBG` (= `amber[50]`) | ✅ | `palette/Warning/WarningBG` |

#### Success
| Pixso | Hex | Код имя | Match | Новое имя |
|---|---|---|---|---|
| `Situative/Success` | `#7cb342` | `palette.Success.Success` (= `lightGreen[600]`) | ✅ | `palette/Success/Success` |
| `Situative/SuccessDark` | `#558b2f` | `palette.Success.SuccessDark` (= `lightGreen[800]`) | ✅ | `palette/Success/SuccessDark` |
| `Situative/SuccessLight` | `#9ccc65` | `palette.Success.SuccessLight` (= `lightGreen[400]`) | ✅ | `palette/Success/SuccessLight` |
| `Situative/SuccessBG` | `#e9f6da` | `palette.Success.SuccessBG` (= `lightGreen[50]`) | ✅ | `palette/Success/SuccessBG` |

#### Info
| Pixso | Hex | Код имя | Match | Новое имя |
|---|---|---|---|---|
| `Situative/Info` | `#1e88e5` | `palette.Info.Info` (= `lightBlue[600] = #039BE5`) | ⚠️ значения разные | `palette/Info/Info` |
| `Situative/InfoDark` | `#01579b` | `palette.Info.InfoDark` (= `lightBlue[800]`) | ✅ | `palette/Info/InfoDark` |
| `Situative/InfoLight` | `#29b6f6` | `palette.Info.InfoLight` (= `lightBlue[400]`) | ✅ | `palette/Info/InfoLight` |
| `Situative/InfoBG` | `#eaf8fe` | `palette.Info.InfoBG` (= `lightBlue[50]`) | ✅ | `palette/Info/InfoBG` |
| — | — | `palette.Info.InfoBlue` (= `blue[600]`) | ❌ нет в Pixso | **ADD** |

#### Link
| Pixso | Hex | Код имя | Match | Новое имя |
|---|---|---|---|---|
| `Situative/Link` | `#00aa9b` | `palette.Link.Link` (= `emerald[500]`) | ✅ | `palette/Link/Link` |
| `Situative/LinkDark` | `#0a7d6d` | `palette.Link.LinkDark` (= `emerald[700]`) | ✅ | `palette/Link/LinkDark` |
| `Situative/LinkLight` | `#b8d6d3` | `palette.Link.LinkLight` (= `emerald[300] = #82CDC6`) | ⚠️ значения разные | `palette/Link/LinkLight` |

#### Disabled
| Pixso | Hex | Код имя | Match | Новое имя |
|---|---|---|---|---|
| `Situative/Disabled` | `#bec5c8` | `palette.Disabled.Disabled` (= `cGrey[200]`) | ✅ | `palette/Disabled/Disabled` |
| `Situative/DisabledBG` | `#fbfbfb` | `palette.Disabled.DisabledBG` (= `cGrey[50]`) | ✅ | `palette/Disabled/DisabledBG` |
| `Situative/DisabledBorder` | `#e8eded` | `palette.Disabled.DisabledBorder` (= `cGrey[100]`) | ✅ | `palette/Disabled/DisabledBorder` |
| `Situative/DisabledBGSemyTransparent` | `#ffffff80` | `palette.Disabled.DisabledBGSemiTransparent` (= `alpha(mGrey[50], 0.5)`) | ⚠️ typo `Semy`→`Semi` | `palette/Disabled/DisabledBGSemiTransparent` |

### 2.7 Local/Status → palette/Status

| Pixso | Hex | Код имя | Match | Новое имя |
|---|---|---|---|---|
| `Local/Status/StGreen` | `#4caf50` | `Status.StGreen` (= `green[500]`) | ✅ | `palette/Status/StGreen` |
| `Local/Status/StGreen_Dark` | `#2e7d32` | `Status.StGreenDark` (= `green[800]`) | ✅ | `palette/Status/StGreenDark` |
| `Local/Status/StGreen_Mid` | `#4caf508f` | `Status.StGreenMid` (= `alpha(green[500], 0.56)`) | ✅ | `palette/Status/StGreenMid` |
| `Local/Status/StGreen_MidLight` | `#4caf5052` | `Status.StGreenMidLight` (= `alpha(green[500], 0.32)`) | ✅ | `palette/Status/StGreenMidLight` |
| `Local/Status/StGreen_Light` | `#4caf5029` | `Status.StGreenLight` (= `alpha(green[500], 0.16)`) | ✅ | `palette/Status/StGreenLight` |
| `Local/Status/StLBlue` | `#03a9f4` | `Status.StLBlue` | ✅ | `palette/Status/StLBlue` |
| `Local/Status/StLBlue_Dark` | `#01579b` | `Status.StLBlueDark` | ✅ | `palette/Status/StLBlueDark` |
| `Local/Status/StLBlue_Mid` | `#03a9f48f` | `Status.StLBlueMid` | ✅ | `palette/Status/StLBlueMid` |
| `Local/Status/StLBlue_MidLight` | `#03a9f452` | `Status.StLBlueMidLight` | ✅ | `palette/Status/StLBlueMidLight` |
| `Local/Status/StLBlue_Light` | `#03a9f429` | `Status.StLBlueLight` | ✅ | `palette/Status/StLBlueLight` |
| `Local/Status/StOrange` | `#ffa000` | `Status.StOrange` (= `amber[700]`) | ✅ | `palette/Status/StOrange` |
| `Local/Status/StOrange_Dark` | `#ff6f00` | `Status.StOrangeDark` (= `amber[900]`) | ✅ | `palette/Status/StOrangeDark` |
| `Local/Status/StOrange_Mid` | `#ffa0008f` | `Status.StOrangeMid` | ✅ | `palette/Status/StOrangeMid` |
| `Local/Status/StOrange_MidLight` | `#ffa00052` | `Status.StOrangeMidLight` | ✅ | `palette/Status/StOrangeMidLight` |
| `Local/Status/StOrange_Light` | `#ffa00029` | `Status.StOrangeLight` | ✅ | `palette/Status/StOrangeLight` |
| `Local/Status/StRed` | `#ef5350` | `Status.StRed` (= `red[400]`) | ✅ | `palette/Status/StRed` |
| `Local/Status/StRed_Dark` | `#d32f2f` | `Status.StRedDark` (= `red[700]`) | ✅ | `palette/Status/StRedDark` |
| `Local/Status/StRed_Mid` | `#ef53508f` | `Status.StRedMid` | ✅ | `palette/Status/StRedMid` |
| `Local/Status/StRed_MidLight` | `#ef535052` | `Status.StRedMidLight` | ✅ | `palette/Status/StRedMidLight` |
| `Local/Status/StRed_Light` | `#ef535029` | `Status.StRedLight` | ✅ | `palette/Status/StRedLight` |
| `Local/Status/StDPurple` | `#7e57c2` | `Status.StDPurple` (= `deepPurple[400]`) | ✅ | `palette/Status/StDPurple` |
| `Local/Status/StDPurple_Dark` | `#311b92` | `Status.StDPurpleDark` (= `deepPurple[900]`) | ✅ | `palette/Status/StDPurpleDark` |
| `Local/Status/StDPurple_Mid` | `#7e57c28f` | `Status.StDPurpleMid` | ✅ | `palette/Status/StDPurpleMid` |
| `Local/Status/StDPurple_MidLight` | `#7e57c252` | `Status.StDPurpleMidLight` | ✅ | `palette/Status/StDPurpleMidLight` |
| `Local/Status/StDPurple_Light` | `#7e57c229` | `Status.StDPurpleLight` | ✅ | `palette/Status/StDPurpleLight` |
| `Local/Status/StGrey` | `#333f48` | `Status.StGrey` (= `cGrey[700]`) | ✅ | `palette/Status/StGrey` |
| `Local/Status/StGrey_Dark` | `#131618` | `Status.StGreyDark` (= `cGrey[900]`) | ✅ | `palette/Status/StGreyDark` |
| `Local/Status/StGrey_Mid` | `#333f488f` | `Status.StGreyMid` | ✅ | `palette/Status/StGreyMid` |
| `Local/Status/StGrey_MidLight` | `#333f4852` | `Status.StGreyMidLight` | ✅ | `palette/Status/StGreyMidLight` |
| `Local/Status/StGrey_Light` | `#333f4829` | `Status.StGreyLight` | ✅ | `palette/Status/StGreyLight` |
| `Local/Status/StSystem` | `#7a9994` | `Status.StSystem` (= `swamp[400]`) | ✅ | `palette/Status/StSystem` |
| `Local/Status/StSystem_Dark` | `#324844` | `Status.StSystemDark` (= `cGrey[600]`) | ✅ | `palette/Status/StSystemDark` |
| `Local/Status/StSystem_Mid` | `#7a99948f` | `Status.StSystemMid` | ✅ | `palette/Status/StSystemMid` |
| `Local/Status/StSystem_MidLight` | `#7a999452` | `Status.StSystemMidLight` | ✅ | `palette/Status/StSystemMidLight` |
| `Local/Status/StSystem_Light` | `#7a999429` | `Status.StSystemLight` | ✅ | `palette/Status/StSystemLight` |
| `Local/Status/StDisabled` | `#3248443d` | `Status.StDisabled` (= `alpha(cGrey[600], 0.24)`) | ✅ | `palette/Status/StDisabled` |
| `Local/Status/StDisabled_Dark` | `#32484466` | `Status.StDisabledDark` (= `alpha(cGrey[600], 0.4)`) | ✅ | `palette/Status/StDisabledDark` |
| `Local/Status/StDisabled_Mid` | `#32484429` | `Status.StDisabledMid` (= `alpha(cGrey[600], 0.16)`) | ✅ | `palette/Status/StDisabledMid` |
| `Local/Status/StDisabled_MidLight` | `#32484414` | `Status.StDisabledMidLight` (= `alpha(cGrey[600], 0.08)`) | ✅ | `palette/Status/StDisabledMidLight` |
| `Local/Status/StDisabled_Light` | `#3248440a` | `Status.StDisabledLight` (= `alpha(cGrey[600], 0.04)`) | ✅ | `palette/Status/StDisabledLight` |
| `Local/Status/StPrimary` | `#00aa9b` | — | ❌ нет в коде (есть отдельно `palette.Primary.Primary`) | **обсудить:** удалить или добавить алиас |
| `Local/Status/StPrimary_Dark` | `#00635a` | — | ❌ | **обсудить** |
| `Local/Status/StPrimary_Light` | `#00aa9b29` | — | ❌ | **обсудить** |
| `Local/Status/StPrimary_Mid` | `#00aa9b8f` | — | ❌ | **обсудить** |
| `Local/Status/StPrimary_MidLight` | `#00aa9b52` | — | ❌ | **обсудить** |
| `Local/Status/01..09` (9 шт.) | `#ffffff` (все) | — | ❌ заглушки | **DELETE** |

### 2.8 Local/Chart → palette/Chart

| Pixso | Hex | Код имя | Match | Новое имя |
|---|---|---|---|---|
| `Local/Chart/CGreen` | `#c5e1a5` | `Chart.CGreen` (= `lightGreen[200]`) | ✅ | `palette/Chart/CGreen` |
| `Local/Chart/CGreen_Dark` | `#aed581` | `Chart.CGreenDark` (= `lightGreen[300]`) | ✅ | `palette/Chart/CGreenDark` |
| `Local/Chart/CRed` | `#ef9a9a` | `Chart.CRed` (= `red[100]` = `#FFCDD2`) | ⚠️ значения разные | `palette/Chart/CRed` |
| `Local/Chart/CRed_Dark` | `#e5625c` | `Chart.CRedDark` (= `red[300]`) | ✅ | `palette/Chart/CRedDark` |
| `Local/Chart/COrange` | `#ffe082` | `Chart.COrange` (= `amber[200]`) | ✅ | `palette/Chart/COrange` |
| `Local/Chart/COrange_Dark` | `#ffca28` | `Chart.COrangeDark` (= `amber[400]`) | ✅ | `palette/Chart/COrangeDark` |
| `Local/Chart/CPurple` | `#e1bee7` | `Chart.CPurple` (= `purple[100]`) | ✅ | `palette/Chart/CPurple` |
| `Local/Chart/CPurple_Dark` | `#ce93d8` | `Chart.CPurpleDark` (= `purple[200]`) | ✅ | `palette/Chart/CPurpleDark` |
| `Local/Chart/CBlue` | `#039be5` | `Chart.CBlue` (= `lightBlue[600]`) | ✅ | `palette/Chart/CBlue` |

### 2.9 Local/Product → palette/Product

| Pixso | Hex | Код имя | Match | Новое имя |
|---|---|---|---|---|
| `Local/Product/PGreen` | `#388e3c` | `Product.PGreen` (= `green[700]`) | ✅ | `palette/Product/PGreen` |
| `Local/Product/PBlue` | `#1976d2` | `Product.PBlue` (= `blue[700]`) | ✅ | `palette/Product/PBlue` |
| `Local/Product/POrange` | `#f57c00` | `Product.POrange` (= `orange[700]`) | ✅ | `palette/Product/POrange` |
| `Local/Product/PViolet` | `#5e35b1` | `Product.PViolet` (= `deepPurple[600]`) | ✅ | `palette/Product/PViolet` |
| `Local/Product/PKhaki` | `#827717` | `Product.PKhaki` (= `lime[900]`) | ✅ | `palette/Product/PKhaki` |
| `Local/Product/PGrey` | `#616e7c` | `Product.PGrey` (= `cGrey[700] = #333F48`) | ⚠️ значения разные | `palette/Product/PGrey` |
| `Local/Product/PGreyLight` | `#bec5c8` | `Product.PGreyLight` (= `cGrey[200]`) | ✅ | `palette/Product/PGreyLight` |

### 2.10 Local/Rate → palette/Rate

| Pixso | Hex | Код имя | Match | Новое имя |
|---|---|---|---|---|
| `Local/Rate/RGreen` | `#c5e1a5` | `Rate.RGreen` (= `lightGreen[200]`) | ✅ | `palette/Rate/RGreen` |
| `Local/Rate/RBlue` | `#90caf9` | `Rate.RBlue` (= `blue[200]`) | ✅ | `palette/Rate/RBlue` |
| `Local/Rate/RPurple` | `#b39ddb` | `Rate.RPurple` (= `deepPurple[200]`) | ✅ | `palette/Rate/RPurple` |
| `Local/Rate/ROrange` | `#ffcc80` | `Rate.ROrange` (= `orange[200]`) | ✅ | `palette/Rate/ROrange` |
| `Local/Rate/RLightGreen` | `#e8f5e9` | `Rate.RLightGreen` (= `green[50]`) | ✅ | `palette/Rate/RLightGreen` |
| `Local/Rate/RLightBlue` | `#eaf8fe` | `Rate.RLightBlue` (= `lightBlue[50] = #E1F5FE`) | ⚠️ значения разные | `palette/Rate/RLightBlue` |
| `Local/Rate/RLightPurple` | `#ede7f6` | `Rate.RLightPurple` (= `deepPurple[50]`) | ✅ | `palette/Rate/RLightPurple` |
| `Local/Rate/RLightOrange` | `#fff3e0` | `Rate.RLightOrange` (= `orange[50]`) | ✅ | `palette/Rate/RLightOrange` |

### 2.11 Monochrome — есть в Pixso, нет в коде

| Pixso | Hex | Действие |
|---|---|---|
| `Monochrome/MGreyLight` | `#e0e0e0` (= `mGrey[300]`) | **обсудить:** нужно ли в коде |
| `Monochrome/MGreyMiddleLight` | `#cacaca` | **обсудить** |

### 2.12 Elevations / Shadows — обсудить отдельно

В Pixso: `Elevation_1..5` + `Shadow4/0_modalform` (composite `boxShadow` токены).
В коде: тени описаны в `theme/components.ts` через `palette.action.*` и точечные `boxShadow` строки. Нет прямого соответствия.

**Действие:** на этапе компонентных токенов сравнивать elevation per-component, унифицировать формат → один источник в коде, экспорт в Pixso.

### 2.13 Status: SGrey/SRed/SEmerald (deprecated) — есть в коде, помечены к удалению

```ts
// в palette.ts:
/**Todo: designers mark these colors (with 'S' prefix) as deprecated...*/
SGrey: cGrey[500],
SGreyLight: cGrey[200],
SRed: red[700],
SRedLight: red[50],
SEmerald: emerald[600],
SEmeraldLight: emerald[50],
```

В Pixso их нет (не нашёл в выгрузке). **Действие:** удалить из кода вместе с типом `StatusColors`.

### 2.14 Деприкейтящиеся в коде, отсутствующие в Pixso (палитры primary/secondary lowercase)

В коде есть **MUI-стандартные** `palette.primary` и `palette.secondary` (lowercase) рядом с `palette.Primary`/`palette.Secondary` (PascalCase). Lowercase живут только для совместимости с MUI:

```ts
primary: { light: emerald[300], main: emerald[500], dark: emerald[700] },
secondary: { light: swamp[300], main: swamp[500], dark: swamp['A700'] },
```

В Pixso их нет. **Действие:** не дублировать, оставить только PascalCase. Lowercase — внутренняя MUI-обвязка, для дизайнера не нужна.

---

## 3. Сводка действий по Pixso

### 3.1 Rename (одинаковое значение, новое имя) — 130+ токенов
Применяется ко всем строкам с `Match = ✅` и `Action = переименовать`. Правила:
- `Local/X/...` → `palette/X/...`
- `Static/X/...` → `palette/X/...`
- `Active/...` → `palette/Primary/...` или `palette/Secondary/...` или `palette/Tertiary/...`
- `Situative/...` → `palette/Error/...`, `palette/Warning/...`, …, `palette/Disabled/...`
- Подчёркивания и дефисы → camelCase: `StRed_Light` → `StRedLight`, `H6-strong` → `H6StrongSmb`, `Body-M-Strong` → `BodyMStrongSmb`
- Typo: `Semy` → `Semi` (`PrimaryBGSemyTransparent` → `PrimaryBGSemiTransparent`, `DisabledBGSemyTransparent` → `DisabledBGSemiTransparent`)

### 3.2 Add (нет в Pixso, нужно по коду) — ~7 токенов
| Категория | Что добавить |
|---|---|
| Typography variants | `DisplayL` (36/48/Regular, fontFamily ссылка на существующий Pixso primitive), `DisplayM` (24/40), `DisplayS` (20/32) |
| Typography primitives | `fontSize.20`, `fontSize.36`, `lineHeights.40`, `lineHeights.48` (только числовые недостающие — fontFamilies/fontWeights не трогаем, см. §4.2) |
| Palette/Info | `palette/Info/InfoBlue` (= `blue[600] = #1E88E5`) |

### 3.3 Delete (есть в Pixso, бесполезно) — ~10 токенов
| Что удалить | Зачем |
|---|---|
| `Local/Status/01..09` (9 пустых white-плейсхолдеров) | мусор, все `#ffffff` |
| `Static/BG/BG_PAGE` (gradient) | заменяется на single color `#F2F7F7`, см. §4.3 |
| `Local/Status/StPrimary*` (5 токенов) | в коде нет; обсудить — либо удалить, либо в код добавить |

> Pixso fontFamilies/fontWeights primitives **не удаляем** (см. §4.2).

### 3.4 Discuss (нужно решение) — ~10 случаев
| Что | Pixso значение | Код значение | Гипотеза решения |
|---|---|---|---|
| `Body/Body-S-Eclipse`, `Body-S-Numbers`, `Body-XS-Low` | есть | нет | добавить в код или удалить из Pixso (зависит от того, используются ли в макетах) |
| ~~`Active/Secondary`~~ | ~~`#b8d6d3`~~ | ~~`emerald[200]`~~ | ✅ closed: я ошибся — `emerald[200] = #B8D6D3` точно матчит Pixso. См. §4.1 |
| ~~`Static/BG/BG_PAGE`~~ (gradient) | gradient | 2 цвета | ✅ closed: §4.3 — single color `#F2F7F7` |
| `Active/SecondaryBG` ↔ `SecondaryBGLight` | naming inverted | naming inverted | в Pixso `BG` = темнее (30%), в коде `BG` = светлее (15%). При переименовании в Pixso: `SecondaryBG → palette/Secondary/SecondaryBGDark`, `SecondaryBGLight → palette/Secondary/SecondaryBG` (значения те же, swap только имена). |
| `Static/BGTable/Pinned_*` (3) | есть | нет (`Pinned_Default` ~совпадает с `BGPageLinearStart`) | добавить в код или удалить из Pixso |
| `Static/BGTable/FocusHover` | есть | нет | добавить в код |
| `Situative/Info` (Pixso `#1e88e5` vs код `lightBlue[600] = #039BE5`) | разные значения | разные | малая разница; решить, какой канон |
| `Situative/LinkLight` (Pixso `#b8d6d3` vs код `emerald[300] = #82CDC6`) | разные значения | — | дельта; обсудить |
| `Local/Chart/CRed` (Pixso `#ef9a9a` vs код `red[100] = #FFCDD2`) | разные | — | дельта |
| `Local/Rate/RLightBlue` (Pixso `#eaf8fe` vs код `lightBlue[50] = #E1F5FE`) | разные | — | дельта |
| `Local/Product/PGrey` (Pixso `#616e7c` vs код `cGrey[700] = #333F48`) | разные | — | большая дельта; обсудить |
| `Static/BG/BG_MainMenu` (Pixso `#fefefe` vs код `mGrey[100] = #F5F5F5`) | разные | — | дельта |
| `Monochrome/MGreyLight`, `MGreyMiddleLight` | есть | нет | добавить как primitive в код или удалить |
| `Local/Status/StPrimary*` | есть | нет | удалить из Pixso (есть `palette.Primary.*`) |

### 3.5 Statistics
- **Цвета:** 149 токенов в Pixso → ожидаемо ~135 после очистки. Из них ~120 совпадают со значениями кода ✅, ~15 требуют решения дизайнера ⚠️.
- **Типографика:** 29 typography в Pixso → 32 после добавления Display'ов и удаления неиспользуемого. Все 4 Button и 11 Header'ов потребуют **перепривязки fontFamily/fontWeight** на новые primitive'ы.
- **Primitives (typo):** Pixso хранит fontSize/lineHeight под нумерованными ключами `0..8`/`0..7`. Переименовать в значащие (по числу px).

---

---

## 4. Resolved decisions (2026-05-03)

### 4.1 `Active/Secondary` — оказалось, всё совпадает (отмена ранее заявленного несовпадения)

**Что произошло:** в первой версии mapping-таблицы я ошибочно записал `emerald[200] = #80CBC4`. На деле:
```
emerald[100] = #CDE2E0   ↔ Pixso Active/SecondaryLight
emerald[200] = #B8D6D3   ↔ Pixso Active/Secondary       (НЕ #80CBC4 — это была опечатка)
emerald[300] = #82CDC6   ↔ Pixso Active/PrimaryLight
emerald[500] = #00AA9B   ↔ Pixso Active/Primary
emerald[600] = #639994   ↔ Pixso Active/SecondaryDark
emerald[700] = #0A7D6D   ↔ Pixso Active/PrimaryDark
```

То есть **emerald-палитра в коде уже выровнена с Active-палитрой Pixso 1:1**. Никакого несовпадения нет — все строки `palette.Primary.*`, `palette.Secondary.*`, `palette.Tertiary.*` помечены ✅ в §2.1 после исправления.

**Действие в коде по `palette.Secondary.*`:** **ничего не делаем**, код корректный. Никакого rename-impact на 11 файлов нет.

**Единственный нюанс по naming в §3.4:** `Active/SecondaryBG` (в Pixso темнее, 30%) и `Active/SecondaryBGLight` (светлее, 15%) ↔ `palette.Secondary.SecondaryBG` (в коде светлее, 15%) и `palette.Secondary.SecondaryBGDark` (темнее, 30%). Значения совпадают, но naming инвертирован. При переименовании в Pixso: `BG → palette/Secondary/SecondaryBGDark`, `BGLight → palette/Secondary/SecondaryBG` — чтобы соответствовать коду.

### 4.2 Pixso fontFamilies/fontWeights primitives — оставить как есть

**Причина:** на текущей машине шрифты SB Sans Display/Text/Screen/TextCond не установлены, поэтому в Pixso JSON они выглядят пусто (`fontFamilies."" = ""`). На корпоративном ноутбуке шрифты подцепятся — там будут реальные имена.

**Действие:**
- ❌ **НЕ переименовывать** Pixso primitives `fontFamilies.""`, `fontWeights."-0"`, `fontFamilies.sb-sans-interface`, `fontWeights.sb-sans-interface-1/2`. Оставляем 1:1 как сейчас.
- ❌ **НЕ создавать** в Pixso новые primitives `fontFamilies.SBDisplay/SBScreen/SBTextCond` — наши typography composite'ы будут ссылаться на существующие Pixso primitive'ы (даже если они empty). Имена (значения) шрифтов Pixso знает на корп-машине.
- При добавлении новых typography variant'ов (Display'ы) в Pixso ссылаемся на тот же `{fontFamilies.}` empty key, что и существующие Header'ы — designer на корп-машине заполнит.

**Отменяет:** строки таблицы §1.5 про переименование fontFamilies/fontWeights primitives и добавление SBDisplay/SBScreen/SBTextCond.

### 4.3 `Static/BG/BG_PAGE` — заменить gradient на single color

**Причина:** градиент только усложняет токенизацию, разница между stop'ами визуально незначительна (`#F5F7F7` → `#F2F7F7`). Берём более тёмный `#F2F7F7` как канон.

**Действие:**
- В Pixso: переименовать `Static/BG/BG_PAGE` → `palette/BG/BGPage`, тип `color`, значение `#F2F7F7`.
- В коде (отдельный fix позже): заменить `palette.BG.BGPageLinearStart` + `BGPageLinearEnd` на единый `palette.BG.BGPage = swamp['A200']` (= `#F2F7F7`). Удалить ключи `BGPageLinearStart/End` из `palette.ts`. Проверить, что `BG_PAGE` linear-gradient нигде не собирается из этих двух (надо grep'нуть).

**Impact в коде:** найти все использования `palette.BG.BGPageLinearStart/End` (вероятно мало — главное в global background стилях).

---

## 5. Next steps (после §4)

1. ~~Решить пункты 3.4 (Discuss)~~ ✅ закрыто решениями §4.1–4.3 (плюс открытыми остаются ~9 более мелких case'ов в §3.4: `Body-S-Eclipse`, `Pinned_*`, `Info.Info` дельта, `LinkLight` дельта, `Chart.CRed` дельта, `Rate.RLightBlue` дельта, `Product.PGrey` дельта, `BG_MainMenu` дельта, `Monochrome/MGreyLight,MiddleLight`, `Local/Status/StPrimary*`).
2. **Сгенерировать `tokens/primitive/color.json`** — из `src/styles/colors/*.ts` все 22 палитры × shades.
3. **Сгенерировать `tokens/semantic/palette.json`** — из `theme/palette.ts` с references на primitive'ы.
4. **Сгенерировать `tokens/semantic/typography.json`** — fontFamily-ссылки оставить на Pixso-primitive'ы (см. §4.2), не на код-имена.
5. **План применения в Pixso через MCP / вручную:**
   - Add: missing colors (InfoBlue, BGTableDefault, etc.), Display'ы (typography composite, fontFamily-ссылка пустая)
   - Rename: ~130+ переходов `Local/Static/Active/Situative` → `palette/...`, `_` и `-` уберать
   - Delete: 9 placeholder'ов `Status/01..09`, gradient `BG_PAGE` (после замены на single)
   - Discuss-пункты — оставляем, пока не пройдёмся по ним отдельно
6. **Code-side backlog item:** `palette.Secondary.*` → swamp-based (см. §4.1), `palette.BG.BGPage` consolidation (§4.3). Не блокирует генерацию tokens — можно сделать после.
