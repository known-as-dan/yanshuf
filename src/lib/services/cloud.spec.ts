import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createCloudSync, type CloudReport } from './cloud.js';
import {
	setReportAccount,
	listReports,
	createNewReport,
	loadReport,
	saveReport,
	deleteReport,
	type SavedReport
} from '../stores/reports.js';

vi.mock('../stores/photos.js', () => ({
	loadPhoto: vi.fn(async () => null),
	setRemotePhotoLoader: vi.fn(),
	copyGuestPhotos: vi.fn()
}));

let remote: Map<string, CloudReport>;
let sync: ReturnType<typeof createCloudSync>;
let status: string;
let network: { onLine: boolean };
let beforePut: ((report: SavedReport) => Promise<void>) | undefined;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.useFakeTimers();
	const values = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key)
	});
	vi.stubGlobal('window', new EventTarget());
	network = { onLine: true };
	vi.stubGlobal('navigator', network);
	remote = new Map();
	status = '';
	beforePut = undefined;
	setReportAccount('alice');
	fetchMock = vi.fn(async (path: string, init: RequestInit = {}) => {
		if (path === '/api/yanshuf/reports')
			return Response.json({ items: [...remote.values()], next: null });
		const id = path.split('/').at(-1)!;
		const body = JSON.parse(init.body as string);
		await beforePut?.(body.report);
		const old = remote.get(id);
		if (body.revision !== (old?.revision ?? 0))
			return Response.json({ conflict: old }, { status: 409 });
		const result: CloudReport = {
			id,
			report: body.report ?? old!.report,
			revision: body.revision + 1,
			deleted: init.method === 'DELETE'
		};
		remote.set(id, result);
		return Response.json(result);
	});
	vi.stubGlobal('fetch', fetchMock);
	sync = createCloudSync('alice', (value) => (status = value));
});
afterEach(() => {
	sync.stop();
	setReportAccount(null);
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('private durable cloud sync', () => {
	it('copies an unopened legacy guest report with readings intact and cloud-ready IDs', async () => {
		setReportAccount(null);
		const guest = createNewReport();
		guest.inspection.dcMeasurements = [
			{ inverterIndex: 2, stringLabel: 'A', operatingCurrent: 0, openCircuitVoltage: 612 }
		] as SavedReport['inspection']['dcMeasurements'];
		delete (guest.inspection.meta as Partial<typeof guest.inspection.meta>).siteGroup;
		saveReport(guest);
		setReportAccount('alice');
		expect(await sync.importGuestReports()).toBe(1);
		await sync.sync();
		const copy = [...remote.values()][0].report;
		expect(copy.id).not.toBe(guest.id);
		expect(copy.inspection.meta.siteGroup).toBe('');
		expect(copy.inspection.dcMeasurements[0]).toMatchObject({
			id: expect.any(String),
			parentId: null,
			groupId: 'legacy-inverter-2',
			operatingCurrent: 0,
			openCircuitVoltage: 612
		});
		setReportAccount(null);
		expect(loadReport(guest.id)?.inspection.dcMeasurements[0]).not.toHaveProperty('id');
	});
	it('keeps offline edits and uploads them after reconnecting', async () => {
		network.onLine = false;
		const report = createNewReport();
		report.name = 'offline';
		saveReport(report);
		await sync.sync();
		expect(remote.size).toBe(0);
		network.onLine = true;
		await sync.sync();
		expect(remote.get(report.id)?.report.name).toBe('offline');
		expect(status).toBe('כל השינויים סונכרנו');
	});
	it('preserves both versions of concurrent edits', async () => {
		const report = createNewReport();
		saveReport(report);
		await sync.sync();
		const other = structuredClone(remote.get(report.id)!);
		other.report.name = 'other device';
		other.revision++;
		remote.set(report.id, other);
		report.name = 'local change';
		saveReport(report);
		await sync.sync();
		expect(loadReport(report.id)?.name).toBe('other device');
		expect(listReports().map((item) => item.name)).toContain('local change (עותק מקומי)');
		expect(remote.size).toBe(2);
	});
	it('does not replace an active editor on an unchanged poll', async () => {
		const report = createNewReport();
		saveReport(report);
		await sync.sync();
		const changed = vi.fn();
		window.addEventListener('yanshuf-cloud-change', changed);
		await sync.sync();
		expect(changed).not.toHaveBeenCalled();
	});
	it('keeps a deletion that happens during the first upload', async () => {
		const report = createNewReport();
		saveReport(report);
		let resolve!: () => void;
		beforePut = () =>
			new Promise<void>((done) => {
				resolve = done;
			});
		const uploading = sync.sync();
		await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
		await deleteReport(report.id);
		resolve();
		await uploading;
		beforePut = undefined;
		await sync.sync();
		expect(remote.get(report.id)?.deleted).toBe(true);
		expect(loadReport(report.id)).toBeNull();
	});
	it('ignores late responses after switching accounts', async () => {
		const report = createNewReport();
		saveReport(report);
		let resolve!: () => void;
		beforePut = () =>
			new Promise<void>((done) => {
				resolve = done;
			});
		const uploading = sync.sync();
		await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
		sync.stop();
		setReportAccount('bob');
		resolve();
		await uploading;
		expect(listReports()).toEqual([]);
		expect(loadReport(report.id)).toBeNull();
	});
	it('retains guest originals when copying reports into an account', async () => {
		setReportAccount(null);
		const guest = createNewReport();
		guest.name = 'guest';
		saveReport(guest);
		setReportAccount('alice');
		expect(await sync.importGuestReports()).toBe(1);
		expect(listReports()[0].id).not.toBe(guest.id);
		setReportAccount(null);
		expect(loadReport(guest.id)?.name).toBe('guest');
	});
});
