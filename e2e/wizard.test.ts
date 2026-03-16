import { test, expect } from '@playwright/test';

test.describe('Wizard - Navigation', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();
		await expect(page.getByRole('heading', { name: 'פרטי בדיקה' })).toBeVisible();
	});

	test('shows all 7 step buttons in nav bar', async ({ page }) => {
		const steps = [
			'פרטי בדיקה',
			'הגדרת מערכת',
			'סעיפי בדיקה',
			'מדידות DC',
			'מדידות AC',
			'ליקויים',
			'סיכום'
		];
		for (const step of steps) {
			await expect(page.getByRole('button', { name: new RegExp(step) })).toBeVisible();
		}
	});

	test('navigates through all steps', async ({ page }) => {
		const stepData = [
			{ nav: /הגדרת מערכת/, heading: 'הגדרת מערכת' },
			{ nav: /סעיפי בדיקה/, heading: 'סעיפי בדיקה' },
			{ nav: /מדידות DC/, heading: 'מדידות DC' },
			{ nav: /מדידות AC/, heading: 'מדידות AC' },
			{ nav: /ליקויים/, heading: 'ריכוז ליקויים' },
			{ nav: /סיכום/, heading: 'סיכום ויצוא' }
		];
		for (const { nav, heading } of stepData) {
			await page.getByRole('button', { name: nav }).click();
			await expect(page.getByRole('heading', { name: heading })).toBeVisible();
		}
	});

	test('active step button is highlighted', async ({ page }) => {
		const metaBtn = page.getByRole('button', { name: /פרטי בדיקה/ });
		await expect(metaBtn).toHaveClass(/bg-accent/);

		await page.getByRole('button', { name: /הגדרת מערכת/ }).click();
		const configBtn = page.getByRole('button', { name: /הגדרת מערכת/ });
		await expect(configBtn).toHaveClass(/bg-accent/);
	});

	test('returns to dashboard with back button', async ({ page }) => {
		await page.getByLabel('חזרה לרשימת דוחות').click();
		await expect(page.locator('h1', { hasText: 'ינשוף' })).toBeVisible();
	});

	test('returns to dashboard from summary', async ({ page }) => {
		await page.getByRole('button', { name: /סיכום/ }).click();
		await page.getByText('חזרה לרשימת דוחות').click();
		await expect(page.locator('h1', { hasText: 'ינשוף' })).toBeVisible();
	});

	test('report name shown in wizard header', async ({ page }) => {
		await expect(page.locator('header h1')).toContainText('בדיקה חדשה');
	});
});

test.describe('Wizard - Step Meta', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();
		await expect(page.getByRole('heading', { name: 'פרטי בדיקה' })).toBeVisible();
	});

	test('shows all meta form fields', async ({ page }) => {
		await expect(page.locator('#siteGroup')).toBeVisible();
		await expect(page.locator('#siteName')).toBeVisible();
		await expect(page.locator('#inspectionDate')).toBeVisible();
		await expect(page.locator('#inspectorName')).toBeVisible();
		await expect(page.locator('#signature')).toBeVisible();
	});

	test('fills all meta fields', async ({ page }) => {
		await page.locator('#siteGroup').fill('חברת טסט');
		await page.locator('#siteName').fill('אתר דמו');
		await page.locator('#inspectionDate').fill('2026-03-15');
		await page.locator('#inspectorName').fill('ישראל ישראלי');
		await page.locator('#signature').fill('י. ישראלי');

		await expect(page.locator('#siteGroup')).toHaveValue('חברת טסט');
		await expect(page.locator('#siteName')).toHaveValue('אתר דמו');
		await expect(page.locator('#inspectionDate')).toHaveValue('2026-03-15');
		await expect(page.locator('#inspectorName')).toHaveValue('ישראל ישראלי');
		await expect(page.locator('#signature')).toHaveValue('י. ישראלי');
	});

	test('meta fields persist across step navigation', async ({ page }) => {
		await page.locator('#siteGroup').fill('לקוח נשמר');
		await page.locator('#siteName').fill('אתר נשמר');
		await page.locator('#inspectorName').fill('בודק נשמר');

		await page.getByRole('button', { name: /הגדרת מערכת/ }).click();
		await expect(page.getByRole('heading', { name: 'הגדרת מערכת' })).toBeVisible();

		await page.getByRole('button', { name: /פרטי בדיקה/ }).click();
		await expect(page.locator('#siteGroup')).toHaveValue('לקוח נשמר');
		await expect(page.locator('#siteName')).toHaveValue('אתר נשמר');
		await expect(page.locator('#inspectorName')).toHaveValue('בודק נשמר');
	});

	test('auto-generated report name section shown', async ({ page }) => {
		// Use exact match to avoid "שם הדוח נוצר..." also matching
		await expect(page.getByText('שם הדוח נוצר אוטומטית מפרטי הבדיקה')).toBeVisible();
	});

	test('report name updates as meta fields change', async ({ page }) => {
		await page.locator('#siteGroup').fill('לקוח X');
		await page.locator('#siteName').fill('אתר Y');
		await expect(page.locator('header h1')).toContainText('לקוח X - אתר Y');
	});
});

