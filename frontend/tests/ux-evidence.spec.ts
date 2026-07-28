import { expect, test, type Page } from '@playwright/test';

const UX_LAWS_DIR = 'docs/ux-evidence/ux-laws';
const NIELSEN_DIR = 'docs/ux-evidence/nielsen';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Username or Email').fill('patient@example.test');
  await page.locator('#login-password').fill('Patient@Test1');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.locator('[data-evidence-id="portal-shell"]')).toBeVisible();
}

async function openRoute(page: Page, path: string, evidenceId: string) {
  await page.goto(path);
  await expect(page.locator(`[data-evidence-id="${evidenceId}"]`).first()).toBeVisible();
}

async function capture(
  page: Page,
  evidenceId: string,
  path: string,
  options: { fullPage?: boolean; scroll?: boolean } = {},
) {
  const evidence = page.locator(`[data-evidence-id="${evidenceId}"]`).first();
  await expect(evidence, `Missing evidence container: ${evidenceId}`).toBeVisible();
  if (options.scroll !== false && !options.fullPage) await evidence.scrollIntoViewIfNeeded();
  await page.screenshot({
    path,
    fullPage: Boolean(options.fullPage),
    animations: 'disabled',
  });
}

test.describe.serial('UX laws and Nielsen evidence', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard has exactly three keyboard-operable actions wired to real workflows', async ({ page }) => {
    await openRoute(page, '/dashboard', 'dashboard-quick-actions');

    const actions = page.locator('[data-evidence-id="dashboard-quick-actions"] .quick-card');
    await expect(actions).toHaveCount(3);
    await expect(actions).toHaveText([
      /Schedule appointment/,
      /Send message/,
      /Request refill/,
    ]);

    await capture(page, 'dashboard-quick-actions', `${UX_LAWS_DIR}/01-fitts-dashboard-quick-actions.png`);
    await capture(page, 'dashboard-quick-actions', `${UX_LAWS_DIR}/02-hicks-three-actions.png`);
    await capture(page, 'portal-shell', `${UX_LAWS_DIR}/03-jakobs-portal-shell.png`, { scroll: false });
    await capture(page, 'minimalist-dashboard', `${UX_LAWS_DIR}/04-millers-dashboard-chunks.png`, { scroll: false });
    await capture(page, 'dashboard-attention-center', `${UX_LAWS_DIR}/08-zeigarnik-attention.png`);
    await capture(page, 'minimalist-dashboard', `${NIELSEN_DIR}/18-minimalist-dashboard.png`, { scroll: false });

    const scheduleAction = page.getByRole('button', { name: /Schedule appointment/ });
    await scheduleAction.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Schedule new appointment' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(scheduleAction).toBeFocused();

    await page.getByRole('button', { name: /Send message/ }).click();
    await expect(page.getByRole('heading', { name: 'Message care team' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();

    await page.getByRole('button', { name: /Request refill/ }).click();
    await expect(page).toHaveURL(/\/prescriptions$/);
    await expect(page.locator('[data-evidence-id="refill-recognition-form"]')).toBeVisible();
    await capture(page, 'refill-recognition-form', `${NIELSEN_DIR}/16-recognition.png`);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('health records use common regions, grouped lab rows, and visible filter context', async ({ page }) => {
    await openRoute(page, '/records', 'health-records-common-regions');
    await capture(page, 'health-records-common-regions', `${UX_LAWS_DIR}/06-common-region-records.png`, { scroll: false });

    const laboratoryRegion = page.locator('[data-evidence-id="records-laboratory-results"]');
    await expect(laboratoryRegion.getByRole('columnheader', { name: 'Value and unit' })).toBeVisible();
    await expect(laboratoryRegion.getByRole('columnheader', { name: 'Reference range' })).toBeVisible();
    await expect(laboratoryRegion.getByRole('columnheader', { name: 'Written status' })).toBeVisible();
    await expect(laboratoryRegion.getByRole('columnheader', { name: 'Observed' })).toBeVisible();
    await capture(page, 'records-laboratory-results', `${UX_LAWS_DIR}/05-proximity-laboratory-row.png`);

    const search = page.getByLabel('Search health records');
    await search.fill('Glucose');
    await search.focus();
    await expect(page.getByText('Filter: “Glucose”')).toBeVisible();
    await expect(laboratoryRegion.getByRole('row')).toHaveCount(2);
    await capture(page, 'records-search-filters', `${NIELSEN_DIR}/17-flexibility-efficiency.png`);
  });

  test('appointment validation, immediate feedback, duplicate prevention, confirmation, and user control', async ({ page }) => {
    await openRoute(page, '/appointments', 'patient-friendly-appointments');
    await capture(page, 'patient-friendly-appointments', `${NIELSEN_DIR}/12-real-world-language.png`);

    await page.getByRole('button', { name: 'Schedule New Appointment' }).click();
    await page.locator('#visit-date').fill('');
    await page.locator('#visit-reason').fill('');
    await page.getByRole('button', { name: 'Send request', exact: true }).click();
    await expect(page.locator('#appointment-form-error')).toBeVisible();
    await expect(page.locator('#appointment-form-error')).toContainText('Missing required scheduling fields');
    await expect(page.locator('#appointment-form-error')).toBeFocused();
    await capture(page, 'appointment-workflow-form', `${NIELSEN_DIR}/15-error-prevention.png`);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();

    await page.getByRole('button', { name: 'Schedule New Appointment' }).click();
    await page.locator('#visit-reason').fill('Annual preventive care visit');
    await page.locator('#visit-notes').fill('Please confirm whether fasting is required.');

    let releaseRequest = () => {};
    let requestCount = 0;
    const requestGate = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await page.route('**/api/appointments/requests', async (route) => {
      requestCount += 1;
      await requestGate;
      await route.continue();
    });

    const submit = page.getByRole('button', { name: 'Send request', exact: true });
    await submit.click();
    await expect(page.getByRole('button', { name: /Sending request/ })).toBeDisabled();
    await expect(page.getByText('Sending appointment request…')).toBeVisible();
    await page.getByRole('button', { name: /Sending request/ }).evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await capture(page, 'appointment-operation-status', `${UX_LAWS_DIR}/10-doherty-feedback.png`);
    await capture(page, 'appointment-operation-status', `${NIELSEN_DIR}/11-system-status.png`);
    expect(requestCount).toBe(1);

    releaseRequest();
    await expect(page.locator('[data-evidence-id="appointment-workflow-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-evidence-id="appointment-workflow-confirmation"] h2')).toBeFocused();
    await expect(page.getByText(/Reference/)).toBeVisible();
    await expect(page.getByText(/What happens next/)).toBeVisible();
    await capture(page, 'appointment-workflow-confirmation', `${UX_LAWS_DIR}/09-peak-end-confirmation.png`);
    await page.unroute('**/api/appointments/requests');
    await page.getByRole('button', { name: 'View appointments' }).click();

    const fastActions = page.locator('.appointments-summary article').filter({ hasText: 'Fast Actions' });
    await fastActions.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-evidence-id="destructive-confirmation"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep / Go back' })).toBeVisible();
    await capture(page, 'destructive-confirmation', `${NIELSEN_DIR}/13-user-control.png`);
    await page.getByRole('button', { name: 'Keep / Go back' }).click();
  });

  test('refill request prevents repeated submission and ends with a specific confirmation', async ({ page }) => {
    await openRoute(page, '/dashboard', 'dashboard-quick-actions');
    await page.getByRole('button', { name: /Request refill/ }).click();
    const refillForm = page.locator('[data-evidence-id="refill-recognition-form"]');
    await expect(refillForm.getByText('Medication', { exact: true })).toBeVisible();
    await expect(refillForm.getByText('Prescriber', { exact: true })).toBeVisible();
    await expect(refillForm.getByText('Preferred pharmacy', { exact: true })).toBeVisible();

    let requestCount = 0;
    page.on('request', (request) => {
      if (/\/api\/prescriptions\/.+\/refills$/.test(request.url())) requestCount += 1;
    });
    const submit = page.getByRole('button', { name: 'Submit refill request' });
    await submit.click();
    await expect(page.locator('[data-evidence-id="refill-workflow-confirmation"]')).toBeVisible();
    expect(requestCount).toBe(1);
    await expect(page.locator('[data-evidence-id="refill-workflow-confirmation"]')).toContainText('Refill request received');
    await expect(page.locator('[data-evidence-id="refill-workflow-confirmation"]')).toContainText('Reference');
  });

  test('controlled message failure preserves text and offers retry', async ({ page }) => {
    await openRoute(page, '/messages', 'message-error-recovery');
    const reply = page.getByLabel('Message reply');
    const preservedText = 'I need help understanding my latest result.';
    await reply.fill(preservedText);

    await page.route('**/api/messages/conversations/*/messages', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'TEST_MESSAGE_UNAVAILABLE',
          message: 'Secure messaging is temporarily unavailable. Please try again.',
          status: 503,
        }),
      });
    });
    await page.getByRole('button', { name: /^Send/ }).click();
    await expect(page.getByText('Message not sent.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry sending' })).toBeVisible();
    await expect(reply).toHaveValue(preservedText);
    await capture(page, 'message-error-recovery', `${NIELSEN_DIR}/19-error-recovery.png`);

    await page.unroute('**/api/messages/conversations/*/messages');
    await page.getByRole('button', { name: 'Retry sending' }).click();
    await expect(reply).toHaveValue('');
  });

  test('status hierarchy, consistent shell, and four workflow confirmations remain real and data-driven', async ({ page }) => {
    await openRoute(page, '/billing', 'von-restorff-statuses');
    await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Overdue', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();
    await capture(page, 'von-restorff-statuses', `${UX_LAWS_DIR}/07-von-restorff-statuses.png`, { scroll: false });
    await capture(page, 'portal-shell', `${NIELSEN_DIR}/14-consistency.png`, { scroll: false });

    await page.getByRole('button', { name: /Pay Full Balance/ }).click();
    const paymentConfirmation = page.locator('[data-evidence-id="payment-workflow-confirmation"]');
    await expect(paymentConfirmation).toContainText('Payment processed');
    await expect(paymentConfirmation).toContainText('NPR');
    await page.getByRole('button', { name: 'Review billing' }).click();

    await openRoute(page, '/dashboard', 'dashboard-attention-center');
    await expect(page.getByText('billing-balance')).toHaveCount(0);

    await openRoute(page, '/family', 'portal-shell');
    await page.getByRole('button', { name: 'Invite Proxy' }).click();
    await page.locator('#proxy-name').fill('Evidence Proxy');
    await page.locator('#proxy-email').fill('evidence.proxy@example.test');
    await page.getByRole('button', { name: 'Send invite' }).click();
    const proxyConfirmation = page.locator('[data-evidence-id="proxy-workflow-confirmation"]');
    await expect(proxyConfirmation).toContainText('Proxy invitation sent');
    await expect(proxyConfirmation).toContainText('Invitation');
  });

  test('categorized help is accessible from the familiar header', async ({ page }) => {
    await openRoute(page, '/dashboard', 'portal-shell');
    await page.getByRole('button', { name: 'Help' }).click();
    const help = page.locator('[data-evidence-id="help-documentation"]');
    await expect(help).toBeVisible();
    await expect(help.getByRole('heading', { name: 'Appointments' })).toBeVisible();
    await expect(help.getByRole('heading', { name: 'Secure messages' })).toBeVisible();
    await expect(help.getByRole('heading', { name: 'Prescriptions and refills' })).toBeVisible();
    await expect(help.getByRole('heading', { name: 'Bills and payments' })).toBeVisible();
    await expect(help.getByRole('heading', { name: 'Family and proxy access' })).toBeVisible();
    await expect(help.getByText('This portal is not for urgent care.')).toBeVisible();
    await capture(page, 'help-documentation', `${NIELSEN_DIR}/20-help-documentation.png`);
  });

  test('primary dashboard actions remain operable on tablet and mobile viewports', async ({ page }) => {
    for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await openRoute(page, '/dashboard', 'dashboard-quick-actions');

      const actions = page.locator('[data-evidence-id="dashboard-quick-actions"] .quick-card');
      await expect(actions).toHaveCount(3);
      for (const action of await actions.all()) {
        await expect(action).toBeVisible();
        const box = await action.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect((box?.x || 0) + (box?.width || 0)).toBeLessThanOrEqual(viewport.width + 1);
      }

      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(1);
    }
  });
});
