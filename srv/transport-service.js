const cds = require('@sap/cds');
const { parseTRDescription } = require('./lib/tr-parser');
const { RFCClient } = require('./lib/rfc-client');
const { SharePointClient } = require('./lib/sharepoint-client');
const { ReportGenerator } = require('./lib/report-generator');
const { parseTestStatuses, testRAGImpact, getMethodologyList } = require('./lib/test-status-parser');
const { AIClient } = require('./lib/ai-client');
const { encrypt, decrypt, maskKey } = require('./lib/crypto-utils');
const { OutlookClient } = require('./lib/outlook-client');
const { configureRfcScheduler } = require('./lib/rfc-scheduler');

class TransportService extends cds.ApplicationService {

  async init() {
    const db = await cds.connect.to('db');
    const {
      TransportWorkItems,
      WorkItems,
      Milestones,
      Risks,
      ActionItems,
      ProgressSnapshots,
      Notifications,
      SyncLog,
      ActivityLog,
      AppConfig,
      ReportTemplates,
      WeeklyDigests
    } = db.entities('sap.pm');

    this.db = db;
    this._e = { TransportWorkItems, WorkItems, Milestones, Risks, ActionItems, ProgressSnapshots, Notifications, SyncLog, ActivityLog, AppConfig, ReportTemplates, WeeklyDigests };

    // ── Before handlers ──
    this.before('UPDATE', 'Transports', this._checkOptimisticLock.bind(this));

    // ── Row-level data isolation: filter by user's allowedApps ──
    this.before('READ', ['WorkItems', 'Milestones', 'Notifications'], this._filterByAllowedApps.bind(this));
    this.before('READ', 'Transports', this._filterTransportsByAllowedApps.bind(this));

    // ── Action handlers ──
    this.on('categorizeTransport', this._onCategorize.bind(this));
    this.on('bulkCategorize', this._onBulkCategorize.bind(this));
    this.on('updateVeevaCC', this._onUpdateVeevaCC.bind(this));
    this.on('refreshTransportData', this._onRefreshTransportData.bind(this));
    this.on('refreshSharePointData', this._onRefreshSharePointData.bind(this));
    this.on('generateWeeklyReport', this._onGenerateWeeklyReport.bind(this));
    this.on('updateTestStatus', this._onUpdateTestStatus.bind(this));
    this.on('testAIConnection', this._onTestAIConnection.bind(this));
    this.on('saveAIConfig', this._onSaveAIConfig.bind(this));
    this.on('chatWithAgent', this._onChatWithAgent.bind(this));
    this.on('analyzeDocument', this._onAnalyzeDocument.bind(this));
    this.on('createFromProposal', this._onCreateFromProposal.bind(this));
    this.on('generateTemplateFromEmail', this._onGenerateTemplateFromEmail.bind(this));
    this.on('saveReportTemplate', this._onSaveReportTemplate.bind(this));
    this.on('deleteReportTemplate', this._onDeleteReportTemplate.bind(this));
    this.on('getMethodologies', this._onGetMethodologies.bind(this));
    this.on('currentUser', this._onCurrentUser.bind(this));
    this.on('health', this._onHealth.bind(this));
    this.on('dashboardSummary', this._onDashboardSummary.bind(this));
    this.on('pipelineSummary', this._onPipelineSummary.bind(this));
    this.on('generateNotifications', this._onGenerateNotifications.bind(this));
    this.on('autoDetectPhase', this._onAutoDetectPhase.bind(this));
    this.on('autoLinkTickets', this._onAutoLinkTickets.bind(this));
    // New feature handlers
    this.on('refineProposals', this._onRefineProposals.bind(this));
    this.on('configureSharePoint', this._onConfigureSharePoint.bind(this));
    this.on('listSharePointDocuments', this._onListSharePointDocuments.bind(this));
    this.on('fetchSharePointDocument', this._onFetchSharePointDocument.bind(this));
    this.on('generateWeeklyDigest', this._onGenerateWeeklyDigest.bind(this));
    this.on('getWeeklyDigests', this._onGetWeeklyDigests.bind(this));
    this.on('analyzeProjectRisks', this._onAnalyzeProjectRisks.bind(this));
    this.on('createWorkItem', this._onCreateWorkItem.bind(this));
    this.on('deleteWorkItem', this._onDeleteWorkItem.bind(this));
    this.on('changeWorkItemStatus', this._onChangeWorkItemStatus.bind(this));
    this.on('sendReport', this._onSendReport.bind(this));
    this.on('purgeActivityLog', this._onPurgeActivityLog.bind(this));
    this.on('suggestWorkItemsForTRs', this._onSuggestWorkItemsForTRs.bind(this));

    // Reconfigure the RFC scheduler whenever AppConfig is updated so Admins
    // can change the cron expression / enabled flag without a redeploy.
    this.after(['CREATE', 'UPDATE'], 'AppConfigs', async (data) => {
      const key = data?.configKey;
      if (key === 'RFC_SCHEDULE_CRON' || key === 'RFC_SCHEDULE_ENABLED') {
        await this._reconfigureScheduler().catch(err =>
          cds.log('rfc-scheduler').error('reconfigure failed:', err));
      }
    });

    // Initial scheduler configuration (reads AppConfig once boot completes).
    await this._reconfigureScheduler().catch(err =>
      cds.log('rfc-scheduler').warn('initial configure skipped:', err?.message || err));

    await super.init();
  }

  // ─── Row-Level Data Isolation ───
  // Determines allowed applications for the current user
  _getAllowedApps(req) {
    const user = req.user;
    const allowed = [];
    if (user.is('SuperAdmin')) return null; // SuperAdmin sees all — no filter
    if (user.is('SAP')) allowed.push('SAP');
    if (user.is('Coupa')) allowed.push('Coupa');
    if (user.is('Commercial')) allowed.push('Commercial');
    // Backward compat: if no app roles, grant all
    if (allowed.length === 0) return null;
    return allowed;
  }

  // BEFORE READ handler for WorkItems, Milestones, Notifications
  _filterByAllowedApps(req) {
    const allowed = this._getAllowedApps(req);
    if (!allowed) return; // SuperAdmin or unrestricted
    // WorkItems have application column directly
    if (req.target.name.endsWith('WorkItems')) {
      req.query.where({ application: { in: allowed } });
    }
    // Milestones are linked to WorkItems — filter via subquery
    if (req.target.name.endsWith('Milestones')) {
      req.query.where(`workItem_ID in (SELECT ID from sap_pm_WorkItems WHERE application in (${allowed.map(a => `'${a}'`).join(',')}))`);
    }
    // Notifications — filter out notifications from other apps projects
    // Notifications don't have application column, so we skip strict filtering here
    // but AI risk notifications contain project names which is acceptable
  }

  // BEFORE READ handler for Transports — filter by linked WorkItem's application
  _filterTransportsByAllowedApps(req) {
    const allowed = this._getAllowedApps(req);
    if (!allowed) return; // SuperAdmin or unrestricted
    // Filter TRs: either linked to an allowed-app WorkItem, or unassigned (workItem_ID is null)
    req.query.where(`(workItem_ID is null OR workItem_ID in (SELECT ID from sap_pm_WorkItems WHERE application in (${allowed.map(a => `'${a}'`).join(',')})))`);
  }

  // ─── Optimistic Locking ───
  async _checkOptimisticLock(req) {
    if (req.data.version !== undefined) {
      const { TransportWorkItems } = this._e;
      const current = await SELECT.one.from(TransportWorkItems).where({ ID: req.data.ID });
      if (current && current.version !== req.data.version) {
        req.reject(409, 'Record was modified by another user. Please refresh and try again.');
      }
      req.data.version = (req.data.version || 0) + 1;
    }
  }

  // ─── Categorize Single Transport ───
  async _onCategorize(req) {
    const { trNumber, workType, workItemId } = req.data;
    const user = req.user.id;
    const { TransportWorkItems, ActivityLog } = this._e;

    const validTypes = ['PRJ', 'ENH', 'BRK', 'UPG', 'SUP', 'HYP'];
    if (workType && !validTypes.includes(workType)) {
      return req.reject(400, `Invalid work type: ${workType}. Must be one of: ${validTypes.join(', ')}`);
    }

    const tr = await SELECT.one.from(TransportWorkItems).where({ trNumber });
    if (!tr) {
      return req.reject(404, `Transport ${trNumber} not found`);
    }

    const oldValue = tr.workType || 'Unassigned';

    await UPDATE(TransportWorkItems)
      .set({
        workType: workType,
        workItem_ID: workItemId || null,
        assignedBy: user,
        assignedDate: new Date().toISOString(),
        version: (tr.version || 0) + 1
      })
      .where({ trNumber });

    // Audit log
    await INSERT.into(ActivityLog).entries({
      userEmail: user,
      action: 'CATEGORIZE',
      entityType: 'TR',
      entityId: trNumber,
      oldValue: oldValue,
      newValue: workType,
      createdAt: new Date().toISOString()
    });

    // Auto-detect phase for the linked work item
    if (workItemId) {
      try { await this._autoDetectPhaseInternal(workItemId); } catch { /* non-critical */ }
    }

    return { success: true, message: `Transport ${trNumber} categorized as ${workType}` };
  }

  // ─── Bulk Categorize ───
  async _onBulkCategorize(req) {
    const { items } = req.data;
    const user = req.user.id;
    const { TransportWorkItems, ActivityLog } = this._e;

    if (!items || items.length === 0) {
      return req.reject(400, 'No items provided for bulk categorization');
    }

    let count = 0;
    const timestamp = new Date().toISOString();

    for (const item of items) {
      try {
        await UPDATE(TransportWorkItems)
          .set({
            workType: item.workType,
            workItem_ID: item.workItemId || null,
            assignedBy: user,
            assignedDate: timestamp
          })
          .where({ trNumber: item.trNumber });

        await INSERT.into(ActivityLog).entries({
          userEmail: user,
          action: 'BULK_CATEGORIZE',
          entityType: 'TR',
          entityId: item.trNumber,
          oldValue: null,
          newValue: item.workType,
          createdAt: timestamp
        });

        count++;
      } catch (err) {
        console.error(`Failed to categorize ${item.trNumber}:`, err.message);
      }
    }

    return { success: true, count, message: `${count}/${items.length} transports categorized` };
  }

  // ─── Update Veeva CC Number ───
  async _onUpdateVeevaCC(req) {
    const { trNumber, veevaCCNumber } = req.data;
    const user = req.user.id;
    const { TransportWorkItems, ActivityLog } = this._e;

    // Validate Veeva CC format: IT-CC-****
    if (veevaCCNumber && !/^IT-CC-\d{4,}$/.test(veevaCCNumber)) {
      return req.reject(400, 'Invalid Veeva CC format. Expected: IT-CC-**** (e.g., IT-CC-4521)');
    }

    const tr = await SELECT.one.from(TransportWorkItems).where({ trNumber });
    if (!tr) {
      return req.reject(404, `Transport ${trNumber} not found`);
    }

    await UPDATE(TransportWorkItems)
      .set({ veevaCCNumber })
      .where({ trNumber });

    await INSERT.into(ActivityLog).entries({
      userEmail: user,
      action: 'UPDATE_VEEVA',
      entityType: 'TR',
      entityId: trNumber,
      oldValue: tr.veevaCCNumber || '',
      newValue: veevaCCNumber,
      createdAt: new Date().toISOString()
    });

    return { success: true, message: `Veeva CC updated to ${veevaCCNumber} for ${trNumber}` };
  }

  // ─── Refresh Transport Data from SAP (RFC) ───
  // ─── RFC auto-refresh scheduler ───
  async _reconfigureScheduler() {
    const { AppConfig } = this._e;
    const logger = cds.log('rfc-scheduler');
    await configureRfcScheduler({
      readConfig: async () => {
        const rows = await SELECT.from(AppConfig).where({
          configKey: { in: ['RFC_SCHEDULE_CRON', 'RFC_SCHEDULE_ENABLED'] }
        });
        const map = Object.fromEntries((rows || []).map(r => [r.configKey, r.configValue]));
        return {
          enabled: map.RFC_SCHEDULE_ENABLED === 'true',
          cron:    map.RFC_SCHEDULE_CRON || '',
        };
      },
      runRefresh: async () => {
        // Run the same refresh flow the UI button triggers, without an http req.
        await this._onRefreshTransportData({ data: {}, headers: {}, user: { id: 'scheduler' } });
      },
      logger,
    });
  }

