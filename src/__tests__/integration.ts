/**
 * When true, tests that call live iTunes/App Store APIs will run.
 * Set RUN_INTEGRATION_TESTS=1 (or true) to enable; otherwise they are skipped
 * so the default test run passes without network (e.g. in sandbox or CI without network).
 */
export const runIntegrationTests =
  process.env.RUN_INTEGRATION_TESTS === '1' || process.env.RUN_INTEGRATION_TESTS === 'true';
