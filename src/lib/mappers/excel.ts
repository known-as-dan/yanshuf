import ExcelJS from 'exceljs';
import {
	buildExportFilename,
	type Defect,
	type Inspection,
	type InspectionMeta
} from '../models/inspection.js';

// ── Template-based Excel export ──────────────────────────────────
// Loads the official template from /template.xlsx, fills in
// inspection data, and preserves all original formatting.
// The template is the sole source of truth for styling — code only
// writes values, never modifies formatting.
//
// Architecture:
//   1. Declarative sheet configs describe what goes where
//   2. validateTemplate() checks the loaded workbook matches expectations
//   3. Two unified fill engines: fillCodeRowSheet / fillAppendSheet
//   4. downloadWorkbook() orchestrates and returns warnings

// ── Types ────────────────────────────────────────────────────────

export type ExportWarning = {
	sheet: string;
	message: string;
	severity: 'error' | 'warning';
};

export type ExportResult = {
	warnings: ExportWarning[];
};

/** Meta cell: find row by scanning for a Hebrew label, write value to an offset column */
type MetaCell = {
	label: string;
	scanCol: number;
	valueCol: number;
	getValue: (meta: InspectionMeta) => string | undefined;
};

/** Header column matcher: substring or predicate against header text */
type ColumnMatcher = {
	match: string | ((header: string) => boolean);
	field: string;
};

/** Dynamic section where rows may need to be inserted (e.g. AC serial numbers) */
type DynamicSection = {
	codePrefix: string;
	descriptionCol: number;
	valueCol: number;
	getItems: (
		inspection: Inspection
	) => { code: string; description: string; value?: string | number }[];
};

/** CodeRow sheet: rows found by scanning col A for #.# codes */
type CodeRowSheetConfig = {
	type: 'codeRow';
	name: string;
	variants: string[];
	expectedHeaders: string[];
	metaCells?: MetaCell[];
	codeCol: number;
	valueCol: number;
	notesCol: number;
	getData: (
		inspection: Inspection
	) => Map<string, { value?: string | number; notes?: string }>;
	dynamicSections?: DynamicSection[];
};

/** AppendRows sheet: header row fixed, data rows appended */
type AppendSheetConfig = {
	type: 'append';
	name: string;
	variants: string[];
	expectedHeaders: string[];
	columns: ColumnMatcher[];
	styleSourceRow: number;
	/** Minimum total rows (header + data) to keep formatted, matching the template layout */
	minRows: number;
};

type SheetConfig = CodeRowSheetConfig | AppendSheetConfig;

/** Resolved sheet after validation */
type ValidatedSheet = {
	config: SheetConfig;
	ws: ExcelJS.Worksheet | null;
	codeToRow?: Map<string, number>;
	headerToCol?: Map<string, number>;
	colCount: number;
};

// ── Sheet configurations ─────────────────────────────────────────

