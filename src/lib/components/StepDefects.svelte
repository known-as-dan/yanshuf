<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { haptic } from '$lib/utils/haptics.js';
	import { defectComponentOptions } from '$lib/config/ac.js';
	import type { createInspectionStore } from '$lib/stores/inspection.svelte.js';
	import PhotoCapture from './PhotoCapture.svelte';

	let { store }: { store: ReturnType<typeof createInspectionStore> } = $props();

	type StringFields = 'component' | 'fault' | 'location' | 'status';
	function updateField(idx: number, field: StringFields, value: string) {
		store.inspection.defects[idx][field] = value;
		store.save();
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg lg:text-xl font-bold text-white">ריכוז ליקויים</h2>
			<p class="text-sm lg:text-base text-gray-400">תיעוד ליקויים שנמצאו בבדיקה</p>
		</div>
		<button
			type="button"
			class="rounded-xl bg-accent px-3.5 lg:px-5 py-2 lg:py-2.5 text-sm lg:text-base font-medium text-white transition-colors hover:bg-accent-hover active:bg-accent/80"
			onclick={() => store.addDefect()}
		>
			+ הוסף ליקוי
		</button>
	</div>

	<!-- Auto-populated defects from checklist -->
	{#if store.autoDefects.length > 0}
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<span class="text-sm font-semibold text-warn">⚠️ ליקויים מהבדיקות החזותיות</span>
				<span class="rounded-full bg-warn-dim px-2 py-0.5 text-xs font-medium text-warn">{store.autoDefects.length}</span>
			</div>
			{#each store.autoDefects as defect, idx (defect.location + defect.fault)}
				{@const checklistItem = store.inspection.checklist.find((c) => c.sectionCode === defect.sectionCode)}
				<div class="rounded-xl border border-warn/20 bg-warn-dim/30 p-3">
					<div class="mb-1 flex items-start justify-between gap-2">
						<span class="text-sm font-semibold text-warn">{defect.component}</span>
						<span class="shrink-0 rounded bg-surface-600 px-1.5 py-0.5 text-xs text-gray-400">{defect.location}</span>
					</div>
					<p class="text-sm text-gray-300">{defect.fault}</p>
					<div class="mt-2">
						<input
							type="text"
							class="w-full border-none bg-surface-700 px-2.5 py-1.5 text-sm"
							placeholder="הערות..."
							value={defect.status}
							oninput={(e) => store.updateChecklistItem(defect.sectionCode, undefined, e.currentTarget.value)}
						/>
					</div>
					{#if checklistItem?.photoIds?.length}
						<div class="mt-2">
							<PhotoCapture photoIds={checklistItem.photoIds} readonly />
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Manual defects -->
	{#if store.inspection.defects.length === 0 && store.autoDefects.length === 0}
		<div class="rounded-xl border border-border/50 bg-surface-800 py-12 text-center">
			<div class="mb-3 text-4xl opacity-30">✓</div>
			<p class="text-gray-400">לא נמצאו ליקויים</p>
			<p class="mt-1 text-sm text-gray-500">לחץ "הוסף ליקוי" לתעד ליקוי חדש</p>
		</div>
	{:else}
		{#each store.inspection.defects as defect, idx (idx)}
			<div class="overflow-hidden rounded-xl border border-border bg-surface-800" in:fly={{ y: -20, duration: 400, easing: cubicOut }}>
				<div class="flex items-center justify-between bg-surface-700 px-3 py-2">
					<span class="text-sm font-semibold text-white">ליקוי #{idx + 1}</span>
					<div class="flex gap-1">
						<button
							type="button"
							class="rounded-xl px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-surface-600 hover:text-white active:bg-surface-600 active:text-white"
							title="שכפל ליקוי"
						onclick={() => { haptic('light'); store.duplicateDefect(idx); }}
						>
							📋
						</button>
						<button
							type="button"
							class="rounded-xl px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-danger/20 hover:text-danger active:bg-danger/20 active:text-danger"
							title="מחק ליקוי"
						onclick={() => { haptic('warning'); store.removeDefect(idx); }}
						>
							🗑
						</button>
					</div>
				</div>

				<div class="space-y-3 p-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
					<div>
						<label for="defect-component-{idx}" class="mb-1 block text-sm lg:text-base font-medium text-gray-300">רכיב</label>
						<select
							id="defect-component-{idx}"
							class="w-full border-none bg-surface-700 px-2.5 py-1.5 text-sm"
							value={defect.component}
							onchange={(e) => updateField(idx, 'component', e.currentTarget.value)}
						>
							<option value="">בחר רכיב...</option>
							{#each defectComponentOptions as opt}
								<option value={opt}>{opt}</option>
							{/each}
						</select>
					</div>

					<div class="lg:col-span-2">
						<label for="defect-fault-{idx}" class="mb-1 block text-sm lg:text-base font-medium text-gray-300">תיאור תקלה</label>
						<textarea
							id="defect-fault-{idx}"
							class="w-full border-none bg-surface-700 px-2.5 py-1.5 text-sm"
							rows={2}
							placeholder="תיאור מפורט של התקלה..."
							value={defect.fault}
							oninput={(e) => updateField(idx, 'fault', e.currentTarget.value)}
						></textarea>
					</div>

					<div>
						<label for="defect-location-{idx}" class="mb-1 block text-sm lg:text-base font-medium text-gray-300">מיקום</label>
						<input
							id="defect-location-{idx}"
							type="text"
							class="w-full border-none bg-surface-700 px-2.5 py-1.5 text-sm"
							placeholder="מיקום הליקוי..."
							value={defect.location}
							oninput={(e) => updateField(idx, 'location', e.currentTarget.value)}
						/>
					</div>

					<div class="lg:col-span-2">
						<label for="defect-status-{idx}" class="mb-1 block text-sm lg:text-base font-medium text-gray-300">סטטוס / הערות</label>
						<textarea
							id="defect-status-{idx}"
							class="w-full border-none bg-surface-700 px-2.5 py-1.5 text-sm"
							rows={2}
							placeholder="סטטוס טיפול, הערות..."
							value={defect.status}
							oninput={(e) => updateField(idx, 'status', e.currentTarget.value)}
						></textarea>
					</div>

					<div class="lg:col-span-2">
						<span class="mb-1 block text-sm lg:text-base font-medium text-gray-300">תמונות</span>
						<PhotoCapture
							photoIds={defect.photoIds ?? []}
							onadd={(id) => store.addDefectPhoto(idx, id)}
							onremove={(id) => store.removeDefectPhoto(idx, id)}
						/>
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>