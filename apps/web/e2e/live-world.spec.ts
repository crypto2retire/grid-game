import { expect, test, type Page } from '@playwright/test';

const email = process.env.GRID_E2E_EMAIL || 'qa_auto_browser_0045@example.com';
const password = process.env.GRID_E2E_PASSWORD || 'GridQA123!';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByLabel('Interactive isometric sports world')).toBeVisible();
  const hide = page.getByRole('button', { name: 'Hide' });
  if (await hide.isVisible().catch(() => false)) await hide.click();
}

async function exitInterior(page: Page) {
  const exit = page.getByRole('button', { name: 'Exit to Grid City' });
  if (await exit.isVisible().catch(() => false)) await exit.click();
}

async function openBuilding(page: Page, label: string) {
  await exitInterior(page);
  await page.getByText(label, { exact: true }).first().click();
  await expect(page.getByText(`Entered ${label}`).or(page.getByRole('heading', { name: label }))).toBeVisible();
}

test.describe('GRID live world regression', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await login(page);
    await page.evaluate(() => ((window as any).__gridE2eErrors = []));
    await page.exposeFunction('__recordGridE2eError', (message: string) => errors.push(message));
  });

  test('each building opens and core panels land on the correct tab', async ({ page }) => {
    const buildings = [
      ['Home Stadium', /Venue|Game Day Revenue|Stadium/i],
      ['Practice Field', /Games|Schedule New Game|Game History/i],
      ['Clubhouse HQ', /Welcome to Grid City|How to Play|Daily ops/i],
      ['Sports Market', /Marketplace|Buy with CASH|Market/i],
      ['Commissioner Office', /Commissioner|Fund Commissioner Cycle|Restock/i],
      ['Trophy Hall', /Leaderboard|Prestige|Players/i],
      ['Team Garage', /Transport Garage|Fleet Overview|Vehicle/i],
      ['Sponsor Bank', /Wallet|Recent Ledger Activity|Add CASH/i],
    ] as const;

    for (const [building, pattern] of buildings) {
      await openBuilding(page, building);
      await expect(page.locator('body')).toContainText(pattern);
    }

    await openBuilding(page, 'Training Gym');
    await expect(page.locator('body')).toContainText(/Basic Strength|Start Training|Training/);
    await expect(page.locator('body')).not.toContainText('Roster (43/43)');

    await openBuilding(page, 'Medical Center');
    await expect(page.locator('body')).toContainText(/Medical Center|Roster is healthy|Treat/);
    await expect(page.locator('body')).not.toContainText('Roster (43/43)');

    await openBuilding(page, 'Locker Room');
    await expect(page.getByRole('button', { name: 'Roster' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Player Training' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Equipment' }).first()).toBeVisible();
  });

  test('locker room player drawer opens with overview, train, medical, and equip tabs', async ({ page }) => {
    await openBuilding(page, 'Locker Room');
    await page.locator('.card-lift > div').first().click();
    await expect(page.locator('.max-w-3xl')).toBeVisible();
    await expect(page.locator('.max-w-3xl')).toContainText('Overview');
    await expect(page.locator('.max-w-3xl')).toContainText('Train');
    await expect(page.locator('.max-w-3xl')).toContainText('Medical');
    await expect(page.locator('.max-w-3xl')).toContainText('Equip');
    await page.locator('.max-w-3xl').getByRole('button', { name: 'Train' }).click();
    await expect(page.locator('.max-w-3xl')).toContainText(/Position-group quick actions|Train all|Train offense|Train defense/);
    await page.locator('.max-w-3xl').getByRole('button', { name: 'Medical' }).click();
    await expect(page.locator('.max-w-3xl')).toContainText('Health & Recovery');
    await page.locator('.max-w-3xl').getByRole('button', { name: 'Equip' }).click();
    await expect(page.locator('.max-w-3xl')).toContainText(/No items owned|Durability|Equip|Unequip/);
  });

  test('hotbar match, drill, and scout controls respond', async ({ page }) => {
    await page.getByRole('button', { name: /1\s*🏟️\s*Match/ }).click();
    await expect(page.locator('body')).toContainText(/Entered Practice Field|Games/);
    await page.getByRole('button', { name: /2\s*💪\s*Drill/ }).click();
    await expect(page.locator('body')).toContainText(/Team Drill Challenge|cooldown|daily cap/i);
    await page.getByRole('button', { name: /3\s*🔭\s*Scout/ }).click();
    await expect(page.locator('body')).toContainText(/Prospect Combine Scan|cooldown|daily cap/i);
  });
});
