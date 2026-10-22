import { it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

it('waits for old tabs to close and keeps the shell matched to its cached chunks', async () => {
	const source = readFileSync('src/service-worker.ts', 'utf8').replace(
		"import { build, files, version } from '$service-worker';",
		'const build = ["/yanshuf/new.js"]; const files = []; const version = "new";'
	);
	const oldCache = 'yanshuf-/yanshuf/-old';
	const existing = new Set([oldCache]);
	const cached = new Response('matching cached release');
	const handlers: Record<string, (event: unknown) => void> = {};
	const skipWaiting = vi.fn();
	const claim = vi.fn();
	const network = vi.fn();
	runInNewContext(
		ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
		{
			URL,
			Response,
			fetch: network,
			self: {
				registration: { scope: 'https://example.test/yanshuf/' },
				location: { origin: 'https://example.test' },
				addEventListener: (type: string, handler: (event: unknown) => void) => {
					handlers[type] = handler;
				},
				skipWaiting,
				clients: { claim }
			},
			caches: {
				keys: async () => [...existing],
				delete: async (key: string) => existing.delete(key),
				open: async (key: string) => {
					existing.add(key);
					return {
						addAll: async () => {},
						match: async () => cached,
						put: async () => {}
					};
				}
			}
		}
	);
	let pending: Promise<unknown> | undefined;
	handlers.install({
		waitUntil: (promise: Promise<unknown>) => {
			pending = promise;
		}
	});
	await pending;
	expect(skipWaiting).not.toHaveBeenCalled();
	expect(claim).not.toHaveBeenCalled();
	expect(existing.has(oldCache)).toBe(true);
	handlers.fetch({
		request: { method: 'GET', url: 'https://example.test/yanshuf/', mode: 'navigate' },
		respondWith: (promise: Promise<unknown>) => {
			pending = promise;
		}
	});
	expect(await pending).toBe(cached);
	expect(network).not.toHaveBeenCalled();
	const intercept = vi.fn();
	handlers.fetch({
		request: { method: 'GET', url: 'https://example.test/api/yanshuf/reports' },
		respondWith: intercept
	});
	expect(intercept).not.toHaveBeenCalled();
	handlers.activate({
		waitUntil: (promise: Promise<unknown>) => {
			pending = promise;
		}
	});
	await pending;
	expect(existing.has(oldCache)).toBe(false);
	expect(claim).not.toHaveBeenCalled();
});
