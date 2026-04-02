/**
 * Test Status Parser — Understands various status formats from SharePoint Excel
 * 
 * Real-world SharePoint trackers use inconsistent status values:
 *   Pass, PASS, Passed, P, Yes, ✓, Complete, Done
 *   Fail, FAIL, Failed, F, No, ✗, Error
 *   TBD, To Be Determined, Pending, Not Started, Blank, N/S
 *   Skip, Skipped, N/A, Not Applicable, Out of Scope, OOS
 *   Blocked, Block, On Hold, Waiting, Dependency
 *
 * This parser normalizes all variants into 5 categories:
 *   PASS | FAIL | TBD | SKIP | BLOCKED
 */

// ─── Status Normalization Map ───
const STATUS_PATTERNS = [
  { category: 'PASS',    patterns: /^(pass(ed)?|p|yes|y|✓|✔|complete(d)?|done|ok|success|approved)$/i },
  { category: 'FAIL',    patterns: /^(fail(ed)?|f|no|n|✗|✘|error|reject(ed)?|defect|bug)$/i },
  { category: 'BLOCKED', patterns: /^(block(ed)?|on\s*hold|wait(ing)?|depend(ency)?|stuck|deferred)$/i },
  { category: 'SKIP',    patterns: /^(skip(ped)?|n\/?a|not\s*applicable|out\s*of\s*scope|oos|excluded|de-?scoped|removed)$/i },
  { category: 'TBD',     patterns: /^(tbd|to\s*be\s*(determined|done|tested)|pending|not\s*started|n\/?s|open|in\s*progress|wip|new|ready|queued|)$/i },
];

/**
 * Normalize a single test status string to a standard category
 * @param {string} rawStatus - The status value from the Excel cell
 * @returns {'PASS'|'FAIL'|'TBD'|'SKIP'|'BLOCKED'} Normalized status
 */
function normalizeTestStatus(rawStatus) {
  if (rawStatus === null || rawStatus === undefined) return 'TBD';
  const trimmed = String(rawStatus).trim();
  if (trimmed === '') return 'TBD';

  for (const { category, patterns } of STATUS_PATTERNS) {
    if (patterns.test(trimmed)) return category;
  }

  // Unknown status → treat as TBD (safer than assuming pass/fail)
  console.warn(`Unknown test status: "${trimmed}" → treating as TBD`);
  return 'TBD';
}

/**
 * Parse an array of test status values and return summary counts
 * @param {string[]} statuses - Array of raw status strings from Excel
 * @returns {{ total, passed, failed, blocked, tbd, skipped, completionPct, uatStatus }}
 */
function parseTestStatuses(statuses) {
  const counts = { PASS: 0, FAIL: 0, TBD: 0, SKIP: 0, BLOCKED: 0 };

  for (const raw of statuses) {
    const normalized = normalizeTestStatus(raw);
    counts[normalized]++;
  }

  const total = statuses.length;
  const executed = counts.PASS + counts.FAIL; // Only definitively tested
  const completionPct = total > 0 ? Math.round((executed / total) * 10000) / 100 : 0;

  // Determine overall UAT status
  let uatStatus = 'Not Started';
  if (total === 0) {
    uatStatus = 'Not Started';
  } else if (counts.FAIL > 0) {
    uatStatus = 'Failed';
  } else if (counts.BLOCKED > 0 && counts.TBD === 0 && counts.FAIL === 0) {
    uatStatus = 'Blocked';
  } else if (counts.TBD === 0 && counts.BLOCKED === 0 && counts.FAIL === 0 && counts.PASS > 0) {
    uatStatus = 'Passed';
  } else if (counts.PASS > 0 || counts.FAIL > 0) {
    uatStatus = 'In Progress';
  } else {
    uatStatus = 'Not Started';
  }

  return {
    total,
    passed: counts.PASS,
    failed: counts.FAIL,
    blocked: counts.BLOCKED,
    tbd: counts.TBD,
    skipped: counts.SKIP,
    completionPct,
    uatStatus
  };
}

/**
 * Determine RAG impact from test results
 * Used to auto-adjust the work item's overallRAG
 * @param {{ total, passed, failed, blocked, tbd }} testSummary
 * @param {number} daysToGoLive - Days until go-live date
 * @returns {'GREEN'|'AMBER'|'RED'|null} RAG suggestion (null = no test impact)
 */
