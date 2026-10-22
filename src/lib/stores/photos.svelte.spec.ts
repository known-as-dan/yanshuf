import { describe, it, expect, afterEach, vi } from 'vitest';
import {
	savePhoto,
	loadPhoto,
	retryPhoto,
	setPhotoAccount,
	setRemotePhotoLoader,
	copyGuestPhotos
} from './photos.js';
afterEach(() => {
	setPhotoAccount(null);
	setRemotePhotoLoader(null);
});

describe('private photo workspaces', () => {
	it('separates guests and different accounts even when photo IDs match', async () => {
		const id = crypto.randomUUID();
		setPhotoAccount(null);
		await savePhoto(id, new Blob(['guest'], { type: 'image/jpeg' }));
		setPhotoAccount('photo-alice');
		expect(await loadPhoto(id)).toBeNull();
		await savePhoto(id, new Blob(['alice'], { type: 'image/jpeg' }));
		setPhotoAccount('photo-bob');
		expect(await loadPhoto(id)).toBeNull();
		setPhotoAccount('photo-alice');
		expect(await (await loadPhoto(id))!.text()).toBe('alice');
		setPhotoAccount(null);
		expect(await (await loadPhoto(id))!.text()).toBe('guest');
	});
	it('copies guest photos without removing their originals', async () => {
		const id = crypto.randomUUID();
		setPhotoAccount(null);
		await savePhoto(id, new Blob(['original']));
		setPhotoAccount('photo-import');
		await copyGuestPhotos([id]);
		expect(await (await loadPhoto(id))!.text()).toBe('original');
		setPhotoAccount(null);
		expect(await (await loadPhoto(id))!.text()).toBe('original');
	});
});

it('deduplicates concurrent downloads and bounds retries until explicitly retried', async () => {
	setPhotoAccount('retry-test');
	const id = crypto.randomUUID();
	const download = vi.fn(async () => null);
	setRemotePhotoLoader(download);
	await Promise.all([loadPhoto(id), loadPhoto(id), loadPhoto(id)]);
	expect(download).toHaveBeenCalledTimes(1);
	await loadPhoto(id);
	expect(download).toHaveBeenCalledTimes(1);
	await retryPhoto(id);
	expect(download).toHaveBeenCalledTimes(2);
});

it('recovers a WebKit Blob-cloning failure without changing legacy photo storage', async () => {
	const original = IDBObjectStore.prototype.put;
	const rejected = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
		this: IDBObjectStore,
		value,
		key
	) {
		if (value instanceof Blob) throw new DOMException('Blob cloning unavailable', 'UnknownError');
		return original.call(this, value, key);
	});
	const id = crypto.randomUUID();
	try {
		await savePhoto(id, new Blob(['preserved bytes'], { type: 'image/jpeg' }));
		const restored = await loadPhoto(id);
		expect(restored?.type).toBe('image/jpeg');
		expect(await restored?.text()).toBe('preserved bytes');
		setPhotoAccount('binary-photo-import');
		await copyGuestPhotos([id]);
		expect(await (await loadPhoto(id))?.text()).toBe('preserved bytes');
	} finally {
		rejected.mockRestore();
	}
});
