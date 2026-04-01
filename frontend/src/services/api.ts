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

  // Fetch CSRF token for mutations
  if (options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
    try {
      const csrfRes = await fetch(url, { method: 'HEAD', headers: { 'X-CSRF-Token': 'Fetch' } });
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

  return response.json();
}

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
};

// ─── Milestones ───
export const milestoneApi = {
  getAll: () => request<{ value: any[] }>('/Milestones'),
  update: (id: string, data: any) =>
    request<any>(`/Milestones(${id})`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── Dashboard ───
export const dashboardApi = {
  getSummary: () => request<any>('/dashboardSummary'),
  getPipeline: () => request<any>('/pipelineSummary'),
  getHealth: () => request<any>('/health'),
};

// ─── SharePoint Sync ───
export const syncApi = {
  refreshSharePoint: () =>
    request<any>('/refreshSharePointData', { method: 'POST' }),
  getLogs: () => request<{ value: any[] }>('/SyncLogs?$orderby=startedAt desc&$top=20'),
};

// ─── Reports ───
export const reportApi = {
  generate: (useAI: boolean = false) =>
    request<any>('/generateWeeklyReport', {
      method: 'POST',
      body: JSON.stringify({ useAI }),
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
  getMethodologies: () =>
    request<{ value: any[] }>('/getMethodologies'),
};

// ─── Notifications ───
export const notificationApi = {
  getAll: () => request<{ value: any[] }>('/Notifications?$orderby=createdAt desc&$top=50'),
  markRead: (id: string) =>
    request<any>(`/Notifications(${id})`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
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
