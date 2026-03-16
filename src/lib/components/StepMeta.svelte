<script lang="ts">
	import type { createInspectionStore } from '$lib/stores/inspection.svelte.js';

	let { store }: { store: ReturnType<typeof createInspectionStore> } = $props();
</script>

<div class="space-y-4">
	<div class="space-y-1">
		<h2 class="text-lg font-bold text-white lg:text-xl">פרטי בדיקה</h2>
		<p class="text-sm text-gray-400 lg:text-base">מלא את פרטי האתר והבודק</p>
	</div>

	<div class="space-y-4 lg:grid lg:grid-cols-2 lg:space-y-0 lg:gap-x-6 lg:gap-y-4">
		<div>
			<label for="siteGroup" class="mb-1.5 block text-sm font-medium text-gray-300 lg:text-base"
				>לקוח / קבוצת אתרים</label
			>
			<input
				id="siteGroup"
				type="text"
				class="block w-full px-3 py-2"
				value={store.inspection.meta.siteGroup}
				oninput={(e) => store.updateMeta({ siteGroup: e.currentTarget.value })}
				placeholder="לדוגמה: אנרגיה ירוקה בע״מ"
			/>
		</div>

		<div>
			<label for="siteName" class="mb-1.5 block text-sm font-medium text-gray-300 lg:text-base"
				>אתר</label
			>
			<input
				id="siteName"
				type="text"
				class="block w-full px-3 py-2"
				value={store.inspection.meta.siteName}
				oninput={(e) => store.updateMeta({ siteName: e.currentTarget.value })}
				placeholder="לדוגמה: מפעל שמש - חיפה"
			/>
		</div>

		<div>
			<label
				for="inspectionDate"
				class="mb-1.5 block text-sm font-medium text-gray-300 lg:text-base">תאריך בדיקה</label
			>
			<input
				id="inspectionDate"
				type="date"
				class="block w-full px-3 py-2"
				value={store.inspection.meta.inspectionDate}
				oninput={(e) => store.updateMeta({ inspectionDate: e.currentTarget.value })}
			/>
		</div>

		<div>
			<label for="inspectorName" class="mb-1.5 block text-sm font-medium text-gray-300 lg:text-base"
				>שם בודק</label
			>
			<input
				id="inspectorName"
				type="text"
				class="block w-full px-3 py-2"
				value={store.inspection.meta.inspectorName}
				oninput={(e) => store.updateMeta({ inspectorName: e.currentTarget.value })}
				placeholder="שם מלא"
			/>
		</div>

		<div>
			<label for="signature" class="mb-1.5 block text-sm font-medium text-gray-300 lg:text-base"
				>חתימה <span class="text-gray-500">(אופציונלי)</span></label
			>
			<input
				id="signature"
				type="text"
				class="block w-full px-3 py-2"
				value={store.inspection.meta.signatureText ?? ''}
				oninput={(e) => store.updateMeta({ signatureText: e.currentTarget.value })}
				placeholder="טקסט חתימה"
			/>
		</div>
	</div>

	<!-- Auto-generated report name -->
	<div class="rounded-xl border border-border bg-surface-800 p-4 lg:col-span-2">
		<div class="mb-1.5 text-sm font-medium text-gray-300">שם הדוח</div>
		<p class="text-sm text-gray-400">{store.report.name}</p>
		<p class="mt-1.5 text-xs text-gray-500">שם הדוח נוצר אוטומטית מפרטי הבדיקה</p>
	</div>
</div>
