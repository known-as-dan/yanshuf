<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let {
		message,
		type = 'error'
	}: {
		message: string | null;
		type?: 'success' | 'warning' | 'error';
	} = $props();
</script>

{#if message}
	<div
		class="fixed top-4 inset-x-0 z-50 mx-auto max-w-sm px-4"
		transition:fly={{ y: -20, duration: 250, easing: cubicOut }}
	>
		<div class="rounded-xl border px-4 py-2.5 text-center text-sm font-medium shadow-lg
			{type === 'error' ? 'border-danger/30 bg-danger/10 text-danger' :
			 type === 'warning' ? 'border-warn/30 bg-warn/10 text-warn' :
			 'border-ok/30 bg-ok/10 text-ok'}">
			{message}
		</div>
	</div>
{/if}
