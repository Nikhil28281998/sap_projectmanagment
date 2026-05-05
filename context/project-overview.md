# SAP Project Management — Transport Command Center

## Overview

A full-stack web application that serves as a Transport Command Center for
BridgeBio's SAP team. Tracks SAP transport requests across DEV → QAS → PRD
landscapes, links transports to project work items, monitors test status and
UAT, syncs project metadata from SharePoint, and generates executive-ready
weekly status reports with optional AI polish (Claude or ChatGPT). Built on
SAP CAP (Node.js) backend with a React + Ant Design frontend.

## Goals

1. Give SAP project managers a single dashboard across DEV/QAS/PRD systems
2. Link transport requests to work items (projects, enhancements, break-fixes)
3. Track test status and UAT per work item with RAG status auto-escalation
4. Generate structured weekly status reports, optionally polished by AI
5. Sync project data from SharePoint and live transport data via RFC
6. Deploy to SAP BTP Cloud Foundry for enterprise access

## Core User Flow

1. User signs in (Manager role auto-assigned in dev via Vite proxy)
2. Home dashboard shows pipeline KPIs and work item RAG summary
3. User navigates to Transport Pipeline — sees all TRs across DEV/QAS/PRD
4. User opens Work Items — assigns unlinked TRs via drag-and-drop
5. User opens a Work Item detail — reviews test progress, UAT status, milestones
6. User navigates to Tools → Weekly Report — generates report (AI polish optional)
7. User configures AI provider in Settings → AI Integration

## Features

### Transport Monitor
- Real-time view of SAP transport requests across DEV → QAS → PRD
- Stuck/failed transport detection in pipeline view
- RFC integration for live transport data (mocked in dev)

### Work Item Management
- Work item types: Project (PRJ), Enhancement (ENH), Break-fix (BRK),
  Upgrade (UPG), Support (SUP), Hypercare (HYP)
- Drag-and-drop TR categorization to work items
- Bulk categorize action for multiple TRs at once
- Veeva CC number (IT-CC-****) tracking per transport

### Test & UAT Tracking
- 10 test tracking fields per work item: total, passed, failed, blocked, TBD, skipped,
  completion %, UAT status
- 5 methodology templates: Waterfall, Agile, Hybrid, SAFe, Break-fix
- RAG auto-escalation (GREEN → AMBER → RED) — never auto-downgrades
- SharePoint URL per work item linking to project Excel tracker

### AI Report Generation
- Weekly status report in email format
- Works without AI (structured output always available)
- AI polish optional: Claude (Anthropic) or ChatGPT (OpenAI) — user chooses
- AI chat agent: answers questions using all current project data as context

### Pipeline Visualization
- System landscape view: DEV → QAS → PRD with counts per system
- Stuck/failed detection

## Scope

### In Scope
- Transport request tracking and categorization
- Work item management with test/UAT tracking
- AI-assisted report generation (dual provider: Claude + ChatGPT)
- RFC integration for live transport data
- SharePoint sync for project metadata
- SAP BTP Cloud Foundry deployment

### Out of Scope
- Fiori Elements UI (removed in session 9 — React-only architecture)
- Actual SAP transport execution (view/track only, no TMS control)
- ABAP development or SAP system-side customization
- Real-time push notifications (polling only)
- Automation/RPA bots (separate SBPA service instance required)

## Success Criteria

1. A Manager can view all transport requests across DEV/QAS/PRD on one screen
2. A Developer can assign a TR to a work item via drag-and-drop
3. A Manager can generate a weekly status report with test/UAT data in under 10 seconds
4. AI polish works for both Claude and ChatGPT with user-provided API keys
5. RAG status escalates automatically when test failures exceed threshold
6. App deploys to SAP BTP via `mbt build` + `cf deploy`
