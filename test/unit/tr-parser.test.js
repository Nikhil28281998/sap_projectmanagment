'use strict';

const { parseTRDescription, suggestWorkType, TR_REGEX, WORK_TYPE_MAP } = require('../../srv/lib/tr-parser');

describe('TR Parser', () => {
  describe('TR_REGEX - Prefix format parsing', () => {
    test('matches full prefix format', () => {
      const match = 'PRJ-CHG0098765 | GL Account Restructure'.match(TR_REGEX);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('PRJ');
      expect(match[2]).toBe('CHG');
      expect(match[3]).toBe('0098765');
      expect(match[4]).toBe('GL Account Restructure');
    });

    test('matches BRK-INC format', () => {
      const match = 'BRK-INC0012345 | Hotfix for login error'.match(TR_REGEX);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('BRK');
      expect(match[2]).toBe('INC');
    });

    test('does not match plain TR numbers', () => {
      const match = 'DEVK900123'.match(TR_REGEX);
      expect(match).toBeNull();
    });

    test('does not match descriptions without prefix', () => {
      const match = 'Regular transport description'.match(TR_REGEX);
      expect(match).toBeNull();
    });
  });

  describe('WORK_TYPE_MAP', () => {
    test('contains all 6 work types', () => {
      expect(WORK_TYPE_MAP).toHaveProperty('PRJ', 'Project');
      expect(WORK_TYPE_MAP).toHaveProperty('ENH', 'Enhancement');
      expect(WORK_TYPE_MAP).toHaveProperty('BRK', 'Break-fix');
      expect(WORK_TYPE_MAP).toHaveProperty('UPG', 'Upgrade');
      expect(WORK_TYPE_MAP).toHaveProperty('SUP', 'Support');
      expect(WORK_TYPE_MAP).toHaveProperty('HYP', 'Hypercare');
    });
  });

  describe('parseTRDescription', () => {
    test('parses full prefix format', () => {
      const result = parseTRDescription('PRJ-CHG0098765 | GL Account Restructure');
      expect(result.workType).toBe('Project');
      expect(result.workTypeCode).toBe('PRJ');
      expect(result.snowTicket).toBe('CHG0098765');
      expect(result.snowType).toBe('CHG');
      expect(result.description).toBe('GL Account Restructure');
    });

    test('extracts SNOW ticket from plain description', () => {
      const result = parseTRDescription('INC0012345 - Fix user authorization');
      expect(result.snowTicket).toBe('INC0012345');
      expect(result.snowType).toBe('INC');
    });

    test('infers break-fix for INC tickets', () => {
      const result = parseTRDescription('INC0012345 Fix authorization');
      expect(result.workType).toBe('Break-fix');
      expect(result.workTypeCode).toBe('BRK');
    });

    test('returns null snowTicket if none found', () => {
      const result = parseTRDescription('Custom ABAP enhancement');
      expect(result.snowTicket).toBeNull();
    });

    test('handles empty description', () => {
      const result = parseTRDescription('');
      expect(result.snowTicket).toBeNull();
      expect(result.workType).toBeNull();
    });

    test('handles null/undefined gracefully', () => {
      const result = parseTRDescription(null);
      expect(result.snowTicket).toBeNull();
      expect(result.workType).toBeNull();
      expect(result.description).toBe('');
    });
  });

  describe('suggestWorkType', () => {
    test('suggests BRK for incident keywords', () => {
      const result = suggestWorkType('Emergency fix for production issue');
      expect(result).not.toBeNull();
      expect(result.suggestedType).toBe('BRK');
      expect(result.suggestedTypeName).toBe('Break-fix');
    });

    test('suggests PRJ for project keywords', () => {
      const result = suggestWorkType('GL Account Restructure project');
      expect(result).not.toBeNull();
      expect(result.suggestedType).toBe('PRJ');
    });

    test('suggests ENH for enhancement keywords', () => {
      const result = suggestWorkType('Enhancement to vendor report');
      expect(result).not.toBeNull();
      expect(result.suggestedType).toBe('ENH');
    });

    test('suggests UPG for basis/upgrade keywords', () => {
      const result = suggestWorkType('Kernel upgrade and patching');
      expect(result).not.toBeNull();
      expect(result.suggestedType).toBe('UPG');
    });

    test('returns null for ambiguous descriptions', () => {
      const result = suggestWorkType('Miscellaneous changes');
      expect(result).toBeNull();
    });

    test('has LOW confidence', () => {
      const result = suggestWorkType('bug fix for report');
      expect(result.confidence).toBe('LOW');
    });

    test('handles null input', () => {
      const result = suggestWorkType(null);
      expect(result).toBeNull();
    });
  });
});
