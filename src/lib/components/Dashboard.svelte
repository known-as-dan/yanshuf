<script lang="ts">
	import { fly, slide, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { haptic } from '$lib/utils/haptics.js';
	import { downloadWorkbook } from '$lib/mappers/excel.js';
	import { checklistSections } from '$lib/config/checklist.js';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import {
		listReports,
		loadReport,
		saveReport,
		createNewReport,
		deleteReport,
		duplicateReport,
		loadFolders,
		saveFolders,
		migrateOldData,
		type ReportSummary
	} from '$lib/stores/reports.js';

	// Migrate old data on first run
	if (browser) {
		migrateOldData();
	}

	let reports = $state<ReportSummary[]>(listReports());
	let folders = $state<string[]>(loadFolders());
	let activeFolder = $state<string | null>(null);
	let showNewFolder = $state(false);
	let newFolderName = $state('');

	function refresh() {
		reports = listReports();
		folders = loadFolders();
	}

	let filteredReports = $derived(
		activeFolder ? reports.filter((r) => r.folder === activeFolder) : reports
	);

	function handleNew() {
		haptic('medium');
		const report = createNewReport(activeFolder || 'כללי');
		saveReport(report);
		goto(`/report/${report.id}`);
	}

	function handleOpen(id: string) {
		haptic('light');
		goto(`/report/${id}`);
	}

	function handleDelete(id: string) {
		if (confirm('למחוק דוח זה לצמיתות?')) {
			haptic('warning');
			deleteReport(id);
			refresh();
		}
	}

	function handleDuplicate(id: string) {
		haptic('light');
		duplicateReport(id);
		refresh();
	}

	let exportingId = $state<string | null>(null);

	async function handleExport(id: string) {
		if (exportingId) return;
		exportingId = id;
		haptic('medium');
		try {
			const report = loadReport(id);
			if (!report) return;
			const inspection = report.inspection;
			// Compute allDefects the same way the store does
			const autoDefects = inspection.checklist
				.filter((c) => c.status === 'לא תקין')
				.map((c) => {
					const parentCode = c.sectionCode.split('.')[0];
					const component = checklistSections.find((s) => s.code === parentCode)?.title ?? '';
					return {
						component,
						fault: c.description,
						location: `סעיף ${c.sectionCode}`,
						status: c.notes || ''
					};
				});
			const allDefects = [...autoDefects, ...inspection.defects];
			await downloadWorkbook(inspection, allDefects);
			haptic('success');
		} catch (err) {
			console.error('Export failed:', err);
			haptic('error');
		} finally {
			exportingId = null;
		}
	}

	function handleAddFolder() {
		const name = newFolderName.trim();
		if (name && !folders.includes(name)) {
			haptic('light');
			folders = [...folders, name];
			saveFolders(folders);
			newFolderName = '';
			showNewFolder = false;
		}
	}

	function handleDeleteFolder(folder: string) {
		const folderReports = reports.filter((r) => r.folder === folder);
		if (folderReports.length > 0) {
			if (!confirm(`תיקייה "${folder}" מכילה ${folderReports.length} דוחות. הדוחות יועברו לתיקיית \"כללי\". להמשיך?`)) return;
			for (const r of folderReports) {
				const full = loadReport(r.id);
				if (full) {
					full.folder = 'כללי';
					saveReport(full);
				}
			}
		} else {
			if (!confirm(`למחוק את תיקיית "${folder}"?`)) return;
		}
		folders = folders.filter((f) => f !== folder);
		saveFolders(folders);
		if (activeFolder === folder) activeFolder = null;
		refresh();
	}

	function formatDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString('he-IL', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return iso;
		}
	}

	// Unique folders from reports that might not be in the folders list
	let allFolders = $derived([...new Set([...folders, ...reports.map((r) => r.folder)])]);
</script>

