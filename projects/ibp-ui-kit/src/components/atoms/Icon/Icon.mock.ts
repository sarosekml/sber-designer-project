import { ComponentType } from 'react';

import { SvgIconProps } from './icons/icons.types';
import { iconsMap } from './Icon.const';
import {
  Add,
  AddCircle,
  AdminCkp,
  AdminPanelSettings,
  AiStars,
  AiStars02,
  AlertCircle,
  AlertCircleFilled,
  AlertTriangle,
  AlertTriangleFilled,
  Archive,
  ARisk,
  ArrowBlockDown,
  ArrowBlockDownFilled,
  ArrowBlockLeft,
  ArrowBlockLeftFilled,
  ArrowBlockLeftOutlined,
  ArrowBlockRight,
  ArrowBlockRightFilled,
  ArrowBlockRightOutlined,
  ArrowBlockUp,
  ArrowBlockUpFilled,
  ArrowCircleDown,
  ArrowCircleDownFilled,
  ArrowCircleLeft,
  ArrowCircleLeftFilled,
  ArrowCircleRight,
  ArrowCircleRightFilled,
  ArrowCircleUp,
  ArrowCircleUpFilled,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowNarrowDown,
  ArrowNarrowDownLeft,
  ArrowNarrowDownRight,
  ArrowNarrowLeft,
  ArrowNarrowRight,
  ArrowNarrowUp,
  ArrowNarrowUpLeft,
  ArrowNarrowUpRight,
  ArrowRight,
  ArrowTrendUp,
  ArrowUp,
  ArrowUpDown,
  ArrowUpLeft,
  ArrowUpRight,
  Attach,
  Bank,
  BarChartSquare,
  BarLineChart,
  BBBArrowLeft,
  BBBArrowRight,
  BindingLeads,
  Blocked,
  BookmarkAdd,
  BookmarkCheck,
  BookmarkCheckFilled,
  BookmarkMinus,
  Building,
  Building01,
  Building02,
  Building03,
  Calc,
  CalclateFv,
  CalculateFV,
  Calendar,
  CalendarEdit,
  CashFlow,
  Check,
  CheckBox,
  CheckBoxBlank,
  CheckBoxIndeterminate,
  CheckCircle,
  CheckCircleFilled,
  CheckCircleWarning,
  CheckShield,
  CheckVerified,
  ChevronDown,
  ChevronLeft,
  ChevronLeftDouble,
  ChevronRight,
  ChevronRightDouble,
  ChevronUp,
  Circle,
  CircleFilled,
  CircleFilledPartly,
  CircleFilledSmall,
  CkpPipeline,
  ClientSearch,
  ClockFastForward,
  ClockTimer,
  Close,
  CloseCircle,
  ConnectionLost,
  Copy,
  CorporateTransactions,
  CurrentDepo,
  DcmPipeline,
  DcmPotentials,
  DealsPossibleDeals,
  DocumentCheck,
  DocumentSigned,
  DocumentUnread,
  Download,
  DownloadReport,
  DragDots,
  EcmPipeline,
  Edit,
  Factory01,
  File,
  FileAttachment,
  FileBasic,
  FileCheck,
  FileForward,
  FileOffClose,
  FileSearch,
  FileSigned,
  Filter,
  FilterReset,
  FlipBackward,
  FlipForward,
  Folder,
  FolderArrowForward,
  FolderArrowForward02,
  FolderBack,
  FolderBack02,
  FolderCheck,
  FolderCloseX,
  FolderCloseX02,
  FolderDeleteClose,
  FolderPlus,
  ForeignTask,
  Gigachat,
  GigachatSalut,
  Global,
  HelpCircle,
  HelpCircleFilled,
  History,
  Icon,
  ImportantDeals,
  ImportantLeads,
  InfoCircle,
  InfoCircleFilled,
  KpkiCal,
  Layer01,
  Layer02,
  Layer03,
  LayerSingle,
  LayersThree01,
  LayersTwo01,
  LayoutGrid01,
  LayoutGrid02,
  LayoutRows01,
  LayoutRows02,
  LeftMenu,
  Link,
  LinkBroken,
  LinkExternal,
  ListView01,
  ListView02,
  Loader,
  Lock,
  Logout,
  Mail,
  MainPage,
  MarkerPin,
  MarkerPin01,
  Maximize,
  MessageGigachat,
  MessageStar,
  MessageText,
  Minimize,
  Minus,
  MinusCircle,
  MnaPipeline,
  Modify,
  MoreDots,
  MoreDotsHorizontal,
  Normilize,
  OpenWide,
  Passport,
  PaymentsIb,
  PercentCircle,
  Phone,
  PieChart,
  Pin,
  PinFilled,
  PinMenu,
  Pipeline,
  PmcDashboard,
  PointerDown,
  PointerLeft,
  PointerRight,
  PointerUp,
  PossibleLeads,
  Potencial,
  PotentialsRd,
  PresentationChart,
  Pulsar1,
  Pulsar2,
  QliksenseReports,
  RadioButtonChecked,
  RadioButtonUnchecked,
  Refresh,
  Registry,
  Reports1C,
  Reserve,
  RWA,
  SalesCompany,
  SalesProjects,
  Save,
  Search,
  Send,
  Settings,
  Sort,
  SortDown,
  SortUp,
  SpacingHeight,
  Star,
  StarFilled,
  SwapCurrency,
  Syncronyze,
  Target,
  Tasks,
  ThumbDown,
  ThumbDownFilled,
  ThumbsDown,
  ThumbsUp,
  ThumbUpFilled,
  Trash,
  TreeView,
  TrendDown,
  TrendUp,
  UnpinMenu,
  Upload,
  User,
  UserCircle,
  VisibilityOff,
  VisibilityOn,
  XCircle,
} from './icons';

