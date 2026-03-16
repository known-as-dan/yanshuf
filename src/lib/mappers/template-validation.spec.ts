import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import ExcelJS from 'exceljs';
import { SHEET_CONFIGS } from './excel.js';
import { checklistSections } from '../config/checklist.js';
import { acSections } from '../config/ac.js';

// ── Helpers ──────────────────────────────────────────────────────

async function loadTemplate(): Promise<ExcelJS.Workbook> {
	const buf = readFileSync(resolve('static/template.xlsx'));
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
	return wb;
}

function resolveSheet(wb: ExcelJS.Workbook, variants: string[]): ExcelJS.Worksheet | null {
	for (const name of variants) {
		const ws = wb.getWorksheet(name);
		if (ws) return ws;
	}
	return null;
}

function scanCodes(ws: ExcelJS.Worksheet, col: number): Set<string> {
	const codes = new Set<string>();
	ws.eachRow((row) => {
		const val = String(row.getCell(col).value ?? '').trim();
		if (/^\d+\.\d+$/.test(val)) {
			codes.add(val);
		}
	});
	return codes;
}

function getRowHeaders(ws: ExcelJS.Worksheet): string[] {
	const headers: string[] = [];
	for (let c = 1; c <= 100; c++) {
		const val = String(ws.getRow(1).getCell(c).value ?? '').trim();
		if (val) headers.push(val);
	}
	return headers;
}

// ── Tests ────────────────────────────────────────────────────────

describe('Template validation', () => {
	let wb: ExcelJS.Workbook;

	it('template file exists and loads', async () => {
		expect.assertions(1);
		wb = await loadTemplate();
		expect(wb.worksheets.length).toBeGreaterThan(0);
	});

	describe('all sheet configs resolve', () => {
		it('every SHEET_CONFIGS entry has a matching worksheet', async () => {
			if (!wb) wb = await loadTemplate();
			expect.assertions(SHEET_CONFIGS.length);
			for (const config of SHEET_CONFIGS) {
				const ws = resolveSheet(wb, config.variants);
				expect(
					ws,
					`Sheet "${config.name}" (variants: ${config.variants.join(', ')})`
				).not.toBeNull();
			}
		});

		it('every sheet has expected header substrings in row 1', async () => {
			if (!wb) wb = await loadTemplate();
			const checks: [string, string][] = [];
			for (const config of SHEET_CONFIGS) {
				const ws = resolveSheet(wb, config.variants);
				if (!ws) continue;
				for (const expected of config.expectedHeaders) {
					checks.push([config.name, expected]);
				}
			}
			expect.assertions(checks.length);
			for (const config of SHEET_CONFIGS) {
				const ws = resolveSheet(wb, config.variants);
				if (!ws) continue;
				const headerText = getRowHeaders(ws).join(' ');
				for (const expected of config.expectedHeaders) {
					expect(
						headerText.includes(expected),
						`Sheet "${config.name}" row 1 should contain "${expected}"`
					).toBe(true);
				}
			}
		});
	});

	describe('checklist sheet', () => {
		const allConfigCodes = checklistSections.flatMap((s) => s.items.map((i) => i.sectionCode));
		const checklistConfig = SHEET_CONFIGS.find((c) => c.name === 'checklist')!;

		it('contains all config checklist codes', async () => {
			if (!wb) wb = await loadTemplate();
			const ws = resolveSheet(wb, checklistConfig.variants)!;
			const templateCodes = scanCodes(ws, 1);
			expect.assertions(allConfigCodes.length);
			for (const code of allConfigCodes) {
				expect(templateCodes.has(code), `Checklist code "${code}" missing from template`).toBe(
					true
				);
			}
		});

		it('has no orphan codes missing from config', async () => {
			if (!wb) wb = await loadTemplate();
			const ws = resolveSheet(wb, checklistConfig.variants)!;
			const templateCodes = scanCodes(ws, 1);
			const configCodeSet = new Set(allConfigCodes);
			const orphans = [...templateCodes].filter((c) => !configCodeSet.has(c));
			expect.assertions(1);
			expect(orphans, `Template has codes not in config: ${orphans.join(', ')}`).toEqual([]);
		});

		it('contains expected meta labels', async () => {
			if (!wb) wb = await loadTemplate();
			const ws = resolveSheet(wb, checklistConfig.variants)!;
			const labels = ['שם אתר', 'תאריך', 'שם בודק', 'חתימה'];
			expect.assertions(labels.length);
			for (const label of labels) {
				let found = false;
				for (let r = 1; r <= 10; r++) {
					for (let c = 1; c <= 4; c++) {
						const val = String(ws.getCell(r, c).value ?? '');
						if (val.includes(label)) {
							found = true;
							break;
						}
					}
					if (found) break;
				}
				expect(found, `Meta label "${label}" not found in first 10 rows`).toBe(true);
			}
		});
	});

	describe('AC sheet', () => {
		const allAcCodes = acSections.flatMap((s) => s.items.map((i) => i.itemCode));
		const acConfig = SHEET_CONFIGS.find((c) => c.name === 'ac')!;

		it('contains all AC measurement codes', async () => {
			if (!wb) wb = await loadTemplate();
			const ws = resolveSheet(wb, acConfig.variants)!;
			const templateCodes = scanCodes(ws, 1);
			expect.assertions(allAcCodes.length);
			for (const code of allAcCodes) {
				expect(templateCodes.has(code), `AC code "${code}" missing from template`).toBe(true);
			}
		});

		it('has at least one dynamic serial number row (6.x)', async () => {
			if (!wb) wb = await loadTemplate();
			const ws = resolveSheet(wb, acConfig.variants)!;
			const templateCodes = scanCodes(ws, 1);
			const serialCodes = [...templateCodes].filter((c) => c.startsWith('6.'));
			expect.assertions(1);
			expect(serialCodes.length).toBeGreaterThan(0);
		});
	});

	describe('DC sheet', () => {
		const dcConfig = SHEET_CONFIGS.find((c) => c.name === 'dc')!;

		it('exists and has expected column headers', async () => {
			if (!wb) wb = await loadTemplate();
			const ws = resolveSheet(wb, dcConfig.variants);
			expect.assertions(1 + dcConfig.expectedHeaders.length);
			expect(ws).not.toBeNull();
			const headerText = getRowHeaders(ws!).join(' ');
			for (const expected of dcConfig.expectedHeaders) {
				expect(headerText.includes(expected)).toBe(true);
			}
		});
	});

	describe('defects sheet', () => {
		const defectsConfig = SHEET_CONFIGS.find((c) => c.name === 'defects')!;

		it('exists and has expected column headers', async () => {
			if (!wb) wb = await loadTemplate();
			const ws = resolveSheet(wb, defectsConfig.variants);
			expect.assertions(1 + defectsConfig.expectedHeaders.length);
			expect(ws).not.toBeNull();
			const headerText = getRowHeaders(ws!).join(' ');
			for (const expected of defectsConfig.expectedHeaders) {
				expect(headerText.includes(expected)).toBe(true);
			}
		});
	});
});