const SHEET_CONFIGS: SheetConfig[] = [
	{
		type: 'codeRow',
		name: 'checklist',
		variants: ['פרוטוקול בדיקה תקופתית'],
		expectedHeaders: ['סעיף', 'תיאור', 'אישור', 'הערות'],
		metaCells: [
			{
				label: 'שם אתר',
				scanCol: 1,
				valueCol: 2,
				getValue: (m) => [m.siteGroup, m.siteName].filter(Boolean).join(' - ') || undefined
			},
			{
				label: 'תאריך',
				scanCol: 3,
				valueCol: 4,
				getValue: (m) => m.inspectionDate || undefined
			},
			{
				label: 'שם בודק',
				scanCol: 1,
				valueCol: 2,
				getValue: (m) => m.inspectorName || undefined
			},
			{
				label: 'חתימה',
				scanCol: 3,
				valueCol: 4,
				getValue: (m) => m.signatureText || undefined
			}
		],
		codeCol: 1,
		valueCol: 3,
		notesCol: 4,
		getData: (ins) => {
			const m = new Map<string, { value?: string | number; notes?: string }>();
			for (const item of ins.checklist) {
				m.set(item.sectionCode, { value: item.status, notes: item.notes });
			}
			return m;
		}
	},
	{
		type: 'append',
		name: 'dc',
		variants: [' ערכי DC', 'ערכי DC'],
		expectedHeaders: ['ממיר', 'מחרוזת', 'מתח', 'זרם', 'בידוד'],
		columns: [
			{ match: 'ממיר', field: 'inverterIndex' },
			{ match: 'מחרוזת', field: 'stringLabel' },
			{ match: 'מתח', field: 'openCircuitVoltage' },
			{ match: 'זרם', field: 'operatingCurrent' },
			{
				match: (h) => h.includes('בידוד') && h.includes('הזנה') && h.includes('-'),
				field: 'feedRisoNegative'
			},
			{
				match: (h) => h.includes('בידוד') && h.includes('הזנה') && h.includes('+'),
				field: 'feedRisoPositive'
			},
			{ match: (h) => h.includes('בידוד') && !h.includes('הזנה'), field: 'stringRiso' }
		],
		styleSourceRow: 2,
		minRows: 20
	},
	{
		type: 'codeRow',
		name: 'ac',
		variants: ['ערכי AC'],
		expectedHeaders: ['סעיף', 'תיאור', 'תוצאה', 'הערות'],
		codeCol: 1,
		valueCol: 3,
		notesCol: 4,
		getData: (ins) => {
			const m = new Map<string, { value?: string | number; notes?: string }>();
			for (const item of ins.acMeasurements) {
				m.set(item.itemCode, { value: item.result, notes: item.notes });
			}
			return m;
		},
		dynamicSections: [
			{
				codePrefix: '6',
				descriptionCol: 2,
				valueCol: 3,
				getItems: (ins) =>
					ins.inverterSerials.map((s) => ({
						code: `6.${s.inverterIndex}`,
						description: `מהפך ${s.inverterIndex}`,
						value: s.serialNumber || undefined
					}))
			}
		]
	},
	{
		type: 'append',
		name: 'defects',
		variants: ['ריכוז ליקויים'],
		expectedHeaders: ['רכיב', 'תקלה', 'מיקום', 'סטטוס'],
		columns: [
			{ match: 'רכיב', field: 'component' },
			{ match: 'תקלה', field: 'fault' },
			{ match: 'מיקום', field: 'location' },
			{ match: (h) => h.includes('סטטוס') || h.includes('סטאטוס'), field: 'status' }
		],
		styleSourceRow: 2,
		minRows: 10
	}
];

// ── Low-level utilities ──────────────────────────────────────────

/** Set cell value, preserving the existing style. Skips only undefined. */
function setCell(
	ws: ExcelJS.Worksheet,
	row: number,
	col: number,
	value: string | number | undefined
) {
	if (value === undefined) return;
	ws.getCell(row, col).value = value === '' ? null : value;
}

/** Clear a cell's value while preserving its style */
function clearCell(ws: ExcelJS.Worksheet, row: number, col: number) {
	ws.getCell(row, col).value = null;
}

/** Deep-clone a cell's full style object */
function cloneCellStyle(cell: ExcelJS.Cell): Partial<ExcelJS.Style> {
	const s: Partial<ExcelJS.Style> = {};
	if (cell.font && Object.keys(cell.font).length > 0) s.font = { ...cell.font };
	if (cell.alignment && Object.keys(cell.alignment).length > 0)
		s.alignment = { ...cell.alignment };
	if (cell.border && Object.keys(cell.border).length > 0) {
		s.border = {
			...(cell.border.top ? { top: { ...cell.border.top } } : {}),
			...(cell.border.bottom ? { bottom: { ...cell.border.bottom } } : {}),
			...(cell.border.left ? { left: { ...cell.border.left } } : {}),
			...(cell.border.right ? { right: { ...cell.border.right } } : {})
		};
	}
	if (cell.fill && Object.keys(cell.fill).length > 0) s.fill = { ...cell.fill } as ExcelJS.Fill;
	if (cell.numFmt) s.numFmt = cell.numFmt;
	if (cell.protection && Object.keys(cell.protection).length > 0)
		s.protection = { ...cell.protection };
	return s;
}