  async _onRefreshTransportData(req) {
    const { TransportWorkItems, SyncLog, AppConfig } = this._e;
    const startTime = Date.now();
    const syncEntry = {
      source: 'RFC',
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      recordsFetched: 0,
      recordsUpdated: 0
    };

    try {
      // Load admin-configurable RFC settings from AppConfig (fall back to env in RFCClient).
      const rfcCfgRows = await SELECT.from(AppConfig).where({
        configKey: { in: ['RFC_DESTINATION_NAME','RFC_FM_NAME','RFC_TR_START_DATE','RFC_SYSTEMS_FILTER'] }
      });
      const rfcCfg = Object.fromEntries((rfcCfgRows || []).map(r => [r.configKey, r.configValue]));

      const rfcClient = new RFCClient({
        destinationName: rfcCfg.RFC_DESTINATION_NAME,
        fmName:          rfcCfg.RFC_FM_NAME,
        startDate:       rfcCfg.RFC_TR_START_DATE,
        systemsFilter:   rfcCfg.RFC_SYSTEMS_FILTER,
      });
      const transports = await rfcClient.getTransports();

      let updated = 0;
      const newTRNumbers = [];
      for (const tr of transports) {
        const parsed = parseTRDescription(tr.description || '');
        const existing = await SELECT.one.from(TransportWorkItems).where({ trNumber: tr.trNumber });

        const data = {
          trNumber: tr.trNumber,
          trDescription: tr.description,
          trOwner: tr.owner,
          ownerFullName: tr.ownerName || tr.owner,
          trStatus: tr.status,
          trFunction: tr.trFunction,
          currentSystem: tr.currentSystem || 'DEV',
          importRC: tr.importRC ?? null,
          createdDate: tr.createdDate,
          lastSynced: new Date().toISOString(),
          // Only set parsed fields if not manually categorized
          ...(existing?.assignedBy ? {} : {
            workType: parsed.workType || existing?.workType || null,
            snowTicket: parsed.snowTicket || existing?.snowTicket || null,
          }),
          // Always update snow ticket if parsed (it's from SAP)
          ...(parsed.snowTicket ? { snowTicket: parsed.snowTicket } : {})
        };

        if (existing) {
          await UPDATE(TransportWorkItems).set(data).where({ trNumber: tr.trNumber });
        } else {
          await INSERT.into(TransportWorkItems).entries(data);
          newTRNumbers.push(tr.trNumber);
        }
        updated++;
      }

      // Auto-link newly inserted TRs against existing work items
      let autoLinked = 0;
      if (newTRNumbers.length > 0) {
        autoLinked = await this._runAutoLink(newTRNumbers);
      }

      const duration = Date.now() - startTime;
      syncEntry.completedAt = new Date().toISOString();
      syncEntry.status = 'SUCCESS';
      syncEntry.recordsFetched = transports.length;
      syncEntry.recordsUpdated = updated;
      syncEntry.durationMs = duration;
      await INSERT.into(SyncLog).entries(syncEntry);

      const autoMsg = autoLinked > 0 ? `, auto-linked ${autoLinked} new TR(s)` : '';
      return { success: true, recordsFetched: transports.length, message: `Synced ${transports.length} transports in ${duration}ms${autoMsg}` };
    } catch (err) {
      syncEntry.completedAt = new Date().toISOString();
      syncEntry.status = 'FAILED';
      syncEntry.errorMessage = err.message;
      syncEntry.durationMs = Date.now() - startTime;
      await INSERT.into(SyncLog).entries(syncEntry);

      console.error('RFC refresh failed:', err.message);
      return { success: false, recordsFetched: 0, message: `RFC refresh failed: ${err.message}` };
    }
  }

  // ─── Refresh SharePoint Data ───
  async _onRefreshSharePointData(req) {
    const { WorkItems, Milestones, SyncLog } = this._e;
    const startTime = Date.now();

    try {
      const spClient = new SharePointClient();
      const projects = await spClient.getProjects();

      let synced = 0;
      for (const project of projects) {
        const existing = await SELECT.one.from(WorkItems).where({ snowTicket: project.snowTicket });

        const data = {
          workItemName: project.title,
          projectCode: project.projectCode,
          workItemType: project.workItemType || 'Project',
          snowTicket: project.snowTicket,
          businessOwner: project.businessOwner,
          systemOwner: project.systemOwner,
          leadDeveloper: project.leadDeveloper,
          functionalLead: project.functionalLead,
          qaLead: project.qaLead,
          kickoffDate: project.kickoffDate,
          devCompleteDate: project.devCompleteDate,
          uatStartDate: project.uatStartDate,
          uatSignoffDate: project.uatSignoffDate,
          goLiveDate: project.goLiveDate,
          hypercareEndDate: project.hypercareEndDate,
          sapModule: project.sapModule,
          sapSystems: project.sapSystems,
          estimatedTRCount: project.estimatedTRCount,
          complexity: project.complexity,
          priority: project.priority,
          status: project.status || 'Active',
          notes: project.notes,
          sharepointSync: true,
          lastSynced: new Date().toISOString()
        };

        let workItemId;
        if (existing) {
          await UPDATE(WorkItems).set(data).where({ ID: existing.ID });
          workItemId = existing.ID;
        } else {
          const result = await INSERT.into(WorkItems).entries(data);
          workItemId = result?.req?.data?.ID || data.ID;
        }

        // Auto-generate milestones from date columns
        if (workItemId) {
          await this._generateMilestones(workItemId, data);
        }

        synced++;
      }

      const duration = Date.now() - startTime;
      await INSERT.into(SyncLog).entries({
        source: 'SHAREPOINT',
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        status: 'SUCCESS',
        recordsFetched: projects.length,
        recordsUpdated: synced,
        durationMs: duration
      });

      return { success: true, recordsSynced: synced, message: `Synced ${synced} projects from SharePoint` };
    } catch (err) {
      await INSERT.into(SyncLog).entries({
        source: 'SHAREPOINT',
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        status: 'FAILED',
        errorMessage: err.message,
        durationMs: Date.now() - startTime
      });

      console.error('SharePoint sync failed:', err.message);
      return { success: false, recordsSynced: 0, message: `SharePoint sync failed: ${err.message}` };
    }
  }

  // ─── Auto-generate milestones from work item dates ───
  async _generateMilestones(workItemId, data) {
    const { Milestones } = this._e;
    const milestoneMap = [
      { name: 'Kickoff', dateField: 'kickoffDate', order: 1 },
      { name: 'Dev Complete', dateField: 'devCompleteDate', order: 2 },
      { name: 'UAT Start', dateField: 'uatStartDate', order: 3 },
      { name: 'UAT Sign-off', dateField: 'uatSignoffDate', order: 4 },
      { name: 'Go-Live', dateField: 'goLiveDate', order: 5 },
      { name: 'Hypercare End', dateField: 'hypercareEndDate', order: 6 }
    ];

    for (const ms of milestoneMap) {
      if (!data[ms.dateField]) continue;

      const existing = await SELECT.one.from(Milestones)
        .where({ workItem_ID: workItemId, milestoneName: ms.name, autoGenerated: true });

      const milestoneData = {
        workItem_ID: workItemId,
        milestoneName: ms.name,
        milestoneDate: data[ms.dateField],
        milestoneOrder: ms.order,
        autoGenerated: true,
        status: new Date(data[ms.dateField]) < new Date() ? 'Overdue' : 'Pending'
      };

      if (existing) {
        await UPDATE(Milestones).set(milestoneData).where({ ID: existing.ID });
      } else {
        await INSERT.into(Milestones).entries(milestoneData);
      }
    }
  }

  // ─── Generate Weekly Report ───
  async _onGenerateWeeklyReport(req) {
    const { workItemId } = req.data;
    const reportGen = new ReportGenerator(this.db, this._e);

    try {
      const reportData = await reportGen.gatherReportData(workItemId);

      // Log it
      const { ActivityLog } = this._e;
      await INSERT.into(ActivityLog).entries({
        userEmail: req.user.id,
        action: 'GENERATE_REPORT',
        entityType: 'REPORT',
        entityId: new Date().toISOString().split('T')[0],
        newValue: `Report data generated (project: ${workItemId || 'all'})`,
        createdAt: new Date().toISOString()
      });

      return { success: true, data: JSON.stringify(reportData), message: 'Report data generated' };
    } catch (err) {
      console.error('Report generation failed:', err.message);
      return { success: false, data: null, message: `Report failed: ${err.message}` };
    }
  }

  // ─── Update Test Status ───
  async _onUpdateTestStatus(req) {
    const { workItemId, testTotal, testPassed, testFailed, testBlocked, testTBD, testSkipped } = req.data;
    const { WorkItems } = this._e;

    const workItem = await SELECT.one.from(WorkItems).where({ ID: workItemId });
    if (!workItem) {
      return req.reject(404, `Work item ${workItemId} not found`);
    }

    // Calculate completion % and UAT status
    const total = testTotal || 0;
    const executed = (testPassed || 0) + (testFailed || 0);
    const completionPct = total > 0 ? Math.round((executed / total) * 10000) / 100 : 0;

    // Determine UAT status
    let uatStatus = 'Not Started';
    if (total === 0) {
      uatStatus = 'Not Started';
    } else if ((testFailed || 0) > 0) {
      uatStatus = 'Failed';
    } else if ((testBlocked || 0) > 0 && (testTBD || 0) === 0) {
      uatStatus = 'Blocked';
    } else if ((testTBD || 0) === 0 && (testBlocked || 0) === 0 && (testPassed || 0) > 0) {
      uatStatus = 'Passed';
    } else if ((testPassed || 0) > 0) {
      uatStatus = 'In Progress';
    }

    // Calculate RAG impact from tests
    const daysToGoLive = workItem.goLiveDate
      ? Math.ceil((new Date(workItem.goLiveDate) - new Date()) / 86400000)
      : 999;
    const ragImpact = testRAGImpact(
      { total, passed: testPassed || 0, failed: testFailed || 0, blocked: testBlocked || 0, tbd: testTBD || 0 },
      daysToGoLive
    );

    // Update work item
    const updateData = {
      testTotal: total,
      testPassed: testPassed || 0,
      testFailed: testFailed || 0,
      testBlocked: testBlocked || 0,
      testTBD: testTBD || 0,
      testSkipped: testSkipped || 0,
      testCompletionPct: completionPct,
      uatStatus
    };

    // Auto-update RAG if test results indicate risk
    if (ragImpact && ragImpact !== 'GREEN') {
      // Only escalate RAG, never downgrade from manual override
      const ragPriority = { GREEN: 1, AMBER: 2, RED: 3 };
      if ((ragPriority[ragImpact] || 0) > (ragPriority[workItem.overallRAG] || 0)) {
        updateData.overallRAG = ragImpact;
      }
    }

    await UPDATE(WorkItems).set(updateData).where({ ID: workItemId });

    // Save trend snapshot (non-blocking)
    this._saveProgressSnapshot(workItemId).catch(() => {});

    return {
      success: true,
      message: `Test status updated: ${completionPct}% complete, UAT: ${uatStatus}`,
      testCompletionPct: completionPct,
      uatStatus,
      ragImpact: ragImpact || 'GREEN'
    };
  }

  // ─── Test AI Connection ───
  async _onTestAIConnection(req) {
    try {
      const ai = await AIClient.create(this.db, this._e);
      const result = await ai.testConnection();
      return { success: true, message: result.message, provider: result.provider };
    } catch (err) {
      return { success: false, message: `AI connection failed: ${err.message}`, provider: '' };
    }
  }

  // ─── Save AI Configuration (no-op — AI is configured via BTP Destination) ───
  async _onSaveAIConfig(req) {
    // AI auth is managed entirely through the BTP Destination "Ai_Core".
    // Destination name and deployment ID are saved via the generic updateConfig action.
    return { success: true, message: 'AI is configured via BTP Destination. Use Settings → SAP AI Core Integration to update the destination name and deployment ID.' };
  }

  // ─── Chat with AI Agent ───
  async _onChatWithAgent(req) {
    const { question } = req.data;
    if (!question?.trim()) {
      return { success: false, answer: 'Please ask a question.', provider: '' };
    }

    try {
      const ai = await AIClient.create(this.db, this._e);
      if (!ai.enabled) {
        return { success: false, answer: 'AI is not configured. Go to Settings → SAP AI Core Integration and set the Deployment ID.', provider: '' };
      }

      // Gather app data filtered by user's allowed applications
      const allowed = this._getAllowedApps(req);
      const appContext = await this._gatherAgentContext(allowed);
      const answer = await ai.chat(question, appContext);

      return { success: true, answer, provider: ai.provider };
    } catch (err) {
      return { success: false, answer: `Agent error: ${err.message}`, provider: '' };
    }
  }

