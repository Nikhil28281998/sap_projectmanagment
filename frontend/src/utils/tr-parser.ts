/**
 * TR Description Parser — Client-side version
 * Mirrors server-side tr-parser.js for instant UI parsing
 */

const TR_REGEX = /^(PRJ|ENH|BRK|UPG|SUP|HYP)-(INC|CHG)(\d{7})\s*\|\s*(.+)$/;
const SNOW_REGEX = /(INC|CHG|RITM)(\d{7,})/;

export const WORK_TYPE_MAP: Record<string, string> = {
  Project: 'Project',
  Enhancement: 'Enhancement',
  'Break-fix': 'Break/Fix',
  Support: 'Support',
  Hypercare: 'Hypercare',
  Upgrade: 'Upgrade',
};

export const WORK_TYPE_COLORS: Record<string, string> = {
  Project: '#1890ff',
  Enhancement: '#52c41a',
  'Break-fix': '#ff4d4f',
  Support: '#722ed1',
  Hypercare: '#fa8c16',
  Upgrade: '#13c2c2',
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
 * Maps to actual CDS entity field names
 */
interface RAGInput {
  overallRAG?: string;
  status?: string;
  deploymentPct?: number;
  goLiveDate?: string | null;
}

/**
 * Calculate RAG status for a work item.
 * Uses the overallRAG field from the entity if available,
 * otherwise derives from deployment % and go-live proximity.
 */
export function calculateRAG(item: RAGInput): 'GREEN' | 'AMBER' | 'RED' {
  // Use the stored RAG if it exists
  if (item.overallRAG === 'RED' || item.overallRAG === 'AMBER' || item.overallRAG === 'GREEN') {
    return item.overallRAG;
  }

  if (item.status === 'Done' || item.status === 'Completed') return 'GREEN';

  const pct = item.deploymentPct ?? 0;

  if (item.goLiveDate) {
    const daysToGoLive = Math.ceil(
      (new Date(item.goLiveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysToGoLive <= 0 && pct < 100) return 'RED';
    if (daysToGoLive <= 7 && pct < 80) return 'RED';
    if (daysToGoLive <= 14 && pct < 60) return 'AMBER';
  }

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
