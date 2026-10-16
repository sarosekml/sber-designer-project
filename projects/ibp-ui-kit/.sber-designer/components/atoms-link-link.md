# Link

## Description for AI

**Purpose:** Navigational / action hyperlink — кликабельная текстовая ссылка для внутренних переходов (react-router) или внешних URL.
**Use when:**
- переход по внутреннему маршруту (prop: to)
- внешняя ссылка (prop: href)
- breadcrumbs
- ссылка внутри ProductRow / Tile / Modal
**Use instead:** Button for primary commands and form actions — use Button instead of Link for button-shaped triggers
**Variants:**
- `severity`: `default` — обычный цвет ссылки; `info` — информационная семантическая окраска; `success` — успех / подтверждение; `warning` — предупреждение; `error` — ошибка / опасное действие; `breadcrumbs1` — стиль для хлебных крошек (первый уровень); `breadcrumbs2` — стиль для хлебных крошек (второй уровень); `products` — ссылка-продукт
- `size`: `sm` — компактный размер; `md` — средний размер (по умолчанию); `lg` — крупный размер
- `underline`: `hover` — подчёркивание только при наведении; `none` — без подчёркивания; `always` — всегда подчёркнутая
- `color`: `inherit` — наследует цвет родителя
**Required props:** `children`, `to | href | onClick`
**Keywords:** link, anchor, hyperlink, breadcrumb

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{
  "descriptionLayer": {
    "purpose": "Navigational / action hyperlink — кликабельная текстовая ссылка для внутренних переходов (react-router) или внешних URL.",
    "anatomy": [],
    "usage": [],
    "agentGuidance": [],
    "schemaVersion": 1,
    "keywords": [
      "link",
      "anchor",
      "hyperlink",
      "breadcrumb"
    ],
    "whenToUse": [
      "переход по внутреннему маршруту (prop: to)",
      "внешняя ссылка (prop: href)",
      "breadcrumbs",
      "ссылка внутри ProductRow / Tile / Modal"
    ],
    "whenNotToUse": [
      "Button for primary commands and form actions — use Button instead of Link for button-shaped triggers"
    ],
    "variantGuidance": [
      {
        "prop": "severity",
        "values": [
          {
            "value": "default",
            "meaning": "обычный цвет ссылки"
          },
          {
            "value": "info",
            "meaning": "информационная семантическая окраска"
          },
          {
            "value": "success",
            "meaning": "успех / подтверждение"
          },
          {
            "value": "warning",
            "meaning": "предупреждение"
          },
          {
            "value": "error",
            "meaning": "ошибка / опасное действие"
          },
          {
            "value": "breadcrumbs1",
            "meaning": "стиль для хлебных крошек (первый уровень)"
          },
          {
            "value": "breadcrumbs2",
            "meaning": "стиль для хлебных крошек (второй уровень)"
          },
          {
            "value": "products",
            "meaning": "ссылка-продукт"
          }
        ]
      },
      {
        "prop": "size",
        "values": [
          {
            "value": "sm",
            "meaning": "компактный размер"
          },
          {
            "value": "md",
            "meaning": "средний размер (по умолчанию)"
          },
          {
            "value": "lg",
            "meaning": "крупный размер"
          }
        ]
      },
      {
        "prop": "underline",
        "values": [
          {
            "value": "hover",
            "meaning": "подчёркивание только при наведении"
          },
          {
            "value": "none",
            "meaning": "без подчёркивания"
          },
          {
            "value": "always",
            "meaning": "всегда подчёркнутая"
          }
        ]
      },
      {
        "prop": "color",
        "values": [
          {
            "value": "inherit",
            "meaning": "наследует цвет родителя"
          }
        ]
      }
    ],
    "requiredProps": [
      "children",
      "to | href | onClick"
    ],
    "status": "confirmed",
    "updatedAt": "2026-06-24T18:52:24.854Z"
  }
}
```
