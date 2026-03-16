import type { Inspection } from '../models/inspection.js';
import { deletePhotos } from './photos.js';

/** Folder with display color */
export type Folder = {
	name: string;
	color: string;
};

/** Preset folder color palette */
export const FOLDER_PALETTE = [
	'#6c8cff',
	'#4ade80',
	'#fbbf24',
	'#f87171',
	'#a78bfa',
	'#38bdf8',
	'#fb923c',
	'#2dd4bf',
	'#f472b6',
	'#94a3b8'
];

/** A saved report with metadata */
export type SavedReport = {
	id: string;
	name: string;
	folder: string;
	createdAt: string; // ISO
	updatedAt: string; // ISO
	inspection: Inspection;
};

/** Summary for listing (no heavy data) */
export type ReportSummary = {
	id: string;
	name: string;
	folder: string;
	createdAt: string;
	updatedAt: string;
	siteGroup: string;
	siteName: string;
	inspectorName: string;
	inspectionDate: string;
};

const REPORTS_INDEX_KEY = 'yanshuf_reports_index';
const REPORT_PREFIX = 'yanshuf_report_';
const FOLDERS_KEY = 'yanshuf_folders';

/** Callback for storage errors (set from UI layer) */
export let onStorageError: ((message: string) => void) | null = null;

export function setStorageErrorHandler(handler: (message: string) => void) {
	onStorageError = handler;
}

export function safeSetItem(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch (e) {
		if (e instanceof DOMException && e.name === 'QuotaExceededError') {
			onStorageError?.('זיכרון המכשיר מלא. אנא מחק בדיקות ישנות כדי לשמור בדיקות חדשות.');
		}
		console.error('Failed to save to localStorage', e);
	}
}

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadIndex(): ReportSummary[] {
	try {
		const raw = localStorage.getItem(REPORTS_INDEX_KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		/* ignore */
	}
	return [];
}

function saveIndex(index: ReportSummary[]) {
	safeSetItem(REPORTS_INDEX_KEY, JSON.stringify(index));
}

export function loadFolders(): Folder[] {
	try {
		const raw = localStorage.getItem(FOLDERS_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			// Migrate old string[] format
			if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
				const migrated: Folder[] = (parsed as string[]).map((name, i) => ({
					name,
					color: FOLDER_PALETTE[i % FOLDER_PALETTE.length]
				}));
				saveFolders(migrated);
				return migrated;
			}
			return parsed as Folder[];
		}
	} catch {
		/* ignore */
	}
	return [{ name: 'כללי', color: FOLDER_PALETTE[0] }];
}

export function saveFolders(folders: Folder[]) {
	safeSetItem(FOLDERS_KEY, JSON.stringify(folders));
}

/** Rename a folder and update all reports referencing it. Returns false if invalid. */
export function renameFolder(oldName: string, newName: string): boolean {
	const trimmed = newName.trim();
	if (!trimmed) return false;

	const folders = loadFolders();
	if (folders.some((f) => f.name === trimmed)) return false;

	const folder = folders.find((f) => f.name === oldName);
	if (!folder) return false;

	folder.name = trimmed;
	saveFolders(folders);

	// Update all reports referencing the old name
	const index = loadIndex();
	for (const summary of index) {
		if (summary.folder === oldName) {
			summary.folder = trimmed;
			const full = loadReport(summary.id);
			if (full) {
				full.folder = trimmed;
				safeSetItem(REPORT_PREFIX + full.id, JSON.stringify(full));
			}
		}
	}
	saveIndex(index);
	return true;
}

/** Move a report to a different folder */
export function moveReport(reportId: string, targetFolder: string) {
	const report = loadReport(reportId);
	if (!report) return;
	report.folder = targetFolder;
	saveReport(report);
}

/** Update a folder's color */
export function updateFolderColor(folderName: string, color: string) {
	const folders = loadFolders();
	const folder = folders.find((f) => f.name === folderName);
	if (folder) {
		folder.color = color;
		saveFolders(folders);
	}
}

