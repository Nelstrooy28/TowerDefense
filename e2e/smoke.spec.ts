import { test, expect } from '@playwright/test';

test('Garden Bastion TD smoke test: start Easy match, place Tomato, run wave 1', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.locator('#lobby-play-btn')).toBeVisible();

  await page.click('#lobby-play-btn');
  await expect(page.locator('#hud-cash-text')).toHaveText('600');

  // Select Tomato Tosser (hotkey 1) and place on lawn
  await page.keyboard.press('1');
  await page.mouse.click(540, 320);

  // Switch to 3x speed and start wave 1
  await page.click('#hud-speed-btn');
  await page.click('#hud-speed-btn');
  await page.keyboard.press('Space');

  // Wait briefly for combat and check no errors
  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});
