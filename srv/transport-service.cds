using { sap.pm as db } from '../db/schema';

// ─── Transport Service — Main API for the app ───
@path: '/api/v1/transport'
@requires: 'authenticated-user'
service TransportService {

  // ── Transports ──
  @readonly
  entity Transports @(restrict: [
    { grant: 'READ', to: ['Developer', 'Manager', 'Executive'] }
  ]) as projection on db.TransportWorkItems {
    *, workItem.workItemName as projectName
  };

  // ── Work Items (Projects, Enhancements, etc.) ──
  entity WorkItems @(restrict: [
    { grant: 'READ',  to: ['Developer', 'Manager', 'Executive'] },
    { grant: 'WRITE', to: ['Manager'] }
  ]) as projection on db.WorkItems;

  // ── Milestones ──
  entity Milestones @(restrict: [
    { grant: 'READ',  to: ['Developer', 'Manager', 'Executive'] },
    { grant: 'WRITE', to: ['Manager'] }
  ]) as projection on db.Milestones;

  // ── Notifications ──
  entity Notifications @(restrict: [
    { grant: '*', to: ['Developer', 'Manager', 'Executive'] }
  ]) as projection on db.Notifications;

  // ── User Preferences ──
  entity UserPreferences @(restrict: [
    { grant: '*', to: ['Developer', 'Manager', 'Executive'] }
  ]) as projection on db.UserPreferences;

  // ── Sync Log (read-only for debugging) ──
  @readonly
  entity SyncLogs @(restrict: [
    { grant: 'READ', to: ['Manager'] }
  ]) as projection on db.SyncLog;

  // ── Activity Log (read-only audit trail) ──
  @readonly
  entity ActivityLogs @(restrict: [
    { grant: 'READ', to: ['Manager'] }
  ]) as projection on db.ActivityLog;

  // ── App Config ──
  entity AppConfigs @(restrict: [
    { grant: 'READ',  to: ['Developer', 'Manager', 'Executive'] },
    { grant: 'WRITE', to: ['Manager'] }
  ]) as projection on db.AppConfig;

  // ── Report Templates ──
  entity ReportTemplates @(restrict: [
    { grant: 'READ',  to: ['Developer', 'Manager', 'Executive'] },
    { grant: 'WRITE', to: ['Manager'] }
  ]) as projection on db.ReportTemplates;

  // ── Actions ──

  // Categorize a single transport (Manager only)
  action categorizeTransport(
    trNumber  : String,
    workType  : String,
    workItemId: String
  ) returns { success: Boolean; message: String };

  // Bulk categorize multiple transports
  action bulkCategorize(
    items: array of {
      trNumber  : String;
      workType  : String;
      workItemId: String;
    }
  ) returns { success: Boolean; count: Integer; message: String };

  // Update Veeva CC number on a transport
  action updateVeevaCC(
    trNumber     : String,
    veevaCCNumber: String
  ) returns { success: Boolean; message: String };

  // Trigger RFC data refresh
  action refreshTransportData() returns {
    success       : Boolean;
    recordsFetched: Integer;
    message       : String;
  };

  // Trigger SharePoint sync
  action refreshSharePointData() returns {
    success       : Boolean;
    recordsSynced : Integer;
    message       : String;
  };

  // Generate weekly report data (structured JSON for template rendering)
  action generateWeeklyReport(
    workItemId : String
  ) returns {
    success : Boolean;
    data    : LargeString;
    message : String;
  };

  // Update test status counts for a work item
  action updateTestStatus(
    workItemId : String,
    testTotal  : Integer,
    testPassed : Integer,
    testFailed : Integer,
    testBlocked: Integer,
    testTBD    : Integer,
    testSkipped: Integer
  ) returns { success: Boolean; message: String; testCompletionPct: Decimal; uatStatus: String; ragImpact: String };

  // Test AI connection
  action testAIConnection() returns { success: Boolean; message: String; provider: String };

  // Save AI provider configuration
  action saveAIConfig(
    provider : String,
    apiKey   : String
  ) returns { success: Boolean; message: String };

  // Chat with the AI agent — asks questions about project data
  action chatWithAgent(
    question : String
  ) returns { success: Boolean; answer: LargeString; provider: String };

  // Generate a report template from sample email content (AI-powered)
  action generateTemplateFromEmail(
    emailContent : LargeString,
    templateName : String,
    scope        : String
  ) returns { success: Boolean; templateHtml: LargeString; message: String; provider: String };

  // Save a report template (create or update)
  action saveReportTemplate(
    id           : String,
    templateName : String,
    description  : String,
    templateHtml : LargeString,
    scope        : String,
    visibility   : String,
    isDefault    : Boolean
  ) returns { success: Boolean; templateId: String; message: String };

  // Delete a report template
  action deleteReportTemplate(
    id : String
  ) returns { success: Boolean; message: String };

  // Get methodology templates
  function getMethodologies() returns array of {
    methodologyKey : String;
    name           : String;
    description    : String;
    phaseCount     : Integer;
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
  function dashboardSummary() returns {
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
  function pipelineSummary() returns {
    devCount  : Integer;
    qasCount  : Integer;
    prdCount  : Integer;
    queueCount: Integer;
    stuckCount: Integer;
    failedCount: Integer;
  };
}
