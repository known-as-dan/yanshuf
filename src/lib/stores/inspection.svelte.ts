import { createChecklistFromTemplate, checklistSections, getItemConfig } from '../config/checklist.js';
import { createAcMeasurementsFromTemplate } from '../config/ac.js';
import {
	buildReportName,
	type InspectionMeta,
	type InverterConfig,
	type DcStringMeasurement,
	type Defect
} from '../models/inspection.js';
import type { SavedReport } from './reports.js';
import { saveReport, safeSetItem } from './reports.js';

/** Map a checklist sectionCode like "1.5" to its parent section title */
function getSectionTitle(sectionCode: string): string {
	const parentCode = sectionCode.split('.')[0];
	return checklistSections.find((s) => s.code === parentCode)?.title ?? '';
}

/** Shorten a verbose checklist description into a compact fault label */
export function shortenFault(desc: string): string {
	// Strip leading imperative verbs
	let s = desc
		.replace(/^(ודא|וודא|בחן|בדוק|בצע|ציין|חזק|מדוד|השווה)\s+(את\s+|כי\s+|על\s+)?/i, '')
		.replace(/^(המצאות ו)/, '');
	// Take only the first sentence/clause
	s = s.split(/[.;]/, 1)[0].split(' - ', 1)[0];
	// Trim and cap length
	s = s.trim();
	if (s.length > 60) s = s.slice(0, 57) + '...';
	// Capitalize first char (for Hebrew it's a no-op but just in case)
	return s;
}

/** Compute auto-defects from checklist items marked as failed */
export function computeAutoDefects(checklist: { sectionCode: string; description: string; status?: string; notes?: string }[]): Defect[] {
	return checklist
		.filter((c) => c.status === 'לא תקין')
		.map((c) => ({
			sectionCode: c.sectionCode,
			component: getSectionTitle(c.sectionCode),
			fault: shortenFault(c.description),
			location: `סעיף ${c.sectionCode}`,
			status: c.notes || ''
		}));
}

/** crypto.randomUUID fallback for older iOS Safari / non-HTTPS */
function uuid(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
		(+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
	);
}

const INSPECTOR_KEY = 'yanshuf_inspector';
const STRING_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function saveInspectorName(name: string) {
	safeSetItem(INSPECTOR_KEY, name);
}

function createDcMeasurement(
	inverterIndex: number,
	stringLabel: string,
	parentId: string | null = null
): DcStringMeasurement {
	return {
		id: uuid(),
		parentId,
		inverterIndex,
		stringLabel,
		openCircuitVoltage: undefined,
		operatingCurrent: undefined,
		stringRiso: undefined,
		feedRisoNegative: undefined,
		feedRisoPositive: undefined
	};
}

function generateDcMeasurements(configs: InverterConfig[]): DcStringMeasurement[] {
	return configs.flatMap((inv) =>
		Array.from({ length: inv.stringCount }, (_, i) =>
			createDcMeasurement(inv.index, STRING_LABELS[i] || `S${i + 1}`)
		)
	);
}

/** Return DC measurements for an inverter in depth-first tree order, each with its depth level */
export function getOrderedDcTree(
	measurements: DcStringMeasurement[],
	inverterIndex: number
): { measurement: DcStringMeasurement; depth: number }[] {
	const forInverter = measurements.filter((m) => m.inverterIndex === inverterIndex);
	const childrenOf = (parentId: string | null) =>
		forInverter.filter((m) => m.parentId === parentId);

	const result: { measurement: DcStringMeasurement; depth: number }[] = [];
	function walk(parentId: string | null, depth: number) {
		for (const m of childrenOf(parentId)) {
			result.push({ measurement: m, depth });
			walk(m.id, depth + 1);
		}
	}
	walk(null, 0);
	return result;
}

/** Get all descendant ids of a measurement (recursive) */
function getDescendantIds(measurements: DcStringMeasurement[], parentId: string): string[] {
	const ids: string[] = [];
	for (const m of measurements) {
		if (m.parentId === parentId) {
			ids.push(m.id);
			ids.push(...getDescendantIds(measurements, m.id));
		}
	}
	return ids;
}