<div class="mx-auto max-w-lg px-4 py-6">
	<!-- Header -->
	<div class="mb-8 flex flex-col items-center">
		<img src="/logo.svg" alt="ינשוף" class="mb-3 h-28 w-28" />
		<h1 class="mb-0.5 text-2xl font-bold text-white">ינשוף</h1>
		<p class="text-sm text-gray-500">בדיקות תקופתיות PV</p>
	</div>

	<!-- New Report Button -->
	<button
		type="button"
		class="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-accent/15 transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/25 active:scale-[0.98]"
		onclick={handleNew}
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
		</svg>
		בדיקה חדשה
	</button>

	<!-- Folders -->
	<div class="mb-4">
		<div class="mb-2 flex flex-wrap gap-1.5">
			<button
				type="button"
				class="rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors {activeFolder === null ? 'bg-accent text-white' : 'bg-surface-800 text-gray-400 hover:bg-surface-700 hover:text-gray-300 active:bg-surface-700'}"
				onclick={() => (activeFolder = null)}
			>
				הכל ({reports.length})
			</button>
			{#each allFolders as folder}
				{@const count = reports.filter((r) => r.folder === folder).length}
				{@const isActive = activeFolder === folder}
				{@const isDefault = folder === 'כללי'}
				<button
					type="button"
					class="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors {isActive ? 'bg-accent text-white' : 'bg-surface-800 text-gray-400 hover:bg-surface-700 hover:text-gray-300 active:bg-surface-700'}"
					onclick={() => (activeFolder = isActive ? null : folder)}
				>
					<svg class="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
					</svg>
					{folder} ({count})
					{#if isActive && !isDefault}
						<span
							role="button"
							tabindex="0"
							class="-me-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white/60 transition-colors hover:bg-white/20 hover:text-white"
							title="מחק תיקייה"
							onclick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
							onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleDeleteFolder(folder); } }}
						>
							&times;
						</span>
					{/if}
				</button>
			{/each}
			<button
				type="button"
				class="rounded-lg bg-surface-800 px-3.5 py-1.5 text-sm text-gray-500 transition-colors hover:bg-surface-700 hover:text-gray-400 active:bg-surface-700"
				onclick={() => (showNewFolder = !showNewFolder)}
			>
				+ תיקייה
			</button>
		</div>

		{#if showNewFolder}
			<div class="flex gap-2" transition:slide={{ duration: 300, easing: cubicOut }}>
				<input
					type="text"
					class="flex-1 rounded-lg border-border bg-surface-700 px-3 py-2 text-sm"
					placeholder="שם תיקייה..."
					bind:value={newFolderName}
					onkeydown={(e) => e.key === 'Enter' && handleAddFolder()}
				/>
				<button
					type="button"
					class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover active:bg-accent/80"
					onclick={handleAddFolder}
				>
					צור
				</button>
			</div>
		{/if}
	</div>

	<!-- Reports List -->
	{#if filteredReports.length === 0}
		<div class="py-16 text-center" in:fade={{ duration: 400 }}>
			<svg class="mx-auto mb-4 h-20 w-20 text-surface-500" viewBox="0 0 80 80" fill="none">
				<!-- Dashed clipboard outline -->
				<rect x="16" y="12" width="48" height="58" rx="6" stroke="currentColor" stroke-width="2" stroke-dasharray="5 3" opacity="0.5" />
				<!-- Clip -->
				<rect x="28" y="7" width="24" height="10" rx="3" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3" opacity="0.5" />
				<!-- Plus sign -->
				<line x1="40" y1="32" x2="40" y2="56" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.4" />
				<line x1="28" y1="44" x2="52" y2="44" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.4" />
			</svg>
			<p class="text-gray-400">
				{activeFolder ? 'אין דוחות בתיקייה זו' : 'אין דוחות עדיין'}
			</p>
			<p class="mt-1 text-sm text-gray-500">לחץ "בדיקה חדשה" להתחיל</p>
		</div>
	{:else}
		<div class="space-y-2.5">
			{#each filteredReports as report, i (report.id)}
				<div
					class="cursor-pointer rounded-xl border border-border/60 bg-surface-800 p-3.5 transition-all hover:border-border-light hover:bg-surface-700 active:border-border-light active:bg-surface-700"
					in:fly|global={{ y: 12, duration: 350, delay: Math.min(i * 50, 250), easing: cubicOut }}
					role="button"
					tabindex="0"
					onclick={() => handleOpen(report.id)}
					onkeydown={(e) => e.key === 'Enter' && handleOpen(report.id)}
				>
					<div class="mb-1.5 flex items-start justify-between">
						<div class="min-w-0 flex-1">
							<h3 class="truncate text-[15px] font-semibold text-white">{report.name}</h3>
							<p class="text-sm text-gray-500">
								{report.siteName || 'ללא שם אתר'} &middot; {report.inspectionDate}
							</p>
						</div>
						<div class="flex gap-0.5">
							<button
								type="button"
								class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-ok-dim hover:text-ok active:bg-ok-dim active:text-ok disabled:opacity-40"
								title="ייצוא לאקסל"
								disabled={exportingId === report.id}
								onclick={(e) => { e.stopPropagation(); handleExport(report.id); }}
							>
								{#if exportingId === report.id}
									<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
									</svg>
								{:else}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
								{/if}
							</button>
							<button
								type="button"
								class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-surface-600 hover:text-gray-300 active:bg-surface-600 active:text-gray-300"
								title="שכפל"
								onclick={(e) => { e.stopPropagation(); handleDuplicate(report.id); }}
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							</button>
							<button
								type="button"
								class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-danger-dim hover:text-danger active:bg-danger-dim active:text-danger"
								title="מחק"
								onclick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						</div>
					</div>
					<div class="flex items-center justify-between text-xs text-gray-500">
						<span class="flex items-center gap-1">
							<svg class="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
							</svg>
							{report.folder}
						</span>
						<span>עודכן {formatDate(report.updatedAt)}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
