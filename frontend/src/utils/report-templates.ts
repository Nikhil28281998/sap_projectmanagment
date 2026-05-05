/**
 * Report Templates — Outlook-compatible HTML templates for SAP PM reports
 * Each template takes structured report data and returns HTML with inline CSS
 * Designed for Outlook email paste (no <style> blocks, all inline)
 */

// ─── Shared styles ───
const S = {
  font: 'Calibri, Arial, Helvetica, sans-serif',
  headerBg: '#1f4e79',
  headerColor: '#ffffff',
  altRowBg: '#f2f7fb',
  borderColor: '#d6d6d6',
  greenBg: '#e2efda',
  amberBg: '#fff2cc',
  redBg: '#fce4ec',
  sectionColor: '#1f4e79',
};

function ragBadge(rag: string): string {
  const r = (rag || 'GREEN').toUpperCase();
  if (r === 'RED') return '<span style="color:#c0392b;font-weight:bold">🔴 Red</span>';
  if (r === 'AMBER') return '<span style="color:#e67e22;font-weight:bold">🟡 Amber</span>';
  return '<span style="color:#27ae60;font-weight:bold">🟢 On Track</span>';
}

function milestoneStatus(status: string): string {
  if (status === 'Complete') return '<span style="color:#27ae60;font-weight:bold">Complete</span>';
  if (status === 'Overdue') return '<span style="color:#c0392b;font-weight:bold">Overdue</span>';
  if (status === 'In Progress') return '<span style="color:#2980b9;font-weight:bold">In Progress</span>';
  return status || 'Not Started';
}

function th(text: string): string {
  return `<th style="border:1px solid ${S.borderColor}; padding:8px 12px; background-color:${S.headerBg}; color:${S.headerColor}; font-family:${S.font}; font-size:13px; text-align:left; font-weight:bold">${text}</th>`;
}

function td(text: string, extra = ''): string {
  return `<td style="border:1px solid ${S.borderColor}; padding:8px 12px; font-family:${S.font}; font-size:13px; ${extra}">${text}</td>`;
}

function sectionHeader(text: string): string {
  return `<p style="font-family:${S.font}; font-size:14px; font-weight:bold; color:${S.sectionColor}; margin:20px 0 8px 0; border-bottom:2px solid ${S.sectionColor}; padding-bottom:4px; text-decoration:underline">${text}</p>`;
}

export interface ReportData {
  generatedAt: string;
  date: string;
  weekLabel: string;
  weekNumber: number;
  fiscalYear: number;
  totalTransports: number;
  trsBySys: { DEV: number; QAS: number; PRD: number };
  activeProjectCount: number;
  stuckCount: number;
  failedCount: number;
  unassignedCount: number;
  upcomingGoLives: { name: string; goLiveDate: string; daysUntil: number; lead: string }[];
  overdueCount: number;
  overdueMilestones: { name: string; dueDate: string }[];
  completedThisWeek: { name: string; type: string }[];
  projects: ProjectData[];
  currentWeekSuggestions: string[];
  nextWeekSuggestions: string[];
}

