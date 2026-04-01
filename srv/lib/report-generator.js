/**
 * Report Generator — Gathers structured project data for template-based reports
 * Returns JSON data that the frontend renders using templates
 * No AI dependency — pure data transformation
 */

class ReportGenerator {
  constructor(db, entities) {
    this.db = db;
    this.entities = entities;
  }

  /**
   * Gather all data needed for the report (structured JSON)
   * @param {string} [workItemId] — Optional: generate report for a single project only
   */
  async gatherReportData(workItemId) {
    const { TransportWorkItems, WorkItems, Milestones } = this.entities;

    let transports, workItems, milestones;

    if (workItemId) {
      [transports, workItems, milestones] = await Promise.all([
        SELECT.from(TransportWorkItems).where({ workItem_ID: workItemId }),
        SELECT.from(WorkItems).where({ ID: workItemId }),
        SELECT.from(Milestones).where({ workItem_ID: workItemId }).orderBy('milestoneOrder asc'),
      ]);
    } else {
      [transports, workItems, milestones] = await Promise.all([
        SELECT.from(TransportWorkItems),
        SELECT.from(WorkItems),
        SELECT.from(Milestones).orderBy('milestoneOrder asc'),
      ]);
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneWeekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const activeProjects = workItems.filter(wi => wi.status === 'Active');

    // Transports by system
    const trsBySys = {
      DEV: transports.filter(t => t.currentSystem === 'DEV'),
      QAS: transports.filter(t => t.currentSystem === 'QAS'),
      PRD: transports.filter(t => t.currentSystem === 'PRD'),
    };

    // Stuck transports (in non-PRD > 5 days)
    const stuck = transports.filter(t => {
      if (t.currentSystem === 'PRD') return false;
      return (now - new Date(t.createdDate)) / 86400000 > 5;
    });

    // Failed imports
    const failed = transports.filter(t => t.importRC >= 8);

    // Upcoming go-lives (next 14 days)
    const upcoming = activeProjects.filter(p => {
      const goLive = new Date(p.goLiveDate);
      return goLive >= now && goLive <= fourteenDays;
    });

    // Overdue milestones
    const overdue = milestones.filter(m =>
      m.status !== 'Complete' && new Date(m.milestoneDate) < now
    );

    // Completed this week
    const completedThisWeek = workItems.filter(wi =>
      wi.status === 'Done' && new Date(wi.modifiedAt || wi.createdAt) >= oneWeekAgo
    );

    // Recently completed milestones (this week)
    const completedMilestones = milestones.filter(m =>
      m.status === 'Complete' && m.completedDate && new Date(m.completedDate) >= oneWeekAgo
    );

    // In-progress milestones
    const inProgressMilestones = milestones.filter(m => m.status === 'Pending' || m.status === 'In Progress');

    // Upcoming milestones (next 7 days)
    const upcomingMilestones = milestones.filter(m => {
      if (m.status === 'Complete') return false;
      const d = new Date(m.milestoneDate);
      return d >= now && d <= oneWeekAhead;
    });

    // Unassigned
    const unassigned = transports.filter(t => !t.workType);

    // Projects with test tracking
    const withTests = activeProjects.filter(p => (p.testTotal || 0) > 0);

    // Build per-project summary for the overview table
    const projectOverviews = activeProjects.map(p => {
      const projectTRs = transports.filter(t => t.workItem_ID === p.ID);
      const projectMilestones = milestones.filter(m => m.workItem_ID === p.ID);
      const projectStuck = projectTRs.filter(t =>
        t.currentSystem !== 'PRD' && (now - new Date(t.createdDate)) / 86400000 > 5
      );
      const projectFailed = projectTRs.filter(t => t.importRC >= 8);

      return {
        id: p.ID,
        name: p.workItemName,
        projectCode: p.projectCode,
        type: p.workItemType,
        sapModule: p.sapModule || 'N/A',
        sapOwner: p.leadDeveloper || 'TBD',
        businessOwner: p.businessOwner || 'TBD',
        systemOwner: p.systemOwner || 'TBD',
        functionalLead: p.functionalLead || 'TBD',
        qaLead: p.qaLead || 'TBD',
        goLiveDate: p.goLiveDate || 'TBD',
        overallRAG: p.overallRAG || 'GREEN',
        currentPhase: p.currentPhase || 'N/A',
        deploymentPct: p.deploymentPct || 0,
        status: p.status,
        complexity: p.complexity || 'N/A',
        priority: p.priority || 'N/A',
        // Test data
        testTotal: p.testTotal || 0,
        testPassed: p.testPassed || 0,
        testFailed: p.testFailed || 0,
        testBlocked: p.testBlocked || 0,
        testTBD: p.testTBD || 0,
        testSkipped: p.testSkipped || 0,
        testCompletionPct: p.testCompletionPct || 0,
        uatStatus: p.uatStatus || 'Not Started',
        // Transport counts
        totalTRs: projectTRs.length,
        trsDEV: projectTRs.filter(t => t.currentSystem === 'DEV').length,
        trsQAS: projectTRs.filter(t => t.currentSystem === 'QAS').length,
        trsPRD: projectTRs.filter(t => t.currentSystem === 'PRD').length,
        stuckCount: projectStuck.length,
        failedCount: projectFailed.length,
        // Milestones
        milestones: projectMilestones.map(m => ({
          name: m.milestoneName,
          date: m.milestoneDate,
          status: m.status,
          completedDate: m.completedDate,
          evidence: m.evidence,
          order: m.milestoneOrder,
        })),
        // Dates
        kickoffDate: p.kickoffDate,
        devCompleteDate: p.devCompleteDate,
        uatStartDate: p.uatStartDate,
        uatSignoffDate: p.uatSignoffDate,
        hypercareEndDate: p.hypercareEndDate,
        notes: p.notes,
      };
    });

    // Auto-suggestions for "Current Week" and "Next Week"
    const currentWeekSuggestions = this._generateCurrentWeekSuggestions(
      completedMilestones, inProgressMilestones, transports, activeProjects, failed, workItemId
    );
    const nextWeekSuggestions = this._generateNextWeekSuggestions(
      upcomingMilestones, inProgressMilestones, activeProjects, workItemId
    );

    // Compute fiscal week
    const weekNumber = this._getISOWeek(now);
    const fiscalYear = now.getFullYear();

    return {
      generatedAt: now.toISOString(),
      date: now.toISOString().split('T')[0],
      weekLabel: `WK${String(weekNumber).padStart(2, '0')} FY${fiscalYear}`,
      weekNumber,
      fiscalYear,
      // Aggregate stats
      totalTransports: transports.length,
      trsBySys: {
        DEV: trsBySys.DEV.length,
        QAS: trsBySys.QAS.length,
        PRD: trsBySys.PRD.length,
      },
      activeProjectCount: activeProjects.length,
      stuckCount: stuck.length,
      failedCount: failed.length,
      unassignedCount: unassigned.length,
      upcomingGoLives: upcoming.map(p => ({
        name: p.workItemName,
        goLiveDate: p.goLiveDate,
        daysUntil: Math.ceil((new Date(p.goLiveDate) - now) / 86400000),
        lead: p.leadDeveloper || 'TBD',
      })),
      overdueCount: overdue.length,
      overdueMilestones: overdue.slice(0, 10).map(m => ({
        name: m.milestoneName,
        dueDate: m.milestoneDate,
      })),
      completedThisWeek: completedThisWeek.map(c => ({
        name: c.workItemName,
        type: c.workItemType,
      })),
      // Per-project data
      projects: projectOverviews,
      // Suggestions
      currentWeekSuggestions,
      nextWeekSuggestions,
    };
  }

  /**
   * Generate current week activity suggestions from data
   */
  _generateCurrentWeekSuggestions(completedMilestones, inProgressMilestones, transports, activeProjects, failed, workItemId) {
    const suggestions = [];

    for (const m of completedMilestones) {
      if (workItemId && m.workItem_ID !== workItemId) continue;
      suggestions.push(`${m.milestoneName} completed`);
    }

    for (const m of inProgressMilestones.slice(0, 5)) {
      if (workItemId && m.workItem_ID !== workItemId) continue;
      if (m.milestoneName.toLowerCase().includes('uat')) {
        suggestions.push('UAT in progress');
      } else if (m.milestoneName.toLowerCase().includes('test')) {
        suggestions.push(`${m.milestoneName} in progress`);
      }
    }

    for (const p of activeProjects) {
      if (workItemId && p.ID !== workItemId) continue;
      if (p.currentPhase === 'Testing' && !suggestions.some(s => s.includes('UAT'))) {
        suggestions.push('UAT in progress');
      }
      if (p.currentPhase === 'Development') {
        suggestions.push('Development activities ongoing');
      }
    }

    if (failed.length > 0) {
      suggestions.push(`${failed.length} transport import issue(s) being investigated`);
    }

    return [...new Set(suggestions)].slice(0, 8);
  }

  /**
   * Generate next week plan suggestions from data
   */
  _generateNextWeekSuggestions(upcomingMilestones, inProgressMilestones, activeProjects, workItemId) {
    const suggestions = [];

    for (const m of upcomingMilestones) {
      if (workItemId && m.workItem_ID !== workItemId) continue;
      suggestions.push(`${m.milestoneName} — target ${m.milestoneDate}`);
    }

    for (const p of activeProjects) {
      if (workItemId && p.ID !== workItemId) continue;
      if (p.uatStatus === 'In Progress') {
        suggestions.push('Continue UAT testing');
      }
      if (p.currentPhase === 'Testing') {
        suggestions.push('UAT Testing');
      }
    }

    for (const m of inProgressMilestones.slice(0, 3)) {
      if (workItemId && m.workItem_ID !== workItemId) continue;
      const name = m.milestoneName;
      if (!suggestions.some(s => s.includes(name))) {
        suggestions.push(`Continue ${name}`);
      }
    }

    return [...new Set(suggestions)].slice(0, 8);
  }

  /**
   * Get ISO week number
   */
  _getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }
}

module.exports = { ReportGenerator };
