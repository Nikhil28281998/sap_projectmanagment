/**
 * TR Description Parser
 * Parses SAP TR descriptions per the naming convention:
 *   {PREFIX}-{SNOW_TICKET} | {Description}
 * 
 * Regex: ^(PRJ|ENH|BRK|UPG|SUP|HYP)-(INC|CHG)\d{7}\s*\|\s*(.+)$
 */

const TR_REGEX = /^(PRJ|ENH|BRK|UPG|SUP|HYP)-(INC|CHG)(\d{7})\s*\|\s*(.+)$/;
const SNOW_REGEX = /(INC|CHG)(\d{7})/;

const WORK_TYPE_MAP = {
  PRJ: 'Project',
  ENH: 'Enhancement',
  BRK: 'Break-fix',
  UPG: 'Upgrade',
  SUP: 'Support',
  HYP: 'Hypercare'
};

/**
 * Parse a TR description string.
 * @param {string} description - The AS4TEXT from E07T
 * @returns {{ workType: string|null, workTypeCode: string|null, snowTicket: string|null, snowType: string|null, description: string }}
 */
function parseTRDescription(description) {
  if (!description || typeof description !== 'string') {
    return { workType: null, workTypeCode: null, snowTicket: null, snowType: null, description: '' };
  }

  const trimmed = description.trim();

  // Try full-format match: PRJ-CHG0098765 | description
  const fullMatch = trimmed.match(TR_REGEX);
  if (fullMatch) {
    return {
      workType: WORK_TYPE_MAP[fullMatch[1]] || null,
      workTypeCode: fullMatch[1],
      snowTicket: `${fullMatch[2]}${fullMatch[3]}`,
      snowType: fullMatch[2],
      description: fullMatch[4].trim()
    };
  }

  // Try to extract SNOW ticket from anywhere in the text
  const snowMatch = trimmed.match(SNOW_REGEX);
  const snowTicket = snowMatch ? `${snowMatch[1]}${snowMatch[2]}` : null;
  const snowType = snowMatch ? snowMatch[1] : null;

  // Try to infer work type from SNOW ticket type
  let workType = null;
  let workTypeCode = null;
  if (snowType === 'INC') {
    workType = 'Break-fix'; // INC often = break-fix
    workTypeCode = 'BRK';
  }

  // Clean description (remove snow ticket if embedded)
  let cleanDesc = trimmed;
  if (snowMatch) {
    cleanDesc = trimmed.replace(SNOW_REGEX, '').replace(/^\s*[-|]\s*/, '').replace(/\s*[-|]\s*$/, '').trim();
  }

  return {
    workType,
    workTypeCode,
    snowTicket,
    snowType,
    description: cleanDesc || trimmed
  };
}

/**
 * Suggest work type based on description keywords.
 * Used in Phase B (auto-suggestion before prefix convention is adopted).
 */
function suggestWorkType(description) {
  if (!description) return null;
  const lower = description.toLowerCase();

  const rules = [
    { keywords: ['fix', 'error', 'issue', 'bug', 'incorrect', 'wrong', 'fail'], type: 'BRK' },
    { keywords: ['upgrade', 'note', 'patch', 'fps', 'sp ', 'support pack'], type: 'UPG' },
    { keywords: ['hypercare', 'post go-live', 'post-go-live', 'stabilization'], type: 'HYP' },
    { keywords: ['retailer', 'edi ', 'asn', 'partner'], type: 'SUP' },
    { keywords: ['project', 'phase', 'cutover', 'restructure', 'migration'], type: 'PRJ' },
    { keywords: ['enhance', 'add ', 'new ', 'column', 'field', 'report'], type: 'ENH' }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return {
        suggestedType: rule.type,
        suggestedTypeName: WORK_TYPE_MAP[rule.type],
        confidence: 'LOW' // Keyword-based = low confidence
      };
    }
  }

  return null;
}

module.exports = { parseTRDescription, suggestWorkType, WORK_TYPE_MAP, TR_REGEX };
