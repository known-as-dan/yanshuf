export const STEP_SLUGS = ['meta', 'config', 'checklist', 'dc', 'ac', 'defects', 'summary'] as const;
export type StepSlug = (typeof STEP_SLUGS)[number];

export const STEP_LABELS: Record<StepSlug, string> = {
	meta: 'פרטי בדיקה',
	config: 'הגדרת מערכת',
	checklist: 'סעיפי בדיקה',
	dc: 'מדידות DC',
	ac: 'מדידות AC',
	defects: 'ליקויים',
	summary: 'סיכום וייצוא'
};

export const STEP_ICONS: Record<StepSlug, string> = {
	meta: '📝',
	config: '⚙️',
	checklist: '✅',
	dc: '⚡',
	ac: '🔌',
	defects: '⚠️',
	summary: '📊'
};

export function slugToIndex(slug: string): number {
	const idx = STEP_SLUGS.indexOf(slug as StepSlug);
	return idx >= 0 ? idx : 0;
}

export function indexToSlug(index: number): StepSlug {
	return STEP_SLUGS[index] ?? 'meta';
}
