# Architecture Context

## Stack

| Layer        | Technology                                           | Role                                              |
| ------------ | ---------------------------------------------------- | ------------------------------------------------- |
| Backend      | SAP CAP v8 (Node.js) + CDS                           | OData V4 REST API, service logic, integrations    |
| Frontend     | React 18 + Ant Design 5 + TypeScript (Vite 5)        | Single-page app on port 3000                      |
| Database Dev | SQLite                                               | Zero-config local development (auto-created from CDS) |
| Database Prod| SAP HANA Cloud (HDI container)                       | Production data store on BTP                      |
| Auth Dev     | Mocked via Vite proxy                                | Auto-injects manager@test.com on all /api requests |
| Auth Prod    | XSUAA (xs-security.json)                             | 3 roles: Manager, Developer, Executive            |
| AI           | SAP AI Core (Generative AI Hub) via BTP Destination  | Exclusively via `Ai_Core` BTP Destination. SuperAdmin sets Destination Name and Deployment ID in Settings → SAP AI Core Integration. Resource group lives in destination additional properties (`URL.headers.AI-Resource-Group`). No API keys stored anywhere in the app. |
| App Router   | @sap/approuter                                       | Auth gateway for BTP deployment                   |
| Hosting      | SAP BTP Cloud Foundry                                | MTA deployment via mta.yaml                       |

## System Boundaries

- `db/` — CDS schema (schema.cds) + CSV seed data (6 files, semicolon-delimited).
  Owns data model definitions. Nothing else writes here.
- `srv/` — CAP service layer: OData service definition (transport-service.cds),
  service implementation (~1500 lines, transport-service.js), integration clients in `srv/lib/`
- `srv/lib/` — Integration clients only: rfc-client.js (SAP RFC), sharepoint-client.js
  (MS Graph), ai-client.js (SAP AI Core only), report-generator.js, test-status-parser.js,
  tr-parser.js, rfc-scheduler.js, outlook-client.js, crypto-utils.js
- `frontend/` — React SPA: components/, hooks/, services/, types/, utils/.
  Communicates with backend via `/api/v1/transport/` only (proxied in dev)
- `approuter/` — SAP App Router for BTP auth routing. Also receives the built
  React bundle at `approuter/webapp/` after `npm run build` in frontend/
- `test/` — Jest backend tests only

## Storage Model

- **SQLite / HANA Cloud**: All entities live in the CDS schema — WorkItems,
  TransportWorkItems, Milestones, Notifications, SyncLog, AppConfig
