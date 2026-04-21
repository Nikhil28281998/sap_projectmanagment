import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect } from 'vitest';

expect.extend({ toHaveNoViolations });

export { axe };
export type { AxeResults } from 'axe-core';
