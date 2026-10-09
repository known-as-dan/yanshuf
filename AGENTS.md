# Project Guidelines — yanshuf

PV periodic inspection web app. Technicians fill out inspection forms on mobile, then export to Excel matching the official template format.

## Available MCP Tools

Use the Svelte MCP server (`list-sections`, `get-documentation`, `svelte-autofixer`, `playground-link`) when working on Svelte components. Always run `svelte-autofixer` before finalizing Svelte code.

## Architecture

- **SvelteKit** static SPA (`@sveltejs/adapter-static`) with **Svelte 5** runes
- **Tailwind CSS 4** via `@tailwindcss/vite` plugin + `@tailwindcss/forms` + `@tailwindcss/typography`
- **RTL** Hebrew UI — `<html lang="he" dir="rtl">` in `src/app.html`
- Single-page wizard flow on `+page.svelte`, no SvelteKit routing beyond the root
- State managed via a reactive store factory (`createInspectionStore`) using `$state`/`$derived`
- All inspection data persisted to `localStorage` automatically on mutation
- Guest and signed-in account workspaces have separate storage. The Mikumit-hosted build reuses existing email OTP/session endpoints and private `/api/yanshuf` APIs.

### Key directories

```
src/lib/models/       — TypeScript types (Inspection, ChecklistItem, etc.)
src/lib/config/       — Static template definitions (checklist sections, AC items)
src/lib/stores/       — Svelte 5 reactive store (.svelte.ts files)
src/lib/components/   — Step components (StepMeta, StepConfig, StepChecklist, StepDc, StepAc, StepDefects, StepSummary)
src/lib/mappers/      — Excel export (fills official template via downloadWorkbook)
src/lib/services/     — Cloud sync and portable report/photo backups
```

## Code Style

- Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props` — no legacy `let`/`$:` stores
- TypeScript strict mode, `.svelte.ts` extension for files with runes outside components
- Tailwind utility classes directly in markup; RTL-aware (use logical properties where needed)
- Hebrew strings for all user-facing text; keep config arrays in Hebrew matching the Excel template

## Build and Test

```bash
pnpm install          # install deps
pnpm run dev          # dev server (vite)
pnpm run build        # static build
pnpm run check        # svelte-check + TypeScript
pnpm run lint         # prettier + eslint
pnpm run test:unit    # vitest (browser-mode with playwright)
pnpm run test:e2e     # playwright e2e
```

## Project Conventions

- **Excel template is source of truth**: sheet names, column headers, and fixed descriptions in `config/checklist.ts` and `config/ac.ts` must match the official Hebrew template exactly
- **Field-based DC**: groups represent boxes, areas or test locations. Inverter configuration is optional; changing it must never delete or regenerate existing DC measurements. Preserve legacy row IDs, values and photo references when migrating old reports.
- **Store pattern**: `createInspectionStore()` returns object with getters and mutation methods; all mutations call `save()` which writes to localStorage
- Component props use `store: ReturnType<typeof createInspectionStore>` typing
- `exceljs` fills template data; the native-package overlay preserves original print assets and relationships. Keep the exact Thermalite template, all eight DC columns, native DC/fault formatting and blank-versus-zero values. Do not infer pass/fail or repair status.

## Security

- Standalone deployment is guest-only. `/yanshuf/` inside Mikumit adds optional account sync through the existing email OTP/session cookie.
- Preserve the original guest localStorage keys and IndexedDB schema. Add per-account namespaces rather than rename old storage.
- Private report/photo APIs require a server-verified session owner. The account header only prevents a stale workspace from using a different session; it is never authorization.
- Never cache auth, report or image APIs in a service worker, expose Drive credentials, or make image files publicly shared.
- ZIP backups include only the current workspace and photos, never account sessions or sync metadata.
