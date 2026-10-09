import { describe, it, expect } from 'vitest';
import { createDefaultInspection, type DcStringMeasurement } from './inspection.js';
import { ensureDcGroups, orderedDcRows, dcExportRows, parseMeasurement } from './dc.js';

const row = (id: string, parentId: string | null = null): DcStringMeasurement => ({
	id,
	parentId,
	inverterIndex: 0,
	stringLabel: id
});

describe('field DC measurements', () => {
	it('exports independent field labels, panel counts, zeros and blanks in the native columns', () => {
		const inspection = createDefaultInspection();
		inspection.dcGroups = [{ id: 'north', label: 'ארון צפוני' }];
		inspection.dcMeasurements = [
			{ ...row('unmarked'), groupId: 'north', panelCount: 18, operatingCurrent: 0 }
		];
		expect(dcExportRows(inspection)).toEqual([
			{
				inverterIndex: 'ארון צפוני',
				stringLabel: 'unmarked',
				panelCount: 18,
				openCircuitVoltage: undefined,
				operatingCurrent: 0,
				stringRiso: undefined,
				feedRisoNegative: undefined,
				feedRisoPositive: undefined
			}
		]);
	});
	it('migrates old readings without changing values or identities', () => {
		const inspection = createDefaultInspection();
		inspection.inverterConfigs = [{ index: 2, label: 'ישן', stringCount: 1 }];
		inspection.dcMeasurements = [{ ...row('old'), inverterIndex: 2, openCircuitVoltage: 0 }];
		ensureDcGroups(inspection);
		ensureDcGroups(inspection);
		expect(inspection.dcGroups).toHaveLength(1);
		expect(inspection.dcMeasurements[0]).toMatchObject({
			id: 'old',
			inverterIndex: 2,
			openCircuitVoltage: 0,
			groupId: 'legacy-inverter-2'
		});
	});
	it('retains every point when an imported tree contains cycles or missing parents', () => {
		const rows = [
			row('a', 'b'),
			row('b', 'a'),
			row('orphan', 'missing'),
			row('root'),
			row('child', 'root')
		];
		const ordered = orderedDcRows(rows);
		expect(new Set(ordered.map((item) => item.measurement.id))).toEqual(
			new Set(rows.map((item) => item.id))
		);
		expect(ordered).toHaveLength(rows.length);
		expect(ordered.find((item) => item.measurement.id === 'child')?.depth).toBe(1);
	});
	it('distinguishes empty and invalid values from zero', () => {
		expect(parseMeasurement('')).toBeUndefined();
		expect(parseMeasurement('0')).toBe(0);
		expect(parseMeasurement('1,25')).toBe(1.25);
		expect(parseMeasurement('Infinity')).toBeUndefined();
	});
});
