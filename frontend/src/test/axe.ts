import * as matchers from 'vitest-axe/matchers';
import { axe } from 'vitest-axe';
import { expect } from 'vitest';
import type { AxeMatchers } from 'vitest-axe/matchers';

expect.extend(matchers);

// vitest-axe ships augmentations for the older `Vi.Assertion` namespace,
// but vitest 1.x exposes Assertion via the `vitest` module. Re-augment here
// so `.toHaveNoViolations()` typechecks in test files.
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Assertion<T> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}

export { axe };
export type { AxeResults } from 'axe-core';
