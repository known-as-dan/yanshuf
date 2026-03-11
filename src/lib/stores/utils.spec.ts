import { describe, it, expect } from 'vitest';
import { shortenFault, computeAutoDefects } from './inspection.svelte.js';

describe('shortenFault', () => {
	it('strips leading imperative verbs', () => {
		expect.assertions(1);
		expect(shortenFault('ודא את תקינות החיבורים')).toBe('תקינות החיבורים');
	});

	it('strips "בדוק כי" prefix', () => {
		expect.assertions(1);
		expect(shortenFault('בדוק כי המערכת פועלת')).toBe('המערכת פועלת');
	});

	it('takes only first sentence', () => {
		expect.assertions(1);
		expect(shortenFault('בדיקה ראשונה. בדיקה שנייה')).toBe('בדיקה ראשונה');
	});

	it('takes only first clause before dash', () => {
		expect.assertions(1);
		expect(shortenFault('בדיקה ראשונה - פירוט נוסף')).toBe('בדיקה ראשונה');
	});

	it('caps at 60 chars', () => {
		expect.assertions(2);
		const long = 'א'.repeat(80);
		const result = shortenFault(long);
		expect(result.length).toBe(60);
		expect(result.endsWith('...')).toBe(true);
	});

	it('passes through short text unchanged', () => {
		expect.assertions(1);
		expect(shortenFault('חיבור תקין')).toBe('חיבור תקין');
	});
});

describe('computeAutoDefects', () => {
	it('returns defects for failed checklist items', () => {
		expect.assertions(3);
		const checklist = [
			{ sectionCode: '1.1', description: 'ודא את הדבר', status: 'לא תקין', notes: 'שבור' },
			{ sectionCode: '1.2', description: 'דבר אחר', status: 'תקין', notes: '' }
		];
		const defects = computeAutoDefects(checklist);
		expect(defects).toHaveLength(1);
		expect(defects[0].location).toBe('סעיף 1.1');
		expect(defects[0].status).toBe('שבור');
	});

	it('applies shortenFault to the description', () => {
		expect.assertions(1);
		const checklist = [
			{ sectionCode: '2.1', description: 'ודא את תקינות המערכת', status: 'לא תקין', notes: '' }
		];
		const defects = computeAutoDefects(checklist);
		expect(defects[0].fault).toBe('תקינות המערכת');
	});

	it('returns empty array when no failures', () => {
		expect.assertions(1);
		const checklist = [
			{ sectionCode: '1.1', description: 'ok', status: 'תקין', notes: '' }
		];
		expect(computeAutoDefects(checklist)).toHaveLength(0);
	});

	it('uses notes as status, defaults to empty string', () => {
		expect.assertions(1);
		const checklist = [
			{ sectionCode: '1.1', description: 'test', status: 'לא תקין' }
		];
		const defects = computeAutoDefects(checklist);
		expect(defects[0].status).toBe('');
	});
});
