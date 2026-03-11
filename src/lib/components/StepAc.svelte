<script lang="ts">
	import { slide } from 'svelte/transition';
	import { haptic } from '$lib/utils/haptics.js';
	import { acSections } from '$lib/config/ac.js';
	import type { createInspectionStore } from '$lib/stores/inspection.svelte.js';

	let { store }: { store: ReturnType<typeof createInspectionStore> } = $props();

	let expandedSections = $state<Record<number, boolean>>({});

	$effect(() => {
		acSections.forEach((_, i) => {
			if (!(i in expandedSections)) expandedSections[i] = true;
		});
	});

	function toggleSection(idx: number) {
		haptic('light');
		expandedSections[idx] = !expandedSections[idx];
	}

	function parseNum(val: string): number | undefined {
		const n = parseFloat(val);
		return isNaN(n) ? undefined : n;
	}

	function handleEnterNav(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const col = e.currentTarget.dataset.col;
		if (!col) return;
		const container = e.currentTarget.closest('.space-y-2');
		if (!container) return;
		const allInCol = Array.from(
			container.querySelectorAll<HTMLInputElement>(`input[data-col="${col}"]`)
		);
		const idx = allInCol.indexOf(e.currentTarget);
		if (idx >= 0 && idx < allInCol.length - 1) {
			allInCol[idx + 1].focus();
		} else {
			e.currentTarget.blur();
		}
	}
</script>

<div class="space-y-4">
	<div>
		<h2 class="text-lg lg:text-xl font-bold text-white">מדידות AC</h2>
		<p class="text-sm lg:text-base text-gray-400">ערכי מתח, זרם ובדיקות AC</p>
	</div>

	{#each acSections as section, sIdx (section.code)}
		<div class="overflow-hidden rounded-xl border border-border bg-surface-800">
			<button
				type="button"
				class="flex w-full items-center justify-between p-3 lg:p-4 text-start transition-colors hover:bg-surface-700 active:bg-surface-700"
				onclick={() => toggleSection(sIdx)}
			>
				<span class="font-semibold text-white">{section.title}</span>
				<svg class="h-5 w-5 text-gray-400 transition-transform duration-200 {expandedSections[sIdx] ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
			</button>

			{#if expandedSections[sIdx]}
				<div class="space-y-2 border-t border-border p-3" transition:slide={{ duration: 300 }}>
					{#each section.items as item (item.itemCode)}
						{@const measurement = store.inspection.acMeasurements.find(
							(m) => m.itemCode === item.itemCode
						)}
						{#if measurement}
							<div class="flex items-center gap-2 rounded-lg bg-surface-700/50 p-2">
								<span class="min-w-0 flex-1 text-sm lg:text-base text-gray-300"
									>{item.description}</span
								>
								<input
									type="number"
									inputmode="decimal"
									step="0.01"
									data-col="ac-result"
									placeholder="תוצאה"
								class="w-24 lg:w-32 border-none bg-surface-700 px-2.5 py-1.5 text-center text-sm"
									value={measurement.result ?? ''}
									oninput={(e) =>
										store.updateAcMeasurement(
											item.itemCode,
											parseNum(e.currentTarget.value)
										)}
									onkeydown={handleEnterNav}
								/>
								<input
									type="text"
									placeholder="הערות"
								class="w-28 lg:w-36 border-none bg-surface-700 px-2.5 py-1.5 text-center text-sm"
									value={measurement.notes ?? ''}
									oninput={(e) =>
										store.updateAcMeasurement(
											item.itemCode,
											undefined,
											e.currentTarget.value || undefined
										)}
								/>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>