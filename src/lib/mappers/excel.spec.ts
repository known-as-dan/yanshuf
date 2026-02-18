import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import ExcelJS from 'exceljs';
import { fillWorkbook, type ExportResult } from './excel.js';
import { checklistSections } from '../config/checklist.js';
import { acSections } from '../config/ac.js';
import type {
	Inspection,
	Defect,
	DcStringMeasurement,
	AcMeasurement,
	InverterSerial,
	InverterConfig,
	ChecklistItem
} from '../models/inspection.js';

// ── Helpers ──────────────────────────────────────────────────────

async function loadTestTemplate(): Promise<ExcelJS.Workbook> {
	const buf = readFileSync(resolve('static/template.xlsx'));
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
	return wb;
}

function cell(ws: ExcelJS.Worksheet, row: number, col: number): string | number | null {
	const v = ws.getCell(row, col).value;
	if (v === undefined || v === null) return null;
	if (typeof v === 'string' || typeof v === 'number') return v;
	return String(v);
}

function cellHasFill(ws: ExcelJS.Worksheet, row: number, col: number): boolean {
	const fill = ws.getCell(row, col).fill;
	return !!(fill && fill.type === 'pattern' && fill.pattern !== 'none');
}

let uid = 0;
function uuid(): string {
	return `test-${++uid}`;
}

// ── Mock data: large 5-inverter system ───────────────────────────

