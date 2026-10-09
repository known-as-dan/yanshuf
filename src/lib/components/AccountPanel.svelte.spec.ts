import { page } from 'vitest/browser';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import AccountPanel from './AccountPanel.svelte';
import {
	createNewReport,
	saveReport,
	loadReport,
	getReportAccount,
	setReportAccount
} from '../stores/reports.js';
import { setPhotoAccount } from '../stores/photos.js';

vi.mock('$app/paths', () => ({ base: '/yanshuf' }));
vi.mock('../services/cloud.js', () => ({
	createCloudSync: () => ({ sync: vi.fn(), stop: vi.fn(), importGuestReports: vi.fn() })
}));
beforeEach(() => {
	localStorage.clear();
	setReportAccount(null);
	setPhotoAccount(null);
});
afterEach(() => {
	vi.unstubAllGlobals();
	setReportAccount(null);
	setPhotoAccount(null);
});

describe('Mikumit account access', () => {
	it('uses the existing email OTP endpoints and keeps guest reports on sign-out', async () => {
		const guest = createNewReport();
		saveReport(guest);
		let signedIn = false;
		const request = vi.fn(async (path: string) => {
			if (path.endsWith('get-session'))
				return Response.json(
					signedIn ? { user: { id: 'existing-user', email: 'demo@example.test' } } : null
				);
			if (path.endsWith('sign-in/email-otp')) signedIn = true;
			if (path.endsWith('sign-out')) signedIn = false;
			return Response.json({ success: true });
		});
		vi.stubGlobal('fetch', request);
		render(AccountPanel, { onaccountchange: vi.fn() });
		await page.getByRole('button', { name: 'כניסה עם חשבון מיקומית' }).click();
		await page.getByRole('textbox', { name: 'כתובת המייל במיקומית' }).fill('demo@example.test');
		await page.getByRole('button', { name: 'שלח קוד במייל' }).click();
		await page.getByRole('textbox', { name: 'קוד האימות' }).fill('123456');
		await tick();
		const input = page.getByRole('textbox', { name: 'קוד האימות' }).element() as HTMLInputElement;
		expect(input.value).toBe('123456');
		expect(input.checkValidity(), input.validationMessage).toBe(true);
		await expect.element(page.getByRole('button', { name: 'התחבר', exact: true })).toBeEnabled();
		await page.getByRole('button', { name: 'התחבר', exact: true }).click();
		await expect
			.poll(() => request.mock.calls.some(([path]) => path.endsWith('sign-in/email-otp')))
			.toBe(true);
		await expect.element(page.getByText('demo@example.test', { exact: true })).toBeVisible();
		expect(getReportAccount()).toBe('existing-user');
		expect(loadReport(guest.id)).toBeNull();
		expect(request).toHaveBeenCalledWith(
			'/api/auth/email-otp/send-verification-otp',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ email: 'demo@example.test', type: 'sign-in' })
			})
		);
		expect(request).toHaveBeenCalledWith(
			'/api/auth/sign-in/email-otp',
			expect.objectContaining({
				body: JSON.stringify({ email: 'demo@example.test', otp: '123456' })
			})
		);
		await page.getByRole('button', { name: 'התנתק', exact: true }).click();
		await expect.element(page.getByText('מצב אורח · הדוחות נשמרים במכשיר הזה')).toBeVisible();
		expect(getReportAccount()).toBeNull();
		expect(loadReport(guest.id)?.id).toBe(guest.id);
	});
});
