import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
	});

	test('shows app header and logo', async ({ page }) => {
		await expect(page.locator('h1', { hasText: 'ינשוף' })).toBeVisible();
		await expect(page.getByText('בדיקות תקופתיות PV')).toBeVisible();
		await expect(page.locator('img[alt="ינשוף"]')).toBeVisible();
	});

	test('shows empty state initially', async ({ page }) => {
		await expect(page.getByText('אין דוחות עדיין')).toBeVisible();
		await expect(page.getByText('לחץ "בדיקה חדשה" להתחיל')).toBeVisible();
	});

	test('creates a new report', async ({ page }) => {
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toBeVisible();
	});

	test('opens a report into wizard', async ({ page }) => {
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();
		await expect(page.locator('header h1')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'פרטי בדיקה' })).toBeVisible();
	});

	test('deletes a report', async ({ page }) => {
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toBeVisible();

		await page.getByRole('button', { name: 'מחק דוח' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'מחק' }).click();
		await expect(page.getByText('אין דוחות עדיין')).toBeVisible();
	});

	test('duplicates a report', async ({ page }) => {
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: 'שכפל דוח' }).click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(2);
	});

	test('report card shows updated timestamp', async ({ page }) => {
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await expect(page.getByText(/עודכן/)).toBeVisible();
	});

	test('report name updates from meta fields', async ({ page }) => {
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();

		await page.locator('#siteGroup').fill('חברת אנרגיה');
		await page.locator('#siteName').fill('אתר מרכזי');
		await page.getByLabel('חזרה לרשימת דוחות').click();

		// Report name should update to show the filled fields
		await expect(page.getByText('חברת אנרגיה - אתר מרכזי')).toBeVisible();
	});

	test('creates multiple reports and lists them', async ({ page }) => {
		const newBtn = page.getByRole('button', { name: 'בדיקה חדשה', exact: true });
		await newBtn.click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);
		await newBtn.click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(2);
		await newBtn.click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(3);
	});

	test('raw data backup export works', async ({ page }) => {
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: 'ייצוא גיבוי נתונים' }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toContain('yanshuf-backup');
		expect(download.suggestedFilename()).toContain('.json');
	});
});

test.describe('Dashboard - Folders', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
	});

	test('creates a folder', async ({ page }) => {
		await page.getByRole('button', { name: '+ תיקייה' }).click();
		await page.getByPlaceholder('שם תיקייה...').fill('תיקיית טסט');
		await page.getByPlaceholder('שם תיקייה...').press('Enter');
		await expect(page.getByRole('button', { name: /תיקיית טסט/ })).toBeVisible();
	});

	test('creates folder with Escape cancels', async ({ page }) => {
		await page.getByRole('button', { name: '+ תיקייה' }).click();
		await page.getByPlaceholder('שם תיקייה...').fill('יבוטל');
		await page.getByPlaceholder('שם תיקייה...').press('Escape');
		await expect(page.getByText('יבוטל')).not.toBeVisible();
	});

	test('filters by folder', async ({ page }) => {
		await page.getByRole('button', { name: '+ תיקייה' }).click();
		await page.getByPlaceholder('שם תיקייה...').fill('פרויקט א');
		await page.getByPlaceholder('שם תיקייה...').press('Enter');

		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);

		await page.getByRole('button', { name: /פרויקט א/ }).click();
		await expect(page.getByText('אין דוחות בתיקייה זו')).toBeVisible();

		await page.getByRole('button', { name: /הכל/ }).click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);
	});

	test('shows report count on folder pills', async ({ page }) => {
		const newBtn = page.getByRole('button', { name: 'בדיקה חדשה', exact: true });
		await newBtn.click();
		await expect(page.getByRole('button', { name: /הכל \(1\)/ })).toBeVisible();
		await newBtn.click();
		await expect(page.getByRole('button', { name: /הכל \(2\)/ })).toBeVisible();
	});

	test('moves report to folder', async ({ page }) => {
		// Create a folder
		await page.getByRole('button', { name: '+ תיקייה' }).click();
		await page.getByPlaceholder('שם תיקייה...').fill('תיקייה ב');
		await page.getByPlaceholder('שם תיקייה...').press('Enter');

		// Create a report
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();

		// Click move to folder button
		await page.getByRole('button', { name: 'העבר לתיקייה' }).click();
		// Select target folder in picker
		await page
			.getByRole('button', { name: /תיקייה ב/ })
			.last()
			.click();

		// Filter by new folder — should show the report
		await page
			.getByRole('button', { name: /תיקייה ב/ })
			.first()
			.click();
		await expect(page.getByRole('button', { name: /פתח דוח/ })).toHaveCount(1);
	});

	test('folder menu opens with rename/color/delete options', async ({ page }) => {
		await page.getByRole('button', { name: '+ תיקייה' }).click();
		await page.getByPlaceholder('שם תיקייה...').fill('תפריט טסט');
		await page.getByPlaceholder('שם תיקייה...').press('Enter');

		// Select the folder to make it active
		await page.getByRole('button', { name: /תפריט טסט/ }).click();
		// Click the folder options (three dots)
		await page.getByLabel('אפשרויות תיקייה').click();

		await expect(page.getByText('שנה שם')).toBeVisible();
		await expect(page.getByText('שנה צבע')).toBeVisible();
		await expect(page.getByText('מחק תיקייה')).toBeVisible();
	});

	test('deletes folder with confirmation', async ({ page }) => {
		await page.getByRole('button', { name: '+ תיקייה' }).click();
		await page.getByPlaceholder('שם תיקייה...').fill('למחיקה');
		await page.getByPlaceholder('שם תיקייה...').press('Enter');

		await page.getByRole('button', { name: /למחיקה/ }).click();
		await page.getByLabel('אפשרויות תיקייה').click();
		await page.getByText('מחק תיקייה').click();
		await page.getByRole('dialog').getByRole('button', { name: 'מחק' }).click();

		await expect(page.getByText('למחיקה')).not.toBeVisible();
	});
});
