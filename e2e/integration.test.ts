import { test, expect } from '@playwright/test';

test.describe('Full inspection flow', () => {
	test('complete end-to-end inspection workflow', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();

		// Step 1: Create report from dashboard
		await page.getByRole('button', { name: 'בדיקה חדשה', exact: true }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();

		// Step 2: Fill meta
		await page.locator('#siteGroup').fill('אנרגיה ירוקה');
		await page.locator('#siteName').fill('מפעל השמש');
		await page.locator('#inspectionDate').fill('2026-03-15');
		await page.locator('#inspectorName').fill('דן כהן');

		// Verify header updates
		await expect(page.locator('header h1')).toContainText('אנרגיה ירוקה - מפעל השמש');

		// Step 3: Configure inverters
		await page.getByRole('button', { name: /הגדרת מערכת/ }).click();
		await page.getByRole('button', { name: 'הוסף ממיר' }).click();
		await expect(page.getByText('ממיר 2')).toBeVisible();

		// Step 4: Mark some checklist items
		await page.getByRole('button', { name: /סעיפי בדיקה/ }).click();
		// Mark first 3 items as OK
		const okLabels = page.locator('label', { hasText: 'תקין' });
		await okLabels.nth(0).click();
		await okLabels.nth(1).click();
		await okLabels.nth(2).click();
		// Mark 4th as not OK
		await page.locator('label', { hasText: 'לא תקין' }).nth(3).click();

		// Step 5: Add a manual defect
		await page.getByRole('button', { name: /ליקויים/ }).click();
		// Auto defect should be visible from the failed item
		await expect(page.getByText('ליקויים מהבדיקות החזותיות')).toBeVisible();

		// Add manual defect
		await page.getByRole('button', { name: '+ הוסף ליקוי' }).click();
		await page.locator('#defect-component-0').selectOption('קונסטרוקציה');
		await page.locator('#defect-fault-0').fill('חלודה בברגים');
		await page.locator('#defect-location-0').fill('גג מערבי');

		// Step 6: Check summary
		await page.getByRole('button', { name: /סיכום/ }).click();
		await expect(page.getByText('פרטי אתר')).toBeVisible();
		await expect(page.getByText('לקוח: אנרגיה ירוקה')).toBeVisible();
		await expect(page.getByText('אתר: מפעל השמש')).toBeVisible();
		await expect(page.getByText('בודק: דן כהן')).toBeVisible();

		// Should show defect count (auto + manual)
		await expect(page.getByText(/ליקויים תועדו/)).toBeVisible();

		// Step 7: Export
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: /ייצוא לאקסל/ }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toContain('.xlsx');

		// Step 8: Return to dashboard (use back arrow since summary also has a button)
		await page.getByLabel('חזרה לרשימת דוחות').click();
		await expect(page.locator('h3', { hasText: 'אנרגיה ירוקה - מפעל השמש' })).toBeVisible();
	});
});