/** Find the next available child label for a parent */
function nextChildLabel(measurements: DcStringMeasurement[], parentId: string, parentLabel: string): string {
	const siblings = measurements.filter((m) => m.parentId === parentId);
	return `${parentLabel}.${siblings.length + 1}`;
}

/** Find the next available top-level label for an inverter */
function nextTopLevelLabel(measurements: DcStringMeasurement[], inverterIndex: number): string {
	const topLevel = measurements.filter((m) => m.inverterIndex === inverterIndex && m.parentId === null);
	const usedLetters = new Set(topLevel.map((m) => m.stringLabel));
	for (let i = 0; i < STRING_LABELS.length; i++) {
		if (!usedLetters.has(STRING_LABELS[i])) return STRING_LABELS[i];
	}
	return `S${topLevel.length + 1}`;
}

function generateInverterSerials(configs: InverterConfig[]) {
	return configs.map((inv) => ({
		inverterIndex: inv.index,
		serialNumber: ''
	}));
}

export function createInspectionStore(report: SavedReport) {
	let currentReport = $state<SavedReport>(report);

	// Defensive defaults: old localStorage data may have undefined arrays
	const ins = currentReport.inspection;
	ins.meta.siteGroup ??= '';
	ins.inverterConfigs ??= [];
	ins.checklist ??= [];
	ins.dcMeasurements ??= [];
	ins.acMeasurements ??= [];
	ins.inverterSerials ??= [];
	ins.defects ??= [];

	// Initialize checklist/AC if empty (new report), or sync with template
	if (currentReport.inspection.checklist.length === 0) {
		currentReport.inspection.checklist = createChecklistFromTemplate();
	} else {
		// Ensure any new template items are added to existing reports
		const template = createChecklistFromTemplate();
		const existing = new Set(currentReport.inspection.checklist.map((c) => c.sectionCode));
		for (const item of template) {
			if (!existing.has(item.sectionCode)) {
				currentReport.inspection.checklist.push(item);
			}
		}
	}
	// Migrate legacy "לא קיים" → "לא רלוונטי"
	let migrated = false;
	for (const item of currentReport.inspection.checklist) {
		if (item.status === 'לא קיים') {
			item.status = 'לא רלוונטי';
			migrated = true;
		}
	}
	if (migrated) saveReport(currentReport);

	// Initialize inverter configs if empty (new report)
	if (currentReport.inspection.inverterConfigs.length === 0) {
		const defaultCount = 3;
		const configs: InverterConfig[] = Array.from({ length: defaultCount }, (_, i) => ({
			index: i + 1,
			label: `ממיר ${i + 1}`,
			stringCount: 1
		}));
		currentReport.inspection.inverterConfigs = configs;
		currentReport.inspection.dcMeasurements = generateDcMeasurements(configs);
		currentReport.inspection.inverterSerials = generateInverterSerials(configs);
	}

	// Migrate legacy DC measurements: backfill id/parentId
	for (const m of currentReport.inspection.dcMeasurements) {
		if (!m.id) m.id = uuid();
		if (m.parentId === undefined) m.parentId = null;
	}

	if (currentReport.inspection.acMeasurements.length === 0) {
		currentReport.inspection.acMeasurements = createAcMeasurementsFromTemplate();
	} else {
		const template = createAcMeasurementsFromTemplate();
		const existing = new Set(currentReport.inspection.acMeasurements.map((a) => a.itemCode));
		for (const item of template) {
			if (!existing.has(item.itemCode)) {
				currentReport.inspection.acMeasurements.push(item);
			}
		}
	}

	function save() {
		saveReport(currentReport);
		if (currentReport.inspection.meta.inspectorName) {
			saveInspectorName(currentReport.inspection.meta.inspectorName);
		}
	}

	function updateMeta(meta: Partial<InspectionMeta>) {
		currentReport.inspection.meta = { ...currentReport.inspection.meta, ...meta };
		currentReport.name = buildReportName(currentReport.inspection.meta);
		save();
	}

	function setInverterConfigs(count: number, defaultStrings = 1) {
		const existing = currentReport.inspection.inverterConfigs;
		const configs: InverterConfig[] = Array.from({ length: count }, (_, i) => ({
			index: i + 1,
			label: existing[i]?.label ?? `ממיר ${i + 1}`,
			stringCount: existing[i]?.stringCount ?? defaultStrings
		}));
		currentReport.inspection.inverterConfigs = configs;
		currentReport.inspection.dcMeasurements = generateDcMeasurements(configs);
		currentReport.inspection.inverterSerials = generateInverterSerials(configs);
		save();
	}

	function removeInverterConfig(index: number) {
		const filtered = currentReport.inspection.inverterConfigs.filter(
			(c) => c.index !== index
		);
		const configs: InverterConfig[] = filtered.map((c, i) => ({
			...c,
			index: i + 1
		}));
		currentReport.inspection.inverterConfigs = configs;
		currentReport.inspection.dcMeasurements = generateDcMeasurements(configs);
		currentReport.inspection.inverterSerials = generateInverterSerials(configs);
		save();
	}

	function updateInverterConfig(index: number, updates: Partial<InverterConfig>) {
		const config = currentReport.inspection.inverterConfigs.find((c) => c.index === index);
		if (config) {
			Object.assign(config, updates);
			currentReport.inspection.dcMeasurements = generateDcMeasurements(
				currentReport.inspection.inverterConfigs
			);
			currentReport.inspection.inverterSerials = generateInverterSerials(
				currentReport.inspection.inverterConfigs
			);
			save();
		}
	}

	function updateChecklistItem(sectionCode: string, status?: string, notes?: string) {
		const item = currentReport.inspection.checklist.find((c) => c.sectionCode === sectionCode);
		if (item) {
			if (status !== undefined) item.status = status as typeof item.status;
			if (notes !== undefined) item.notes = notes;
			// Auto-cascade: 5.4 (climate monitoring) → 5.5, 5.6 (sensors)
			if (sectionCode === '5.4' && status !== undefined) {
				for (const code of ['5.5', '5.6']) {
					const dep = currentReport.inspection.checklist.find((c) => c.sectionCode === code);
					if (dep) {
						dep.status = status === 'לא רלוונטי' ? 'לא רלוונטי' : undefined;
						dep.notes = status === 'לא רלוונטי' ? '' : dep.notes;
					}
				}
			}
			save();
		}
	}

	function markSectionAllOk(sectionCode: string) {
		currentReport.inspection.checklist
			.filter((c) => c.sectionCode.startsWith(sectionCode + '.'))
			.forEach((c) => {
				if (!c.status) {
					const cfg = getItemConfig(c.sectionCode);
					// Skip select items — they need explicit choice
					if (cfg?.selectOptions) return;
					c.status = cfg?.okLabel ?? 'תקין';
				}
			});
		save();
	}

	function updateDcMeasurement(id: string, updates: Partial<DcStringMeasurement>) {
		const m = currentReport.inspection.dcMeasurements.find((d) => d.id === id);
		if (m) {
			Object.assign(m, updates);
			save();
		}
	}

	function addDcString(inverterIndex: number) {
		const label = nextTopLevelLabel(currentReport.inspection.dcMeasurements, inverterIndex);
		currentReport.inspection.dcMeasurements.push(
			createDcMeasurement(inverterIndex, label)
		);
		save();
	}

	function addDcSubstring(parentId: string) {
		const parent = currentReport.inspection.dcMeasurements.find((m) => m.id === parentId);
		if (!parent) return;
		// Cap nesting at 3 levels (depth 0 → 1 → 2)
		let depth = 0;
		let cur = parent;
		while (cur.parentId) {
			depth++;
			const p = currentReport.inspection.dcMeasurements.find((m) => m.id === cur.parentId);
			if (!p) break;
			cur = p;
		}
		if (depth >= 2) return;
		const label = nextChildLabel(
			currentReport.inspection.dcMeasurements,
			parentId,
			parent.stringLabel
		);
		currentReport.inspection.dcMeasurements.push(
			createDcMeasurement(parent.inverterIndex, label, parentId)
		);
		save();
	}

	function removeDcMeasurement(id: string) {
		const idsToRemove = new Set([id, ...getDescendantIds(currentReport.inspection.dcMeasurements, id)]);
		currentReport.inspection.dcMeasurements = currentReport.inspection.dcMeasurements.filter(
			(m) => !idsToRemove.has(m.id)
		);
		save();
	}

	function updateAcMeasurement(itemCode: string, result?: string | number, notes?: string) {
		const m = currentReport.inspection.acMeasurements.find((a) => a.itemCode === itemCode);
		if (m) {
			if (result !== undefined) m.result = result;
			if (notes !== undefined) m.notes = notes;
			save();
		}
	}

	function updateInverterSerial(inverterIndex: number, serialNumber: string) {
		const s = currentReport.inspection.inverterSerials.find(
			(i) => i.inverterIndex === inverterIndex
		);
		if (s) {
			s.serialNumber = serialNumber;
			save();
		}
	}

	function addDefect(defect?: Partial<Defect>) {
		currentReport.inspection.defects.push({
			component: defect?.component ?? '',
			fault: defect?.fault ?? '',
			location: defect?.location ?? '',
			status: defect?.status ?? ''
		});
		save();
	}

	function removeDefect(index: number) {
		currentReport.inspection.defects.splice(index, 1);
		save();
	}

	function duplicateDefect(index: number) {
		const d = currentReport.inspection.defects[index];
		if (d) {
			currentReport.inspection.defects.splice(index + 1, 0, { ...d, photoIds: undefined });
			save();
		}
	}

	function addChecklistPhoto(sectionCode: string, photoId: string) {
		const item = currentReport.inspection.checklist.find((c) => c.sectionCode === sectionCode);
		if (item) {
			item.photoIds = [...(item.photoIds ?? []), photoId];
			save();
		}
	}

	function removeChecklistPhoto(sectionCode: string, photoId: string) {
		const item = currentReport.inspection.checklist.find((c) => c.sectionCode === sectionCode);
		if (item && item.photoIds) {
			item.photoIds = item.photoIds.filter((id) => id !== photoId);
			save();
		}
	}

	function addDefectPhoto(index: number, photoId: string) {
		const d = currentReport.inspection.defects[index];
		if (d) {
			d.photoIds = [...(d.photoIds ?? []), photoId];
			save();
		}
	}

	function removeDefectPhoto(index: number, photoId: string) {
		const d = currentReport.inspection.defects[index];
		if (d && d.photoIds) {
			d.photoIds = d.photoIds.filter((id) => id !== photoId);
			save();
		}
	}

	let totalPhotos = $derived(
		currentReport.inspection.checklist.reduce((n, c) => n + (c.photoIds?.length ?? 0), 0) +
			currentReport.inspection.defects.reduce((n, d) => n + (d.photoIds?.length ?? 0), 0)
	);

	let autoDefects = $derived(
		computeAutoDefects(currentReport.inspection.checklist)
	);

	let allDefects = $derived([
		...autoDefects,
		...currentReport.inspection.defects
	]);

	return {
		get inspection() {
			return currentReport.inspection;
		},
		get report() {
			return currentReport;
		},
		get autoDefects() {
			return autoDefects;
		},
		get allDefects() {
			return allDefects;
		},
		get totalPhotos() {
			return totalPhotos;
		},
		save,
		updateMeta,
		setInverterConfigs,
		removeInverterConfig,
		updateInverterConfig,
		updateChecklistItem,
		markSectionAllOk,
		updateDcMeasurement,
		addDcString,
		addDcSubstring,
		removeDcMeasurement,
		updateAcMeasurement,
		updateInverterSerial,
		addDefect,
		removeDefect,
		duplicateDefect,
		addChecklistPhoto,
		removeChecklistPhoto,
		addDefectPhoto,
		removeDefectPhoto
	};
}