/** Copy full cell styles from one row to another (no-op when src === dest) */
function cloneRowStyle(
	ws: ExcelJS.Worksheet,
	srcRow: number,
	destRow: number,
	colCount: number
) {
	if (srcRow === destRow) return;
	const dest = ws.getRow(destRow);
	const src = ws.getRow(srcRow);
	dest.height = src.height;
	for (let c = 1; c <= colCount; c++) {
		ws.getCell(destRow, c).style = cloneCellStyle(ws.getCell(srcRow, c)) as ExcelJS.Style;
	}
}

/** Auto-fit row height based on cell content. Only grows, never shrinks. */
function autoFitRowHeight(
	ws: ExcelJS.Worksheet,
	row: number,
	colCount: number,
	minHeight: number
) {
	const LINE_HEIGHT = 15;
	const CHARS_PER_WIDTH_UNIT = 1.2;
	let maxLines = 1;

	for (let c = 1; c <= colCount; c++) {
		const text = String(ws.getCell(row, c).value ?? '');
		if (!text) continue;
		const colWidth = ws.getColumn(c).width ?? 10;
		const charsPerLine = Math.max(1, Math.floor(colWidth * CHARS_PER_WIDTH_UNIT));
		const lines = Math.ceil(text.length / charsPerLine);
		if (lines > maxLines) maxLines = lines;
	}

	ws.getRow(row).height = Math.max(minHeight, maxLines * LINE_HEIGHT);
}

/** Count data columns by finding the last non-empty header cell in row 1 */
function getDataColumnCount(ws: ExcelJS.Worksheet): number {
	let lastCol = 0;
	for (let c = 1; c <= 100; c++) {
		if (String(ws.getRow(1).getCell(c).value ?? '').trim()) lastCol = c;
	}
	return lastCol || 4;
}

/** Count actual data rows (last row with any content) */
function getDataRowCount(ws: ExcelJS.Worksheet): number {
	let lastRow = 1;
	ws.eachRow((_row, rowNumber) => {
		if (rowNumber > lastRow) lastRow = rowNumber;
	});
	return lastRow;
}

/** Derive stripe fill color from header row's theme fill */
function deriveStripeFill(ws: ExcelJS.Worksheet): ExcelJS.Fill {
	const headerFill = ws.getCell(1, 1).fill;
	if (
		headerFill &&
		headerFill.type === 'pattern' &&
		'fgColor' in headerFill &&
		headerFill.fgColor?.theme !== undefined
	) {
		return {
			type: 'pattern',
			pattern: 'solid',
			fgColor: {
				theme: headerFill.fgColor.theme,
				tint: 0.7999816888943144
			} as Partial<ExcelJS.Color>,
			bgColor: { indexed: 64 } as Partial<ExcelJS.Color>
		} as ExcelJS.Fill;
	}
	return {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'FFD9E2F3' },
		bgColor: { indexed: 64 } as Partial<ExcelJS.Color>
	} as ExcelJS.Fill;
}

/**
 * Apply alternating row fills.
 * When detectSectionHeaders is true (codeRow sheets), rows with existing fills
 * are treated as section headers — skipped and reset the stripe counter.
 * When false (append sheets), stripes are applied unconditionally to all rows.
 */
