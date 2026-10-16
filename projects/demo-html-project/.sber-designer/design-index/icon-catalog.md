# Icon catalog

## Icon resolution order

1. `project-icon-prop`: strings that are valid for the project icon component, usually `<Icon iconName="..." />`.
2. `project-asset`: imported local SVG/image assets.
3. `project-file`: local icon component files.
4. `external-icon-reference`: configured external icon folders; materialize before use.
5. `lucide-fallback`: built-in Lucide imports when no project icon fits.

Always call `get_indexed_icon` before using an icon. Lucide fallback icons are valid for `lucide-react` imports, not for a project `Icon` string prop unless the same name appears as `project-icon-prop`.

Project iconName values: 247
- a-risk: <i data-icon="a-risk" />
- activity-heart: <i data-icon="activity-heart" />
- add: <i data-icon="add" />
- add-circle: <i data-icon="add-circle" />
- admin-ckp: <i data-icon="admin-ckp" />
- admin-panel-settings: <i data-icon="admin-panel-settings" />
- ai-stars: <i data-icon="ai-stars" />
- ai-stars-02: <i data-icon="ai-stars-02" />
- alert-circle: <i data-icon="alert-circle" />
- alert-circle-filled: <i data-icon="alert-circle-filled" />
- alert-triangle: <i data-icon="alert-triangle" />
- alert-triangle-filled: <i data-icon="alert-triangle-filled" />
- archive: <i data-icon="archive" />
- arrow-block-down-filled: <i data-icon="arrow-block-down-filled" />
- arrow-block-left: <i data-icon="arrow-block-left" />
- arrow-block-left-filled: <i data-icon="arrow-block-left-filled" />
- arrow-block-right: <i data-icon="arrow-block-right" />
- arrow-block-right-filled: <i data-icon="arrow-block-right-filled" />
- arrow-block-up-filled: <i data-icon="arrow-block-up-filled" />
- arrow-circle-down: <i data-icon="arrow-circle-down" />
- arrow-circle-down-filled: <i data-icon="arrow-circle-down-filled" />
- arrow-circle-left: <i data-icon="arrow-circle-left" />
- arrow-circle-left-filled: <i data-icon="arrow-circle-left-filled" />
- arrow-circle-right: <i data-icon="arrow-circle-right" />
- arrow-circle-right-filled: <i data-icon="arrow-circle-right-filled" />
- arrow-circle-up: <i data-icon="arrow-circle-up" />
- arrow-circle-up-filled: <i data-icon="arrow-circle-up-filled" />
- arrow-down: <i data-icon="arrow-down" />
- arrow-down-left: <i data-icon="arrow-down-left" />
- arrow-down-right: <i data-icon="arrow-down-right" />
- arrow-left: <i data-icon="arrow-left" />
- arrow-left-right: <i data-icon="arrow-left-right" />
- arrow-narrow-down: <i data-icon="arrow-narrow-down" />
- arrow-narrow-down-left: <i data-icon="arrow-narrow-down-left" />
- arrow-narrow-down-right: <i data-icon="arrow-narrow-down-right" />
- arrow-narrow-left: <i data-icon="arrow-narrow-left" />
- arrow-narrow-right: <i data-icon="arrow-narrow-right" />
- arrow-narrow-up: <i data-icon="arrow-narrow-up" />
- arrow-narrow-up-left: <i data-icon="arrow-narrow-up-left" />
- arrow-narrow-up-right: <i data-icon="arrow-narrow-up-right" />
- arrow-right: <i data-icon="arrow-right" />
- arrow-trend-up: <i data-icon="arrow-trend-up" />
- arrow-up: <i data-icon="arrow-up" />
- arrow-up-down: <i data-icon="arrow-up-down" />
- arrow-up-left: <i data-icon="arrow-up-left" />
- arrow-up-right: <i data-icon="arrow-up-right" />
- attach: <i data-icon="attach" />
- bank: <i data-icon="bank" />
- bar-chart: <i data-icon="bar-chart" />
- bar-chart-square: <i data-icon="bar-chart-square" />
- bar-chart-square-plus: <i data-icon="bar-chart-square-plus" />
- bar-line-chart: <i data-icon="bar-line-chart" />
- battery-charging-02: <i data-icon="battery-charging-02" />
- blocked: <i data-icon="blocked" />
- bookmark-add: <i data-icon="bookmark-add" />
- bookmark-check: <i data-icon="bookmark-check" />
- bookmark-check-filled: <i data-icon="bookmark-check-filled" />
- bookmark-minus: <i data-icon="bookmark-minus" />
- building-01: <i data-icon="building-01" />
- building-02: <i data-icon="building-02" />
- building-03: <i data-icon="building-03" />
- building-07: <i data-icon="building-07" />
- burger: <i data-icon="burger" />
- calc: <i data-icon="calc" />
- calclate-fv: <i data-icon="calclate-fv" />
- calendar: <i data-icon="calendar" />
- calendar-check-01: <i data-icon="calendar-check-01" />
- calendar-check-02: <i data-icon="calendar-check-02" />
- calendar-close-cancel: <i data-icon="calendar-close-cancel" />
- calendar-edit: <i data-icon="calendar-edit" />
- calendar-minus: <i data-icon="calendar-minus" />
- calendar-plus: <i data-icon="calendar-plus" />
- cash-flow: <i data-icon="cash-flow" />
- check: <i data-icon="check" />
- check-box: <i data-icon="check-box" />
- check-box-blank: <i data-icon="check-box-blank" />
- check-box-indeterminate: <i data-icon="check-box-indeterminate" />
- check-circle: <i data-icon="check-circle" />
- check-circle-filled: <i data-icon="check-circle-filled" />
- check-circle-warning: <i data-icon="check-circle-warning" />

