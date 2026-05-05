# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

Post-deployment feature hardening — app is live on SAP BTP Cloud Foundry.

## Current Goal

- Continuous quality improvements: analytics, AI accuracy, TR classification
- User-facing: better dashboard insights, faster categorization, cleaner pipeline view

## Completed

### Infrastructure & Deployment
- [x] CDS data model (schema.cds) — WorkItems, TransportWorkItems, Milestones,
      Notifications, SyncLog, AppConfig
- [x] CAP service layer (transport-service.cds + transport-service.js ~1500 lines)
- [x] React frontend (React 18 + Ant Design 5 + TypeScript via Vite 5)
- [x] XSUAA auth configuration (xs-security.json) for BTP
- [x] MTA deployment descriptor (mta.yaml)
- [x] SAP App Router (approuter/) configuration
- [x] Deployed to SAP BTP Cloud Foundry — live in production

### AI Integration (SAP AI Core — completed 2026-05)
- [x] **AI is exclusively SAP AI Core via BTP Destination** — all Claude/Gemini/OpenAI/OpenRouter
      support removed. No more API keys stored in AppConfig.
- [x] `srv/lib/ai-client.js` — full rewrite to SAP AI Core only
      - Three-strategy auth: executeHttpRequest (Cloud SDK) → getDestination + manual fetch → VCAP_SERVICES
      - Deployment path: `/v2/inference/deployments/{id}/chat/completions?api-version=2025-01-01-preview`
      - Body uses `max_completion_tokens` (required by GPT-5 and gpt-4.1 on AI Core)
      - Factory reads `AI_DESTINATION_NAME` and `AI_CORE_DEPLOYMENT_ID` from AppConfig at runtime (no redeploy)
- [x] `SettingsPage.tsx` — AI provider dropdown removed; replaced with SAP AI Core Integration card
      (Destination Name + Deployment ID fields, Admin/SuperAdmin only)
- [x] `AppConfig` seed — stores `AI_DESTINATION_NAME=Ai_Core` and `AI_CORE_DEPLOYMENT_ID=d8e31dc8207d4ea9`
- [x] `mta.yaml` — removed all non-SAP-AI-Core destination entries; AI Core destination is
      manual in BTP Cockpit (OAuth2ClientCredentials from AI Core service key)
- [x] Context trimming in `_gatherAgentContext()`: active items get 7-field detail,
      Done items get single-line summary — ~50% token reduction
- [x] Report polish and weekly digest: max_tokens reduced 6000 → 3000

### Work Item Management
- [x] AppShell with left nav, header, floating AI chat button
- [x] SAP-only module — Coupa and Commercial modules fully removed (2026-05)
- [x] WorkItemList — typed tabs (Projects/Enhancements/Break-fix/Upgrades/Support/Hypercare/TR Search)
- [x] WorkItemDetail — test progress card, milestones, linked TRs, SharePoint URL banner
- [x] Risk Register — full CRUD table in WorkItemDetail (likelihood×impact score, owner, mitigation,
      status, due date) backed by `Risks` entity (2026-05)
- [x] Action Items / Parking Lot — full CRUD table in WorkItemDetail (priority, status, source,
      due date with overdue highlight) backed by `ActionItems` entity (2026-05)
- [x] Break-fix / Request bucket added as work item type (BRK)
- [x] Veeva CC number (IT-CC-****) tracking per transport + per work item
- [x] SharePoint URL per work item
- [x] Drag-and-drop TR categorization + bulk categorize
- [x] Auto-link: SNOW/INC/CS ticket pattern matching TRs to work items
      Bug fixed: O(n²) + double-update race condition corrected (2026-05)
- [x] UnassignedTRs — view and categorize unlinked TRs

### Dashboard & Analytics
- [x] HomeDashboard — KPI tiles, pipeline summary, work item table
- [x] DashboardPage — per-application analytics (SAP/Coupa/Commercial):
      phase×health stacked bar, type donut, module bar, risk-by-module bar,
      UAT status (Coupa), complexity breakdown, go-live table
- [x] ExecutiveDashboard — cross-application portfolio view (go-live filter, app filter,
      RAG distribution, portfolio health)
- [x] Date range filter bug fixed: now inclusive on both ends (2026-05)
- [x] Division-by-zero guard in moduleRiskData when count = 0 (2026-05)
- [x] Transports KPI card now shows stuck/unassigned counts in caption (2026-05)
- [x] Pipeline useMemo extended with `unassigned` and `stuck` counts (2026-05)

