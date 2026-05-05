# Architecture Context

## Stack

| Layer       | Technology                        | Role                                              |
| ----------- | --------------------------------- | ------------------------------------------------- |
| Backend     | SAP CAP v8 (Node.js) + CDS        | OData V4 REST API, service logic, integrations    |
| Frontend    | React 18 + Ant Design 5 + TypeScript (Vite 5) | Single-page app on port 3000        |
| Database Dev| SQLite                            | Zero-config local development (auto-created from CDS) |
| Database Prod| SAP HANA Cloud (HDI container)   | Production data store on BTP                     |
| Auth Dev    | Mocked via Vite proxy             | Auto-injects manager@test.com on all /api requests |
| Auth Prod   | XSUAA (xs-security.json)          | 3 roles: Manager, Developer, Executive            |
| AI          | SAP AI Core (Generative AI Hub) via BTP Destination | Primary. SuperAdmin configures Destination Name, Deployment ID, Resource Group in Settings → SAP AI Core Integration. Falls back to Claude/ChatGPT/Gemini/OpenRouter via AppConfig or env vars |
| App Router  | @sap/approuter                    | Auth gateway for BTP deployment                  |
| Hosting     | SAP BTP Cloud Foundry             | MTA deployment via mta.yaml                      |

## System Boundaries

- `db/` — CDS schema (schema.cds) + CSV seed data (6 files, semicolon-delimited).
  Owns data model definitions. Nothing else writes here.
- `srv/` — CAP service layer: OData service definition (transport-service.cds),
  service implementation (~650 lines, transport-service.js), integration clients in `srv/lib/`
- `srv/lib/` — Integration clients only: rfc-client.js (SAP RFC), sharepoint-client.js
  (MS Graph), ai-client.js (unified AI), report-generator.js, test-status-parser.js, tr-parser.js
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
  - AI provider: AI_PROVIDER, CLAUDE_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY
  - SAP AI Core: AI_DESTINATION_NAME, AI_CORE_DEPLOYMENT_ID, AI_CORE_RESOURCE_GROUP
    (SuperAdmin sets these in Settings → SAP AI Core Integration; backend reads on every request)
  - RFC sync: RFC_DESTINATION_NAME, RFC_FM_NAME, RFC_TR_START_DATE, RFC_SYSTEMS_FILTER,
    RFC_SCHEDULE_ENABLED, RFC_SCHEDULE_CRON
  - App: ENABLE_AI, REFRESH_INTERVAL_MINUTES, TR_PREFIX, STUCK_THRESHOLD_DAYS, etc.
- **No blob/file storage**: Reports are generated in-memory and returned
  as response payload; no file uploads currently

## Auth and Access Model

- **Dev**: Vite proxy auto-injects `manager@test.com` credentials on all `/api`
  requests. Three mock users: manager@test.com (all roles), dev@test.com
  (Developer), exec@test.com (Executive)
- **Prod**: XSUAA enforces roles defined in xs-security.json:
  Manager — full access, Developer — TR and work item view/update,
  Executive — read-only dashboard and reports
- CSRF token required on all POST/PATCH requests — handled centrally in
  `frontend/src/services/api.ts`

## Invariants

1. NO Fiori Elements — this is a pure React app. Fiori was removed in session 9.
   Never add Fiori Elements components or annotations back
2. Never use `this.entities` in transport-service.js — entities are stored
   as `this._e` at runtime due to CDS conflict. Always use `this._e`
3. Never use `npx cds` — use `node node_modules\@sap\cds-dk\bin\cds.js` directly.
   npx has executable resolution issues on this Windows setup
4. Never hardcode AI provider or destination — all AI calls go through `ai-client.js`.
   The destination name, deployment ID, and resource group are read from AppConfig
   (set by SuperAdmin in Settings → SAP AI Core Integration) on every request.
   The destination is resolved by the CAP backend via Cloud SDK — never from the frontend.
   AI Core is detected by destination name (`Ai_Core`) or domain (`ml.hana.ondemand.com`),
   NOT by checking for `/v2/inference` in the URL (which is only the base URL in the destination).
5. All CSV seed files use semicolons as delimiter (CDS convention) — never
   change to commas or other delimiters
6. Do not delete `claude-client.js` — legacy file still referenced by some tests
7. Do not create sub-shells using `powershell -c` — use direct commands
