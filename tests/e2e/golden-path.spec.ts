import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Browser tests for the one journey Fieldwork is built around:
 * inspect evidence, capture a recommendation, rehearse, hear the constraint,
 * revise the program, complete practice as the learner, review and export.
 */

async function openDemo(page: Page, path = '/') {
  await page.goto(path);
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(path);
}

/** Real pointer drag. dnd-kit needs intermediate moves before it activates. */
async function dragOnto(page: Page, source: Locator, target: Locator, sourceOffsetX?: number) {
  // Bring the drop target into view first. The lesson library is sticky, so it stays reachable.
  await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(150);
  const from = (await source.boundingBox())!;
  const startX = from.x + (sourceOffsetX ?? from.width / 2);
  const startY = from.y + from.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 8, startY + 8, { steps: 4 });
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 14 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(250);
}

async function lessonTitles(page: Page): Promise<string[]> {
  return page.locator('[data-testid="journey"] [data-testid^="select-"]').allTextContents();
}

async function say(page: Page, stepId: string, optionId: string) {
  await page.getByTestId(`option-${optionId}`).check();
  await page.getByTestId(`say-${stepId}`).click();
}

async function noHorizontalOverflow(page: Page) {
  // Compare with the device width. On a phone, innerWidth grows with overflowing content, so it cannot be the yardstick.
  const contentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(contentWidth, 'page should not scroll sideways').toBeLessThanOrEqual(page.viewportSize()!.width + 1);
}