### TransportPipeline
- [x] DEV/QAS/PRD columns with stuck/failed detection
- [x] Age column showing days since TR creation, with warning icon for stuck TRs (2026-05)
- [x] Linked column (green link icon = assigned to work item; grey = needs categorization) (2026-05)
- [x] Stuck TR row highlighting — amber background via `.tr-row-stuck` CSS (2026-05)
- [x] Unassigned stat card added to summary row (2026-05)
- [x] Stuck badge on system card headers when count > 0 (2026-05)
- [x] Stuck TR definition corrected: Released TRs excluded (they're queued, not stuck) (2026-05)

### WorkItemList Improvements
- [x] Test completion % column added (progress bar + pass/fail/total tooltip) (2026-05)
- [x] TR type column shows confidence badges: M=manually categorized, A=auto-linked via
      ticket match, ?=keyword-inferred (unverified) (2026-05)
- [x] TR type codes (PRJ/ENH/BRK/UPG/SUP/HYP) now correctly resolve to colors in
      WORK_TYPE_MAP and WORK_TYPE_COLORS (previously showed grey for all TR types) (2026-05)
- [x] My Items toggle — filters to work items where the logged-in user appears in any people
      field (leadDeveloper, businessOwner, systemOwner, functionalLead, qaLead) (2026-05)
- [x] At-risk warning badge (⚠) next to any item with go-live ≤14 days AND deployment <70% (2026-05)
- [x] Export CSV button — downloads current filtered view as CSV file (2026-05)

### API / Hooks
- [x] Pagination limits raised: transports 200→2000, work items 100→500 (2026-05)
- [x] `useTransports` and `useWorkItems` now log a console.warn if results are truncated (2026-05)

### Test & UAT Tracking
- [x] 10 test tracking fields per work item (total, passed, failed, blocked, TBD, skipped,
      completion %, UAT status, and more)
- [x] 5 methodology templates (Waterfall, Agile, Hybrid, SAFe, Break-fix)
- [x] RAG auto-escalation (GREEN → AMBER → RED) — never auto-downgrades

### Reports & AI Features
- [x] ReportBuilder — structured weekly email report (works without AI)
- [x] Open in Outlook (.eml) — primary action in ReportBuilder; downloads MIME-formatted .eml
      file that opens in Outlook ready to send, subject pre-filled. No OAuth required. (2026-05)
- [x] AIChatDrawer — right-side drawer, context-aware using live project data
- [x] AI agent context now includes: Veeva CC groups (TRs per change control), open risks per
      work item, open action items per work item (2026-05)
- [x] AI polish: report polishing, test risk analysis
- [x] Weekly digest generation

### TR Parser
- [x] `srv/lib/tr-parser.js` — full-format prefix match (HIGH confidence), SNOW-only (MEDIUM),
      keyword-based suggestion (LOW confidence)
- [x] `frontend/src/utils/tr-parser.ts` — client-side mirror with confidence-derivable logic

### Schema — New Entities (2026-05)
- [x] `Risks` — risk register per work item (likelihood/impact/riskScore/owner/mitigation/status/dueDate)
- [x] `ActionItems` — parking lot per work item (description/owner/dueDate/status/priority/source)
- [x] `ProgressSnapshots` — weekly trend data (deploymentPct/testPassRate/ragStatus/testPassed/testTotal)
- [x] All three exposed as OData projections in transport-service.cds
- [x] `_saveProgressSnapshot()` called after every test status update (upsert: one per WI per day)

### Seed Data
- [x] 12+ seed work items with full test tracking data
- [x] 45+ seed transports, 30 milestones, 10 notifications, 8 sync logs

### Integrations
- [x] RFC client (rfc-client.js) — mocked in dev, live via BTP Destination in prod
- [x] SharePoint client (sharepoint-client.js) — mocked in dev, live via MS Graph in prod
- [x] RFC auto-refresh scheduler (rfc-scheduler.js) — cron-based, configurable via AppConfig

## In Progress

- [ ] Create `gpt-4.1` deployment in SAP AI Launchpad and update Deployment ID in Settings
      (current deployment uses `gpt-5-2025-08-07` — works but expensive due to reasoning tokens)
- [ ] Seed CSV files for `Risks` and `ActionItems` (optional — entities work without seed data)

## Next Up

- [ ] ProgressSnapshot trend sparklines in WorkItemDetail (mini line chart showing deployment %
      and test pass rate over time — data is now being collected daily)
- [ ] Add `workTypeConfidence` column to schema (HIGH/MEDIUM/LOW) to persist classification
      quality alongside TR records
- [ ] Retroactive auto-matching: re-run classification on unassigned TRs when a new work
      item is created with a matching SNOW ticket
- [ ] Application isolation for TR Search tab (currently shows all SAP TRs regardless of
      work item application)
- [ ] Switch RFC client from mock to live SAP connection when Cloud Connector is ready

## Open Questions

- Will the team adopt the PRJ-CHG0098765 | description naming convention for all new TRs?
  (High-confidence auto-classification depends on this prefix format)
- RFC destination name in SAP Cloud Connector for on-premise S/4HANA (`S4HANA_RFC_DS4`)
- SharePoint tenant details for live MS Graph API connection

## Architecture Decisions

- **React + Ant Design chosen over Fiori Elements** (session 9) — full UX control needed
  for complex dashboard; Fiori Elements too constrained for drag-and-drop and pipeline viz
- **SAP-only app** (2026-05) — Coupa and Commercial modules removed entirely as speculative
  scope; app now serves BridgeBio SAP team only
- **AI exclusively via SAP AI Core BTP Destination** (2026-05) — removed all third-party
  AI providers (Claude/Gemini/OpenAI/OpenRouter). Enterprise-grade: no API keys in code,
  auth fully managed by BTP Destination (OAuth2ClientCredentials from AI Core service key)
- **`gpt-4.1` is the recommended model** for this app — not `gpt-5` (reasoning model,
  consumes 10-20× tokens due to reasoning overhead, ~$0.30-0.50 per chat call).
  `gpt-4.1` is cheaper, better at instruction following, and doesn't use reasoning tokens
- **Resource group in BTP Destination additional properties** — `URL.headers.AI-Resource-Group`
  header is injected by Cloud SDK automatically; not stored in AppConfig
- **Three-strategy AI auth fallback** — ensures the app works in CF (Strategy 1: Cloud SDK),
  on-prem-like environments (Strategy 2: getDestination + manual fetch), and direct VCAP
  bindings (Strategy 3). All three must be preserved
- **Context trimming** (2026-05) — active work items get full AI context detail; Done items
  get single-line summaries only. ~50% token reduction with no loss of chat quality
- **.eml report delivery** (2026-05) — reports download as MIME-formatted .eml files that
  open directly in Outlook ready to send. Replaces the complex mailto: / clipboard approach.
  No OAuth or Graph API setup required on the user's side
- **Stuck TR definition** (2026-05) — TR is stuck if: not in PRD AND not Released AND
  created > 5 days ago. Released TRs awaiting import are in the queue, not stuck
- **Pagination raised** (2026-05) — SAP production can have thousands of TRs;
  2000/500 defaults cover realistic data volumes
- **Dual CSV seed files use semicolons** (CDS convention) — never change to commas
- **`this._e` instead of `this.entities`** — CDS runtime conflict discovered early;
  all entity access in transport-service.js uses `this._e`
- **RAG escalation-only** — prevents misleading status improvements that haven't been
  manually verified
- **ProgressSnapshot upsert pattern** (2026-05) — one row per work item per day; called
  non-blocking after every test status update. Frontend reads last 90 days for sparklines

## Session Notes

- 2026-05-05 (session 2): Removed Coupa & Commercial modules entirely; added Risk Register,
  Action Items, ProgressSnapshots schema entities + OData projections; AI agent context enriched
  with Veeva CC groups + risks + action items; My Items filter + at-risk badge + CSV export in
  WorkItemList; .eml report download in ReportBuilder; snapshot auto-saved after test updates
- 2026-05-05 (session 1): AI Core integration hardened, context trimming, token optimization,
  dashboard bug fixes (date filter, division-by-zero), TR confidence badges,
  test completion % column, TransportPipeline improvements (age, linked, stuck highlights),
  pagination raised, auto-link bug fixed
- 2026-04-01: AI dual-provider integration complete (now superseded — removed in 2026-05)
- `npm run dev` (port 4004) + `cd frontend && npx vite --port 3000` to run locally
- Do not use `npx cds` — use `node node_modules\@sap\cds-dk\bin\cds.js` directly
- All test data in seed CSVs under `db/data/`