/** Get a folder's color by name */
export function getFolderColor(folderName: string, folders: Folder[]): string {
	return folders.find((f) => f.name === folderName)?.color ?? FOLDER_PALETTE[0];
}

export function listReports(): ReportSummary[] {
	return loadIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadReport(id: string): SavedReport | null {
	try {
		const raw = localStorage.getItem(REPORT_PREFIX + id);
		if (raw) return JSON.parse(raw);
	} catch {
		/* ignore */
	}
	return null;
}

export function saveReport(report: SavedReport) {
	report.updatedAt = new Date().toISOString();
	safeSetItem(REPORT_PREFIX + report.id, JSON.stringify(report));

	// Update index
	const index = loadIndex();
	const summary: ReportSummary = {
		id: report.id,
		name: report.name,
		folder: report.folder,
		createdAt: report.createdAt,
		updatedAt: report.updatedAt,
		siteGroup: report.inspection.meta.siteGroup ?? '',
		siteName: report.inspection.meta.siteName,
		inspectorName: report.inspection.meta.inspectorName,
		inspectionDate: report.inspection.meta.inspectionDate
	};
	const existing = index.findIndex((r) => r.id === report.id);
	if (existing >= 0) {
		index[existing] = summary;
	} else {
		index.push(summary);
	}
	saveIndex(index);
}

function collectPhotoIds(inspection: Inspection): string[] {
	const ids: string[] = [];
	for (const item of inspection.checklist ?? []) {
		if (item.photoIds) ids.push(...item.photoIds);
	}
	for (const defect of inspection.defects ?? []) {
		if (defect.photoIds) ids.push(...defect.photoIds);
	}
	return ids;
}

export function deleteReport(id: string) {
	const report = loadReport(id);
	if (report) {
		const photoIds = collectPhotoIds(report.inspection);
		if (photoIds.length > 0) {
			deletePhotos(photoIds).catch(() => {});
		}
	}
	localStorage.removeItem(REPORT_PREFIX + id);
	const index = loadIndex().filter((r) => r.id !== id);
	saveIndex(index);
}

export function duplicateReport(id: string): string | null {
	const original = loadReport(id);
	if (!original) return null;

	const newId = generateId();
	const now = new Date().toISOString();
	const copy: SavedReport = structuredClone(original);
	copy.id = newId;
	copy.name = original.name + ' (עותק)';
	copy.createdAt = now;
	copy.updatedAt = now;
	// Strip photo references — duplicated reports start without photos
	for (const item of copy.inspection.checklist ?? []) {
		delete item.photoIds;
	}
	for (const defect of copy.inspection.defects ?? []) {
		delete defect.photoIds;
	}
	saveReport(copy);
	return newId;
}

export function createNewReport(folder = 'כללי'): SavedReport {
	const id = generateId();
	const now = new Date().toISOString();

	// Try to get remembered inspector name
	let inspectorName = '';
	try {
		inspectorName = localStorage.getItem('yanshuf_inspector') ?? '';
	} catch {
		/* ignore */
	}

	const report: SavedReport = {
		id,
		name: 'בדיקה חדשה',
		folder,
		createdAt: now,
		updatedAt: now,
		inspection: {
			meta: {
				siteGroup: '',
				siteName: '',
				inspectionDate: new Date().toISOString().split('T')[0],
				inspectorName,
				signatureText: ''
			},
			inverterConfigs: [],
			checklist: [],
			dcMeasurements: [],
			acMeasurements: [],
			inverterSerials: [],
			defects: []
		}
	};

	return report;
}

/** Migrate old single-inspection data to the new reports system */
export function migrateOldData() {
	const oldKey = 'yanshuf_inspection';
	try {
		const raw = localStorage.getItem(oldKey);
		if (raw && loadIndex().length === 0) {
			const inspection: Inspection = JSON.parse(raw);
			const report = createNewReport();
			report.inspection = inspection;
			report.name = inspection.meta.siteName || 'בדיקה מיובאת';
			saveReport(report);
			localStorage.removeItem(oldKey);
		}
	} catch {
		/* ignore */
	}
}
