/**
 * TR Description Parser — Client-side version
 * Mirrors server-side tr-parser.js for instant UI parsing
 */

const TR_REGEX = /^(PRJ|ENH|BRK|UPG|SUP|HYP)-(INC|CHG)(\d{7})\s*\|\s*(.+)$/;
const SNOW_REGEX = /(INC|CHG|RITM)(\d{7,})/;

export const WORK_TYPE_MAP: Record<string, string> = {
  project: 'Project',
  enhancement: 'Enhancement',
  'break-fix': 'Break/Fix',
  general: 'General',
  basis: 'Basis',
  security: 'Security',
};

export const WORK_TYPE_COLORS: Record<string, string> = {
  project: '#1890ff',
  enhancement: '#52c41a',
  'break-fix': '#ff4d4f',
  general: '#722ed1',
  basis: '#fa8c16',
  security: '#13c2c2',
};

/** Keyword rules for suggesting a work type from TR description */
const SUGGESTION_RULES: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\b(hotfix|emergency|fix|incident|break|INC\d)/i, type: 'break-fix' },
  { pattern: /\b(project|implementation|phase|rollout|go.?live)\b/i, type: 'project' },
  { pattern: /\b(enhancement|enhance|improve|new report|optimize)\b/i, type: 'enhancement' },
  { pattern: /\b(kernel|patch|upgrade|support.?pack|basis|transport|note apply)\b/i, type: 'basis' },
  { pattern: /\b(role|authorization|auth|security|permission|SU01|PFCG)\b/i, type: 'security' },
];

export interface ParsedTR {
  workType: string | null;
  workTypeCode: string | null;
  snowTicket: string | null;
  snowType: string | null;
  suggestedType: string | null;
  description: string;
}

export function parseTRDescription(description: string | null | undefined): ParsedTR {
  if (!description) {
    return { workType: null, workTypeCode: null, snowTicket: null, snowType: null, suggestedType: null, description: '' };
  }

  const trimmed = description.trim();

  // Full prefix match
  const fullMatch = trimmed.match(TR_REGEX);
  const snowMatch = trimmed.match(SNOW_REGEX);
  const suggested = suggestWorkType(trimmed);

  if (fullMatch) {
    return {
      workType: fullMatch[1] || null,
      workTypeCode: fullMatch[1],
      snowTicket: `${fullMatch[2]}${fullMatch[3]}`,
      snowType: fullMatch[2],
      suggestedType: suggested,
      description: fullMatch[4].trim(),
    };
  }

  return {
    workType: null,
    workTypeCode: null,
    snowTicket: snowMatch ? `${snowMatch[1]}${snowMatch[2]}` : null,
    snowType: snowMatch ? snowMatch[1] : null,
    suggestedType: suggested,
    description: trimmed,
  };
}

function suggestWorkType(text: string): string | null {
  for (const rule of SUGGESTION_RULES) {
    if (rule.pattern.test(text)) return rule.type;
  }
  return null;
}

/**
 * Work item shape accepted by calculateRAG
 */
interface RAGInput {
  functionalStatus?: string;
  failedImports?: number;
  stuckTransports?: number;
  totalTransports?: number;
  transportsProd?: number;
  goLiveDate?: string | null;
}

/**
 * Calculate RAG status for a work item based on transport data
 */
export function calculateRAG(item: RAGInput): 'GREEN' | 'AMBER' | 'RED' {
  if (item.functionalStatus === 'Completed') return 'GREEN';
  if ((item.failedImports ?? 0) > 0) return 'RED';

  const total = item.totalTransports ?? 0;
  const prod = item.transportsProd ?? 0;
  const pct = total > 0 ? (prod / total) * 100 : 100;

  if (item.goLiveDate) {
    const daysToGoLive = Math.ceil(
      (new Date(item.goLiveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysToGoLive <= 0 && pct < 100) return 'RED';
    if (daysToGoLive <= 7 && pct < 80) return 'RED';
    if (daysToGoLive <= 14 && pct < 60) return 'AMBER';
  }

  if ((item.stuckTransports ?? 0) > 0) return 'AMBER';
  return 'GREEN';
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date | string, date2: Date | string): number {
  return Math.round(
    Math.abs(new Date(date2).getTime() - new Date(date1).getTime()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Days from now — returns a number (positive = future, negative = past)
 */
export function daysFromNow(date: Date | string): number {
  return Math.ceil(
    (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
}