function applyStripes(
	ws: ExcelJS.Worksheet,
	startRow: number,
	endRow: number,
	colCount: number,
	detectSectionHeaders: boolean = true
) {
	const stripeFill = deriveStripeFill(ws);

	// Identify section header rows (only for codeRow sheets)
	const sectionHeaderRows = new Set<number>();
	if (detectSectionHeaders) {
		for (let r = startRow; r <= endRow; r++) {
			const fill = ws.getCell(r, 1).fill;
			if (fill && fill.type === 'pattern' && fill.pattern !== 'none') {
				sectionHeaderRows.add(r);
			}
		}
	}

	// Apply alternating fills
	let stripeIndex = 0;
	for (let r = startRow; r <= endRow; r++) {
		if (sectionHeaderRows.has(r)) {
			stripeIndex = 0;
			continue;
		}
		for (let c = 1; c <= colCount; c++) {
			const cell = ws.getCell(r, c);
			const base = cloneCellStyle(cell);
			if (stripeIndex % 2 === 0) {
				base.fill = stripeFill;
			} else {
				delete base.fill;
			}
			cell.style = base as ExcelJS.Style;
		}
		stripeIndex++;
	}
}

// ── Template validation ──────────────────────────────────────────

/** Try name variants to find a worksheet, returning the first match */
function resolveSheet(
	wb: ExcelJS.Workbook,
	config: SheetConfig,
	warnings: ExportWarning[]
): ExcelJS.Worksheet | null {
	for (const name of config.variants) {
		const ws = wb.getWorksheet(name);
		if (ws) return ws;
	}
	warnings.push({
		sheet: config.name,
		message: `Sheet not found. Tried: ${config.variants.map((v) => `"${v}"`).join(', ')}`,
		severity: 'error'
	});
	return null;
}

/** Validate that expected header substrings appear in row 1 */
function validateHeaders(
	ws: ExcelJS.Worksheet,
	config: SheetConfig,
	warnings: ExportWarning[]
): void {
	const headers: string[] = [];
	for (let c = 1; c <= 100; c++) {
		const val = String(ws.getRow(1).getCell(c).value ?? '').trim();
		if (val) headers.push(val);
	}
	const headerText = headers.join(' ');
	for (const expected of config.expectedHeaders) {
		if (!headerText.includes(expected)) {
			warnings.push({
				sheet: config.name,
				message: `Expected header containing "${expected}" not found in row 1`,
				severity: 'warning'
			});
		}
	}
}

/** Build code → row map by scanning a column for #.# patterns */
function buildCodeToRowMap(ws: ExcelJS.Worksheet, codeCol: number): Map<string, number> {
	const map = new Map<string, number>();
	ws.eachRow((row, rowNumber) => {
		const val = String(row.getCell(codeCol).value ?? '').trim();
		if (/^\d+\.\d+$/.test(val)) {
			map.set(val, rowNumber);
		}
	});
	return map;
}

/** Build header → column map for append sheets */
function buildHeaderToColMap(
	ws: ExcelJS.Worksheet,
	columns: ColumnMatcher[],
	sheetName: string,
	warnings: ExportWarning[]
): Map<string, number> {
	const map = new Map<string, number>();

	for (let col = 1; col <= 100; col++) {
		const raw = String(ws.getRow(1).getCell(col).value ?? '').trim();
		if (!raw) continue;

		for (const cm of columns) {
			if (map.has(cm.field)) continue; // already matched
			const matches =
				typeof cm.match === 'string' ? raw.includes(cm.match) : cm.match(raw);
			if (matches) {
				map.set(cm.field, col);
			}
		}
	}

	// Warn about unmatched columns
	for (const cm of columns) {
		if (!map.has(cm.field)) {
			warnings.push({
				sheet: sheetName,
				message: `Column for field "${cm.field}" not found in headers`,
				severity: 'warning'
			});
		}
	}

	return map;
}

/** Find the row containing a label by scanning a column */
function findMetaCellRow(
	ws: ExcelJS.Worksheet,
	label: string,
	scanCol: number,
	maxRow: number = 10
): number | null {
	for (let r = 1; r <= maxRow; r++) {
		const val = String(ws.getCell(r, scanCol).value ?? '').trim();
		if (val.includes(label)) return r;
	}
	return null;
}