function createLargeInspection(): { inspection: Inspection; allDefects: Defect[] } {
	// 5 inverters, varying string counts
	const inverterConfigs: InverterConfig[] = [
		{ index: 1, label: 'ממיר 1', stringCount: 4 },
		{ index: 2, label: 'ממיר 2', stringCount: 3 },
		{ index: 3, label: 'ממיר 3', stringCount: 5 },
		{ index: 4, label: 'ממיר 4', stringCount: 2 },
		{ index: 5, label: 'ממיר 5', stringCount: 3 }
	];

	const STRING_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

	// DC measurements: one per string per inverter
	const dcMeasurements: DcStringMeasurement[] = inverterConfigs.flatMap((inv) =>
		Array.from({ length: inv.stringCount }, (_, i) => ({
			id: uuid(),
			parentId: null,
			inverterIndex: inv.index,
			stringLabel: STRING_LABELS[i],
			openCircuitVoltage: 380 + Math.round(Math.random() * 40),
			operatingCurrent: 8 + Math.round(Math.random() * 4 * 100) / 100,
			stringRiso: 200 + Math.round(Math.random() * 800),
			feedRisoNegative: 150 + Math.round(Math.random() * 500),
			feedRisoPositive: 150 + Math.round(Math.random() * 500)
		}))
	);

	// Checklist: fill all items from template config with realistic statuses
	const statuses = ['תקין', 'לא תקין', 'בוצע', undefined];
	const checklist: ChecklistItem[] = checklistSections.flatMap((section) =>
		section.items.map((item, i) => {
			const status = i % 7 === 3 ? 'לא תקין' : i % 5 === 0 ? undefined : 'תקין';
			return {
				sectionCode: item.sectionCode,
				description: item.description,
				status,
				notes: status === 'לא תקין' ? 'דורש טיפול דחוף - נמצא פגום' : ''
			};
		})
	);

	// AC measurements: fill all sections 1-5
	const acMeasurements: AcMeasurement[] = acSections.flatMap((section) =>
		section.items.map((item) => ({
			itemCode: item.itemCode,
			description: item.description,
			result: section.code === '3' || section.code === '4' || section.code === '5'
				? (220 + Math.round(Math.random() * 20)).toString()
				: (16 + Math.round(Math.random() * 10)).toString(),
			notes: item.itemCode === '3.1' ? 'ערך גבולי - לבדוק שוב' : ''
		}))
	);

	// Inverter serials: all 5 inverters
	const inverterSerials: InverterSerial[] = inverterConfigs.map((inv) => ({
		inverterIndex: inv.index,
		serialNumber: `SN-2024-${String(inv.index).padStart(3, '0')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
	}));

	// Manual defects
	const manualDefects: Defect[] = [
		{ component: 'פנלים', fault: 'פנל שבור - סדק באלכסון', location: 'ממיר 2 מחרוזת B', status: 'פתוח' },
		{ component: 'קונקטור', fault: 'קונקטור שרוף MC4', location: 'ממיר 3 מחרוזת C', status: 'טופל' },
		{ component: 'כבל DC', fault: 'בידוד פגום - חשוף לשמש', location: 'תעלה ראשית צפון', status: 'פתוח' },
		{ component: 'מהפך', fault: 'מאוורר תקול - רעש חריג', location: 'ממיר 4', status: 'פתוח' },
		{ component: 'הארקה', fault: 'חיבור קורוזיבי בפה"פ', location: 'קופסת פה"פ ראשית', status: 'טופל' },
		{ component: 'קונסטרוקציה', fault: 'ברגים משוחררים בשורה 3', location: 'מערך דרומי', status: 'טופל' },
		{ component: 'שילוט', fault: 'שלט אזהרה חסר', location: 'כניסה ללוח ראשי', status: 'פתוח' }
	];

	// Auto-defects from failed checklist items
	const autoDefects: Defect[] = checklist
		.filter((c) => c.status === 'לא תקין')
		.map((c) => {
			const parentCode = c.sectionCode.split('.')[0];
			const section = checklistSections.find((s) => s.code === parentCode);
			return {
				component: section?.title ?? '',
				fault: c.description,
				location: `סעיף ${c.sectionCode}`,
				status: c.notes || ''
			};
		});

	const allDefects = [...autoDefects, ...manualDefects];

	const inspection: Inspection = {
		meta: {
			siteGroup: 'אנרגיה ירוקה בע"מ',
			siteName: 'מפעל הדרום - באר שבע',
			inspectionDate: '2026-02-19',
			inspectorName: 'יוסי כהן',
			signatureText: 'יוסי כהן - חשמלאי מוסמך'
		},
		inverterConfigs,
		checklist,
		dcMeasurements,
		acMeasurements,
		inverterSerials,
		defects: manualDefects
	};

	return { inspection, allDefects };
}

// ── Tests ────────────────────────────────────────────────────────

describe('Excel export – large system inspection', () => {
	let wb: ExcelJS.Workbook;
	let result: ExportResult;
	let inspection: Inspection;
	let allDefects: Defect[];

	// Fill workbook once, assert in individual tests
	it('fills workbook without errors', async () => {
		wb = await loadTestTemplate();
		const mock = createLargeInspection();
		inspection = mock.inspection;
		allDefects = mock.allDefects;
		result = fillWorkbook(wb, inspection, allDefects);

		// Should have no error-severity warnings
		const errors = result.warnings.filter((w) => w.severity === 'error');
		expect(errors).toEqual([]);
	});

	// ── Checklist sheet ──────────────────────────────────────────

	describe('checklist sheet', () => {
		it('writes meta cells with siteGroup + siteName combined', () => {
			const ws = wb.getWorksheet('פרוטוקול בדיקה תקופתית')!;
			expect(ws).toBeDefined();

			// Site name cell should contain both siteGroup and siteName
			const siteValue = cell(ws, 2, 2);
			expect(siteValue).toContain('אנרגיה ירוקה');
			expect(siteValue).toContain('מפעל הדרום');
		});

		it('writes inspection date', () => {
			const ws = wb.getWorksheet('פרוטוקול בדיקה תקופתית')!;
			expect(cell(ws, 2, 4)).toBe('2026-02-19');
		});

		it('writes inspector name', () => {
			const ws = wb.getWorksheet('פרוטוקול בדיקה תקופתית')!;
			expect(cell(ws, 3, 2)).toBe('יוסי כהן');
		});

		it('writes signature', () => {
			const ws = wb.getWorksheet('פרוטוקול בדיקה תקופתית')!;
			expect(cell(ws, 3, 4)).toContain('יוסי כהן');
		});

		it('fills all checklist items with status', () => {
			const ws = wb.getWorksheet('פרוטוקול בדיקה תקופתית')!;
			const filledItems = inspection.checklist.filter((c) => c.status);
			let found = 0;

			// Scan col A for codes, check col C has values
			ws.eachRow((row, rowNumber) => {
				const code = String(row.getCell(1).value ?? '').trim();
				if (/^\d+\.\d+$/.test(code)) {
					const item = filledItems.find((c) => c.sectionCode === code);
					if (item?.status) {
						expect(cell(ws, rowNumber, 3)).toBe(item.status);
						found++;
					}
				}
			});

			expect(found).toBeGreaterThan(40); // most items should be filled
		});

		it('writes notes for failed items', () => {
			const ws = wb.getWorksheet('פרוטוקול בדיקה תקופתית')!;
			const failedItems = inspection.checklist.filter((c) => c.status === 'לא תקין');
			expect(failedItems.length).toBeGreaterThan(0);

			let foundNotes = 0;
			ws.eachRow((row, rowNumber) => {
				const code = String(row.getCell(1).value ?? '').trim();
				const item = failedItems.find((c) => c.sectionCode === code);
				if (item) {
					const notes = cell(ws, rowNumber, 4);
					if (notes) foundNotes++;
				}
			});
			expect(foundNotes).toBe(failedItems.length);
		});

		it('has alternating row fills (stripes)', () => {
			const ws = wb.getWorksheet('פרוטוקול בדיקה תקופתית')!;
			// Check a sequence of data rows (not section headers)
			// Rows 5-8 should be items 1.1-1.4
			const fills = [5, 6, 7, 8].map((r) => cellHasFill(ws, r, 1));
			// Should alternate: fill, no-fill, fill, no-fill
			expect(fills[0]).toBe(true);
			expect(fills[1]).toBe(false);
			expect(fills[2]).toBe(true);
			expect(fills[3]).toBe(false);
		});
	});

	// ── DC sheet ─────────────────────────────────────────────────

	describe('DC sheet', () => {
		it('writes all DC measurements', () => {
			const ws = wb.getWorksheet(' ערכי DC') ?? wb.getWorksheet('ערכי DC');
			expect(ws).toBeDefined();

			// Total strings: 4+3+5+2+3 = 17
			expect(inspection.dcMeasurements.length).toBe(17);

			// Check that row 2 has the first measurement's inverter index
			const firstMeasurement = inspection.dcMeasurements[0];
			expect(cell(ws!, 2, 1)).toBe(firstMeasurement.inverterIndex);
		});

		it('maps columns correctly by header keywords', () => {
			const ws = (wb.getWorksheet(' ערכי DC') ?? wb.getWorksheet('ערכי DC'))!;

			// Find which column has 'מתח' header
			let voltageCol = -1;
			for (let c = 1; c <= 10; c++) {
				const h = String(ws.getRow(1).getCell(c).value ?? '');
				if (h.includes('מתח')) { voltageCol = c; break; }
			}
			expect(voltageCol).toBeGreaterThan(0);

			// Row 2 voltage should match first measurement
			const val = cell(ws, 2, voltageCol);
			expect(val).toBe(inspection.dcMeasurements[0].openCircuitVoltage);
		});

		it('preserves formatting through row 20 minimum', () => {
			const ws = (wb.getWorksheet(' ערכי DC') ?? wb.getWorksheet('ערכי DC'))!;

			// Row 20 should have a fill (from stripes) even though we have 17 data rows
			expect(cellHasFill(ws, 20, 1)).toBe(true);
		});

		it('has alternating row fills', () => {
			const ws = (wb.getWorksheet(' ערכי DC') ?? wb.getWorksheet('ערכי DC'))!;

			// Rows 2-5 should alternate
			const fills = [2, 3, 4, 5].map((r) => cellHasFill(ws, r, 1));
			expect(fills[0]).toBe(true);
			expect(fills[1]).toBe(false);
			expect(fills[2]).toBe(true);
			expect(fills[3]).toBe(false);
		});

		it('empty rows below data still have stripes', () => {
			const ws = (wb.getWorksheet(' ערכי DC') ?? wb.getWorksheet('ערכי DC'))!;

			// We have 17 data rows (rows 2-18). Row 19 and 20 should be empty but striped.
			expect(cell(ws, 19, 1)).toBeNull();
			expect(cell(ws, 20, 1)).toBeNull();
			// Row 19 = stripeIndex 17 (odd → no fill), row 20 = stripeIndex 18 (even → fill)
			// or vice versa depending on count — just check they have some pattern
			const fill19 = cellHasFill(ws, 19, 1);
			const fill20 = cellHasFill(ws, 20, 1);
			expect(fill19 !== fill20).toBe(true); // they should alternate
		});
	});

	// ── AC sheet ─────────────────────────────────────────────────

	describe('AC sheet', () => {
		it('writes all AC measurements', () => {
			const ws = wb.getWorksheet('ערכי AC')!;
			expect(ws).toBeDefined();

			// Check item 1.1 result is written
			const item11 = inspection.acMeasurements.find((m) => m.itemCode === '1.1')!;
			// Find row for code 1.1
			let row11 = -1;
			ws.eachRow((row, rowNumber) => {
				if (String(row.getCell(1).value ?? '').trim() === '1.1') row11 = rowNumber;
			});
			expect(row11).toBeGreaterThan(0);
			expect(cell(ws, row11, 3)).toBe(item11.result);
		});

		it('writes notes for items with notes', () => {
			const ws = wb.getWorksheet('ערכי AC')!;

			// Item 3.1 should have notes
			let row31 = -1;
			ws.eachRow((row, rowNumber) => {
				if (String(row.getCell(1).value ?? '').trim() === '3.1') row31 = rowNumber;
			});
			expect(row31).toBeGreaterThan(0);
			expect(cell(ws, row31, 4)).toContain('ערך גבולי');
		});

		it('inserts rows for all 5 inverter serial numbers', () => {
			const ws = wb.getWorksheet('ערכי AC')!;

			// Template only has 6.1. We need 6.1 through 6.5.
			const serialCodes = new Map<string, number>();
			ws.eachRow((row, rowNumber) => {
				const code = String(row.getCell(1).value ?? '').trim();
				if (/^6\.\d+$/.test(code)) serialCodes.set(code, rowNumber);
			});

			expect(serialCodes.has('6.1')).toBe(true);
			expect(serialCodes.has('6.2')).toBe(true);
			expect(serialCodes.has('6.3')).toBe(true);
			expect(serialCodes.has('6.4')).toBe(true);
			expect(serialCodes.has('6.5')).toBe(true);
		});

		it('writes correct serial numbers to section 6', () => {
			const ws = wb.getWorksheet('ערכי AC')!;

			for (const serial of inspection.inverterSerials) {
				let serialRow = -1;
				ws.eachRow((row, rowNumber) => {
					if (String(row.getCell(1).value ?? '').trim() === `6.${serial.inverterIndex}`) {
						serialRow = rowNumber;
					}
				});
				expect(serialRow).toBeGreaterThan(0);
				expect(cell(ws, serialRow, 3)).toBe(serial.serialNumber);
			}
		});

		it('writes description labels for inserted serial rows', () => {
			const ws = wb.getWorksheet('ערכי AC')!;

			// 6.3 was inserted — should have "מהפך 3" in col 2
			let row63 = -1;
			ws.eachRow((row, rowNumber) => {
				if (String(row.getCell(1).value ?? '').trim() === '6.3') row63 = rowNumber;
			});
			expect(row63).toBeGreaterThan(0);
			expect(cell(ws, row63, 2)).toBe('מהפך 3');
		});
	});

	// ── Defects sheet ────────────────────────────────────────────

	describe('defects sheet', () => {
		it('writes all defects (auto + manual)', () => {
			const ws = wb.getWorksheet('ריכוז ליקויים')!;
			expect(ws).toBeDefined();

			// Count non-empty rows after header
			let filledRows = 0;
			for (let r = 2; r <= 50; r++) {
				if (cell(ws, r, 1)) filledRows++;
			}
			expect(filledRows).toBe(allDefects.length);
		});

		it('maps defect columns correctly', () => {
			const ws = wb.getWorksheet('ריכוז ליקויים')!;

			// Find the column for each field by header
			const headers: Record<string, number> = {};
			for (let c = 1; c <= 10; c++) {
				const h = String(ws.getRow(1).getCell(c).value ?? '').trim();
				if (h.includes('רכיב')) headers['component'] = c;
				if (h.includes('תקלה')) headers['fault'] = c;
				if (h.includes('מיקום')) headers['location'] = c;
				if (h.includes('סטטוס') || h.includes('סטאטוס')) headers['status'] = c;
			}

			// Check last manual defect is in the right row
			const lastDefect = allDefects[allDefects.length - 1];
			const lastRow = allDefects.length + 1; // header is row 1
			expect(cell(ws, lastRow, headers['component'])).toBe(lastDefect.component);
			expect(cell(ws, lastRow, headers['fault'])).toBe(lastDefect.fault);
			expect(cell(ws, lastRow, headers['location'])).toBe(lastDefect.location);
			expect(cell(ws, lastRow, headers['status'])).toBe(lastDefect.status);
		});

		it('preserves formatting through row 10 minimum', () => {
			const ws = wb.getWorksheet('ריכוז ליקויים')!;

			// Row 10 should have a fill even if there are fewer defects
			// (but with our mock we likely have more than 10 defects)
			expect(cellHasFill(ws, 10, 1)).toBe(true);
		});

		it('has alternating row fills', () => {
			const ws = wb.getWorksheet('ריכוז ליקויים')!;

			const fills = [2, 3, 4, 5].map((r) => cellHasFill(ws, r, 1));
			expect(fills[0]).toBe(true);
			expect(fills[1]).toBe(false);
			expect(fills[2]).toBe(true);
			expect(fills[3]).toBe(false);
		});
	});

	// ── Validation ───────────────────────────────────────────────

	describe('validation', () => {
		it('reports no error-level warnings for stock template', () => {
			const errors = result.warnings.filter((w) => w.severity === 'error');
			expect(errors).toEqual([]);
		});

		it('finds all 4 sheets', () => {
			// No "Sheet not found" warnings
			const sheetErrors = result.warnings.filter((w) => w.message.includes('Sheet not found'));
			expect(sheetErrors).toEqual([]);
		});
	});

	// ── Edge case: write output file for manual inspection ───────

	it('can serialize to buffer without errors', async () => {
		const buffer = await wb.xlsx.writeBuffer();
		expect(buffer.byteLength).toBeGreaterThan(10000);

		// Optionally write to disk for manual inspection:
		// const { writeFileSync } = await import('fs');
		// writeFileSync('test-export-output.xlsx', Buffer.from(buffer));
	});
});