test.describe('Data persistence', () => {
	test('report data persists after closing and reopening', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();

		// Create and fill a report
		await page.getByRole('button', { name: 'בדיקה חדשה', exact: true }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();
		await page.locator('#siteGroup').fill('חברה א');
		await page.locator('#siteName').fill('אתר 1');
		await page.locator('#inspectorName').fill('בודק 1');

		// Go to config and add inverter
		await page.getByRole('button', { name: /הגדרת מערכת/ }).click();
		await page.getByRole('button', { name: 'הוסף ממיר' }).click();

		// Go to checklist and mark an item
		await page.getByRole('button', { name: /סעיפי בדיקה/ }).click();
		await page.locator('label', { hasText: 'תקין' }).first().click();

		// Return to dashboard
		await page.getByLabel('חזרה לרשימת דוחות').click();

		// Reopen the same report
		await page.getByRole('button', { name: /פתח דוח/ }).click();

		// Verify meta persisted
		await expect(page.locator('#siteGroup')).toHaveValue('חברה א');
		await expect(page.locator('#siteName')).toHaveValue('אתר 1');
		await expect(page.locator('#inspectorName')).toHaveValue('בודק 1');

		// Verify inverter config persisted
		await page.getByRole('button', { name: /הגדרת מערכת/ }).click();
		await expect(page.getByText('ממיר 2')).toBeVisible();

		// Verify checklist persisted
		await page.getByRole('button', { name: /סעיפי בדיקה/ }).click();
		const okLabel = page.locator('label', { hasText: 'תקין' }).first();
		await expect(okLabel).toContainText('✓');
	});

	test('data persists across page reloads', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();

		await page.getByRole('button', { name: 'בדיקה חדשה', exact: true }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();
		await page.locator('#siteGroup').fill('נשמר אחרי רענון');
		await page.getByLabel('חזרה לרשימת דוחות').click();

		// Reload the page
		await page.reload();

		// Report should still be there
		await expect(page.getByText('נשמר אחרי רענון')).toBeVisible();

		// Open and verify data
		await page.getByRole('button', { name: /פתח דוח/ }).click();
		await expect(page.locator('#siteGroup')).toHaveValue('נשמר אחרי רענון');
	});
});

test.describe('Multiple reports workflow', () => {
	test('manages multiple reports independently', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();

		// Create report 1
		await page.getByRole('button', { name: 'בדיקה חדשה', exact: true }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();
		await page.locator('#siteGroup').fill('לקוח ראשון');
		await page.locator('#siteName').fill('אתר ראשון');
		await page.getByLabel('חזרה לרשימת דוחות').click();

		// Create report 2
		await page.getByRole('button', { name: 'בדיקה חדשה', exact: true }).click();
		await page
			.getByRole('button', { name: /פתח דוח/ })
			.first()
			.click();
		await page.locator('#siteGroup').fill('לקוח שני');
		await page.locator('#siteName').fill('אתר שני');
		await page.getByLabel('חזרה לרשימת דוחות').click();

		// Verify both reports listed
		await expect(page.getByText('לקוח ראשון - אתר ראשון')).toBeVisible();
		await expect(page.getByText('לקוח שני - אתר שני')).toBeVisible();

		// Open report 1 and verify its data
		await page.getByText('לקוח ראשון - אתר ראשון').click();
		await expect(page.locator('#siteGroup')).toHaveValue('לקוח ראשון');
		await page.getByLabel('חזרה לרשימת דוחות').click();

		// Open report 2 and verify its data
		await page.getByText('לקוח שני - אתר שני').click();
		await expect(page.locator('#siteGroup')).toHaveValue('לקוח שני');
	});

	test('deleting one report does not affect others', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();

		// Create 3 reports sequentially (wait for animations between each)
		await page.getByRole('button', { name: 'בדיקה חדשה', exact: true }).click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);
		await page.getByRole('button', { name: 'בדיקה חדשה', exact: true }).click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(2);
		await page.getByRole('button', { name: 'בדיקה חדשה', exact: true }).click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(3);

		// Delete the first one
		await page.getByRole('button', { name: 'מחק דוח' }).first().click();
		await page.getByRole('dialog').getByRole('button', { name: 'מחק' }).click();

		// Should have 2 remaining
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(2);
	});
});

test.describe('Folder-based organization', () => {
	test('creates folder, moves report, and filters correctly', async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();

		// Create a folder
		await page.getByRole('button', { name: '+ תיקייה' }).click();
		await page.getByPlaceholder('שם תיקייה...').fill('חשוב');
		await page.getByPlaceholder('שם תיקייה...').press('Enter');

		// Create a report
		await page.getByRole('button', { name: 'בדיקה חדשה', exact: true }).click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);

		// Move report to folder
		await page.getByRole('button', { name: 'העבר לתיקייה' }).click();
		await page.getByRole('button', { name: /חשוב/ }).last().click();

		// Filter by that folder — should see 1
		await page.getByRole('button', { name: /חשוב/ }).first().click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);

		// Show all — should still see 1
		await page.getByRole('button', { name: /הכל/ }).click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);
	});
});