/** Validate all sheets and build resolved references */
function validateTemplate(
	wb: ExcelJS.Workbook,
	configs: SheetConfig[]
): { sheets: ValidatedSheet[]; warnings: ExportWarning[] } {
	const warnings: ExportWarning[] = [];
	const sheets: ValidatedSheet[] = [];

	for (const config of configs) {
		const ws = resolveSheet(wb, config, warnings);
		const vs: ValidatedSheet = { config, ws, colCount: 0 };

		if (ws) {
			vs.colCount = getDataColumnCount(ws);
			validateHeaders(ws, config, warnings);

			if (config.type === 'codeRow') {
				vs.codeToRow = buildCodeToRowMap(ws, config.codeCol);
			} else if (config.type === 'append') {
				vs.headerToCol = buildHeaderToColMap(
					ws,
					config.columns,
					config.name,
					warnings
				);
			}
		}

		sheets.push(vs);
	}

	return { sheets, warnings };
}

// ── Fill engines ─────────────────────────────────────────────────

/** Fill a code-row sheet (checklist, AC) */
function fillCodeRowSheet(
	vs: ValidatedSheet,
	inspection: Inspection,
	warnings: ExportWarning[]
): void {
	const { ws, codeToRow, colCount } = vs;
	const config = vs.config as CodeRowSheetConfig;
	if (!ws || !codeToRow) return;

	// Write meta cells by scanning for labels
	if (config.metaCells) {
		for (const mc of config.metaCells) {
			const row = findMetaCellRow(ws, mc.label, mc.scanCol);
			if (row !== null) {
				const value = mc.getValue(inspection.meta);
				if (value !== undefined) {
					setCell(ws, row, mc.valueCol, value);
				}
			} else {
				warnings.push({
					sheet: config.name,
					message: `Meta label "${mc.label}" not found in column ${mc.scanCol}`,
					severity: 'warning'
				});
			}
		}
	}

	// Handle dynamic sections first (may insert rows, shifting codeToRow)
	if (config.dynamicSections) {
		for (const ds of config.dynamicSections) {
			ensureDynamicRows(ws, codeToRow, ds, inspection, config.name, colCount, warnings);
		}
	}

	// Write data from code map
	const data = config.getData(inspection);
	for (const [code, entry] of data.entries()) {
		const row = codeToRow.get(code);
		if (row === undefined) {
			// Only warn for codes that should exist (skip empty data)
			if (entry.value || entry.notes) {
				warnings.push({
					sheet: config.name,
					message: `Code "${code}" not found in template column ${config.codeCol}`,
					severity: 'warning'
				});
			}
			continue;
		}
		setCell(ws, row, config.valueCol, entry.value);
		setCell(ws, row, config.notesCol, entry.notes);
		if (entry.notes) {
			autoFitRowHeight(ws, row, colCount, ws.getRow(row).height ?? 20);
		}
	}
}

/** Ensure enough rows exist for a dynamic section, inserting if needed */
function ensureDynamicRows(
	ws: ExcelJS.Worksheet,
	codeToRow: Map<string, number>,
	section: DynamicSection,
	inspection: Inspection,
	sheetName: string,
	colCount: number,
	warnings: ExportWarning[]
): void {
	const items = section.getItems(inspection);
	if (items.length === 0) return;

	// Find existing rows for this section prefix
	const existing = [...codeToRow.entries()]
		.filter(([code]) => code.startsWith(section.codePrefix + '.'))
		.sort(([, a], [, b]) => a - b);

	const have = existing.length;
	const need = items.length;

	if (need > have && have > 0) {
		// Insert rows after the last existing row in this section
		const lastExistingRow = existing[have - 1][1];
		const styleRow = existing[0][1];
		const insertCount = need - have;

		// spliceRows(startRow, deleteCount, ...newRows)
		// Insert blank rows after the last existing section row
		const insertAt = lastExistingRow + 1;
		ws.spliceRows(insertAt, 0, ...Array(insertCount).fill([]));

		// Update codeToRow for all entries that shifted down
		for (const [code, row] of codeToRow.entries()) {
			if (row >= insertAt && !code.startsWith(section.codePrefix + '.')) {
				codeToRow.set(code, row + insertCount);
			}
		}

		// Set up new rows: clone style, write code + description
		for (let i = 0; i < insertCount; i++) {
			const newRow = insertAt + i;
			const newCode = `${section.codePrefix}.${have + i + 1}`;
			cloneRowStyle(ws, styleRow, newRow, colCount);
			codeToRow.set(newCode, newRow);
		}
	} else if (need > have && have === 0) {
		warnings.push({
			sheet: sheetName,
			message: `No existing rows for section "${section.codePrefix}" to clone style from`,
			severity: 'warning'
		});
		return;
	}

	// Write values for all items
	const filledRows = new Set<number>();
	for (const item of items) {
		const row = codeToRow.get(item.code);
		if (row === undefined) {
			warnings.push({
				sheet: sheetName,
				message: `Could not place dynamic item "${item.code}"`,
				severity: 'warning'
			});
			continue;
		}
		setCell(ws, row, 1, item.code);
		setCell(ws, row, section.descriptionCol, item.description);
		setCell(ws, row, section.valueCol, item.value);
		filledRows.add(row);
	}

	// Clear unused rows in this section
	for (const [code, row] of codeToRow.entries()) {
		if (code.startsWith(section.codePrefix + '.') && !filledRows.has(row)) {
			clearCell(ws, row, section.valueCol);
			clearCell(ws, row, 4);
		}
	}
}

