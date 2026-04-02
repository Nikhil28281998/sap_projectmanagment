const cds = require('@sap/cds');
const { parseTRDescription } = require('./lib/tr-parser');
const { RFCClient } = require('./lib/rfc-client');
const { SharePointClient } = require('./lib/sharepoint-client');
const { ReportGenerator } = require('./lib/report-generator');
const { parseTestStatuses, testRAGImpact, getMethodologyList } = require('./lib/test-status-parser');
const { AIClient } = require('./lib/ai-client');
const { encrypt, decrypt, maskKey } = require('./lib/crypto-utils');
const { OutlookClient } = require('./lib/outlook-client');

class TransportService extends cds.ApplicationService {

  async init() {
    const db = await cds.connect.to('db');
    const {
      TransportWorkItems,
      WorkItems,
      Milestones,
      Notifications,
      SyncLog,
      ActivityLog,
      AppConfig,
      ReportTemplates
    } = db.entities('sap.pm');

    this.db = db;
    this._e = { TransportWorkItems, WorkItems, Milestones, Notifications, SyncLog, ActivityLog, AppConfig, ReportTemplates };

    // ── Before handlers ──
    this.before('UPDATE', 'Transports', this._checkOptimisticLock.bind(this));

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

    await super.init();
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
  async _onRefreshTransportData(req) {
    const { TransportWorkItems, SyncLog } = this._e;
    const startTime = Date.now();
    const syncEntry = {
      source: 'RFC',
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      recordsFetched: 0,
      recordsUpdated: 0
    };

    try {
      const rfcClient = new RFCClient();
      const transports = await rfcClient.getTransports();

      let updated = 0;
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
        }
        updated++;
      }

      const duration = Date.now() - startTime;
      syncEntry.completedAt = new Date().toISOString();
      syncEntry.status = 'SUCCESS';
      syncEntry.recordsFetched = transports.length;
      syncEntry.recordsUpdated = updated;
      syncEntry.durationMs = duration;
      await INSERT.into(SyncLog).entries(syncEntry);

      return { success: true, recordsFetched: transports.length, message: `Synced ${transports.length} transports in ${duration}ms` };
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

  // ─── Save AI Configuration ───
  async _onSaveAIConfig(req) {
    const { provider, apiKey } = req.data;
    const { AppConfig } = this._e;

    try {
      // Save provider choice
      const existingProvider = await SELECT.one.from(AppConfig).where({ configKey: 'AI_PROVIDER' });
      if (existingProvider) {
        await UPDATE(AppConfig).set({ configValue: provider }).where({ configKey: 'AI_PROVIDER' });
      } else {
        await INSERT.into(AppConfig).entries({ configKey: 'AI_PROVIDER', configValue: provider, description: 'AI provider: claude or chatgpt' });
      }

      // Encrypt and save API key for the chosen provider
      const keyConfigName = provider === 'chatgpt' ? 'OPENAI_API_KEY' : provider === 'gemini' ? 'GEMINI_API_KEY' : provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'CLAUDE_API_KEY';
      const encryptedKey = encrypt(apiKey);
      const existingKey = await SELECT.one.from(AppConfig).where({ configKey: keyConfigName });
      if (existingKey) {
        await UPDATE(AppConfig).set({ configValue: encryptedKey }).where({ configKey: keyConfigName });
      } else {
        await INSERT.into(AppConfig).entries({ configKey: keyConfigName, configValue: encryptedKey, description: `${provider} API key (encrypted)` });
      }

      // Enable AI
      const existingEnable = await SELECT.one.from(AppConfig).where({ configKey: 'ENABLE_AI' });
      if (existingEnable) {
        await UPDATE(AppConfig).set({ configValue: 'true' }).where({ configKey: 'ENABLE_AI' });
      } else {
        await INSERT.into(AppConfig).entries({ configKey: 'ENABLE_AI', configValue: 'true', description: 'Enable AI features' });
      }

      return { success: true, message: `${provider} configured successfully` };
    } catch (err) {
      return { success: false, message: `Failed to save AI config: ${err.message}` };
    }
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
        return { success: false, answer: 'AI is not configured. Go to Settings → AI Integration to connect your Claude, ChatGPT, Gemini, or OpenRouter account.', provider: '' };
      }

      // Gather all app data as context for the agent
      const appContext = await this._gatherAgentContext();
      const answer = await ai.chat(question, appContext);

      return { success: true, answer, provider: ai.provider };
    } catch (err) {
      return { success: false, answer: `Agent error: ${err.message}`, provider: '' };
    }
  }

  // ─── Gather all data for AI agent context ───
  async _gatherAgentContext() {
    const { TransportWorkItems, WorkItems, Milestones, Notifications } = this._e;

    const [workItems, transports, milestones] = await Promise.all([
      SELECT.from(WorkItems),
      SELECT.from(TransportWorkItems),
      SELECT.from(Milestones)
    ]);

    const now = new Date();
    const lines = [];
    lines.push(`=== WORK ITEMS (${workItems.length} total) ===`);
    for (const wi of workItems) {
      const goLiveDays = wi.goLiveDate ? Math.ceil((new Date(wi.goLiveDate) - now) / 86400000) : null;
      lines.push(`- ${wi.workItemName} [${wi.workItemType}] | Code: ${wi.projectCode} | Module: ${wi.sapModule}`);
      lines.push(`  RAG: ${wi.overallRAG || 'N/A'} | Phase: ${wi.currentPhase || 'N/A'} | Status: ${wi.status} | Methodology: ${wi.methodology || 'N/A'}`);
      lines.push(`  Deploy: ${wi.deploymentPct || 0}% | Priority: ${wi.priority || 'N/A'} | Complexity: ${wi.complexity || 'N/A'}`);
      if (wi.testTotal > 0) {
        lines.push(`  Tests: ${wi.testPassed}/${wi.testTotal} passed (${wi.testCompletionPct}%), Failed: ${wi.testFailed}, TBD: ${wi.testTBD}, Blocked: ${wi.testBlocked} | UAT: ${wi.uatStatus}`);
      }
      lines.push(`  Business Owner: ${wi.businessOwner || 'N/A'} | System Owner: ${wi.systemOwner || 'N/A'} | Dev Lead: ${wi.leadDeveloper || 'N/A'}`);
      if (wi.goLiveDate) lines.push(`  Go-Live: ${wi.goLiveDate} (${goLiveDays > 0 ? goLiveDays + ' days away' : 'OVERDUE'})`);
      if (wi.notes) lines.push(`  Notes: ${wi.notes}`);
    }

    lines.push(`\n=== TRANSPORTS (${transports.length} total) ===`);
    const bySys = { DEV: 0, QAS: 0, PRD: 0 };
    const stuck = [];
    const failed = [];
    for (const tr of transports) {
      bySys[tr.currentSystem] = (bySys[tr.currentSystem] || 0) + 1;
      const age = (now - new Date(tr.createdDate)) / 86400000;
      if (tr.currentSystem !== 'PRD' && age > 5) stuck.push(tr);
      if (tr.importRC >= 8) failed.push(tr);
    }
    lines.push(`DEV: ${bySys.DEV || 0} | QAS: ${bySys.QAS || 0} | PRD: ${bySys.PRD || 0}`);
    lines.push(`Stuck (>5 days): ${stuck.length} | Failed imports (RC>=8): ${failed.length}`);
    lines.push(`Unassigned: ${transports.filter(t => !t.workType).length}`);

    if (failed.length > 0) {
      lines.push('Failed transports:');
      for (const tr of failed.slice(0, 10)) {
        lines.push(`  - ${tr.trNumber} | ${tr.trDescription} | RC=${tr.importRC} | System: ${tr.currentSystem} | Owner: ${tr.ownerFullName || tr.trOwner}`);
      }
    }

    lines.push(`\n=== MILESTONES (${milestones.length} total) ===`);
    const overdue = milestones.filter(m => m.status !== 'Complete' && new Date(m.milestoneDate) < now);
    lines.push(`Overdue: ${overdue.length}`);
    for (const m of overdue.slice(0, 10)) {
      lines.push(`  - ${m.milestoneName} | Due: ${m.milestoneDate} | Status: ${m.status}`);
    }

    lines.push(`\n=== SUMMARY ===`);
    const redProjects = workItems.filter(w => w.overallRAG === 'RED');
    const amberProjects = workItems.filter(w => w.overallRAG === 'AMBER');
    lines.push(`RED projects: ${redProjects.length} — ${redProjects.map(p => p.workItemName).join(', ') || 'None'}`);
    lines.push(`AMBER projects: ${amberProjects.length} — ${amberProjects.map(p => p.workItemName).join(', ') || 'None'}`);
    lines.push(`Today: ${now.toISOString().split('T')[0]}`);

    return lines.join('\n');
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

      let html = await ai._call(systemPrompt, userMessage, 6000);

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
    if (user.is('Admin')) roles.push('Admin');
    if (user.is('Manager')) roles.push('Manager');
    if (user.is('Developer')) roles.push('Developer');
    if (user.is('Executive')) roles.push('Executive');

    return {
      email: user.id,
      name: user.id.split('@')[0], // Simple name extraction; overridden by IdP in prod
      roles,
      isAdmin: user.is('Admin'),
      isManager: user.is('Manager'),
      isDeveloper: user.is('Developer'),
      isExecutive: user.is('Executive')
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
              userEmail: tr.ownerFullName || tr.trOwner || 'system',
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
              userEmail: tr.ownerFullName || tr.trOwner || 'system',
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
            .and(`message like '%${wi.workItemName}%'`);
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
              .and(`message like '%${wi.workItemName}%'`);
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

    const [
      allTRs,
      activeProjects,
      unassigned,
      completedWorkItems
    ] = await Promise.all([
      SELECT.from(TransportWorkItems),
      SELECT.from(WorkItems).where({ status: 'Active' }),
      SELECT.from(TransportWorkItems).where({ workType: null }),
      SELECT.from(WorkItems).where({ status: 'Done' })
    ]);

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
    const { TransportWorkItems } = this._e;
    const allTRs = await SELECT.from(TransportWorkItems);

    const now = new Date();
    const devTRs = allTRs.filter(tr => tr.currentSystem === 'DEV');
    const qasTRs = allTRs.filter(tr => tr.currentSystem === 'QAS');
    const prdTRs = allTRs.filter(tr => tr.currentSystem === 'PRD');

    const stuckTRs = allTRs.filter(tr => {
      if (tr.currentSystem === 'PRD') return false;
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
    const { TransportWorkItems, WorkItems, AppConfig } = this._e;

    // Read configurable prefixes (or use defaults)
    const configs = await SELECT.from(AppConfig);
    const getConfig = (key, defaultVal) => {
      const c = configs.find(c => c.configKey === key);
      return c?.configValue || defaultVal;
    };

    const snowPrefix = getConfig('SNOW_TASK_PREFIX', 'SNOW');
    const incPrefix = getConfig('INCIDENT_PREFIX', 'INC');
    const vendorPrefix = getConfig('VENDOR_TICKET_PREFIX', 'CS');

    // Build regex to find ticket references in TR descriptions
    const ticketPattern = new RegExp(
      `(${snowPrefix}\\d+|${incPrefix}\\d+|${vendorPrefix}\\d+)`,
      'gi'
    );

    const allTRs = await SELECT.from(TransportWorkItems);
    const allWIs = await SELECT.from(WorkItems);

    // Build lookup: snowTicket → work item ID
    const ticketToWI = {};
    for (const wi of allWIs) {
      if (wi.snowTicket) {
        ticketToWI[wi.snowTicket.toUpperCase()] = wi.ID;
      }
    }

    let linked = 0;
    for (const tr of allTRs) {
      if (tr.workItem_ID) continue; // Already assigned
      const desc = tr.trDescription || '';
      const matches = desc.match(ticketPattern);
      if (!matches) continue;

      for (const ticket of matches) {
        const upper = ticket.toUpperCase();
        // Check direct match to work item snowTicket
        if (ticketToWI[upper]) {
          await UPDATE(TransportWorkItems).set({
            workItem_ID: ticketToWI[upper],
            snowTicket: upper,
            assignedBy: 'auto-link',
            assignedDate: new Date().toISOString(),
          }).where({ ID: tr.ID });
          linked++;
          break;
        }
        // Also check partial match (e.g., INC12345 matches WI with snowTicket INC12345)
        for (const wi of allWIs) {
          if (wi.snowTicket && upper.includes(wi.snowTicket.toUpperCase())) {
            await UPDATE(TransportWorkItems).set({
              workItem_ID: wi.ID,
              snowTicket: upper,
              assignedBy: 'auto-link',
              assignedDate: new Date().toISOString(),
            }).where({ ID: tr.ID });
            linked++;
            break;
          }
        }
      }
    }

    return { success: true, linked, message: `Auto-linked ${linked} transport(s) based on ticket patterns (${snowPrefix}*, ${incPrefix}*, ${vendorPrefix}*)` };
  }
}

module.exports = TransportService;
