import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { fillWorkbook } from './excel.js';
import { preserveNativeParts } from './native-parts.js';
import { createDefaultInspection } from '../models/inspection.js';

const asBuffer = (bytes: Uint8Array | ArrayBuffer): ArrayBuffer =>
	bytes instanceof Uint8Array ? Uint8Array.from(bytes).buffer : new Uint8Array(bytes).buffer;

describe('Ormash native workbook preservation', () => {
	it('uses the exact current Thermalite maintenance reference', () => {
		expect(createHash('sha256').update(readFileSync('static/template.xlsx')).digest('hex')).toBe(
			'239b41b342f1c1f363000c6c3d06886f647c2805c2acf1afbbbc997fb6bacf1d'
		);
	});
	it('keeps logos, VML, relationships, settings and print metadata while extending data', async () => {
		const template = asBuffer(readFileSync('static/template.xlsx'));
		const original = await JSZip.loadAsync(template);
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(template);
		const inspection = createDefaultInspection();
		inspection.dcGroups = [{ id: 'north', label: 'ארון צפוני' }];
		inspection.dcMeasurements = Array.from({ length: 25 }, (_, index) => ({
			id: `point-${index}`,
			parentId: null,
			inverterIndex: 0,
			groupId: 'north',
			stringLabel: String(index + 1),
			panelCount: 18,
			operatingCurrent: 0
		}));
		inspection.inverterSerials = Array.from({ length: 12 }, (_, index) => ({
			inverterIndex: index + 1,
			serialNumber: `DEMO-${index + 1}`
		}));
		expect(fillWorkbook(wb, inspection).warnings).toEqual([]);
		const output = await preserveNativeParts(template, asBuffer(await wb.xlsx.writeBuffer()));
		const edited = await JSZip.loadAsync(output);
		for (const path of Object.keys(original.files)) {
			if (original.files[path].dir) continue;
			if (
				/^xl\/(worksheets\/sheet\d+\.xml|tables\/table\d+\.xml|workbook\.xml|styles\.xml|sharedStrings\.xml)$/.test(
					path
				)
			)
				continue;
			expect(await edited.file(path)!.async('uint8array'), path).toEqual(
				await original.file(path)!.async('uint8array')
			);
		}
		for (const path of [
			'xl/worksheets/sheet1.xml',
			'xl/worksheets/sheet2.xml',
			'xl/worksheets/sheet4.xml',
			'xl/worksheets/sheet5.xml'
		]) {
			const native = await original.file(path)!.async('string');
			const updated = await edited.file(path)!.async('string');
			for (const tag of [
				'headerFooter',
				'pageSetup',
				'pageMargins',
				'sheetViews',
				'legacyDrawingHF',
				'tableParts'
			]) {
				const pattern = new RegExp(`<${tag}\\b[^>]*(?:/>|>[\\s\\S]*?</${tag}>)`);
				expect(updated.match(pattern)?.[0], `${path}:${tag}`).toEqual(native.match(pattern)?.[0]);
			}
		}
		const dcTable = await edited.file('xl/tables/table2.xml')!.async('string');
		expect(dcTable).toContain('A1:H26');
		const nativeDc = await original.file('xl/tables/table2.xml')!.async('string');
		expect(dcTable.match(/<tableStyleInfo[^>]*\/>/)?.[0]).toBe(
			nativeDc.match(/<tableStyleInfo[^>]*\/>/)?.[0]
		);
		const restored = new ExcelJS.Workbook();
		await restored.xlsx.load(output);
		const dc = restored.getWorksheet(' ערכי DC')!;
		expect(dc.getCell('A2').value).toBe('ארון צפוני');
		expect(dc.getCell('C2').value).toBe(18);
		expect(dc.getCell('D2').value).toBeNull();
		expect(dc.getCell('E2').value).toBe(0);
		expect(restored.worksheets.map((sheet) => sheet.name)).toEqual(
			wb.worksheets.map((sheet) => sheet.name)
		);
	});
});
