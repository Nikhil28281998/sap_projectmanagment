/**
 * Report Generator — Gathers data and formats weekly leadership report
 * Works without AI — AI polish is optional
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
    const activeProjects = workItems.filter(wi => wi.status === 'Active' && wi.workItemType === 'Project');

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
      unassigned
    };
  }

  /**
   * Format report data into readable text
   */
  formatReport(data) {
    const lines = [];
    lines.push(`# Weekly SAP Project Status Report`);
    lines.push(`**Week of ${data.date}**\n`);

    // Summary
    lines.push(`## Summary`);
    lines.push(`- **Active Projects:** ${data.activeProjects.length}`);
    lines.push(`- **Total Transports:** ${data.totalTransports} (DEV: ${data.trsBySys.DEV.length} | QAS: ${data.trsBySys.QAS.length} | PRD: ${data.trsBySys.PRD.length})`);
    lines.push(`- **Stuck Transports (>5 days):** ${data.stuck.length}`);
    lines.push(`- **Failed Imports:** ${data.failed.length}`);
    lines.push(`- **Unassigned TRs:** ${data.unassigned.length}`);
    lines.push(`- **Completed This Week:** ${data.completed.length}\n`);

    // Active Projects Detail
    if (data.activeProjects.length > 0) {
      lines.push(`## Active Projects`);
      for (const p of data.activeProjects) {
        const daysToGoLive = p.goLiveDate ?
          Math.ceil((new Date(p.goLiveDate) - new Date()) / 86400000) : 'N/A';
        const rag = p.overallRAG || 'N/A';
        lines.push(`- **${p.workItemName}** [${rag}]`);
        lines.push(`  - Go-Live: ${p.goLiveDate || 'TBD'} (${daysToGoLive} days)`);
        lines.push(`  - Phase: ${p.currentPhase || 'N/A'} | Deployment: ${p.deploymentPct || 0}%`);
        if (p.leadDeveloper) lines.push(`  - Lead: ${p.leadDeveloper}`);
      }
      lines.push('');
    }

    // Upcoming Go-Lives
    if (data.upcoming.length > 0) {
      lines.push(`## 🚀 Upcoming Go-Lives (Next 14 Days)`);
      for (const p of data.upcoming) {
        lines.push(`- **${p.workItemName}** — ${p.goLiveDate}`);
      }
      lines.push('');
    }

    // Alerts
    if (data.stuck.length > 0 || data.failed.length > 0 || data.overdue.length > 0) {
      lines.push(`## ⚠ Alerts`);
      if (data.failed.length > 0) {
        lines.push(`### ❌ Failed Imports`);
        for (const tr of data.failed) {
          lines.push(`- ${tr.trNumber} — RC=${tr.importRC} in ${tr.currentSystem} | Owner: ${tr.ownerFullName || tr.trOwner}`);
        }
      }
      if (data.stuck.length > 0) {
        lines.push(`### ⏳ Stuck Transports (>5 days)`);
        for (const tr of data.stuck.slice(0, 10)) {
          lines.push(`- ${tr.trNumber} — ${tr.currentSystem} | Owner: ${tr.ownerFullName || tr.trOwner}`);
        }
        if (data.stuck.length > 10) lines.push(`  ... and ${data.stuck.length - 10} more`);
      }
      if (data.overdue.length > 0) {
        lines.push(`### 📅 Overdue Milestones`);
        for (const m of data.overdue) {
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
    lines.push(`_Generated by SAP Project Management App on ${new Date().toISOString()}_`);

    return lines.join('\n');
  }
}

module.exports = { ReportGenerator };
