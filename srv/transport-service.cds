using { sap.pm as db } from '../db/schema';

// ─── Transport Service — Main API for the app ───
// Roles: Admin > Manager > Developer | Executive (read-only dashboards/reports)
@path: '/api/v1/transport'
@requires: 'authenticated-user'
service TransportService {

  // ── Transports ──
  @readonly
  entity Transports @(restrict: [
    { grant: 'READ', to: ['Admin', 'Manager', 'Developer', 'Executive'] }
  ]) as projection on db.TransportWorkItems {
    *, workItem.workItemName as projectName
  };

  // ── Work Items (Projects, Enhancements, etc.) ──
  entity WorkItems @(restrict: [
    { grant: 'READ',  to: ['Admin', 'Manager', 'Developer', 'Executive'] },
    { grant: 'WRITE', to: ['Admin', 'Manager'] }
  ]) as projection on db.WorkItems;

  // ── Milestones ──
  entity Milestones @(restrict: [
    { grant: 'READ',  to: ['Admin', 'Manager', 'Developer', 'Executive'] },
    { grant: ['CREATE', 'WRITE', 'DELETE'], to: ['Admin', 'Manager'] }
  ]) as projection on db.Milestones;

  // ── Notifications ──
  entity Notifications @(restrict: [
    { grant: '*', to: ['Admin', 'Manager', 'Developer', 'Executive'] }
  ]) as projection on db.Notifications;

  // ── User Preferences ──
  entity UserPreferences @(restrict: [
    { grant: '*', to: ['Admin', 'Manager', 'Developer', 'Executive'] }
  ]) as projection on db.UserPreferences;

  // ── Sync Log (read-only for debugging) ──
  @readonly
  entity SyncLogs @(restrict: [
    { grant: 'READ', to: ['Admin', 'Manager'] }
  ]) as projection on db.SyncLog;

  // ── Activity Log (read-only audit trail) ──
  @readonly
  entity ActivityLogs @(restrict: [
    { grant: 'READ', to: ['Admin', 'Manager'] }
  ]) as projection on db.ActivityLog;

  // ── App Config ──
  entity AppConfigs @(restrict: [
    { grant: 'READ',  to: ['Admin', 'Manager', 'Developer', 'Executive'] },
    { grant: 'WRITE', to: ['Admin'] }
  ]) as projection on db.AppConfig;

  // ── Report Templates ──
  entity ReportTemplates @(restrict: [
    { grant: 'READ',  to: ['Admin', 'Manager', 'Developer', 'Executive'] },
    { grant: 'WRITE', to: ['Admin', 'Manager'] }
  ]) as projection on db.ReportTemplates;

  // ── Weekly Digests ──
  entity Digests @(restrict: [
    { grant: 'READ',  to: ['Admin', 'Manager', 'Developer', 'Executive'] },
    { grant: 'WRITE', to: ['Admin', 'Manager'] }
  ]) as projection on db.WeeklyDigests;

  // ── Actions (with role-level restrictions) ──

  // Categorize a single transport (Manager/Admin)
  @requires: ['Admin', 'Manager']
  action categorizeTransport(
    trNumber  : String,
    workType  : String,
    workItemId: String
  ) returns { success: Boolean; message: String };

  // Bulk categorize multiple transports
  @requires: ['Admin', 'Manager']
  action bulkCategorize(
    items: array of {
      trNumber  : String;
      workType  : String;
      workItemId: String;
    }
  ) returns { success: Boolean; count: Integer; message: String };

  // Update Veeva CC number on a transport
  @requires: ['Admin', 'Manager']
  action updateVeevaCC(
    trNumber     : String,
    veevaCCNumber: String
  ) returns { success: Boolean; message: String };

  // Trigger RFC data refresh (Admin/Manager)
  @requires: ['Admin', 'Manager']
  action refreshTransportData() returns {
    success       : Boolean;
    recordsFetched: Integer;
    message       : String;
  };

  // Trigger SharePoint sync (Admin/Manager)
  @requires: ['Admin', 'Manager']
  action refreshSharePointData() returns {
    success       : Boolean;
    recordsSynced : Integer;
    message       : String;
  };

  // Generate weekly report data (Manager/Executive/Admin)
  @requires: ['Admin', 'Manager', 'Executive']
  action generateWeeklyReport(
    workItemId : String
  ) returns {
    success : Boolean;
    data    : LargeString;
    message : String;
  };

  // Update test status counts for a work item (Manager/Admin)
  @requires: ['Admin', 'Manager']
  action updateTestStatus(
    workItemId : String,
    testTotal  : Integer,
    testPassed : Integer,
    testFailed : Integer,
    testBlocked: Integer,
    testTBD    : Integer,
    testSkipped: Integer
  ) returns { success: Boolean; message: String; testCompletionPct: Decimal; uatStatus: String; ragImpact: String };

  // Test AI connection (any authenticated user)
  action testAIConnection() returns { success: Boolean; message: String; provider: String };

  // Save AI provider configuration (Admin only)
  @requires: 'Admin'
  action saveAIConfig(
    provider : String,
    apiKey   : String
  ) returns { success: Boolean; message: String };

  // Chat with the AI agent — any authenticated user
  action chatWithAgent(
    question : String
  ) returns { success: Boolean; answer: LargeString; provider: String };

  // Analyze uploaded document (email, Veeva CC, general) and propose work items
  @requires: ['Admin', 'Manager']
  action analyzeDocument(
    content      : LargeString,
    documentType : String,
    application  : String,
    fileName     : String
  ) returns { success: Boolean; proposals: LargeString; summary: String; provider: String };

  // Create work items from AI-analyzed document proposals
  @requires: ['Admin', 'Manager']
  action createFromProposal(
    proposals   : LargeString,
    application : String
  ) returns { success: Boolean; created: Integer; message: String };

  // Generate a report template from sample email content (Manager/Admin)
  @requires: ['Admin', 'Manager']
  action generateTemplateFromEmail(
    emailContent : LargeString,
    templateName : String,
    scope        : String
  ) returns { success: Boolean; templateHtml: LargeString; message: String; provider: String };

  // Save a report template (Manager/Admin)
  @requires: ['Admin', 'Manager']
  action saveReportTemplate(
    id           : String,
    templateName : String,
    description  : String,
    templateHtml : LargeString,
    scope        : String,
    visibility   : String,
    isDefault    : Boolean
  ) returns { success: Boolean; templateId: String; message: String };

  // Delete a report template (Manager/Admin)
  @requires: ['Admin', 'Manager']
  action deleteReportTemplate(
    id : String
  ) returns { success: Boolean; message: String };

  // Get methodology templates (any authenticated user)
  function getMethodologies() returns array of {
    methodologyKey : String;
    name           : String;
    description    : String;
    phaseCount     : Integer;
    phases         : array of {
      name                : String;
      order               : Integer;
      typicalDurationDays : Integer;
      hasTests            : Boolean;
    };
  };

  // Get current user info — /me endpoint
  function currentUser() returns {
    email : String;
    name  : String;
    roles : array of String;
    isAdmin    : Boolean;
    isManager  : Boolean;
    isDeveloper: Boolean;
    isExecutive: Boolean;
    isSuperAdmin : Boolean;
    allowedApps  : array of String;
  };

  // Health check
  function health() returns {
    status    : String;
    database  : String;
    rfc       : String;
    sharepoint: String;
    timestamp : String;
  };

  // Dashboard summary data
  function dashboardSummary(application : String) returns {
    activeProjects     : Integer;
    totalTransports    : Integer;
    unassignedCount    : Integer;
    pendingItems       : Integer;
    completedThisWeek  : Integer;
    stuckTransports    : Integer;
    failedImports      : Integer;
    avgDeploymentDays  : Decimal;
  };

  // Pipeline summary (TR counts per system)
  function pipelineSummary(application : String) returns {
    devCount  : Integer;
    qasCount  : Integer;
    prdCount  : Integer;
    queueCount: Integer;
    stuckCount: Integer;
    failedCount: Integer;
  };

  // Auto-generate notifications for stuck/failed/go-live items (Admin/Manager)
  @requires: ['Admin', 'Manager']
  action generateNotifications() returns {
    success  : Boolean;
    generated: Integer;
    message  : String;
  };

  // Auto-detect phase for a work item based on its transport states (Admin/Manager)
  @requires: ['Admin', 'Manager']
  action autoDetectPhase(
    workItemId : String
  ) returns { success: Boolean; phase: String; message: String };

  // Auto-link SNOW/INC/CS tickets from TR descriptions (Admin/Manager)
  @requires: ['Admin', 'Manager']
  action autoLinkTickets() returns { success: Boolean; linked: Integer; message: String };

  // ─── AI Refine Proposals (Discuss with AI to tweak proposals before creation) ───
  @requires: ['Admin', 'Manager']
  action refineProposals(
    proposals    : LargeString,
    instruction  : String,
    application  : String
  ) returns { success: Boolean; proposals: LargeString; message: String; provider: String };

  // ─── SharePoint Live Integration (Microsoft Graph API) ───
  @requires: ['Admin', 'Manager']
  action configureSharePoint(
    tenantId     : String,
    clientId     : String,
    clientSecret : String,
    siteUrl      : String,
    driveId      : String
  ) returns { success: Boolean; message: String };

  @requires: ['Admin', 'Manager']
  action listSharePointDocuments(
    folderPath : String
  ) returns { success: Boolean; documents: LargeString; message: String };

  @requires: ['Admin', 'Manager']
  action fetchSharePointDocument(
    documentId : String,
    fileName   : String
  ) returns { success: Boolean; content: LargeString; fileName: String; message: String };

  // ─── AI Weekly Digest (save only — no auto-email) ───
  @requires: ['Admin', 'Manager']
  action generateWeeklyDigest(
    application : String
  ) returns { success: Boolean; digestId: String; digestHtml: LargeString; message: String; provider: String };

  function getWeeklyDigests() returns array of {
    ID           : String;
    weekLabel    : String;
    application  : String;
    digestHtml   : LargeString;
    digestText   : LargeString;
    projectCount : Integer;
    riskCount    : Integer;
    highlights   : LargeString;
    generatedBy  : String;
    aiProvider   : String;
    createdAt    : Timestamp;
  };

  // ─── Smart AI Risk Notifications ───
  @requires: ['Admin', 'Manager']
  action analyzeProjectRisks(
    application : String
  ) returns { success: Boolean; risks: LargeString; generated: Integer; message: String; provider: String };
}
