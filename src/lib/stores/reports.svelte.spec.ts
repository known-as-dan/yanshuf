import { describe, it, expect, beforeEach } from 'vitest';
import {
	createNewReport,
	saveReport,
	loadReport,
	listReports,
	deleteReport,
	duplicateReport,
	loadFolders,
	saveFolders,
	safeSetItem,
	setStorageErrorHandler,
	type SavedReport
} from './reports.js';

beforeEach(() => {
	localStorage.clear();
	setStorageErrorHandler(null as unknown as (msg: string) => void);
});

describe('createNewReport', () => {
	it('creates a report with default folder', () => {
		expect.assertions(3);
		const report = createNewReport();
		expect(report.folder).toBe('כללי');
		expect(report.id).toBeTruthy();
		expect(report.inspection.meta.inspectionDate).toBeTruthy();
	});

	it('creates a report with custom folder', () => {
		expect.assertions(1);
		const report = createNewReport('מיוחד');
		expect(report.folder).toBe('מיוחד');
	});
});

describe('saveReport / loadReport', () => {
	it('saves and loads a report', () => {
		expect.assertions(2);
		const report = createNewReport();
		saveReport(report);
		const loaded = loadReport(report.id);
		expect(loaded).not.toBeNull();
		expect(loaded!.id).toBe(report.id);
	});

	it('returns null for missing report', () => {
		expect.assertions(1);
		expect(loadReport('nonexistent')).toBeNull();
	});
});

describe('listReports', () => {
	it('returns empty array initially', () => {
		expect.assertions(1);
		expect(listReports()).toHaveLength(0);
	});

	it('lists saved reports', () => {
		expect.assertions(2);
		const r1 = createNewReport();
		r1.name = 'first';
		saveReport(r1);

		const r2 = createNewReport();
		r2.name = 'second';
		saveReport(r2);

		const reports = listReports();
		expect(reports).toHaveLength(2);
		const names = reports.map(r => r.name);
		expect(names).toContain('first');
	});
});

describe('deleteReport', () => {
	it('removes the report from storage and index', () => {
		expect.assertions(2);
		const report = createNewReport();
		saveReport(report);
		expect(listReports()).toHaveLength(1);
		deleteReport(report.id);
		expect(listReports()).toHaveLength(0);
	});
});

describe('duplicateReport', () => {
	it('creates a copy with a new id and "(עותק)" suffix', () => {
		expect.assertions(4);
		const report = createNewReport();
		report.name = 'דוח מקורי';
		saveReport(report);

		const newId = duplicateReport(report.id);
		expect(newId).toBeTruthy();
		expect(listReports()).toHaveLength(2);

		const copy = loadReport(newId!);
		expect(copy).not.toBeNull();
		expect(copy!.name).toBe('דוח מקורי (עותק)');
	});

	it('returns null for non-existent report', () => {
		expect.assertions(1);
		expect(duplicateReport('nope')).toBeNull();
	});
});

describe('folders', () => {
	it('returns default folder when none saved', () => {
		expect.assertions(1);
		expect(loadFolders()).toEqual(['כללי']);
	});

	it('saves and loads folders', () => {
		expect.assertions(1);
		saveFolders(['כללי', 'תיקייה חדשה']);
		expect(loadFolders()).toEqual(['כללי', 'תיקייה חדשה']);
	});
});

describe('safeSetItem', () => {
	it('calls error handler on quota exceeded', () => {
		expect.assertions(1);
		let errorMsg = '';
		setStorageErrorHandler((msg) => { errorMsg = msg; });

		// Fill localStorage to trigger quota
		const big = 'x'.repeat(5 * 1024 * 1024);
		try {
			for (let i = 0; i < 100; i++) {
				localStorage.setItem(`fill_${i}`, big);
			}
		} catch {
			// expected
		}
		safeSetItem('test', big);
		expect(errorMsg).toContain('זיכרון');
	});
});