export interface ProjectData {
  id: string;
  name: string;
  projectCode: string;
  type: string;
  sapModule: string;
  sapOwner: string;
  businessOwner: string;
  systemOwner: string;
  functionalLead: string;
  qaLead: string;
  goLiveDate: string;
  overallRAG: string;
  currentPhase: string;
  deploymentPct: number;
  status: string;
  complexity: string;
  priority: string;
  testTotal: number;
  testPassed: number;
  testFailed: number;
  testBlocked: number;
  testTBD: number;
  testSkipped: number;
  testCompletionPct: number;
  uatStatus: string;
  totalTRs: number;
  trsDEV: number;
  trsQAS: number;
  trsPRD: number;
  stuckCount: number;
  failedCount: number;
  milestones: {
    name: string;
    date: string;
    status: string;
    completedDate: string;
    evidence: string;
    order: number;
  }[];
  kickoffDate: string;
  devCompleteDate: string;
  uatStartDate: string;
  uatSignoffDate: string;
  hypercareEndDate: string;
  notes: string;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 1: Weekly Status Update (matches user's Outlook format)
// ═══════════════════════════════════════════════════════════════
export function weeklyStatusTemplate(
  data: ReportData,
  project: ProjectData,
  currentWeek: string[],
  nextWeek: string[],
): string {
  const rows = project.milestones
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((m, i) => {
      const bg = i % 2 === 1 ? `background-color:${S.altRowBg};` : '';
      return `<tr>
        ${td(m.name, bg)}
        ${td(project.sapModule, bg)}
        ${td(m.date || 'TBD', bg)}
        ${td(milestoneStatus(m.status), bg)}
        ${td(project.sapOwner, bg)}
        ${td(m.evidence || 'N/A', bg)}
      </tr>`;
    })
    .join('');

  const cwItems = currentWeek.map((item, i) => `<p style="font-family:${S.font}; font-size:13px; margin:2px 0 2px 16px">${i + 1}. ${item}</p>`).join('');
  const nwItems = nextWeek.map((item, i) => `<p style="font-family:${S.font}; font-size:13px; margin:2px 0 2px 16px">${i + 1}. ${item}</p>`).join('');

  return `
<p style="font-family:${S.font}; font-size:13px; margin:0 0 8px 0">Hi All,</p>
<p style="font-family:${S.font}; font-size:13px; margin:0 0 16px 0">Please find below the weekly status update for the <strong>${project.name}</strong> project. Overall, the project remains ${project.overallRAG === 'GREEN' ? 'on track with activities progressing as planned' : project.overallRAG === 'AMBER' ? 'at risk — please review the details below' : 'in critical status — immediate attention required'}.</p>

<table style="border-collapse:collapse; width:100%; font-family:${S.font}; margin-bottom:16px" cellpadding="0" cellspacing="0">
  <tr><td colspan="5" style="background-color:${S.headerBg}; color:${S.headerColor}; font-weight:bold; text-align:center; padding:10px; font-size:14px; border:1px solid ${S.borderColor}">Project Overview</td></tr>
  <tr>
    ${th('Project Name')}
    ${th('SAP Owner')}
    ${th('Business Owner')}
    ${th('Go-Live Target')}
    ${th('Overall Status')}
  </tr>
  <tr>
    ${td(project.name)}
    ${td(project.sapOwner)}
    ${td(project.businessOwner)}
    ${td(project.goLiveDate)}
    ${td(ragBadge(project.overallRAG))}
  </tr>
</table>

${sectionHeader('Schedule & Key Milestones')}
<table style="border-collapse:collapse; width:100%; font-family:${S.font}; margin-bottom:16px" cellpadding="0" cellspacing="0">
  <tr>
    ${th('Milestone')}
    ${th('SAP Area')}
    ${th('Planned Date')}
    ${th('Status')}
    ${th('Owner')}
    ${th('Comments')}
  </tr>
  ${rows || `<tr>${td('No milestones defined', 'color:#999')}<td colspan="5"></td></tr>`}
</table>

${sectionHeader('Current week')}
${cwItems || `<p style="font-family:${S.font}; font-size:13px; margin:2px 0 2px 16px; color:#999">No items</p>`}

${sectionHeader('Next week')}
${nwItems || `<p style="font-family:${S.font}; font-size:13px; margin:2px 0 2px 16px; color:#999">No items</p>`}

<p style="font-family:${S.font}; font-size:13px; margin:20px 0 4px 0">Please let us know if you have any questions or more information is required.</p>
<p style="font-family:${S.font}; font-size:13px; margin:4px 0">Best regards,<br/>SAP Project Management Team</p>
`.trim();
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 2: Executive Summary (all projects overview)
// ═══════════════════════════════════════════════════════════════
export function executiveSummaryTemplate(
  data: ReportData,
  currentWeek: string[],
  nextWeek: string[],
): string {
  const projectRows = data.projects
    .map((p, i) => {
      const bg = i % 2 === 1 ? `background-color:${S.altRowBg};` : '';
      const testInfo = p.testTotal > 0 ? `${p.testPassed}/${p.testTotal} (${p.testCompletionPct}%)` : 'N/A';
      return `<tr>
        ${td(p.name, bg)}
        ${td(p.sapModule, bg)}
        ${td(ragBadge(p.overallRAG), bg)}
        ${td(p.currentPhase, bg)}
        ${td(`${p.deploymentPct}%`, bg)}
        ${td(testInfo, bg)}
        ${td(p.goLiveDate, bg)}
      </tr>`;
    })
    .join('');

  const risksHtml = [];
  if (data.stuckCount > 0) risksHtml.push(`<li style="font-family:${S.font}; font-size:13px">${data.stuckCount} transport(s) stuck &gt;5 days in non-production</li>`);
  if (data.failedCount > 0) risksHtml.push(`<li style="font-family:${S.font}; font-size:13px">${data.failedCount} failed import(s) (RC&ge;8)</li>`);
  if (data.overdueCount > 0) risksHtml.push(`<li style="font-family:${S.font}; font-size:13px">${data.overdueCount} overdue milestone(s)</li>`);
  if (data.unassignedCount > 0) risksHtml.push(`<li style="font-family:${S.font}; font-size:13px">${data.unassignedCount} unassigned transport(s)</li>`);

  const cwItems = currentWeek.map((item, i) => `<p style="font-family:${S.font}; font-size:13px; margin:2px 0 2px 16px">${i + 1}. ${item}</p>`).join('');
  const nwItems = nextWeek.map((item, i) => `<p style="font-family:${S.font}; font-size:13px; margin:2px 0 2px 16px">${i + 1}. ${item}</p>`).join('');

  const goLiveRows = data.upcomingGoLives.map(g =>
    `<li style="font-family:${S.font}; font-size:13px"><strong>${g.name}</strong> — ${g.goLiveDate} (${g.daysUntil} days) | Lead: ${g.lead}</li>`
  ).join('');

  return `
<p style="font-family:${S.font}; font-size:13px; margin:0 0 8px 0">Hi All,</p>
<p style="font-family:${S.font}; font-size:13px; margin:0 0 16px 0">Please find below the weekly SAP project portfolio status update (${data.weekLabel}). We have <strong>${data.activeProjectCount}</strong> active projects with <strong>${data.totalTransports}</strong> transports under management.</p>

<table style="border-collapse:collapse; width:100%; font-family:${S.font}; margin-bottom:16px" cellpadding="0" cellspacing="0">
  <tr><td colspan="7" style="background-color:${S.headerBg}; color:${S.headerColor}; font-weight:bold; text-align:center; padding:10px; font-size:14px; border:1px solid ${S.borderColor}">Project Portfolio Overview</td></tr>
  <tr>
    ${th('Project')}
    ${th('Module')}
    ${th('Status')}
    ${th('Phase')}
    ${th('Deploy %')}
    ${th('Tests')}
    ${th('Go-Live')}
  </tr>
  ${projectRows}
</table>

${data.upcomingGoLives.length > 0 ? `${sectionHeader('Upcoming Go-Lives (Next 14 Days)')}<ul style="margin:4px 0">${goLiveRows}</ul>` : ''}

${risksHtml.length > 0 ? `${sectionHeader('Risks & Alerts')}<ul style="margin:4px 0">${risksHtml.join('')}</ul>` : ''}

${sectionHeader('Current week')}
${cwItems || `<p style="font-family:${S.font}; font-size:13px; margin:2px 0 2px 16px; color:#999">No items</p>`}

${sectionHeader('Next week')}
${nwItems || `<p style="font-family:${S.font}; font-size:13px; margin:2px 0 2px 16px; color:#999">No items</p>`}

<p style="font-family:${S.font}; font-size:13px; margin:20px 0 4px 0">Please let us know if you have any questions or more information is required.</p>
<p style="font-family:${S.font}; font-size:13px; margin:4px 0">Best regards,<br/>SAP Project Management Team</p>
`.trim();
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 3: Go-Live Readiness
// ═══════════════════════════════════════════════════════════════
export function goLiveReadinessTemplate(
  data: ReportData,
  project: ProjectData,
): string {
  const testPct = project.testTotal > 0 ? Math.round((project.testPassed / project.testTotal) * 100) : 0;
  const checkItems = [
    { area: 'Business Blueprint / Design', status: project.milestones.some(m => m.name.toLowerCase().includes('blueprint') && m.status === 'Complete') ? 'Complete' : 'Pending' },
    { area: 'Configuration', status: project.milestones.some(m => m.name.toLowerCase().includes('config') && m.status === 'Complete') ? 'Complete' : 'Pending' },
    { area: 'Unit Testing', status: project.milestones.some(m => m.name.toLowerCase().includes('unit test') && m.status === 'Complete') ? 'Complete' : 'Pending' },
    { area: 'Integration Testing', status: project.milestones.some(m => m.name.toLowerCase().includes('integration') && m.status === 'Complete') ? 'Complete' : 'Pending' },
    { area: 'UAT', status: project.uatStatus },
    { area: 'Transport Deployment', status: project.trsPRD > 0 ? `${project.deploymentPct}% deployed` : 'Not started' },
    { area: 'Go-Live Readiness / Cutover', status: project.milestones.some(m => m.name.toLowerCase().includes('go-live') && m.status === 'Complete') ? 'Complete' : 'Not Started' },
  ];

  const checkRows = checkItems
    .map((item, i) => {
      const bg = i % 2 === 1 ? `background-color:${S.altRowBg};` : '';
      const statusColor = item.status === 'Complete' || item.status === 'Passed' ? 'color:#27ae60;font-weight:bold' :
        item.status.includes('Progress') ? 'color:#2980b9;font-weight:bold' : '';
      return `<tr>
        ${td(item.area, bg)}
        ${td(`<span style="${statusColor}">${item.status}</span>`, bg)}
      </tr>`;
    })
    .join('');

  return `
<p style="font-family:${S.font}; font-size:13px; margin:0 0 8px 0">Hi All,</p>
<p style="font-family:${S.font}; font-size:13px; margin:0 0 16px 0">Please find below the go-live readiness assessment for <strong>${project.name}</strong>.</p>

<table style="border-collapse:collapse; width:100%; font-family:${S.font}; margin-bottom:16px" cellpadding="0" cellspacing="0">
  <tr><td colspan="5" style="background-color:${S.headerBg}; color:${S.headerColor}; font-weight:bold; text-align:center; padding:10px; font-size:14px; border:1px solid ${S.borderColor}">Project Overview</td></tr>
  <tr>
    ${th('Project Name')}
    ${th('SAP Owner')}
    ${th('Go-Live Target')}
    ${th('Deploy %')}
    ${th('Overall Status')}
  </tr>
  <tr>
    ${td(project.name)}
    ${td(project.sapOwner)}
    ${td(project.goLiveDate)}
    ${td(`${project.deploymentPct}%`)}
    ${td(ragBadge(project.overallRAG))}
  </tr>
</table>

${sectionHeader('Readiness Checklist')}
<table style="border-collapse:collapse; width:100%; font-family:${S.font}; margin-bottom:16px" cellpadding="0" cellspacing="0">
  <tr>
    ${th('Area')}
    ${th('Status')}
  </tr>
  ${checkRows}
</table>

${sectionHeader('Test Summary')}
<table style="border-collapse:collapse; width:60%; font-family:${S.font}; margin-bottom:16px" cellpadding="0" cellspacing="0">
  <tr>${th('Metric')}${th('Value')}</tr>
  <tr>${td('Total Test Cases')}${td(String(project.testTotal))}</tr>
  <tr>${td('Passed', `background-color:${S.altRowBg}`)}${td(`${project.testPassed} (${testPct}%)`, `background-color:${S.altRowBg}`)}</tr>
  <tr>${td('Failed')}${td(String(project.testFailed), project.testFailed > 0 ? 'color:#c0392b;font-weight:bold' : '')}</tr>
  <tr>${td('Blocked', `background-color:${S.altRowBg}`)}${td(String(project.testBlocked), `background-color:${S.altRowBg}`)}</tr>
  <tr>${td('TBD')}${td(String(project.testTBD))}</tr>
</table>

${sectionHeader('Outstanding Items')}
${project.milestones.filter(m => m.status !== 'Complete').length > 0 ?
  '<ul style="margin:4px 0">' + project.milestones.filter(m => m.status !== 'Complete').map(m =>
    `<li style="font-family:${S.font}; font-size:13px">${m.name} — ${m.status} (target: ${m.date || 'TBD'})</li>`
  ).join('') + '</ul>' :
  `<p style="font-family:${S.font}; font-size:13px; color:#27ae60">All milestones completed!</p>`
}

<p style="font-family:${S.font}; font-size:13px; margin:20px 0 4px 0">Please let us know if you have any questions or more information is required.</p>
<p style="font-family:${S.font}; font-size:13px; margin:4px 0">Best regards,<br/>SAP Project Management Team</p>
`.trim();
}

// ═══════════════════════════════════════════════════════════════
// Template registry
// ═══════════════════════════════════════════════════════════════
export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  scope: 'single' | 'multi' | 'both';
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: 'weekly-status',
    name: 'Weekly Status Update',
    description: 'Per-project status with milestones table, current/next week items — matches Outlook email standard',
    scope: 'single',
  },
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'Portfolio overview of all projects with RAG status, deployment %, tests, and go-live dates',
    scope: 'multi',
  },
  {
    id: 'golive-readiness',
    name: 'Go-Live Readiness',
    description: 'Per-project readiness checklist with test summary and outstanding items',
    scope: 'single',
  },
  {
    id: 'steering-committee',
    name: 'Steering Committee Deck',
    description: 'Executive steering committee summary with cross-portfolio RAG, budget/timeline/resource highlights, key decisions needed',
    scope: 'multi',
  },
];

export function getEmailSubject(template: string, project: ProjectData | null, data: ReportData): string {
  const label = project ? project.name : 'Portfolio';
  switch (template) {
    case 'weekly-status':
      return `Weekly Status Update - ${label} - ${data.weekLabel}`;
    case 'executive-summary':
      return `Weekly Portfolio Status - ${data.weekLabel}`;
    case 'golive-readiness':
      return `Go-Live Readiness - ${label} - ${data.date}`;
    case 'steering-committee':
      return `Steering Committee Update - ${data.weekLabel}`;
    default:
      return `Project Status Update - ${data.weekLabel}`;
  }
}

// ═══════════════════════════════════════════════════════════════
// Steering Committee Template
// ═══════════════════════════════════════════════════════════════
export function steeringCommitteeTemplate(data: ReportData): string {
  const projects = data.projects;
  const red = projects.filter(p => p.overallRAG === 'RED');
  const amber = projects.filter(p => p.overallRAG === 'AMBER');
  const green = projects.filter(p => p.overallRAG === 'GREEN');

  return `
<div style="font-family:${S.font}; max-width:800px; margin:0 auto">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e; padding:16px 24px; border-radius:4px 4px 0 0">
    <tr>
      <td><span style="font-size:18px; color:#fff; font-weight:bold; font-family:${S.font}">📊 Steering Committee Update</span></td>
      <td align="right"><span style="font-size:12px; color:#ccc; font-family:${S.font}">${data.weekLabel} | ${data.date}</span></td>
    </tr>
  </table>

  ${sectionHeader('Portfolio Health at a Glance')}
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:16px">
    <tr>
      <td style="padding:12px; text-align:center; background:${S.redBg}; border:1px solid ${S.borderColor}; width:33%">
        <span style="font-size:24px; font-weight:bold; color:#c0392b; font-family:${S.font}">${red.length}</span><br/>
        <span style="font-size:12px; color:#c0392b; font-family:${S.font}">Critical</span>
      </td>
      <td style="padding:12px; text-align:center; background:${S.amberBg}; border:1px solid ${S.borderColor}; width:33%">
        <span style="font-size:24px; font-weight:bold; color:#e67e22; font-family:${S.font}">${amber.length}</span><br/>
        <span style="font-size:12px; color:#e67e22; font-family:${S.font}">At Risk</span>
      </td>
      <td style="padding:12px; text-align:center; background:${S.greenBg}; border:1px solid ${S.borderColor}; width:33%">
        <span style="font-size:24px; font-weight:bold; color:#27ae60; font-family:${S.font}">${green.length}</span><br/>
        <span style="font-size:12px; color:#27ae60; font-family:${S.font}">On Track</span>
      </td>
    </tr>
  </table>

  ${red.length > 0 ? `
  ${sectionHeader('🔴 Critical Items — Action Required')}
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:16px">
    <tr>${th('Project')} ${th('Type')} ${th('Phase')} ${th('Deploy %')} ${th('Go-Live')} ${th('Owner')}</tr>
    ${red.map(p => `<tr style="background:${S.redBg}">
      ${td(`<strong>${p.name}</strong>`)} ${td(p.type)} ${td(p.currentPhase)} ${td(`${p.deploymentPct}%`)} ${td(p.goLiveDate || 'TBD')} ${td(p.businessOwner || 'TBD')}
    </tr>`).join('')}
  </table>` : ''}

  ${amber.length > 0 ? `
  ${sectionHeader('🟡 At Risk — Monitoring')}
  <ul style="font-family:${S.font}; font-size:13px">${amber.map(p => `<li><strong>${p.name}</strong> (${p.type}) — ${p.currentPhase}, ${p.deploymentPct}% deployed, Go-Live: ${p.goLiveDate || 'TBD'}</li>`).join('')}</ul>` : ''}

  ${sectionHeader('Key Metrics')}
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:16px">
    <tr>
      <td style="padding:8px 12px; border:1px solid ${S.borderColor}; font-family:${S.font}; font-size:13px"><strong>Total Active Projects</strong></td>
      <td style="padding:8px 12px; border:1px solid ${S.borderColor}; font-family:${S.font}; font-size:13px; text-align:center">${data.activeProjectCount}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px; border:1px solid ${S.borderColor}; font-family:${S.font}; font-size:13px"><strong>Upcoming Go-Lives (14 days)</strong></td>
      <td style="padding:8px 12px; border:1px solid ${S.borderColor}; font-family:${S.font}; font-size:13px; text-align:center">${data.upcomingGoLives.length}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px; border:1px solid ${S.borderColor}; font-family:${S.font}; font-size:13px"><strong>Overdue Milestones</strong></td>
      <td style="padding:8px 12px; border:1px solid ${S.borderColor}; font-family:${S.font}; font-size:13px; text-align:center">${data.overdueCount}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px; border:1px solid ${S.borderColor}; font-family:${S.font}; font-size:13px"><strong>Completed This Week</strong></td>
      <td style="padding:8px 12px; border:1px solid ${S.borderColor}; font-family:${S.font}; font-size:13px; text-align:center">${data.completedThisWeek.length}</td>
    </tr>
  </table>

  ${data.upcomingGoLives.length > 0 ? `
  ${sectionHeader('Upcoming Go-Live Dates')}
  <ul style="font-family:${S.font}; font-size:13px">${data.upcomingGoLives.map(g => `<li><strong>${g.name}</strong> — ${g.goLiveDate} (${g.daysUntil} days) — Lead: ${g.lead}</li>`).join('')}</ul>` : ''}

  <p style="font-family:${S.font}; font-size:11px; color:#999; margin-top:24px; border-top:1px solid #eee; padding-top:8px">
    Generated by Project Command Center | ${data.generatedAt}
  </p>
</div>`;
}
