import { describe, test, expect } from 'vitest';
import {
  parseTRDescription,
  calculateRAG,
  daysFromNow,
  daysBetween,
  WORK_TYPE_MAP,
  WORK_TYPE_COLORS,
} from '../tr-parser';

describe('parseTRDescription', () => {
  test('extracts SNOW ticket from description', () => {
    const result = parseTRDescription('INC0012345 - Fix authorization issue');
    expect(result.snowTicket).toBe('INC0012345');
  });

  test('extracts CHG ticket', () => {
    const result = parseTRDescription('CHG0098765 GL restructure phase 2');
    expect(result.snowTicket).toBe('CHG0098765');
  });

  test('returns null ticketfor descriptions without SNOW', () => {
    const result = parseTRDescription('Regular ABAP development');
    expect(result.snowTicket).toBeNull();
  });

  test('handles empty string', () => {
    const result = parseTRDescription('');
    expect(result.snowTicket).toBeNull();
  });

  test('suggests break-fix for incident keywords', () => {
    const result = parseTRDescription('Emergency hotfix for production');
    expect(result.suggestedType).toBe('break-fix');
  });

  test('suggests project for project keywords', () => {
    const result = parseTRDescription('Project Alpha implementation phase');
    expect(result.suggestedType).toBe('project');
  });

  test('suggests basis for kernel/patch keywords', () => {
    const result = parseTRDescription('Kernel upgrade SP15');
    expect(result.suggestedType).toBe('basis');
  });
});

describe('calculateRAG', () => {
  const baseItem = {
    status: 'Active' as string | undefined,
    deploymentPct: 50,
    overallRAG: undefined as string | undefined,
    goLiveDate: null as string | null,
  };

  test('returns RED when overallRAG is RED', () => {
    expect(calculateRAG({ ...baseItem, overallRAG: 'RED' })).toBe('RED');
  });

  test('returns AMBER when overallRAG is AMBER', () => {
    expect(calculateRAG({ ...baseItem, overallRAG: 'AMBER' })).toBe('AMBER');
  });

  test('returns GREEN for healthy items', () => {
    expect(calculateRAG({ ...baseItem, deploymentPct: 80 })).toBe('GREEN');
  });

  test('returns RED when go-live is <=7 days and progress <80%', () => {
    const inSevenDays = new Date();
    inSevenDays.setDate(inSevenDays.getDate() + 5);
    const item = {
      ...baseItem,
      goLiveDate: inSevenDays.toISOString(),
      deploymentPct: 30,
    };
    expect(calculateRAG(item)).toBe('RED');
  });

  test('returns AMBER when go-live is <=14 days and progress <60%', () => {
    const inTwoWeeks = new Date();
    inTwoWeeks.setDate(inTwoWeeks.getDate() + 12);
    const item = {
      ...baseItem,
      goLiveDate: inTwoWeeks.toISOString(),
      deploymentPct: 40,
    };
    expect(calculateRAG(item)).toBe('AMBER');
  });

  test('returns GREEN for completed items', () => {
    expect(calculateRAG({ ...baseItem, status: 'Done' })).toBe('GREEN');
  });
});

describe('daysFromNow', () => {
  test('returns positive number for future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    expect(daysFromNow(future)).toBeCloseTo(10, 0);
  });

  test('returns negative number for past dates', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(daysFromNow(past)).toBeCloseTo(-5, 0);
  });

  test('returns 0 for today', () => {
    expect(Math.abs(daysFromNow(new Date()))).toBeLessThan(1);
  });
});

describe('daysBetween', () => {
  test('calculates days between two dates', () => {
    const d1 = new Date('2026-01-01');
    const d2 = new Date('2026-01-11');
    expect(daysBetween(d1, d2)).toBe(10);
  });

  test('returns 0 for same date', () => {
    const d = new Date('2026-06-15');
    expect(daysBetween(d, d)).toBe(0);
  });
});

describe('WORK_TYPE_MAP', () => {
  test('contains all standard work types', () => {
    expect(WORK_TYPE_MAP).toHaveProperty('project');
    expect(WORK_TYPE_MAP).toHaveProperty('enhancement');
    expect(WORK_TYPE_MAP).toHaveProperty('break-fix');
    expect(WORK_TYPE_MAP).toHaveProperty('general');
    expect(WORK_TYPE_MAP).toHaveProperty('basis');
    expect(WORK_TYPE_MAP).toHaveProperty('security');
  });
});

describe('WORK_TYPE_COLORS', () => {
  test('has colors for all types', () => {
    Object.keys(WORK_TYPE_MAP).forEach((key) => {
      expect(WORK_TYPE_COLORS).toHaveProperty(key);
    });
  });
});
