# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**yanshuf (ינשוף)** — PV periodic inspection web app. Technicians fill out solar inspection forms on mobile, then export to Excel matching the official Hebrew template format. Purely client-side, no backend.

## Build and Development Commands

```bash
pnpm install          # install deps
pnpm run dev          # dev server (vite)
pnpm run build        # static build
pnpm run check        # svelte-check + TypeScript
pnpm run lint         # prettier + eslint
pnpm run format       # auto-format with prettier
pnpm run test:unit    # vitest (browser-mode with playwright)
pnpm run test:e2e     # playwright e2e
```

## Architecture

- **SvelteKit** static SPA (`@sveltejs/adapter-static`) with **Svelte 5** runes — no server, no SvelteKit routing beyond root
- **Tailwind CSS 4** via `@tailwindcss/vite` plugin + `@tailwindcss/forms` + `@tailwindcss/typography`
- **RTL** Hebrew UI — `<html lang="he" dir="rtl">` in `src/app.html`
- Single-page wizard flow: Dashboard → 7-step inspection → Excel export

### Key Directories

```
src/lib/models/       — TypeScript types (Inspection, ChecklistItem, etc.)
src/lib/config/       — Static template definitions (checklist sections, AC items) in Hebrew
src/lib/stores/       — Svelte 5 reactive stores (.svelte.ts for runes)
src/lib/components/   — Step components + Dashboard
src/lib/mappers/      — Excel export (fills official template via ExcelJS)
src/lib/utils/        — Utilities (haptics, etc.)
static/template.xlsx  — Official Excel template (source of truth for export)
```

### Data Flow

1. **Dashboard** (`Dashboard.svelte`) — report list with folders, create/delete/duplicate reports
2. **Store factory** — `createInspectionStore(report)` returns object with `$state`/`$derived` getters and mutation methods
3. **7 wizard steps**: StepMeta → StepConfig → StepChecklist → StepDc → StepAc → StepDefects → StepSummary
4. Every store mutation calls `save()` → persists to `localStorage`
5. **Excel export** — `downloadWorkbook()` fetches `static/template.xlsx`, fills cells preserving formatting, downloads result

### Storage Keys

- `yanshuf_reports_index` — report summaries list
- `yanshuf_report_${id}` — individual report data
- `yanshuf_folders` — folder list
- `yanshuf_inspector` — remembered inspector name

## Code Conventions

- **Svelte 5 runes only**: `$state`, `$derived`, `$effect`, `$props` — never use legacy `let`/`$:` stores
- **TypeScript strict mode**, `.svelte.ts` extension for files using runes outside components
- **Hebrew strings** for all user-facing text; config arrays must match the Excel template exactly
- **Tailwind utility classes** in markup; use logical properties for RTL where needed
- **Component props pattern**: `let { store } = $props()` with `store: ReturnType<typeof createInspectionStore>`
- **Excel template is source of truth**: sheet names, column headers, and fixed descriptions in `config/checklist.ts` and `config/ac.ts` must match the official Hebrew template
- **Dynamic inverter/string counts**: DC measurements and serial lists regenerate when inverter config changes
- **ExcelJS** for template-based export — only fill existing cells, never create cells programmatically; use `bakeTableStripes()` workaround to preserve alternating row colors

## Testing

- **Unit tests** run in browser mode via Vitest + Playwright (Chromium headless)
- Client-side test files: `*.svelte.{test,spec}.{js,ts}`
- Server-side test files: `*.{test,spec}.{js,ts}` (Node environment)
- Assertions are required (`expect.requireAssertions: true`)

## Svelte MCP Tools

Use the Svelte MCP server when working on Svelte components:

1. **list-sections** — call FIRST to discover available docs
2. **get-documentation** — fetch relevant sections based on use_cases
3. **svelte-autofixer** — MUST run on all Svelte code before finalizing; keep calling until no issues remain
4. **playground-link** — only after user confirmation, never if code was written to project files
