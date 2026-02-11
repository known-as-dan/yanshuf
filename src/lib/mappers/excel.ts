import ExcelJS from 'exceljs';
import type { Defect, Inspection } from '../models/inspection.js';
import { getOrderedDcTree } from '../stores/inspection.svelte.js';

// ── Template-based Excel export ──────────────────────────────────
// Fetches the official template from /template.xlsx, fills in
// inspection data, preserves all original formatting via ExcelJS.

const SHEET_CHECKLIST = 'פרוטוקול בדיקה תקופתית';
const SHEET_DC = ' ערכי DC';
const SHEET_AC = 'ערכי AC';
const SHEET_DEFECTS = 'ריכוז ליקויים';

/** Check whether a cell already has an explicit solid fill */
function hasSolidFill(cell: ExcelJS.Cell): boolean {
	const fill = cell.fill;
	return fill != null && fill.type === 'pattern' && fill.pattern === 'solid';
}

/**
 * Bake table row-stripe fills into actual cells.
 * Excel table styles apply alternating fills at render time,
 * but ExcelJS can't write table definitions, so we pre-apply them.
 *
 * Note: ExcelJS shares style references across cells with the same
 * XF index, so we must scan which rows need fills BEFORE modifying any,
 * and set `cell.style` (not just `cell.fill`) to break the shared ref.
 */
function bakeTableStripes(
	ws: ExcelJS.Worksheet,
	startRow: number,
	endRow: number,
	colCount: number
) {
	// Phase 1: scan which rows already have fills (before any modifications)
	const rowHasFill = new Set<number>();
	for (let r = startRow; r <= endRow; r++) {
		if (hasSolidFill(ws.getCell(r, 1))) {
			rowHasFill.add(r);
		}
	}

	// Phase 2: apply stripes — must set whole `cell.style` to break shared XF refs
	let stripeIndex = 0;
	for (let r = startRow; r <= endRow; r++) {
		if (!rowHasFill.has(r)) {
			const color = stripeIndex % 2 === 0 ? 'FFD9E2F3' : 'FFB4C6E7';
			for (let c = 1; c <= colCount; c++) {
				const cell = ws.getCell(r, c);
				cell.style = {
					font: cell.font ? { ...cell.font } : {},
					alignment: cell.alignment ? { ...cell.alignment } : {},
					border: cell.border ? { ...cell.border } : {},
					fill: {
						type: 'pattern',
						pattern: 'solid',
						fgColor: { argb: color },
						bgColor: { argb: color }
					}
				};
			}
		}
		stripeIndex++;
	}
}

/** Set cell value, preserving the existing style */
function setCell(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number | undefined) {
	if (value === undefined || value === '') return;
	const cell = ws.getCell(row, col);
	cell.value = value;
}

/** Build a map of sectionCode → row number by scanning column A (1-indexed) */
function buildCodeToRowMap(ws: ExcelJS.Worksheet): Map<string, number> {
	const map = new Map<string, number>();
	ws.eachRow((row, rowNumber) => {
		const val = String(row.getCell(1).value ?? '').trim();
		if (/^\d+\.\d+$/.test(val)) {
			map.set(val, rowNumber);
		}
	});
	return map;
}

// ── Fill checklist sheet ─────────────────────────────────────────

function fillChecklistSheet(ws: ExcelJS.Worksheet, inspection: Inspection) {
	// Row 2: B=site name, D=inspection date
	// Row 3: B=inspector name, D=signature
	setCell(ws, 2, 2, inspection.meta.siteName);
	setCell(ws, 2, 4, inspection.meta.inspectionDate);
	setCell(ws, 3, 2, inspection.meta.inspectorName);
	if (inspection.meta.signatureText) {
		setCell(ws, 3, 4, inspection.meta.signatureText);
	}

	const codeToRow = buildCodeToRowMap(ws);

	for (const item of inspection.checklist) {
		const row = codeToRow.get(item.sectionCode);
		if (row !== undefined) {
			if (item.status) setCell(ws, row, 3, item.status);
			if (item.notes) setCell(ws, row, 4, item.notes);
		}
	}
}

// ── Fill DC sheet ────────────────────────────────────────────────

function fillDcSheet(ws: ExcelJS.Worksheet, inspection: Inspection): number {
	// Header row 1 is preserved from template
	// Data starts from row 2
	let currentRow = 2;

	for (const config of inspection.inverterConfigs) {
		// Inverter header row
		setCell(ws, currentRow, 1, config.index);
		currentRow++;

		const tree = getOrderedDcTree(inspection.dcMeasurements, config.index);
		for (const { measurement: m } of tree) {
			setCell(ws, currentRow, 2, m.stringLabel);
			if (m.panelCount !== undefined) setCell(ws, currentRow, 3, m.panelCount);
			if (m.openCircuitVoltage !== undefined) setCell(ws, currentRow, 4, m.openCircuitVoltage);
			if (m.operatingCurrent !== undefined) setCell(ws, currentRow, 5, m.operatingCurrent);
			if (m.stringRiso !== undefined) setCell(ws, currentRow, 6, m.stringRiso);
			if (m.feedRisoNegative !== undefined) setCell(ws, currentRow, 7, m.feedRisoNegative);
			if (m.feedRisoPositive !== undefined) setCell(ws, currentRow, 8, m.feedRisoPositive);
			currentRow++;
		}
	}

	return currentRow - 1;
}

