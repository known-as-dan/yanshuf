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

### Key directories

```
src/lib/models/       — TypeScript types (Inspection, ChecklistItem, etc.)
src/lib/config/       — Static template definitions (checklist sections, AC items)
src/lib/stores/       — Svelte 5 reactive store (.svelte.ts files)
src/lib/components/   — Step components (StepMeta, StepConfig, StepChecklist, StepDc, StepAc, StepDefects, StepSummary)
src/lib/mappers/      — Excel export (fills official template via downloadWorkbook)
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
- **Dynamic inverter/string counts**: system config screen defines inverter count and strings per inverter; DC measurements and serial lists are regenerated when config changes
- **Store pattern**: `createInspectionStore()` returns object with getters and mutation methods; all mutations call `save()` which writes to localStorage
- Component props use `store: ReturnType<typeof createInspectionStore>` typing
- `exceljs` for template-based Excel export — `downloadWorkbook()` fetches `static/template.xlsx`, fills cells preserving formatting

## Security

- No backend, no auth — purely client-side app
- All data stays in browser localStorage
- No sensitive data transmitted
