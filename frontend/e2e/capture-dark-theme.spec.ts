/**
 * Quick dark analytics theme verification screenshots
 */
import { test, Page } from '@playwright/test';

const BASE = 'http://localhost:5174';

async function waitForReady(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
}

test.describe('Dark Analytics Theme Verification', () => {
  test('analytics-dark-1920', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(BASE);
    await waitForReady(page);
    // Make sure we're on analytics view
    const analyticsBtn = page.locator('.ant-segmented-item').filter({ hasText: /analytics/i }).first();
    if (await analyticsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await analyticsBtn.click();
      await waitForReady(page);
    }
    await page.screenshot({ path: 'e2e/screenshots/dark-analytics-1920.png', fullPage: true });
  });

  test('analytics-dark-1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE);
    await waitForReady(page);
    const analyticsBtn = page.locator('.ant-segmented-item').filter({ hasText: /analytics/i }).first();
    if (await analyticsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await analyticsBtn.click();
      await waitForReady(page);
    }
    await page.screenshot({ path: 'e2e/screenshots/dark-analytics-1440.png', fullPage: true });
  });

  test('analytics-dark-768', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE);
    await waitForReady(page);
    const analyticsBtn = page.locator('.ant-segmented-item').filter({ hasText: /analytics/i }).first();
    if (await analyticsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await analyticsBtn.click();
      await waitForReady(page);
    }
    await page.screenshot({ path: 'e2e/screenshots/dark-analytics-768.png', fullPage: true });
  });

  test('analytics-dark-375', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE);
    await waitForReady(page);
    const analyticsBtn = page.locator('.ant-segmented-item').filter({ hasText: /analytics/i }).first();
    if (await analyticsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await analyticsBtn.click();
      await waitForReady(page);
    }
    await page.screenshot({ path: 'e2e/screenshots/dark-analytics-375.png', fullPage: true });
  });

  test('classic-view-1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE);
    await waitForReady(page);
    const classicBtn = page.locator('.ant-segmented-item').filter({ hasText: /classic/i }).first();
    if (await classicBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await classicBtn.click();
      await waitForReady(page);
    }
    await page.screenshot({ path: 'e2e/screenshots/dark-classic-1440.png', fullPage: true });
  });

  // Also capture other pages to confirm layout fixes
  test('tracker-1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/tracker`);
    await waitForReady(page);
    await page.screenshot({ path: 'e2e/screenshots/post-fix-tracker-1440.png', fullPage: true });
  });

  test('settings-1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/settings`);
    await waitForReady(page);
    await page.screenshot({ path: 'e2e/screenshots/post-fix-settings-1440.png', fullPage: true });
  });
});