  // ─── Gather data for AI agent context (filtered by allowedApps) ───
  async _gatherAgentContext(allowedApps) {
    const { TransportWorkItems, WorkItems, Milestones, Risks, ActionItems } = this._e;

    let workItems, transports, milestones, risks, actionItems;
    if (allowedApps && allowedApps.length > 0) {
      workItems = await SELECT.from(WorkItems).where({ application: { in: allowedApps } });
      const wiIds = workItems.map(w => w.ID);
      [transports, milestones, risks, actionItems] = wiIds.length > 0 ? await Promise.all([
        SELECT.from(TransportWorkItems).where({ workItem_ID: { in: wiIds } }),
        SELECT.from(Milestones).where({ workItem_ID: { in: wiIds } }),
        SELECT.from(Risks).where({ workItem_ID: { in: wiIds } }),
        SELECT.from(ActionItems).where({ workItem_ID: { in: wiIds } }),
      ]) : [[], [], [], []];
    } else {
      [workItems, transports, milestones, risks, actionItems] = await Promise.all([
        SELECT.from(WorkItems),
        SELECT.from(TransportWorkItems),
        SELECT.from(Milestones),
        SELECT.from(Risks),
        SELECT.from(ActionItems),
      ]);
    }

    const now = new Date();
    const lines = [];

    // Split active vs done
    const activeItems = workItems.filter(w => w.status !== 'Done');
    const doneItems   = workItems.filter(w => w.status === 'Done');

    // Build risk/action lookup by workItem_ID
    const risksByWI = {};
    for (const r of risks) {
      if (!risksByWI[r.workItem_ID]) risksByWI[r.workItem_ID] = [];
      risksByWI[r.workItem_ID].push(r);
    }
    const actionsByWI = {};
    for (const a of actionItems) {
      if (!actionsByWI[a.workItem_ID]) actionsByWI[a.workItem_ID] = [];
      actionsByWI[a.workItem_ID].push(a);
    }

    lines.push(`=== WORK ITEMS (${workItems.length} total: ${activeItems.length} active, ${doneItems.length} done) ===`);

    for (const wi of activeItems) {
      const goLiveDays = wi.goLiveDate ? Math.ceil((new Date(wi.goLiveDate) - now) / 86400000) : null;
      lines.push(`- ${wi.workItemName} [${wi.workItemType}] | Code: ${wi.projectCode} | Module: ${wi.sapModule}`);
      lines.push(`  RAG: ${wi.overallRAG || 'N/A'} | Phase: ${wi.currentPhase || 'N/A'} | Status: ${wi.status} | Methodology: ${wi.methodology || 'N/A'}`);
      lines.push(`  Deploy: ${wi.deploymentPct || 0}% | Priority: ${wi.priority || 'N/A'} | Complexity: ${wi.complexity || 'N/A'}`);
      if (wi.testTotal > 0) {
        lines.push(`  Tests: ${wi.testPassed}/${wi.testTotal} passed (${wi.testCompletionPct}%), Failed: ${wi.testFailed}, TBD: ${wi.testTBD}, Blocked: ${wi.testBlocked} | UAT: ${wi.uatStatus}`);
      }
      lines.push(`  Business Owner: ${wi.businessOwner || 'N/A'} | System Owner: ${wi.systemOwner || 'N/A'} | Dev Lead: ${wi.leadDeveloper || 'N/A'}`);
      if (wi.goLiveDate) lines.push(`  Go-Live: ${wi.goLiveDate} (${goLiveDays > 0 ? goLiveDays + ' days away' : 'OVERDUE'})`);
      if (wi.veevaCCNumber) lines.push(`  Veeva CC: ${wi.veevaCCNumber}`);
      if (wi.notes) lines.push(`  Notes: ${wi.notes}`);

      // Open risks
      const wiRisks = (risksByWI[wi.ID] || []).filter(r => r.status === 'Open' || r.status === 'Mitigated');
      if (wiRisks.length > 0) {
        lines.push(`  Open Risks (${wiRisks.length}):`);
        for (const r of wiRisks) {
          lines.push(`    [${r.likelihood} likelihood / ${r.impact} impact] ${r.description} | Owner: ${r.owner || 'N/A'} | Status: ${r.status}`);
          if (r.mitigation) lines.push(`      Mitigation: ${r.mitigation}`);
        }
      }

      // Open action items
      const wiActions = (actionsByWI[wi.ID] || []).filter(a => a.status !== 'Done' && a.status !== 'Cancelled');
      if (wiActions.length > 0) {
        lines.push(`  Open Actions (${wiActions.length}):`);
        for (const a of wiActions) {
          const overdue = a.dueDate && new Date(a.dueDate) < now ? ' [OVERDUE]' : '';
          lines.push(`    [${a.priority}] ${a.description} | Owner: ${a.owner || 'N/A'} | Due: ${a.dueDate || 'N/A'}${overdue}`);
        }
      }
    }

    if (doneItems.length > 0) {
      lines.push(`Done items: ${doneItems.map(w => `${w.workItemName} [${w.workItemType}]`).join('; ')}`);
    }

    // Transports — include Veeva CC details
    lines.push(`\n=== TRANSPORTS (${transports.length} total) ===`);
    const bySys = { DEV: 0, QAS: 0, PRD: 0 };
    const stuck = [], failed = [];
    const veevaTRs = [];
    for (const tr of transports) {
      bySys[tr.currentSystem] = (bySys[tr.currentSystem] || 0) + 1;
      const age = (now - new Date(tr.createdDate)) / 86400000;
      if (tr.currentSystem !== 'PRD' && tr.trStatus !== 'Released' && age > 5) stuck.push(tr);
      if (tr.importRC >= 8) failed.push(tr);
      if (tr.veevaCCNumber) veevaTRs.push(tr);
    }
    lines.push(`DEV: ${bySys.DEV || 0} | QAS: ${bySys.QAS || 0} | PRD: ${bySys.PRD || 0}`);
    lines.push(`Stuck (>5 days, modifiable): ${stuck.length} | Failed imports (RC>=8): ${failed.length}`);
    lines.push(`Unassigned: ${transports.filter(t => !t.workType).length}`);

    if (failed.length > 0) {
      lines.push('Failed transports:');
      for (const tr of failed.slice(0, 10)) {
        lines.push(`  - ${tr.trNumber} | ${tr.trDescription} | RC=${tr.importRC} | System: ${tr.currentSystem} | Owner: ${tr.ownerFullName || tr.trOwner}`);
      }
    }

    // Veeva CC section — group TRs by CC number
    if (veevaTRs.length > 0) {
      lines.push(`\n=== VEEVA CHANGE CONTROLS (${veevaTRs.length} TRs with CC numbers) ===`);
      const byCc = {};
      for (const tr of veevaTRs) {
        if (!byCc[tr.veevaCCNumber]) byCc[tr.veevaCCNumber] = [];
        byCc[tr.veevaCCNumber].push(tr);
      }
      for (const [cc, ccTRs] of Object.entries(byCc)) {
        lines.push(`${cc}: ${ccTRs.length} transport(s)`);
        for (const tr of ccTRs) {
          lines.push(`  - ${tr.trNumber} [${tr.workType || 'Unassigned'}] | ${tr.currentSystem} | RC=${tr.importRC ?? 'N/A'} | ${tr.trDescription?.substring(0, 80) || ''}`);
        }
      }
    }

    lines.push(`\n=== MILESTONES (${milestones.length} total) ===`);
    const overdue = milestones.filter(m => m.status !== 'Complete' && new Date(m.milestoneDate) < now);
    lines.push(`Overdue: ${overdue.length}`);
    for (const m of overdue.slice(0, 10)) {
      lines.push(`  - ${m.milestoneName} | Due: ${m.milestoneDate} | Status: ${m.status}`);
    }

    lines.push(`\n=== SUMMARY ===`);
    const redProjects   = workItems.filter(w => w.overallRAG === 'RED');
    const amberProjects = workItems.filter(w => w.overallRAG === 'AMBER');
    const openRisksTotal  = risks.filter(r => r.status === 'Open').length;
    const openActionsTotal = actionItems.filter(a => a.status !== 'Done' && a.status !== 'Cancelled').length;
    lines.push(`RED projects: ${redProjects.length} — ${redProjects.map(p => p.workItemName).join(', ') || 'None'}`);
    lines.push(`AMBER projects: ${amberProjects.length} — ${amberProjects.map(p => p.workItemName).join(', ') || 'None'}`);
    lines.push(`Open risks across portfolio: ${openRisksTotal}`);
    lines.push(`Open action items across portfolio: ${openActionsTotal}`);
    lines.push(`Today: ${now.toISOString().split('T')[0]}`);

    return lines.join('\n');
  }

  // ─── Auto-save progress snapshot (called after work item updates) ───
  async _saveProgressSnapshot(workItemId) {
    try {
      const { WorkItems, ProgressSnapshots } = this._e;
      const wi = await SELECT.one.from(WorkItems).where({ ID: workItemId });
      if (!wi) return;

      const today = new Date().toISOString().split('T')[0];
      const testPassRate = wi.testTotal > 0 ? Math.round((wi.testPassed / wi.testTotal) * 100 * 100) / 100 : 0;

      // Upsert: one snapshot per work item per day
      const existing = await SELECT.one.from(ProgressSnapshots).where({ workItem_ID: workItemId, snapshotDate: today });
      if (existing) {
        await UPDATE(ProgressSnapshots).set({
          deploymentPct: wi.deploymentPct || 0,
          testPassRate,
          ragStatus: wi.overallRAG || 'GREEN',
          testPassed: wi.testPassed || 0,
          testTotal: wi.testTotal || 0,
        }).where({ ID: existing.ID });
      } else {
        await INSERT.into(ProgressSnapshots).entries({
          workItem_ID: workItemId,
          snapshotDate: today,
          deploymentPct: wi.deploymentPct || 0,
          testPassRate,
          ragStatus: wi.overallRAG || 'GREEN',
          testPassed: wi.testPassed || 0,
          testTotal: wi.testTotal || 0,
        });
      }
    } catch { /* non-critical — don't fail the parent operation */ }
  }

