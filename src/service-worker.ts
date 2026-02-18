/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `app-${version}`;
const FONT_CACHE = 'fonts-v1';

/** All app assets (JS/CSS bundles + static files like favicon, template.xlsx) */
const ASSETS = new Set([...build, ...files]);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll([...ASSETS]))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				// Keep the font cache across versions
				if (key !== CACHE_NAME && key !== FONT_CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	const isFont =
		url.origin === 'https://fonts.googleapis.com' ||
		url.origin === 'https://fonts.gstatic.com';

	// Skip cross-origin requests except Google Fonts
	if (url.origin !== sw.location.origin && !isFont) return;

	event.respondWith(
		(async () => {
			// Google Fonts: cache-first (font files are immutable, CSS rarely changes)
			if (isFont) {
				const fontCache = await caches.open(FONT_CACHE);
				const cached = await fontCache.match(event.request);
				if (cached) return cached;

				try {
					const response = await fetch(event.request);
					if (response.ok) {
						fontCache.put(event.request, response.clone());
					}
					return response;
				} catch {
					return new Response('', { status: 503 });
				}
			}

			const cache = await caches.open(CACHE_NAME);

			// Precached assets — cache-first (hashed filenames guarantee freshness)
			if (ASSETS.has(url.pathname)) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
			}

			try {
				const response = await fetch(event.request);
				if (response.ok && response.status === 200) {
					cache.put(event.request, response.clone());
				}
				return response;
			} catch {
				// Offline fallback
				const cached = await cache.match(event.request);
				if (cached) return cached;

				// Serve app shell for navigation requests
				if (event.request.mode === 'navigate') {
					const shell = await cache.match('/');
					if (shell) return shell;
				}

				return new Response('Offline', { status: 503 });
			}
		})()
	);
});