function testRAGImpact(testSummary, daysToGoLive) {
  const { total, failed, blocked, tbd } = testSummary;
  if (total === 0) return null; // No tests → no impact

  const failRate = failed / total;
  const tbdRate = tbd / total;
  const blockedRate = blocked / total;

  // RED conditions
  if (failRate > 0.10) return 'RED';                          // >10% failures
  if (tbdRate > 0.30 && daysToGoLive <= 14) return 'RED';   // >30% TBD within 2 weeks of go-live
  if (blockedRate > 0.20) return 'RED';                       // >20% blocked

  // AMBER conditions
  if (failRate > 0.05) return 'AMBER';                        // >5% failures
  if (tbdRate > 0.50 && daysToGoLive <= 30) return 'AMBER'; // >50% TBD within 1 month
  if (blockedRate > 0.10) return 'AMBER';                     // >10% blocked

  return 'GREEN';
}

// ─── Methodology Templates ───
// Different projects follow different stage-gate structures.
// These templates define the expected phases and their typical milestones.

const METHODOLOGY_TEMPLATES = {
  Waterfall: {
    name: 'Waterfall',
    description: 'Traditional stage-gate, sequential phases',
    phases: [
      { name: 'Planning',     order: 1, typicalDurationDays: 14, hasTests: false },
      { name: 'Design',       order: 2, typicalDurationDays: 21, hasTests: false },
      { name: 'Development',  order: 3, typicalDurationDays: 42, hasTests: false },
      { name: 'Unit Testing', order: 4, typicalDurationDays: 14, hasTests: true  },
      { name: 'SIT',          order: 5, typicalDurationDays: 14, hasTests: true  },
      { name: 'UAT',          order: 6, typicalDurationDays: 21, hasTests: true  },
      { name: 'Go-Live',      order: 7, typicalDurationDays: 3,  hasTests: false },
      { name: 'Hypercare',    order: 8, typicalDurationDays: 14, hasTests: false },
    ]
  },
  Agile: {
    name: 'Agile',
    description: 'Iterative sprints, continuous testing',
    phases: [
      { name: 'Backlog',       order: 1, typicalDurationDays: 7,  hasTests: false },
      { name: 'Sprint',        order: 2, typicalDurationDays: 14, hasTests: true  },
      { name: 'Integration',   order: 3, typicalDurationDays: 7,  hasTests: true  },
      { name: 'UAT',           order: 4, typicalDurationDays: 14, hasTests: true  },
      { name: 'Release',       order: 5, typicalDurationDays: 3,  hasTests: false },
      { name: 'Hypercare',     order: 6, typicalDurationDays: 7,  hasTests: false },
    ]
  },
  Hybrid: {
    name: 'Hybrid',
    description: 'Waterfall gates with agile execution',
    phases: [
      { name: 'Planning',     order: 1, typicalDurationDays: 14, hasTests: false },
      { name: 'Build Sprints',order: 2, typicalDurationDays: 42, hasTests: true  },
      { name: 'SIT',          order: 3, typicalDurationDays: 14, hasTests: true  },
      { name: 'UAT',          order: 4, typicalDurationDays: 21, hasTests: true  },
      { name: 'Go-Live',      order: 5, typicalDurationDays: 3,  hasTests: false },
      { name: 'Hypercare',    order: 6, typicalDurationDays: 14, hasTests: false },
    ]
  },
  SAFe: {
    name: 'SAFe',
    description: 'Scaled Agile Framework — PI-based',
    phases: [
      { name: 'PI Planning',   order: 1, typicalDurationDays: 5,  hasTests: false },
      { name: 'Iteration',     order: 2, typicalDurationDays: 56, hasTests: true  },
      { name: 'System Demo',   order: 3, typicalDurationDays: 7,  hasTests: true  },
      { name: 'Release Train', order: 4, typicalDurationDays: 14, hasTests: true  },
      { name: 'Deploy',        order: 5, typicalDurationDays: 3,  hasTests: false },
      { name: 'Inspect',       order: 6, typicalDurationDays: 7,  hasTests: false },
    ]
  },
  'Break-fix': {
    name: 'Break-fix',
    description: 'Fast-track for incident resolution',
    phases: [
      { name: 'Analysis',    order: 1, typicalDurationDays: 2,  hasTests: false },
      { name: 'Fix',         order: 2, typicalDurationDays: 3,  hasTests: false },
      { name: 'Testing',     order: 3, typicalDurationDays: 2,  hasTests: true  },
      { name: 'Deploy',      order: 4, typicalDurationDays: 1,  hasTests: false },
      { name: 'Verify',      order: 5, typicalDurationDays: 1,  hasTests: false },
    ]
  },
  // ─── SAP-Specific Methodologies ───
  'SAP Activate': {
    name: 'SAP Activate',
    description: 'SAP standard methodology for S/4HANA & cloud implementations',
    phases: [
      { name: 'Discover',    order: 1, typicalDurationDays: 14, hasTests: false },
      { name: 'Prepare',     order: 2, typicalDurationDays: 21, hasTests: false },
      { name: 'Explore',     order: 3, typicalDurationDays: 42, hasTests: false },
      { name: 'Realize',     order: 4, typicalDurationDays: 56, hasTests: true  },
      { name: 'Deploy',      order: 5, typicalDurationDays: 21, hasTests: true  },
      { name: 'Run',         order: 6, typicalDurationDays: 14, hasTests: false },
    ]
  },
  'ASAP': {
    name: 'ASAP',
    description: 'Accelerated SAP (classic on-premise ECC implementations)',
    phases: [
      { name: 'Project Preparation', order: 1, typicalDurationDays: 14, hasTests: false },
      { name: 'Business Blueprint',  order: 2, typicalDurationDays: 42, hasTests: false },
      { name: 'Realization',         order: 3, typicalDurationDays: 56, hasTests: true  },
      { name: 'Final Preparation',   order: 4, typicalDurationDays: 21, hasTests: true  },
      { name: 'Go-Live & Support',   order: 5, typicalDurationDays: 14, hasTests: false },
    ]
  },
  'Fit-to-Standard': {
    name: 'Fit-to-Standard',
    description: 'SAP best-practice workshops — minimal customization, max standard',
    phases: [
      { name: 'Fit/Gap Workshops', order: 1, typicalDurationDays: 14, hasTests: false },
      { name: 'Delta Design',     order: 2, typicalDurationDays: 14, hasTests: false },
      { name: 'Configuration',    order: 3, typicalDurationDays: 28, hasTests: false },
      { name: 'Testing',          order: 4, typicalDurationDays: 21, hasTests: true  },
      { name: 'Data Migration',   order: 5, typicalDurationDays: 14, hasTests: true  },
      { name: 'Go-Live',          order: 6, typicalDurationDays: 7,  hasTests: false },
      { name: 'Hypercare',        order: 7, typicalDurationDays: 14, hasTests: false },
    ]
  },
  'Rapid Deployment': {
    name: 'Rapid Deployment',
    description: 'SAP Rapid Deployment Solution — pre-configured, fast go-live',
    phases: [
      { name: 'Scope & Plan',    order: 1, typicalDurationDays: 5,  hasTests: false },
      { name: 'Configure',       order: 2, typicalDurationDays: 14, hasTests: false },
      { name: 'Verify',          order: 3, typicalDurationDays: 7,  hasTests: true  },
      { name: 'Cut-over',        order: 4, typicalDurationDays: 3,  hasTests: false },
      { name: 'Go-Live',         order: 5, typicalDurationDays: 2,  hasTests: false },
    ]
  }
};

/**
 * Get the methodology template for a work item
 * @param {string} methodology - Waterfall/Agile/Hybrid/SAFe/Break-fix
 * @returns {object} Template with phases
 */
function getMethodologyTemplate(methodology) {
  return METHODOLOGY_TEMPLATES[methodology] || METHODOLOGY_TEMPLATES['Waterfall'];
}

/**
 * Get all available methodology names
 */
function getMethodologyList() {
  return Object.keys(METHODOLOGY_TEMPLATES).map(k => ({
    methodologyKey: k,
    ...METHODOLOGY_TEMPLATES[k],
    phaseCount: METHODOLOGY_TEMPLATES[k].phases.length,
    phases: METHODOLOGY_TEMPLATES[k].phases
  }));
}

module.exports = {
  normalizeTestStatus,
  parseTestStatuses,
  testRAGImpact,
  getMethodologyTemplate,
  getMethodologyList,
  METHODOLOGY_TEMPLATES,
  STATUS_PATTERNS
};