Project asset icons: 0

Project file icons: 0

External icon references: 0

Lucide fallback icons: 1535
- AArrowDown: import { AArrowDown } from 'lucide-react'
- AArrowUp: import { AArrowUp } from 'lucide-react'
- Accessibility: import { Accessibility } from 'lucide-react'
- Activity: import { Activity } from 'lucide-react'
- Airplay: import { Airplay } from 'lucide-react'
- AirVent: import { AirVent } from 'lucide-react'
- ALargeSmall: import { ALargeSmall } from 'lucide-react'
- AlarmClock: import { AlarmClock } from 'lucide-react'
- AlarmClockCheck: import { AlarmClockCheck } from 'lucide-react'
- AlarmClockMinus: import { AlarmClockMinus } from 'lucide-react'
- AlarmClockOff: import { AlarmClockOff } from 'lucide-react'
- AlarmClockPlus: import { AlarmClockPlus } from 'lucide-react'
- AlarmSmoke: import { AlarmSmoke } from 'lucide-react'
- Album: import { Album } from 'lucide-react'
- AlignCenter: import { AlignCenter } from 'lucide-react'
- AlignCenterHorizontal: import { AlignCenterHorizontal } from 'lucide-react'
- AlignCenterVertical: import { AlignCenterVertical } from 'lucide-react'
- AlignEndHorizontal: import { AlignEndHorizontal } from 'lucide-react'
- AlignEndVertical: import { AlignEndVertical } from 'lucide-react'
- AlignHorizontalDistributeCenter: import { AlignHorizontalDistributeCenter } from 'lucide-react'
- AlignHorizontalDistributeEnd: import { AlignHorizontalDistributeEnd } from 'lucide-react'
- AlignHorizontalDistributeStart: import { AlignHorizontalDistributeStart } from 'lucide-react'
- AlignHorizontalJustifyCenter: import { AlignHorizontalJustifyCenter } from 'lucide-react'
- AlignHorizontalJustifyEnd: import { AlignHorizontalJustifyEnd } from 'lucide-react'
- AlignHorizontalJustifyStart: import { AlignHorizontalJustifyStart } from 'lucide-react'
- AlignHorizontalSpaceAround: import { AlignHorizontalSpaceAround } from 'lucide-react'
- AlignHorizontalSpaceBetween: import { AlignHorizontalSpaceBetween } from 'lucide-react'
- AlignJustify: import { AlignJustify } from 'lucide-react'
- AlignLeft: import { AlignLeft } from 'lucide-react'
- AlignRight: import { AlignRight } from 'lucide-react'
- AlignStartHorizontal: import { AlignStartHorizontal } from 'lucide-react'
- AlignStartVertical: import { AlignStartVertical } from 'lucide-react'
- AlignVerticalDistributeCenter: import { AlignVerticalDistributeCenter } from 'lucide-react'
- AlignVerticalDistributeEnd: import { AlignVerticalDistributeEnd } from 'lucide-react'
- AlignVerticalDistributeStart: import { AlignVerticalDistributeStart } from 'lucide-react'
- AlignVerticalJustifyCenter: import { AlignVerticalJustifyCenter } from 'lucide-react'
- AlignVerticalJustifyEnd: import { AlignVerticalJustifyEnd } from 'lucide-react'
- AlignVerticalJustifyStart: import { AlignVerticalJustifyStart } from 'lucide-react'
- AlignVerticalSpaceAround: import { AlignVerticalSpaceAround } from 'lucide-react'
- AlignVerticalSpaceBetween: import { AlignVerticalSpaceBetween } from 'lucide-react'
- Ambulance: import { Ambulance } from 'lucide-react'
- Ampersand: import { Ampersand } from 'lucide-react'
- Ampersands: import { Ampersands } from 'lucide-react'
- Amphora: import { Amphora } from 'lucide-react'
- Anchor: import { Anchor } from 'lucide-react'
- Angry: import { Angry } from 'lucide-react'
- Annoyed: import { Annoyed } from 'lucide-react'
- Antenna: import { Antenna } from 'lucide-react'
- Anvil: import { Anvil } from 'lucide-react'
- Aperture: import { Aperture } from 'lucide-react'
- Apple: import { Apple } from 'lucide-react'
- AppWindow: import { AppWindow } from 'lucide-react'
- AppWindowMac: import { AppWindowMac } from 'lucide-react'
- Archive: import { Archive } from 'lucide-react'
- ArchiveRestore: import { ArchiveRestore } from 'lucide-react'
- ArchiveX: import { ArchiveX } from 'lucide-react'
- Armchair: import { Armchair } from 'lucide-react'
- ArrowBigDown: import { ArrowBigDown } from 'lucide-react'
- ArrowBigDownDash: import { ArrowBigDownDash } from 'lucide-react'
- ArrowBigLeft: import { ArrowBigLeft } from 'lucide-react'
- ArrowBigLeftDash: import { ArrowBigLeftDash } from 'lucide-react'
- ArrowBigRight: import { ArrowBigRight } from 'lucide-react'
- ArrowBigRightDash: import { ArrowBigRightDash } from 'lucide-react'
- ArrowBigUp: import { ArrowBigUp } from 'lucide-react'
- ArrowBigUpDash: import { ArrowBigUpDash } from 'lucide-react'
- ArrowDown: import { ArrowDown } from 'lucide-react'
- ArrowDown01: import { ArrowDown01 } from 'lucide-react'
- ArrowDown10: import { ArrowDown10 } from 'lucide-react'
- ArrowDownAZ: import { ArrowDownAZ } from 'lucide-react'
- ArrowDownFromLine: import { ArrowDownFromLine } from 'lucide-react'
- ArrowDownLeft: import { ArrowDownLeft } from 'lucide-react'
- ArrowDownNarrowWide: import { ArrowDownNarrowWide } from 'lucide-react'
- ArrowDownRight: import { ArrowDownRight } from 'lucide-react'
- ArrowDownToDot: import { ArrowDownToDot } from 'lucide-react'
- ArrowDownToLine: import { ArrowDownToLine } from 'lucide-react'
- ArrowDownUp: import { ArrowDownUp } from 'lucide-react'
- ArrowDownWideNarrow: import { ArrowDownWideNarrow } from 'lucide-react'
- ArrowDownZA: import { ArrowDownZA } from 'lucide-react'
- ArrowLeft: import { ArrowLeft } from 'lucide-react'
- ArrowLeftFromLine: import { ArrowLeftFromLine } from 'lucide-react'

