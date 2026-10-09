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

export type CloudReport = { id: string; report: SavedReport; revision: number; deleted: boolean };
type SyncEntry = {
	revision: number;
	content: string;
	deletePending?: boolean;
	uploaded?: string[];
};
type SyncIndex = Record<string, SyncEntry>;
const content = (report: SavedReport) => JSON.stringify(report);
const photoIds = (report: SavedReport) => [
	...new Set(
		[...report.inspection.checklist, ...report.inspection.defects].flatMap(
			(item) => item.photoIds ?? []
		)
	)
];
export const photoPath = (reportId: string, id: string) =>
	`/api/yanshuf/reports/${encodeURIComponent(reportId)}/photos/${encodeURIComponent(id)}`;

/** Account-specific durable queue. A conflicting local version becomes a new report. */
export function createCloudSync(userId: string, onStatus: (status: string) => void) {
	const key = storageKey('yanshuf_sync', userId);
	let index: SyncIndex;
	try {
		index = JSON.parse(localStorage.getItem(key) ?? '{}');
	} catch {
		index = {};
	}
	let stopped = false;
	let busy = false;
	let rerun = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const controller = new AbortController();
	const active = () => !stopped && getReportAccount() === userId;
	const persist = () => {
		if (!safeSetItem(key, JSON.stringify(index)))
			throw new Error('לא ניתן לשמור את מצב הסנכרון במכשיר');
	};
	function changed(id?: string, conflict = false) {
		window.dispatchEvent(new CustomEvent('yanshuf-cloud-change', { detail: { id, conflict } }));
	}
	async function request(path: string, init: RequestInit = {}) {
		const headers = new Headers(init.headers);
		headers.set('X-Yanshuf-Account', userId);
		const response = await fetch(path, {
			...init,
			headers,
			credentials: 'same-origin',
			cache: 'no-store',
			signal: controller.signal
		});
		if (!active()) throw new Error('Account changed');
		if (response.status === 401) throw new Error('יש להתחבר מחדש. השינויים שמורים במכשיר');
		return response;
	}
	function removeLocal(id: string) {
		localStorage.removeItem(storageKey(`yanshuf_report_${id}`));
		const summaries = listReports().filter((report) => report.id !== id);
		if (!safeSetItem(storageKey('yanshuf_reports_index'), JSON.stringify(summaries)))
			throw new Error('לא ניתן לעדכן את רשימת הדוחות');
	}
	function merge(remote: CloudReport, force = false) {
		if (!active()) return;
		const local = loadReport(remote.id);
		const previous = index[remote.id];
		if (
			!force &&
			previous?.revision === remote.revision &&
			(remote.deleted ? !local : previous.content === content(remote.report))
		)
			return;
		const dirty = local && content(local) !== previous?.content;
		if (!force && dirty && previous?.revision === remote.revision) return;
		let conflict = false;
		if (dirty && (!previous || previous.revision !== remote.revision)) {
			const copy = structuredClone(local);
			copy.id = crypto.randomUUID();
			copy.name += ' (עותק מקומי)';
			if (!saveReport(copy)) throw new Error('לא ניתן לשמור עותק מקומי של השינויים');
			conflict = true;
		}
		if (remote.deleted) removeLocal(remote.id);
		else if (!saveReport(remote.report, true)) throw new Error('לא ניתן לשמור את הדוח במכשיר');
		index[remote.id] = {
			revision: remote.revision,
			content: content(remote.report),
			uploaded: previous?.uploaded ?? []
		};
		persist();
		changed(remote.id, conflict);
	}
	async function sync() {
		if (!active()) return;
		if (busy) {
			rerun = true;
			return;
		}
		if (!navigator.onLine) {
			onStatus('עבודה ללא רשת — השינויים שמורים במכשיר');
			return;
		}
		busy = true;
		rerun = false;
		onStatus('מסנכרן דוחות…');
		let photosPending = false;
		try {
			let after: string | null = '';
			while (after !== null) {
				const response = await request(
					`/api/yanshuf/reports${after ? `?after=${encodeURIComponent(after)}` : ''}`
				);
				if (!response.ok) throw new Error('הסנכרון אינו זמין כרגע. השינויים שמורים במכשיר');
				const page = (await response.json()) as { items: CloudReport[]; next: string | null };
				if (!active()) return;
				for (const remote of page.items) {
					if (index[remote.id]?.deletePending && !remote.deleted) continue;
					merge(remote);
				}
				after = page.next;
			}
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
					index[id] = {
						...entry,
						deletePending: false,
						revision: remote.revision,
						content: content(remote.report)
					};
					persist();
				} else if (response.status === 409) {
					const data = await response.json();
					if (data.conflict) merge(data.conflict, true);
				} else throw new Error('מחיקת הדוח תסונכרן כשיתאפשר');
			}
			for (const summary of listReports()) {
				if (!active()) return;
				const report = loadReport(summary.id);
				if (!report) continue;
				const snapshot = content(report);
				let entry = index[report.id] ?? { revision: 0, content: '' };
				if (snapshot !== entry.content) {
					const response = await request(`/api/yanshuf/reports/${encodeURIComponent(report.id)}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ report, revision: entry.revision })
					});
					if (response.status === 409) {
						const data = await response.json();
						if (data.conflict) merge(data.conflict, true);
						else throw new Error('גרסת הדוח השתנתה. השינויים שמורים במכשיר');
						rerun = true;
						continue;
					}
					if (!response.ok) throw new Error('לא ניתן לסנכרן כרגע. השינויים שמורים במכשיר');
					const remote = (await response.json()) as CloudReport;
					if (!active()) return;
					const pendingDeletion = index[report.id]?.deletePending ?? false;
					entry = index[report.id] = {
						...entry,
						revision: remote.revision,
						content: snapshot,
						deletePending: pendingDeletion
					};
					persist();
					// Edits during this request remain dirty and get their own next revision.
					if (pendingDeletion || content(loadReport(report.id) ?? report) !== snapshot)
						rerun = true;
				}
				if (entry.deletePending || !loadReport(report.id)) continue;
				for (const id of photoIds(report)) {
					if (entry.uploaded?.includes(id)) continue;
					const blob = await loadPhoto(id);
					if (!active()) return;
					if (!blob) {
						photosPending = true;
						continue;
					}
					const response = await request(photoPath(report.id, id), {
						method: 'PUT',
						headers: { 'Content-Type': blob.type },
						body: blob
					});
					if (!response.ok) {
						photosPending = true;
						break;
					}
					entry.uploaded = [...(entry.uploaded ?? []), id];
					persist();
				}
			}
			onStatus(
				photosPending
					? 'הדוחות סונכרנו. חלק מהתמונות ממתינות לסנכרון'
					: rerun
						? 'שינויים נוספים ממתינים לסנכרון'
						: 'כל השינויים סונכרנו'
			);
		} catch (failure) {
			if (active())
				onStatus(
					failure instanceof Error && failure.message !== 'Failed to fetch'
						? failure.message
						: 'ללא חיבור לשרת — השינויים שמורים במכשיר'
				);
		} finally {
			busy = false;
			if (rerun && active()) schedule();
		}
	}
	function schedule() {
		clearTimeout(timer);
		timer = setTimeout(sync, 1500);
	}
	function localChange(event: Event) {
		const detail = (event as CustomEvent<{ id: string; deleted: boolean; account: string | null }>)
			.detail;
		if (detail.account !== userId) return;
		try {
			if (detail.deleted) {
				index[detail.id] = {
					...(index[detail.id] ?? { revision: 0, content: '' }),
					deletePending: true
				};
				persist();
			}
		} catch {
			onStatus('לא ניתן לשמור את מצב הסנכרון במכשיר');
			return;
		}
		onStatus('השינויים שמורים במכשיר — ממתינים לסנכרון');
		schedule();
	}
	setRemotePhotoLoader(async (id) => {
		if (!active()) return null;
		for (const summary of listReports()) {
			const report = loadReport(summary.id);
			if (report && photoIds(report).includes(id)) {
				const response = await request(photoPath(report.id, id));
				if (response.ok) return response.blob();
			}
		}
		return null;
	});
	window.addEventListener('yanshuf-report-change', localChange);
	window.addEventListener('online', schedule);
	window.addEventListener('focus', schedule);
	const interval = setInterval(sync, 30000);
	schedule();
	return {
		sync,
		stop() {
			stopped = true;
			controller.abort();
			clearTimeout(timer);
			clearInterval(interval);
			window.removeEventListener('yanshuf-report-change', localChange);
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
