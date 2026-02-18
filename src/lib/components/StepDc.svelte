<script lang="ts">
	import { slide } from 'svelte/transition';
	import { haptic } from '$lib/utils/haptics.js';
	import type { createInspectionStore } from '$lib/stores/inspection.svelte.js';
	import { getOrderedDcTree } from '$lib/stores/inspection.svelte.js';

	let { store }: { store: ReturnType<typeof createInspectionStore> } = $props();

	type DcTab = 'voltage' | 'isolation';
	let activeTab = $state<DcTab>('voltage');

	let expandedInverters = $state<Record<number, boolean>>({});
	$effect(() => {
		for (const c of store.inspection.inverterConfigs) {
			if (!(c.index in expandedInverters)) {
				expandedInverters[c.index] = true;
			}
		}
	});

	function toggleInverter(index: number) {
		haptic('light');
		expandedInverters[index] = !expandedInverters[index];
	}

	function parseNum(val: string): number | undefined {
		const n = parseFloat(val);
		return isNaN(n) ? undefined : n;
	}

	function handleAddString(inverterIndex: number) {
		haptic('medium');
		store.addDcString(inverterIndex);
	}

	function handleAddChild(parentId: string) {
		haptic('medium');
		store.addDcSubstring(parentId);
	}

	function handleRemove(id: string) {
		haptic('warning');
		store.removeDcMeasurement(id);
	}

	function handleEnterNav(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const col = e.currentTarget.dataset.col;
		if (!col) return;
		const allInCol = Array.from(
			document.querySelectorAll<HTMLInputElement>(`input[data-col="${col}"]`)
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
		<h2 class="text-lg lg:text-xl font-bold text-white">מדידות DC</h2>
		<p class="text-sm lg:text-base text-gray-400">מתח, זרם ובידוד לכל מחרוזת</p>
	</div>

	<!-- Segmented tab control -->
	<div class="flex rounded-xl border border-border bg-surface-700 p-1">
		<button
			type="button"
			class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 lg:py-2.5 text-sm lg:text-base font-semibold transition-all
				{activeTab === 'voltage'
					? 'bg-warn text-surface-900 shadow-md shadow-warn/20'
					: 'text-gray-400 hover:text-gray-200 active:text-gray-200'}"
			onclick={() => { haptic('light'); activeTab = 'voltage'; }}
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
			</svg>
			מתח & זרם
		</button>
		<button
			type="button"
			class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 lg:py-2.5 text-sm lg:text-base font-semibold transition-all
				{activeTab === 'isolation'
					? 'bg-accent text-white shadow-md shadow-accent/20'
					: 'text-gray-400 hover:text-gray-200 active:text-gray-200'}"
			onclick={() => { haptic('light'); activeTab = 'isolation'; }}
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M10.513 4.856 13.12 2.17a.5.5 0 0 1 .86.46l-1.377 4.317" />
				<path d="M15.656 10H20a1 1 0 0 1 .78 1.63l-1.72 1.773" />
				<path d="M16.273 16.273 10.88 21.83a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14H4a1 1 0 0 1-.78-1.63l4.507-4.643" />
				<path d="m2 2 20 20" />
			</svg>
			בידוד
		</button>
	</div>

	{#each store.inspection.inverterConfigs as config (config.index)}
		<div class="overflow-hidden rounded-xl border border-border bg-surface-800">
			<!-- Inverter header -->
			<button
				type="button"
				class="flex w-full items-center justify-between p-3 lg:p-4 text-start transition-colors hover:bg-surface-700 active:bg-surface-700"
				onclick={() => toggleInverter(config.index)}
			>
				<div class="flex items-center gap-2.5">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-dim text-sm font-bold text-accent"
					>
						{config.index}
					</div>
					<span class="font-semibold text-white">{config.label}</span>
				</div>
				<div class="flex items-center gap-1 text-sm text-gray-500">
					<span>{config.stringCount} מחרוזות</span>
					<svg
						class="h-5 w-5 text-gray-400 transition-transform duration-200 {expandedInverters[config.index] ? 'rotate-180' : ''}"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
				</div>
			</button>

			{#if expandedInverters[config.index]}
				<div class="border-t border-border" transition:slide={{ duration: 300 }}>
					<div>
						<table class="w-full table-fixed text-sm">
							<colgroup>
								<col class="w-20" />
								<col />
								<col />
							</colgroup>
							<thead>
								<tr class="{activeTab === 'voltage' ? 'bg-warn-dim' : 'bg-surface-700'} text-xs text-gray-400">
									<th class="px-2 py-2.5 text-center font-medium">
										מחרוזת
									</th>
									{#if activeTab === 'voltage'}
										<th class="px-2 py-2.5 text-center font-medium text-warn">
											מתח<br /><span class="text-warn/60">(V)</span>
										</th>
										<th class="px-2 py-2.5 text-center font-medium text-warn">
											זרם<br /><span class="text-warn/60">(A)</span>
										</th>
									{:else}
										<th class="px-2 py-2.5 text-center font-medium text-accent">
											בידוד<br /><span class="text-accent/60">(MΩ)</span>
										</th>
										<th class="px-2 py-2.5 text-center font-medium text-accent">
											הזנה −<br /><span class="text-accent/60">(MΩ)</span>
										</th>
										<th class="px-2 py-2.5 text-center font-medium text-accent">
											הזנה +<br /><span class="text-accent/60">(MΩ)</span>
										</th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each getOrderedDcTree(store.inspection.dcMeasurements, config.index) as { measurement, depth } (measurement.id)}
										<tr
											class="border-t border-border/30 bg-surface-800"
										>
											<!-- Label column with tree controls -->
											<td class="px-2 py-1.5">
												<div
													class="flex items-center gap-1"
													style="margin-inline-start: {depth === 1 ? -8 : depth >= 2 ? 24 : 0}px"
												>
													<!-- Add child before label for substrings -->
													{#if depth > 0 && depth < 2}
														<button
															type="button"
															class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-gray-600 transition-colors hover:text-accent active:bg-surface-600"
															title="הוסף תת-מחרוזת"
															onclick={() => handleAddChild(measurement.id)}
														>
															<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
																<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
															</svg>
														</button>
													{/if}

													<!-- Label badge with X overlay -->
													<span
														class="relative inline-flex h-7 lg:h-8 min-w-7 lg:min-w-8 items-center justify-center rounded bg-surface-600 px-1.5 text-sm font-bold {depth > 0 ? 'text-gray-400' : 'text-gray-200'}"
													>
														{measurement.stringLabel}
														<button
															type="button"
															class="absolute -top-1.5 -start-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface-700 text-gray-500 transition-colors hover:bg-danger hover:text-white"
															title="מחק מחרוזת"
															onclick={() => handleRemove(measurement.id)}
														>
															<svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
																<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
															</svg>
														</button>
													</span>

													<!-- Add child after label for top-level -->
													{#if depth === 0}
														<button
															type="button"
															class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-gray-600 transition-colors hover:text-accent active:bg-surface-600"
															title="הוסף תת-מחרוזת"
															onclick={() => handleAddChild(measurement.id)}
														>
															<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
																<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
															</svg>
														</button>
													{/if}
												</div>
											</td>

											<!-- Measurement inputs (conditional on active tab) -->
											{#if activeTab === 'voltage'}
												<td class="px-1 py-1.5">
													<input
														type="number"
														inputmode="decimal"
														step="0.1"
														data-col="openCircuitVoltage"
														class="w-full border-none bg-surface-700 px-2 py-2 lg:py-2.5 text-center text-sm lg:text-base"
														value={measurement.openCircuitVoltage ?? ''}
														oninput={(e) =>
															store.updateDcMeasurement(measurement.id, {
																openCircuitVoltage: parseNum(e.currentTarget.value)
															})}
														onkeydown={handleEnterNav}
													/>
												</td>
												<td class="px-1 py-1.5">
													<input
														type="number"
														inputmode="decimal"
														step="0.01"
														data-col="operatingCurrent"
														class="w-full border-none bg-surface-700 px-2 py-2 lg:py-2.5 text-center text-sm lg:text-base"
														value={measurement.operatingCurrent ?? ''}
														oninput={(e) =>
															store.updateDcMeasurement(measurement.id, {
																operatingCurrent: parseNum(e.currentTarget.value)
															})}
														onkeydown={handleEnterNav}
													/>
												</td>
											{:else}
												<td class="px-1 py-1.5">
													<input
														type="number"
														inputmode="decimal"
														step="0.1"
														data-col="stringRiso"
														class="w-full border-none bg-surface-700 px-2 py-2 lg:py-2.5 text-center text-sm lg:text-base"
														value={measurement.stringRiso ?? ''}
														oninput={(e) =>
															store.updateDcMeasurement(measurement.id, {
																stringRiso: parseNum(e.currentTarget.value)
															})}
														onkeydown={handleEnterNav}
													/>
												</td>
												<td class="px-1 py-1.5">
													<input
														type="number"
														inputmode="decimal"
														step="0.1"
														data-col="feedRisoNegative"
														class="w-full border-none bg-surface-700 px-2 py-2 lg:py-2.5 text-center text-sm lg:text-base"
														value={measurement.feedRisoNegative ?? ''}
														oninput={(e) =>
															store.updateDcMeasurement(measurement.id, {
																feedRisoNegative: parseNum(e.currentTarget.value)
															})}
														onkeydown={handleEnterNav}
													/>
												</td>
												<td class="px-1 py-1.5">
													<input
														type="number"
														inputmode="decimal"
														step="0.1"
														data-col="feedRisoPositive"
														class="w-full border-none bg-surface-700 px-2 py-2 lg:py-2.5 text-center text-sm lg:text-base"
														value={measurement.feedRisoPositive ?? ''}
														oninput={(e) =>
															store.updateDcMeasurement(measurement.id, {
																feedRisoPositive: parseNum(e.currentTarget.value)
															})}
														onkeydown={handleEnterNav}
													/>
												</td>
											{/if}
										</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Add top-level string button -->
					<div class="border-t border-border/30 p-2">
						<button
							type="button"
							class="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm text-gray-500 transition-colors hover:bg-surface-700 hover:text-gray-300 active:bg-surface-700 active:text-gray-300"
							onclick={() => handleAddString(config.index)}
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
							</svg>
							<span>מחרוזת</span>
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/each}

	{#if store.inspection.inverterConfigs.length === 0}
		<div class="py-12 text-center">
			<div class="mb-2 text-4xl opacity-30">⚡</div>
			<p class="text-gray-400">יש להגדיר ממירים בשלב הגדרת מערכת</p>
		</div>
	{/if}
</div>
