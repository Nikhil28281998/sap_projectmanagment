/**
 * API Service — Centralized HTTP client for CAP backend
 * All calls go through /api/v1/transport/ (proxied in dev, App Router in prod)
 */

import type {
  Transport, WorkItem, Milestone, Risk, ActionItem, ProgressSnapshot,
  Notification, SyncLog, AppConfig,
  ReportTemplate, WeeklyDigest, DashboardSummary, PipelineSummary, HealthStatus,
  ActionResult, BulkCategorizeResult, RefreshResult, TestStatusResult,
  AIChatResult, AIAnalyzeResult, AITemplateResult, AIDigestResult, AIRiskResult,
  CreateWorkItemResult, AutoDetectResult, AutoLinkResult,
  ODataResponse,
} from '../types';

const BASE_URL = '/api/v1/transport';

// Build an OData query string from common params
function buildODataQuery(params: {
  top?: number; skip?: number; filter?: string;
  orderby?: string; expand?: string; count?: boolean;
}): string {
  const parts: string[] = [];
  if (params.top    != null) parts.push(`$top=${params.top}`);
  if (params.skip   != null) parts.push(`$skip=${params.skip}`);
  if (params.count)          parts.push('$count=true');
  if (params.filter)         parts.push(`$filter=${encodeURIComponent(params.filter)}`);
  if (params.orderby)        parts.push(`$orderby=${encodeURIComponent(params.orderby)}`);
  if (params.expand)         parts.push(`$expand=${params.expand}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // Fetch CSRF token for mutations (use GET — CAP rejects HEAD with 405)
  if (options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
    try {
      const csrfRes = await fetch(`${BASE_URL}/`, { method: 'GET', headers: { 'X-CSRF-Token': 'Fetch' } });
      const token = csrfRes.headers.get('x-csrf-token');
      if (token) headers['X-CSRF-Token'] = token;
    } catch {
      // Non-critical in dev mode
    }
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error?.error?.message || `API Error: ${response.status}`);
  }

  // Handle 204 No Content (DELETE responses)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }

  return response.json();
}

// ─── User / Auth ───
export const userApi = {
  me: () => request<{
    email: string; name: string; roles: string[];
    isAdmin: boolean; isManager: boolean; isDeveloper: boolean; isExecutive: boolean;
    isSuperAdmin: boolean; allowedApps: string[];
  }>('/currentUser'),
};

// ─── Transports ───
export const transportApi = {
  getAll: (params?: { top?: number; skip?: number; filter?: string }) => {
    const qs = buildODataQuery({ top: params?.top ?? 2000, skip: params?.skip, filter: params?.filter, count: true });
    return request<ODataResponse<Transport> & { '@odata.count'?: number }>(`/Transports${qs}`);
  },
  getById: (id: string) => request<Transport>(`/Transports(${id})`),
  categorize: (trNumber: string, workType: string, workItemId?: string) =>
    request<ActionResult>('/categorizeTransport', {
      method: 'POST',
      body: JSON.stringify({ trNumber, workType, workItemId }),
    }),
  bulkCategorize: (items: { trNumber: string; workType: string; workItemId?: string }[]) =>
    request<BulkCategorizeResult>('/bulkCategorize', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  updateVeevaCC: (trNumber: string, veevaCCNumber: string) =>
    request<ActionResult>('/updateVeevaCC', {
      method: 'POST',
      body: JSON.stringify({ trNumber, veevaCCNumber }),
    }),
  refreshData: () =>
    request<RefreshResult>('/refreshTransportData', { method: 'POST' }),
};

// ─── Work Items ───
export const workItemApi = {
  getAll: (params?: { top?: number; skip?: number; filter?: string }) => {
    const qs = buildODataQuery({ top: params?.top ?? 500, skip: params?.skip, filter: params?.filter, count: true });
    return request<ODataResponse<WorkItem> & { '@odata.count'?: number }>(`/WorkItems${qs}`);
  },
  getById: (id: string) => request<WorkItem>(`/WorkItems(${id})?$expand=transports,milestones,risks,actionItems,progressSnapshots`),
  create: (data: Partial<WorkItem>) =>
    request<WorkItem>('/WorkItems', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<WorkItem>) =>
    request<WorkItem>(`/WorkItems(${id})`, { method: 'PATCH', body: JSON.stringify(data) }),
  createWorkItem: (data: {
    workItemName: string; projectCode?: string; workItemType?: string;
    application?: string; priority?: string; complexity?: string;
    currentPhase?: string; businessOwner?: string; goLiveDate?: string; notes?: string;
  }) =>
    request<{ success: boolean; workItemId: string; message: string }>('/createWorkItem', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteWorkItem: (workItemId: string) =>
    request<{ success: boolean; message: string }>('/deleteWorkItem', {
      method: 'POST',
      body: JSON.stringify({ workItemId }),
    }),
  changeStatus: (workItemId: string, status: string) =>
    request<{ success: boolean; message: string }>('/changeWorkItemStatus', {
      method: 'POST',
      body: JSON.stringify({ workItemId, status }),
    }),
};

// ─── Milestones ───
export const milestoneApi = {
  getAll: () => request<ODataResponse<Milestone>>('/Milestones'),
  create: (data: Partial<Milestone>) =>
    request<Milestone>('/Milestones', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Milestone>) =>
    request<Milestone>(`/Milestones(${id})`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<ActionResult>(`/Milestones(${id})`, { method: 'DELETE' }),
};

// ─── Dashboard ───
export const dashboardApi = {
  getSummary: (application?: string) => request<DashboardSummary>(`/dashboardSummary${application ? `(application='${application}')` : '()'}`),
  getPipeline: (application?: string) => request<PipelineSummary>(`/pipelineSummary${application ? `(application='${application}')` : '()'}`),
  getHealth: () => request<HealthStatus>('/health'),
};

// ─── Auto-Detection ───
export const autoApi = {
  detectPhase: (workItemId: string) =>
    request<AutoDetectResult>('/autoDetectPhase', {
      method: 'POST',
      body: JSON.stringify({ workItemId }),
    }),
  linkTickets: () =>
    request<AutoLinkResult>('/autoLinkTickets', { method: 'POST' }),
};

// ─── SharePoint Sync ───
export const syncApi = {
  refreshSharePoint: () =>
    request<RefreshResult>('/refreshSharePointData', { method: 'POST' }),
  getLogs: () => request<ODataResponse<SyncLog>>('/SyncLogs?$orderby=startedAt desc&$top=20'),
};

// ─── Reports ───
export const reportApi = {
  generate: (workItemId?: string) =>
    request<{ success: boolean; data: string | null; message: string }>('/generateWeeklyReport', {
      method: 'POST',
      body: JSON.stringify({ workItemId: workItemId || null }),
    }),

  // Send a report HTML as an email via Microsoft Graph API (or mock in dev)
  sendEmail: (params: {
    htmlBody: string;
    subject: string;
    toRecipients: string[];  // email addresses
    ccRecipients?: string[];
  }) =>
    request<ActionResult & { messageId: string }>('/sendReport', {
      method: 'POST',
      body: JSON.stringify({
        htmlBody: params.htmlBody,
        subject: params.subject,
        toRecipients: JSON.stringify(params.toRecipients),
        ccRecipients: JSON.stringify(params.ccRecipients || []),
      }),
    }),
};

// ─── GDPR ───
export const gdprApi = {
  purgeActivityLog: (retentionDays = 90) =>
    request<ActionResult & { deleted: number }>('/purgeActivityLog', {
      method: 'POST',
      body: JSON.stringify({ retentionDays }),
    }),
};

// ─── Test Status ───
export const testStatusApi = {
  update: (workItemId: string, data: {
    testTotal: number; testPassed: number; testFailed: number;
    testBlocked: number; testTBD: number; testSkipped: number;
  }) =>
    request<TestStatusResult>('/updateTestStatus', {
      method: 'POST',
      body: JSON.stringify({ workItemId, ...data }),
    }),
};

// ─── AI Agent ───
export const aiApi = {
  testConnection: () =>
    request<ActionResult & { provider: string }>('/testAIConnection', { method: 'POST' }),
  saveConfig: (provider: string, apiKey: string) =>
    request<ActionResult>('/saveAIConfig', {
      method: 'POST',
      body: JSON.stringify({ provider, apiKey }),
    }),
  chat: (question: string) =>
    request<AIChatResult>('/chatWithAgent', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
  analyzeDocument: (content: string, documentType: string, application: string, fileName: string) =>
    request<AIAnalyzeResult>('/analyzeDocument', {
      method: 'POST',
      body: JSON.stringify({ content, documentType, application, fileName }),
    }),
  createFromProposal: (proposals: string, application: string) =>
    request<ActionResult & { created: number }>('/createFromProposal', {
      method: 'POST',
      body: JSON.stringify({ proposals, application }),
    }),
  generateTemplate: (emailContent: string, templateName: string, scope: string) =>
    request<AITemplateResult>('/generateTemplateFromEmail', {
      method: 'POST',
      body: JSON.stringify({ emailContent, templateName, scope }),
    }),
  refineProposals: (proposals: string, instruction: string, application: string) =>
    request<AIAnalyzeResult>('/refineProposals', {
      method: 'POST',
      body: JSON.stringify({ proposals, instruction, application }),
    }),
};

// ─── Methodologies ───
export const methodologyApi = {
  getAll: () => request<ODataResponse<{ name: string; phases: string[]; description: string }>>('/getMethodologies'),
};

// ─── Notifications ───
export const notificationApi = {
  getAll: () => request<ODataResponse<Notification>>('/Notifications?$orderby=createdAt desc&$top=50'),
  markRead: (id: string) =>
    request<Notification>(`/Notifications(${id})`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    }),
  generate: () =>
    request<ActionResult & { generated: number }>('/generateNotifications', { method: 'POST' }),
  analyzeRisks: (application: string) =>
    request<AIRiskResult>('/analyzeProjectRisks', {
      method: 'POST',
      body: JSON.stringify({ application }),
    }),
};

// ─── SharePoint Live Integration ───
export const sharePointApi = {
  configure: (data: { tenantId: string; clientId: string; clientSecret: string; siteUrl: string; driveId: string }) =>
    request<ActionResult>('/configureSharePoint', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  listDocuments: (folderPath?: string) =>
    request<ActionResult & { documents: string }>('/listSharePointDocuments', {
      method: 'POST',
      body: JSON.stringify({ folderPath: folderPath || '' }),
    }),
  fetchDocument: (documentId: string, fileName: string) =>
    request<ActionResult & { content: string; fileName: string }>('/fetchSharePointDocument', {
      method: 'POST',
      body: JSON.stringify({ documentId, fileName }),
    }),
};

// ─── Weekly Digest ───
export const digestApi = {
  generate: (application: string) =>
    request<AIDigestResult>('/generateWeeklyDigest', {
      method: 'POST',
      body: JSON.stringify({ application }),
    }),
  getAll: () => request<ODataResponse<WeeklyDigest>>('/getWeeklyDigests'),
};

// ─── Report Templates ───
export const templateApi = {
  getAll: () => request<ODataResponse<ReportTemplate>>('/ReportTemplates?$orderby=createdAt desc'),
  getPublic: () => request<ODataResponse<ReportTemplate>>("/ReportTemplates?$filter=visibility eq 'public'&$orderby=createdAt desc"),
  save: (data: {
    id?: string; templateName: string; description: string;
    templateHtml: string; scope: string; visibility: string; isDefault: boolean;
  }) =>
    request<ActionResult & { templateId: string }>('/saveReportTemplate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<ActionResult>('/deleteReportTemplate', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
};

// ─── Risk Register ───
export const riskApi = {
  getByWorkItem: (workItemId: string) =>
    request<ODataResponse<Risk>>(`/Risks?$filter=workItem_ID eq '${workItemId}'&$orderby=riskScore desc`),
  create: (data: Partial<Risk>) =>
    request<Risk>('/Risks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Risk>) =>
    request<Risk>(`/Risks(${id})`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<void>(`/Risks(${id})`, { method: 'DELETE' }),
};

// ─── Action Items (Parking Lot) ───
export const actionItemApi = {
  getByWorkItem: (workItemId: string) =>
    request<ODataResponse<ActionItem>>(`/ActionItems?$filter=workItem_ID eq '${workItemId}'&$orderby=dueDate asc`),
  create: (data: Partial<ActionItem>) =>
    request<ActionItem>('/ActionItems', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ActionItem>) =>
    request<ActionItem>(`/ActionItems(${id})`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<void>(`/ActionItems(${id})`, { method: 'DELETE' }),
};

// ─── Progress Snapshots ───
export const snapshotApi = {
  getByWorkItem: (workItemId: string) =>
    request<ODataResponse<ProgressSnapshot>>(`/ProgressSnapshots?$filter=workItem_ID eq '${workItemId}'&$orderby=snapshotDate asc&$top=90`),
};

// ─── Config ───
export const configApi = {
  getAll: () => request<ODataResponse<AppConfig>>('/AppConfigs'),
  update: (key: string, value: string) =>
    request<AppConfig>(`/AppConfigs('${key}')`, {
      method: 'PATCH',
      body: JSON.stringify({ configValue: value }),
    }),
};
