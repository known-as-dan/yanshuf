<script lang="ts">
	import { fly, slide, fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { haptic } from '$lib/utils/haptics.js';
	import { downloadWorkbook } from '$lib/mappers/excel.js';
	import { computeAutoDefects } from '$lib/stores/inspection.svelte.js';
	import { browser } from '$app/environment';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import FolderPicker from './FolderPicker.svelte';
	import {
		listReports,
		loadReport,
		saveReport,
		createNewReport,
		deleteReport,
		duplicateReport,
		loadFolders,
		saveFolders,
		renameFolder,
		moveReport,
		updateFolderColor,
		getFolderColor,
		migrateOldData,
		FOLDER_PALETTE,
		type ReportSummary,
		type Folder
	} from '$lib/stores/reports.js';

	let { onopen }: { onopen: (id: string) => void } = $props();

	// Migrate old data on first run
	if (browser) {
		migrateOldData();
	}

	let reports = $state<ReportSummary[]>(listReports());
	let folders = $state<Folder[]>(loadFolders());
	let activeFolder = $state<string | null>(null);
	let searchQuery = $state('');
	let showNewFolder = $state(false);
	let newFolderName = $state('');

	// Rename state
	let renamingFolder = $state<string | null>(null);
	let renameFolderName = $state('');

	// Move report state
	let movingReportId = $state<string | null>(null);

	// Color picker state
	let colorPickerFolder = $state<string | null>(null);

	// Folder menu state
	let folderMenuOpen = $state<string | null>(null);

	function refresh() {
		reports = listReports();
		folders = loadFolders();
	}

	let filteredReports = $derived.by(() => {
		let result = activeFolder ? reports.filter((r) => r.folder === activeFolder) : reports;
		const q = searchQuery.trim().toLowerCase();
		if (q) {
			result = result.filter(
				(r) =>
					r.name.toLowerCase().includes(q) ||
					r.siteName.toLowerCase().includes(q) ||
					r.siteGroup.toLowerCase().includes(q) ||
					r.inspectorName.toLowerCase().includes(q) ||
					r.inspectionDate.includes(q)
			);
		}
		return result;
	});

	function handleNew() {
		haptic('medium');
		const report = createNewReport(activeFolder || folders[0]?.name || 'כללי');
		saveReport(report);
		refresh();
	}

	function handleOpen(id: string) {
		haptic('light');
		onopen(id);
	}

	let confirmState = $state<{
		message: string;
		action: () => void;
		danger?: boolean;
		confirmLabel?: string;
	} | null>(null);

	function handleDelete(id: string) {
		confirmState = {
			message: 'למחוק דוח זה לצמיתות?',
			danger: true,
			async action() {
				haptic('warning');
				await deleteReport(id);
				refresh();
			}
		};
	}

	function handleDuplicate(id: string) {
		haptic('light');
		duplicateReport(id);
		refresh();
	}

	let exportingId = $state<string | null>(null);
	let exportToast = $state<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

	async function handleExport(id: string) {
		if (exportingId) return;
		exportingId = id;
		exportToast = null;
		haptic('medium');
		try {
			const report = loadReport(id);
			if (!report) return;
			const inspection = report.inspection;
			const allDefects = [...computeAutoDefects(inspection.checklist), ...inspection.defects];
			const result = await downloadWorkbook(inspection, allDefects);
			if (result.warnings.length > 0) {
				exportToast = {
					message: `יוצא עם ${result.warnings.length} אזהרות`,
					type: 'warning'
				};
			} else {
				exportToast = { message: 'יוצא בהצלחה', type: 'success' };
			}
			haptic('success');
			setTimeout(() => {
				exportToast = null;
			}, 3000);
		} catch (err) {
			console.error('Export failed:', err);
			exportToast = { message: 'שגיאה בייצוא', type: 'error' };
			haptic('error');
			setTimeout(() => {
				exportToast = null;
			}, 3000);
		} finally {
			exportingId = null;
		}
	}

	function handleAddFolder() {
		const name = newFolderName.trim();
		if (name && !folders.some((f) => f.name === name)) {
			haptic('light');
			const color = FOLDER_PALETTE[folders.length % FOLDER_PALETTE.length];
			folders = [...folders, { name, color }];
			saveFolders(folders);
			newFolderName = '';
			showNewFolder = false;
		}
	}

	function handleDeleteFolder(folderName: string) {
		const folderReports = reports.filter((r) => r.folder === folderName);
		const fallback = folders.find((f) => f.name !== folderName)?.name ?? 'כללי';
		const message =
			folderReports.length > 0
				? `תיקייה "${folderName}" מכילה ${folderReports.length} דוחות. הדוחות יועברו לתיקיית "${fallback}". להמשיך?`
				: `למחוק את תיקיית "${folderName}"?`;
		confirmState = {
			message,
			danger: true,
			action() {
				if (folderReports.length > 0) {
					for (const r of folderReports) {
						const full = loadReport(r.id);
						if (full) {
							full.folder = fallback;
							saveReport(full);
						}
					}
				}
				folders = folders.filter((f) => f.name !== folderName);
				saveFolders(folders);
				if (activeFolder === folderName) activeFolder = null;
				refresh();
			}
		};
	}

	function handleRenameFolder() {
		if (!renamingFolder) return;
		const success = renameFolder(renamingFolder, renameFolderName);
		if (success) {
			haptic('light');
			if (activeFolder === renamingFolder) activeFolder = renameFolderName.trim();
			renamingFolder = null;
			renameFolderName = '';
			refresh();
		}
	}

	function handleMoveReport(targetFolder: string) {
		if (!movingReportId) return;
		moveReport(movingReportId, targetFolder);
		haptic('light');
		movingReportId = null;
		refresh();
	}

	function handleColorChange(folderName: string, color: string) {
		updateFolderColor(folderName, color);
		haptic('light');
		colorPickerFolder = null;
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

	// Merge folder objects with orphan folder names from reports
	let allFolders = $derived.by(() => {
		const map = new Map(folders.map((f) => [f.name, f]));
		for (const r of reports) {
			if (!map.has(r.folder)) {
				map.set(r.folder, { name: r.folder, color: FOLDER_PALETTE[0] });
			}
		}
		return [...map.values()];
	});

	function exportRawData() {
		const dump: Record<string, unknown> = {};
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)!;
			if (key.startsWith('yanshuf_')) {
				try {
					dump[key] = JSON.parse(localStorage.getItem(key)!);
				} catch {
					dump[key] = localStorage.getItem(key);
				}
			}
		}
		const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `yanshuf-backup-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleWindowClick() {
		if (folderMenuOpen) folderMenuOpen = null;
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div class="mx-auto max-w-lg px-4 pt-6 pb-24 lg:max-w-3xl lg:px-8">
	<!-- Header -->
	<div class="mb-4 flex items-center gap-3">
		<img src="/logo.png" alt="ינשוף" class="h-14 w-14" />
		<div>
			<h1 class="text-3xl font-bold text-white lg:text-4xl">ינשוף</h1>
			<p class="text-sm text-gray-500 lg:text-base">בדיקות תקופתיות PV</p>
		</div>
		<div class="ms-auto">
			<button
				type="button"
				title="ייצוא גיבוי נתונים"
				onclick={exportRawData}
				class="rounded-lg p-2 text-gray-600 transition-colors hover:bg-surface-700 hover:text-gray-400 active:bg-surface-700"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
					/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Folders -->
	<div class="mb-4">
		<div class="mb-2 flex flex-wrap gap-1.5">
			<button
				type="button"
				class="rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors lg:px-4 lg:py-2 lg:text-base {activeFolder ===
				null
					? 'bg-accent text-white'
					: 'bg-surface-800 text-gray-400 hover:bg-surface-700 hover:text-gray-300 active:bg-surface-700'}"
				onclick={() => {
					activeFolder = null;
					colorPickerFolder = null;
				}}
			>
				הכל ({reports.length})
			</button>
			{#each allFolders as folder (folder.name)}
				{@const count = reports.filter((r) => r.folder === folder.name).length}
				{@const isActive = activeFolder === folder.name}
				{@const isRenaming = renamingFolder === folder.name}
				{#if isRenaming}
					<div
						class="inline-flex items-center rounded-lg bg-surface-700 ring-1 ring-accent/50"
						transition:fly={{ x: -8, duration: 200, easing: cubicOut }}
					>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							autofocus
							class="w-28 border-none bg-transparent px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:ring-0"
							placeholder="שם חדש..."
							bind:value={renameFolderName}
							onkeydown={(e) => {
								if (e.key === 'Enter') handleRenameFolder();
								if (e.key === 'Escape') {
									renamingFolder = null;
									renameFolderName = '';
								}
							}}
							onblur={() => {
								if (renameFolderName.trim() && renameFolderName.trim() !== renamingFolder) {
									handleRenameFolder();
								} else {
									renamingFolder = null;
									renameFolderName = '';
								}
							}}
						/>
					</div>
				{:else}
					<div class="relative">
						<button
							type="button"
							class="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors lg:px-4 lg:py-2 lg:text-base {isActive
								? 'text-white'
								: 'text-gray-300 hover:brightness-125 active:brightness-125'}"
							style="background-color: {isActive ? folder.color : folder.color + '40'}"
							onclick={() => {
								activeFolder = isActive ? null : folder.name;
								colorPickerFolder = null;
								folderMenuOpen = null;
							}}
						>
							{folder.name} ({count})
							{#if isActive}
								<span
									role="button"
									tabindex="0"
									class="-me-1 flex h-5 w-5 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/20 hover:text-white"
									aria-label="אפשרויות תיקייה"
									onclick={(e) => {
										e.stopPropagation();
										folderMenuOpen = folderMenuOpen === folder.name ? null : folder.name;
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											e.stopPropagation();
											folderMenuOpen = folderMenuOpen === folder.name ? null : folder.name;
										}
									}}
								>
									<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
										<path
											d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z"
										/>
									</svg>
								</span>
							{/if}
						</button>
						<!-- Folder dropdown menu -->
						{#if folderMenuOpen === folder.name}
							<div
								class="absolute end-0 top-full z-30 mt-1 w-40 rounded-xl border border-border-light bg-surface-800 py-1 shadow-xl"
								transition:fly={{ y: -4, duration: 150, easing: cubicOut }}
							>
								<button
									type="button"
									class="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-gray-300 transition-colors hover:bg-surface-700 active:bg-surface-700"
									onclick={() => {
										folderMenuOpen = null;
										renamingFolder = folder.name;
										renameFolderName = folder.name;
									}}
								>
									<svg
										class="h-3.5 w-3.5 opacity-60"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
										/>
									</svg>
									שנה שם
								</button>
								<button
									type="button"
									class="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-gray-300 transition-colors hover:bg-surface-700 active:bg-surface-700"
									onclick={() => {
										folderMenuOpen = null;
										colorPickerFolder = colorPickerFolder === folder.name ? null : folder.name;
									}}
								>
									<svg
										class="h-3.5 w-3.5 opacity-60"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a6 6 0 00-6-6h-2"
										/>
									</svg>
									שנה צבע
								</button>
								{#if allFolders.length > 1}
									<div class="mx-3 my-1 border-t border-border"></div>
									<button
										type="button"
										class="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-danger transition-colors hover:bg-danger-dim active:bg-danger-dim"
										onclick={() => {
											folderMenuOpen = null;
											handleDeleteFolder(folder.name);
										}}
									>
										<svg
											class="h-3.5 w-3.5 opacity-60"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
										מחק תיקייה
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
			{#if showNewFolder}
				<div
					class="inline-flex items-center rounded-lg bg-surface-700 ring-1 ring-accent/50"
					transition:fly={{ x: -8, duration: 200, easing: cubicOut }}
				>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						autofocus
						class="w-24 border-none bg-transparent px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:ring-0"
						placeholder="שם תיקייה..."
						bind:value={newFolderName}
						onkeydown={(e) => {
							if (e.key === 'Enter') handleAddFolder();
							if (e.key === 'Escape') {
								showNewFolder = false;
								newFolderName = '';
							}
						}}
						onblur={() => {
							if (!newFolderName.trim()) {
								showNewFolder = false;
								newFolderName = '';
							}
						}}
					/>
				</div>
			{:else}
				<button
					type="button"
					class="rounded-lg px-3.5 py-1.5 text-sm text-gray-500 transition-colors hover:bg-surface-700 hover:text-gray-400 active:bg-surface-700 lg:px-4 lg:py-2 lg:text-base"
					onclick={() => (showNewFolder = true)}
				>
					+ תיקייה
				</button>
			{/if}
		</div>

		<!-- Color picker row -->
		{#if colorPickerFolder}
			{@const currentColor = getFolderColor(colorPickerFolder, allFolders)}
			<div
				class="flex flex-wrap gap-2 rounded-lg bg-surface-800 px-3 py-2"
				transition:slide={{ duration: 200, easing: cubicOut }}
			>
				{#each FOLDER_PALETTE as color (color)}
					<button
						type="button"
						class="h-6 w-6 rounded-full transition-transform hover:scale-110 {color === currentColor
							? 'ring-2 ring-white ring-offset-2 ring-offset-surface-800'
							: ''}"
						style="background-color: {color}"
						aria-label="בחר צבע"
						onclick={() => colorPickerFolder && handleColorChange(colorPickerFolder, color)}
					></button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Search -->
	{#if reports.length > 0}
		<div class="relative mb-4">
			<svg
				class="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
				/>
			</svg>
			<input
				type="text"
				class="block w-full rounded-xl border border-border bg-surface-800 py-2 ps-9 pe-9 text-sm text-white placeholder-gray-500 focus:border-accent focus:ring-1 focus:ring-accent"
				placeholder="חיפוש דוחות..."
				value={searchQuery}
				oninput={(e) => (searchQuery = (e.currentTarget as HTMLInputElement).value)}
			/>
			{#if searchQuery}
				<button
					type="button"
					class="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-500 transition-colors hover:text-gray-300 active:text-gray-300"
					aria-label="נקה חיפוש"
					onclick={() => (searchQuery = '')}
				>
					<svg
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
	{/if}

	<!-- Reports List -->
	{#if filteredReports.length === 0}
		<div class="py-16 text-center" in:fade={{ duration: 400 }}>
			<svg class="mx-auto mb-4 h-20 w-20 text-surface-500" viewBox="0 0 80 80" fill="none">
				<!-- Dashed clipboard outline -->
				<rect
					x="16"
					y="12"
					width="48"
					height="58"
					rx="6"
					stroke="currentColor"
					stroke-width="2"
					stroke-dasharray="5 3"
					opacity="0.5"
				/>
				<!-- Clip -->
				<rect
					x="28"
					y="7"
					width="24"
					height="10"
					rx="3"
					stroke="currentColor"
					stroke-width="2"
					stroke-dasharray="4 3"
					opacity="0.5"
				/>
				<!-- Plus sign -->
				<line
					x1="40"
					y1="32"
					x2="40"
					y2="56"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					opacity="0.4"
				/>
				<line
					x1="28"
					y1="44"
					x2="52"
					y2="44"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					opacity="0.4"
				/>
			</svg>
			<p class="text-gray-400">
				{searchQuery
					? 'לא נמצאו תוצאות'
					: activeFolder
						? 'אין דוחות בתיקייה זו'
						: 'אין דוחות עדיין'}
			</p>
			<p class="mt-1 text-sm text-gray-500">
				{searchQuery ? 'נסה חיפוש אחר' : 'לחץ "בדיקה חדשה" להתחיל'}
			</p>
		</div>
	{:else}
		<div class="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
			{#each filteredReports as report, i (report.id)}
				<div
					class="cursor-pointer rounded-xl border border-border/60 bg-surface-800 p-3.5 transition-all hover:border-border-light hover:bg-surface-700 active:border-border-light active:bg-surface-700"
					in:fly={{
						y: 12,
						duration: 350,
						delay: Math.min(i * 50, 250),
						easing: cubicOut
					}}
					out:slide={{ duration: 300, easing: cubicOut }}
					animate:flip={{ duration: 300, easing: cubicOut }}
					role="button"
					tabindex="0"
					aria-label="פתח דוח: {report.name}"
					onclick={() => handleOpen(report.id)}
					onkeydown={(e) => e.key === 'Enter' && handleOpen(report.id)}
				>
					<div class="mb-1.5 flex items-start justify-between">
						<div class="min-w-0 flex-1">
							<h3 class="truncate text-[15px] font-semibold text-white">
								{report.name}
							</h3>
							<p class="text-sm text-gray-500">{report.inspectionDate}</p>
						</div>
						<div class="flex gap-0.5">
							<button
								type="button"
								class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-ok-dim hover:text-ok active:bg-ok-dim active:text-ok disabled:opacity-40 lg:p-2.5"
								aria-label="ייצוא לאקסל"
								disabled={exportingId === report.id}
								onclick={(e) => {
									e.stopPropagation();
									handleExport(report.id);
								}}
							>
								{#if exportingId === report.id}
									<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle
											class="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											stroke-width="4"
										></circle>
										<path
											class="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
										></path>
									</svg>
								{:else}
									<svg
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										/>
									</svg>
								{/if}
							</button>
							<!-- Move to folder -->
							<button
								type="button"
								class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-accent-dim hover:text-accent active:bg-accent-dim active:text-accent lg:p-2.5"
								aria-label="העבר לתיקייה"
								onclick={(e) => {
									e.stopPropagation();
									movingReportId = report.id;
								}}
							>
								<svg
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 11v6m0 0l-2-2m2 2l2-2"
									/>
								</svg>
							</button>
							<button
								type="button"
								class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-surface-600 hover:text-gray-300 active:bg-surface-600 active:text-gray-300 lg:p-2.5"
								aria-label="שכפל דוח"
								onclick={(e) => {
									e.stopPropagation();
									handleDuplicate(report.id);
								}}
							>
								<svg
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							</button>
							<button
								type="button"
								class="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-danger-dim hover:text-danger active:bg-danger-dim active:text-danger lg:p-2.5"
								aria-label="מחק דוח"
								onclick={(e) => {
									e.stopPropagation();
									handleDelete(report.id);
								}}
							>
								<svg
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</div>
					<div class="flex items-center justify-between text-xs text-gray-500">
						<span class="flex items-center gap-1">
							<span
								class="h-2 w-2 rounded-full"
								style="background-color: {getFolderColor(report.folder, allFolders)}"
							></span>
							{report.folder}
						</span>
						<span>עודכן {formatDate(report.updatedAt)}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Export toast -->
	{#if exportToast}
		<div
			class="fixed inset-x-0 top-4 z-20 mx-auto max-w-sm px-4"
			transition:fly={{ y: -20, duration: 250, easing: cubicOut }}
		>
			<div
				class="rounded-xl border px-4 py-2.5 text-center text-sm font-medium shadow-lg
				{exportToast.type === 'error'
					? 'border-danger/30 bg-danger/10 text-danger'
					: exportToast.type === 'warning'
						? 'border-warn/30 bg-warn/10 text-warn'
						: 'border-ok/30 bg-ok/10 text-ok'}"
			>
				{exportToast.message}
			</div>
		</div>
	{/if}

	<!-- Fixed bottom New Report Button -->
	<div
		class="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-lg bg-gradient-to-t from-[#0f1117] from-60% to-transparent px-4 pt-3 pb-12 lg:max-w-3xl lg:px-8"
	>
		<button
			type="button"
			class="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-hover hover:shadow-xl hover:shadow-accent/30 active:scale-[0.98] lg:py-4 lg:text-lg"
			onclick={handleNew}
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
			בדיקה חדשה
		</button>
	</div>
</div>

<ConfirmDialog
	open={confirmState !== null}
	message={confirmState?.message ?? ''}
	danger={confirmState?.danger ?? false}
	confirmLabel={confirmState?.confirmLabel ?? 'מחק'}
	onconfirm={() => {
		confirmState?.action();
		confirmState = null;
	}}
	oncancel={() => (confirmState = null)}
/>

<FolderPicker
	open={movingReportId !== null}
	folders={allFolders}
	currentFolder={movingReportId ? (reports.find((r) => r.id === movingReportId)?.folder ?? '') : ''}
	onselect={handleMoveReport}
	oncancel={() => (movingReportId = null)}
/>