test.describe('golden path', () => {
  test('a visitor can run the whole journey with no login, credentials or external data', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname !== 'localhost') external.push(request.url());
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await openDemo(page);

    /* A. Inspect the account evidence */
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make the next customer conversation useful.');
    await expect(page.getByText('Demo · synthetic customer data')).toBeVisible();
    await expect(page.getByText('Scenario coaching').first()).toBeVisible();
    await expect(page.getByTestId('org-summary')).toContainText('156 of 200');
    await expect(page.getByTestId('org-summary')).toContainText('78%');
    await expect(page.getByTestId('cohort-row-marketing')).toContainText('64 of 80');
    await expect(page.getByTestId('cohort-row-marketing')).toContainText('44 of 64');
    await expect(page.getByTestId('cohort-row-marketing')).toContainText('12 of 64');
    await expect(page.getByTestId('cohort-row-marketing')).toContainText('8 of 64');
    await expect(page.getByTestId('cohort-row-finance')).toContainText('Unavailable');

    /* Guidance is tailored to role, tenure and the live deal, and it starts from the seller's own work */
    await expect(page.getByTestId('tailored-to')).toContainText('Role · Enterprise AE');
    await expect(page.getByTestId('tailored-to')).toContainText('Tenure · 45 days in role');
    await expect(page.getByTestId('tailored-to')).toContainText('Live deal · Adoption review, renewal June 2027');
    await expect(page.getByTestId('flow-of-work')).toContainText('7 days before the review');
    const aeDealNote = await page.getByTestId('deal-note').textContent();

    /* Changing the seller context changes the coaching decision */
    const aeDecision = await page.getByTestId('next-decision-title').textContent();
    const aeQuestion = await page.getByTestId('next-decision-question').textContent();
    const aeCriteria = await page.getByTestId('next-decision-criteria').textContent();
    await page.getByRole('radio', { name: /Experienced CSM/ }).click();
    await expect(page.getByTestId('next-decision-title')).not.toHaveText(aeDecision!);
    await expect(page.getByTestId('next-decision-question')).toContainText('four-week pilot');
    await expect(page.getByTestId('tailored-to')).toContainText('Tenure · 18 months in role');
    expect(await page.getByTestId('deal-note').textContent()).not.toBe(aeDealNote);
    expect(await page.getByTestId('next-decision-question').textContent()).not.toBe(aeQuestion);
    expect(await page.getByTestId('next-decision-criteria').textContent()).not.toBe(aeCriteria);
    await page.getByRole('radio', { name: /New Enterprise AE/ }).click();
    await expect(page.getByTestId('next-decision-title')).toHaveText(aeDecision!);

    /* The restricted-capability counterexample avoids a false learning diagnosis */
    const finance = page.getByTestId('rec-hyp-finance');
    await expect(finance).toContainText('No learning-need hypothesis');
    await expect(finance).toContainText('No training is proposed');
    await page.getByTestId('ask-pip-hyp-finance').click();
    await expect(page.getByTestId('pip-hyp-finance')).toContainText(
      'This could be an access issue. Check the permission before assigning training.',
    );

    /* Evidence drawer keeps provenance, and returns focus when closed */
    await page.getByTestId('evidence-hyp-marketing').click();
    const drawer = page.getByTestId('evidence-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId('evidence-matching')).toHaveText('44 (M01 to M44)');
    await expect(drawer.getByTestId('observation-obs-marketing-frequent-no-reuse')).toContainText('64 active members');
    await expect(drawer.getByTestId('source-src-field-note')).toContainText('Needs review');
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page.getByTestId('evidence-hyp-marketing')).toBeFocused();

    /* B. Capture the initial recommendation */
    await page.getByTestId('decision-accept-hyp-marketing').click();
    await expect(page.getByTestId('decision-recorded-hyp-marketing')).toContainText('Initial recommendation recorded: Accepted');

    /* C and D. Rehearse, and hear the customer's constraint */
    await page.getByTestId('go-rehearsal').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Practise the conversation');
    await say(page, 'opening', 'o-observe');
    await expect(page.getByTestId('reply-opening')).toContainText('Ask away');
    await expect(page.getByTestId('constraint-reveal')).toHaveCount(0);
    await say(page, 'firstQuestion', 'q-walkthrough');
    await expect(page.getByTestId('constraint-reveal')).toContainText(
      'The team repeats campaign briefs, but the real sticking point is unsupported product claims. Approval must stay with the campaign owner.',
    );
    await say(page, 'followUp', 'f-evidence');
    await say(page, 'intervention', 'i-replace');
    await say(page, 'measurement', 'm-returned');
    await expect(page.getByTestId('rehearsal-complete')).toBeVisible();
    // Good choices alone are not full marks. Two criteria read the program itself.
    await expect(page.getByTestId('rubric-total')).toHaveText('7 / 10');
    await page.getByTestId('reflection').fill('I would have pitched a workshop. The claim check is the real job.');
    await expect(page.getByTestId('rubric-total')).toHaveText('7 / 10');

    /* E. Adapt the program */
    await page.getByTestId('go-studio').click();
    await expect(page.getByTestId('constraint-banner')).toBeVisible();
    await expect(page.locator('[data-testid^="suggestion-"][data-status="pending"]')).toHaveCount(4);
    expect(await lessonTitles(page)).toEqual([
      'Create a reusable campaign-brief context',
      'Map a reviewable workflow',
      'Package a repeatable instruction',
      'Apply the workflow to a new brief',
    ]);

    // Real pointer drag from the library into the journey, dropped on the Skill lesson.
    await dragOnto(page, page.getByTestId('template-tpl-claims'), page.getByTestId('lesson-lesson-3'), 70);
    expect(await lessonTitles(page)).toEqual([
      'Create a reusable campaign-brief context',
      'Map a reviewable workflow',
      'Check claims before handoff',
      'Package a repeatable instruction',
      'Apply the workflow to a new brief',
    ]);

    // Remove the generic Skill lesson, undo it, then remove it for good.
    await page.getByTestId('remove-lesson-3').click();
    await expect(page.getByTestId('undo-bar')).toContainText('Package a repeatable instruction');
    await page.getByTestId('undo-remove').click();
    expect(await lessonTitles(page)).toContain('Package a repeatable instruction');
    await page.getByTestId('remove-lesson-3').click();
    expect(await lessonTitles(page)).not.toContain('Package a repeatable instruction');
    // The manual swap is recognised from the program itself.
    await expect(page.getByTestId('suggestion-s-claims')).toHaveAttribute('data-status', 'applied');

    // Pointer reorder inside the journey: drag the last lesson to the top.
    await dragOnto(page, page.getByTestId('handle-lesson-4'), page.getByTestId('lesson-lesson-1'));
    expect((await lessonTitles(page))[0]).toBe('Apply the workflow to a new brief');

    // Keyboard reorder with the same handle: pick up, move down to the end, drop.
    // The live region announces each position, so the test reads it like a screen reader user would.
    const liveRegion = page.locator('[id^="DndLiveRegion"]').first();
    await page.getByTestId('handle-lesson-4').focus();
    await page.keyboard.press('Space');
    await expect(liveRegion).toContainText('Picked up “Apply the workflow to a new brief”. It is at position 1 of 4');
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(160);
      if ((await liveRegion.textContent())?.includes('position 4 of 4')) break;
    }
    await expect(liveRegion).toContainText('would move to position 4 of 4, in Repeat it with confidence');
    await page.keyboard.press('Space');
    await expect(liveRegion).toContainText('is now at position 4 of 4');
    const afterKeyboard = await lessonTitles(page);
    expect(afterKeyboard[afterKeyboard.length - 1]).toBe('Apply the workflow to a new brief');
    expect(afterKeyboard[0]).toBe('Create a reusable campaign-brief context');

    // The move buttons are an alternative, and they announce the new position.
    await page.getByTestId('up-lesson-4').click();
    await expect(page.getByTestId('announcer')).toContainText('moved to position 3 of 4');
    await page.getByTestId('down-lesson-4').click();
    await expect(page.getByTestId('announcer')).toContainText('moved to position 4 of 4');

    // Preview the remaining suggested changes, cancel once, then accept.
    await page.getByTestId('preview-all-suggestions').click();
    const dialog = page.getByTestId('proposal-dialog');
    await expect(dialog).toContainText('deterministic rules, not model output');
    await expect(dialog.getByTestId('proposal-changes')).toContainText('workflow-sequence@2');
    await page.getByTestId('proposal-cancel').click();
    await expect(page.getByTestId('toast')).toContainText('No changes were made');
    await expect(page.getByTestId('rules-lesson-2')).toHaveText('workflow-sequence@1');
    await page.getByTestId('preview-all-suggestions').click();
    await page.getByTestId('proposal-apply').click();
    await expect(page.getByTestId('rules-lesson-2')).toHaveText('workflow-sequence@2');
    await expect(page.getByTestId('rules-lesson-4')).toHaveText('transfer-brief@2');
    await expect(page.locator('[data-testid^="suggestion-"][data-status="applied"]')).toHaveCount(4);
    await expect(page.getByTestId('studio-title')).toHaveText('Source-checked campaign briefs');
    await expect(page.getByTestId('what-changed')).toContainText('What changed and why');

    // Edit a lesson. The same state drives the customer preview.
    await page.getByTestId('select-lesson-1').click();
    await page.getByTestId('field-title').fill('Save the Relay brief context');
    await page.getByTestId('field-objective').fill('Keep everything a Relay campaign brief needs in one saved place.');
    await expect(page.getByTestId('objective-review')).toBeVisible();
    await page.getByTestId('objective-aligned').click();
    await expect(page.getByTestId('objective-review')).toBeHidden();

    /* F. Complete the applied learner exercise from that edited program */
    await page.getByTestId('switch-preview').click();
    await expect(page.getByTestId('preview-program-title')).toHaveText('Source-checked campaign briefs');
    await expect(page.getByTestId('preview-lesson-title')).toHaveText('Save the Relay brief context');
    await expect(page.getByTestId('preview-objective')).toHaveText('Keep everything a Relay campaign brief needs in one saved place.');
    await expect(page.getByTestId('preview')).not.toContainText('Dana');
    await expect(page.getByTestId('meter-criteria')).toContainText('0 of 10');

    // Claim check: a wrong answer fails with an explanation, then a retry succeeds.
    await page.getByTestId('lesson-nav').getByText('Check claims before handoff').click();
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-rules', 'claim-check@1');
    await page.getByTestId('check-work').click();
    await expect(page.getByText('Answer this part before checking.').first()).toBeVisible();
    await page.getByTestId('choice-claim-c3').check();
    await page.getByTestId('choice-evidence-e2').check();
    await page.getByTestId('check-work').click();
    await expect(page.getByTestId('attempt-summary')).toHaveText('Attempt 1: 0 of 2 criteria demonstrated.');
    await expect(page.getByTestId('result-cl.identify')).toContainText('integration catalog');
    await expect(page.getByTestId('result-cl.identify')).toContainText('Not yet');
    await expect(page.getByTestId('pip-attempt')).toContainText('2 of 2 not met yet');
    await expect(page.getByTestId('meter-attempted')).toContainText('1 of 4');
    await expect(page.getByTestId('meter-criteria')).toContainText('0 of 10');
    await page.getByTestId('retry').click();
    await page.getByTestId('choice-claim-c2').check();
    await page.getByTestId('choice-evidence-e1').check();
    await page.getByTestId('check-work').click();
    await expect(page.getByTestId('attempt-summary')).toHaveText('Attempt 2: 2 of 2 criteria demonstrated.');
    await expect(page.getByTestId('attempt-feedback')).toHaveAttribute('data-all-met', 'true');
    await expect(page.getByTestId('meter-criteria')).toContainText('2 of 10');

    // Workflow lab: arrange the five steps, with approval before sharing.
    await page.getByTestId('lesson-nav').getByText('Map a reviewable workflow').click();
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-rules', 'workflow-sequence@2');
    // Start: draft, share, approve, context, claims. Target: context, draft, claims, approve, share.
    for (let i = 0; i < 3; i += 1) await page.getByTestId('step-up-context').click();
    for (let i = 0; i < 2; i += 1) await page.getByTestId('step-up-claims').click();
    await page.getByTestId('step-down-share').click();
    await page.getByTestId('check-work').click();
    await expect(page.getByTestId('attempt-summary')).toHaveText('Attempt 1: 3 of 3 criteria demonstrated.');
    await expect(page.getByTestId('result-wf.approval-before-share')).toContainText('Demonstrated');

    // Transfer: a new brief, the same check, and the approval kept.
    await page.getByTestId('lesson-nav').getByText('Apply the workflow to a new brief').click();
    await expect(page.getByTestId('scenario')).toContainText('Meridian Insights');
    await page.getByTestId('choice-claim-w2').check();
    await page.getByTestId('choice-evidence-v1').check();
    await page.getByTestId('choice-approval-after').check();
    await page.getByTestId('check-work').click();
    await expect(page.getByTestId('attempt-summary')).toHaveText('Attempt 1: 3 of 3 criteria demonstrated.');

    // Focus mode hides the app chrome and the lesson list.
    await page.getByTestId('enter-focus').click();
    await expect(page.getByTestId('nav-account')).toHaveCount(0);
    await expect(page.getByTestId('lesson-nav')).toHaveCount(0);
    await page.getByTestId('exit-focus').click();
    await expect(page.getByTestId('nav-account')).toBeVisible();

    /* G. Review the changed decision and export the plan */
    await page.getByTestId('nav-review').click();
    await expect(page.getByTestId('review-initial')).toContainText('You accepted the suggested practice program');
    await expect(page.getByTestId('review-constraint')).toContainText('unsupported product claims');
    await expect(page.getByTestId('review-changes')).toContainText('Check claims before handoff');
    await expect(page.getByTestId('review-changes')).toContainText('Customer constraint');
    // Now that the program reflects the constraint, the two program-based criteria score.
    await expect(page.getByTestId('review-seller-total')).toHaveText('10 / 10');
    await expect(page.getByTestId('review-learner-total')).toContainText('8 / 10 criteria');
    await expect(page.getByTestId('review-followup')).toContainText('Proposed, not measured');
    // Seller impact is a proposed ladder that ends in ramp time, win rate and attainment. Nothing is claimed.
    await expect(page.getByTestId('review-impact')).toContainText('Proposed, not measured');
    await expect(page.getByTestId('impact-use-in-work')).toContainText('A first call was recorded');
    await expect(page.getByTestId('impact-live-behaviour')).toContainText('10 of 10 on a scripted task');
    await expect(page.getByTestId('impact-commercial')).toContainText('Ramp time, win rate and attainment');
    await expect(page.getByTestId('impact-commercial')).toContainText('Not produced by this demo');
    await expect(page.getByTestId('impact-focus')).toContainText('ramp time');
    // Completing practice never changes the customer's adoption figures.
    await expect(page.getByTestId('review-adoption')).toContainText('156 of 200 seats active (78%)');

    const [mdDownload] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-markdown').click()]);
    expect(mdDownload.suggestedFilename()).toMatch(/^fieldwork-source-checked-campaign-briefs-\d{4}-\d{2}-\d{2}\.md$/);
    const markdown = readFileSync((await mdDownload.path())!, 'utf8');
    expect(markdown).toContain('# Source-checked campaign briefs');
    expect(markdown).toContain('**Save the Relay brief context** (5 min)');
    expect(markdown).toContain('**Check claims before handoff**');
    expect(markdown).not.toContain('Package a repeatable instruction** (');
    expect(markdown).toContain('## Follow-up (proposed)');
    expect(markdown).toContain('Review owner');

    const [jsonDownload] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
    const plan = JSON.parse(readFileSync((await jsonDownload.path())!, 'utf8'));
    expect(plan.schema).toBe('fieldwork.plan/v1');
    expect(plan.program.sequence.map((s: { title: string }) => s.title)).toEqual([
      'Save the Relay brief context',
      'Map a reviewable workflow',
      'Check claims before handoff',
      'Apply the workflow to a new brief',
    ]);
    expect(plan.snapshot.organization).toEqual({ assigned: 200, active: 156, activePercent: 78 });
    expect(plan.sellerPractice.total.points).toBe(10);
    expect(plan.sellerPractice.reflection.automaticallyAssessed).toBe(false);
    expect(plan.learnerPractice.attempts).toHaveLength(4);
    expect(plan.notice.synthetic).toBe(true);

    /* Refresh keeps the work. Direct links survive a reload. */
    await page.goto('/#/studio');
    await page.reload();
    await expect(page.getByTestId('studio-title')).toHaveText('Source-checked campaign briefs');
    expect((await lessonTitles(page))[0]).toBe('Save the Relay brief context');
    await expect(page.getByTestId('save-status')).toContainText(/Saved in this browser|Changes save in this browser/);

    /* Reset returns to the default demo */
    await page.getByTestId('open-reset').click();
    await page.getByTestId('reset-everything').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make the next customer conversation useful.');
    await page.getByTestId('nav-studio').click();
    await expect(page.getByTestId('studio-title')).toHaveText('Reusable campaign briefs');
    expect(await lessonTitles(page)).toEqual([
      'Create a reusable campaign-brief context',
      'Map a reviewable workflow',
      'Package a repeatable instruction',
      'Apply the workflow to a new brief',
    ]);
    await expect(page.getByTestId('constraint-banner')).toHaveCount(0);

    expect(external, 'no request should leave localhost').toEqual([]);
    expect(errors, 'no uncaught page errors').toEqual([]);
  });

  test('freeform edits to assessed requirements stop scoring until the mapping is reviewed', async ({ page }) => {
    await openDemo(page, '/#/studio');
    await page.getByTestId('select-lesson-2').click();
    await page.getByTestId('field-practice').fill('Write a short poem about the workflow.');
    await expect(page.getByTestId('assessment-review')).toBeVisible();
    await expect(page.getByTestId('lesson-lesson-2')).toContainText('Custom · assessment needs review');

    await page.getByTestId('switch-preview').click();
    await page.getByTestId('lesson-nav').getByText('Map a reviewable workflow').click();
    await expect(page.getByTestId('unscored-practice')).toContainText('Write a short poem about the workflow.');
    await expect(page.getByTestId('exercise')).toHaveCount(0);
    await page.getByTestId('mark-attempted').click();
    await expect(page.getByTestId('meter-attempted')).toContainText('1 of 4');
    await expect(page.getByTestId('meter-criteria')).toContainText('0 of 7');

    await page.getByTestId('switch-studio').click();
    await page.getByTestId('select-lesson-2').click();
    await page.getByTestId('assessment-restore').click();
    await expect(page.getByTestId('assessment-review')).toHaveCount(0);
    await expect(page.getByTestId('inspector-rules')).toContainText('workflow-sequence@1');
  });

  test('tailoring previews a deterministic change and can be cancelled', async ({ page }) => {
    await openDemo(page, '/#/studio');
    await expect(page.getByTestId('studio-meta')).toContainText('22 min');
    await page.getByTestId('tailor-shorten').click();
    await expect(page.getByTestId('proposal-dialog')).toContainText('ten-minute version');
    await page.getByTestId('proposal-cancel').click();
    await expect(page.getByTestId('studio-meta')).toContainText('22 min');
    await page.getByTestId('tailor-shorten').click();
    await page.getByTestId('proposal-apply').click();
    await expect(page.getByTestId('studio-meta')).toContainText('10 min');
    // A second request has nothing left to do and says so.
    await page.getByTestId('tailor-shorten').click();
    await expect(page.getByTestId('toast')).toContainText('Nothing to change');

    // Duplicate, then remove the copy.
    await page.getByTestId('duplicate-lesson-1').click();
    await expect(page.getByTestId('journey')).toContainText('Create a reusable campaign-brief context (copy)');
    await expect(page.getByTestId('studio-meta')).toContainText('5 lessons');
    await page
      .locator('[data-testid="journey"] li', { hasText: '(copy)' })
      .getByRole('button', { name: /^Remove/ })
      .click();
    await expect(page.getByTestId('studio-meta')).toContainText('4 lessons');

    await page.getByTestId('select-lesson-2').click();
    await page.getByTestId('tailor-adapt').click();
    await expect(page.getByTestId('proposal-dialog')).toContainText('Meridian Works');
    await page.getByTestId('proposal-apply').click();
    await page.getByTestId('field-duration').fill('0');
    await expect(page.getByText('Enter a whole number from 1 to 30.')).toBeVisible();
  });

  test('an empty program is handled in the studio, the preview and the review', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openDemo(page, '/#/preview');
    // Leave one attempt behind, so there is an attempt on a lesson that later disappears.
    await page.getByTestId('choice-sort-audience').check();
    await page.getByTestId('check-work').click();
    await expect(page.getByTestId('attempt-summary')).toContainText('Attempt 1');

    await page.getByTestId('switch-studio').click();
    for (const id of ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4']) await page.getByTestId(`remove-${id}`).click();
    await expect(page.getByTestId('empty-program')).toBeVisible();
    await expect(page.getByTestId('studio-meta')).toContainText('0 lessons');
    await expect(page.getByTestId('empty-module-1')).toBeVisible();

    await page.getByTestId('switch-preview').click();
    await expect(page.getByTestId('preview-empty')).toContainText('This program has no lessons yet.');

    await page.getByTestId('nav-review').click();
    await expect(page.getByTestId('review-learner')).toContainText('1 attempt on lessons that are no longer in the program');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-markdown').click()]);
    expect(readFileSync((await download.path())!, 'utf8')).toContain('0 lessons');

    // Drag a lesson into the empty first module, then restore the starting program.
    await page.getByTestId('nav-studio').click();
    await dragOnto(page, page.getByTestId('template-tpl-context'), page.getByTestId('empty-module-1'), 70);
    expect(await lessonTitles(page)).toEqual(['Create a reusable campaign-brief context']);
    await expect(page.getByTestId('empty-module-2')).toBeVisible();
    await page.getByTestId('open-reset').click();
    await page.getByTestId('reset-program').click();
    await expect(page.getByTestId('studio-meta')).toContainText('4 lessons');
    expect(errors).toEqual([]);
  });

  test('unavailable analytics shows an honest empty state and the studio still works', async ({ page }) => {
    await page.goto('/?simulate=analytics-unavailable');
    await expect(page.getByTestId('account-unavailable')).toContainText('The account evidence is unavailable.');
    await expect(page.getByTestId('account-unavailable')).toContainText('an unavailable value is not a zero');
    await page.goto('/?simulate=analytics-unavailable#/studio');
    await expect(page.getByTestId('journey')).toBeVisible();
    await page.goto('/?simulate=analytics-unavailable#/review');
    await expect(page.getByTestId('review-adoption')).toContainText('unavailable');
  });

  test('blocked browser storage falls back to memory and says so', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('storage blocked');
        },
      });
    });
    await page.goto('/');
    await expect(page.getByTestId('save-status')).toContainText('Not saved to this browser');
    await page.getByTestId('decision-accept-hyp-marketing').click();
    await expect(page.getByTestId('decision-recorded-hyp-marketing')).toBeVisible();
  });

  test('the About drawer states the synthetic and live boundaries', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('open-about').click();
    const about = page.getByTestId('about-drawer');
    await expect(about.getByTestId('integration-synthetic-analytics')).toContainText('Working');
    await expect(about.getByTestId('integration-enterprise-analytics')).toContainText('Proposed, not built');
    await expect(about.getByTestId('integration-claude-coaching')).toContainText('Optional, off in this build');
    await expect(about).toContainText('It is not an Anthropic product');
    await expect(about.getByTestId('role-fit')).toContainText('Tailored to each seller’s role, tenure and live deals');
    await expect(about.getByTestId('role-fit')).toContainText('No model tailors anything at runtime');
    await expect(about.getByTestId('standards')).toContainText('An unavailable value is never shown as zero.');
    await expect(about.getByTestId('source-src-role')).toContainText('Head of Enablement Experience & Innovation');
    await expect(about.getByTestId('source-src-field-note')).toContainText('Needs review');
    // Focus stays inside the dialog.
    for (let i = 0; i < 40; i += 1) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(about).toBeHidden();
  });
});