type IconMockMapType = {
  icon: ComponentType<SvgIconProps>;
  oldName: string;
};

export const iconsMockMap: Record<keyof typeof iconsMap, IconMockMapType> = {
  Add: { icon: Add, oldName: 'ADD_FILLED, ADD' },
  AddCircle: { icon: AddCircle, oldName: '-' },
  AdminCkp: { icon: AdminCkp, oldName: '-' },
  AdminPanelSettings: { icon: AdminPanelSettings, oldName: '-' },

  AiStars: {
    icon: AiStars,
    oldName: '-',
  },

  AiStars02: {
    icon: AiStars02,
    oldName: "-"
  },

  AlertCircle: { icon: AlertCircle, oldName: 'Error, AlertErrorIcon' },

  AlertCircleFilled: {
    icon: AlertCircleFilled,
    oldName: '-',
  },

  AlertTriangle: { icon: AlertTriangle, oldName: 'Warning' },

  AlertTriangleFilled: {
    icon: AlertTriangleFilled,
    oldName: '-',
  },

  Archive: { icon: Archive, oldName: '-' },
  ARisk: { icon: ARisk, oldName: 'Spellcheck' },
  ArrowBlockDown: { icon: ArrowBlockDown, oldName: '-' },

  ArrowBlockDownFilled: {
    icon: ArrowBlockDownFilled,
    oldName: '-',
  },

  ArrowBlockLeft: { icon: ArrowBlockLeft, oldName: '-' },

  ArrowBlockLeftFilled: {
    icon: ArrowBlockLeftFilled,
    oldName: '-',
  },

  ArrowBlockLeftOutlined: { icon: ArrowBlockLeftOutlined, oldName: '-' },
  ArrowBlockRight: { icon: ArrowBlockRight, oldName: '-' },

  ArrowBlockRightFilled: {
    icon: ArrowBlockRightFilled,
    oldName: '-',
  },

  ArrowBlockRightOutlined: { icon: ArrowBlockRightOutlined, oldName: '-' },
  ArrowBlockUp: { icon: ArrowBlockUp, oldName: '-' },

  ArrowBlockUpFilled: {
    icon: ArrowBlockUpFilled,
    oldName: '-',
  },

  ArrowCircleDown: { icon: ArrowCircleDown, oldName: '-' },
  ArrowCircleDownFilled: { icon: ArrowCircleDownFilled, oldName: '-' },
  ArrowCircleLeft: { icon: ArrowCircleLeft, oldName: '-' },
  ArrowCircleLeftFilled: { icon: ArrowCircleLeftFilled, oldName: '-' },
  ArrowCircleRight: { icon: ArrowCircleRight, oldName: '-' },
  ArrowCircleRightFilled: { icon: ArrowCircleRightFilled, oldName: '-' },
  ArrowCircleUp: { icon: ArrowCircleUp, oldName: '-' },
  ArrowCircleUpFilled: { icon: ArrowCircleUpFilled, oldName: '-' },
  ArrowDown: { icon: ArrowDown, oldName: '-' },
  ArrowDownLeft: { icon: ArrowDownLeft, oldName: '-' },
  ArrowDownRight: { icon: ArrowDownRight, oldName: '-' },
  ArrowLeft: { icon: ArrowLeft, oldName: '-' },
  ArrowLeftRight: { icon: ArrowLeftRight, oldName: '-' },
  ArrowNarrowDown: { icon: ArrowNarrowDown, oldName: '-' },
  ArrowNarrowDownLeft: { icon: ArrowNarrowDownLeft, oldName: 'PaymentIncoming' },
  ArrowNarrowDownRight: { icon: ArrowNarrowDownRight, oldName: '-' },
  ArrowNarrowLeft: { icon: ArrowNarrowLeft, oldName: '-' },
  ArrowNarrowRight: { icon: ArrowNarrowRight, oldName: '-' },
  ArrowNarrowUp: { icon: ArrowNarrowUp, oldName: '-' },
  ArrowNarrowUpLeft: { icon: ArrowNarrowUpLeft, oldName: '-' },
  ArrowNarrowUpRight: { icon: ArrowNarrowUpRight, oldName: 'PaymentOutgoing' },
  ArrowRight: { icon: ArrowRight, oldName: 'ArrowForward_small, ArrowForward' },

  ArrowTrendUp: {
    icon: ArrowTrendUp,
    oldName: '-',
  },

  ArrowUp: { icon: ArrowUp, oldName: '-' },
  ArrowUpDown: { icon: ArrowUpDown, oldName: '-' },
  ArrowUpLeft: { icon: ArrowUpLeft, oldName: '-' },
  ArrowUpRight: { icon: ArrowUpRight, oldName: '-' },
  Attach: { icon: Attach, oldName: 'AttachFile, AttachFileOutlined' },
  Bank: { icon: Bank, oldName: '-' },
  BarChartSquare: { icon: BarChartSquare, oldName: 'InsertChartOutlined' },

  BarLineChart: {
    icon: BarLineChart,
    oldName: '-',
  },

  BBBArrowLeft: { icon: BBBArrowLeft, oldName: '-' },
  BBBArrowRight: { icon: BBBArrowRight, oldName: '-' },
  BindingLeads: { icon: BindingLeads, oldName: '-' },
  Blocked: { icon: Blocked, oldName: 'NotInterested' },
  BookmarkAdd: { icon: BookmarkAdd, oldName: '-' },
  BookmarkCheck: { icon: BookmarkCheck, oldName: '-' },
  BookmarkCheckFilled: { icon: BookmarkCheckFilled, oldName: '-' },
  BookmarkMinus: { icon: BookmarkMinus, oldName: '-' },
  Building: { icon: Building, oldName: '-' },

  Building01: {
    icon: Building01,
    oldName: '-',
  },

  Building02: {
    icon: Building02,
    oldName: '-',
  },

  Building03: {
    icon: Building03,
    oldName: '-',
  },

  Calc: { icon: Calc, oldName: 'Calculate' },

  CalclateFv: {
    icon: CalclateFv,
    oldName: '-',
  },

  CalculateFV: { icon: CalculateFV, oldName: '-' },
  Calendar: { icon: Calendar, oldName: 'CalendarToday' },
  CalendarEdit: { icon: CalendarEdit, oldName: '-' },
  CashFlow: { icon: CashFlow, oldName: 'StackedLineChart' },
  Check: { icon: Check, oldName: 'DONE, APPLY, Check' },
  CheckBox: { icon: CheckBox, oldName: '-' },
  CheckBoxBlank: { icon: CheckBoxBlank, oldName: '-' },
  CheckBoxIndeterminate: { icon: CheckBoxIndeterminate, oldName: '-' },
  CheckCircle: { icon: CheckCircle, oldName: 'CheckCircleSmoothOutlined' },
  CheckCircleFilled: { icon: CheckCircleFilled, oldName: 'CheckCircleRounded' },

  CheckCircleWarning: {
    icon: CheckCircleWarning,
    oldName: '-',
  },

  CheckShield: { icon: CheckShield, oldName: 'VerifiedUser' },
  CheckVerified: { icon: CheckVerified, oldName: '-' },
  ChevronDown: { icon: ChevronDown, oldName: 'EXPAND_MORE, KeyboardArrowDown' },
  ChevronLeft: { icon: ChevronLeft, oldName: 'KeyboardArrowLeft' },
  ChevronLeftDouble: { icon: ChevronLeftDouble, oldName: '-' },
  ChevronRight: { icon: ChevronRight, oldName: 'ArrowForwardIos, KeyboardArrowRight' },
  ChevronRightDouble: { icon: ChevronRightDouble, oldName: '-' },
  ChevronUp: { icon: ChevronUp, oldName: 'EXPAND_LESS, KeyboardArrowUp' },
  Circle: { icon: Circle, oldName: 'CircleRounded, EmptyCircle, RadioButtonUncheckedOutlined' },
  CircleFilled: { icon: CircleFilled, oldName: '-' },

  CircleFilledPartly: {
    icon: CircleFilledPartly,
    oldName: '-',
  },

  CircleFilledSmall: {
    icon: CircleFilledSmall,
    oldName: '-',
  },

  CkpPipeline: { icon: CkpPipeline, oldName: 'Pipeline' },
  ClientSearch: { icon: ClientSearch, oldName: 'LocationCity' },
  ClockFastForward: { icon: ClockFastForward, oldName: '-' },
  ClockTimer: { icon: ClockTimer, oldName: '-' },
  Close: { icon: Close, oldName: 'CLOSE' },
  CloseCircle: { icon: CloseCircle, oldName: 'CancelCircle, CrossCircleSmoothOutlined' },
  ConnectionLost: { icon: ConnectionLost, oldName: 'CloudOff' },
  Copy: { icon: Copy, oldName: '-' },
  CorporateTransactions: { icon: CorporateTransactions, oldName: 'ContactMail' },
  CurrentDepo: { icon: CurrentDepo, oldName: 'DealsMenuIcon' },
  DcmPipeline: { icon: DcmPipeline, oldName: '-' },

  DcmPotentials: {
    icon: DcmPotentials,
    oldName: '-',
  },

  DealsPossibleDeals: { icon: DealsPossibleDeals, oldName: 'AssignmentOutlined' },

  DocumentCheck: {
    icon: DocumentCheck,
    oldName: '-',
  },

  DocumentSigned: {
    icon: DocumentSigned,
    oldName: '-',
  },

  DocumentUnread: {
    icon: DocumentUnread,
    oldName: '-',
  },

  Download: { icon: Download, oldName: 'DOWNLOAD_FILLED, DOWNLOAD' },
  DownloadReport: { icon: DownloadReport, oldName: 'Description, DocumentOutlinedIcon' },
  DragDots: { icon: DragDots, oldName: 'DRAG_AND_DROP' },
  EcmPipeline: { icon: EcmPipeline, oldName: '-' },
  Edit: { icon: Edit, oldName: 'EDIT' },
  Factory01: { icon: Factory01, oldName: '-' },
  File: { icon: File, oldName: '-' },

  FileAttachment: {
    icon: FileAttachment,
    oldName: '-',
  },

  FileBasic: {
    icon: FileBasic,
    oldName: '-',
  },

  FileCheck: { icon: FileCheck, oldName: '-' },

  FileForward: {
    icon: FileForward,
    oldName: '-',
  },

  FileOffClose: {
    icon: FileOffClose,
    oldName: '-',
  },

  FileSearch: { icon: FileSearch, oldName: '-' },

  FileSigned: {
    icon: FileSigned,
    oldName: '-',
  },

  Filter: { icon: Filter, oldName: 'FilterAlt' },
  FilterReset: { icon: FilterReset, oldName: 'FilterAltOff' },
  FlipBackward: { icon: FlipBackward, oldName: '-' },
  FlipForward: { icon: FlipForward, oldName: '-' },
  Folder: { icon: Folder, oldName: 'FolderOpenOutlined' },
  FolderArrowForward: { icon: FolderArrowForward, oldName: 'DriveFileMoveIcon' },

  FolderArrowForward02: {
    icon: FolderArrowForward02,
    oldName: "-"
  },

  FolderBack: {
    icon: FolderBack,
    oldName: '-',
  },

  FolderBack02: {
    icon: FolderBack02,
    oldName: "-"
  },

  FolderCheck: {
    icon: FolderCheck,
    oldName: '-',
  },

  FolderCloseX: {
    icon: FolderCloseX,
    oldName: "-"
  },

  FolderCloseX02: {
    icon: FolderCloseX02,
    oldName: "-"
  },

  FolderDeleteClose: {
    icon: FolderDeleteClose,
    oldName: '-',
  },

  FolderPlus: { icon: FolderPlus, oldName: '-' },
  ForeignTask: { icon: ForeignTask, oldName: 'SwapHorizontalCircle' },
  Gigachat: { icon: Gigachat, oldName: '-' },
  GigachatSalut: { icon: GigachatSalut, oldName: 'AnalysisIcon' },
  Global: { icon: Global, oldName: 'Language' },
  HelpCircle: { icon: HelpCircle, oldName: 'HelpOutlined' },
  HelpCircleFilled: { icon: HelpCircleFilled, oldName: '-' },
  History: { icon: History, oldName: 'ExpectedIcon, Restore' },

  Icon: {
    icon: Icon,
    oldName: '-',
  },

  ImportantDeals: { icon: ImportantDeals, oldName: 'NecessaryOpportunitiesLate' },

  ImportantLeads: {
    icon: ImportantLeads,
    oldName: "-"
  },

  InfoCircle: { icon: InfoCircle, oldName: 'InfoOutlined' },
  InfoCircleFilled: { icon: InfoCircleFilled, oldName: 'InfoRounded' },
  KpkiCal: { icon: KpkiCal, oldName: 'CalendarKpki' },

  Layer01: {
    icon: Layer01,
    oldName: '-',
  },

  Layer02: {
    icon: Layer02,
    oldName: '-',
  },

  Layer03: {
    icon: Layer03,
    oldName: '-',
  },

  LayerSingle: { icon: LayerSingle, oldName: '-' },
  LayersThree01: { icon: LayersThree01, oldName: '-' },
  LayersTwo01: { icon: LayersTwo01, oldName: '-' },

  LayoutGrid01: {
    icon: LayoutGrid01,
    oldName: "-"
  },

  LayoutGrid02: {
    icon: LayoutGrid02,
    oldName: "-"
  },

  LayoutRows01: {
    icon: LayoutRows01,
    oldName: "-"
  },

  LayoutRows02: {
    icon: LayoutRows02,
    oldName: "-"
  },

  LeftMenu: { icon: LeftMenu, oldName: 'Menu' },
  Link: { icon: Link, oldName: 'Link' },
  LinkBroken: { icon: LinkBroken, oldName: '-' },
  LinkExternal: { icon: LinkExternal, oldName: 'Launch, OpenInNew' },

  ListView01: {
    icon: ListView01,
    oldName: "-"
  },

  ListView02: {
    icon: ListView02,
    oldName: "-"
  },

  Loader: {
    icon: Loader,
    oldName: '-',
  },

  Lock: { icon: Lock, oldName: '-' },
  Logout: { icon: Logout, oldName: 'Logout' },
  Mail: { icon: Mail, oldName: 'MAIL' },
  MainPage: { icon: MainPage, oldName: 'Home' },

  MarkerPin: {
    icon: MarkerPin,
    oldName: '-',
  },

  MarkerPin01: { icon: MarkerPin01, oldName: '-' },
  Maximize: { icon: Maximize, oldName: '-' },
  MessageGigachat: { icon: MessageGigachat, oldName: '-' },
  MessageStar: { icon: MessageStar, oldName: '-' },
  MessageText: { icon: MessageText, oldName: '-' },
  Minimize: { icon: Minimize, oldName: '-' },

  Minus: {
    icon: Minus,
    oldName: "-"
  },

  MinusCircle: { icon: MinusCircle, oldName: 'DELETE' },
  MnaPipeline: { icon: MnaPipeline, oldName: 'MAPipelineSidebarIcon' },
  Modify: { icon: Modify, oldName: 'SpotIcon' },
  MoreDots: { icon: MoreDots, oldName: 'MORE_VERT' },
  MoreDotsHorizontal: { icon: MoreDotsHorizontal, oldName: '-' },
  Normilize: { icon: Normilize, oldName: 'VerticalAlignCenter' },
  OpenWide: { icon: OpenWide, oldName: 'OpenInFull' },

  Passport: {
    icon: Passport,
    oldName: '-',
  },

  PaymentsIb: { icon: PaymentsIb, oldName: '-' },
  PercentCircle: { icon: PercentCircle, oldName: '-' },

  Phone: {
    icon: Phone,
    oldName: '-',
  },

  PieChart: { icon: PieChart, oldName: '-' },
  Pin: { icon: Pin, oldName: 'PinIcon' },
  PinFilled: { icon: PinFilled, oldName: 'PinFilledIcon' },

  PinMenu: {
    icon: PinMenu,
    oldName: "-"
  },

  Pipeline: { icon: Pipeline, oldName: 'Pipeline' },
  PmcDashboard: { icon: PmcDashboard, oldName: '-' },
  PointerDown: { icon: PointerDown, oldName: 'ArrowDropDown' },
  PointerLeft: { icon: PointerLeft, oldName: 'ArrowDropLeft' },
  PointerRight: { icon: PointerRight, oldName: 'ArrowDropRight' },
  PointerUp: { icon: PointerUp, oldName: 'ArrowDropUp' },
  PossibleLeads: { icon: PossibleLeads, oldName: '-' },
  Potencial: { icon: Potencial, oldName: '-' },

  PotentialsRd: {
    icon: PotentialsRd,
    oldName: "-"
  },

  PresentationChart: {
    icon: PresentationChart,
    oldName: '-',
  },

  Pulsar1: {
    icon: Pulsar1,
    oldName: '-',
  },

  Pulsar2: {
    icon: Pulsar2,
    oldName: '-',
  },

  QliksenseReports: { icon: QliksenseReports, oldName: '-' },
  RadioButtonChecked: { icon: RadioButtonChecked, oldName: '-' },
  RadioButtonUnchecked: { icon: RadioButtonUnchecked, oldName: '-' },
  Refresh: { icon: Refresh, oldName: 'Refresh' },
  Registry: { icon: Registry, oldName: 'RegisterMenuIcon' },
  Reports1C: { icon: Reports1C, oldName: 'OneCMenuIcon' },
  Reserve: { icon: Reserve, oldName: '-' },

  RWA: {
    icon: RWA,
    oldName: '-',
  },

  SalesCompany: { icon: SalesCompany, oldName: 'SalesCampaignsIcon' },
  SalesProjects: { icon: SalesProjects, oldName: 'CIBSalesProject' },

  Save: {
    icon: Save,
    oldName: "-"
  },

  Search: { icon: Search, oldName: 'SearchOutlined' },
  Send: { icon: Send, oldName: 'Send' },
  Settings: { icon: Settings, oldName: 'SettingsOutlined' },
  Sort: { icon: Sort, oldName: 'SortTableIcon' },
  SortDown: { icon: SortDown, oldName: 'SortTableIconDown' },
  SortUp: { icon: SortUp, oldName: 'SortTableIconUp' },

  SpacingHeight: {
    icon: SpacingHeight,
    oldName: '-',
  },

  Star: { icon: Star, oldName: 'StarBorder' },
  StarFilled: { icon: StarFilled, oldName: 'Star' },

  SwapCurrency: {
    icon: SwapCurrency,
    oldName: '-',
  },

  Syncronyze: { icon: Syncronyze, oldName: 'Cached' },

  Target: {
    icon: Target,
    oldName: '-',
  },

  Tasks: { icon: Tasks, oldName: 'Task' },

  ThumbDown: {
    icon: ThumbDown,
    oldName: '-',
  },

  ThumbDownFilled: { icon: ThumbDownFilled, oldName: '-' },
  ThumbsDown: { icon: ThumbsDown, oldName: '-' },
  ThumbsUp: { icon: ThumbsUp, oldName: '-' },
  ThumbUpFilled: { icon: ThumbUpFilled, oldName: '-' },
  Trash: { icon: Trash, oldName: 'BasketOutline, BASKET, BasketOutline2' },

  TreeView: {
    icon: TreeView,
    oldName: "-"
  },

  TrendDown: {
    icon: TrendDown,
    oldName: '-',
  },

  TrendUp: {
    icon: TrendUp,
    oldName: '-',
  },

  UnpinMenu: {
    icon: UnpinMenu,
    oldName: "-"
  },

  Upload: { icon: Upload, oldName: 'FileUpload, Publish' },
  User: { icon: User, oldName: 'AssignmentInd' },

  UserCircle: {
    icon: UserCircle,
    oldName: '-',
  },

  VisibilityOff: { icon: VisibilityOff, oldName: '-' },
  VisibilityOn: { icon: VisibilityOn, oldName: '-' },

  XCircle: {
    icon: XCircle,
    oldName: '-',
  }
};
