# SAP Project Management App — Architecture & Instructions

> **Last updated:** 2026-04-01  
> **Repository:** https://github.com/Nikhil28281998/sap_projectmanagment  
> **Branch:** main

---

## What This App Does

A **Transport Command Center** for SAP teams — tracks projects, transports, test status, milestones, and generates executive reports. Built for SAP project managers who Need a single dashboard across multiple SAP systems (DEV/QAS/PRD).

---

## Architecture

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Backend** | SAP CAP v8 (Node.js) | OData V4 REST API |
| **Frontend** | React 18 + Ant Design 5 + TypeScript | Single-page app via Vite 5 |
| **Database** | SQLite (dev) / HANA Cloud (prod) | Auto-created from CDS schema |
| **Auth** | Mocked (dev) / XSUAA (prod) | 3 roles: Manager, Developer, Executive |
| **AI** | Claude (Anthropic) OR ChatGPT (OpenAI) | User chooses in Settings |
| **Hosting** | Local dev → SAP BTP Cloud Foundry | MTA deployment |

**NO Fiori Elements** — this is a pure React app. Fiori was removed in session 9.

---

## Project Structure

```
sap-project-mgmt/
├── db/
│   ├── schema.cds                    # Data model (all entities)
│   └── data/                         # CSV seed data (6 files)
│       ├── sap.pm-WorkItems.csv      # 12 work items with test tracking
│       ├── sap.pm-TransportWorkItems.csv  # 45 transports
│       ├── sap.pm-Milestones.csv     # 30 milestones
│       ├── sap.pm-Notifications.csv  # 10 notifications
│       ├── sap.pm-SyncLog.csv        # 8 sync logs
│       └── sap.pm-AppConfig.csv      # App settings (AI keys, etc.)
├── srv/
│   ├── transport-service.cds         # CDS service definition
│   ├── transport-service.js          # Service implementation (~650 lines)
│   └── lib/
│       ├── ai-client.js              # Unified AI (Claude + ChatGPT)
│       ├── claude-client.js           # Legacy — replaced by ai-client.js
│       ├── report-generator.js       # Weekly report (data + format)
│       ├── test-status-parser.js     # Test normalization + methodology templates
│       ├── rfc-client.js             # SAP RFC integration (mock in dev)
│       ├── sharepoint-client.js      # MS Graph / SharePoint (mock in dev)
│       └── tr-parser.js              # TR description parser
├── frontend/
│   ├── vite.config.ts                # Dev server on port 3000, proxy to :4004
│   └── src/
│       ├── App.tsx                   # Routes
│       ├── services/api.ts           # Centralized API client
│       ├── hooks/useData.ts          # React Query hooks
│       └── components/
│           ├── layout/AppShell.tsx    # Main layout + nav + floating AI button
│           ├── layout/AIChatDrawer.tsx  # AI chat drawer
│           ├── dashboard/HomeDashboard.tsx
│           ├── pipeline/TransportPipeline.tsx
│           ├── workitems/WorkItemList.tsx
│           ├── workitems/WorkItemDetail.tsx  # Includes test progress card
│           ├── workitems/UnassignedTRs.tsx
│           ├── tools/ReportBuilder.tsx
│           ├── tools/TRSearch.tsx
│           └── settings/SettingsPage.tsx  # AI provider connection UI
├── test/                             # Jest tests
├── package.json                      # CAP dependencies + scripts
└── mta.yaml                         # BTP deployment descriptor
```

---

## Data Model (Key Entities)

### WorkItems
Projects, Enhancements, Break-fixes, Support, Hypercare, Upgrades.
- **Test tracking fields:** testTotal, testPassed, testFailed, testBlocked, testTBD, testSkipped, testCompletionPct, uatStatus
- **Methodology:** Waterfall, Agile, Hybrid, SAFe, Break-fix
- **SharePoint URL:** link to project's Excel tracker
- Has compositions to TransportWorkItems and Milestones

