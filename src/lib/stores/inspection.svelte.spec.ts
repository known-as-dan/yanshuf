import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createInspectionStore, getOrderedDcTree } from './inspection.svelte.js';
import { createNewReport, loadReport, listReports, setReportAccount } from './reports.js';

describe('createInspectionStore', () => {
	beforeEach(() => {
		localStorage.clear();
		setReportAccount(null);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		setReportAccount(null);
	});
	it('initializes with default values for a new report', () => {
		const report = createNewReport();
		const store = createInspectionStore(report);

		expect(store.inspection.inverterConfigs.length).toBe(0);
		expect(store.inspection.checklist.length).toBeGreaterThan(0);
		expect(store.inspection.dcMeasurements.length).toBe(0);
	});

	it('derives autoDefects from checklist status', () => {
		const report = createNewReport();
		const store = createInspectionStore(report);

		const item = store.inspection.checklist[0];
		store.updateChecklistItem(item.sectionCode, 'לא תקין', 'Some fault notes');

		expect(store.autoDefects.length).toBe(1);
		expect(store.autoDefects[0].sectionCode).toBe(item.sectionCode);
		expect(store.autoDefects[0].status).toBe('Some fault notes');
		expect(store.allDefects.length).toBe(1);
	});
	it('preserves field points and readings when inverter metadata changes', () => {
		const store = createInspectionStore(createNewReport());
		store.addDcGroup();
		const point = store.inspection.dcMeasurements[0];
		store.updateDcMeasurement(point.id, {
			stringLabel: 'unmarked',
			operatingCurrent: 0,
			openCircuitVoltage: 612
		});
		store.addDcSubstring(point.id);
		const ids = store.inspection.dcMeasurements.map((row) => row.id);
		const group = point.groupId;
		store.setInverterConfigs(3);
		store.removeInverterConfig(2);
		store.setInverterConfigs(0);
		expect(store.inspection.dcMeasurements.map((row) => row.id)).toEqual(ids);
		expect(store.inspection.dcMeasurements[0]).toMatchObject({
			stringLabel: 'unmarked',
			groupId: group,
			operatingCurrent: 0,
			openCircuitVoltage: 612
		});
		expect(store.inspection.dcMeasurements[1].parentId).toBe(point.id);
	});

	it('correctly orders DC tree with substrings', async () => {
		const report = createNewReport();
		const store = createInspectionStore(report);

		store.addDcGroup();
		// Points do not depend on inverter configuration
		const m1 = store.inspection.dcMeasurements.find((m) => m.stringLabel === '1')!;

		// Add substring to A
		store.addDcSubstring(m1.id);
		const substring = store.inspection.dcMeasurements.find((m) => m.parentId === m1.id)!;
		expect(substring.stringLabel).toBe('1.1');

		// Check ordered tree
		const ordered = getOrderedDcTree(store.inspection.dcMeasurements, 0);

		const idxA = ordered.findIndex((n) => n.measurement.id === m1.id);
		const idxA1 = ordered.findIndex((n) => n.measurement.id === substring.id);

		expect(idxA).toBeLessThan(idxA1);
		expect(ordered[idxA1].depth).toBe(1);
	});

	it('keeps a stale editor on one recovery report without overwriting the other tab', () => {
		const report = createNewReport();
		const first = createInspectionStore(report);
		first.save();
		const second = createInspectionStore(loadReport(report.id)!);
		first.updateMeta({ siteName: 'First tab' });
		second.updateMeta({ siteName: 'Second tab' });
		const copyId = second.report.id;
		second.updateMeta({ inspectorName: 'Still editing' });
		expect(copyId).not.toBe(report.id);
		expect(second.report.id).toBe(copyId);
		expect(listReports()).toHaveLength(2);
		expect(loadReport(report.id)?.inspection.meta.siteName).toBe('First tab');
		expect(loadReport(copyId)?.inspection.meta.inspectorName).toBe('Still editing');
	});
	it('keeps an unsaved edit in memory and surfaces quota failure until retry succeeds', () => {
		const store = createInspectionStore(createNewReport());
		store.save();
		const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('Full', 'QuotaExceededError');
		});
		store.updateMeta({ siteName: 'Unsaved field reading' });
		expect(store.saveError).toBeTruthy();
		expect(store.inspection.meta.siteName).toBe('Unsaved field reading');
		write.mockRestore();
		store.save();
		expect(store.saveError).toBe('');
		expect(loadReport(store.report.id)?.inspection.meta.siteName).toBe('Unsaved field reading');
	});
	it('does not let an editor write into a different account', () => {
		setReportAccount('alice');
		const store = createInspectionStore(createNewReport());
		store.save();
		setReportAccount('bob');
		store.updateMeta({ siteName: 'Wrong account' });
		expect(store.saveError).toContain('החשבון השתנה');
		expect(listReports()).toHaveLength(0);
	});

	it('syncs new template items into existing reports', () => {
		const report = createNewReport();
		// Simulate an old report missing some items
		report.inspection.checklist = report.inspection.checklist.slice(0, 5);

		const store = createInspectionStore(report);
		// It should have backfilled the missing items from the template
		expect(store.inspection.checklist.length).toBeGreaterThan(5);
	});
});
