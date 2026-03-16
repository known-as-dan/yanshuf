import { test, expect } from '@playwright/test';

test.describe('Export - Excel', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();
	});

	test('exports empty report from summary step', async ({ page }) => {
		await page.getByRole('button', { name: /סיכום/ }).click();

		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: /ייצוא לאקסל/ }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toContain('.xlsx');
	});

	test('export button shows exporting state', async ({ page }) => {
		await page.getByRole('button', { name: /סיכום/ }).click();

		await page.getByRole('button', { name: /ייצוא לאקסל/ }).click();
		// Should briefly show exporting state
		// Then show success
		await expect(page.getByText('יוצא בהצלחה!')).toBeVisible({ timeout: 10000 });
	});

	test('exports report with filled meta from summary', async ({ page }) => {
		await page.locator('#siteGroup').fill('חברת טסט');
		await page.locator('#siteName').fill('אתר דמו');
		await page.locator('#inspectorName').fill('בודק');
		await page.locator('#inspectionDate').fill('2026-03-15');

		await page.getByRole('button', { name: /סיכום/ }).click();
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: /ייצוא לאקסל/ }).click();
		const download = await downloadPromise;

		// Filename should contain the meta info
		const filename = download.suggestedFilename();
		expect(filename).toContain('.xlsx');
		expect(filename).toContain('פרוטוקול');
	});

	test('exports from dashboard', async ({ page }) => {
		await page.getByLabel('חזרה לרשימת דוחות').click();

		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: 'ייצוא לאקסל' }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toContain('.xlsx');
	});

	test('dashboard export shows success toast', async ({ page }) => {
		await page.getByLabel('חזרה לרשימת דוחות').click();

		await page.getByRole('button', { name: 'ייצוא לאקסל' }).click();
		await expect(page.getByText('יוצא בהצלחה')).toBeVisible({ timeout: 10000 });
	});
});

test.describe('Export - with data', () => {
	test('exports report with checklist items marked', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();

		// Fill meta
		await page.locator('#siteGroup').fill('אנרגיה');
		await page.locator('#siteName').fill('מפעל');

		// Mark some checklist items
		await page.getByRole('button', { name: /סעיפי בדיקה/ }).click();
		const okLabels = page.locator('label', { hasText: 'תקין' });
		// Mark first 3 items OK
		for (let i = 0; i < 3; i++) {
			await okLabels.nth(i).click();
		}

		// Export
		await page.getByRole('button', { name: /סיכום/ }).click();
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: /ייצוא לאקסל/ }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toContain('.xlsx');
	});

	test('exports report with defects', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();

		// Add a defect
		await page.getByRole('button', { name: /ליקויים/ }).click();
		await page.getByRole('button', { name: '+ הוסף ליקוי' }).click();
		await page.locator('#defect-component-0').selectOption('פנלים');
		await page.locator('#defect-fault-0').fill('סדק');
		await page.locator('#defect-location-0').fill('גג');

		// Export
		await page.getByRole('button', { name: /סיכום/ }).click();
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: /ייצוא לאקסל/ }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toContain('.xlsx');
	});
});