test.describe('Wizard - Step Config', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();
		await page.getByRole('button', { name: /הגדרת מערכת/ }).click();
		await expect(page.getByRole('heading', { name: 'הגדרת מערכת' })).toBeVisible();
	});

	test('shows initial inverter and add button', async ({ page }) => {
		await expect(page.getByText('ממיר 1')).toBeVisible();
		await expect(page.getByRole('button', { name: 'הוסף ממיר' })).toBeVisible();
	});

	test('adds inverters', async ({ page }) => {
		await page.getByRole('button', { name: 'הוסף ממיר' }).click();
		await expect(page.getByText('ממיר 2')).toBeVisible();

		await page.getByRole('button', { name: 'הוסף ממיר' }).click();
		await expect(page.getByText('ממיר 3')).toBeVisible();
	});

	test('removes an inverter', async ({ page }) => {
		// Count initial serial inputs
		const initialCount = await page.getByPlaceholder('מספר סידורי').count();
		await page.getByRole('button', { name: 'הוסף ממיר' }).click();
		await expect(page.getByPlaceholder('מספר סידורי')).toHaveCount(initialCount + 1);

		// Remove the last inverter
		await page.getByRole('button', { name: `הסר ממיר ${initialCount + 1}` }).click();
		await expect(page.getByPlaceholder('מספר סידורי')).toHaveCount(initialCount);
	});

	test('fills inverter serial numbers', async ({ page }) => {
		const serialInput = page.getByPlaceholder('מספר סידורי').first();
		await serialInput.fill('SN-12345');
		await expect(serialInput).toHaveValue('SN-12345');
	});

	test('inverter config persists across steps', async ({ page }) => {
		await page.getByRole('button', { name: 'הוסף ממיר' }).click();
		await page.getByRole('button', { name: 'הוסף ממיר' }).click();

		await page.getByRole('button', { name: /פרטי בדיקה/ }).click();
		await page.getByRole('button', { name: /הגדרת מערכת/ }).click();

		await expect(page.getByText('ממיר 1')).toBeVisible();
		await expect(page.getByText('ממיר 2')).toBeVisible();
		await expect(page.getByText('ממיר 3')).toBeVisible();
	});
});

