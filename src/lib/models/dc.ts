import type { DcGroup, DcStringMeasurement, Inspection } from './inspection.js';

export const DC_FIELDS = [
	{ key: 'panelCount', label: 'קולטים', unit: '', step: '1' },
	{ key: 'openCircuitVoltage', label: 'מתח ריקם', unit: 'V', step: 'any' },
	{ key: 'operatingCurrent', label: 'זרם עבודה', unit: 'A', step: 'any' },
	{ key: 'stringRiso', label: 'בידוד מחרוזת', unit: 'MΩ', step: 'any' },
	{ key: 'feedRisoNegative', label: 'בידוד הזנה −', unit: 'MΩ', step: 'any' },
	{ key: 'feedRisoPositive', label: 'בידוד הזנה +', unit: 'MΩ', step: 'any' }
] as const;
export type DcField = (typeof DC_FIELDS)[number]['key'];

export function parseMeasurement(raw: string): number | undefined {
	if (!raw.trim()) return undefined;
	const value = Number(raw.trim().replace(',', '.'));
	return Number.isFinite(value) ? value : undefined;
}

/** One non-destructive migration: old inverter-based rows keep IDs and readings. */
export function ensureDcGroups(inspection: Inspection): void {
	inspection.dcGroups ??= [];
	for (const row of inspection.dcMeasurements) {
		if (row.groupId && inspection.dcGroups.some((group) => group.id === row.groupId)) continue;
		const id = `legacy-inverter-${row.inverterIndex}`;
		if (!inspection.dcGroups.some((group) => group.id === id)) {
			inspection.dcGroups.push({
				id,
				label:
					inspection.inverterConfigs.find((inv) => inv.index === row.inverterIndex)?.label ??
					(row.inverterIndex > 0 ? `ממיר ${row.inverterIndex}` : ''),
				inverterIndex: row.inverterIndex > 0 ? row.inverterIndex : undefined
			});
		}
		row.groupId = id;
	}
}

/** Linear tree traversal, with cycle/orphan guards for imported legacy reports. */
export function orderedDcRows(
	rows: DcStringMeasurement[]
): { measurement: DcStringMeasurement; depth: number }[] {
	const children = new Map<string | null, DcStringMeasurement[]>();
	const known = new Set(rows.map((row) => row.id));
	for (const row of rows) {
		const parent = row.parentId && known.has(row.parentId) ? row.parentId : null;
		children.set(parent, [...(children.get(parent) ?? []), row]);
	}
	const visited = new Set<string>();
	const ordered: { measurement: DcStringMeasurement; depth: number }[] = [];
	function walk(row: DcStringMeasurement, depth: number) {
		if (visited.has(row.id)) return;
		visited.add(row.id);
		ordered.push({ measurement: row, depth });
		for (const child of children.get(row.id) ?? []) walk(child, depth + 1);
	}
	for (const row of children.get(null) ?? []) walk(row, 0);
	for (const row of rows) if (!visited.has(row.id)) walk(row, 0);
	return ordered;
}

export function dcGroupLabel(group: DcGroup, index: number): string {
	return group.label.trim() || `קבוצת מדידה ${index + 1}`;
}

export function dcExportRows(
	inspection: Inspection
): Record<string, string | number | undefined>[] {
	const rows: Record<string, string | number | undefined>[] = [];
	const groups = inspection.dcGroups ?? [];
	const added = new Set<string>();
	groups.forEach((group, index) => {
		for (const { measurement } of orderedDcRows(
			inspection.dcMeasurements.filter((row) => row.groupId === group.id)
		)) {
			added.add(measurement.id);
			rows.push(toExportRow(measurement, dcGroupLabel(group, index)));
		}
	});
	for (const { measurement } of orderedDcRows(
		inspection.dcMeasurements.filter((row) => !added.has(row.id))
	)) {
		rows.push(toExportRow(measurement, measurement.inverterIndex));
	}
	return rows;
}

function toExportRow(
	row: DcStringMeasurement,
	group: string | number
): Record<string, string | number | undefined> {
	return {
		inverterIndex: group,
		stringLabel: row.stringLabel,
		panelCount: row.panelCount,
		openCircuitVoltage: row.openCircuitVoltage,
		operatingCurrent: row.operatingCurrent,
		stringRiso: row.stringRiso,
		feedRisoNegative: row.feedRisoNegative,
		feedRisoPositive: row.feedRisoPositive
	};
}