  // ─── Analyze Uploaded Document (AI-powered) ───
  async _onAnalyzeDocument(req) {
    const { content, documentType, application, fileName } = req.data;
    if (!content?.trim()) {
      return { success: false, proposals: '[]', summary: 'No content provided.', provider: '' };
    }

    try {
      const ai = await AIClient.create(this.db, this._e);
      if (!ai.enabled) {
        return { success: false, proposals: '[]', summary: 'AI is not configured. Go to Settings → AI Integration.', provider: '' };
      }

      // Determine document type context
      const docTypeContext = {
        email: 'This is an email (potentially a project request, status update, or approval). Extract project details, action items, timelines, owners, and any referenced tickets or systems.',
        veeva: 'This is a Veeva Change Control document (pharmaceutical/life sciences). Extract change requests, impacted systems (Veeva CRM, Vault, PromoMats, Align, etc.), regulatory requirements, validation needs, affected business processes, and timelines.',
        sharepoint: 'This is content from a SharePoint document or project tracker. Extract project names, milestones, owners, status updates, dates, and deliverables.',
        general: 'This is a general project document. Extract all project-related information including names, types, owners, timelines, statuses, and action items.',
      }[documentType] || 'Analyze this document for project management information.';

      // Application context for proper work item types
      const appTypes = {
        SAP: 'Project, Enhancement, Break-fix, Support, Hypercare, Upgrade',
        Coupa: 'Implementation, Integration, Configuration, Data Migration, Upgrade, Support, Optimization, Supplier Enablement',
        Commercial: 'Product Launch, Campaign, Compliance Initiative, Market Access, Field Force, MLR Review, Veeva Implementation, Analytics Project',
      }[application] || 'Project, Enhancement, Support';

      const appPhases = {
        SAP: 'Planning, Development, Testing, Go-Live, Hypercare, Complete',
        Coupa: 'Design, Configure, Build, Test, Deploy, Optimize',
        Commercial: 'Planning, Pre-Launch, Execution, Monitoring, Close-Out',
      }[application] || 'Planning, Development, Testing, Go-Live, Complete';

      const systemPrompt = `You are an expert project management AI assistant with deep knowledge of enterprise software implementations.
Your specialty areas include SAP ERP, Coupa Procurement, and Life Sciences Commercial Operations (Veeva, pharma compliance).

TASK: Analyze the uploaded document and propose work items to create in our project management system.

DOCUMENT TYPE: ${documentType}
${docTypeContext}

APPLICATION: ${application}
Valid work item types for this application: ${appTypes}
Valid phases: ${appPhases}

You MUST respond with ONLY valid JSON — no markdown code fences, no explanation text before or after.
Return a JSON object with this exact structure:
{
  "summary": "Brief 2-3 sentence summary of what the document contains",
  "proposals": [
    {
      "workItemName": "Descriptive name for the work item",
      "workItemType": "One of the valid types listed above",
      "projectCode": "Auto-generated code like PRJ-XXX-2026-XX",
      "priority": "P1 or P2 or P3",
      "complexity": "Low or Medium or High or Critical",
      "currentPhase": "One of the valid phases listed above",
      "businessOwner": "Extracted from document or empty string",
      "notes": "Key details, requirements, or context from the document",
      "estimatedGoLive": "YYYY-MM-DD if mentioned, or empty string",
      "confidence": "high or medium or low — how confident you are this item should be created"
    }
  ]
}

RULES:
- Extract as many distinct work items as the document suggests (1-10 items typically)
- Use the EXACT work item types listed above — do not invent new types
- Set realistic priorities based on urgency/impact signals in the document
- Include relevant details in the notes field
- For emails: look for action items, project requests, escalations
- For Veeva Change Controls: each change request may be a separate work item
- For SharePoint: extract distinct projects or deliverables
- If the document doesn't contain enough info for a field, use empty string
- NEVER hallucinate — only extract what's actually in the document`;

      const userMessage = `File name: ${fileName || 'Unknown'}
Application: ${application}

DOCUMENT CONTENT:
${content.substring(0, 15000)}`;

      let response = await ai._call(systemPrompt, userMessage, 4000);

      // Strip markdown code fences if present
      response = response.trim();
      if (response.startsWith('```')) {
        response = response.replace(/^[\s]*```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      // Parse the AI response
      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch (parseErr) {
        return { success: false, proposals: '[]', summary: `AI returned invalid JSON. Raw response: ${response.substring(0, 500)}`, provider: ai.provider };
      }

      return {
        success: true,
        proposals: JSON.stringify(parsed.proposals || []),
        summary: parsed.summary || 'Document analyzed successfully.',
        provider: ai.provider,
      };
    } catch (err) {
      return { success: false, proposals: '[]', summary: `Analysis failed: ${err.message}`, provider: '' };
    }
  }

  // ─── Create Work Items from AI Proposals ───
  async _onCreateFromProposal(req) {
    const { proposals, application } = req.data;
    const { WorkItems } = this._e;

    try {
      const items = JSON.parse(proposals);
      if (!Array.isArray(items) || items.length === 0) {
        return { success: false, created: 0, message: 'No proposals to create.' };
      }

      let created = 0;
      for (const item of items) {
        const newId = cds.utils.uuid();
        await INSERT.into(WorkItems).entries({
          ID: newId,
          workItemName: item.workItemName || 'Untitled Work Item',
          projectCode: item.projectCode || `AI-${application?.substring(0, 3) || 'GEN'}-${Date.now().toString(36).toUpperCase()}`,
          workItemType: item.workItemType || 'Project',
          application: application || 'SAP',
          priority: item.priority || 'P2',
          complexity: item.complexity || 'Medium',
          status: 'Active',
          currentPhase: item.currentPhase || 'Planning',
          businessOwner: item.businessOwner || '',
          notes: item.notes || '',
          goLiveDate: item.estimatedGoLive || null,
          overallRAG: 'GREEN',
          riskScore: 0,
          deploymentPct: 0,
          methodology: 'Hybrid',
        });
        created++;
      }

      return { success: true, created, message: `Successfully created ${created} work item(s) from AI analysis.` };
    } catch (err) {
      return { success: false, created: 0, message: `Creation failed: ${err.message}` };
    }
  }

  // ─── Generate Template from Email (AI-powered) ───
  async _onGenerateTemplateFromEmail(req) {
    const { emailContent, templateName, scope } = req.data;
    if (!emailContent?.trim()) {
      return { success: false, templateHtml: '', message: 'Please provide email content.', provider: '' };
    }

    try {
      const ai = await AIClient.create(this.db, this._e);
      if (!ai.enabled) {
        return { success: false, templateHtml: '', message: 'AI is not configured. Go to Settings → AI Integration.', provider: '' };
      }

      const systemPrompt = `You are an expert email template engineer. The user will provide a sample email they currently send for project reporting.
Your job: analyze the email structure, layout, and style, then generate a REUSABLE Outlook-compatible HTML template.

OUTPUT RULES:
- Output ONLY valid HTML — NO markdown, NO code fences
- Use inline CSS on every element (Outlook ignores <style> blocks)
- Font: Calibri, Arial, sans-serif
- Tables: border-collapse:collapse, 1px solid #d6d6d6 borders, header row background #1f4e79 with white text
- Use {{placeholders}} for dynamic content that will be replaced with real project data

AVAILABLE PLACEHOLDERS (use these in the template):
  {{weekLabel}} — e.g. "WK14 FY2026"
  {{date}} — report date
  {{projectName}} — project name
  {{projectCode}} — project code
  {{sapModule}} — e.g. FICO, SD, MM
  {{sapOwner}} — SAP project owner
  {{businessOwner}} — business owner
  {{systemOwner}} — system owner
  {{goLiveDate}} — go-live date
  {{overallRAG}} — RAG status (GREEN/AMBER/RED) — you can use 🟢🟡🔴 emojis
  {{currentPhase}} — current project phase
  {{deploymentPct}} — deployment percentage
  {{testCompletionPct}} — test completion %
  {{totalTRs}} — total transport count
  {{trsDEV}} — transports in DEV
  {{trsQAS}} — transports in QAS
  {{trsPRD}} — transports in PRD
  {{milestonesTable}} — will be replaced with a milestones HTML table
  {{currentWeekItems}} — bullet list of current week activities
  {{nextWeekItems}} — bullet list of next week plans
  {{risksSection}} — will contain risk/issue highlights

Preserve the user's email structure as closely as possible but make it professional and Outlook-ready.
If the email has a greeting, keep it. If it has a sign-off, keep it.`;

      const userMessage = `Here is a sample email the user currently sends for project reporting. Generate a reusable Outlook HTML template from this:

---
${emailContent}
---

Template name: ${templateName || 'Custom Template'}
Scope: ${scope || 'single'} (${scope === 'multi' ? 'all projects summary' : scope === 'both' ? 'works for single and multi' : 'single project report'})`;

      let html = await ai._call(systemPrompt, userMessage, 3000);

      // Strip code fences if AI wraps in ```html
      if (html.trimStart().startsWith('```')) {
        html = html.replace(/^[\s]*```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      return { success: true, templateHtml: html, message: 'Template generated successfully', provider: ai.provider };
    } catch (err) {
      return { success: false, templateHtml: '', message: `Template generation failed: ${err.message}`, provider: '' };
    }
  }

  // ─── Save Report Template (CRUD) ───
  async _onSaveReportTemplate(req) {
    const { id, templateName, description, templateHtml, scope, visibility, isDefault } = req.data;
    const { ReportTemplates } = this._e;
    const userEmail = req.user?.id || 'anonymous@test.com';

    try {
      // If setting as default, clear other defaults for this user+scope
      if (isDefault) {
        const existing = await SELECT.from(ReportTemplates)
          .where({ ownerEmail: userEmail, scope: scope || 'single', isDefault: true });
        for (const t of existing) {
          await UPDATE(ReportTemplates, t.ID).set({ isDefault: false });
        }
      }

      if (id) {
        // Update existing template
        const existing = await SELECT.one.from(ReportTemplates, id);
        if (!existing) return { success: false, templateId: '', message: 'Template not found' };
        // Only owner can edit
        if (existing.ownerEmail !== userEmail) {
          return { success: false, templateId: '', message: 'You can only edit your own templates' };
        }
        await UPDATE(ReportTemplates, id).set({
          templateName: templateName || existing.templateName,
          description: description ?? existing.description,
          templateHtml: templateHtml || existing.templateHtml,
          scope: scope || existing.scope,
          visibility: visibility || existing.visibility,
          isDefault: isDefault ?? existing.isDefault,
        });
        return { success: true, templateId: id, message: 'Template updated' };
      } else {
        // Create new template
        const newId = cds.utils.uuid();
        await INSERT.into(ReportTemplates).entries({
          ID: newId,
          templateName: templateName || 'Untitled Template',
          description: description || '',
          templateHtml: templateHtml || '',
          scope: scope || 'single',
          visibility: visibility || 'private',
          isDefault: isDefault || false,
          ownerEmail: userEmail,
          sourceType: 'manual',
        });
        return { success: true, templateId: newId, message: 'Template saved' };
      }
    } catch (err) {
      return { success: false, templateId: '', message: `Save failed: ${err.message}` };
    }
  }

  // ─── Delete Report Template ───
  async _onDeleteReportTemplate(req) {
    const { id } = req.data;
    const { ReportTemplates } = this._e;
    const userEmail = req.user?.id || 'anonymous@test.com';

    try {
      const existing = await SELECT.one.from(ReportTemplates, id);
      if (!existing) return { success: false, message: 'Template not found' };
      if (existing.ownerEmail !== userEmail) {
        return { success: false, message: 'You can only delete your own templates' };
      }
      await DELETE.from(ReportTemplates, id);
      return { success: true, message: 'Template deleted' };
    } catch (err) {
      return { success: false, message: `Delete failed: ${err.message}` };
    }
  }

  // ─── Get Methodology Templates ───
  async _onGetMethodologies(req) {
    return getMethodologyList();
  }

  // ─── Current User Info (/me endpoint) ───
  async _onCurrentUser(req) {
    const user = req.user;
    const roles = [];
    if (user.is('SuperAdmin')) roles.push('SuperAdmin');
    if (user.is('Admin')) roles.push('Admin');
    if (user.is('Manager')) roles.push('Manager');
    if (user.is('Developer')) roles.push('Developer');
    if (user.is('Executive')) roles.push('Executive');

    // Determine which applications the user can access
    const allowedApps = [];
    if (user.is('SuperAdmin') || user.is('SAP')) allowedApps.push('SAP');
    if (user.is('SuperAdmin') || user.is('Coupa')) allowedApps.push('Coupa');
    if (user.is('SuperAdmin') || user.is('Commercial')) allowedApps.push('Commercial');
    // Backward compat: if no app roles assigned, grant all apps
    if (allowedApps.length === 0) {
      allowedApps.push('SAP', 'Coupa', 'Commercial');
    }

    return {
      email: user.id,
      name: user.id.split('@')[0], // Simple name extraction; overridden by IdP in prod
      roles,
      isAdmin: user.is('Admin') || user.is('SuperAdmin'),
      isManager: user.is('Manager'),
      isDeveloper: user.is('Developer'),
      isExecutive: user.is('Executive'),
      isSuperAdmin: user.is('SuperAdmin'),
      allowedApps,
    };
  }

  // ─── Auto-Generate Notifications ───
  async _onGenerateNotifications(req) {
    const { TransportWorkItems, WorkItems, Notifications } = this._e;
    const now = new Date();
    let generated = 0;

    try {
      const allTRs = await SELECT.from(TransportWorkItems);
      const allWIs = await SELECT.from(WorkItems).where({ status: 'Active' });

      // 1. Stuck transports (>5 days in same non-PRD system)
      for (const tr of allTRs) {
        if (tr.currentSystem === 'PRD') continue;
        const daysInSystem = (now - new Date(tr.createdDate)) / 86400000;
        if (daysInSystem > 5) {
          const existing = await SELECT.one.from(Notifications)
            .where({ trNumber: tr.trNumber, type: 'STUCK_TR', isRead: false });
          if (!existing) {
            await INSERT.into(Notifications).entries({
              userEmail: tr.trOwner || tr.ownerFullName || 'system',
              type: 'STUCK_TR',
              message: `Transport ${tr.trNumber} stuck in ${tr.currentSystem} for ${Math.round(daysInSystem)} days — "${tr.trDescription}"`,
              trNumber: tr.trNumber,
              isRead: false
            });
            generated++;
          }
        }
      }

      // 2. Failed imports (RC >= 8)
      for (const tr of allTRs) {
        if (tr.importRC >= 8) {
          const existing = await SELECT.one.from(Notifications)
            .where({ trNumber: tr.trNumber, type: 'FAILED_IMPORT', isRead: false });
          if (!existing) {
            await INSERT.into(Notifications).entries({
              userEmail: tr.trOwner || tr.ownerFullName || 'system',
              type: 'FAILED_IMPORT',
              message: `Transport ${tr.trNumber} FAILED import in ${tr.currentSystem} (RC=${tr.importRC}) — "${tr.trDescription}"`,
              trNumber: tr.trNumber,
              isRead: false
            });
            generated++;
          }
        }
      }

      // 3. Go-live approaching (within 14 days)
      for (const wi of allWIs) {
        if (!wi.goLiveDate) continue;
        const daysUntil = Math.ceil((new Date(wi.goLiveDate) - now) / 86400000);
        if (daysUntil > 0 && daysUntil <= 14) {
          const existing = await SELECT.one.from(Notifications)
            .where({ type: 'GOLIVE_APPROACHING', isRead: false })
            .and('message like', `%${wi.workItemName}%`);
          if (!existing) {
            await INSERT.into(Notifications).entries({
              userEmail: wi.businessOwner || wi.leadDeveloper || 'system',
              type: 'GOLIVE_APPROACHING',
              message: `🚀 "${wi.workItemName}" go-live in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${wi.goLiveDate}) — Deploy: ${wi.deploymentPct || 0}%, Tests: ${wi.testCompletionPct || 0}%`,
              trNumber: null,
              isRead: false
            });
            generated++;
          }
        }
      }

      // 4. Test failures > 10% for active projects
      for (const wi of allWIs) {
        if (wi.testTotal > 0 && wi.testFailed > 0) {
          const failRate = wi.testFailed / wi.testTotal;
          if (failRate > 0.10) {
            const existing = await SELECT.one.from(Notifications)
              .where({ type: 'TEST_FAILURES', isRead: false })
              .and('message like', `%${wi.workItemName}%`);
            if (!existing) {
              await INSERT.into(Notifications).entries({
                userEmail: wi.qaLead || wi.leadDeveloper || 'system',
                type: 'TEST_FAILURES',
                message: `⚠️ "${wi.workItemName}" has ${wi.testFailed}/${wi.testTotal} test failures (${Math.round(failRate * 100)}%) — UAT: ${wi.uatStatus}`,
                trNumber: null,
                isRead: false
              });
              generated++;
            }
          }
        }
      }

      return { success: true, generated, message: `Generated ${generated} new notifications` };
    } catch (err) {
      console.error('Notification generation failed:', err.message);
      return { success: false, generated: 0, message: `Failed: ${err.message}` };
    }
  }

  // ─── Health Check ───
  async _onHealth(req) {
    const result = {
      status: 'OK',
      database: 'UNKNOWN',
      rfc: 'UNKNOWN',
      sharepoint: 'UNKNOWN',
      timestamp: new Date().toISOString()
    };

    // Check database
    try {
      await SELECT.one.from(this._e.AppConfig);
      result.database = 'OK';
    } catch {
      result.database = 'FAILED';
      result.status = 'DEGRADED';
    }

    // RFC and SharePoint are external — check last sync status
    try {
      const { SyncLog } = this._e;
      const lastRfc = await SELECT.one.from(SyncLog)
        .where({ source: 'RFC' })
        .orderBy('startedAt desc');
      result.rfc = lastRfc?.status === 'SUCCESS' ? 'OK' : (lastRfc?.status || 'NOT_SYNCED');

      const lastSp = await SELECT.one.from(SyncLog)
        .where({ source: 'SHAREPOINT' })
        .orderBy('startedAt desc');
      result.sharepoint = lastSp?.status === 'SUCCESS' ? 'OK' : (lastSp?.status || 'NOT_SYNCED');
    } catch {
      // Non-critical
    }

    return result;
  }

  // ─── Dashboard Summary ───
  async _onDashboardSummary(req) {
    const { TransportWorkItems, WorkItems } = this._e;
    const application = req.data?.application || null;

    // Build application filter for WorkItems
    const wiFilter = application ? { status: 'Active', application } : { status: 'Active' };
    const wiDoneFilter = application ? { status: 'Done', application } : { status: 'Done' };

    const [
      activeProjects,
      completedWorkItems
    ] = await Promise.all([
      SELECT.from(WorkItems).where(wiFilter),
      SELECT.from(WorkItems).where(wiDoneFilter)
    ]);

    // Filter transports by application: only TRs linked to matching WorkItems
    let allTRs;
    if (application) {
      const wiIds = activeProjects.map(w => w.ID);
      const doneIds = completedWorkItems.map(w => w.ID);
      const allIds = [...wiIds, ...doneIds];
      allTRs = allIds.length > 0
        ? await SELECT.from(TransportWorkItems).where({ workItem_ID: { in: allIds } })
        : [];
    } else {
      allTRs = await SELECT.from(TransportWorkItems);
    }

    const unassigned = allTRs.filter(tr => !tr.workType);

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stuckTRs = allTRs.filter(tr => {
      if (tr.currentSystem === 'PRD') return false;
      const created = new Date(tr.createdDate);
      const daysInSystem = (now - created) / (1000 * 60 * 60 * 24);
      return daysInSystem > 5;
    });

    const failedImports = allTRs.filter(tr => tr.importRC >= 8);

    // Pending items = stuck TRs + overdue milestones + unassigned TRs
    const pendingItems = stuckTRs.length + unassigned.length;

    // Completed this week = work items completed in last 7 days
    const completedRecent = completedWorkItems.filter(wi => {
      const modified = new Date(wi.modifiedAt || wi.createdAt);
      return modified >= oneWeekAgo;
    });

    // Average deployment time
    const deployedTRs = allTRs.filter(tr => tr.currentSystem === 'PRD' && tr.createdDate);
    let avgDays = 0;
    if (deployedTRs.length > 0) {
      const totalDays = deployedTRs.reduce((sum, tr) => {
        return sum + (now - new Date(tr.createdDate)) / (1000 * 60 * 60 * 24);
      }, 0);
      avgDays = Math.round(totalDays / deployedTRs.length * 10) / 10;
    }

    return {
      activeProjects: activeProjects.length,
      totalTransports: allTRs.length,
      unassignedCount: unassigned.length,
      pendingItems: pendingItems,
      completedThisWeek: completedRecent.length,
      stuckTransports: stuckTRs.length,
      failedImports: failedImports.length,
      avgDeploymentDays: avgDays
    };
  }

  // ─── Pipeline Summary ───
  async _onPipelineSummary(req) {
    const { TransportWorkItems, WorkItems } = this._e;
    const application = req.data?.application || null;

    // Filter transports by application if specified
    let allTRs;
    if (application) {
      const wiIds = (await SELECT.from(WorkItems).where({ application }).columns('ID')).map(w => w.ID);
      allTRs = wiIds.length > 0
        ? await SELECT.from(TransportWorkItems).where({ workItem_ID: { in: wiIds } })
        : [];
    } else {
      allTRs = await SELECT.from(TransportWorkItems);
    }

    const now = new Date();
    const devTRs = allTRs.filter(tr => tr.currentSystem === 'DEV');
    const qasTRs = allTRs.filter(tr => tr.currentSystem === 'QAS');
    const prdTRs = allTRs.filter(tr => tr.currentSystem === 'PRD');

    const stuckTRs = allTRs.filter(tr => {
      if (tr.currentSystem === 'PRD') return false;
      if (tr.trStatus === 'Released') return false; // Released TRs awaiting import are not stuck
      const created = new Date(tr.createdDate);
      return (now - created) / (1000 * 60 * 60 * 24) > 5;
    });

    const failedTRs = allTRs.filter(tr => tr.importRC >= 8);

    return {
      devCount: devTRs.length,
      qasCount: qasTRs.length,
      prdCount: prdTRs.length,
      queueCount: 0, // Would come from Z_TCC_GET_IMPORT_QUEUE
      stuckCount: stuckTRs.length,
      failedCount: failedTRs.length
    };
  }

  // ─── Auto-Detect Phase from TR State ───
  async _onAutoDetectPhase(req) {
    const { workItemId } = req.data;
    return this._autoDetectPhaseInternal(workItemId, req);
  }

  async _autoDetectPhaseInternal(workItemId, req) {
    const { TransportWorkItems, WorkItems } = this._e;

    const wi = await SELECT.one.from(WorkItems).where({ ID: workItemId });
    if (!wi) {
      if (req) return req.reject(404, `Work item ${workItemId} not found`);
      return { success: false, phase: '', message: 'Work item not found' };
    }

    const trs = await SELECT.from(TransportWorkItems).where({ workItem_ID: workItemId });
    if (trs.length === 0) {
      return { success: true, phase: wi.currentPhase || 'Planning', message: 'No transports linked — keeping current phase' };
    }

    const total = trs.length;
    const devCount = trs.filter(t => t.currentSystem === 'DEV').length;
    const qasCount = trs.filter(t => t.currentSystem === 'QAS').length;
    const prdCount = trs.filter(t => t.currentSystem === 'PRD').length;

    // Phase detection logic:
    // All in DEV → Development
    // Any in QAS and test data exists → Testing
    // Any in QAS but no test data → QAS Deployment
    // Mix of QAS + PRD, not all deployed → Testing / Go-Live prep
    // All in PRD → Hypercare or Complete
    let phase = 'Development';
    if (prdCount === total) {
      // All deployed
      const hypercareEnd = wi.hypercareEndDate ? new Date(wi.hypercareEndDate) : null;
      if (hypercareEnd && hypercareEnd > new Date()) {
        phase = 'Hypercare';
      } else if (hypercareEnd && hypercareEnd <= new Date()) {
        phase = 'Complete';
      } else {
        phase = 'Hypercare';
      }
    } else if (prdCount > 0) {
      // Some in PRD, some still in QAS/DEV
      phase = 'Go-Live';
    } else if (qasCount > 0) {
      // Some/all in QAS
      if (wi.testTotal > 0 && (wi.testPassed > 0 || wi.testFailed > 0)) {
        phase = 'Testing';
      } else {
        phase = 'Testing';
      }
    } else if (devCount === total) {
      // All still in DEV
      if (wi.kickoffDate && new Date(wi.kickoffDate) > new Date()) {
        phase = 'Planning';
      } else {
        phase = 'Development';
      }
    }

    // Update the work item
    await UPDATE(WorkItems).set({ currentPhase: phase }).where({ ID: workItemId });

    return { success: true, phase, message: `Phase auto-detected as "${phase}" (DEV:${devCount} QAS:${qasCount} PRD:${prdCount})` };
  }

  // ─── Auto-Link SNOW/INC/CS Tickets from TR Descriptions ───
  async _onAutoLinkTickets(req) {
    const linked = await this._runAutoLink();
    const { AppConfig } = this._e;
    const configs = await SELECT.from(AppConfig);
    const get = (k, d) => configs.find(c => c.configKey === k)?.configValue || d;
    return { success: true, linked, message: `Auto-linked ${linked} transport(s) based on ticket patterns (${get('SNOW_TASK_PREFIX','SNOW')}*, ${get('INCIDENT_PREFIX','INC')}*, ${get('VENDOR_TICKET_PREFIX','CS')}*)` };
  }

  // Shared auto-link engine — links unassigned TRs to work items by SNOW/INC/CS ticket patterns.
  // Pass trNumbers to restrict to specific TRs (e.g. newly inserted); omit to scan all unassigned.
  async _runAutoLink(trNumbers) {
    const { TransportWorkItems, WorkItems, AppConfig } = this._e;

    const configs = await SELECT.from(AppConfig);
    const get = (k, d) => configs.find(c => c.configKey === k)?.configValue || d;
    const snowPrefix  = get('SNOW_TASK_PREFIX', 'SNOW');
    const incPrefix   = get('INCIDENT_PREFIX', 'INC');
    const vendorPrefix = get('VENDOR_TICKET_PREFIX', 'CS');

    const ticketPattern = new RegExp(`(${snowPrefix}\\d+|${incPrefix}\\d+|${vendorPrefix}\\d+)`, 'gi');

    const trsQuery = SELECT.from(TransportWorkItems).where({ workItem_ID: null });
    const allTRs = trNumbers?.length
      ? await SELECT.from(TransportWorkItems).where({ trNumber: { in: trNumbers }, workItem_ID: null })
      : await trsQuery;

    const allWIs = await SELECT.from(WorkItems);

    const ticketToWI = {};
    for (const wi of allWIs) {
      if (wi.snowTicket) ticketToWI[wi.snowTicket.toUpperCase()] = wi.ID;
    }
    const wiTicketEntries = Object.entries(ticketToWI).sort((a, b) => b[0].length - a[0].length);

    let linked = 0;
    for (const tr of allTRs) {
      if (tr.workItem_ID) continue;
      const desc = tr.trDescription || '';
      const matches = desc.match(ticketPattern);
      if (!matches) continue;

      let matched = false;
      for (const ticket of matches) {
        if (matched) break;
        const upper = ticket.toUpperCase();
        if (ticketToWI[upper]) {
          await UPDATE(TransportWorkItems).set({ workItem_ID: ticketToWI[upper], snowTicket: upper, assignedBy: 'auto-link', assignedDate: new Date().toISOString() }).where({ ID: tr.ID });
          linked++; matched = true; break;
        }
        for (const [wiTicket, wiId] of wiTicketEntries) {
          if (upper.includes(wiTicket)) {
            await UPDATE(TransportWorkItems).set({ workItem_ID: wiId, snowTicket: upper, assignedBy: 'auto-link', assignedDate: new Date().toISOString() }).where({ ID: tr.ID });
            linked++; matched = true; break;
          }
        }
      }
    }
    return linked;
  }

  // ════════════════════════════════════════════════════════
  //  AI SUGGEST WORK ITEMS FOR UNASSIGNED TRs
  // ════════════════════════════════════════════════════════

  async _onSuggestWorkItemsForTRs(req) {
    const { trIds } = req.data;
    const { TransportWorkItems, WorkItems } = this._e;

    try {
      const ai = await AIClient.create(this.db, this._e);
      if (!ai.enabled) {
        return { success: false, suggestions: '[]', message: 'AI is not configured. Go to Settings → AI Integration.', provider: '' };
      }

      // Fetch TRs to analyse
      let trs;
      if (trIds && trIds.length > 0) {
        trs = await SELECT.from(TransportWorkItems).where({ ID: { in: trIds } });
      } else {
        trs = await SELECT.from(TransportWorkItems).where({ workItem_ID: null });
      }
      trs = trs.filter(t => !t.workItem_ID);

      if (trs.length === 0) {
        return { success: true, suggestions: '[]', message: 'No unassigned transports to analyse.', provider: ai.provider };
      }

      // Limit to 30 TRs per call to stay within token budget
      const batch = trs.slice(0, 30);

      const allWIs = await SELECT.from(WorkItems).where({ status: { '!=': 'Done' } });

      const wiSummary = allWIs.map(wi =>
        `ID:${wi.ID} | "${wi.workItemName}" | Type:${wi.workItemType} | Phase:${wi.currentPhase} | Ticket:${wi.snowTicket || 'none'} | Module:${wi.sapModule || 'unknown'}`
      ).join('\n');

      const trList = batch.map(tr =>
        `ID:${tr.ID} | TR:${tr.trNumber} | Owner:${tr.trOwner} | Desc:"${tr.trDescription || '(no description)'}"`
      ).join('\n');

      const prompt = `You are an SAP project manager assistant. Analyse these unassigned SAP Transport Requests (TRs) and suggest how to handle each one.

EXISTING ACTIVE WORK ITEMS:
${wiSummary || '(none yet)'}

UNASSIGNED TRs TO ANALYSE:
${trList}

For each TR return a JSON object with these exact fields:
- trId: the TR's ID field (copy exactly from input)
- trNumber: the TR number (e.g. DEVK912345)
- suggestion: one of "link" | "create" | "unknown"
  - "link" = this TR clearly belongs to an existing work item above
  - "create" = this TR represents new work; a new work item should be created
  - "unknown" = insufficient info; admin needs to clarify
- workItemId: (only for "link") the ID of the matching existing work item
- workItemName: (only for "link") the name of the matching work item
- suggestedName: (only for "create") a concise name for the new work item
- suggestedType: (only for "create") one of: project | enhancement | break-fix | support | upgrade | hypercare
- suggestedModule: (only for "create") SAP module abbreviation e.g. FI, MM, SD, HR, Basis, Security
- suggestedPriority: (only for "create") one of: P1 | P2 | P3
- confidence: HIGH | MEDIUM | LOW
- reason: one sentence explaining the suggestion
- questions: array of strings — clarifying questions for admin (1-2 max, only if confidence < HIGH or suggestion = "unknown")

Return ONLY a valid JSON array. No markdown, no explanation outside the JSON.`;

      const messages = [{ role: 'user', content: prompt }];
      const raw = await ai.chat(messages, { max_tokens: 3000 });

      // Strip any markdown fencing
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) throw new Error('Expected array');
      } catch {
        return { success: false, suggestions: '[]', message: `AI returned unparseable response: ${cleaned.slice(0, 200)}`, provider: ai.provider };
      }

      const skipped = trs.length - batch.length;
      const msg = skipped > 0
        ? `Analysed ${batch.length} TRs (${skipped} skipped — analyse in batches)`
        : `Analysed ${batch.length} TR(s)`;

      return { success: true, suggestions: JSON.stringify(parsed), message: msg, provider: ai.provider };
    } catch (err) {
      return { success: false, suggestions: '[]', message: `AI analysis failed: ${err.message}`, provider: '' };
    }
  }

  // ════════════════════════════════════════════════════════
  //  AI REFINE PROPOSALS — "Discuss with AI" before creating
  // ════════════════════════════════════════════════════════

  async _onRefineProposals(req) {
    const { proposals, instruction, application } = req.data;
    if (!proposals || !instruction?.trim()) {
      return { success: false, proposals: '[]', message: 'Proposals and instruction are required.', provider: '' };
    }

    try {
      const ai = await AIClient.create(this.db, this._e);
      if (!ai.enabled) {
        return { success: false, proposals, message: 'AI is not configured. Go to Settings → AI Integration.', provider: '' };
      }

      const appTypes = {
        SAP: 'Project, Enhancement, Break-fix, Support, Hypercare, Upgrade',
        Coupa: 'Implementation, Integration, Configuration, Data Migration, Upgrade, Support, Optimization, Supplier Enablement',
        Commercial: 'Product Launch, Campaign, Compliance Initiative, Market Access, Field Force, MLR Review, Veeva Implementation, Analytics Project',
      }[application] || 'Project, Enhancement, Support';

      const systemPrompt = `You are an expert project management AI assistant. The user has a list of proposed work items that were previously extracted from a document. They want to REFINE these proposals based on their instruction.

APPLICATION: ${application}
Valid work item types: ${appTypes}

CURRENT PROPOSALS (JSON):
${proposals}

USER INSTRUCTION: The user wants you to modify the proposals based on their specific request below. Common refinements include:
- Changing priorities, types, phases, or complexity
- Splitting one item into multiple items
- Merging items together
- Adding more details to notes
- Changing names or owners
- Removing certain items
- Adding new items

You MUST respond with ONLY valid JSON — no markdown code fences.
Return ONLY a JSON array of proposal objects with the same structure:
[
  {
    "workItemName": "...",
    "workItemType": "...",
    "projectCode": "...",
    "priority": "P1|P2|P3",
    "complexity": "Low|Medium|High|Critical",
    "currentPhase": "...",
    "businessOwner": "...",
    "notes": "...",
    "estimatedGoLive": "YYYY-MM-DD or empty",
    "confidence": "high|medium|low"
  }
]

Apply the user's instruction precisely. Preserve all fields that weren't asked to change.`;

      let response = await ai._call(systemPrompt, instruction, 4000);

      // Strip code fences
      response = response.trim();
      if (response.startsWith('```')) {
        response = response.replace(/^[\s]*```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      // Parse
      let parsed;
      try {
        parsed = JSON.parse(response);
        if (!Array.isArray(parsed)) parsed = parsed.proposals || [];
      } catch {
        return { success: false, proposals, message: 'AI returned invalid JSON. Try a simpler instruction.', provider: ai.provider };
      }

      return {
        success: true,
        proposals: JSON.stringify(parsed),
        message: `Refined ${parsed.length} proposal(s) based on your instruction.`,
        provider: ai.provider,
      };
    } catch (err) {
      return { success: false, proposals, message: `Refinement failed: ${err.message}`, provider: '' };
    }
  }

  // ════════════════════════════════════════════════════════
  //  SHAREPOINT LIVE INTEGRATION — Microsoft Graph API
  // ════════════════════════════════════════════════════════

  async _onConfigureSharePoint(req) {
    const { tenantId, clientId, clientSecret, siteUrl, driveId } = req.data;
    const { AppConfig } = this._e;

    try {
      const configs = [
        { configKey: 'SHAREPOINT_TENANT_ID', configValue: tenantId, description: 'Azure AD Tenant ID' },
        { configKey: 'SHAREPOINT_CLIENT_ID', configValue: clientId, description: 'Azure AD App Client ID' },
        { configKey: 'SHAREPOINT_CLIENT_SECRET', configValue: clientSecret ? encrypt(clientSecret) : '', description: 'Azure AD Client Secret (encrypted)' },
        { configKey: 'SHAREPOINT_SITE_URL', configValue: siteUrl, description: 'SharePoint Site URL' },
        { configKey: 'SHAREPOINT_DRIVE_ID', configValue: driveId, description: 'SharePoint Drive/Library ID' },
      ];

      for (const cfg of configs) {
        const existing = await SELECT.one.from(AppConfig).where({ configKey: cfg.configKey });
        if (existing) {
          // Don't overwrite the real secret with the masked value
          if (cfg.configKey === 'SHAREPOINT_CLIENT_SECRET' && clientSecret) {
            await UPDATE(AppConfig).set({ configValue: encrypt(clientSecret), description: cfg.description }).where({ configKey: cfg.configKey });
          } else if (cfg.configKey !== 'SHAREPOINT_CLIENT_SECRET') {
            await UPDATE(AppConfig).set({ configValue: cfg.configValue, description: cfg.description }).where({ configKey: cfg.configKey });
          }
        } else {
          const val = cfg.configKey === 'SHAREPOINT_CLIENT_SECRET' ? (clientSecret || '') : cfg.configValue;
          await INSERT.into(AppConfig).entries({ configKey: cfg.configKey, configValue: val, description: cfg.description });
        }
      }

      // Test connectivity if all fields provided
      if (tenantId && clientId && siteUrl) {
        return { success: true, message: 'SharePoint configuration saved. Use "Browse Documents" to test connectivity.' };
      }
      return { success: true, message: 'SharePoint configuration saved (partial — some fields missing).' };
    } catch (err) {
      return { success: false, message: `Configuration failed: ${err.message}` };
    }
  }

  async _onListSharePointDocuments(req) {
    const { folderPath } = req.data;
    const { AppConfig } = this._e;

    try {
      // Load SharePoint config from DB
      const cfgRows = await SELECT.from(AppConfig).where({
        configKey: { in: ['SHAREPOINT_TENANT_ID', 'SHAREPOINT_CLIENT_ID', 'SHAREPOINT_CLIENT_SECRET', 'SHAREPOINT_SITE_URL', 'SHAREPOINT_DRIVE_ID'] }
      });
      const cfg = {};
      for (const r of cfgRows) cfg[r.configKey] = r.configValue;

      if (!cfg.SHAREPOINT_TENANT_ID || !cfg.SHAREPOINT_CLIENT_ID) {
        // Return mock data for demo if not configured
        const mockDocs = [
          { id: 'mock-1', name: 'Q1 2026 SAP FICO Upgrade Plan.docx', type: 'file', size: 245000, lastModified: '2026-01-15T10:30:00Z', webUrl: '#', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
          { id: 'mock-2', name: 'Coupa Integration Requirements.xlsx', type: 'file', size: 128000, lastModified: '2026-01-20T14:00:00Z', webUrl: '#', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
          { id: 'mock-3', name: 'Veeva CRM Implementation Timeline.pdf', type: 'file', size: 520000, lastModified: '2026-01-22T09:15:00Z', webUrl: '#', mimeType: 'application/pdf' },
          { id: 'mock-4', name: 'SAP S4HANA Migration Checklist.docx', type: 'file', size: 98000, lastModified: '2026-01-25T16:45:00Z', webUrl: '#', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
          { id: 'mock-5', name: 'Commercial Ops Weekly Status.msg', type: 'file', size: 34000, lastModified: '2026-01-28T08:00:00Z', webUrl: '#', mimeType: 'application/vnd.ms-outlook' },
          { id: 'mock-6', name: 'Project Documents', type: 'folder', size: 0, lastModified: '2026-01-20T12:00:00Z', webUrl: '#', mimeType: 'folder' },
        ];
        return { success: true, documents: JSON.stringify(mockDocs), message: 'Showing demo documents (SharePoint not configured). Go to Settings → SharePoint to connect.' };
      }

      // Real Graph API call
      const { SharePointClient } = require('./lib/sharepoint-client');
      const sp = new SharePointClient();
      sp.tenantId = cfg.SHAREPOINT_TENANT_ID;
      sp.clientId = cfg.SHAREPOINT_CLIENT_ID;
      sp.clientSecret = decrypt(cfg.SHAREPOINT_CLIENT_SECRET || '');
      sp.useMock = false;

      await sp._ensureToken();

      const rawSiteUrl = cfg.SHAREPOINT_SITE_URL || '';
      const driveId = cfg.SHAREPOINT_DRIVE_ID || '';

      // siteUrl may be stored as a full URL (https://tenant.sharepoint.com/sites/IT)
      // or as a Graph site ID (tenant.sharepoint.com,siteGuid,webGuid).
      // Normalise: if it starts with http, resolve via /sites?$filter=siteCollection/hostname
      let siteSegment;
      if (rawSiteUrl.startsWith('http')) {
        const parsed = new URL(rawSiteUrl);
        // Graph API lookup by hostname + relative path
        const hostname = parsed.hostname;
        const sitePath = parsed.pathname.replace(/^\/+|\/+$/g, '');
        siteSegment = `${hostname}:/${sitePath}:`;
      } else {
        // Already a site ID or hostname:path — use as-is
        siteSegment = rawSiteUrl;
      }

      // If no driveId, use the site's default document library
      let driveSegment;
      if (driveId) {
        driveSegment = `drives/${driveId}`;
      } else {
        // Resolve default drive for this site
        const driveListRes = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${siteSegment}/drive`,
          { headers: { 'Authorization': `Bearer ${sp.accessToken}` } }
        );
        if (!driveListRes.ok) throw new Error(`Could not resolve SharePoint drive: ${driveListRes.status}`);
        const driveData = await driveListRes.json();
        driveSegment = `drives/${driveData.id}`;
      }

      const itemPath = folderPath
        ? `/root:/${encodeURIComponent(folderPath).replace(/%2F/g, '/')}:/children`
        : '/root/children';
      const url = `https://graph.microsoft.com/v1.0/sites/${siteSegment}/${driveSegment}${itemPath}?$top=100&$select=id,name,size,folder,file,lastModifiedDateTime,webUrl`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${sp.accessToken}`, 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Graph API ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const documents = (data.value || []).map(item => ({
        id: item.id,
        name: item.name,
        type: item.folder ? 'folder' : 'file',
        size: item.size || 0,
        lastModified: item.lastModifiedDateTime,
        webUrl: item.webUrl,
        mimeType: item.file?.mimeType || (item.folder ? 'folder' : 'unknown'),
      }));

      return { success: true, documents: JSON.stringify(documents), message: `Found ${documents.length} items` };
    } catch (err) {
      return { success: false, documents: '[]', message: `SharePoint error: ${err.message}` };
    }
  }

  async _onFetchSharePointDocument(req) {
    const { documentId, fileName } = req.data;

    try {
      // In demo mode, return sample content for testing
      const { AppConfig } = this._e;
      const tenantCfg = await SELECT.one.from(AppConfig).where({ configKey: 'SHAREPOINT_TENANT_ID' });

      if (!tenantCfg?.configValue) {
        // Demo mode — return mock content based on document name
        const ext = (fileName || '').toLowerCase();
        let content = '';
        if (ext.includes('fico') || ext.includes('sap')) {
          content = `Subject: Q1 2026 SAP FICO Upgrade Planning\n\nTeam,\n\nPlease review the attached scope for the FICO module upgrade to S/4HANA 2023. Key items:\n\n1. Chart of Accounts migration (P1 - Critical)\n2. Asset Accounting reconfiguration\n3. New GL parallel ledger setup\n4. AP/AR process harmonization\n5. Cost Center hierarchy restructuring\n\nTimeline: Go-live targeted for Apr 15, 2026\nBusiness Owner: Sarah Mitchell\nLead: David Chen\n\nThis needs immediate attention as we have regulatory deadlines.\n\nBest regards,\nProject Office`;
        } else if (ext.includes('coupa')) {
          content = `Project Brief: Coupa Procurement Integration\n\nObjective: Integrate Coupa with SAP S/4HANA for procurement-to-pay automation\n\nPhase 1: Supplier portal configuration (Feb 2026)\nPhase 2: PO integration with SAP MM (Mar 2026)\nPhase 3: Invoice matching automation (Apr 2026)\n\nKey stakeholders: Mike Johnson (Procurement), Lisa Wong (IT)\nPriority: P2\nComplexity: High`;
        } else if (ext.includes('veeva') || ext.includes('commercial')) {
          content = `Veeva CRM Implementation - Commercial Operations\n\nChange Control #VCC-2026-001\n\nDescription: New Veeva CRM module deployment for Field Force automation\n\nImpacted Systems: Veeva CRM, Veeva Align, PromoMats\nRegulatory: FDA 21 CFR Part 11 compliance required\n\nDeliverables:\n- Territory alignment configuration\n- Sample management workflow\n- KOL engagement tracking\n- Compliant content distribution\n\nBusiness Owner: Jennifer Adams\nTarget Go-Live: May 2026\nPriority: P1`;
        } else {
          content = `Project Document: ${fileName}\n\nThis is a placeholder document for demo purposes. In production, the actual file content would be fetched from SharePoint via Microsoft Graph API.\n\nConnect your SharePoint in Settings to enable live document browsing.`;
        }
        return { success: true, content, fileName: fileName || 'document.txt', message: 'Demo content (SharePoint not configured)' };
      }

      // Real Graph API fetch
      const cfgRows = await SELECT.from(AppConfig).where({
        configKey: { in: ['SHAREPOINT_TENANT_ID', 'SHAREPOINT_CLIENT_ID', 'SHAREPOINT_CLIENT_SECRET', 'SHAREPOINT_SITE_URL', 'SHAREPOINT_DRIVE_ID'] }
      });
      const cfg = {};
      for (const r of cfgRows) cfg[r.configKey] = r.configValue;

      const { SharePointClient } = require('./lib/sharepoint-client');
      const sp = new SharePointClient();
      sp.tenantId = cfg.SHAREPOINT_TENANT_ID;
      sp.clientId = cfg.SHAREPOINT_CLIENT_ID;
      sp.clientSecret = decrypt(cfg.SHAREPOINT_CLIENT_SECRET || '');
      sp.useMock = false;
      await sp._ensureToken();

      // Use driveId if available; otherwise fall back to /me/drive (less ideal but works)
      const driveId = cfg.SHAREPOINT_DRIVE_ID;
      const url = driveId
        ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${documentId}/content`
        : `https://graph.microsoft.com/v1.0/drive/items/${documentId}/content`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${sp.accessToken}` }
      });

