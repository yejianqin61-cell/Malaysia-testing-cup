// Smoke / regression suite for the SUT.
// Title every test with the TestCases ID ("TC-xx ...") so results map back to the workbook.
//
// On competition day:
//   1. npx playwright codegen --save-storage=auth.json <SUT_URL>   (a HUMAN logs in; tool records)
//   2. Paste the recorded steps into a new test below, add expect() for the expected result.
//   3. Ask AI to tidy the code (paste code only - no auth.json, no passwords).
//   4. $env:SUT_URL="<SUT_URL>"; $env:AUTH="auth.json"; npx playwright test
//   5. Copy pass/fail into TestCases; any failure -> reproduce manually before logging a defect.
// Keep journeys read-mostly. Avoid tests that create real orders/payments unless the briefing allows it.
import { test, expect } from '@playwright/test';

test.skip(!process.env.SUT_URL, 'Set SUT_URL to run the smoke suite');

test('TC-SMOKE-01 home page loads with a title and no uncaught errors', async ({ page }) => {
  const problems = [];
  page.on('pageerror', (e) => problems.push(`uncaught: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });

  // './' = SUT_URL itself. '/' would jump to the host root if the SUT lives under a sub-path.
  const resp = await page.goto('./');
  expect(resp?.status(), 'main document status').toBeLessThan(400);
  await expect(page).toHaveTitle(/.+/);
  expect(problems, 'uncaught exceptions / 5xx during load').toEqual([]);
});

// ---- Template: replace with a codegen recording of a main journey ----
// test('TC-05 search returns matching products for an exact keyword', async ({ page }) => {
//   await page.goto('./');
//   await page.getByPlaceholder('Search').fill('apple');
//   await page.getByRole('button', { name: 'Search' }).click();
//   await expect(page.getByTestId('result-item').first()).toContainText(/apple/i);
// });
