import { page } from 'vitest/browser';
import { it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import PhotoCapture from './PhotoCapture.svelte';
import { loadPhoto, retryPhoto } from '../stores/photos.js';

vi.mock('../stores/photos.js', () => ({
	loadPhoto: vi.fn(async () => null),
	retryPhoto: vi.fn(async () => null),
	savePhoto: vi.fn(),
	deletePhotos: vi.fn(),
	checkStorageStatus: vi.fn()
}));

it('shows a retry for a missing photo without a reactive fetch loop', async () => {
	render(PhotoCapture, { photoIds: ['missing-photo'] });
	const retry = page.getByRole('button', { name: 'נסה לטעון את התמונה שוב' });
	await expect.element(retry).toBeVisible();
	for (let i = 0; i < 10; i++) await tick();
	expect(loadPhoto).toHaveBeenCalledTimes(1);
	await retry.click();
	await expect.element(retry).toBeVisible();
	expect(retryPhoto).toHaveBeenCalledTimes(1);
	expect(loadPhoto).toHaveBeenCalledTimes(1);
});
