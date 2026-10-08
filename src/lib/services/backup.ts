import JSZip from 'jszip';
import { loadPhoto, savePhoto } from '../stores/photos.js';
import {
	createNewReport,
	getReportAccount,
	listReports,
	loadReport,
	loadFolders,
	saveFolders,
	saveReport,
	type SavedReport,
	type Folder
} from '../stores/reports.js';
import { migrateInspection } from '../models/migrate.js';

const photoIds = (report: SavedReport) => [
	...new Set(
		[...report.inspection.checklist, ...report.inspection.defects].flatMap(
			(item) => item.photoIds ?? []
		)
	)
];
const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(value);

/** Portable backups contain only the current workspace, never sessions or sync metadata. */
export async function buildBackup() {
	const account = getReportAccount();
	const reports = listReports()
		.map((summary) => loadReport(summary.id))
		.filter((report): report is SavedReport => report !== null);
	for (const report of reports) migrateInspection(report.inspection);
	const zip = new JSZip();
	const photos: Record<string, string> = {};
	let missing = 0;
	for (const id of new Set(reports.flatMap(photoIds))) {
		if (!validId(id)) {
			missing++;
			continue;
		}
		const blob = await loadPhoto(id);
		if (account !== getReportAccount()) throw new Error('החשבון השתנה בזמן יצירת הגיבוי');
		if (!blob) {
			missing++;
			continue;
		}
		photos[id] = blob.type;
		zip.file(`photos/${id}`, await blob.arrayBuffer());
	}
	zip.file('backup.json', JSON.stringify({ version: 2, reports, folders: loadFolders(), photos }));
	return {
		buffer: await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' }),
		missing
	};
}

export function readBackupReports(value: unknown): {
	reports: SavedReport[];
	folders: Folder[];
	photos: Record<string, string>;
} {
	if (!isRecord(value)) throw new Error('קובץ הגיבוי אינו תקין');
	const candidates = Array.isArray(value.reports)
		? value.reports
		: Object.entries(value)
				.filter(([key]) => key.startsWith('yanshuf_report_'))
				.map(([, report]) => report);
	if (!candidates.length && isRecord(value.yanshuf_inspection))
		candidates.push({ ...createNewReport(), inspection: value.yanshuf_inspection });
	if (!candidates.length || candidates.length > 1000) throw new Error('לא נמצאו דוחות בגיבוי');
	const reports = candidates.map((item) => {
		if (!isRecord(item) || !isRecord(item.inspection) || !isRecord(item.inspection.meta))
			throw new Error('דוח בגיבוי אינו תקין');
		if (JSON.stringify(item).length > 1024 * 1024) throw new Error('דוח בגיבוי גדול מדי');
		const inspection = item.inspection;
		const meta = inspection.meta as Record<string, unknown>;
		for (const key of [
			'checklist',
			'dcMeasurements',
			'acMeasurements',
			'inverterConfigs',
			'inverterSerials',
			'defects'
		]) {
			inspection[key] ??= [];
			if (
				!Array.isArray(inspection[key]) ||
				inspection[key].length > 5000 ||
				inspection[key].some((row: unknown) => !isRecord(row))
			)
				throw new Error('נתוני דוח בגיבוי אינם תקינים');
		}
		const report = structuredClone(item) as SavedReport;
		report.id = crypto.randomUUID();
		report.name = typeof item.name === 'string' ? item.name : 'בדיקה מיובאת';
		report.folder = typeof item.folder === 'string' ? item.folder : 'כללי';
		report.createdAt =
			typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString();
		for (const field of ['siteGroup', 'siteName', 'inspectionDate', 'inspectorName']) {
			if (typeof meta[field] !== 'string')
				report.inspection.meta[field as keyof typeof report.inspection.meta] = '';
		}
		migrateInspection(report.inspection);
		return report;
	});
	const rawFolders = value.folders ?? value.yanshuf_folders;
	const folders: Folder[] = Array.isArray(rawFolders)
		? rawFolders.flatMap((item) => {
				if (typeof item === 'string') return [{ name: item, color: '#6c8cff' }];
				if (
					isRecord(item) &&
					typeof item.name === 'string' &&
					typeof item.color === 'string' &&
					/^#[0-9a-fA-F]{6}$/.test(item.color)
				)
					return [{ name: item.name, color: item.color }];
				return [];
			})
		: [];
	const photos = isRecord(value.photos)
		? (Object.fromEntries(
				Object.entries(value.photos).filter(
					([id, mime]) =>
						validId(id) &&
						typeof mime === 'string' &&
						['image/jpeg', 'image/png', 'image/webp'].includes(mime)
				)
			) as Record<string, string>)
		: {};
	return { reports, folders, photos };
}

/** Imports copies with fresh report/photo IDs, preserving all existing work. */
export async function importBackup(file: File) {
	if (file.size > 100 * 1024 * 1024) throw new Error('קובץ הגיבוי גדול מדי');
	const account = getReportAccount();
	const bytes = await file.arrayBuffer();
	let zip: JSZip | null = null;
	let value: unknown;
	if (new Uint8Array(bytes)[0] === 0x50 && new Uint8Array(bytes)[1] === 0x4b) {
		zip = await JSZip.loadAsync(bytes);
		const manifest = zip.file('backup.json');
		if (!manifest) throw new Error('קובץ הגיבוי אינו תקין');
		value = JSON.parse(await manifest.async('string'));
	} else value = JSON.parse(new TextDecoder().decode(bytes));
	const { reports, folders, photos } = readBackupReports(value);
	const mapped = new Map<string, string>();
	let missing = 0;
	for (const id of new Set(reports.flatMap(photoIds))) {
		if (account !== getReportAccount()) throw new Error('החשבון השתנה בזמן הייבוא');
		const entry = validId(id) && photos[id] ? zip?.file(`photos/${id}`) : null;
		if (!entry) {
			missing++;
			continue;
		}
		const buffer = await entry.async('arraybuffer');
		if (buffer.byteLength > 10 * 1024 * 1024) throw new Error('תמונה בגיבוי גדולה מדי');
		const nextId = crypto.randomUUID();
		await savePhoto(nextId, new Blob([buffer], { type: photos[id] }));
		mapped.set(id, nextId);
	}
	for (const report of reports) {
		if (account !== getReportAccount()) throw new Error('החשבון השתנה בזמן הייבוא');
		for (const item of [...report.inspection.checklist, ...report.inspection.defects]) {
			if (item.photoIds)
				item.photoIds = item.photoIds.flatMap((id) => (mapped.has(id) ? [mapped.get(id)!] : []));
		}
		if (!saveReport(report)) throw new Error('לא ניתן לשמור את הדוח במכשיר');
	}
	const existing = loadFolders();
	for (const folder of folders)
		if (!existing.some((item) => item.name === folder.name)) existing.push(folder);
	saveFolders(existing);
	window.dispatchEvent(new CustomEvent('yanshuf-cloud-change'));
	return { count: reports.length, missing };
}
