<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { haptic } from '$lib/utils/haptics.js';
	import type { createInspectionStore } from '$lib/stores/inspection.svelte.js';

	let { store }: { store: ReturnType<typeof createInspectionStore> } = $props();

	function addInverter() {
		haptic('medium');
		store.setInverterConfigs(store.inspection.inverterConfigs.length + 1);
	}

	function removeInverter(index: number) {
		haptic('light');
		store.removeInverterConfig(index);
	}
</script>

<div class="space-y-4">
	<div class="space-y-1">
		<h2 class="text-lg lg:text-xl font-bold text-white">הגדרת מערכת</h2>
		<p class="text-sm lg:text-base text-gray-400">הוסף את הממירים באתר</p>
	</div>

	{#if store.inspection.inverterSerials.length > 0}
		<div class="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
			{#each store.inspection.inverterSerials as serial (serial.inverterIndex)}
				<div
					class="flex items-center gap-2 rounded-xl border border-border bg-surface-800 p-3"
					in:fly={{ y: 10, duration: 350, easing: cubicOut }}
				>
					<div
						class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-dim text-sm font-bold text-accent"
					>
						{serial.inverterIndex}
					</div>
					<span class="text-sm text-gray-300">ממיר {serial.inverterIndex}</span>
					<input
						type="text"
						placeholder="מספר סידורי"
						class="min-w-0 flex-1 border-none bg-surface-700 px-2.5 py-1.5 text-sm"
						value={serial.serialNumber ?? ''}
						oninput={(e) =>
							store.updateInverterSerial(
								serial.inverterIndex,
								e.currentTarget.value
							)}
					/>
					<button
						type="button"
						class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
						onclick={() => removeInverter(serial.inverterIndex)}
						aria-label="הסר ממיר {serial.inverterIndex}"
					>
						✕
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<button
		type="button"
		class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-600 bg-surface-800/50 px-4 py-3 text-sm text-gray-400 hover:border-accent hover:text-accent transition-colors"
		onclick={addInverter}
	>
		<span class="text-lg leading-none">+</span>
		<span>הוסף ממיר</span>
	</button>
</div>