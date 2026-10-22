<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { dev, version } from '$app/environment';

	let { children } = $props();
	onMount(() => {
		if (!dev && 'serviceWorker' in navigator) {
			// A release-specific URL also bypasses previously cached workers at the CDN.
			void navigator.serviceWorker
				.register(`${base}/service-worker.js?release=${encodeURIComponent(version)}`, {
					scope: `${base}/`,
					updateViaCache: 'none'
				})
				.catch((error) => console.warn('Offline cache unavailable', error));
		}
	});
</script>

{@render children()}