test.describe('Wizard - Step Checklist', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();
		await page.getByRole('button', { name: /סעיפי בדיקה/ }).click();
		await expect(page.getByRole('heading', { name: 'סעיפי בדיקה' })).toBeVisible();
	});

	test('shows all 9 checklist sections', async ({ page }) => {
		const sections = [
			'1. מפסק ראשי',
			'2. לוח איסוף מהפכים',
			'3. הארקה',
			'4. מהפכים',
			'5. תקשורת',
			'6. קופסאות DC',
			'7. קונסטרוקציה',
			'8. סולמות',
			'9. פרוטוקול בדיקת'
		];
		for (const section of sections) {
			await expect(page.getByText(section, { exact: false }).first()).toBeVisible();
		}
	});

	test('shows global progress counter', async ({ page }) => {
		// Global progress badge near the heading shows "0/XX"
		await expect(page.getByText(/^0\/\d+$/).first()).toBeVisible();
	});

	test('marks checklist item as OK', async ({ page }) => {
		const okLabel = page.locator('label', { hasText: 'תקין' }).first();
		await okLabel.click();
		await expect(okLabel).toContainText('✓');
	});

	test('marks checklist item as not OK', async ({ page }) => {
		const notOkLabel = page.locator('label', { hasText: 'לא תקין' }).first();
		await notOkLabel.click();
		await expect(notOkLabel).toContainText('✗');
	});

	test('marks item as not relevant via label click', async ({ page }) => {
		// Item 1.1 has 3 options: תקין, לא תקין, לא רלוונטי
		// For standard items, "לא רלוונטי" shows with accent styling when selected (no ✓ prefix)
		const lrLabel = page
			.locator('label')
			.filter({ has: page.locator('input[name="status-1\\.1"]') })
			.filter({ hasText: 'רלוונטי' });
		await lrLabel.click();
		await expect(lrLabel).toHaveClass(/border-accent/);
	});

	test('adds notes to checklist item', async ({ page }) => {
		const notesInput = page.getByPlaceholder('הערות...').first();
		await notesInput.fill('הערה חשובה');
		await expect(notesInput).toHaveValue('הערה חשובה');
	});

	test('section progress updates when items are marked', async ({ page }) => {
		await page.locator('label', { hasText: 'תקין' }).first().click();
		// Look for a per-section progress showing "1/"
		await expect(page.getByText(/^1\/\d+$/).first()).toBeVisible();
	});

	test('faults counter appears when item fails', async ({ page }) => {
		await page.locator('label', { hasText: 'לא תקין' }).first().click();
		await expect(page.getByText(/תקלות/).first()).toBeVisible();
	});

	test('jump to section menu works', async ({ page }) => {
		await page.getByLabel('קפוץ לקטגוריה').click();
		// Jump menu should show section entries
		await expect(page.getByText('3. הארקה').nth(1)).toBeVisible();
	});

	test('checklist status persists across navigation', async ({ page }) => {
		await page.locator('label', { hasText: 'תקין' }).first().click();

		await page.getByRole('button', { name: /פרטי בדיקה/ }).click();
		await page.getByRole('button', { name: /סעיפי בדיקה/ }).click();

		const okLabel = page.locator('label', { hasText: 'תקין' }).first();
		await expect(okLabel).toContainText('✓');
	});
});

test.describe('Wizard - Step Defects', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();
		await page.getByRole('button', { name: /ליקויים/ }).click();
		await expect(page.getByRole('heading', { name: 'ריכוז ליקויים' })).toBeVisible();
	});

	test('shows empty state', async ({ page }) => {
		await expect(page.getByText('לא נמצאו ליקויים')).toBeVisible();
	});

	test('adds a manual defect', async ({ page }) => {
		await page.getByRole('button', { name: '+ הוסף ליקוי' }).click();
		await expect(page.getByText('ליקוי #1')).toBeVisible();
	});

	test('fills defect fields', async ({ page }) => {
		await page.getByRole('button', { name: '+ הוסף ליקוי' }).click();
		await page.locator('#defect-component-0').selectOption('פנלים');
		await page.locator('#defect-fault-0').fill('סדק בפנל');
		await page.locator('#defect-location-0').fill('גג צפוני');
		await page.locator('#defect-status-0').fill('דורש החלפה');

		await expect(page.locator('#defect-component-0')).toHaveValue('פנלים');
		await expect(page.locator('#defect-fault-0')).toHaveValue('סדק בפנל');
		await expect(page.locator('#defect-location-0')).toHaveValue('גג צפוני');
		await expect(page.locator('#defect-status-0')).toHaveValue('דורש החלפה');
	});

	test('adds multiple defects', async ({ page }) => {
		await page.getByRole('button', { name: '+ הוסף ליקוי' }).click();
		await page.getByRole('button', { name: '+ הוסף ליקוי' }).click();
		await page.getByRole('button', { name: '+ הוסף ליקוי' }).click();

		await expect(page.getByText('ליקוי #1')).toBeVisible();
		await expect(page.getByText('ליקוי #2')).toBeVisible();
		await expect(page.getByText('ליקוי #3')).toBeVisible();
	});

	test('deletes a defect', async ({ page }) => {
		await page.getByRole('button', { name: '+ הוסף ליקוי' }).click();
		await page.getByTitle('מחק ליקוי').click();
		await expect(page.getByText('לא נמצאו ליקויים')).toBeVisible();
	});

	test('duplicates a defect', async ({ page }) => {
		await page.getByRole('button', { name: '+ הוסף ליקוי' }).click();
		await page.locator('#defect-component-0').selectOption('מהפך');
		await page.locator('#defect-fault-0').fill('רעש חריג');

		await page.getByTitle('שכפל ליקוי').click();
		await expect(page.getByText('ליקוי #2')).toBeVisible();
		await expect(page.locator('#defect-component-1')).toHaveValue('מהפך');
		await expect(page.locator('#defect-fault-1')).toHaveValue('רעש חריג');
	});

	test('auto-defects appear from failed checklist items', async ({ page }) => {
		await page.getByRole('button', { name: /סעיפי בדיקה/ }).click();
		await page.locator('label', { hasText: 'לא תקין' }).first().click();

		await page.getByRole('button', { name: /ליקויים/ }).click();
		await expect(page.getByText('ליקויים מהבדיקות החזותיות')).toBeVisible();
	});
});

