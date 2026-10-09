# ינשוף (Yanshuf)

Hebrew, RTL solar-maintenance reports for field technicians. Reports and photos are saved locally, including when working without an account or a network connection.

The standalone site remains at [yanshuf.thewaypoint.net](https://yanshuf.thewaypoint.net). The same app can be hosted at `/yanshuf/` inside Mikumit, where existing Mikumit users sign in with the existing email OTP method and sync private reports and photos across devices.

## Field workflow

- DC readings belong to groups named for a box, area or test location. Inverters are optional metadata, never a prerequisite for recording readings.
- Points can have subpoints, editable field markings and a linked defect entry for a line that needs tracing. Changing inverter metadata preserves existing DC readings.
- Record panel count, open-circuit voltage, operating current and three insulation readings. Blank readings remain blank; zero remains zero.
- Desktop shows all columns; phones switch between electrical and insulation columns.
- Checklist, AC readings, inverter serials and defects use the periodic maintenance template.

## Accounts and backups

Guest reports use the original `yanshuf_*` localStorage keys and `yanshuf_photos` IndexedDB. Signed-in workspaces have separate per-account keys and photo databases. Signing out returns to the original guest workspace.

Cloud sync is available only inside Mikumit. It reuses `/api/auth` and its existing session cookie; the new `/api/yanshuf` APIs enforce the authenticated owner. A workspace header prevents a stale browser tab from syncing into a different signed-in account. Concurrent edits produce a local copy rather than overwrite unpushed work. Deletions use server tombstones.

Guest reports can be explicitly copied into an account, retaining their originals. The old standalone domain and Mikumit cannot share browser storage: export a ZIP backup on the old site and import it on Mikumit. ZIP backups include photos; old JSON backups can still be imported, with missing photos reported.

The Mikumit server stores photos through its existing private Drive media store. Images are served through an authenticated proxy, without public sharing links. No Drive credentials are shipped to the browser.

## Excel compatibility

`static/template.xlsx` is the Thermalite/Ormashify maintenance template, SHA-256 `239b41b342f1c1f363000c6c3d06886f647c2805c2acf1afbbbc997fb6bacf1d`.

ExcelJS fills the data, then the exporter overlays the edited cells onto the original XLSX package to retain logos, VML, relationships, printer settings, sheet order, headers and footers. DC uses all eight native columns, including panel count. Field-group names occupy the template's original first DC column. DC/fault rows retain native formatting without inferred pass/fail or repair status. Filenames include the system code, when provided, and `dd-mm-yyyy` date.

Automated package/layout checks do not replace a native Excel print review.

## Development

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm lint
pnpm test:unit --run
```

Browser tests use Playwright Chromium. `PLAYWRIGHT_CHANNEL=chrome` can use an installed Chrome instead.

```sh
pnpm build # standalone GitHub Pages output in docs/
YANSHUF_BASE_PATH=/yanshuf YANSHUF_OUTPUT_DIR=../map/static/yanshuf pnpm build
```

The Mikumit workspace owns the integrated deployment and builds this SPA before its Node server. It serves the generated shell through `/yanshuf/`, outside the map's login-required client layout. The Yanshuf service worker only caches its public shell/assets, never auth or report/photo APIs.

Stack: SvelteKit static SPA, Svelte 5, TypeScript, Tailwind CSS 4, ExcelJS and JSZip.
