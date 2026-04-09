/**
 * Visual Screenshot Capture — All Screens × All Viewports
 * Captures screenshots for visual QA inspection.
 */
import { test, Page } from '@playwright/test';

const BASE = 'http://localhost:5174';

const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
];

const ROUTES = [
  { name: 'dashboard', path: '/' },
  { name: 'tracker', path: '/tracker' },
  { name: 'reports', path: '/reports' },
  { name: 'settings', path: '/settings' },
  { name: 'executive', path: '/executive' },
  { name: 'pipeline', path: '/pipeline' },
  { name: 'methodology', path: '/methodology' },
];

async function waitForReady(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('.ant-spin-spinning');
    return spinners.length === 0;
  }, { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

test.describe('Visual Screenshot Capture', () => {
  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`${route.name} @ ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE}${route.path}`);
        await waitForReady(page);
        await page.screenshot({
          path: `e2e/screenshots/${route.name}-${vp.name}.png`,
          fullPage: true,
        });
      });
    }
  }

  // Dashboard: toggle to Classic view
  test('dashboard-classic @ desktop-1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`);
    await waitForReady(page);
    const classicBtn = page.locator('.ant-segmented-item').filter({ hasText: /classic/i }).first();
    if (await classicBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await classicBtn.click();
      await waitForReady(page);
    }
    await page.screenshot({ path: 'e2e/screenshots/dashboard-classic-desktop-1440.png', fullPage: true });
  });

  // Dashboard: Analytics view explicit
  test('dashboard-analytics @ desktop-1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`);
    await waitForReady(page);
    const analyticsBtn = page.locator('.ant-segmented-item').filter({ hasText: /analytics/i }).first();
    if (await analyticsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await analyticsBtn.click();
      await waitForReady(page);
    }
    await page.screenshot({ path: 'e2e/screenshots/dashboard-analytics-desktop-1440.png', fullPage: true });
  });

  // Tracker with expanded work item
  test('tracker-detail @ desktop-1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/tracker`);
    await waitForReady(page);
    const firstRow = page.locator('.ant-table-row').first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click();
      await waitForReady(page);
    }
    await page.screenshot({ path: 'e2e/screenshots/tracker-detail-desktop-1440.png', fullPage: true });
  });

  // AI chat drawer
  test('ai-drawer @ desktop-1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`);
    await waitForReady(page);
    const fab = page.locator('.app-fab, button[class*="fab"]').first();
    if (await fab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fab.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'e2e/screenshots/ai-drawer-desktop-1440.png', fullPage: true });
  });

  // Notification drawer
  test('notification-drawer @ desktop-1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`);
    await waitForReady(page);
    const bell = page.locator('.ant-badge button').first();
    if (await bell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bell.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'e2e/screenshots/notification-drawer-desktop-1440.png', fullPage: true });
  });

  // Sidebar collapsed
  test('sidebar-collapsed @ desktop-1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`);
    await waitForReady(page);
    const trigger = page.locator('.ant-layout-sider-trigger').first();
    if (await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: 'e2e/screenshots/sidebar-collapsed-desktop-1440.png', fullPage: true });
  });
});
