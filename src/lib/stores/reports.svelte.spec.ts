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
	renameFolder,
	moveReport,
	updateFolderColor,
	safeSetItem,
	setStorageErrorHandler,
	FOLDER_PALETTE,
	type Folder,
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
		const names = reports.map((r) => r.name);
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
		expect.assertions(2);
		const folders = loadFolders();
		expect(folders).toHaveLength(1);
		expect(folders[0]).toEqual({ name: 'כללי', color: FOLDER_PALETTE[0] });
	});

	it('saves and loads folders', () => {
		expect.assertions(1);
		const folders: Folder[] = [
			{ name: 'כללי', color: FOLDER_PALETTE[0] },
			{ name: 'תיקייה חדשה', color: FOLDER_PALETTE[1] }
		];
		saveFolders(folders);
		expect(loadFolders()).toEqual(folders);
	});

	it('migrates old string[] format to Folder[]', () => {
		expect.assertions(3);
		// Simulate old format
		localStorage.setItem('yanshuf_folders', JSON.stringify(['כללי', 'ישנה']));
		const folders = loadFolders();
		expect(folders).toHaveLength(2);
		expect(folders[0].name).toBe('כללי');
		expect(folders[1].name).toBe('ישנה');
	});
});

describe('renameFolder', () => {
	it('renames folder and updates all reports', () => {
		expect.assertions(4);
		saveFolders([{ name: 'כללי', color: FOLDER_PALETTE[0] }]);
		const report = createNewReport('כללי');
		saveReport(report);

		const success = renameFolder('כללי', 'ראשי');
		expect(success).toBe(true);

		const folders = loadFolders();
		expect(folders[0].name).toBe('ראשי');

		const loaded = loadReport(report.id);
		expect(loaded!.folder).toBe('ראשי');

		const index = listReports();
		expect(index[0].folder).toBe('ראשי');
	});

	it('rejects empty name', () => {
		expect.assertions(1);
		saveFolders([{ name: 'כללי', color: FOLDER_PALETTE[0] }]);
		expect(renameFolder('כללי', '  ')).toBe(false);
	});

	it('rejects duplicate name', () => {
		expect.assertions(1);
		saveFolders([
			{ name: 'כללי', color: FOLDER_PALETTE[0] },
			{ name: 'אחר', color: FOLDER_PALETTE[1] }
		]);
		expect(renameFolder('כללי', 'אחר')).toBe(false);
	});
});

describe('moveReport', () => {
	it('moves a report to a different folder', () => {
		expect.assertions(2);
		const report = createNewReport('כללי');
		saveReport(report);

		moveReport(report.id, 'חדש');
		const loaded = loadReport(report.id);
		expect(loaded!.folder).toBe('חדש');

		const index = listReports();
		expect(index[0].folder).toBe('חדש');
	});
});

describe('updateFolderColor', () => {
	it('changes a folder color', () => {
		expect.assertions(1);
		saveFolders([{ name: 'כללי', color: FOLDER_PALETTE[0] }]);
		updateFolderColor('כללי', '#ff0000');
		const folders = loadFolders();
		expect(folders[0].color).toBe('#ff0000');
	});
});

describe('safeSetItem', () => {
	it('calls error handler on quota exceeded', () => {
		expect.assertions(1);
		let errorMsg = '';
		setStorageErrorHandler((msg) => {
			errorMsg = msg;
		});

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
