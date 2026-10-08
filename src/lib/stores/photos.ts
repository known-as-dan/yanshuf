const DB_NAME = 'yanshuf_photos';
const STORE_NAME = 'photos';
const DB_VERSION = 1;
let account: string | null = null;
let remoteLoader: ((id: string) => Promise<Blob | null>) | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export function setPhotoAccount(id: string | null) {
	if (id === account) return;
	account = id;
	dbPromise = null;
}
export function setRemotePhotoLoader(loader: ((id: string) => Promise<Blob | null>) | null) {
	remoteLoader = loader;
}

function connect(name: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(name, DB_VERSION);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
function openDB(): Promise<IDBDatabase> {
	return (dbPromise ??= connect(
		account ? `${DB_NAME}_account_${encodeURIComponent(account)}` : DB_NAME
	));
}
function wrap<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
function committed(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = transaction.onabort = () =>
			reject(transaction.error ?? new Error('Photo storage failed'));
	});
}
async function putPhoto(db: IDBDatabase, id: string, blob: Blob) {
	const transaction = db.transaction(STORE_NAME, 'readwrite');
	const done = committed(transaction);
	transaction.objectStore(STORE_NAME).put(blob, id);
	await done;
}
export async function savePhoto(id: string, blob: Blob): Promise<void> {
	// Capture the workspace before yielding: an account switch cannot redirect a
	// pending write into another user's photo database.
	await putPhoto(await openDB(), id, blob);
}
export async function loadPhoto(id: string): Promise<Blob | null> {
	const current = account;
	const db = await openDB();
	const result = await wrap(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id));
	if (current !== account) return null;
	if (result instanceof Blob) return result;
	const remote = await remoteLoader?.(id);
	if (current !== account) return null;
	if (remote) await putPhoto(db, id, remote);
	return remote ?? null;
}
export async function copyGuestPhotos(ids: string[]): Promise<void> {
	if (!account || !ids.length) return;
	const current = account;
	const target = await openDB();
	const guest = await connect(DB_NAME);
	try {
		for (const id of ids) {
			if (current !== account) throw new Error('Account changed');
			const blob = await wrap(
				guest.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
			);
			if (blob instanceof Blob) await putPhoto(target, id, blob);
		}
	} finally {
		guest.close();
	}
}
export async function deletePhotos(ids: string[]): Promise<void> {
	if (!ids.length) return;
	const db = await openDB();
	const transaction = db.transaction(STORE_NAME, 'readwrite');
	const done = committed(transaction);
	for (const id of ids) transaction.objectStore(STORE_NAME).delete(id);
	await done;
}
export async function getPhotoCount(): Promise<number> {
	const db = await openDB();
	return wrap(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).count());
}

// ── Storage quota ────────────────────────────────────────────────

export type StorageEstimate = {
	usageBytes: number;
	quotaBytes: number;
	availableBytes: number;
	percentUsed: number;
};

export async function estimateAvailableStorage(): Promise<StorageEstimate | null> {
	if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
	const est = await navigator.storage.estimate();
	if (est.usage == null || est.quota == null) return null;
	return {
		usageBytes: est.usage,
		quotaBytes: est.quota,
		availableBytes: est.quota - est.usage,
		percentUsed: Math.round((est.usage / est.quota) * 100)
	};
}

const LOW_STORAGE_THRESHOLD = 10 * 1024 * 1024; // 10 MB
const CRITICAL_STORAGE_THRESHOLD = 2 * 1024 * 1024; // 2 MB

export type StorageStatus = 'ok' | 'low' | 'critical' | 'unknown';

export async function checkStorageStatus(): Promise<StorageStatus> {
	const est = await estimateAvailableStorage();
	if (!est) return 'unknown';
	if (est.availableBytes < CRITICAL_STORAGE_THRESHOLD) return 'critical';
	if (est.availableBytes < LOW_STORAGE_THRESHOLD) return 'low';
	return 'ok';
}
