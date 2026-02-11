import type { Inspection } from '../models/inspection.js';

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
	siteName: string;
	inspectorName: string;
	inspectionDate: string;
};

const REPORTS_INDEX_KEY = 'yanshuf_reports_index';
const REPORT_PREFIX = 'yanshuf_report_';
const FOLDERS_KEY = 'yanshuf_folders';

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
	localStorage.setItem(REPORTS_INDEX_KEY, JSON.stringify(index));
}

export function loadFolders(): string[] {
	try {
		const raw = localStorage.getItem(FOLDERS_KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		/* ignore */
	}
	return ['כללי'];
}

export function saveFolders(folders: string[]) {
	localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
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
	localStorage.setItem(REPORT_PREFIX + report.id, JSON.stringify(report));

	// Update index
	const index = loadIndex();
	const summary: ReportSummary = {
		id: report.id,
		name: report.name,
		folder: report.folder,
		createdAt: report.createdAt,
		updatedAt: report.updatedAt,
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

export function deleteReport(id: string) {
	localStorage.removeItem(REPORT_PREFIX + id);
	const index = loadIndex().filter((r) => r.id !== id);
	saveIndex(index);
}

export function duplicateReport(id: string): string | null {
	const original = loadReport(id);
	if (!original) return null;

	const newId = generateId();
	const now = new Date().toISOString();
	const copy: SavedReport = {
		...original,
		id: newId,
		name: original.name + ' (עותק)',
		createdAt: now,
		updatedAt: now
	};
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
