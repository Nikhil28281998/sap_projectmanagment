/**
 * Report Generator — Gathers data and formats weekly leadership report
 * Works without AI — AI polish is optional
 * Includes test status summary per project
 */

class ReportGenerator {
  constructor(db, entities) {
    this.db = db;
    this.entities = entities;
  }

  /**
   * Gather all data needed for the weekly report
   */
  async gatherReportData() {
    const { TransportWorkItems, WorkItems, Milestones } = this.entities;

    const [transports, workItems, milestones] = await Promise.all([
      SELECT.from(TransportWorkItems),
      SELECT.from(WorkItems),
      SELECT.from(Milestones)
    ]);

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Active projects
    const activeProjects = workItems.filter(wi => wi.status === 'Active');

    // Transports by system
    const trsBySys = {
      DEV: transports.filter(t => t.currentSystem === 'DEV'),
      QAS: transports.filter(t => t.currentSystem === 'QAS'),
      PRD: transports.filter(t => t.currentSystem === 'PRD')
    };

    // Stuck transports (in non-PRD > 5 days)
    const stuck = transports.filter(t => {
      if (t.currentSystem === 'PRD') return false;
      return (now - new Date(t.createdDate)) / 86400000 > 5;
    });

    // Failed imports
    const failed = transports.filter(t => t.importRC >= 8);

    // Upcoming go-lives (next 14 days)
    const fourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const upcoming = activeProjects.filter(p => {
      const goLive = new Date(p.goLiveDate);
      return goLive >= now && goLive <= fourteenDays;
    });

    // Overdue milestones
    const overdue = milestones.filter(m => {
      return m.status !== 'Complete' && new Date(m.milestoneDate) < now;
    });

    // Completed work items
    const completed = workItems.filter(wi => {
      return wi.status === 'Done' && new Date(wi.modifiedAt || wi.createdAt) >= oneWeekAgo;
    });

    // Unassigned
    const unassigned = transports.filter(t => !t.workType);

    // Projects with test tracking
    const withTests = activeProjects.filter(p => (p.testTotal || 0) > 0);

    return {
      date: now.toISOString().split('T')[0],
      totalTransports: transports.length,
      trsBySys,
      activeProjects,
      stuck,
      failed,
      upcoming,
      overdue,
      completed,
      unassigned,
      withTests
    };
  }

  /**
   * Format report data into professional email-ready text
   */
  formatReport(data) {
    const lines = [];
    lines.push(`Subject: Weekly SAP Project Status — ${data.date}\n`);
    lines.push(`Hi Team,\n`);
    lines.push(`Please find this week's SAP project status update below.\n`);

    // Executive Summary
    lines.push(`## Executive Summary`);
    lines.push(`- **${data.activeProjects.length}** active work items across all modules`);
    lines.push(`- **${data.totalTransports}** transports tracked (DEV: ${data.trsBySys.DEV.length} | QAS: ${data.trsBySys.QAS.length} | PRD: ${data.trsBySys.PRD.length})`);
    if (data.stuck.length > 0) lines.push(`- **${data.stuck.length}** transports stuck >5 days ⚠`);
    if (data.failed.length > 0) lines.push(`- **${data.failed.length}** failed imports requiring attention ❌`);
    if (data.unassigned.length > 0) lines.push(`- **${data.unassigned.length}** unassigned transports`);
    lines.push('');

    // Active Projects with RAG + Test Status
    if (data.activeProjects.length > 0) {
      lines.push(`## Project Status`);
      lines.push('| Project | RAG | Phase | Deployment | Tests | UAT |');
      lines.push('|---------|-----|-------|------------|-------|-----|');
      for (const p of data.activeProjects) {
        const rag = p.overallRAG || 'N/A';
        const ragIcon = rag === 'RED' ? '🔴' : rag === 'AMBER' ? '🟡' : '🟢';
        const testInfo = (p.testTotal || 0) > 0
          ? `${p.testPassed || 0}/${p.testTotal} (${p.testCompletionPct || 0}%)`
          : 'N/A';
        const uat = p.uatStatus || 'N/A';
        lines.push(`| ${p.workItemName} | ${ragIcon} ${rag} | ${p.currentPhase || 'N/A'} | ${p.deploymentPct || 0}% | ${testInfo} | ${uat} |`);
      }
      lines.push('');
    }

    // Test Status Detail (only for projects with tests)
    if (data.withTests.length > 0) {
      lines.push(`## UAT / Test Progress`);
      for (const p of data.withTests) {
        const total = p.testTotal || 0;
        const passed = p.testPassed || 0;
        const failed = p.testFailed || 0;
        const tbd = p.testTBD || 0;
        const blocked = p.testBlocked || 0;
        const skipped = p.testSkipped || 0;
        lines.push(`**${p.workItemName}** — ${p.uatStatus || 'In Progress'}`);
        lines.push(`  ✅ Passed: ${passed}/${total} (${Math.round(passed/total*100)}%) | ❌ Failed: ${failed} | ⏳ TBD: ${tbd} | 🚫 Blocked: ${blocked} | ⏭ Skipped: ${skipped}`);
        if (failed > 0) {
          lines.push(`  ⚠ Action needed: ${failed} test case(s) failed — review and retest`);
        }
      }
      lines.push('');
    }

    // Upcoming Go-Lives
    if (data.upcoming.length > 0) {
      lines.push(`## 🚀 Upcoming Go-Lives (Next 14 Days)`);
      for (const p of data.upcoming) {
        const days = Math.ceil((new Date(p.goLiveDate) - new Date()) / 86400000);
        lines.push(`- **${p.workItemName}** — ${p.goLiveDate} (${days} days) | Lead: ${p.leadDeveloper || 'TBD'}`);
      }
      lines.push('');
    }

    // Alerts
    const hasAlerts = data.stuck.length > 0 || data.failed.length > 0 || data.overdue.length > 0;
    if (hasAlerts) {
      lines.push(`## ⚠ Alerts & Risks`);
      if (data.failed.length > 0) {
        lines.push(`**Failed Imports (RC≥8):**`);
        for (const tr of data.failed) {
          lines.push(`- ${tr.trNumber} — RC=${tr.importRC} in ${tr.currentSystem} | Owner: ${tr.ownerFullName || tr.trOwner}`);
        }
      }
      if (data.stuck.length > 0) {
        lines.push(`**Stuck Transports (>5 days):** ${data.stuck.length} total`);
        for (const tr of data.stuck.slice(0, 5)) {
          lines.push(`- ${tr.trNumber} — ${tr.currentSystem} | Owner: ${tr.ownerFullName || tr.trOwner}`);
        }
        if (data.stuck.length > 5) lines.push(`  ... and ${data.stuck.length - 5} more`);
      }
      if (data.overdue.length > 0) {
        lines.push(`**Overdue Milestones:** ${data.overdue.length}`);
        for (const m of data.overdue.slice(0, 5)) {
          lines.push(`- ${m.milestoneName} — due ${m.milestoneDate}`);
        }
      }
      lines.push('');
    }

    // Completed
    if (data.completed.length > 0) {
      lines.push(`## ✅ Completed This Week`);
      for (const c of data.completed) {
        lines.push(`- ${c.workItemName} (${c.workItemType})`);
      }
      lines.push('');
    }

    lines.push(`---`);
    lines.push(`Best regards,`);
    lines.push(`SAP Project Management Team`);
    lines.push(`\n_Generated by SAP PM App on ${new Date().toISOString()}_`);

    return lines.join('\n');
  }
}

module.exports = { ReportGenerator };