/** Fill an append-rows sheet (DC, defects) */
function fillAppendSheet(
	vs: ValidatedSheet,
	rows: Record<string, string | number | undefined>[],
	warnings: ExportWarning[]
): { lastDataRow: number; lastFormattedRow: number } {
	const { ws, headerToCol, colCount } = vs;
	const config = vs.config as AppendSheetConfig;
	if (!ws || !headerToCol) return { lastDataRow: 1, lastFormattedRow: 1 };

	const minHeight = ws.getRow(config.styleSourceRow).height ?? 24;

	let currentRow = config.styleSourceRow;
	for (const rowData of rows) {
		cloneRowStyle(ws, config.styleSourceRow, currentRow, colCount);
		for (const cm of config.columns) {
			const col = headerToCol.get(cm.field);
			if (col !== undefined) {
				setCell(ws, currentRow, col, rowData[cm.field]);
			}
		}
		autoFitRowHeight(ws, currentRow, colCount, minHeight);
		currentRow++;
	}

	const lastDataRow = Math.max(config.styleSourceRow, currentRow - 1);

	// Ensure minimum row extent from template — clone style to empty rows
	// so they have proper formatting even without data. The template's
	// alternating colors come from Table styles (not cell fills) and are
	// lost when we strip tables, so we must set cell-level styles here.
	const lastFormattedRow = Math.max(lastDataRow, config.minRows);
	for (let r = currentRow; r <= lastFormattedRow; r++) {
		cloneRowStyle(ws, config.styleSourceRow, r, colCount);
		for (let c = 1; c <= colCount; c++) {
			clearCell(ws, r, c);
		}
	}

	return { lastDataRow, lastFormattedRow };
}

// ── Helpers ──────────────────────────────────────────────────────

/** Strip Excel Table objects that ExcelJS can't roundtrip */
function stripTables(wb: ExcelJS.Workbook): void {
	for (const ws of wb.worksheets) {
		const tables = ws.getTables();
		if (Array.isArray(tables)) {
			for (const entry of tables) {
				const table = Array.isArray(entry) ? entry[0] : entry;
				if (table?.name) ws.removeTable(table.name);
			}
		}
	}
}

