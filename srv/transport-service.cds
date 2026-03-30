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

  // Generate weekly report
  action generateWeeklyReport(
    useAI: Boolean
  ) returns {
    success : Boolean;
    report  : LargeString;
    message : String;
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