// ── Fill AC sheet ────────────────────────────────────────────────

function fillAcSheet(ws: ExcelJS.Worksheet, inspection: Inspection) {
	const codeToRow = buildCodeToRowMap(ws);

	for (const m of inspection.acMeasurements) {
		const row = codeToRow.get(m.itemCode);
		if (row !== undefined) {
			if (m.result !== undefined && m.result !== '') {
				setCell(ws, row, 3, m.result);
			}
			if (m.notes) setCell(ws, row, 4, m.notes);
		}
	}

	// Inverter serial numbers — scan column B for "מהפך" rows
	const serialRows: number[] = [];
	ws.eachRow((row, rowNumber) => {
		const bVal = String(row.getCell(2).value ?? '');
		if (bVal.startsWith('מהפך')) {
			serialRows.push(rowNumber);
		}
	});

	for (const serial of inspection.inverterSerials) {
		const idx = serial.inverterIndex - 1;
		if (idx >= 0 && idx < serialRows.length && serial.serialNumber) {
			setCell(ws, serialRows[idx], 3, serial.serialNumber);
		}
	}
}

// ── Fill defects sheet ───────────────────────────────────────────

function fillDefectsSheet(ws: ExcelJS.Worksheet, defects: Defect[]) {
	for (let i = 0; i < defects.length; i++) {
		const d = defects[i];
		const row = i + 2; // Row 1 = headers, data from row 2
		setCell(ws, row, 1, d.component);
		setCell(ws, row, 2, d.fault);
		setCell(ws, row, 3, d.location);
		setCell(ws, row, 4, d.status);
	}
}

// ── Public API ───────────────────────────────────────────────────

/** Apply print-ready page setup to a worksheet */
function applyPageSetup(
	ws: ExcelJS.Worksheet,
	opts: {
		orientation?: 'portrait' | 'landscape';
		fitToWidth?: number;
		fitToHeight?: number;
		printArea?: string;
		printTitlesRow?: string;
	} = {}
) {
	ws.pageSetup = {
		...ws.pageSetup,
		paperSize: 9, // A4
		orientation: opts.orientation ?? 'portrait',
		fitToPage: true,
		fitToWidth: opts.fitToWidth ?? 1,
		fitToHeight: opts.fitToHeight ?? 0, // 0 = as many pages as needed
		horizontalCentered: true,
		margins: {
			left: 0.4,
			right: 0.4,
			top: 0.5,
			bottom: 0.5,
			header: 0.3,
			footer: 0.3
		},
		...(opts.printArea ? { printArea: opts.printArea } : {}),
		...(opts.printTitlesRow ? { printTitlesRow: opts.printTitlesRow } : {})
	};

	ws.headerFooter = {
		oddFooter: '&Lינשוף&C&A&Rעמוד &P מתוך &N'
	};
}

async function loadTemplate(): Promise<ExcelJS.Workbook> {
	const response = await fetch('/template.xlsx');
	if (!response.ok) {
		throw new Error(`Failed to load template: ${response.status}`);
	}
	const buffer = await response.arrayBuffer();
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.load(buffer);
	return wb;
}

export async function downloadWorkbook(inspection: Inspection, allDefects?: Defect[]) {
	const wb = await loadTemplate();

	const wsChecklist = wb.getWorksheet(SHEET_CHECKLIST);
	if (wsChecklist) {
		fillChecklistSheet(wsChecklist, inspection);
		bakeTableStripes(wsChecklist, 2, 84, 4);
	}

	const wsDc = wb.getWorksheet(SHEET_DC);
	if (wsDc) {
		const dcLastRow = fillDcSheet(wsDc, inspection);
		bakeTableStripes(wsDc, 2, dcLastRow, 8);
	}

	const wsAc = wb.getWorksheet(SHEET_AC);
	if (wsAc) {
		fillAcSheet(wsAc, inspection);
		bakeTableStripes(wsAc, 2, 42, 4);
	}

	const defects = allDefects ?? inspection.defects;
	const wsDefects = wb.getWorksheet(SHEET_DEFECTS);
	if (wsDefects) {
		fillDefectsSheet(wsDefects, defects);
		bakeTableStripes(wsDefects, 2, Math.max(2, defects.length + 1), 4);
	}

	// ExcelJS can't roundtrip Excel Table/AutoFilter objects — strip them
	// to prevent the "Removed Records: AutoFilter / Table" corruption error.
	for (const ws of wb.worksheets) {
		const tables = ws.getTables();
		if (Array.isArray(tables)) {
			for (const entry of tables) {
				const table = Array.isArray(entry) ? entry[0] : entry;
				if (table?.name) ws.removeTable(table.name);
			}
		}
	}

	const outBuffer = await wb.xlsx.writeBuffer();
	const blob = new Blob([outBuffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `בדיקה_${inspection.meta.siteName || 'ללא_שם'}_${inspection.meta.inspectionDate}.xlsx`;
	a.click();
	URL.revokeObjectURL(url);
}