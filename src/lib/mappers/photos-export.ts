import JSZip from 'jszip';
import { buildExportFilename, type Defect, type Inspection } from '../models/inspection.js';
import { collectPhotoEntries, buildWorkbookBuffer, type ExportResult } from './excel.js';

/** Sanitize a string for use as a filename — replace unsafe chars with underscores */
function sanitizeFilename(s: string): string {
	return s
		.replace(/[/\\:*?"<>|]/g, '_')
		.replace(/\s+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

/** Short names for checklist items, keyed by sectionCode */
const SHORT_NAMES: Record<string, string> = {
	'1.1': 'שלמות_לוח', '1.2': 'אטימות_ארון', '1.3': 'שילוט', '1.4': 'ניקיון',
	'1.5': 'מפסק_חירום', '1.6': 'מפסק_פחת', '1.7': 'חיזוק_ברגים', '1.8': 'תרמי_לוח',
	'1.9': 'חיבור_הארקה', '1.10': 'סוג_ארון', '1.11': 'מדידת_מתחים', '1.12': 'לולאת_תקלה',
	'1.13': 'כיוונון_מפסק', '1.14': 'התאמת_כיוונון',
	'2.1': 'שלמות_לוח', '2.2': 'אטימות_ארון', '2.3': 'סוג_ארון', '2.4': 'שילוט',
	'2.5': 'ניקיון', '2.6': 'מפסק_חירום', '2.7': 'מפסק_פחת', '2.8': 'ממסר_דלף',
	'2.9': 'חיזוק_ברגים', '2.10': 'מדידת_מתחים', '2.11': 'לולאת_תקלה',
	'2.12': 'כיוונון_מפסק', '2.13': 'התאמת_כיוונון', '2.14': 'תרמי_לוח',
	'3.1': 'קופסת_פהפ', '3.2': 'מצב_פהפ', '3.3': 'חיבורי_פהפ', '3.4': 'רציפות_הארקה',
	'4.1': 'שלמות_מהפך', '4.2': 'חוסן_התקנה', '4.3': 'חיזוק_ברגים',
	'4.4': 'מאווררים', '4.5': 'תרמי_מהפך', '4.6': 'סימון_מהפכים', '4.7': 'קופסאות_אופסט',
	'5.1': 'סוג_תקשורת', '5.2': 'שעון_שבת', '5.3': 'ארון_תקשורת',
	'5.4': 'ניטור_אקלים', '5.5': 'חיישן_קרינה', '5.6': 'חיישן_טמפרטורה',
	'6.1': 'שלמות_קופסא', '6.2': 'אטימות_קופסא', '6.3': 'תרמי_DC', '6.4': 'חיזוק_הדקים',
	'6.5': 'מוליכים', '6.6': 'נתיכים', '6.7': 'מדידת_DC', '6.8': 'בדיקת_בידוד',
	'6.9': 'בדיקת_פורטל', '6.10': 'שילוט_DC', '6.11': 'כבילה',
	'6.12': 'חוזק_קולטים', '6.13': 'בדיקה_ויזואלית', '6.14': 'תרמי_קולטים',
	'7.1': 'חוזק_קונסט', '7.2': 'קורוזיה', '7.3': 'יריעות_איטום',
	'7.4': 'עוגנים', '7.5': 'תעלות',
	'8.1': 'קווי_חיים', '8.2': 'סולמות_מעקות', '8.3': 'גילוון', '8.4': 'דלתות_כלובים',
	'9.1': 'הפרשי_מתח', '9.2': 'הבדלי_זרם', '9.3': 'בידוד_כבילה', '9.4': 'בידוד_מחרוזת'
};

/** Build a descriptive filename for a photo entry */
function buildPhotoFilename(
	entry: { label: string; description: string; sectionCode?: string },
	index: number
): string {
	if (entry.sectionCode) {
		const shortName = SHORT_NAMES[entry.sectionCode] ?? sanitizeFilename(entry.description).slice(0, 15);
		return `${entry.sectionCode}-${shortName}-${index}.jpg`;
	}
	// Defects: use label + short description
	const label = sanitizeFilename(entry.label);
	const desc = sanitizeFilename(entry.description).slice(0, 20);
	return `${label}-${desc}-${index}.jpg`;
}

/** Trigger a blob download in the browser */
function triggerBlobDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/** Build a base filename for the ZIP (without extension) */
function buildBaseFilename(inspection: Inspection): string {
	const excelName = buildExportFilename(inspection.meta);
	return excelName.replace(/\.xlsx$/, '');
}

/** Download just the photos as a ZIP */
export async function downloadPhotosZip(
	inspection: Inspection,
	allDefects?: Defect[]
): Promise<void> {
	const { loadPhoto } = await import('../stores/photos.js');
	const entries = collectPhotoEntries(inspection, allDefects);
	if (entries.length === 0) return;

	const zip = new JSZip();
	const folder = zip.folder('תמונות')!;

	// Track per-entry counts for numbering when multiple photos share a label+description
	const nameCounts = new Map<string, number>();

	for (const entry of entries) {
		const blob = await loadPhoto(entry.photoId);
		if (!blob) continue;

		const key = entry.sectionCode ?? `${entry.label}|${entry.description}`;
		const count = (nameCounts.get(key) ?? 0) + 1;
		nameCounts.set(key, count);

		const filename = buildPhotoFilename(entry, count);
		folder.file(filename, blob);
	}

	const zipBlob = await zip.generateAsync({ type: 'blob' });
	triggerBlobDownload(zipBlob, `תמונות - ${buildBaseFilename(inspection)}.zip`);
}

/** Download a ZIP containing both the Excel file and photos folder */
export async function downloadAllZip(
	inspection: Inspection,
	allDefects?: Defect[]
): Promise<ExportResult> {
	const { loadPhoto } = await import('../stores/photos.js');

	// Build Excel buffer
	const { buffer: excelBuffer, result } = await buildWorkbookBuffer(inspection, allDefects);

	const zip = new JSZip();
	const baseName = buildBaseFilename(inspection);

	// Add Excel file
	zip.file(buildExportFilename(inspection.meta), excelBuffer);

	// Add photos folder
	const entries = collectPhotoEntries(inspection, allDefects);
	if (entries.length > 0) {
		const folder = zip.folder('תמונות')!;
		const nameCounts = new Map<string, number>();

		for (const entry of entries) {
			const blob = await loadPhoto(entry.photoId);
			if (!blob) continue;

			const key = entry.sectionCode ?? `${entry.label}|${entry.description}`;
			const count = (nameCounts.get(key) ?? 0) + 1;
			nameCounts.set(key, count);

			const filename = buildPhotoFilename(entry, count);
			folder.file(filename, blob);
		}
	}

	const zipBlob = await zip.generateAsync({ type: 'blob' });
	triggerBlobDownload(zipBlob, `${baseName}.zip`);

	return result;
}
