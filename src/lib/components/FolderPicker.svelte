<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { Folder } from '$lib/stores/reports.js';

	let {
		open = false,
		folders,
		currentFolder,
		onselect,
		oncancel
	}: {
		open: boolean;
		folders: Folder[];
		currentFolder: string;
		onselect: (folderName: string) => void;
		oncancel: () => void;
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') oncancel();
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="העבר לתיקייה"
		onkeydown={handleKeydown}
	>
		<button
			type="button"
			class="absolute inset-0 bg-black/70"
			tabindex="-1"
			onclick={oncancel}
			transition:fade={{ duration: 150 }}
		>
			<span class="sr-only">סגור</span>
		</button>
		<div
			class="relative w-full max-w-sm rounded-2xl border border-border-light bg-surface-800 p-5 shadow-2xl"
			transition:fly={{ y: 16, duration: 200, easing: cubicOut }}
		>
			<p class="mb-4 text-center text-[15px] font-semibold text-gray-200">העבר לתיקייה</p>
			<div class="flex flex-col gap-2">
				{#each folders as folder (folder.name)}
					{@const isCurrent = folder.name === currentFolder}
					<button
						type="button"
						class="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors {isCurrent
							? 'cursor-default bg-surface-600 text-gray-400'
							: 'bg-surface-700 text-gray-200 hover:bg-surface-600 active:bg-surface-600'}"
						disabled={isCurrent}
						onclick={() => onselect(folder.name)}
					>
						<span class="h-3 w-3 shrink-0 rounded-full" style="background-color: {folder.color}"
						></span>
						{folder.name}
						{#if isCurrent}
							<svg
								class="ms-auto h-4 w-4 text-accent"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						{/if}
					</button>
				{/each}
			</div>
			<button
				type="button"
				class="mt-4 w-full rounded-xl border border-border bg-surface-700 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:bg-surface-600 active:bg-surface-600"
				onclick={oncancel}
			>
				ביטול
			</button>
		</div>
	</div>
{/if}
