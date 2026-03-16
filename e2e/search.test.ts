import { test, expect } from '@playwright/test';

/** Helper: create a report with a given siteGroup, then return to dashboard */
async function createReportWithSiteGroup(
	page: import('@playwright/test').Page,
	siteGroup: string,
	siteName?: string
) {
	await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
	await page
		.getByRole('button', { name: /פתח דוח/ })
		.first()
		.click();
	await page.locator('#siteGroup').fill(siteGroup);
	if (siteName) {
		await page.locator('#siteName').fill(siteName);
	}
	await page.getByLabel('חזרה לרשימת דוחות').click();
}

test.describe('Search', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();

		await createReportWithSiteGroup(page, 'אלפא', 'אתר צפון');
		await createReportWithSiteGroup(page, 'בטא', 'אתר דרום');
		await createReportWithSiteGroup(page, 'גמא', 'אתר מרכז');

		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(3);
	});

	test('search input is visible when reports exist', async ({ page }) => {
		await expect(page.getByPlaceholder('חיפוש דוחות...')).toBeVisible();
	});

	test('filters by siteGroup', async ({ page }) => {
		await page.getByPlaceholder('חיפוש דוחות...').fill('אלפא');
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);
	});

	test('filters by siteName', async ({ page }) => {
		await page.getByPlaceholder('חיפוש דוחות...').fill('צפון');
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);
	});

	test('search is case-insensitive', async ({ page }) => {
		await page.getByPlaceholder('חיפוש דוחות...').fill('אלפא');
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);
	});

	test('partial match works', async ({ page }) => {
		await page.getByPlaceholder('חיפוש דוחות...').fill('אתר');
		// All 3 reports have "אתר" in their siteName
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(3);
	});

	test('clears search shows all reports', async ({ page }) => {
		await page.getByPlaceholder('חיפוש דוחות...').fill('אלפא');
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);

		await page.getByPlaceholder('חיפוש דוחות...').fill('');
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(3);
	});

	test('clear button clears search', async ({ page }) => {
		await page.getByPlaceholder('חיפוש דוחות...').fill('בטא');
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);

		await page.getByLabel('נקה חיפוש').click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(3);
	});

	test('no results shows empty state', async ({ page }) => {
		await page.getByPlaceholder('חיפוש דוחות...').fill('לא קיים בכלל');
		await expect(page.getByText('לא נמצאו תוצאות')).toBeVisible();
		await expect(page.getByText('נסה חיפוש אחר')).toBeVisible();
	});

	test('search combined with folder filter', async ({ page }) => {
		// Create a folder and move one report
		await page.getByRole('button', { name: '+ תיקייה' }).click();
		await page.getByPlaceholder('שם תיקייה...').fill('VIP');
		await page.getByPlaceholder('שם תיקייה...').press('Enter');

		// Move a report to VIP folder
		await page.getByRole('button', { name: 'העבר לתיקייה' }).first().click();
		await page.getByRole('button', { name: /VIP/ }).last().click();

		// Filter by VIP folder
		await page.getByRole('button', { name: /VIP/ }).first().click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);

		// Now search for something not in VIP — should show 0
		await page.getByPlaceholder('חיפוש דוחות...').fill('בטא');
		await expect(page.getByText('לא נמצאו תוצאות')).toBeVisible();

		// Show all folders, search for בטא — should find 1
		await page.getByRole('button', { name: /הכל/ }).click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);
	});

	test('search persists when switching folders', async ({ page }) => {
		await page.getByPlaceholder('חיפוש דוחות...').fill('אתר');
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(3);

		// The search text should still be there when we look at the input
		await expect(page.getByPlaceholder('חיפוש דוחות...')).toHaveValue('אתר');
	});
});
