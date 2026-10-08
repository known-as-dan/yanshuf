import { createDefaultMeta, type Inspection } from './inspection.js';
import { ensureDcGroups } from './dc.js';

/** Fill legacy omissions without discarding measurements, labels or photo references. */
export function migrateInspection(inspection: Inspection): void {
	inspection.meta ??= createDefaultMeta();
	inspection.meta.siteGroup ??= '';
	inspection.inverterConfigs ??= [];
	inspection.checklist ??= [];
	inspection.dcMeasurements ??= [];
	inspection.acMeasurements ??= [];
	inspection.inverterSerials ??= [];
	inspection.defects ??= [];
	for (const row of inspection.dcMeasurements) {
		row.id ||= crypto.randomUUID();
		row.parentId ??= null;
		row.inverterIndex ??= 0;
	}
	for (const item of inspection.checklist) {
		if (item.status === 'לא קיים') item.status = 'לא רלוונטי';
	}
	ensureDcGroups(inspection);
}
