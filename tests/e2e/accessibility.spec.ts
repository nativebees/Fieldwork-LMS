import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Automated accessibility smoke test. axe-core catches a subset of problems
 * (names, roles, contrast, structure). It does not replace testing with a
 * screen reader, which has not been done yet.
 */

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes) ${v.nodes[0]?.target.join(' ')}`);
  expect(serious, `${label} should have no serious or critical axe violations`).toEqual([]);
}

test('each view and dialog passes an axe-core check at WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('/');
  await expect(page.getByTestId('next-decision')).toBeVisible();
  await expectNoSeriousViolations(page, 'Account');

  await page.getByTestId('evidence-hyp-finance').click();
  await expect(page.getByTestId('evidence-drawer')).toBeVisible();
  await page.waitForTimeout(300);
  await expectNoSeriousViolations(page, 'Evidence drawer');
  await page.keyboard.press('Escape');

  await page.getByTestId('decision-accept-hyp-marketing').click();
  await page.getByTestId('nav-rehearsal').click();
  for (const [step, option] of [
    ['opening', 'o-observe'],
    ['firstQuestion', 'q-walkthrough'],
    ['followUp', 'f-evidence'],
    ['intervention', 'i-replace'],
    ['measurement', 'm-returned'],
  ]) {
    await page.getByTestId(`option-${option}`).check();
    await page.getByTestId(`say-${step}`).click();
  }
  await expect(page.getByTestId('rehearsal-complete')).toBeVisible();
  await page.waitForTimeout(400);
  await expectNoSeriousViolations(page, 'Rehearsal');

  await page.getByTestId('nav-studio').click();
  await expect(page.getByTestId('constraint-banner')).toBeVisible();
  await page.getByTestId('select-lesson-3').click();
  await expectNoSeriousViolations(page, 'Studio');

  await page.getByTestId('preview-all-suggestions').click();
  await expect(page.getByTestId('proposal-dialog')).toBeVisible();
  await page.waitForTimeout(300);
  await expectNoSeriousViolations(page, 'Proposal dialog');
  await page.getByTestId('proposal-apply').click();

  await page.getByTestId('switch-preview').click();
  await page.getByTestId('lesson-nav').getByText('Check claims before handoff').click();
  await page.getByTestId('choice-claim-c1').check();
  await page.getByTestId('choice-evidence-e3').check();
  await page.getByTestId('check-work').click();
  await expect(page.getByTestId('attempt-feedback')).toBeVisible();
  await page.waitForTimeout(300);
  await expectNoSeriousViolations(page, 'Customer preview with feedback');

  await page.getByTestId('nav-review').click();
  await expect(page.getByTestId('review-changes')).toBeVisible();
  await expectNoSeriousViolations(page, 'Review');

  await page.getByTestId('open-about').click();
  await expect(page.getByTestId('about-drawer')).toBeVisible();
  await page.waitForTimeout(300);
  await expectNoSeriousViolations(page, 'About drawer');
});
