# UI Context

## Design System

Ant Design 5 on React 18. This is a pure React SPA — no Fiori Elements,
no SAP UI5 components. The design language is Ant Design's default light theme.
All components come from `antd` unless noted otherwise.

## Theme

- **Mode**: Light (default Ant Design theme)
- **Primary color**: `#1677FF` (Ant Design 5 default blue)
- Customize via Ant Design `ConfigProvider` theme tokens if needed —
  do not override with raw CSS variables or inline styles

## Colors (Ant Design Semantic Tokens)

| Role            | Ant Design Token         | Value approx. |
|-----------------|--------------------------|---------------|
| Primary         | `colorPrimary`           | `#1677FF`     |
| Success         | `colorSuccess`           | `#52C41A`     |
| Warning         | `colorWarning`           | `#FAAD14`     |
| Error / Danger  | `colorError`             | `#FF4D4F`     |
| Text primary    | `colorText`              | `#000000E0`   |
| Text secondary  | `colorTextSecondary`     | `#00000073`   |
| Border          | `colorBorder`            | `#D9D9D9`     |
| Background      | `colorBgContainer`       | `#FFFFFF`     |
| Layout bg       | `colorBgLayout`          | `#F5F5F5`     |

## RAG Status Colors (Custom — Transport/Work Item Status)

| Status | Color   | Hex        |
|--------|---------|------------|
| GREEN  | Success | `#52C41A`  |
| AMBER  | Warning | `#FAAD14`  |
| RED    | Error   | `#FF4D4F`  |

Use Ant Design `Tag` or `Badge` components with these colors for RAG indicators.

## Typography

| Role      | Ant Design Token  |
|-----------|-------------------|
| Base font | System UI stack (Ant Design default) |
| Code/mono | Monospace fallback for TR numbers |

## Component Library

Ant Design 5 (`antd`). Use Ant Design components for:
- Tables: `Table` with column definitions and pagination
- Forms: `Form`, `Input`, `Select`, `DatePicker`
- Layout: `Layout`, `Sider`, `Header`, `Content`
- Navigation: `Menu` in AppShell sidebar
- Modals/Drawers: `Modal`, `Drawer` (AIChatDrawer uses `Drawer`)
- Cards: `Card` for dashboard KPI tiles
- Tags/Badges: `Tag`, `Badge` for RAG status and TR counts
- Drag-and-drop: custom implementation on top of HTML5 DnD or a library —
  check WorkItemList.tsx for the current approach

## Layout Patterns

- **AppShell** (`components/layout/AppShell.tsx`): main layout wrapper with
  top header, left nav `Menu`, and content area. Present on all pages
- **HomeDashboard**: KPI cards in a grid, pipeline summary, work item table
- **TransportPipeline**: Three-column layout DEV | QAS | PRD with TR cards
- **WorkItemList**: Table with expandable rows for linked TRs; drag-drop zone
  for unassigned TRs
- **WorkItemDetail**: Object detail with test progress card (circular progress +
  stacked bar), milestones, linked TRs, SharePoint URL banner
- **AIChatDrawer** (`components/layout/AIChatDrawer.tsx`): right-side Ant Design
  `Drawer` for AI chat, triggered by floating 🤖 button (always visible)
- **ReportBuilder**: Form + preview panel; AI polish toggle visible only when
  AI is configured and connected
- **SettingsPage**: Step-by-step AI provider configuration (Step 1: choose provider,
  Step 2: enter key, Step 3: test connection)

## Icons

Ant Design Icons (`@ant-design/icons`). Use filled or outlined variants consistently
within the same context. Common icons:
- `RobotOutlined` — AI assistant button
- `DeploymentUnitOutlined` — transport/pipeline
- `ProjectOutlined` — work items
- `BarChartOutlined` — reports
- `SettingOutlined` — settings
- `CheckCircleOutlined`, `CloseCircleOutlined`, `ExclamationCircleOutlined` — status
