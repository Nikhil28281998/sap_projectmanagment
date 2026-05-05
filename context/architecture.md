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
| AI          | Claude (Anthropic) or ChatGPT (OpenAI) | User-configured in Settings; unified via ai-client.js |
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
- **AppConfig**: Key-value store for runtime settings — AI_PROVIDER,
  CLAUDE_API_KEY, OPENAI_API_KEY, ENABLE_AI, refresh intervals
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
4. Never hardcode Claude-only AI — all AI calls go through `ai-client.js`
   which supports both Claude and ChatGPT based on AppConfig
5. All CSV seed files use semicolons as delimiter (CDS convention) — never
   change to commas or other delimiters
6. Do not delete `claude-client.js` — legacy file still referenced by some tests
7. Do not create sub-shells using `powershell -c` — use direct commands
