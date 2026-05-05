# SAP Project Management — Transport Command Center

## Overview

A full-stack web application that serves as a Transport Command Center for
BridgeBio's SAP team. Tracks SAP transport requests across DEV → QAS → PRD
landscapes, links transports to project work items, monitors test status and
UAT, syncs project metadata from SharePoint, and generates executive-ready
weekly status reports with optional AI polish. Built on SAP CAP (Node.js)
backend with a React + Ant Design frontend, deployed on SAP BTP Cloud Foundry.

The app serves the **SAP** domain exclusively. Coupa and Commercial modules were
removed in 2026-05 as speculative scope not used by the BridgeBio SAP team.

## Goals

1. Give SAP project managers a single dashboard across DEV/QAS/PRD systems
2. Link transport requests to work items (projects, enhancements, break-fixes)
3. Track test status and UAT per work item with RAG status auto-escalation
4. Generate structured weekly status reports, optionally polished by AI
5. Sync project data from SharePoint and live transport data via RFC
6. Deploy to SAP BTP Cloud Foundry for enterprise access
7. Surface analytics on TR classification quality, stuck TRs, and portfolio health

## Core User Flow

1. User signs in (Manager role auto-assigned in dev via Vite proxy)
2. Home dashboard shows pipeline KPIs and work item RAG summary
3. User navigates to Transport Pipeline — sees all TRs across DEV/QAS/PRD
   with age, linked status, and stuck highlighting
4. User opens Work Items — assigns unlinked TRs via drag-and-drop
5. User opens a Work Item detail — reviews test progress (with completion %),
   UAT status, milestones, linked TRs
6. User navigates to Tools → Weekly Report — generates report (AI polish optional)
7. SuperAdmin configures AI in Settings → SAP AI Core Integration

## Features

### Transport Monitor
- Real-time view of SAP transport requests across DEV → QAS → PRD
- Stuck TR detection: >5 days old, not Released, not in PRD
- Age column showing days since creation with warning icon for stuck TRs
- Linked/Unlinked column showing whether each TR is assigned to a work item
- Failed import detection (RC ≥ 8)
- Unassigned TR count surfaced in dashboard and pipeline summary
- RFC integration for live transport data (mocked in dev)

### TR Classification
- Auto-classification via TR description prefix format (`PRJ-CHG0098765 | Description`)
- SNOW/INC ticket extraction from anywhere in the description
- Keyword-based suggestion (LOW confidence) for non-standard descriptions
- Confidence badges in TR type column: no badge = prefix match, `A` = auto-linked,
  `?` = keyword-inferred (needs verification), `M` = manually categorized
- Auto-link: scans all TR descriptions for SNOW/INC/CS ticket patterns and links
  to matching work items automatically

### Work Item Management
- **SAP work item types**: Project (PRJ), Enhancement (ENH), Break-fix (BRK),
  Upgrade (UPG), Support (SUP), Hypercare (HYP)
- Drag-and-drop TR categorization to work items
- Bulk categorize action for multiple TRs at once
- Veeva CC number (IT-CC-****) tracking per transport and per work item
- SharePoint URL per work item linking to project Excel tracker
- Test completion % column in WorkItemList
- **Risk Register** per work item — likelihood, impact, risk score, mitigation, status, due date
- **Action Items / Parking Lot** per work item — priority, owner, due date, source, status
- **My Items filter** — toggle to show only items where logged-in user is in a people field
- **At-risk badge** — warning shown when go-live ≤14 days AND deployment <70%
- **Export CSV** — download current filtered work item list as CSV

### Test & UAT Tracking
- 10 test tracking fields per work item: total, passed, failed, blocked, TBD, skipped,
  completion %, UAT status
- 5 methodology templates: Waterfall, Agile, Hybrid, SAFe, Break-fix
- RAG auto-escalation (GREEN → AMBER → RED) — never auto-downgrades
- Test pass rate KPI card on dashboard

### Dashboard & Analytics
- **DashboardPage** (per-application): phase×health stacked bar, type distribution donut,
  module bar chart, risk-by-module bar, UAT status (Coupa), go-live table
- **ExecutiveDashboard**: cross-application portfolio view with date range filter
  (inclusive both ends), app filter, RAG distribution
- SAP pipeline KPI shows total TRs with stuck/unassigned counts in caption
- Date range filter is inclusive on both ends (uses `!isBefore && !isAfter`)

### AI Report Generation
- Weekly status report in email format (Outlook-compatible HTML)
- Works without AI (structured output always available)
- **Open in Outlook (.eml)** — downloads a MIME-formatted .eml file; double-click opens
  Outlook with subject pre-filled and body ready to send. No OAuth setup required
- **AI exclusively via SAP AI Core BTP Destination** — no third-party API keys needed.
  SuperAdmin creates the `Ai_Core` BTP Destination with OAuth2ClientCredentials from
  the AI Core service key, then sets Deployment ID in Settings
- AI chat agent: answers questions using live project data as context,
  with context trimming (active items full detail, Done items single-line);
  includes Veeva CC coverage analysis, open risks, and open action items
- Recommended model: `gpt-4.1` deployed in SAP AI Launchpad (see architecture.md)

### Pipeline Visualization
- System landscape view: DEV → QAS → PRD with per-system stats
- Stuck TRs highlighted amber per row + badge on system card header
- Age, Linked, Type, Import RC columns per TR
- Unassigned stat card shows TRs needing categorization

## Scope

### In Scope
- Transport request tracking and categorization
- Work item management with test/UAT tracking
- AI-assisted report generation via SAP AI Core
- RFC integration for live transport data
- SharePoint sync for project metadata
- SAP BTP Cloud Foundry deployment
- Multi-application support: SAP, Coupa, Commercial

### Out of Scope
- Fiori Elements UI (removed in session 9 — React-only architecture)
- Coupa and Commercial modules (removed 2026-05 — SAP-only app)
- Actual SAP transport execution (view/track only, no TMS control)
- ABAP development or SAP system-side customization
- Real-time push notifications (polling only)
- Automation/RPA bots (separate SBPA service instance required)
- Third-party AI providers (Claude/Gemini/OpenAI/OpenRouter — removed 2026-05)

## Success Criteria

1. A Manager can view all transport requests across DEV/QAS/PRD on one screen,
   with stuck/failed/unassigned counts visible at a glance
2. A Developer can assign a TR to a work item via drag-and-drop
3. A Manager can generate a weekly status report with test/UAT data in under 10 seconds
4. AI polish works via SAP AI Core BTP Destination with Deployment ID from AI Launchpad
5. RAG status escalates automatically when test failures exceed threshold
6. App deploys to SAP BTP via `mbt build` + `cf deploy`
7. TR classification quality is visible in the UI (confidence badges M/A/?)
