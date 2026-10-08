import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await page.getByRole('button', { name: 'בדיקה חדשה', exact: true }).click();
	await page.getByRole('button', { name: /פתח דוח/ }).click();
	await page.getByRole('button', { name: /מדידות DC/ }).click();
	await page.getByRole('button', { name: '+ קבוצת מדידה חדשה', exact: true }).click();
	await page.getByLabel('שם קבוצה 1', { exact: true }).fill('ארון צפוני');
});

test('records unmarked points without inverters and preserves zero and blank after reopening', async ({
	page
}) => {
	await page.getByLabel('סימון נקודה 1', { exact: true }).fill('ללא סימון');
	await page.getByLabel('זרם עבודה — ארון צפוני — ללא סימון', { exact: true }).fill('0');
	await page.getByLabel('קולטים — ארון צפוני — ללא סימון', { exact: true }).fill('18');
	await page.getByRole('button', { name: /הגדרת מערכת/ }).click();
	await expect(page.getByPlaceholder('מספר סידורי')).toHaveCount(0);
	await page.getByRole('button', { name: 'הוסף ממיר' }).click();
	await page.getByRole('button', { name: 'הסר ממיר 1', exact: true }).click();
	await page.getByLabel('חזרה לרשימת דוחות', { exact: true }).click();
	await page.reload();
	await page.getByRole('button', { name: /פתח דוח/ }).click();
	await page.getByRole('button', { name: /מדידות DC/ }).click();
	await expect(page.getByLabel('זרם עבודה — ארון צפוני — ללא סימון', { exact: true })).toHaveValue(
		'0'
	);
	await expect(page.getByLabel('מתח ריקם — ארון צפוני — ללא סימון', { exact: true })).toHaveValue(
		''
	);
	await expect(page.getByLabel('קולטים — ארון צפוני — ללא סימון', { exact: true })).toHaveValue(
		'18'
	);
});

test('records a traceable fault at a test point without inventing a repair status', async ({
	page
}) => {
	await page.getByRole('button', { name: 'פעולות נקודה 1', exact: true }).click();
	await page.getByRole('button', { name: 'תעד ליקוי בנקודה', exact: true }).click();
	await page
		.getByRole('textbox', { name: 'ליקוי בנקודה 1', exact: true })
		.fill('יש לסמן את הקו ולאתר את המקור');
	await page.getByRole('button', { name: 'שמור ליקוי', exact: true }).click();
	await page.getByRole('button', { name: /ליקויים/ }).click();
	await expect(page.getByLabel('מיקום', { exact: true })).toHaveValue('ארון צפוני · נקודה 1');
	await expect(page.getByLabel('סטטוס / הערות', { exact: true })).toHaveValue('');
});

test('switches phone measurement columns without horizontal page overflow', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.getByLabel('זרם עבודה — ארון צפוני — 1', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'בידוד', exact: true }).click();
	await expect(page.getByLabel('בידוד מחרוזת — ארון צפוני — 1', { exact: true })).toBeVisible();
	await expect(page.getByLabel('זרם עבודה — ארון צפוני — 1', { exact: true })).not.toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('reopens the installed guest app offline with saved readings', async ({ page, context }) => {
	await page.getByLabel('זרם עבודה — ארון צפוני — 1', { exact: true }).fill('0');
	await page.getByLabel('חזרה לרשימת דוחות', { exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active))
		)
		.toBe(true);
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('button', { name: /פתח דוח/ })).toBeVisible();
	await page.getByRole('button', { name: /פתח דוח/ }).click();
	await page.getByRole('button', { name: /מדידות DC/ }).click();
	await expect(page.getByLabel('זרם עבודה — ארון צפוני — 1', { exact: true })).toHaveValue('0');
	await expect(page.getByLabel('מתח ריקם — ארון צפוני — 1', { exact: true })).toHaveValue('');
});