test.describe('Wizard - Step Summary', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole('button', { name: 'בדיקה חדשה' }).click();
		await page.getByRole('button', { name: /פתח דוח/ }).click();
		await page.getByRole('button', { name: /סיכום/ }).click();
		await expect(page.getByRole('heading', { name: 'סיכום ויצוא' })).toBeVisible();
	});

	test('shows stats grid labels', async ({ page }) => {
		const statsGrid = page.locator('.grid');
		await expect(statsGrid.getByText('צ׳קליסט')).toBeVisible();
		await expect(statsGrid.getByText('עברו בהצלחה')).toBeVisible();
		await expect(statsGrid.getByText('מתח & זרם')).toBeVisible();
		await expect(statsGrid.getByText('בידוד')).toBeVisible();
		await expect(statsGrid.getByText('מדידות AC')).toBeVisible();
	});

	test('shows no defects message by default', async ({ page }) => {
		await expect(page.getByText('לא נמצאו ליקויים')).toBeVisible();
	});

	test('shows pre-export warnings', async ({ page }) => {
		await expect(page.getByText('שים לב')).toBeVisible();
		await expect(page.getByText('לא הוזן לקוח / קבוצת אתרים')).toBeVisible();
	});

	test('warnings reduce as meta fields are filled', async ({ page }) => {
		await page.getByRole('button', { name: /פרטי בדיקה/ }).click();
		await page.locator('#siteGroup').fill('לקוח');
		await page.locator('#siteName').fill('אתר');
		await page.locator('#inspectorName').fill('בודק');
		await page.locator('#inspectionDate').fill('2026-03-15');

		await page.getByRole('button', { name: /סיכום/ }).click();
		await expect(page.getByText('לא הוזן לקוח / קבוצת אתרים')).not.toBeVisible();
		await expect(page.getByText('לא הוזן אתר')).not.toBeVisible();
		await expect(page.getByText('לא הוזן שם בודק')).not.toBeVisible();
	});

	test('shows export button', async ({ page }) => {
		await expect(page.getByRole('button', { name: /ייצוא לאקסל/ })).toBeVisible();
	});

	test('shows storage info', async ({ page }) => {
		await expect(page.getByText('אחסון מכשיר')).toBeVisible();
	});

	test('site info shows when meta is filled', async ({ page }) => {
		await page.getByRole('button', { name: /פרטי בדיקה/ }).click();
		await page.locator('#siteGroup').fill('חברת חשמל');
		await page.locator('#siteName').fill('תחנה מרכזית');

		await page.getByRole('button', { name: /סיכום/ }).click();
		await expect(page.getByText('פרטי אתר')).toBeVisible();
		await expect(page.getByText('לקוח:')).toBeVisible();
		await expect(page.getByText('אתר:')).toBeVisible();
	});
});
