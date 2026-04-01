import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transportApi, dashboardApi, workItemApi, syncApi, reportApi, notificationApi, templateApi, aiApi } from '../services/api';

// ─── Transport Queries ───
export function useTransports() {
  return useQuery({
    queryKey: ['transports'],
    queryFn: async () => {
      const res = await transportApi.getAll();
      return res.value || [];
    },
    staleTime: 5 * 60 * 1000,   // 5 min
    gcTime: 30 * 60 * 1000,     // 30 min cache
    refetchOnWindowFocus: true,
  });
}

// ─── Work Item Queries ───
export function useWorkItems() {
  return useQuery({
    queryKey: ['workItems'],
    queryFn: async () => {
      const res = await workItemApi.getAll();
      return res.value || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkItem(id: string) {
  return useQuery({
    queryKey: ['workItem', id],
    queryFn: () => workItemApi.getById(id),
    enabled: !!id,
  });
}

// ─── Dashboard Queries ───
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: dashboardApi.getSummary,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function usePipelineSummary() {
  return useQuery({
    queryKey: ['pipelineSummary'],
    queryFn: dashboardApi.getPipeline,
    staleTime: 2 * 60 * 1000,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: dashboardApi.getHealth,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}

// ─── Notifications ───
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await notificationApi.getAll();
      return res.value || [];
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

// ─── Mutations ───
export function useCategorizeTransport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ trNumber, workType, workItemId }: { trNumber: string; workType: string; workItemId?: string }) =>
      transportApi.categorize(trNumber, workType, workItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });
}

export function useBulkCategorize() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { trNumber: string; workType: string; workItemId?: string }[]) =>
      transportApi.bulkCategorize(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });
}

export function useRefreshTransports() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transportApi.refreshData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['pipelineSummary'] });
    },
  });
}

export function useRefreshSharePoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncApi.refreshSharePoint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
  });
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: ({ workItemId }: { workItemId?: string }) =>
      reportApi.generate(workItemId),
  });
}

// ─── Report Templates ───
export function useReportTemplates() {
  return useQuery({
    queryKey: ['reportTemplates'],
    queryFn: async () => {
      const res = await templateApi.getAll();
      return res.value || [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useSaveReportTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id?: string; templateName: string; description: string;
      templateHtml: string; scope: string; visibility: string; isDefault: boolean;
    }) => templateApi.save(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportTemplates'] });
    },
  });
}

export function useDeleteReportTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templateApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportTemplates'] });
    },
  });
}

export function useGenerateTemplateFromEmail() {
  return useMutation({
    mutationFn: ({ emailContent, templateName, scope }: {
      emailContent: string; templateName: string; scope: string;
    }) => aiApi.generateTemplate(emailContent, templateName, scope),
  });
}
