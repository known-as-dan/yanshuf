import JSZip from 'jszip';

type Sheet = { name: string; path: string; index: number };
const attributes = (tag: string) =>
	Object.fromEntries([...tag.matchAll(/([\w:]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
function resolvePart(parent: string, target: string): string {
	const parts: string[] = [];
	for (const part of (target.startsWith('/') ? target : `${parent}/${target}`).split('/')) {
		if (part === '..') parts.pop();
		else if (part && part !== '.') parts.push(part);
	}
	return parts.join('/');
}
async function workbookSheets(zip: JSZip): Promise<Sheet[]> {
	const xml = await zip.file('xl/workbook.xml')!.async('string');
	const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
	const targets = new Map(
		[...rels.matchAll(/<Relationship\s[^>]*>/g)].map((match) => {
			const rel = attributes(match[0]);
			return [rel.Id, resolvePart('xl', rel.Target)];
		})
	);
	return [...xml.matchAll(/<sheet\s[^>]*>/g)].map((match, index) => {
		const sheet = attributes(match[0]);
		const path = targets.get(sheet['r:id']);
		if (!path) throw new Error(`Missing worksheet relationship: ${sheet.name}`);
		return { name: sheet.name, path, index };
	});
}

/** Overlay edited cells into the native OPC package. ExcelJS cannot round-trip
 * VML header/footer logos or printer settings, and renumbers worksheet parts. */
export async function preserveNativeParts(
	template: ArrayBuffer,
	generated: ArrayBuffer
): Promise<ArrayBuffer> {
	const source = await JSZip.loadAsync(template);
	const edited = await JSZip.loadAsync(generated);
	const sheets = await workbookSheets(source);
	const generatedSheets = await workbookSheets(edited);
	const lastRows = new Map<number, number>();
	for (const sheet of sheets) {
		const updatedSheet = generatedSheets.find((item) => item.name === sheet.name);
		if (!updatedSheet) throw new Error(`Missing worksheet: ${sheet.name}`);
		const updated = await edited.file(updatedSheet.path)!.async('string');
		let original = await source.file(sheet.path)!.async('string');
		for (const tag of ['sheetData', 'dimension', 'cols']) {
			const pattern = new RegExp(`<${tag}\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`);
			const replacement = updated.match(pattern)?.[0];
			if (replacement && original.match(pattern))
				original = original.replace(pattern, () => replacement);
		}
		source.file(sheet.path, original);
		const rows = [...updated.matchAll(/<row\b[^>]*\br="(\d+)"/g)].map((row) => Number(row[1]));
		lastRows.set(sheet.index, Math.max(1, ...rows));
		const filename = sheet.path.split('/').at(-1)!;
		const relPath = `xl/worksheets/_rels/${filename}.rels`;
		const relationships = await source.file(relPath)?.async('string');
		for (const match of relationships?.matchAll(/<Relationship\s[^>]*>/g) ?? []) {
			const rel = attributes(match[0]);
			if (!rel.Type.endsWith('/table') || sheet.index === 0) continue;
			const path = resolvePart('xl/worksheets', rel.Target);
			const table = await source.file(path)!.async('string');
			const last = lastRows.get(sheet.index)!;
			source.file(
				path,
				table.replace(
					/ref="([A-Z]+\d+):([A-Z]+)(\d+)"/g,
					(_match, start, column, end) => `ref="${start}:${column}${Math.max(Number(end), last)}"`
				)
			);
		}
	}
	for (const path of ['xl/styles.xml', 'xl/sharedStrings.xml']) {
		const file = edited.file(path);
		if (file) source.file(path, await file.async('uint8array'));
	}
	// Retain native print titles, names and checklist extent. Only grow DC/AC/defects.
	const workbook = await source.file('xl/workbook.xml')!.async('string');
	source.file(
		'xl/workbook.xml',
		workbook.replace(
			/(<definedName\b[^>]*name="_xlnm.Print_Area"[^>]*>)([\s\S]*?)(<\/definedName>)/g,
			(match: string, open: string, value: string, close: string) => {
				const sheet = Number(/localSheetId="(\d+)"/.exec(open)?.[1] ?? -1);
				if (sheet === 0 || !lastRows.has(sheet)) return match;
				const last = lastRows.get(sheet)!;
				return (
					open +
					value.replace(
						/(\$[A-Z]+\$\d+:\$[A-Z]+\$)(\d+)/g,
						(_range, prefix, end) => prefix + Math.max(Number(end), last)
					) +
					close
				);
			}
		)
	);
	return source.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
