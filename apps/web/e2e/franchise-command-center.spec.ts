import { expect, test, type Page } from '@playwright/test';

const email = process.env.GRID_E2E_EMAIL || 'qa_auto_browser_0045@example.com';
const password = process.env.GRID_E2E_PASSWORD || 'GridQA123!';
let runtimeErrors: string[] = [];

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByText('GRID Dynasty', { exact: true })).toBeVisible();
  await expect(page.getByText('Franchise command center', { exact: true })).toBeVisible();
}

async function openSection(page: Page, name: string) {
  await page.locator('.fcc-sidebar nav').getByRole('button', { name: new RegExp(`^${name}\b`) }).click();
}

function commandTabs(page: Page) {
  return page.locator('.fcc-segmented');
}

test.describe('Franchise Command Center', () => {
  test.beforeEach(async ({ page }) => {
    runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    await login(page);
  });

  test.afterEach(() => {
    expect(runtimeErrors, `Unexpected browser errors:\n${runtimeErrors.join('\n')}`).toEqual([]);
  });

  test('all primary navigation sections open their expected workspace', async ({ page }) => {
    await openSection(page, 'Team');
    await expect(page.getByRole('button', { name: 'Roster', exact: true }).first()).toBeVisible();

    await openSection(page, 'Development');
    await expect(page.getByRole('heading', { name: 'Development', exact: true })).toBeVisible();
    await expect(commandTabs(page).getByRole('button', { name: 'Training', exact: true })).toBeVisible();
    await expect(commandTabs(page).getByRole('button', { name: 'Recovery', exact: true })).toBeVisible();
    await expect(commandTabs(page).getByRole('button', { name: 'Equipment', exact: true })).toBeVisible();

    await openSection(page, 'Games');
    await expect(page.locator('body')).toContainText(/Games|Schedule|Match/i);

    await openSection(page, 'League');
    await expect(page.locator('body')).toContainText(/Leaderboard|League|Standings|Rankings/i);

    await openSection(page, 'Market');
    await expect(page.locator('body')).toContainText(/Marketplace|Market|Listings/i);

    await openSection(page, 'Facilities');
    await expect(page.getByRole('heading', { name: 'Facilities', exact: true })).toBeVisible();
    await expect(commandTabs(page).getByRole('button', { name: 'Stadium', exact: true })).toBeVisible();
    await expect(commandTabs(page).getByRole('button', { name: 'Transport', exact: true })).toBeVisible();

    await openSection(page, 'Finance');
    await expect(page.locator('body')).toContainText(/Wallet|CASH|DYN|Ledger/i);

    await openSection(page, 'Campus');
    await expect(page.locator('body')).toContainText(/League Headquarters|League Islands|GRID League Council/i);

    await openSection(page, 'Home');
    await expect(page.getByText('Franchise command center', { exact: true })).toBeVisible();
  });

  test('development and facilities tabs switch to the correct functions', async ({ page }) => {
    await openSection(page, 'Development');

    await commandTabs(page).getByRole('button', { name: 'Training', exact: true }).click();
    await expect(page.locator('body')).toContainText(/Training|Start Training|Training Programs/i);

    await commandTabs(page).getByRole('button', { name: 'Recovery', exact: true }).click();
    await expect(page.locator('body')).toContainText(/Medical|Recovery|Healthy|Treat/i);

    await commandTabs(page).getByRole('button', { name: 'Equipment', exact: true }).click();
    await expect(page.locator('body')).toContainText(/Equipment|Gear|Durability|Owned/i);

    await openSection(page, 'Facilities');
    await commandTabs(page).getByRole('button', { name: 'Stadium', exact: true }).click();
    await expect(page.locator('body')).toContainText(/Stadium|Venue|Capacity|Upgrade/i);

    await commandTabs(page).getByRole('button', { name: 'Transport', exact: true }).click();
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
    await page.locator('.fcc-sidebar nav').getByRole('button', { name: /^Games\b/ }).click();
    await expect(page.locator('.fcc-sidebar')).not.toHaveClass(/is-open/);
    await expect(page.locator('body')).toContainText(/Games|Schedule|Match/i);
  });
});
