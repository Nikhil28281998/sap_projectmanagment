/**
 * API Service — Centralized HTTP client for CAP backend
 * All calls go through /api/v1/transport/ (proxied in dev, App Router in prod)
 */

const BASE_URL = '/api/v1/transport';

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
  getAll: () => request<{ value: any[] }>('/Transports'),
  getById: (id: string) => request<any>(`/Transports(${id})`),
  categorize: (trNumber: string, workType: string, workItemId?: string) =>
    request<any>('/categorizeTransport', {
      method: 'POST',
      body: JSON.stringify({ trNumber, workType, workItemId }),
    }),
  bulkCategorize: (items: { trNumber: string; workType: string; workItemId?: string }[]) =>
    request<any>('/bulkCategorize', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  updateVeevaCC: (trNumber: string, veevaCCNumber: string) =>
    request<any>('/updateVeevaCC', {
      method: 'POST',
      body: JSON.stringify({ trNumber, veevaCCNumber }),
    }),
  refreshData: () =>
    request<any>('/refreshTransportData', { method: 'POST' }),
};

// ─── Work Items ───
export const workItemApi = {
  getAll: () => request<{ value: any[] }>('/WorkItems'),
  getById: (id: string) => request<any>(`/WorkItems(${id})?$expand=transports,milestones`),
  create: (data: any) =>
    request<any>('/WorkItems', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/WorkItems(${id})`, { method: 'PATCH', body: JSON.stringify(data) }),
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
  getAll: () => request<{ value: any[] }>('/Milestones'),
  create: (data: any) =>
    request<any>('/Milestones', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<any>(`/Milestones(${id})`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<any>(`/Milestones(${id})`, { method: 'DELETE' }),
};

// ─── Dashboard ───
export const dashboardApi = {
  getSummary: (application?: string) => request<any>(`/dashboardSummary${application ? `(application='${application}')` : '()'}`),
  getPipeline: (application?: string) => request<any>(`/pipelineSummary${application ? `(application='${application}')` : '()'}`),
  getHealth: () => request<any>('/health'),
};

// ─── Auto-Detection ───
export const autoApi = {
  detectPhase: (workItemId: string) =>
    request<{ success: boolean; phase: string; message: string }>('/autoDetectPhase', {
      method: 'POST',
      body: JSON.stringify({ workItemId }),
    }),
  linkTickets: () =>
    request<{ success: boolean; linked: number; message: string }>('/autoLinkTickets', {
      method: 'POST',
    }),
};

// ─── SharePoint Sync ───
export const syncApi = {
  refreshSharePoint: () =>
    request<any>('/refreshSharePointData', { method: 'POST' }),
  getLogs: () => request<{ value: any[] }>('/SyncLogs?$orderby=startedAt desc&$top=20'),
};

// ─── Reports ───
export const reportApi = {
  generate: (workItemId?: string) =>
    request<any>('/generateWeeklyReport', {
      method: 'POST',
      body: JSON.stringify({ workItemId: workItemId || null }),
    }),
};

// ─── Test Status ───
export const testStatusApi = {
  update: (workItemId: string, data: {
    testTotal: number; testPassed: number; testFailed: number;
    testBlocked: number; testTBD: number; testSkipped: number;
  }) =>
    request<any>('/updateTestStatus', {
      method: 'POST',
      body: JSON.stringify({ workItemId, ...data }),
    }),
};

// ─── AI Agent ───
export const aiApi = {
  testConnection: () =>
    request<{ success: boolean; message: string; provider: string }>('/testAIConnection', { method: 'POST' }),
  saveConfig: (provider: string, apiKey: string) =>
    request<{ success: boolean; message: string }>('/saveAIConfig', {
      method: 'POST',
      body: JSON.stringify({ provider, apiKey }),
    }),
  chat: (question: string) =>
    request<{ success: boolean; answer: string; provider: string }>('/chatWithAgent', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
  analyzeDocument: (content: string, documentType: string, application: string, fileName: string) =>
    request<{ success: boolean; proposals: string; summary: string; provider: string }>('/analyzeDocument', {
      method: 'POST',
      body: JSON.stringify({ content, documentType, application, fileName }),
    }),
  createFromProposal: (proposals: string, application: string) =>
    request<{ success: boolean; created: number; message: string }>('/createFromProposal', {
      method: 'POST',
      body: JSON.stringify({ proposals, application }),
    }),
  generateTemplate: (emailContent: string, templateName: string, scope: string) =>
    request<{ success: boolean; templateHtml: string; message: string; provider: string }>('/generateTemplateFromEmail', {
      method: 'POST',
      body: JSON.stringify({ emailContent, templateName, scope }),
    }),
  refineProposals: (proposals: string, instruction: string, application: string) =>
    request<{ success: boolean; proposals: string; message: string; provider: string }>('/refineProposals', {
      method: 'POST',
      body: JSON.stringify({ proposals, instruction, application }),
    }),
};

// ─── Methodologies ───
export const methodologyApi = {
  getAll: () => request<{ value: any[] }>('/getMethodologies'),
};

// ─── Notifications ───
export const notificationApi = {
  getAll: () => request<{ value: any[] }>('/Notifications?$orderby=createdAt desc&$top=50'),
  markRead: (id: string) =>
    request<any>(`/Notifications(${id})`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    }),
  generate: () =>
    request<{ success: boolean; generated: number; message: string }>('/generateNotifications', { method: 'POST' }),
  analyzeRisks: (application: string) =>
    request<{ success: boolean; risks: string; generated: number; message: string; provider: string }>('/analyzeProjectRisks', {
      method: 'POST',
      body: JSON.stringify({ application }),
    }),
};

// ─── SharePoint Live Integration ───
export const sharePointApi = {
  configure: (data: { tenantId: string; clientId: string; clientSecret: string; siteUrl: string; driveId: string }) =>
    request<{ success: boolean; message: string }>('/configureSharePoint', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  listDocuments: (folderPath?: string) =>
    request<{ success: boolean; documents: string; message: string }>('/listSharePointDocuments', {
      method: 'POST',
      body: JSON.stringify({ folderPath: folderPath || '' }),
    }),
  fetchDocument: (documentId: string, fileName: string) =>
    request<{ success: boolean; content: string; fileName: string; message: string }>('/fetchSharePointDocument', {
      method: 'POST',
      body: JSON.stringify({ documentId, fileName }),
    }),
};

// ─── Weekly Digest ───
export const digestApi = {
  generate: (application: string) =>
    request<{ success: boolean; digestId: string; digestHtml: string; message: string; provider: string }>('/generateWeeklyDigest', {
      method: 'POST',
      body: JSON.stringify({ application }),
    }),
  getAll: () => request<{ value: any[] }>('/Digests?$orderby=createdAt desc&$top=20'),
};

// ─── Report Templates ───
export const templateApi = {
  getAll: () => request<{ value: any[] }>('/ReportTemplates?$orderby=createdAt desc'),
  getPublic: () => request<{ value: any[] }>("/ReportTemplates?$filter=visibility eq 'public'&$orderby=createdAt desc"),
  save: (data: {
    id?: string; templateName: string; description: string;
    templateHtml: string; scope: string; visibility: string; isDefault: boolean;
  }) =>
    request<{ success: boolean; templateId: string; message: string }>('/saveReportTemplate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean; message: string }>('/deleteReportTemplate', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
};

// ─── Config ───
export const configApi = {
  getAll: () => request<{ value: any[] }>('/AppConfigs'),
  update: (key: string, value: string) =>
    request<any>(`/AppConfigs('${key}')`, {
      method: 'PATCH',
      body: JSON.stringify({ configValue: value }),
    }),
};
