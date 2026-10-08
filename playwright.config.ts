import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command:
			'YANSHUF_BASE_PATH= YANSHUF_OUTPUT_DIR=docs vite build && YANSHUF_BASE_PATH= vite preview --port 4173 --strictPort',
		port: 4173,
		reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
		gracefulShutdown: { signal: 'SIGTERM', timeout: 1000 }
	},
	testDir: 'e2e',
	use: {
		channel: process.env.PLAYWRIGHT_CHANNEL,
		locale: 'he-IL',
		baseURL: 'http://localhost:4173'
	}
});
