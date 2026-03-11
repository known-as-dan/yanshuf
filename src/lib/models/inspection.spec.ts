import { describe, it, expect } from 'vitest';
import { buildReportName, buildExportFilename } from './inspection.js';

describe('buildReportName', () => {
	it('joins siteGroup and siteName', () => {
		expect.assertions(1);
		const name = buildReportName({
			siteGroup: 'לקוח א',
			siteName: 'אתר 1',
			inspectionDate: '',
			inspectorName: '',
			signatureText: ''
		});
		expect(name).toBe('לקוח א - אתר 1');
	});

	it('returns siteName only when siteGroup is empty', () => {
		expect.assertions(1);
		const name = buildReportName({
			siteGroup: '',
			siteName: 'אתר 1',
			inspectionDate: '',
			inspectorName: '',
			signatureText: ''
		});
		expect(name).toBe('אתר 1');
	});

	it('returns default when both are empty', () => {
		expect.assertions(1);
		const name = buildReportName({
			siteGroup: '',
			siteName: '',
			inspectionDate: '',
			inspectorName: '',
			signatureText: ''
		});
		expect(name).toBe('בדיקה חדשה');
	});
});

describe('buildExportFilename', () => {
	it('builds full filename with all parts', () => {
		expect.assertions(1);
		const filename = buildExportFilename({
			siteGroup: 'לקוח',
			siteName: 'אתר',
			inspectionDate: '2026-01-15',
			inspectorName: '',
			signatureText: ''
		});
		expect(filename).toBe('פרוטוקול בדיקה תקופתית - לקוח - אתר - 2026-01-15.xlsx');
	});

	it('omits empty parts', () => {
		expect.assertions(1);
		const filename = buildExportFilename({
			siteGroup: '',
			siteName: 'אתר',
			inspectionDate: '',
			inspectorName: '',
			signatureText: ''
		});
		expect(filename).toBe('פרוטוקול בדיקה תקופתית - אתר.xlsx');
	});
});