/** Trigger browser file download */
function triggerDownload(buffer: ExcelJS.Buffer, filename: string): void {
	const blob = new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/** Convert DC measurements to row records for the append engine */
function dcMeasurementsToRows(
	inspection: Inspection
): Record<string, string | number | undefined>[] {
	return inspection.dcMeasurements.map((m) => ({
		inverterIndex: m.inverterIndex,
		stringLabel: m.stringLabel,
		openCircuitVoltage: m.openCircuitVoltage,
		operatingCurrent: m.operatingCurrent,
		stringRiso: m.stringRiso,
		feedRisoNegative: m.feedRisoNegative,
		feedRisoPositive: m.feedRisoPositive
	}));
}

/** Convert defects to row records for the append engine */
function defectsToRows(defects: Defect[]): Record<string, string | number | undefined>[] {
	return defects.map((d) => ({
		component: d.component,
		fault: d.fault,
		location: d.location,
		status: d.status
	}));
}

// ── Public API ───────────────────────────────────────────────────

let cachedTemplateBuffer: ArrayBuffer | null = null;

async function loadTemplate(): Promise<ExcelJS.Workbook> {
	if (!cachedTemplateBuffer) {
		const response = await fetch('/template.xlsx');
		if (!response.ok) {
			throw new Error(`Failed to load template: ${response.status}`);
		}
		cachedTemplateBuffer = await response.arrayBuffer();
	}
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.load(cachedTemplateBuffer);
	return wb;
}

/** Fill a workbook with inspection data (no browser APIs needed). Exported for testing. */
export function fillWorkbook(
	wb: ExcelJS.Workbook,
	inspection: Inspection,
	allDefects?: Defect[]
): ExportResult {
	const { sheets, warnings } = validateTemplate(wb, SHEET_CONFIGS);

	for (const vs of sheets) {
		if (!vs.ws) continue;

		if (vs.config.type === 'codeRow') {
			fillCodeRowSheet(vs, inspection, warnings);
		} else if (vs.config.type === 'append') {
			const rows =
				vs.config.name === 'defects'
					? defectsToRows(allDefects ?? inspection.defects)
					: vs.config.name === 'dc'
						? dcMeasurementsToRows(inspection)
						: [];

			const { lastFormattedRow } = fillAppendSheet(vs, rows, warnings);
			applyStripes(vs.ws, vs.config.styleSourceRow, lastFormattedRow, vs.colCount, false);
			continue; // stripes already applied
		}

		// Apply stripes for codeRow sheets
		applyStripes(vs.ws, 2, getDataRowCount(vs.ws), vs.colCount);
	}

	stripTables(wb);
	return { warnings };
}

/** Collect all photo entries from inspection data */
export function collectPhotoEntries(
	inspection: Inspection,
	allDefects?: Defect[]
): { label: string; description: string; photoId: string; sectionCode?: string }[] {
	const entries: { label: string; description: string; photoId: string; sectionCode?: string }[] = [];

	for (const item of inspection.checklist) {
		if (item.photoIds?.length) {
			for (const photoId of item.photoIds) {
				entries.push({
					label: `סעיף ${item.sectionCode}`,
					description: item.description.slice(0, 80),
					photoId,
					sectionCode: item.sectionCode
				});
			}
		}
	}

	const defects = allDefects ?? inspection.defects;
	for (const defect of defects) {
		if (defect.photoIds?.length) {
			for (const photoId of defect.photoIds) {
				entries.push({
					label: 'ליקוי',
					description: [defect.component, defect.fault].filter(Boolean).join(' - ').slice(0, 80),
					photoId
				});
			}
		}
	}

	return entries;
}

/** Generate the Excel workbook buffer (no download). Exported for use in ZIP export. */
export async function buildWorkbookBuffer(
	inspection: Inspection,
	allDefects?: Defect[]
): Promise<{ buffer: ArrayBuffer; result: ExportResult }> {
	const wb = await loadTemplate();
	const result = fillWorkbook(wb, inspection, allDefects);
	const buffer = await wb.xlsx.writeBuffer();
	return { buffer: buffer as ArrayBuffer, result };
}

export async function downloadWorkbook(
	inspection: Inspection,
	allDefects?: Defect[]
): Promise<ExportResult> {
	const { buffer, result } = await buildWorkbookBuffer(inspection, allDefects);
	triggerDownload(buffer, buildExportFilename(inspection.meta));

	if (result.warnings.length > 0) {
		console.warn('[excel-export] Warnings:', result.warnings);
	}

	return result;
}
