import JSZip from 'jszip';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { buildBackup, importBackup } from './backup.js';
import {
	createNewReport,
	saveReport,
	loadReport,
	listReports,
	setReportAccount
} from '../stores/reports.js';
import { savePhoto, loadPhoto, setPhotoAccount } from '../stores/photos.js';

beforeEach(() => {
	localStorage.clear();
	setReportAccount(null);
	setPhotoAccount(null);
});
afterEach(() => {
	setReportAccount(null);
	setPhotoAccount(null);
});

describe('portable report backups', () => {
	it('imports a guest ZIP into another workspace with photos, readings and originals preserved', async () => {
		const report = createNewReport();
		const photoId = crypto.randomUUID();
		const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
		report.inspection.defects = [
			{ component: '', fault: 'trace line', location: 'box', status: '', photoIds: [photoId] }
		];
		report.inspection.dcMeasurements = [
			{
				id: 'point-1',
				parentId: null,
				inverterIndex: 0,
				stringLabel: 'unmarked',
				operatingCurrent: 0
			}
		];
		saveReport(report);
		await savePhoto(photoId, new Blob([bytes], { type: 'image/png' }));
		const { buffer, missing } = await buildBackup();
		expect(missing).toBe(0);
		const zip = await JSZip.loadAsync(buffer);
		const manifest = JSON.parse(await zip.file('backup.json')!.async('string'));
		expect(Object.keys(manifest).sort()).toEqual(['folders', 'photos', 'reports', 'version']);
		setReportAccount('backup-target');
		setPhotoAccount('backup-target');
		expect(await importBackup(new File([buffer], 'backup.zip'))).toEqual({ count: 1, missing: 0 });
		const copy = loadReport(listReports()[0].id)!;
		expect(copy.id).not.toBe(report.id);
		expect(copy.inspection.dcMeasurements[0].operatingCurrent).toBe(0);
		expect(copy.inspection.dcMeasurements[0].openCircuitVoltage).toBeUndefined();
		const copiedPhoto = copy.inspection.defects[0].photoIds![0];
		expect(copiedPhoto).not.toBe(photoId);
		expect(new Uint8Array(await (await loadPhoto(copiedPhoto))!.arrayBuffer())).toEqual(bytes);
		setReportAccount(null);
		setPhotoAccount(null);
		expect(loadReport(report.id)?.id).toBe(report.id);
		expect(await loadPhoto(photoId)).not.toBeNull();
	});
	it('imports old JSON backups and reports missing images without inventing measurements', async () => {
		const report = createNewReport();
		report.inspection.defects = [
			{ component: '', fault: 'review', location: '', status: '', photoIds: ['missing-photo'] }
		];
		report.inspection.dcMeasurements = [
			{ inverterIndex: 1, stringLabel: 'A', operatingCurrent: 0 }
		] as typeof report.inspection.dcMeasurements;
		const old = new File(
			[JSON.stringify({ [`yanshuf_report_${report.id}`]: report })],
			'legacy.json'
		);
		expect(await importBackup(old)).toEqual({ count: 1, missing: 1 });
		const copy = loadReport(listReports()[0].id)!;
		expect(copy.inspection.dcMeasurements[0]).toMatchObject({
			id: expect.any(String),
			parentId: null,
			operatingCurrent: 0
		});
		expect(copy.inspection.dcMeasurements[0].openCircuitVoltage).toBeUndefined();
		expect(copy.inspection.defects[0].photoIds).toEqual([]);
	});
});
