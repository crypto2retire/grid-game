import { expect, test, type Page } from '@playwright/test';

const email = process.env.GRID_E2E_EMAIL || 'qa_auto_browser_0045@example.com';
const password = process.env.GRID_E2E_PASSWORD || 'GridQA123!';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByText('GRID Dynasty', { exact: true })).toBeVisible();
  await expect(page.getByText('Franchise command center', { exact: true })).toBeVisible();
}

async function openSection(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
}

test.describe('Franchise Command Center', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await login(page);
    await page.evaluate(() => {
      (window as typeof window & { __fccErrors?: string[] }).__fccErrors = [];
    });
    await page.exposeFunction('__recordFccError', (message: string) => errors.push(message));
  });

  test('all primary navigation sections open their expected workspace', async ({ page }) => {
    await openSection(page, 'Team');
    await expect(page.getByRole('button', { name: 'Roster' }).first()).toBeVisible();

    await openSection(page, 'Development');
    await expect(page.getByRole('heading', { name: 'Development' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Training' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recovery' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Equipment' })).toBeVisible();

    await openSection(page, 'Games');
    await expect(page.locator('body')).toContainText(/Games|Schedule|Match/i);

    await openSection(page, 'League');
    await expect(page.locator('body')).toContainText(/Leaderboard|League|Standings|Rankings/i);

    await openSection(page, 'Market');
    await expect(page.locator('body')).toContainText(/Marketplace|Market|Listings/i);

    await openSection(page, 'Facilities');
    await expect(page.getByRole('heading', { name: 'Facilities' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stadium' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transport' })).toBeVisible();

    await openSection(page, 'Finance');
    await expect(page.locator('body')).toContainText(/Wallet|CASH|DYN|Ledger/i);

    await openSection(page, 'Campus');
    await expect(page.locator('body')).toContainText(/League Headquarters|League Islands|GRID League Council/i);

    await openSection(page, 'Home');
    await expect(page.getByText('Franchise command center', { exact: true })).toBeVisible();
  });

  test('development and facilities tabs switch to the correct functions', async ({ page }) => {
    await openSection(page, 'Development');

    await page.getByRole('button', { name: 'Training' }).click();
    await expect(page.locator('body')).toContainText(/Training|Start Training|Training Programs/i);

    await page.getByRole('button', { name: 'Recovery' }).click();
    await expect(page.locator('body')).toContainText(/Medical|Recovery|Healthy|Treat/i);

    await page.getByRole('button', { name: 'Equipment' }).click();
    await expect(page.locator('body')).toContainText(/Equipment|Gear|Durability|Owned/i);

    await openSection(page, 'Facilities');
    await page.getByRole('button', { name: 'Stadium' }).click();
    await expect(page.locator('body')).toContainText(/Stadium|Venue|Capacity|Upgrade/i);

    await page.getByRole('button', { name: 'Transport' }).click();
    await expect(page.locator('body')).toContainText(/Transport|Fleet|Vehicle|Maintenance/i);
  });

  test('team selector and mobile navigation controls respond', async ({ page }) => {
    const teamSelect = page.locator('.fcc-team-select select');
    await expect(teamSelect).toBeVisible();
    const options = await teamSelect.locator('option').count();
    if (options > 1) {
      const secondValue = await teamSelect.locator('option').nth(1).getAttribute('value');
      if (secondValue) {
        await teamSelect.selectOption(secondValue);
        await expect(teamSelect).toHaveValue(secondValue);
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const menuButton = page.locator('.fcc-mobile-menu');
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.locator('.fcc-sidebar')).toHaveClass(/is-open/);
    await page.getByRole('button', { name: /^Games/ }).first().click();
    await expect(page.locator('.fcc-sidebar')).not.toHaveClass(/is-open/);
    await expect(page.locator('body')).toContainText(/Games|Schedule|Match/i);
  });
});