### TransportWorkItems
SAP transport requests mapped to work items. Includes TR number, owner, status, import RC, current system.

### Milestones
Date-based checkpoints linked to work items. Auto-generated from work item dates.

### AppConfig
Key-value settings: AI_PROVIDER, CLAUDE_API_KEY, OPENAI_API_KEY, ENABLE_AI, refresh intervals, etc.

---

## AI Integration

### How It Works
1. User goes to **Settings → AI Integration**
2. Chooses **Claude** or **ChatGPT**
3. Enters API key from console.anthropic.com or platform.openai.com
4. Clicks **Connect & Test**

### What AI Does
| Feature | Where | How |
|---------|-------|-----|
| **Chat Agent** | Floating 🤖 button or sidebar "AI Assistant" | Gathers ALL project data → sends as context → AI answers questions |
| **Email Report Polish** | Tools → Weekly Report → toggle AI Polish | Raw report data → AI produces executive email |
| **Test Risk Analysis** | Backend (testRAGImpact) | Currently rule-based; AI enrichment planned |

### Backend: `srv/lib/ai-client.js`
- `AIClient.create(db, entities)` — factory, loads provider + key from AppConfig
- `_callClaude()` — Anthropic Messages API
- `_callOpenAI()` — OpenAI Chat Completions API
- `chat(question, appContext)` — agent endpoint
- `polishReport(rawReport)` — email polish
- `analyzeTestData()` — test risk insights
- `testConnection()` — verify API key

### CDS Actions
- `chatWithAgent(question)` — chat with AI using app data as context
- `saveAIConfig(provider, apiKey)` — save provider choice + key
- `testAIConnection()` — verify connection
- `generateWeeklyReport(useAI)` — generate + optionally polish report

---

## Running Locally

### Prerequisites
- Node.js 18+
- npm

### Start Backend (port 4004)
```bash
cd sap-project-mgmt
npm install
# Remove old DB + deploy fresh
Remove-Item db.sqlite* -ErrorAction SilentlyContinue
node node_modules\@sap\cds-dk\bin\cds.js deploy --to sqlite
node node_modules\@sap\cds-dk\bin\cds.js serve --port 4004
```

### Start Frontend (port 3000)
```bash
cd frontend
npm install
npx vite --port 3000
```

### Test Credentials (mocked auth)
| User | Password | Roles |
|------|----------|-------|
| manager@test.com | pass | Manager, Executive, Developer |
| dev@test.com | pass | Developer |
| exec@test.com | pass | Executive |

The Vite proxy auto-injects `manager@test.com` auth on all `/api` requests.

### API Test
```powershell
$h = @{Authorization="Basic bWFuYWdlckB0ZXN0LmNvbTpwYXNz"}
Invoke-RestMethod "http://localhost:4004/api/v1/transport/health()" -Headers $h
Invoke-RestMethod "http://localhost:4004/api/v1/transport/dashboardSummary()" -Headers $h
```

---

## Test Seed Data Summary

| Work Item | Type | Methodology | Tests | UAT Status | RAG |
|-----------|------|-------------|-------|------------|-----|
| FICO Cash Management Upgrade | Project | Waterfall | 80 (40P) | In Progress | GREEN |
| SD Order-to-Cash Enhancement | Enhancement | Agile | 60 (15P/5F) | Failed | AMBER |
| MM Inventory Recount Fix | Break-fix | Break-fix | 12 (10P) | In Progress | GREEN |
| HR Payroll Year-End Patches | Support | Waterfall | 0 | Not Started | GREEN |
| Cross-Module Unicode Upgrade | Upgrade | Hybrid | 200 (180P/2F) | Failed | AMBER |
| PP Production Planning Rework | Project | Waterfall | 95 (30P/12F/8B) | Failed | RED |
| QM Quality Inspection Enhancement | Enhancement | Agile | 45 (20P) | In Progress | GREEN |
| Basis Security Patches Q1 | Support | Break-fix | 15 (15P) | Passed | GREEN |
| WM Warehouse Bin Strategy | Enhancement | Hybrid | 50 (5P/45TBD) | In Progress | AMBER |
| FICO Intercompany Reconciliation | Project | Waterfall | 0 | Not Started | AMBER |
| SD Credit Management Hotfix | Break-fix | Break-fix | 8 (8P) | Passed | GREEN |
| HR Time Evaluation Fix | Break-fix | Break-fix | 20 (3P/4F) | Failed | RED |

