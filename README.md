# ינשוף (yanshuf)

Solar panel inspection forms — but make it fun. 🦉

A mobile-first web app for PV technicians doing periodic solar inspections. Fill out your checklist on-site, tap export, and get a pixel-perfect Excel file matching the official Hebrew template. No backend, no accounts, no nonsense — everything runs in your browser.

**Live at [yanshuf.thewaypoint.net](https://yanshuf.thewaypoint.net)**

## What it does

- 7-step wizard walks you through the full inspection flow
- Organize reports into folders, duplicate old ones as templates
- Exports to the official `.xlsx` format — formatting, colors, and all
- Works offline as a PWA — because rooftops don't have great Wi-Fi
- Fully RTL Hebrew UI

## Dev setup

```bash
pnpm install
pnpm run dev
```

## Build & deploy

```bash
pnpm run build    # static output in docs/
```

The site is deployed via GitHub Pages from the `docs/` folder.

## Stack

SvelteKit (static SPA) · Svelte 5 · Tailwind CSS 4 · ExcelJS · Vitest + Playwright
