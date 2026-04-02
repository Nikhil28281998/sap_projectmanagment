namespace sap.pm;

using { cuid, managed } from '@sap/cds/common';

// ─── Transport-to-WorkItem mapping (from SAP RFC + drag-drop categorization) ───
entity TransportWorkItems : cuid, managed {
  trNumber       : String(20) @title: 'Transport Number';   // E070.TRKORR
  trDescription  : String(120) @title: 'TR Description';    // E07T.AS4TEXT (cached)
  workType       : String(20) @title: 'Work Type';          // PRJ/ENH/BRK/UPG/SUP/HYP or null
  snowTicket     : String(20) @title: 'ServiceNow Ticket';  // Parsed INC/CHG number
  veevaCCNumber  : String(30) @title: 'Veeva CC Number';    // Manual: IT-CC-**** format
  trOwner        : String(12) @title: 'TR Owner (SAP User)';// E070.AS4USER
  ownerFullName  : String(80) @title: 'Owner Full Name';    // Resolved from USR21+ADRP
  trStatus       : String(20) @title: 'TR Status';          // Released/Modifiable/etc
  trFunction     : String(10) @title: 'TR Function';        // K=Workbench, W=Customizing
  currentSystem  : String(10) @title: 'Current System';     // DEV/QAS/PRD
  importRC       : Integer    @title: 'Import Return Code'; // 0=OK, 4=Warning, 8=FAILED
  assignedBy     : String(80) @title: 'Categorized By';     // Who drag-dropped
  assignedDate   : Timestamp  @title: 'Categorized Date';   // When categorized
  createdDate    : Date       @title: 'TR Created Date';    // E070.AS4DATE
  lastSynced     : Timestamp  @title: 'Last RFC Sync';
  workItem       : Association to WorkItems;                 // FK to parent project/enhancement
  version        : Integer default 0 @title: 'Optimistic Lock Version';
}

// ─── Work Items (SharePoint sync + manual entries) — Full project management ───
entity WorkItems : cuid, managed {
  workItemName     : String(200) @title: 'Work Item Name';
  projectCode      : String(50) @title: 'Project Code';       // PRJ-FICO-2026-01
  workItemType     : String(20) @title: 'Type';               // Project/Enhancement/Break-fix/Support/Hypercare/Upgrade
  application      : String(20) default 'SAP' @title: 'Application';  // SAP/Coupa/Commercial
  snowTicket       : String(20) @title: 'SNOW Ticket';
  veevaCCNumber    : String(30) @title: 'Veeva CC Number';
  // People (from SharePoint)
  businessOwner    : String(120) @title: 'Business Owner';
  systemOwner      : String(120) @title: 'System Owner';
  leadDeveloper    : String(120) @title: 'Lead Developer';
  functionalLead   : String(120) @title: 'Functional Lead';
  qaLead           : String(120) @title: 'QA Lead';
  // Dates & Deadlines (from SharePoint)
  kickoffDate      : Date @title: 'Kickoff Date';
  devCompleteDate  : Date @title: 'Dev Complete Date';
  uatStartDate     : Date @title: 'UAT Start Date';
  uatSignoffDate   : Date @title: 'UAT Sign-off Date';
  goLiveDate       : Date @title: 'Go-Live Date';
  hypercareEndDate : Date @title: 'Hypercare End Date';
  actualGoLiveDate : Date @title: 'Actual Go-Live Date';
  // Scope & Classification
  sapModule        : String(20) @title: 'SAP Module';         // FICO/SD/MM/HR/Cross-module
  sapSystems       : String(200) @title: 'SAP Systems';       // Comma-separated
  estimatedTRCount : Integer @title: 'Estimated TR Count';
  complexity       : String(20) @title: 'Complexity';         // Low/Medium/High/Critical
  priority         : String(10) @title: 'Priority';           // P1/P2/P3/P4
  // Status (auto-calculated, manual override)
  status           : String(20) default 'Active' @title: 'Status';
  currentPhase     : String(20) @title: 'Current Phase';      // Planning/Development/Testing/Go-Live/Hypercare/Complete
  methodology      : String(30) default 'Waterfall' @title: 'Methodology'; // Waterfall/Agile/Hybrid/SAFe
  overallRAG       : String(10) @title: 'RAG Status';         // GREEN/AMBER/RED
  riskScore        : Integer @title: 'Risk Score (0-100)';
  deploymentPct    : Decimal(5,2) @title: 'Deployment %';
  // Test Tracking (parsed from SharePoint Excel or manual entry)
  testTotal        : Integer default 0 @title: 'Total Test Cases';
  testPassed       : Integer default 0 @title: 'Tests Passed';
  testFailed       : Integer default 0 @title: 'Tests Failed';
  testBlocked      : Integer default 0 @title: 'Tests Blocked';
  testTBD          : Integer default 0 @title: 'Tests TBD';
  testSkipped      : Integer default 0 @title: 'Tests Skipped';
  testCompletionPct: Decimal(5,2) default 0 @title: 'Test Completion %';
  uatStatus        : String(20) default 'Not Started' @title: 'UAT Status'; // Not Started/In Progress/Passed/Failed/Blocked
  // Meta
  notes            : LargeString @title: 'Notes';
  sharepointUrl    : String(500) @title: 'SharePoint Tracker URL'; // Link to Excel tracker per project
  sharepointSync   : Boolean default false @title: 'SharePoint Synced';
  lastSynced       : Timestamp @title: 'Last Sync';
  // Navigation
  transports       : Composition of many TransportWorkItems on transports.workItem = $self;
  milestones       : Composition of many Milestones on milestones.workItem = $self;
}

