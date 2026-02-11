import { createChecklistFromTemplate, checklistSections } from '../config/checklist.js';
import { createAcMeasurementsFromTemplate } from '../config/ac.js';
import type {
	InspectionMeta,
	InverterConfig,
	DcStringMeasurement,
	Defect
} from '../models/inspection.js';
import type { SavedReport } from './reports.js';
import { saveReport } from './reports.js';

/** Map a checklist sectionCode like "1.5" to its parent section title */
function getSectionTitle(sectionCode: string): string {
	const parentCode = sectionCode.split('.')[0];
	return checklistSections.find((s) => s.code === parentCode)?.title ?? '';
}

/** Shorten a verbose checklist description into a compact fault label */
function shortenFault(desc: string): string {
	// Strip leading imperative verbs
	let s = desc
		.replace(/^(ודא|בדוק|בצע|ציין|חזק|מדוד)\s+(את\s+|כי\s+|על\s+)?/i, '')
		.replace(/^(המצאות ו)/, '');
	// Take only the first sentence/clause
	s = s.split(/[.;]/, 1)[0].split(' - ', 1)[0];
	// Trim and cap length
	s = s.trim();
	if (s.length > 60) s = s.slice(0, 57) + '...';
	// Capitalize first char (for Hebrew it's a no-op but just in case)
	return s;
}

const INSPECTOR_KEY = 'yanshuf_inspector';
const STRING_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function saveInspectorName(name: string) {
	try {
		localStorage.setItem(INSPECTOR_KEY, name);
	} catch {
		/* ignore */
	}
}

function createDcMeasurement(
	inverterIndex: number,
	stringLabel: string,
	parentId: string | null = null
): DcStringMeasurement {
	return {
		id: crypto.randomUUID(),
		parentId,
		inverterIndex,
		stringLabel,
		panelCount: undefined,
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
	// Migrate legacy DC measurements: backfill id/parentId
	for (const m of currentReport.inspection.dcMeasurements) {
		if (!m.id) m.id = crypto.randomUUID();
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

	function updateReportName(name: string) {
		currentReport.name = name;
		save();
	}

	function updateMeta(meta: Partial<InspectionMeta>) {
		currentReport.inspection.meta = { ...currentReport.inspection.meta, ...meta };
		if (meta.siteName && (currentReport.name === 'בדיקה חדשה' || !currentReport.name)) {
			currentReport.name = meta.siteName;
		}
		save();
	}

	function setInverterConfigs(count: number, defaultStrings = 4) {
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
			save();
		}
	}

	function markSectionAllOk(sectionCode: string) {
		currentReport.inspection.checklist
			.filter((c) => c.sectionCode.startsWith(sectionCode + '.'))
			.forEach((c) => {
				if (!c.status) c.status = 'תקין';
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
			currentReport.inspection.defects.splice(index + 1, 0, { ...d });
			save();
		}
	}

	let autoDefects = $derived(
		currentReport.inspection.checklist
			.filter((c) => c.status === 'לא תקין')
			.map((c) => ({
				sectionCode: c.sectionCode,
				component: getSectionTitle(c.sectionCode),
				fault: shortenFault(c.description),
				location: `סעיף ${c.sectionCode}`,
				status: c.notes || ''
			}))
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
		save,
		updateReportName,
		updateMeta,
		setInverterConfigs,
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
		duplicateDefect
	};
}
