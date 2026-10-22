import {
	getReportAccount,
	setReportAccount,
	listReports,
	loadReport,
	saveReport,
	storageKey,
	safeSetItem,
	type SavedReport
} from '../stores/reports.js';
import { loadPhoto, setRemotePhotoLoader, copyGuestPhotos } from '../stores/photos.js';
import { migrateInspection } from '../models/migrate.js';
import { reportContent as content, storedContent } from '../models/report-content.js';

export type CloudReport = {
	id: string;
	report: SavedReport;
	revision: number;
	deleted: boolean;
	uploadedPhotoIds?: string[];
};
type SyncEntry = {
	revision: number;
	content: string;
	deletePending?: boolean;
	uploaded?: string[];
	/** Written before the request, so a lost acknowledgement is recoverable. */
	pending?: string;
};
type SyncIndex = Record<string, SyncEntry>;
const photoIds = (report: SavedReport) => [
	...new Set(
		[...report.inspection.checklist, ...report.inspection.defects].flatMap(
			(item) => item.photoIds ?? []
		)
	)
];
export const photoPath = (reportId: string, id: string) =>
	`/api/yanshuf/reports/${encodeURIComponent(reportId)}/photos/${encodeURIComponent(id)}`;

/** The existing queue format is retained; optional pending state is additive. */
export function createCloudSync(userId: string, onStatus: (status: string) => void) {
	const key = storageKey('yanshuf_sync', userId);
	function readIndex(): SyncIndex {
		try {
			const value = JSON.parse(localStorage.getItem(key) ?? '{}');
			return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
		} catch {
			return {};
		}
	}
	let index = readIndex();
	let stopped = false;
	let running: Promise<void> | null = null;
	let rerun = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const controller = new AbortController();
	const active = () => !stopped && getReportAccount() === userId;
	function persist() {
		if (
			localStorage.getItem(key) !== JSON.stringify(index) &&
			!safeSetItem(key, JSON.stringify(index))
		)
			throw new Error('לא ניתן לשמור את מצב הסנכרון במכשיר');
	}
	function changed(id?: string, copyId?: string) {
		window.dispatchEvent(
			new CustomEvent('yanshuf-cloud-change', { detail: { id, copyId, conflict: !!copyId } })
		);
	}
	async function request(path: string, init: RequestInit = {}) {
		const headers = new Headers(init.headers);
		headers.set('X-Yanshuf-Account', userId);
		let response: Response;
		try {
			response = await fetch(path, {
				...init,
				headers,
				credentials: 'same-origin',
				cache: 'no-store',
				signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)])
			});
		} catch {
			throw new Error('החיבור לשרת נקטע — השינויים שמורים במכשיר. ננסה שוב');
		}
		if (!active()) throw new Error('Account changed');
		if (response.status === 401) {
			window.dispatchEvent(new Event('yanshuf-auth-required'));
			throw new Error('יש להתחבר מחדש. הדוחות והשינויים נשמרו במכשיר');
		}
		if (response.status === 429) throw new Error('השרת עמוס בבקשות — ננסה שוב בעוד חצי דקה');
		return response;
	}
	function removeLocal(id: string) {
		const summaries = listReports().filter((report) => report.id !== id);
		if (!safeSetItem(storageKey('yanshuf_reports_index'), JSON.stringify(summaries)))
			throw new Error('לא ניתן לעדכן את רשימת הדוחות');
		localStorage.removeItem(storageKey(`yanshuf_report_${id}`));
	}
	async function preserveConflict(local: SavedReport) {
		// The same version gets the same recovery ID after retries or across devices.
		const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content(local)));
		if (!active()) throw new Error('Account changed');
		const id = `conflict-${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
		if (!loadReport(id)) {
			const copy = structuredClone(local);
			copy.id = id;
			copy.name = copy.name.replace(/(?: \(עותק מקומי\))+$/, '') + ' (עותק מקומי)';
			if (!saveReport(copy)) throw new Error('לא ניתן לשמור עותק של השינויים');
		}
		return id;
	}
	async function merge(remote: CloudReport) {
		if (!active()) return;
		index = readIndex();
		let local = loadReport(remote.id);
		const previous = index[remote.id];
		const remoteContent = content(remote.report);
		const base = storedContent(previous?.content);
		const pending = storedContent(previous?.pending);
		const ownWrite =
			!remote.deleted && (content(local) === remoteContent || pending === remoteContent);
		const dirty = !!local && content(local) !== base;
		// A stale pull must not replace a newer acknowledgement from another tab.
		if (previous && remote.revision < previous.revision) return;
		if (
			previous?.deletePending &&
			!remote.deleted &&
			(ownWrite || previous.revision === remote.revision)
		) {
			index[remote.id] = {
				...previous,
				revision: remote.revision,
				content: remoteContent,
				pending: undefined
			};
			persist();
			return;
		}
		if (!remote.deleted && dirty && !ownWrite && previous?.revision === remote.revision) return;
		let copyId: string | undefined;
		if (dirty && !ownWrite && (!previous || previous.revision !== remote.revision)) {
			while (local) {
				const captured = content(local);
				copyId = await preserveConflict(local);
				if (!active()) return;
				local = loadReport(remote.id);
				if (!local || content(local) === captured) break;
			}
			// A deletion made while hashing must keep its durable intent.
			if (readIndex()[remote.id]?.deletePending) return;
		}
		const keepEdits = ownWrite && local && content(local) !== remoteContent;
		const replace =
			!keepEdits && (remote.deleted ? !!local : !local || content(local) !== remoteContent);
		if (replace) {
			if (remote.deleted) removeLocal(remote.id);
			else if (!saveReport(remote.report, true)) throw new Error('לא ניתן לשמור את הדוח במכשיר');
		}
		index = readIndex();
		index[remote.id] = {
			revision: remote.revision,
			content: remoteContent,
			uploaded: remote.uploadedPhotoIds ?? previous?.uploaded ?? []
		};
		persist();
		if (replace || copyId) changed(remote.id, copyId);
	}
	async function run() {
		if (!active()) return;
		index = readIndex();
		onStatus('משחזר ומסנכרן דוחות…');
		let photosPending = false;
		let after: string | null = '';
		while (after !== null) {
			const response = await request(
				`/api/yanshuf/reports${after ? `?after=${encodeURIComponent(after)}` : ''}`
			);
			if (!response.ok)
				throw new Error('לא ניתן לשחזר דוחות מהשרת כרגע. ננסה שוב; הדוחות במכשיר נשמרו');
			const page = (await response.json()) as { items: CloudReport[]; next: string | null };
			for (const remote of page.items) await merge(remote);
			after = page.next;
		}
		index = readIndex();
		for (const [id, entry] of Object.entries(index)) {
			if (!entry.deletePending) continue;
			if (!entry.revision) {
				delete index[id];
				persist();
				continue;
			}
			const response = await request(`/api/yanshuf/reports/${encodeURIComponent(id)}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ revision: entry.revision })
			});
			if (response.ok) {
				const remote = (await response.json()) as CloudReport;
				await merge(remote);
			} else if (response.status === 409) {
				const data = await response.json();
				if (data.conflict) await merge(data.conflict);
			} else throw new Error('מחיקת הדוח תסונכרן כשיתאפשר');
		}
		for (const summary of listReports()) {
			if (!active()) return;
			const report = loadReport(summary.id);
			if (!report) continue;
			const snapshot = content(report);
			index = readIndex();
			let entry = index[report.id] ?? { revision: 0, content: '' };
			if (entry.deletePending) continue;
			if (snapshot !== storedContent(entry.content)) {
				index[report.id] = { ...entry, pending: snapshot };
				persist();
				const response = await request(`/api/yanshuf/reports/${encodeURIComponent(report.id)}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ report, revision: entry.revision })
				});
				if (response.status === 409) {
					const data = await response.json();
					if (data.conflict) await merge(data.conflict);
					else throw new Error('גרסת הדוח השתנתה. השינויים נשמרו במכשיר');
					rerun = true;
					continue;
				}
				if (!response.ok) throw new Error('לא ניתן לסנכרן כרגע. השינויים נשמרו במכשיר');
				const remote = (await response.json()) as CloudReport;
				if (!active()) return;
				index = readIndex();
				entry = index[report.id] = {
					...index[report.id],
					revision: remote.revision,
					content: snapshot,
					pending: undefined
				};
				persist();
				if (entry.deletePending || content(loadReport(report.id)) !== snapshot) rerun = true;
			}
			if (entry.deletePending || !loadReport(report.id)) continue;
			onStatus('הדוחות נשמרו — מסנכרן תמונות…');
			for (const id of photoIds(report)) {
				const blob = await loadPhoto(id);
				if (!active()) return;
				if (!blob) {
					photosPending = true;
					continue;
				}
				// A restored server photo is downloaded once, never uploaded back.
				if (entry.uploaded?.includes(id)) continue;
				const response = await request(photoPath(report.id, id), {
					method: 'PUT',
					headers: { 'Content-Type': blob.type },
					body: blob
				});
				if (!response.ok) {
					photosPending = true;
					break;
				}
				index = readIndex();
				entry = index[report.id];
				entry.uploaded = [...new Set([...(entry.uploaded ?? []), id])];
				persist();
			}
		}
		onStatus(
			photosPending
				? 'הדוחות סונכרנו. חלק מהתמונות ממתינות לחיבור'
				: rerun
					? 'שינויים נוספים ממתינים לסנכרון'
					: 'כל השינויים סונכרנו'
		);
	}
	function sync(): Promise<void> {
		if (!active()) return Promise.resolve();
		if (running) {
			rerun = true;
			return running;
		}
		if (!navigator.onLine) {
			onStatus('עבודה ללא רשת — השינויים שמורים במכשיר');
			return Promise.resolve();
		}
		clearTimeout(timer);
		rerun = false;
		running = (async () => {
			try {
				// Web Locks are supported by the target iPhone Safari. Never run an
				// unsafe parallel writer on browsers without this capability.
				if (!navigator.locks) throw new Error('נדרש דפדפן מעודכן לסנכרון. הדוחות נשמרו במכשיר');
				await navigator.locks.request(`yanshuf-sync-${userId}`, { signal: controller.signal }, run);
			} catch (failure) {
				if (active())
					onStatus(failure instanceof Error ? failure.message : 'הסנכרון לא הושלם. ננסה שוב');
			} finally {
				running = null;
				if (rerun && active()) schedule();
			}
		})();
		return running;
	}
	function schedule() {
		clearTimeout(timer);
		timer = setTimeout(sync, 1500);
	}
	function localChange(event: Event) {
		const detail = (event as CustomEvent<{ id: string; deleted: boolean; account: string | null }>)
			.detail;
		if (detail.account !== userId) return;
		if (detail.deleted) {
			try {
				index = readIndex();
				index[detail.id] = {
					...(index[detail.id] ?? { revision: 0, content: '' }),
					deletePending: true
				};
				persist();
			} catch {
				onStatus('לא ניתן לשמור את מצב הסנכרון במכשיר');
				return;
			}
		}
		onStatus('השינויים שמורים במכשיר — ממתינים לסנכרון');
		schedule();
	}
	function storageChanged(event: StorageEvent) {
		if (event.key?.startsWith(storageKey(''))) schedule();
	}
	setRemotePhotoLoader(async (id) => {
		if (!active()) return null;
		const saved = readIndex();
		for (const summary of listReports()) {
			if (!saved[summary.id]?.uploaded?.includes(id)) continue;
			const response = await request(photoPath(summary.id, id));
			if (response.ok) return response.blob();
			if (response.status !== 404) return null;
		}
		return null;
	});
	window.addEventListener('yanshuf-report-change', localChange);
	window.addEventListener('storage', storageChanged);
	window.addEventListener('online', schedule);
	window.addEventListener('focus', schedule);
	const interval = setInterval(sync, 30000);
	onStatus('מחבר את הדוחות לחשבון…');
	schedule();
	return {
		sync,
		stop() {
			stopped = true;
			controller.abort();
			clearTimeout(timer);
			clearInterval(interval);
			window.removeEventListener('yanshuf-report-change', localChange);
			window.removeEventListener('storage', storageChanged);
			window.removeEventListener('online', schedule);
			window.removeEventListener('focus', schedule);
			setRemotePhotoLoader(null);
		},
		async importGuestReports() {
			if (!active()) return;
			const previous = getReportAccount();
			setReportAccount(null);
			const guest = listReports()
				.map((summary) => loadReport(summary.id))
				.filter((report): report is SavedReport => report !== null);
			setReportAccount(previous);
			const importedKey = storageKey('yanshuf_guest_imports', userId);
			const imported: string[] = JSON.parse(localStorage.getItem(importedKey) ?? '[]');
			let count = 0;
			for (const report of guest) {
				if (imported.includes(report.id)) continue;
				const copy = structuredClone(report);
				migrateInspection(copy.inspection);
				await copyGuestPhotos(photoIds(copy));
				if (!active()) return;
				copy.id = crypto.randomUUID();
				if (!saveReport(copy)) throw new Error('לא ניתן לשמור את הדוח במכשיר');
				imported.push(report.id);
				safeSetItem(importedKey, JSON.stringify(imported));
				count++;
			}
			changed();
			schedule();
			return count;
		}
	};
}