// ─── Milestones (linked to work items) ───
entity Milestones : cuid, managed {
  workItem        : Association to WorkItems;
  milestoneName   : String(200) @title: 'Milestone Name';
  milestoneDate   : Date @title: 'Deadline Date';
  milestoneOrder  : Integer @title: 'Sequence';
  status          : String(20) default 'Pending' @title: 'Status'; // Pending/Complete/Overdue
  completedDate   : Date @title: 'Completed Date';
  autoGenerated   : Boolean default false @title: 'Auto-generated';
  evidence        : String(500) @title: 'Evidence';
}

// ─── User Preferences ───
entity UserPreferences : managed {
  key userEmail       : String(120) @title: 'User Email';
  pinnedItems         : LargeString @title: 'Pinned Items (JSON)';
  dashboardLayout     : LargeString @title: 'Dashboard Layout (JSON)';
  darkMode            : Boolean default false @title: 'Dark Mode';
  notificationRules   : LargeString @title: 'Notification Rules (JSON)';
}

// ─── Notifications ───
entity Notifications : cuid, managed {
  userEmail   : String(120) @title: 'User Email';
  type        : String(50) @title: 'Type';       // STUCK_TR, FAILED_IMPORT, GOLIVE_APPROACHING
  message     : String(500) @title: 'Message';
  trNumber    : String(20) @title: 'TR Number';
  isRead      : Boolean default false @title: 'Read';
}

// ─── Sync Log (RFC refresh tracking) ───
entity SyncLog : cuid {
  source       : String(20) @title: 'Source';       // RFC, SHAREPOINT, CLAUDE
  startedAt    : Timestamp @title: 'Started';
  completedAt  : Timestamp @title: 'Completed';
  status       : String(20) @title: 'Status';       // SUCCESS, FAILED, PARTIAL
  recordsFetched : Integer @title: 'Records Fetched';
  recordsUpdated : Integer @title: 'Records Updated';
  errorMessage   : String(500) @title: 'Error Message';
  durationMs     : Integer @title: 'Duration (ms)';
}

// ─── Activity Log (audit trail) ───
entity ActivityLog : cuid {
  userEmail   : String(120) @title: 'User';
  action      : String(50) @title: 'Action';       // CATEGORIZE, BULK_CATEGORIZE, UPDATE_VEEVA, GENERATE_REPORT
  entityType  : String(30) @title: 'Entity Type';  // TR, WORK_ITEM, MILESTONE, REPORT
  entityId    : String(50) @title: 'Entity ID';
  oldValue    : String(500) @title: 'Old Value';
  newValue    : String(500) @title: 'New Value';
  createdAt   : Timestamp @title: 'Timestamp';
}

// ─── Report Templates (user-created or AI-generated) ───
entity ReportTemplates : cuid, managed {
  templateName   : String(200)  @title: 'Template Name';
  description    : String(500)  @title: 'Description';
  templateHtml   : LargeString  @title: 'Template HTML';       // Outlook-ready HTML with {{placeholders}}
  scope          : String(10)   @title: 'Scope';               // single / multi / both
  visibility     : String(10)   @title: 'Visibility';          // private / public
  isDefault      : Boolean default false @title: 'Default Template';
  ownerEmail     : String(120)  @title: 'Owner Email';         // who created it
  sourceType     : String(20)   @title: 'Source';              // manual / ai-generated
}

// ─── Application Configuration (key-value settings) ───
entity AppConfig {
  key configKey  : String(100) @title: 'Config Key';
  configValue    : String(500) @title: 'Config Value';
  description    : String(200) @title: 'Description';
}
