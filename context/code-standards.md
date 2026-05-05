# Code Standards

## General

- Backend is JavaScript (CAP/Node.js); frontend is TypeScript (React)
- Keep modules small and single-purpose — one file owns one responsibility
- Fix root causes, never layer workarounds on top of broken code
- Do not mix backend (CAP) and frontend (React) concerns in one implementation step

## TypeScript (Frontend)

- Strict mode is on throughout the frontend — no implicit `any`
- Interfaces for all API response shapes live in `frontend/src/types/`
- Validate API responses at the boundary in `services/api.ts` before
  passing to components
- Use explicit type annotations on function signatures

## React Standards

- Centralized API client: `frontend/src/services/api.ts` — all HTTP calls
  go through this module; never `fetch()` directly in components
- Server state: React Query hooks in `frontend/src/hooks/useData.ts`
  — never fetch in useEffect unless unavoidable
- UI state: local component state; global state via React context sparingly
- CSRF token handling is done inside `api.ts` — do not replicate in components

## CAP / Node.js (Backend)

- Service entities are stored as `this._e` at runtime (not `this.entities`)
  — CDS runtime conflict. Always reference `this._e` in transport-service.js
- CDS actions defined in `srv/transport-service.cds` must have matching
  implementations in `srv/transport-service.js`
- Integration clients in `srv/lib/` are single-responsibility:
  one file per external system (RFC, SharePoint, AI, report, TR parser)
- Do NOT call `npx cds` — use `node node_modules\@sap\cds-dk\bin\cds.js`
- Never create sub-shells with `powershell -c`

## AI Integration

- All AI calls go through `srv/lib/ai-client.js` — the unified client
  that supports both Claude and ChatGPT based on AppConfig
- Do not call Anthropic or OpenAI APIs directly from other files
- Do not delete `srv/lib/claude-client.js` — legacy, referenced by tests
- Reports must work without AI (structured output first, AI polish is optional)
- AI provider and API keys are stored in AppConfig entity (not .env or code)

## Data & Storage

- All entities defined in `db/schema.cds` — do not create tables outside CDS
- CSV seed files use semicolons as delimiter — never change to comma or tab
- AppConfig is the runtime key-value store for settings including AI keys
- No blob/file storage — all data lives in the relational schema

## API Routes

- Base path: `/api/v1/transport/`
- All POST/PATCH requests require CSRF token — handled in `services/api.ts`
- Actions are defined in CDS and must match the route naming in the service file
- Health check endpoint: `GET /api/v1/transport/health()`

## File Organization

- `db/` — schema.cds + semicolon-delimited CSV seed files
- `srv/` — transport-service.cds (definitions), transport-service.js (implementation)
- `srv/lib/` — integration clients only (ai-client, rfc-client, sharepoint-client,
  report-generator, test-status-parser, tr-parser)
- `frontend/src/components/` — React components by feature area
  (layout/, dashboard/, pipeline/, workitems/, tools/, settings/)
- `frontend/src/hooks/` — React Query data hooks
- `frontend/src/services/` — API client layer
- `frontend/src/types/` — TypeScript interfaces
- `test/` — Jest backend tests
