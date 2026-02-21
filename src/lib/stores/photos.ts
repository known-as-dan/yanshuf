const DB_NAME = 'yanshuf_photos';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
	if (!dbPromise) {
		dbPromise = new Promise((resolve, reject) => {
			const req = indexedDB.open(DB_NAME, DB_VERSION);
			req.onupgradeneeded = () => {
				req.result.createObjectStore(STORE_NAME);
			};
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}
	return dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
	return openDB().then((db) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
	const store = await tx('readwrite');
	await wrap(store.put(blob, id));
}

export async function loadPhoto(id: string): Promise<Blob | null> {
	const store = await tx('readonly');
	const result = await wrap(store.get(id));
	return result instanceof Blob ? result : null;
}

export async function deletePhotos(ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	const store = await tx('readwrite');
	await Promise.all(ids.map((id) => wrap(store.delete(id))));
}

export async function getPhotoCount(): Promise<number> {
	const store = await tx('readonly');
	return wrap(store.count());
}
