<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { loadPhoto, savePhoto, deletePhotos } from '$lib/stores/photos.js';
	import { resizePhoto } from '$lib/utils/photo.js';
	import { haptic } from '$lib/utils/haptics.js';

	let {
		photoIds = [],
		onadd,
		onremove,
		readonly = false,
		compact = false
	}: {
		photoIds: string[];
		onadd?: (id: string) => void;
		onremove?: (id: string) => void;
		readonly?: boolean;
		compact?: boolean;
	} = $props();

	let thumbnails = new SvelteMap<string, string>();
	let lightboxUrl = $state<string | null>(null);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	// Track which IDs we've already started loading
	let loadingIds = new SvelteSet<string>();

	$effect(() => {
		const ids = photoIds;
		// Load any new photos not yet in the thumbnail map
		for (const id of ids) {
			if (!thumbnails.has(id) && !loadingIds.has(id)) {
				loadingIds.add(id);
				loadPhoto(id).then((blob) => {
					if (blob) {
						thumbnails.set(id, URL.createObjectURL(blob));
					}
					loadingIds.delete(id);
				});
			}
		}
		// Revoke URLs for removed photos
		for (const [id, url] of thumbnails) {
			if (!ids.includes(id)) {
				URL.revokeObjectURL(url);
				thumbnails.delete(id);
			}
		}
	});

	async function handleFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		loading = true;
		try {
			const { id, blob } = await resizePhoto(file);
			await savePhoto(id, blob);
			thumbnails.set(id, URL.createObjectURL(blob));
			onadd?.(id);
			haptic('light');
		} catch (err) {
			console.error('Photo capture failed:', err);
			haptic('error');
			const isQuota = err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
			errorMessage = isQuota ? 'אין מספיק מקום באחסון' : 'שגיאה בשמירת התמונה';
			setTimeout(() => (errorMessage = null), 3500);
		} finally {
			loading = false;
			input.value = '';
		}
	}

	async function handleRemove(id: string) {
		haptic('warning');
		const url = thumbnails.get(id);
		if (url) URL.revokeObjectURL(url);
		thumbnails.delete(id);
		await deletePhotos([id]);
		onremove?.(id);
	}

	function openLightbox(id: string) {
		const url = thumbnails.get(id);
		if (url) lightboxUrl = url;
	}

	function closeLightbox() {
		lightboxUrl = null;
	}
</script>

{#if photoIds.length > 0 || !readonly}
	{#if compact && photoIds.length === 0 && !readonly}
		<label
			class="flex flex-shrink-0 cursor-pointer items-center justify-center px-2 text-gray-500 transition-colors hover:text-gray-200 active:text-gray-200 {loading ? 'opacity-50' : ''}"
		>
			{#if loading}
				<svg class="h-4 w-4 lg:h-5 lg:w-5 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
				</svg>
			{:else}
				<svg class="h-4 w-4 lg:h-5 lg:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
				</svg>
			{/if}
			<input
				type="file"
				accept="image/*"
				capture="environment"
				class="sr-only"
				onchange={handleFile}
				disabled={loading}
			/>
		</label>
	{:else}
		<div class="flex items-center gap-2 overflow-x-auto pt-2 pb-1 -mt-1 px-1 -mx-1">
			{#each photoIds as id (id)}
				{@const url = thumbnails.get(id)}
				{#if url}
					<div class="relative flex-shrink-0">
						<button
							type="button"
							class="block h-14 w-14 overflow-hidden rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent"
							onclick={() => openLightbox(id)}
						>
							<img src={url} alt="" class="h-full w-full object-cover" />
						</button>
						{#if !readonly}
							<button
								type="button"
								class="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white shadow-md"
								onclick={() => handleRemove(id)}
							>
								✕
							</button>
						{/if}
					</div>
				{/if}
			{/each}

			{#if !readonly}
				<label
					class="flex h-14 w-14 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface-700 text-gray-500 transition-colors hover:border-border-light hover:text-gray-300 active:border-border-light active:text-gray-300 {loading ? 'opacity-50' : ''}"
				>
					{#if loading}
						<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
						</svg>
					{:else}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
						</svg>
					{/if}
					<input
						type="file"
						accept="image/*"
						capture="environment"
						class="sr-only"
						onchange={handleFile}
						disabled={loading}
					/>
				</label>
			{/if}
		</div>
	{/if}
{/if}

{#if errorMessage}
	<div class="mt-1 rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">
		{errorMessage}
	</div>
{/if}

<!-- Lightbox -->
{#if lightboxUrl}
	<button
		type="button"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
		onclick={closeLightbox}
	>
		<img src={lightboxUrl} alt="" class="max-h-full max-w-full rounded-lg object-contain" />
	</button>
{/if}
