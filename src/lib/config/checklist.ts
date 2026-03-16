import type { ChecklistItem } from '../models/inspection.js';

export type ChecklistItemConfig = {
	sectionCode: string;
	description: string;
	allowLK?: boolean;
	/** Replaces 'תקין' label with this (e.g. 'בוצע' for action items) */
	okLabel?: string;
	/** Replaces ALL status buttons with custom choices (e.g. ['סוג I', 'סוג II']) */
	selectOptions?: string[];
	/** Visual subgroup label within a section (divider shown when this changes) */
	subgroup?: string;
};

export type ChecklistSection = {
	code: string;
	title: string;
	items: ChecklistItemConfig[];
};

export const checklistSections: ChecklistSection[] = [
	{
		code: '1',
		title: 'מפסק ראשי, מפסקים ליד מונה ולוח פיצול',
		items: [
			{
				sectionCode: '1.1',
				description: 'ודא שלמות הלוח, היעדר פגיעות או עיוותים, חוזק מכני וחוסן התקנה של הארון',
				subgroup: 'מצב פיזי ושילוט'
			},
			{
				sectionCode: '1.2',
				description: 'ודא כי הארון והמובלים הנכנסים אליו אטומים לכניסת מים',
				subgroup: 'מצב פיזי ושילוט'
			},
			{ sectionCode: '1.3', description: 'ודא המצאות ותקינות השילוט', subgroup: 'מצב פיזי ושילוט' },
			{
				sectionCode: '1.4',
				description: 'ציין מצב הנקיון בארון. בצע נקיון במידת הצורך',
				okLabel: 'בוצע',
				subgroup: 'מצב פיזי ושילוט'
			},
			{
				sectionCode: '1.5',
				description: 'בדוק תקינות מפסק חירום אם קיים',
				allowLK: true,
				subgroup: 'בדיקת מפסקים'
			},
			{
				sectionCode: '1.6',
				description: 'בדוק תקינות מפסק פחת על ידי לחצן בדיקה, אם קיים',
				allowLK: true,
				subgroup: 'בדיקת מפסקים'
			},
			{
				sectionCode: '1.7',
				description: 'חזק את כל הברגים בלוח, כולל פסי צבירה (ודא היעדר מתח!)',
				okLabel: 'בוצע',
				subgroup: 'תחזוקה'
			},
			{
				sectionCode: '1.8',
				description: 'בצע צילום תרמי של הרכיבים בלוח. חפש חיבורים רופפים ונקודות כשל',
				okLabel: 'בוצע',
				subgroup: 'תחזוקה'
			},
			{
				sectionCode: '1.9',
				description:
					'בדוק את מקור חיבור הארקה למערכת. ודא חוזק החיבור, שלמות המוליך והאביזירים ותקינותם. בדוק האם החיבור קורוזיבי או חלוד',
				subgroup: 'הארקה וסיווג'
			},
			{
				sectionCode: '1.10',
				description: 'ציין סוג הארון - סוג I, סוג II',
				selectOptions: ['סוג I', 'סוג II'],
				subgroup: 'הארקה וסיווג'
			},
			{
				sectionCode: '1.11',
				description: 'בצע מדידת מתחים וזרמים במפסק הראשי ומלא בטופס ייעודי',
				okLabel: 'בוצע',
				subgroup: 'מדידות וכיוונון'
			},
			{
				sectionCode: '1.12',
				description: 'בצע מדידת לולאת התקלה ומלא בטופס ייעודי',
				okLabel: 'בוצע',
				subgroup: 'מדידות וכיוונון'
			},
			{
				sectionCode: '1.13',
				description:
					'בדוק כיוונון מפסק ראשי. ציין זרם הפעלה תרמי, זרם הפעלה מגנטי וזרם דלף כאשר מדובר במפסק משולב פחת. רשום את התוצאות בטופס ייעודי',
				okLabel: 'בוצע',
				subgroup: 'מדידות וכיוונון'
			},
			{
				sectionCode: '1.14',
				description: 'ודא כי הכיוונון מתאים ללולאת התקלה ושיטת ההגנה במתקן',
				subgroup: 'מדידות וכיוונון'
			}
		]
	},
	{
		code: '2',
		title: 'לוח איסוף מהפכים',
		items: [
			{
				sectionCode: '2.1',
				description: 'ודא שלמות הלוח, היעדר פגיעות או עיוותים, חוזק מכני וחוסן התקנה של הארון',
				subgroup: 'מצב פיזי ושילוט'
			},
			{
				sectionCode: '2.2',
				description: 'ודא כי הארון והמובלים הנכנסים אליו אטומים לכניסת מים',
				subgroup: 'מצב פיזי ושילוט'
			},
			{
				sectionCode: '2.3',
				description: 'ציין סוג הארון - סוג I, סוג II',
				selectOptions: ['סוג I', 'סוג II'],
				subgroup: 'מצב פיזי ושילוט'
			},
			{ sectionCode: '2.4', description: 'ודא המצאות ותקינות השילוט', subgroup: 'מצב פיזי ושילוט' },
			{
				sectionCode: '2.5',
				description: 'ציין מצב הנקיון בארון. בצע נקיון במידת הצורך',
				okLabel: 'בוצע',
				subgroup: 'מצב פיזי ושילוט'
			},
			{
				sectionCode: '2.6',
				description: 'בדוק תקינות מפסק חירום אם קיים',
				allowLK: true,
				subgroup: 'בדיקת מפסקים וממסרים'
			},
			{
				sectionCode: '2.7',
				description: 'בדוק תקינות מפסק פחת על ידי לחצן בדיקה, אם קיים',
				allowLK: true,
				subgroup: 'בדיקת מפסקים וממסרים'
			},
			{
				sectionCode: '2.8',
				description: 'בדוק תקינות ממסר זרם דלף אם קיים',
				allowLK: true,
				subgroup: 'בדיקת מפסקים וממסרים'
			},
			{
				sectionCode: '2.9',
				description: 'חזק את כל הברגים בלוח, כולל פסי צבירה (ודא היעדר מתח!)',
				okLabel: 'בוצע',
				subgroup: 'תחזוקה'
			},
			{
				sectionCode: '2.10',
				description: 'בצע מדידת מתחים וזרמים במפסק ראשי ומלא בטופס ייעודי',
				okLabel: 'בוצע',
				subgroup: 'מדידות וכיוונון'
			},
			{
				sectionCode: '2.11',
				description: 'בצע מדידת לולאת התקלה ומלא בטופס ייעודי',
				okLabel: 'בוצע',
				subgroup: 'מדידות וכיוונון'
			},
			{
				sectionCode: '2.12',
				description:
					'בדוק כיוונון מפסק ראשי. ציין זרם הפעלה תרמי, זרם הפעלה מגנטי וזרם דלף כאשר מדובר במפסק משולב פחת. רשום את התוצאות בטופס ייעודי',
				okLabel: 'בוצע',
				subgroup: 'מדידות וכיוונון'
			},
			{
				sectionCode: '2.13',
				description: 'ודא כי הכיוונון מתאים ללולאת התקלה ושיטת ההגנה במתקן',
				subgroup: 'מדידות וכיוונון'
			},
			{
				sectionCode: '2.14',
				description: 'בצע צילום תרמי של הרכיבים בלוח. חפש חיבורים רופפים ונקודות כשל',
				okLabel: 'בוצע',
				subgroup: 'מדידות וכיוונון'
			}
		]
	},
	{
		code: '3',
		title: 'הארקה',
		items: [
			{ sectionCode: '3.1', description: 'ודא שלמות הקופסא בה מותקן פה"פ', subgroup: 'מצב פיזי' },
			{
				sectionCode: '3.2',
				description: 'בדוק את מצב הפה"פ עצמו. ודא היעדר חלודה וקורוזיה',
				subgroup: 'מצב פיזי'
			},
			{
				sectionCode: '3.3',
				description: 'בדוק את תקינות החיבורים וחיזוק הברגים בפה"פ',
				subgroup: 'חיבורים ורציפות'
			},
			{
				sectionCode: '3.4',
				description: 'בדוק רציפות הארקה במערכת - גב עבודה, תעלות, קונסטרוקציה, מהפכים, פאנלים',
				subgroup: 'חיבורים ורציפות'
			}
		]
	},
	{
		code: '4',
		title: 'מהפכים',
		items: [
			{
				sectionCode: '4.1',
				description: 'ודא שלמות המהפכים, היעדר פגיעות או עיוותים וסגירה הרמטית של מכסה המהפך',
				subgroup: 'מצב פיזי'
			},
			{
				sectionCode: '4.2',
				description: 'בדוק חוסן התקנה. ודא כי המהפך מותקן לפי הוראות היצרן.',
				subgroup: 'מצב פיזי'
			},
			{
				sectionCode: '4.3',
				description: 'בצע חיזוק ברגי AC ו DC בכניסה למהפך',
				okLabel: 'בוצע',
				subgroup: 'תחזוקה ובדיקות'
			},
			{
				sectionCode: '4.4',
				description: 'בדוק תקינות המאווררים וניקיונם. בצע ניקוי למאוורר לפי הצורך',
				subgroup: 'תחזוקה ובדיקות'
			},
			{
				sectionCode: '4.5',
				description: 'בצע צילום תרמי של המהפך למציאת חיבורים רופפים ורכיבים תקולים',
				okLabel: 'בוצע',
				subgroup: 'תחזוקה ובדיקות'
			},
			{
				sectionCode: '4.6',
				description:
					"ודא כי סימון המהפכים תואם את מספורם בפורטל הניטור (סולאראדג'). במידה ולא, ציין את הסדר הנכון בטופס ייעודי",
				subgroup: 'סימון ואביזרים'
			},
			{
				sectionCode: '4.7',
				description:
					'בדוק תקינות קופסאות אופסט, במידה וקיימות. הפסק את מקור מתח DC והמתן לתחילת פעולתן. ציין את מתח העבודה שלהן ביחס להארקה',
				allowLK: true,
				subgroup: 'סימון ואביזרים'
			}
		]
	},
	{
		code: '5',
		title: 'תקשורת ומערכת ניטור אקלים',
		items: [
			{
				sectionCode: '5.1',
				description:
					'ציין את סוג התקשורת (ראוטר סלולרי, מודול GSM, חיבור קווי...) ואת מיקום החיבור לרשת',
				okLabel: 'בוצע',
				subgroup: 'תקשורת'
			},
			{
				sectionCode: '5.2',
				description: 'בדוק המצאות שעון שבת וכיוון ניתוק יומי במקרה של ראוטר סלולרי',
				allowLK: true,
				subgroup: 'תקשורת'
			},
			{
				sectionCode: '5.3',
				description: 'בדוק את שלמות וחוסן ההתקנה של ארון התקשורת במידה וקיים',
				allowLK: true,
				subgroup: 'תקשורת'
			},
			{
				sectionCode: '5.4',
				description:
					'בדוק את תקינות מערכת ניטור האקלים במידה וקיימת. ודא כי הערכים המתקבלים מהחיישנים תקינים.',
				allowLK: true,
				subgroup: 'חיישנים'
			},
			{
				sectionCode: '5.5',
				description: 'ודא כי חיישני הקרינה מותקנים במקום לא מוצל',
				allowLK: true,
				subgroup: 'חיישנים'
			},
			{
				sectionCode: '5.6',
				description: 'ודא כי חיישן טמפרטורת הפאנל מותקן כראוי בגב הפאנל ולא נפל',
				allowLK: true,
				subgroup: 'חיישנים'
			}
		]
	},
	{
		code: '6',
		title: 'קופסאות DC, חיווט וקולטים',
		items: [
			{
				sectionCode: '6.1',
				description:
					'ודא שלמות הקופסאות, היעדר פגיעות או עיוותים, חוסן התקנה וסגירה הרמטית של הקופסא והמכסה.',
				subgroup: 'מצב פיזי - קופסאות'
			},
			{
				sectionCode: '6.2',
				description: 'ודא כי הקופסא והמובלים הנכנסים לתוכה אטומים מפני כניסת מים',
				subgroup: 'מצב פיזי - קופסאות'
			},
			{
				sectionCode: '6.3',
				description: 'בצע צילום תרמי של הקופסא למציאת חיבורים רופפים, רכיבים תקולים ונקודות כשל',
				okLabel: 'בוצע',
				subgroup: 'תחזוקת קופסאות'
			},
			{
				sectionCode: '6.4',
				description: 'בצע חיזוק של הדקי כל הרכיבים בקופסאות',
				okLabel: 'בוצע',
				subgroup: 'תחזוקת קופסאות'
			},
			{
				sectionCode: '6.5',
				description:
					'בדוק את תקינות המוליכים בקופסא. ודא שימוש בכבל מתאים (h1z2z2-k), שטח חתך נכון וסופיות תקניות.',
				subgroup: 'תחזוקת קופסאות'
			},
			{
				sectionCode: '6.6',
				description: 'בדוק את תקינות הנתיכים במידה וישנם.',
				allowLK: true,
				subgroup: 'מדידות ובדיקות'
			},
			{
				sectionCode: '6.7',
				description:
					"מדוד מתחים וזרמים ומלא בטבלה ייעודית (לא נדרש במהפך סולאראדג'). במקרה של אי תקינות או חוסר התאמה במדדים פנה לסעיפים 9.1 ו9.2",
				okLabel: 'בוצע',
				subgroup: 'מדידות ובדיקות'
			},
			{
				sectionCode: '6.8',
				description:
					'בצע בדיקת בידוד לכל מחרוזת ולכבלי ההזנה לכיוון המהפך. מלא ערכים בטבלה ייעודית. במקרה של אי תקינות או חוסר התאמה במדדים פנה לסעיף 9.3',
				okLabel: 'בוצע',
				subgroup: 'מדידות ובדיקות'
			},
			{
				sectionCode: '6.9',
				description: "בצע בדיקה בפורטל הניטור (במערכת סולאראדג') למציאת קולטים/אופ' בעיתיים",
				okLabel: 'בוצע',
				subgroup: 'מדידות ובדיקות'
			},
			{ sectionCode: '6.10', description: 'ודא המצאות השילוט ותקינותו', subgroup: 'כבילה ושילוט' },
			{
				sectionCode: '6.11',
				description: 'בדוק את חביקת הכבילה במערכת ושלמותה.',
				subgroup: 'כבילה ושילוט'
			},
			{
				sectionCode: '6.12',
				description:
					'בדוק את חוזק התקנת הקולטים ושלמות המהדקים (קלאמפים). ודא כי כל קולט מחוזק על ידי ארבעה מהדקים לפחות.',
				subgroup: 'קולטים'
			},
			{
				sectionCode: '6.13',
				description:
					'בדוק ויזואלית את הקולטים למציאת קולט שבור ושינוים נראים (שינוי צבע, תאים שרופים וכו...)',
				subgroup: 'קולטים'
			},
			{
				sectionCode: '6.14',
				description: 'בצע צילום תרמי מדגמי למציאת קולטים תקולים.',
				okLabel: 'בוצע',
				subgroup: 'קולטים'
			}
		]
	},
	{
		code: '7',
		title: 'קונסטרוקציה ותשתיות',
		items: [
			{
				sectionCode: '7.1',
				description:
					'בדוק את חוזק הקונסנטרוקציה. ודא קיבוע חזק אל הגג, היעדר חופשים וברגים משוחררים. ודא כי הקונסטרוקציה יציבה ואינה מתנדנדת',
				subgroup: 'קונסטרוקציה'
			},
			{
				sectionCode: '7.2',
				description: 'ודא היעדר קורוזיה וחלודה בקונסטרוקציה ובתעלות הרשת/פח',
				subgroup: 'קונסטרוקציה'
			},
			{
				sectionCode: '7.3',
				description: 'בדוק המצאות יריעות איטום מתחת למשקולות ותקינותם',
				allowLK: true,
				subgroup: 'יסודות ותשתיות'
			},
			{
				sectionCode: '7.4',
				description: 'בדוק תקינות וחוזק העוגנים במשקולות',
				subgroup: 'יסודות ותשתיות'
			},
			{
				sectionCode: '7.5',
				description: 'ודא את שלמות התעלות וכיסויים',
				subgroup: 'יסודות ותשתיות'
			}
		]
	},
	{
		code: '8',
		title: 'סולמות, מעקות וקווי חיים',
		items: [
			{
				sectionCode: '8.1',
				description: 'בדוק ויזואלית את שלמות קווי החיים, היעדר קורוזיה וחלודה',
				allowLK: true,
				subgroup: 'קווי חיים'
			},
			{
				sectionCode: '8.2',
				description: 'בדוק חוסן סולמות ומעקות, ואת חוזק החיבור למבנה.',
				allowLK: true,
				subgroup: 'סולמות, מעקות ודלתות'
			},
			{
				sectionCode: '8.3',
				description: 'בדוק שלמות גילוון והיעדר חלודה בסולמות ומעקות',
				allowLK: true,
				subgroup: 'סולמות, מעקות ודלתות'
			},
			{
				sectionCode: '8.4',
				description: 'בדוק כי הדלתות נסגרות וננעלות בכלובי המהפכים ובסולם עלייה לגג.',
				allowLK: true,
				subgroup: 'סולמות, מעקות ודלתות'
			}
		]
	},
	{
		code: '9',
		title: 'פרוטוקול בדיקת קולטים למציאת בעיות',
		items: [
			{
				sectionCode: '9.1',
				description:
					'במקרה של הפרשי מתח בין מחרוזות מקבילות - בדוק מספר הקולטים בכל מחרוזת וודא התאמה. במידה ואין התאמה, נתק קולטים עד הגעה לאיזון. במידה וישנה התאמה במספר הקולטים אך עדיין קיים הפרש פוטנציאל, זהה את המחרוזת הבעייתית ובודד חצי ממנה. מדוד את המתח בכל חצי של המחרוזת וזהה את החצי הבעייתי. חזור שוב על הפעולה עד לבידוד הקולט הבעייתי. מלא טופס ייעודי לקולט תקול',
				okLabel: 'בוצע',
				subgroup: 'בעיות מתח וזרם'
			},
			{
				sectionCode: '9.2',
				description:
					'במקרה של הבדלי זרמים בין מחרוזות מקבילות - ודא כי מדובר בסוג קולטים זהה. בדוק האם ישנן הצללות או הבדל בזווית ההתקנה באחת מן המחרוזות. זהה את המחרוזת הבעייתית ובודד חצי ממנה. מדוד זרם קצר בעזרת מפסק ייעודי בכל חצי מחרוזת וזהה את החצי הבעייתי. חזור על הפעולה עד למציאת הקולט התקול. מלא טופס ייעודי לקולט תקול',
				okLabel: 'בוצע',
				subgroup: 'בעיות מתח וזרם'
			},
			{
				sectionCode: '9.3',
				description:
					"במקרה של בעיות בידוד במחרוזת (במערכת סולאראדג', הקפד על מתח בדיקה של 500 וולט!) - זהה את המחרוזת הבעייתית. נתק את המוליכים מהקופסא לקולט האחרון והראשון ובצע בדיקת בידוד שוב. בקבלת תוצאה תקינה עבור לסעיף 9.4. במידה וקיבלת תוצאה נמוכה, חפש ויזואלית את מקור הפגיעה בכבל.",
				okLabel: 'בוצע',
				subgroup: 'בעיות בידוד'
			},
			{
				sectionCode: '9.4',
				description:
					"במקרה של בעיית בידוד במחרוזת (כבילה תקינה) (במערכת סולאראדג', הקפד על מתח בדיקה של 500 וולט!) - חצה את המחרוזת לשניים. בדוק כל חצי וזהה את החצי הבעייתי. חזור על הפעולה עד למציאת גורם התקלה. במערכת סולאר אדג', נתק את הקולטים מהאופ' ובדוק בנפרד כל רכיב. ציין את מקור התקלה ומלא טופס תקלה ייעודי",
				okLabel: 'בוצע',
				subgroup: 'בעיות בידוד'
			}
		]
	}
];

/** Lookup: sectionCode → config for the item */
const itemConfigMap: ReadonlyMap<string, ChecklistItemConfig> = new Map(
	checklistSections.flatMap((s) => s.items.map((i) => [i.sectionCode, i] as const))
);

export function getItemConfig(sectionCode: string): ChecklistItemConfig | undefined {
	return itemConfigMap.get(sectionCode);
}

export const allowLKCodes: ReadonlySet<string> = new Set(
	checklistSections.flatMap((s) => s.items.filter((i) => i.allowLK).map((i) => i.sectionCode))
);

export function createChecklistFromTemplate(): ChecklistItem[] {
	return checklistSections.flatMap((section) =>
		section.items.map((item) => ({
			sectionCode: item.sectionCode,
			description: item.description,
			status: undefined,
			notes: ''
		}))
	);
}
