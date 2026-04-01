/**
 * Excel Export — Generate .xlsx files from report data using SheetJS
 */
import * as XLSX from 'xlsx';
import type { ReportData, ProjectData } from './report-templates';

/**
 * Export single-project report to Excel
 */
export function exportSingleProjectExcel(data: ReportData, project: ProjectData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Project Overview
  const overview = [
    ['Project Overview'],
    ['Project Name', project.name],
    ['Project Code', project.projectCode || 'N/A'],
    ['SAP Module', project.sapModule],
    ['SAP Owner', project.sapOwner],
    ['Business Owner', project.businessOwner],
    ['Functional Lead', project.functionalLead],
    ['QA Lead', project.qaLead],
    ['Go-Live Target', project.goLiveDate],
    ['Overall Status', project.overallRAG],
    ['Current Phase', project.currentPhase],
    ['Deployment %', `${project.deploymentPct}%`],
    [],
    ['Transport Summary'],
    ['Total', project.totalTRs],
    ['DEV', project.trsDEV],
    ['QAS', project.trsQAS],
    ['PRD', project.trsPRD],
    ['Stuck (>5 days)', project.stuckCount],
    ['Failed Imports', project.failedCount],
    [],
    ['Test Summary'],
    ['Total Test Cases', project.testTotal],
    ['Passed', project.testPassed],
    ['Failed', project.testFailed],
    ['Blocked', project.testBlocked],
    ['TBD', project.testTBD],
    ['Skipped', project.testSkipped],
    ['Completion %', `${project.testCompletionPct}%`],
    ['UAT Status', project.uatStatus],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(overview);
  ws1['!cols'] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Overview');

  // Sheet 2: Milestones
  const msHeader = ['Milestone', 'SAP Area', 'Planned Date', 'Status', 'Owner', 'Comments'];
  const msRows = project.milestones
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(m => [m.name, project.sapModule, m.date || 'TBD', m.status, project.sapOwner, m.evidence || 'N/A']);
  const ws2 = XLSX.utils.aoa_to_sheet([msHeader, ...msRows]);
  ws2['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Milestones');

  const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${data.date}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Export all-projects portfolio report to Excel
 */
export function exportAllProjectsExcel(data: ReportData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Portfolio Summary
  const header = [
    'Project Name', 'Module', 'Status', 'Phase', 'Deploy %', 'Go-Live',
    'SAP Owner', 'Business Owner', 'Total TRs', 'DEV', 'QAS', 'PRD',
    'Stuck', 'Failed', 'Tests Total', 'Passed', 'Failed', 'UAT Status',
  ];
  const rows = data.projects.map(p => [
    p.name, p.sapModule, p.overallRAG, p.currentPhase, `${p.deploymentPct}%`, p.goLiveDate,
    p.sapOwner, p.businessOwner, p.totalTRs, p.trsDEV, p.trsQAS, p.trsPRD,
    p.stuckCount, p.failedCount, p.testTotal, p.testPassed, p.testFailed, p.uatStatus,
  ]);
  const ws1 = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws1['!cols'] = header.map(h => ({ wch: Math.max(h.length + 2, 14) }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Portfolio');

  // Sheet 2: All Milestones
  const msHeader = ['Project', 'Milestone', 'SAP Area', 'Planned Date', 'Status', 'Owner', 'Comments'];
  const msRows: any[][] = [];
  for (const p of data.projects) {
    for (const m of p.milestones.sort((a, b) => (a.order || 0) - (b.order || 0))) {
      msRows.push([p.name, m.name, p.sapModule, m.date || 'TBD', m.status, p.sapOwner, m.evidence || 'N/A']);
    }
  }
  const ws2 = XLSX.utils.aoa_to_sheet([msHeader, ...msRows]);
  ws2['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'All Milestones');

  // Sheet 3: Risks & Alerts
  const riskHeader = ['Category', 'Detail', 'Count'];
  const riskRows: any[][] = [];
  if (data.stuckCount > 0) riskRows.push(['Stuck Transports', 'In non-PRD > 5 days', data.stuckCount]);
  if (data.failedCount > 0) riskRows.push(['Failed Imports', 'RC >= 8', data.failedCount]);
  if (data.overdueCount > 0) riskRows.push(['Overdue Milestones', 'Past deadline', data.overdueCount]);
  if (data.unassignedCount > 0) riskRows.push(['Unassigned TRs', 'Not categorized', data.unassignedCount]);
  const ws3 = XLSX.utils.aoa_to_sheet([riskHeader, ...riskRows]);
  ws3['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Risks');

  const filename = `SAP_Portfolio_Report_${data.date}.xlsx`;
  XLSX.writeFile(wb, filename);
}
