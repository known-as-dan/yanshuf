export type ChecklistStatus = string;

export type InspectionMeta = {
	siteGroup: string;
	siteName: string;
	inspectionDate: string; // ISO date
	inspectorName: string;
	signatureText?: string;
};

export type ChecklistItem = {
	sectionCode: string;
	description: string;
	status?: ChecklistStatus;
	notes?: string;
	photoIds?: string[];
};

export type DcStringMeasurement = {
	id: string;
	parentId: string | null;
	inverterIndex: number;
	stringLabel: string;
	openCircuitVoltage?: number;
	operatingCurrent?: number;
	stringRiso?: number;
	feedRisoNegative?: number;
	feedRisoPositive?: number;
};

export type AcMeasurement = {
	itemCode: string;
	description: string;
	result?: string | number;
	notes?: string;
};

export type InverterSerial = {
	inverterIndex: number;
	serialNumber: string;
};

export type Defect = {
	sectionCode?: string;
	component: string;
	fault: string;
	location: string;
	status: string;
	photoIds?: string[];
};

export type InverterConfig = {
	index: number;
	label: string;
	stringCount: number;
};

export type Inspection = {
	meta: InspectionMeta;
	inverterConfigs: InverterConfig[];
	checklist: ChecklistItem[];
	dcMeasurements: DcStringMeasurement[];
	acMeasurements: AcMeasurement[];
	inverterSerials: InverterSerial[];
	defects: Defect[];
};

/** In-app report name: "לקוח - אתר" */
export function buildReportName(meta: InspectionMeta): string {
	const parts = [meta.siteGroup, meta.siteName].filter(Boolean);
	return parts.length > 0 ? parts.join(' - ') : 'בדיקה חדשה';
}

/** Export filename: "פרוטוקול בדיקה תקופתית - לקוח - אתר - תאריך.xlsx" */
export function buildExportFilename(meta: InspectionMeta): string {
	const parts = ['פרוטוקול בדיקה תקופתית'];
	if (meta.siteGroup) parts.push(meta.siteGroup);
	if (meta.siteName) parts.push(meta.siteName);
	if (meta.inspectionDate) parts.push(meta.inspectionDate);
	return `${parts.join(' - ')}.xlsx`;
}

export function createDefaultMeta(): InspectionMeta {
	return {
		siteGroup: '',
		siteName: '',
		inspectionDate: new Date().toISOString().split('T')[0],
		inspectorName: '',
		signatureText: ''
	};
}

export function createDefaultInspection(): Inspection {
	return {
		meta: createDefaultMeta(),
		inverterConfigs: [],
		checklist: [],
		dcMeasurements: [],
		acMeasurements: [],
		inverterSerials: [],
		defects: []
	};
}
