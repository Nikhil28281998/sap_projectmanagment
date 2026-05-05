# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Production deployment preparation (SAP BTP Cloud Foundry)

## Current Goal

- Configure HANA Cloud HDI container and XSUAA for BTP deployment
- Execute MTA build and cf deploy to Cloud Foundry

## Completed

- [x] CDS data model (schema.cds) — WorkItems, TransportWorkItems, Milestones,
      Notifications, SyncLog, AppConfig
- [x] CAP service layer (transport-service.cds + transport-service.js ~650 lines)
- [x] React frontend (React 18 + Ant Design 5 + TypeScript via Vite 5)
- [x] AppShell with left nav, header, floating AI button (always accessible)
- [x] HomeDashboard — KPI tiles, pipeline summary, work item table
- [x] TransportPipeline — DEV/QAS/PRD columns with stuck/failed detection
- [x] WorkItemList — table with drag-and-drop TR categorization
- [x] WorkItemDetail — test progress card (circular progress + stacked bar),
      milestones, linked TRs, SharePoint URL banner
- [x] UnassignedTRs — view and categorize unlinked TRs
- [x] Test tracking — 10 fields per work item, 5 methodology templates, RAG auto-escalation
- [x] ReportBuilder — structured weekly email report (works without AI)
- [x] AI integration — unified ai-client.js (Claude + ChatGPT), chat agent,
      report polish, test risk analysis (rule-based)
- [x] AIChatDrawer — right-side drawer with quick questions, context-aware
- [x] SettingsPage — 3-step AI provider setup (choose → enter key → test)
- [x] TRSearch tool
- [x] Veeva CC number (IT-CC-****) tracking per transport
- [x] SharePoint URL per work item
- [x] XSUAA auth configuration (xs-security.json) for BTP
- [x] MTA deployment descriptor (mta.yaml)
- [x] SAP App Router (approuter/) configuration
- [x] 12 seed work items with full test tracking data
- [x] 45 seed transports, 30 milestones, 10 notifications, 8 sync logs
- [x] Mocked RFC integration (rfc-client.js — mock in dev)
- [x] Mocked SharePoint integration (sharepoint-client.js — mock in dev)
- [x] Backend Jest tests
- [x] Frontend Vitest tests
- [x] Fiori Elements removed (session 9) — pure React architecture confirmed

## In Progress

- [ ] BTP deployment — HANA Cloud setup and cf push

## Next Up

- [ ] Provision HANA Cloud HDI container on BTP
- [ ] Configure XSUAA service instance from xs-security.json
- [ ] Configure SAP Cloud Connector for RFC live connectivity to on-premise SAP
- [ ] Run `mbt build` and `cf deploy mta_archives/sap-project-mgmt_*.mtar`
- [ ] Verify end-to-end in BTP environment (auth, RFC, SharePoint, AI)
- [ ] Switch RFC client from mock to live SAP connection

## Open Questions

- Which BTP subaccount/org/space to deploy to?
- RFC destination name in SAP Cloud Connector for on-premise S/4HANA
- SharePoint tenant details for live MS Graph API connection
- Should AI provider default to Claude or remain user-configured?

## Architecture Decisions

- React + Ant Design chosen over Fiori Elements (session 9) — full UX control
  needed for complex dashboard; Fiori Elements too constrained for drag-and-drop
  and custom pipeline visualization
- Dual AI provider (Claude + ChatGPT) — enterprise flexibility; user stores
  their own API key in AppConfig to avoid hardcoding keys in code
- `this._e` instead of `this.entities` in transport-service.js — CDS runtime
  stores entities under `_e` due to naming conflict; discovered and fixed in
  early sessions
- Reports always work without AI — structured output is the baseline;
  AI polish is optional enhancement. Avoids dependency on external API availability
- SQLite in dev / HANA in prod — zero-config local setup; CDS auto-creates
  from schema on first deploy
- RAG escalation-only (no auto-downgrade) — prevents misleading status improvements
  that haven't been manually verified

## Session Notes

- Last session: AI dual-provider integration complete (2026-04-01)
- App is feature-complete for the planned scope
- BTP deployment is the primary remaining task
- `npm run dev` (port 4004) + `cd frontend && npx vite --port 3000` to run locally
- All test data available: 12 work items, 45 TRs, 30 milestones in seed CSVs
- Do not use npx cds — use `node node_modules\@sap\cds-dk\bin\cds.js` directly
