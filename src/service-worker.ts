/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const scope = new URL(sw.registration.scope).pathname;
const prefix = `yanshuf-${scope}-`;
const cacheName = `${prefix}${version}`;
// Deployment metadata is not served by every static host (notably dotfiles).
// A 404 in cache.addAll would otherwise prevent the entire offline shell installing.
const assets = new Set(
	[...build, ...files].filter(
		(path) =>
			!path.split('/').some((part) => part.startsWith('.')) &&
			!path.endsWith('/CNAME') &&
			!path.endsWith('/robots.txt')
	)
);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(cacheName);
			await cache.addAll([...assets, scope]);
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== sw.location.origin || url.pathname.startsWith('/api/')) return;
	const navigation =
		event.request.mode === 'navigate' &&
		(url.pathname === scope.replace(/\/$/, '') || url.pathname.startsWith(scope));
	// Cache only the public shell and assets. Private API responses stay out.
	if (!navigation && !assets.has(url.pathname)) return;
	event.respondWith(
		(async () => {
			const cache = await caches.open(cacheName);
			if (!navigation) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
			}
			try {
				const response = await fetch(event.request);
				if (response.ok) await cache.put(navigation ? scope : event.request, response.clone());
				return response;
			} catch {
				return (
					(await cache.match(navigation ? scope : event.request)) ??
					new Response('Offline', { status: 503 })
				);
			}
		})()
	);
});
