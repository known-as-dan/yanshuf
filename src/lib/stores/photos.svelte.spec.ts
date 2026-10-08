import { describe, it, expect, afterEach } from 'vitest';
import {
	savePhoto,
	loadPhoto,
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