Plus: 45 transports, 30 milestones, 10 notifications, 8 sync logs

---

## What NOT to Do

1. **DO NOT add Fiori Elements** — removed in session 9, React-only architecture
2. **DO NOT use `npx cds`** — use `node node_modules\@sap\cds-dk\bin\cds.js` directly (npx has executable issues)
3. **DO NOT use `this.entities`** in transport-service.js — it's stored as `this._e` (runtime conflict with CDS)
4. **DO NOT hardcode Claude-only** — app supports both Claude and ChatGPT via `ai-client.js`
5. **DO NOT delete `claude-client.js`** yet — legacy file, some tests may reference it
6. **DO NOT change CSV delimiter** — all CSVs use semicolons (CDS convention)
7. **DO NOT skip CSRF token** in POST/PATCH requests from frontend (handled in api.ts)
8. **DO NOT create sub-shells** with `powershell -c` — use direct commands

---

## Key Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | React + Ant Design over Fiori Elements | Full control over UX, complex dashboard needs |
| 2 | SQLite in dev, HANA in prod | Zero-config local dev, enterprise-grade in prod |
| 3 | Dual AI provider (Claude + ChatGPT) | User choice, enterprise flexibility |
| 4 | AI agent with full data context | Send all project data as context on each query (small dataset ~12 items, works well) |
| 5 | Test status regex parser | Handle Pass/Fail/TBD/Skip/Blocked in any format from SharePoint |
| 6 | 5 methodology templates | Waterfall/Agile/Hybrid/SAFe/Break-fix with phase definitions |
| 7 | RAG auto-escalation only | Tests can escalate RAG (GREEN→AMBER→RED) but never downgrade |
| 8 | Report generator works without AI | Structured report always; AI polish is optional enhancement |
| 9 | Floating AI button | Always-accessible chat from any page |
| 10 | Mocked auth in dev | Auto-login as manager@test.com via Vite proxy |

---

## Changelog

### 2026-04-01 — AI Agent + Dual Provider
- Added `srv/lib/ai-client.js` — unified AI client (Claude + ChatGPT)
- Added `chatWithAgent` action — AI answers questions using all app data
- Added `saveAIConfig` action — saves provider choice + API key
- Added `AIChatDrawer.tsx` — chat UI with quick questions
- Added floating 🤖 button + nav item for AI Assistant
- Updated Settings page with dual-provider connection flow (Step 1/2/3)
- Updated ReportBuilder to reference connected AI provider
- Updated AppConfig CSV with AI_PROVIDER, OPENAI_API_KEY entries

### 2026-03-31 — Test Tracking + Methodology + Email Reports
- Added 10 test tracking fields to WorkItems schema
- Created `test-status-parser.js` (regex normalizer, 5 methodology templates)
- Created `claude-client.js` (now superseded by `ai-client.js`)
- Added 3 CDS actions: updateTestStatus, testAIConnection, getMethodologies
- Rewrote `report-generator.js` as email format with test data
- Added test progress card to WorkItemDetail (circular progress, stacked bar, modal)
- Added AI section to Settings page
- Updated all 12 work items with test tracking seed data

### 2026-03-30 — SharePoint URL per Project
- Added `sharepointUrl` field to WorkItems
- Added SharePoint tracker link banner + modal in WorkItemDetail
- Added link icon column in WorkItemList

### 2026-03-29 — React Frontend + Rich Test Data
- Removed Fiori Elements completely
- Built full React app with Ant Design
- Added 12 work items, 45 transports, 30 milestones seed data
- GitHub: initial commits up to `3304bda`
