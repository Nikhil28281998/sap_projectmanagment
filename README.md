# SAP Project Management — Transport Command Center

A full-stack **SAP CAP** (Cloud Application Programming Model) application for managing SAP transport requests, project work items, and deployment pipelines.

## Architecture

| Layer | Technology | Path |
|-------|-----------|------|
| **Backend** | SAP CAP (Node.js) + CDS | `srv/`, `db/` |
| **Fiori Elements** | SAPUI5 List Reports | `app/transports/`, `app/workitems/` |
| **React Frontend** | React 18 + Ant Design + Vite | `frontend/` |
| **App Router** | @sap/approuter | `approuter/` |
| **Database (dev)** | SQLite | `db.sqlite` |
| **Database (prod)** | SAP HANA Cloud | HDI Container |
| **Auth** | XSUAA (prod) / Mocked (dev) | `xs-security.json` |

## Features

- **Transport Monitor** — Real-time view of SAP transport requests across DEV → QAS → PRD
- **Work Item Management** — Projects, enhancements, break-fix linking from SharePoint
- **Drag-and-Drop Categorization** — Assign transports to work items by type (PRJ/ENH/BRK/UPG/SUP/HYP)
- **Pipeline Visualization** — System landscape pipeline with stuck/failed detection
- **RFC Integration** — Live transport data from SAP via RFC
- **SharePoint Sync** — Project metadata from SharePoint Graph API
- **AI Report Generation** — Weekly status reports polished with Claude API
- **Veeva CC Tracking** — IT-CC-**** compliance numbers
- **Role-Based Access** — Executive / Manager / Developer roles via XSUAA

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [SAP CDS CLI](https://cap.cloud.sap/docs/get-started/) (`npm i -g @sap/cds-dk`)
- [Cloud Foundry CLI](https://docs.cloudfoundry.org/cf-cli/) (for deployment)
- [MTA Build Tool](https://sap.github.io/cloud-mta-build-tool/) (`npm i -g mbt`)

## Quick Start

```bash
# 1. Install dependencies
npm ci

# 2. Copy environment template and fill in values
cp .env.example .env

# 3. Start the CAP backend (with SQLite + mocked auth)
npm run dev
# → http://localhost:4004

# 4. Start the React frontend (separate terminal)
cd frontend
npm ci
npm run dev
# → http://localhost:3000 (proxies /api to :4004)
```

### Test Users (Development)

| Email | Password | Roles |
|-------|----------|-------|
| `manager@test.com` | `pass` | Manager, Executive, Developer |
| `dev@test.com` | `pass` | Developer |
| `exec@test.com` | `pass` | Executive |

## Project Structure

```
sap-project-mgmt/
├── app/                    # Fiori Elements UI apps
│   ├── transports/         #   Transport Request list report
│   └── workitems/          #   Work Item management list report
├── approuter/              # SAP App Router (auth gateway)
├── db/                     # Database schema & seed data
│   ├── schema.cds          #   CDS entity definitions
│   └── data/               #   CSV seed data files
├── frontend/               # React + Vite + Ant Design SPA
│   └── src/
│       ├── components/     #   Dashboard, Pipeline, WorkItems, Tools
│       ├── hooks/          #   React Query hooks
│       ├── services/       #   API client layer
│       ├── types/          #   TypeScript interfaces
│       └── utils/          #   TR parser, helpers
├── srv/                    # CAP service layer
│   ├── transport-service.cds  # Service definition (entities, actions)
│   ├── transport-service.js   # Service implementation
│   ├── fiori.cds              # Fiori annotation bridge
│   └── lib/                   # Integration clients
│       ├── rfc-client.js      #   SAP RFC connector
│       ├── sharepoint-client.js # SharePoint Graph API connector
│       ├── claude-client.js   #   Claude AI API client
│       ├── report-generator.js #  Weekly report builder
│       └── tr-parser.js       #  TR description parser
├── test/                   # Backend tests (Jest)
├── mta.yaml                # MTA deployment descriptor
├── xs-security.json        # XSUAA security configuration
└── package.json            # Root dependencies & CDS config
```

## Scripts

### Root (CAP Backend)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start CAP with hot-reload (`cds watch`) |
| `npm start` | Start CAP in production mode |
| `npm run build` | Build MTA for deployment |
| `npm test` | Run all backend tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |

### Frontend (`cd frontend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Build to `approuter/webapp/` |
| `npm run lint` | ESLint check |
| `npm test` | Run Vitest |
| `npm run test:watch` | Run Vitest in watch mode |

## API Endpoints

Base path: `/api/v1/transport`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/Transports` | List all transport requests |
| GET | `/WorkItems` | List all work items |
| GET | `/Milestones` | List milestones |
| POST | `/categorizeTransport` | Assign a TR to a work type |
| POST | `/bulkCategorize` | Bulk assign TRs |
| POST | `/updateVeevaCC` | Set Veeva CC number on TR |
| POST | `/refreshTransportData` | Trigger RFC refresh |
| POST | `/refreshSharePointData` | Trigger SharePoint sync |
| POST | `/generateWeeklyReport` | Generate weekly status report |
| GET | `/health()` | Health check |
| GET | `/dashboardSummary()` | Dashboard KPI summary |
| GET | `/pipelineSummary()` | Pipeline counts by system |

## Deployment (SAP BTP)

```bash
# Build the MTA archive
mbt build

# Deploy to Cloud Foundry
cf deploy mta_archives/sap-project-mgmt_1.0.0.mtar
```

### Required BTP Services

- **HANA Cloud** — HDI container for database
- **XSUAA** — Authentication & authorization
- **SAP Cloud Connector** — RFC connectivity to on-premise SAP

## Environment Variables

See [.env.example](.env.example) for all required configuration.

## License

UNLICENSED — Internal use only.
