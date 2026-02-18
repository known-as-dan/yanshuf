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

		expect(store.inspection.inverterConfigs.length).toBe(3);
		expect(store.inspection.checklist.length).toBeGreaterThan(0);
		expect(store.inspection.dcMeasurements.length).toBe(3); // 3 inverters * 1 string each
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

	it('correctly orders DC tree with substrings', async () => {
		const report = createNewReport();
		const store = createInspectionStore(report);
		
		// Get first string of inverter 1
		const m1 = store.inspection.dcMeasurements.find(m => m.inverterIndex === 1 && m.stringLabel === 'A')!;
		
		// Add substring to A
		store.addDcSubstring(m1.id);
		const substring = store.inspection.dcMeasurements.find(m => m.parentId === m1.id)!;
		expect(substring.stringLabel).toBe('A.1');

		// Check ordered tree
		const ordered = getOrderedDcTree(store.inspection.dcMeasurements, 1);
		
		const idxA = ordered.findIndex(n => n.measurement.id === m1.id);
		const idxA1 = ordered.findIndex(n => n.measurement.id === substring.id);
		
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
