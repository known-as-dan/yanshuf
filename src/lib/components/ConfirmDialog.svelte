<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let {
		open = false,
		message,
		confirmLabel = 'אישור',
		cancelLabel = 'ביטול',
		danger = false,
		onconfirm,
		oncancel
	}: {
		open: boolean;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') oncancel();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label={message}
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
			<p class="mb-5 text-center text-[15px] leading-relaxed text-gray-200">{message}</p>
			<div class="flex gap-3">
				<button
					type="button"
					class="flex-1 rounded-xl border border-border bg-surface-700 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:bg-surface-600 active:bg-surface-600"
					onclick={oncancel}
				>
					{cancelLabel}
				</button>
				<button
					type="button"
					class="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors {danger
						? 'bg-danger hover:bg-red-500 active:bg-red-500'
						: 'bg-accent hover:bg-accent-hover active:bg-accent-hover'}"
					onclick={onconfirm}
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
