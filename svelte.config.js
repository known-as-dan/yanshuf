import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const output = process.env.YANSHUF_OUTPUT_DIR ?? 'docs';
const config = {
	kit: {
		paths: { base: process.env.YANSHUF_BASE_PATH ?? '', relative: false },
		adapter: adapter({ pages: output, assets: output, fallback: 'index.html' })
	}
};

export default config;
