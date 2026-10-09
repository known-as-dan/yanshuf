import { describe, it, expect, beforeEach } from 'vitest';
import { createInspectionStore, getOrderedDcTree } from './inspection.svelte.js';
import { createNewReport } from './reports.js';

describe('createInspectionStore', () => {
	beforeEach(() => {
		localStorage.clear();
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

	it('syncs new template items into existing reports', () => {
		const report = createNewReport();
		// Simulate an old report missing some items
		report.inspection.checklist = report.inspection.checklist.slice(0, 5);

		const store = createInspectionStore(report);
		// It should have backfilled the missing items from the template
		expect(store.inspection.checklist.length).toBeGreaterThan(5);
	});
});