- **AppConfig**: Key-value store for runtime settings. Managed via Settings page
  (Admin/SuperAdmin only). Key groups:
  - SAP AI Core: `AI_DESTINATION_NAME` (default: `Ai_Core`), `AI_CORE_DEPLOYMENT_ID`
    — SuperAdmin sets these in Settings → SAP AI Core Integration; backend reads on every AI request.
    No API keys. No model name. No resource group (that's in the destination).
  - RFC sync: `RFC_DESTINATION_NAME`, `RFC_FM_NAME`, `RFC_TR_START_DATE`, `RFC_SYSTEMS_FILTER`,
    `RFC_SCHEDULE_ENABLED`, `RFC_SCHEDULE_CRON`
  - App: `ENABLE_AI`, `REFRESH_INTERVAL_MINUTES`, `TR_PREFIX`, `STUCK_THRESHOLD_DAYS`,
    `SNOW_TASK_PREFIX`, `INCIDENT_PREFIX`, `VENDOR_TICKET_PREFIX`
- **No blob/file storage**: Reports are generated in-memory and returned
  as response payload; no file uploads

## AI Core Integration Details

- **BTP Destination `Ai_Core`** must be created manually in BTP Cockpit with:
  - Type: HTTP
  - Authentication: OAuth2ClientCredentials
  - URL: `https://api.ai.prod.<region>.ml.hana.ondemand.com` (from AI Core service key)
  - Client ID / Secret: from AI Core service key (`clientid` / `clientsecret`)
  - Token Service URL: from AI Core service key (`url` + `/oauth/token`)
  - Additional property: `URL.headers.AI-Resource-Group = default` (or your resource group)
- **Deployment path**: `/v2/inference/deployments/{deploymentId}/chat/completions?api-version=2025-01-01-preview`
- **Body**: uses `max_completion_tokens` (not `max_tokens` — required by GPT-5 and gpt-4.1)
- **Recommended model**: `gpt-4.1` — best instruction-following, low cost, no reasoning tokens.
  Avoid `gpt-5` / `o3` / `o4-mini` for this app — reasoning models consume 10–20× tokens
  (~$0.30–0.50 per chat call vs. ~$0.02 for gpt-4.1)
- **Three-strategy auth fallback** in `_callAICore()` (all three must be preserved):
  1. `executeHttpRequest` (Cloud SDK) — preferred on CF; OAuth + destination headers injected automatically
  2. `getDestination` + manual fetch — fallback if Cloud SDK not available
  3. VCAP_SERVICES direct credentials — last resort for bare CF bindings

## Auth and Access Model

- **Dev**: Vite proxy auto-injects `manager@test.com` credentials on all `/api` requests.
  Three mock users: manager@test.com (all roles), dev@test.com (Developer), exec@test.com (Executive)
- **Prod**: XSUAA enforces roles defined in xs-security.json:
  Manager — full access, Developer — TR and work item view/update,
  Executive — read-only dashboard and reports
- CSRF token required on all POST/PATCH requests — handled centrally in
  `frontend/src/services/api.ts`

## TR Classification Model

TR descriptions follow the convention: `{PREFIX}-{SNOW_TICKET} | {Description}`
e.g. `PRJ-CHG0098765 | FI Recon Report — Phase 2`

| Detection method       | Confidence | Source                  |
| ---------------------- | ---------- | ----------------------- |
| Full prefix regex match| HIGH       | `parseTRDescription()`  |
| SNOW ticket only (INC) | MEDIUM     | `parseTRDescription()`  |
| Keyword-based rule     | LOW        | `suggestWorkType()`     |
| Manual (user action)   | n/a        | `assignedBy = user ID`  |
| Auto-link ticket match | n/a        | `assignedBy = 'auto-link'` |

UI shows confidence badges: `M` = manual, `A` = auto-linked, `?` = keyword/unverified.
No badge = full prefix match (highest confidence, self-documenting).

## Stuck TR Definition

A TR is **stuck** if ALL of:
- `currentSystem !== 'PRD'` (not yet in production)
- `trStatus !== 'Released'` (not in import queue — Released TRs are waiting for scheduled import, not stuck)
- Age > 5 days (`createdDate` more than 5 days ago)

This definition is applied consistently in both backend (`_onPipelineSummary`) and frontend
(DashboardPage pipeline useMemo, TransportPipeline component).

## Pagination Limits

| Entity    | Default limit | Rationale                                |
| --------- | ------------- | ---------------------------------------- |
| Transports| 2000          | SAP production landscapes can have 1000+ TRs |
| WorkItems | 500           | Typical PM portfolio: 50–200 items       |

Both hooks (`useTransports`, `useWorkItems`) log a console.warn if `@odata.count` exceeds
the loaded result count.

## Invariants

1. **NO Fiori Elements** — this is a pure React app. Fiori was removed in session 9.
   Never add Fiori Elements components or annotations back.
2. **`this._e` not `this.entities`** in transport-service.js — entities are stored
   as `this._e` at runtime due to CDS naming conflict. Always use `this._e`.
3. **Never `npx cds`** — use `node node_modules\@sap\cds-dk\bin\cds.js` directly.
   npx has executable resolution issues on this Windows setup.
4. **AI exclusively through `ai-client.js`** — never call AI APIs directly from service handlers
   or frontend. All AI calls go through `AIClient.create(db, entities)`. The destination name
   and deployment ID come from AppConfig; the resource group comes from the BTP Destination
   additional properties, not AppConfig. AI Core is detected by destination name (`Ai_Core`)
   or domain (`ml.hana.ondemand.com`) — NOT by URL path (the path `/v2/inference/...` is
   added by `ai-client.js`, it is NOT part of the destination base URL).
5. **All CSV seed files use semicolons** as delimiter (CDS convention) — never change to commas.
6. **`claude-client.js` still exists** in `srv/lib/` as a legacy file referenced by some tests.
   Do not delete it. Do not use it for new AI calls.
7. **`max_completion_tokens` not `max_tokens`** — GPT-5 and gpt-4.1 on SAP AI Core require
   `max_completion_tokens` in the request body. Using `max_tokens` returns a 400 error.
8. **Do not create sub-shells using `powershell -c`** — use direct commands.