test.describe('narrow screens @narrow', () => {
  test('the same journey order works on a phone, with touch-reachable actions @narrow', async ({ page }) => {
    await openDemo(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make the next customer conversation useful.');
    await noHorizontalOverflow(page);
    await page.getByTestId('decision-accept-hyp-marketing').click();

    await page.getByTestId('nav-rehearsal').click();
    await say(page, 'opening', 'o-observe');
    await say(page, 'firstQuestion', 'q-time');
    await expect(page.getByTestId('constraint-reveal')).toBeVisible();
    await noHorizontalOverflow(page);

    await page.getByTestId('nav-studio').click();
    await expect(page.getByTestId('constraint-banner')).toBeVisible();
    await noHorizontalOverflow(page);
    // Add without dragging, then move with the buttons.
    await page.getByTestId('add-tpl-approval').click();
    await expect(page.getByTestId('journey')).toContainText('Keep approval with the campaign owner');
    const added = page.locator('[data-testid="journey"] li', { hasText: 'Keep approval with the campaign owner' });
    await expect(added).toHaveAttribute('data-position', '5');
    await added.getByRole('button', { name: /^Move .* up$/ }).click();
    await expect(page.getByTestId('announcer')).toContainText('moved to position 4 of 5');
    // The inspector opens as a drawer.
    await page.getByTestId('edit-lesson-1').click();
    const inspector = page.getByTestId('inspector-drawer');
    await expect(inspector).toBeVisible();
    await inspector.getByTestId('field-title').fill('Save the context');
    await inspector.getByTestId('inspector-close').click();
    await expect(page.getByTestId('lesson-lesson-1')).toContainText('Save the context');
    await page.getByTestId('preview-s-claims').click();
    await page.getByTestId('proposal-apply').click();
    await expect(page.getByTestId('suggestion-s-claims')).toHaveAttribute('data-status', 'applied');

    await page.getByTestId('switch-preview').click();
    await expect(page.getByTestId('preview-lesson-title')).toHaveText('Save the context');
    await noHorizontalOverflow(page);
    await page.getByTestId('choice-sort-audience').check();
    await page.getByTestId('check-work').click();
    await expect(page.getByTestId('attempt-summary')).toContainText('Attempt 1');
    await page.getByTestId('retry').click();
    for (const id of ['audience', 'descriptions', 'template']) await page.getByTestId(`choice-sort-${id}`).check();
    await page.getByTestId('check-work').click();
    await expect(page.getByTestId('attempt-summary')).toHaveText('Attempt 2: 2 of 2 criteria demonstrated.');

    await page.getByTestId('nav-review').click();
    await expect(page.getByTestId('review-changes')).toContainText('Check claims before handoff');
    await noHorizontalOverflow(page);
    await page.reload();
    await expect(page.getByTestId('review-changes')).toContainText('Check claims before handoff');
  });
});