      if (!response.ok) {
        throw new Error(`Graph API ${response.status}`);
      }

      const content = await response.text();
      return { success: true, content, fileName: fileName || 'document', message: 'Document fetched' };
    } catch (err) {
      return { success: false, content: '', fileName: '', message: `Fetch failed: ${err.message}` };
    }
  }

  // ════════════════════════════════════════════════════════
  //  AI WEEKLY DIGEST — Generate & Save (no auto-email)
  // ════════════════════════════════════════════════════════

  async _onGenerateWeeklyDigest(req) {
    const { application } = req.data;
    const appFilter = application && application !== 'ALL' ? application : null;

    try {
      const ai = await AIClient.create(this.db, this._e);
      if (!ai.enabled) {
        return { success: false, digestId: '', digestHtml: '', message: 'AI is not configured. Go to Settings → AI Integration.', provider: '' };
      }

      const { WorkItems, TransportWorkItems, Milestones, WeeklyDigests } = this._e;

      // Gather project data
      const wiFilter = appFilter ? { status: 'Active', application: appFilter } : { status: 'Active' };
      const activeWIs = await SELECT.from(WorkItems).where(wiFilter);
      const allTRs = await SELECT.from(TransportWorkItems);
      const allMilestones = await SELECT.from(Milestones);

      const now = new Date();
      const weekNum = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
      const fy = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
      const weekLabel = `WK${String(weekNum).padStart(2, '0')} FY${fy}`;

      // Build context for AI
      const projectSummaries = activeWIs.map(wi => {
        const trs = allTRs.filter(t => t.workItem_ID === wi.ID);
        const ms = allMilestones.filter(m => m.workItem_ID === wi.ID);
        const overdue = ms.filter(m => m.status === 'Pending' && m.milestoneDate && new Date(m.milestoneDate) < now);
        return `• ${wi.workItemName} [${wi.application}] — ${wi.workItemType} — Phase: ${wi.currentPhase || 'N/A'}, RAG: ${wi.overallRAG || 'N/A'}, Priority: ${wi.priority || 'N/A'}, Go-Live: ${wi.goLiveDate || 'TBD'}, Deploy: ${wi.deploymentPct || 0}%, Tests: ${wi.testCompletionPct || 0}% (${wi.testPassed || 0}/${wi.testTotal || 0} passed, ${wi.testFailed || 0} failed), TRs: ${trs.length}, Overdue milestones: ${overdue.length}, Owner: ${wi.businessOwner || 'N/A'}`;
      }).join('\n');

      const redProjects = activeWIs.filter(wi => wi.overallRAG === 'RED');
      const amberProjects = activeWIs.filter(wi => wi.overallRAG === 'AMBER');
      const approachingGoLive = activeWIs.filter(wi => {
        if (!wi.goLiveDate) return false;
        const days = Math.ceil((new Date(wi.goLiveDate) - now) / 86400000);
        return days > 0 && days <= 30;
      });

      const systemPrompt = `You are a Senior IT Program Manager creating a weekly executive digest for leadership.

OUTPUT: Generate an Outlook-compatible HTML digest AND a plain-text summary.

You MUST respond with ONLY valid JSON:
{
  "digestHtml": "<full HTML email digest>",
  "digestText": "plain text summary (for quick reading)",
  "highlights": ["highlight 1", "highlight 2", ...],
  "riskCount": <number of risks identified>
}

HTML STYLING RULES:
- Use inline CSS everywhere (Outlook ignores <style> blocks)
- Font: Calibri, Arial, sans-serif; font-size: 14px
- Tables: border-collapse:collapse, 1px solid #d6d6d6, header bg #1f4e79 white text
- Use 🟢🟡🔴 emojis for RAG status
- Professional, concise, executive-level language

DIGEST STRUCTURE:
1. Header: "${weekLabel} — Project Command Center Weekly Digest" with date
2. Executive Summary: 2-3 sentences on overall portfolio health
3. Key Metrics: Projects Active / RED / AMBER / Approaching Go-Live / Test Completion Avg
4. Attention Required: Table of RED/AMBER projects with owner, issue, action needed
5. Go-Live Watch: Projects going live within 30 days
6. Wins This Week: Positive progress highlights
7. Risk Register: Top risks across the portfolio
8. Upcoming Milestones: Next 2 weeks

Be data-driven. NEVER invent data — use ONLY what's provided.`;

      const userMessage = `Week: ${weekLabel}
Date: ${now.toISOString().split('T')[0]}
Application Filter: ${appFilter || 'ALL'}
Total Active Projects: ${activeWIs.length}
RED Projects: ${redProjects.length}
AMBER Projects: ${amberProjects.length}
Approaching Go-Live (30 days): ${approachingGoLive.length}

PROJECT DETAILS:
${projectSummaries || '(No active projects)'}`;

      let response = await ai._call(systemPrompt, userMessage, 3000);

      // Strip code fences
      response = response.trim();
      if (response.startsWith('```')) {
        response = response.replace(/^[\s]*```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch {
        return { success: false, digestId: '', digestHtml: '', message: 'AI returned invalid digest format.', provider: ai.provider };
      }

      // Save to database
      const newId = cds.utils.uuid();
      await INSERT.into(WeeklyDigests).entries({
        ID: newId,
        weekLabel,
        application: appFilter || 'ALL',
        digestHtml: parsed.digestHtml || '',
        digestText: parsed.digestText || '',
        projectCount: activeWIs.length,
        riskCount: parsed.riskCount || 0,
        highlights: JSON.stringify(parsed.highlights || []),
        generatedBy: req.user?.id || 'anonymous',
        aiProvider: ai.provider,
      });

      return {
        success: true,
        digestId: newId,
        digestHtml: parsed.digestHtml || '',
        message: `Weekly digest "${weekLabel}" generated and saved. ${activeWIs.length} projects analyzed.`,
        provider: ai.provider,
      };
    } catch (err) {
      return { success: false, digestId: '', digestHtml: '', message: `Digest generation failed: ${err.message}`, provider: '' };
    }
  }

  async _onGetWeeklyDigests(req) {
    const { WeeklyDigests } = this._e;
    const digests = await SELECT.from(WeeklyDigests).orderBy('createdAt desc').limit(20);
    return digests;
  }

  // ════════════════════════════════════════════════════════
  //  SMART AI RISK NOTIFICATIONS
  // ════════════════════════════════════════════════════════

  async _onAnalyzeProjectRisks(req) {
    const { application } = req.data;

    try {
      const ai = await AIClient.create(this.db, this._e);
      if (!ai.enabled) {
        return { success: false, risks: '[]', generated: 0, message: 'AI is not configured.', provider: '' };
      }

      const { WorkItems, TransportWorkItems, Milestones, Notifications } = this._e;
      const now = new Date();

      const wiFilter = application && application !== 'ALL'
        ? { status: 'Active', application }
        : { status: 'Active' };
      const activeWIs = await SELECT.from(WorkItems).where(wiFilter);
      const allTRs = await SELECT.from(TransportWorkItems);
      const allMilestones = await SELECT.from(Milestones);

      // Build rich project context for AI risk analysis
      const projectData = activeWIs.map(wi => {
        const trs = allTRs.filter(t => t.workItem_ID === wi.ID);
        const ms = allMilestones.filter(m => m.workItem_ID === wi.ID);
        const overdue = ms.filter(m => m.status === 'Pending' && m.milestoneDate && new Date(m.milestoneDate) < now);
        const daysToGoLive = wi.goLiveDate ? Math.ceil((new Date(wi.goLiveDate) - now) / 86400000) : null;
        const stuckTRs = trs.filter(t => {
          if (t.currentSystem === 'PRD') return false;
          return (now - new Date(t.createdDate)) / 86400000 > 5;
        });
        const failRate = wi.testTotal > 0 ? (wi.testFailed / wi.testTotal * 100).toFixed(1) : '0';

        return {
          name: wi.workItemName,
          app: wi.application,
          type: wi.workItemType,
          phase: wi.currentPhase,
          rag: wi.overallRAG,
          priority: wi.priority,
          daysToGoLive,
          deployPct: wi.deploymentPct || 0,
          testTotal: wi.testTotal || 0,
          testPassed: wi.testPassed || 0,
          testFailed: wi.testFailed || 0,
          testFailRate: failRate,
          testCompletionPct: wi.testCompletionPct || 0,
          totalTRs: trs.length,
          stuckTRs: stuckTRs.length,
          overdueMilestones: overdue.length,
          owner: wi.businessOwner,
        };
      });

      const systemPrompt = `You are an AI Risk Analyst for enterprise IT project portfolios. Analyze the project data and identify PREDICTIVE risks — not just current issues, but FUTURE problems based on patterns.

RISK CATEGORIES to look for:
1. SCHEDULE_RISK — Projects likely to miss go-live dates (low deployment % with approaching deadlines)
2. QUALITY_RISK — Test failure trends suggesting systemic quality issues
3. RESOURCE_RISK — Multiple projects in critical phases competing for resources
4. DEPLOYMENT_RISK — Stuck transports or low deployment progress near go-live
5. INTEGRATION_RISK — Cross-system or cross-app dependencies at risk
6. COMPLIANCE_RISK — Regulatory/compliance items (especially for Commercial/Veeva) at risk

Respond with ONLY valid JSON — no markdown code fences:
{
  "risks": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM",
      "category": "SCHEDULE_RISK|QUALITY_RISK|RESOURCE_RISK|DEPLOYMENT_RISK|INTEGRATION_RISK|COMPLIANCE_RISK",
      "projectName": "affected project name",
      "title": "short risk title (max 80 chars)",
      "description": "detailed risk description with data points (max 300 chars)",
      "recommendation": "actionable recommendation (max 200 chars)",
      "probability": "HIGH|MEDIUM|LOW",
      "impact": "HIGH|MEDIUM|LOW"
    }
  ]
}

RULES:
- Only flag REAL risks backed by the data — never hallucinate
- Sort by severity (CRITICAL first)
- Maximum 10 risks
- Be specific — cite numbers, dates, percentages from the data
- For each risk, include concrete data evidence`;

      const userMessage = `Today: ${now.toISOString().split('T')[0]}
Application filter: ${application || 'ALL'}
Active projects: ${projectData.length}

PROJECT DATA:
${JSON.stringify(projectData, null, 2)}`;

      let response = await ai._call(systemPrompt, userMessage, 4000);

      // Strip code fences
      response = response.trim();
      if (response.startsWith('```')) {
        response = response.replace(/^[\s]*```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch {
        return { success: false, risks: '[]', generated: 0, message: 'AI returned invalid risk analysis.', provider: ai.provider };
      }

      // Save as notifications
      const risks = parsed.risks || [];
      let generated = 0;

      for (const risk of risks) {
        // Check for duplicate notification
        const existing = await SELECT.one.from(Notifications)
          .where({ type: `AI_RISK_${risk.category}`, isRead: false })
          .and('message like', `%${risk.projectName?.substring(0, 30)}%`);

        if (!existing) {
          const severity = risk.severity === 'CRITICAL' ? '🔴' : risk.severity === 'HIGH' ? '🟠' : '🟡';
          await INSERT.into(Notifications).entries({
            userEmail: req.user?.id || 'system',
            type: `AI_RISK_${risk.category}`,
            message: `${severity} [${risk.category.replace(/_/g, ' ')}] ${risk.title} — ${risk.description}`,
            trNumber: null,
            isRead: false,
          });
          generated++;
        }
      }

      return {
        success: true,
        risks: JSON.stringify(risks),
        generated,
        message: `AI identified ${risks.length} risk(s), created ${generated} new notification(s).`,
        provider: ai.provider,
      };
    } catch (err) {
      return { success: false, risks: '[]', generated: 0, message: `Risk analysis failed: ${err.message}`, provider: '' };
    }
  }

  // ════════════════════════════════════════════════════════
  //  CREATE / DELETE / STATUS CHANGE — Work Item CRUD
  // ════════════════════════════════════════════════════════

  async _onCreateWorkItem(req) {
    const { workItemName, projectCode, workItemType, application, priority, complexity, currentPhase, businessOwner, goLiveDate, notes } = req.data;
    const { WorkItems, ActivityLog } = this._e;

    if (!workItemName?.trim()) {
      return req.reject(400, 'Work item name is required');
    }

    try {
      const newId = cds.utils.uuid();
      await INSERT.into(WorkItems).entries({
        ID: newId,
        workItemName: workItemName.trim(),
        projectCode: projectCode || `WI-${application?.substring(0, 3) || 'GEN'}-${Date.now().toString(36).toUpperCase()}`,
        workItemType: workItemType || 'Project',
        application: application || 'SAP',
        priority: priority || 'P2',
        complexity: complexity || 'Medium',
        status: 'Active',
        currentPhase: currentPhase || 'Planning',
        businessOwner: businessOwner || '',
        goLiveDate: goLiveDate || null,
        notes: notes || '',
        overallRAG: 'GREEN',
        riskScore: 0,
        deploymentPct: 0,
        methodology: 'Hybrid',
      });

      await INSERT.into(ActivityLog).entries({
        userEmail: req.user.id,
        action: 'CREATE_WORK_ITEM',
        entityType: 'WORK_ITEM',
        entityId: newId,
        newValue: workItemName,
        createdAt: new Date().toISOString(),
      });

      return { success: true, workItemId: newId, message: `Work item "${workItemName}" created successfully.` };
    } catch (err) {
      return { success: false, workItemId: '', message: `Creation failed: ${err.message}` };
    }
  }

  async _onDeleteWorkItem(req) {
    const { workItemId } = req.data;
    const { WorkItems, TransportWorkItems, Milestones, ActivityLog } = this._e;

    try {
      const wi = await SELECT.one.from(WorkItems).where({ ID: workItemId });
      if (!wi) return req.reject(404, `Work item ${workItemId} not found`);

      // Unlink transports (set workItem_ID to null instead of cascading)
      await UPDATE(TransportWorkItems).set({ workItem_ID: null }).where({ workItem_ID: workItemId });

      // Delete milestones
      await DELETE.from(Milestones).where({ workItem_ID: workItemId });

      // Delete work item
      await DELETE.from(WorkItems).where({ ID: workItemId });

      await INSERT.into(ActivityLog).entries({
        userEmail: req.user.id,
        action: 'DELETE_WORK_ITEM',
        entityType: 'WORK_ITEM',
        entityId: workItemId,
        oldValue: wi.workItemName,
        createdAt: new Date().toISOString(),
      });

      return { success: true, message: `Work item "${wi.workItemName}" deleted.` };
    } catch (err) {
      return { success: false, message: `Delete failed: ${err.message}` };
    }
  }

  // ─── Send Report via Email (Outlook/Graph API) ───
  async _onSendReport(req) {
    const { htmlBody, subject, toRecipients, ccRecipients } = req.data;

    if (!htmlBody?.trim()) {
      return req.reject(400, 'htmlBody is required');
    }
    if (!subject?.trim()) {
      return req.reject(400, 'subject is required');
    }

    let toList, ccList;
    try {
      toList = JSON.parse(toRecipients || '[]');
      ccList = JSON.parse(ccRecipients || '[]');
    } catch {
      return req.reject(400, 'toRecipients and ccRecipients must be valid JSON arrays of email strings');
    }

    if (!Array.isArray(toList) || toList.length === 0) {
      return req.reject(400, 'At least one recipient email is required in toRecipients');
    }

    try {
      const { OutlookClient } = require('./lib/outlook-client');
      const client = new OutlookClient();
      const result = await client.sendMail({
        to: toList,
        cc: ccList,
        subject,
        htmlBody,
        importance: 'normal',
      });

      // Audit log
      const { ActivityLog } = this._e;
      await INSERT.into(ActivityLog).entries({
        userEmail: req.user.id,
        action: 'SEND_REPORT',
        entityType: 'REPORT',
        entityId: new Date().toISOString().split('T')[0],
        newValue: `Email sent to: ${toList.join(', ')} | Subject: ${subject}`,
        createdAt: new Date().toISOString(),
      });

      return {
        success: result.success,
        messageId: result.messageId || '',
        message: result.message,
      };
    } catch (err) {
      console.error('sendReport failed:', err.message);
      return { success: false, messageId: '', message: `Email send failed: ${err.message}` };
    }
  }

  // ─── GDPR: Purge old activity and sync logs ───
  async _onPurgeActivityLog(req) {
    const { retentionDays } = req.data;
    const days = retentionDays != null ? Number(retentionDays) : 90;

    if (isNaN(days) || days < 1) {
      return req.reject(400, 'retentionDays must be a positive integer');
    }

    const { ActivityLog, SyncLog } = this._e;
    const cutoffDate = new Date(Date.now() - days * 86400000).toISOString();

    try {
      // Count before delete
      const oldLogs = await SELECT.from(ActivityLog).where(`createdAt < '${cutoffDate}'`);
      const oldSyncs = await SELECT.from(SyncLog).where(`startedAt < '${cutoffDate}'`);

      await DELETE.from(ActivityLog).where(`createdAt < '${cutoffDate}'`);
      await DELETE.from(SyncLog).where(`startedAt < '${cutoffDate}'`);

      const deleted = (oldLogs.length || 0) + (oldSyncs.length || 0);

      console.info(`[GDPR] Purged ${oldLogs.length} activity log entries and ${oldSyncs.length} sync log entries older than ${days} days`);

      return {
        success: true,
        deleted,
        message: `Purged ${oldLogs.length} activity log entries and ${oldSyncs.length} sync log entries older than ${days} days (before ${cutoffDate.split('T')[0]}).`,
      };
    } catch (err) {
      console.error('purgeActivityLog failed:', err.message);
      return { success: false, deleted: 0, message: `Purge failed: ${err.message}` };
    }
  }

  async _onChangeWorkItemStatus(req) {
    let { workItemId, status } = req.data;
    const { WorkItems, ActivityLog } = this._e;

    // Normalize legacy synonyms so old data / RFC refreshes don't reject.
    if (status === 'Complete' || status === 'Completed') status = 'Done';

    const validStatuses = ['Active', 'On Hold', 'Done', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return req.reject(400, `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    try {
      const wi = await SELECT.one.from(WorkItems).where({ ID: workItemId });
      if (!wi) return req.reject(404, `Work item ${workItemId} not found`);

      const oldStatus = wi.status;
      const updateData = { status };

      // Auto-set phase for terminal statuses
      if (status === 'Done') updateData.currentPhase = 'Complete';
      if (status === 'Cancelled') updateData.currentPhase = 'Complete';

      await UPDATE(WorkItems).set(updateData).where({ ID: workItemId });

      await INSERT.into(ActivityLog).entries({
        userEmail: req.user.id,
        action: 'CHANGE_STATUS',
        entityType: 'WORK_ITEM',
        entityId: workItemId,
        oldValue: oldStatus,
        newValue: status,
        createdAt: new Date().toISOString(),
      });

      return { success: true, message: `Status changed from "${oldStatus}" to "${status}" for "${wi.workItemName}".` };
    } catch (err) {
      return { success: false, message: `Status change failed: ${err.message}` };
    }
  }
}

module.exports = TransportService;
