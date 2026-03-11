<script lang="ts">
	import { slide } from 'svelte/transition';
	import { haptic } from '$lib/utils/haptics.js';
	import type { createInspectionStore } from '$lib/stores/inspection.svelte.js';
	import { checklistSections } from '$lib/config/checklist.js';
	import PhotoCapture from './PhotoCapture.svelte';

	let { store }: { store: ReturnType<typeof createInspectionStore> } = $props();

	let expandedSections = $state<Record<string, boolean>>(
		Object.fromEntries(checklistSections.map((s) => [s.code, true]))
	);

	function toggleSection(code: string) {
		haptic('light');
		expandedSections[code] = !expandedSections[code];
	}

	let sectionStats = $derived.by(() => {
		const stats: Record<string, { filled: number; faults: number; total: number }> = {};
		let totalFilled = 0;
		let totalFaults = 0;
		for (const c of store.inspection.checklist) {
			const parentCode = c.sectionCode.split('.')[0];
			if (!stats[parentCode]) stats[parentCode] = { filled: 0, faults: 0, total: 0 };
			stats[parentCode].total++;
			if (c.status) {
				stats[parentCode].filled++;
				totalFilled++;
			}
			if (c.status === 'לא תקין') {
				stats[parentCode].faults++;
				totalFaults++;
			}
		}
		return { sections: stats, totalFilled, totalFaults, totalItems: store.inspection.checklist.length };
	});

	function getStat(code: string) {
		return sectionStats.sections[code] ?? { filled: 0, faults: 0, total: 0 };
	}

	const sectionIcons: Record<string, string> = {
		'1': '🔌',
		'2': '📦',
		'3': '⏚',
		'4': '🔄',
		'5': '📡',
		'6': '☀️',
		'7': '🏗️',
		'8': '🪜',
		'9': '🔍'
	};

	const sectionColors: Record<string, { border: string; bg: string; text: string; icon: string }> = {
		'1': { border: 'border-amber-500/40', bg: 'bg-amber-500/5', text: 'text-amber-400', icon: 'bg-amber-500/10' },
		'2': { border: 'border-orange-500/40', bg: 'bg-orange-500/5', text: 'text-orange-400', icon: 'bg-orange-500/10' },
		'3': { border: 'border-sky-500/40', bg: 'bg-sky-500/5', text: 'text-sky-400', icon: 'bg-sky-500/10' },
		'4': { border: 'border-yellow-500/40', bg: 'bg-yellow-500/5', text: 'text-yellow-400', icon: 'bg-yellow-500/10' },
		'5': { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', text: 'text-emerald-400', icon: 'bg-emerald-500/10' },
		'6': { border: 'border-cyan-500/40', bg: 'bg-cyan-500/5', text: 'text-cyan-400', icon: 'bg-cyan-500/10' },
		'7': { border: 'border-violet-500/40', bg: 'bg-violet-500/5', text: 'text-violet-400', icon: 'bg-violet-500/10' },
		'8': { border: 'border-rose-500/40', bg: 'bg-rose-500/5', text: 'text-rose-400', icon: 'bg-rose-500/10' },
		'9': { border: 'border-indigo-500/40', bg: 'bg-indigo-500/5', text: 'text-indigo-400', icon: 'bg-indigo-500/10' }
	};

	const defaultColor = { border: 'border-accent/40', bg: 'bg-accent/5', text: 'text-accent', icon: 'bg-accent/10' };

	let sectionRefs: Record<string, HTMLElement> = {};
	let activeSection = $state<string | null>(null);
	let jumpMenuOpen = $state(false);

	function scrollToSection(code: string) {
		haptic('light');
		jumpMenuOpen = false;
		expandedSections[code] = true;
		setTimeout(() => {
			sectionRefs[code]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 50);
	}

	$effect(() => {
		function update() {
			let found: string | null = null;
			for (const s of checklistSections) {
				const el = sectionRefs[s.code];
				if (!el) continue;
				if (el.getBoundingClientRect().top < 1) {
					found = s.code;
				}
			}
			activeSection = found;
		}
		window.addEventListener('scroll', update, { passive: true });
		return () => window.removeEventListener('scroll', update);
	});
</script>

{#if activeSection}
	{@const activeSectionData = checklistSections.find((s) => s.code === activeSection)!}
	{@const activeColors = sectionColors[activeSection] ?? defaultColor}
	{@const activeStat = getStat(activeSection)}
	<div class="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-2">
		<div class="flex items-center gap-2 rounded-xl border {activeColors.border} bg-surface-800/95 px-3 py-2 shadow-lg shadow-black/30 backdrop-blur-md">
			<span class="text-lg">{sectionIcons[activeSection]}</span>
			<span class="text-sm font-semibold text-white">{activeSectionData.code}. {activeSectionData.title}</span>
			{#if activeStat.faults > 0}
				<span class="rounded-md bg-danger-dim px-2 py-0.5 text-xs font-medium text-danger">{activeStat.faults} תקלות</span>
			{/if}
			<span class="rounded-md bg-surface-600 px-2 py-0.5 text-xs font-medium text-gray-400">{activeStat.filled}/{activeStat.total}</span>
		</div>
	</div>
{/if}

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg lg:text-xl font-bold text-white">סעיפי בדיקה</h2>
		<div class="flex items-center gap-2">
			{#if sectionStats.totalFaults > 0}
				<div class="flex items-center gap-1.5 rounded-full bg-danger-dim px-3 py-1.5 text-sm font-semibold text-danger">
					<div class="h-2 w-2 rounded-full bg-danger"></div>
					{sectionStats.totalFaults} תקלות
				</div>
			{/if}
			<div
				class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold {sectionStats.totalFilled === sectionStats.totalItems && sectionStats.totalFaults === 0 ? 'bg-ok-dim text-ok' : sectionStats.totalFilled === sectionStats.totalItems ? 'bg-warn-dim text-warn' : 'bg-accent-dim text-accent'}"
			>
				<div
					class="h-2 w-2 rounded-full {sectionStats.totalFilled === sectionStats.totalItems && sectionStats.totalFaults === 0 ? 'bg-ok' : sectionStats.totalFilled === sectionStats.totalItems ? 'bg-warn' : 'bg-accent'}"
				></div>
				{sectionStats.totalFilled}/{sectionStats.totalItems}
			</div>
		</div>
	</div>

	{#each checklistSections as section (section.code)}
		{@const { filled, faults, total } = getStat(section.code)}
		{@const complete = filled === total}
		{@const allOk = complete && faults === 0}
		{@const colors = sectionColors[section.code] ?? defaultColor}
		<div bind:this={sectionRefs[section.code]} class="overflow-hidden rounded-xl border {faults > 0 ? 'border-danger/30' : 'border-border'} bg-surface-800">
			<div class="flex items-center justify-between p-3 lg:p-4">
				<button
					type="button"
					class="flex flex-1 items-center gap-2.5 rounded-lg text-start transition-colors hover:bg-surface-700"
					onclick={() => toggleSection(section.code)}
				>
					<span class="flex h-8 w-8 items-center justify-center rounded-lg text-lg {colors.icon}">{sectionIcons[section.code] || '📋'}</span>
					<div>
						<span class="font-semibold text-white"
							>{section.code}. {section.title}</span
						>
						<div class="mt-0.5 flex h-1 w-20 overflow-hidden rounded-full bg-surface-600">
							{#if filled - faults > 0}
								<div
									class="h-full bg-ok transition-all"
									style="width: {((filled - faults) / total) * 100}%"
								></div>
							{/if}
							{#if faults > 0}
								<div
									class="h-full bg-danger transition-all"
									style="width: {(faults / total) * 100}%"
								></div>
							{/if}
						</div>
					</div>
				</button>
				<div class="flex items-center gap-2">
					{#if faults > 0}
						<span class="rounded-md px-2 py-0.5 text-xs lg:text-sm font-medium bg-danger-dim text-danger">
							{faults} תקלות
						</span>
					{/if}
					<span
						class="rounded-md px-2 py-0.5 text-xs lg:text-sm font-medium {allOk
							? 'bg-ok-dim text-ok'
							: complete
								? 'bg-warn-dim text-warn'
								: 'bg-surface-600 text-gray-400'}"
					>
						{filled}/{total}
					</span>
				</div>
			</div>

			{#if expandedSections[section.code]}
				<div class="border-t border-border" transition:slide={{ duration: 300 }}>
					{#each section.items as item, idx (item.sectionCode)}
						{@const checklist = store.inspection.checklist.find(
							(c) => c.sectionCode === item.sectionCode
						)}
						{@const prevSubgroup = idx > 0 ? section.items[idx - 1].subgroup : undefined}
						{@const showSubgroup = item.subgroup && item.subgroup !== prevSubgroup}
						{@const photos = checklist?.photoIds ?? []}
						{#if showSubgroup}
							<div class="border-t-2 {colors.border} {colors.bg} px-4 py-2.5 {idx > 0 ? 'mt-1' : ''}">
								<span class="text-sm font-bold {colors.text}">{item.subgroup}</span>
							</div>
						{/if}
						<div
							class="border-b border-border/50 p-3 lg:p-4 last:border-b-0 {checklist?.status === 'לא תקין'
								? 'bg-danger-dim/50'
								: checklist?.status === 'לא רלוונטי'
									? 'bg-surface-900/60 opacity-50'
									: idx % 2 === 0
										? 'bg-surface-800'
										: 'bg-surface-800/50'}"
						>
							<div class="lg:flex lg:items-start lg:gap-4">
							<div class="mb-2 lg:mb-0 lg:flex-1 flex items-start gap-2">
								<span
									class="mt-0.5 rounded bg-surface-600 px-1.5 py-0.5 text-xs lg:text-sm font-mono text-gray-400"
									>{item.sectionCode}</span
								>
								<span class="text-sm lg:text-base {checklist?.status === 'לא רלוונטי' ? 'text-gray-500 line-through' : 'text-gray-200'}">{item.description}</span>
							</div>
							<div class="flex flex-wrap gap-1.5 lg:flex-shrink-0">
								{#if item.selectOptions}
									{#each item.selectOptions as opt (opt)}
										{@const selected = checklist?.status === opt}
										<label
											class="flex cursor-pointer items-center gap-1 rounded-lg border px-3 lg:px-4 py-1.5 lg:py-2 text-sm lg:text-base transition-all {selected
												? 'border-accent bg-accent-dim text-accent'
												: 'border-border text-gray-400 hover:border-border-light hover:text-gray-300 active:border-border-light active:text-gray-300'}"
										>
											<input
												type="radio"
												name="status-{item.sectionCode}"
												class="sr-only"
												checked={selected}
												onchange={() =>
													store.updateChecklistItem(
														item.sectionCode,
														opt
													)}
											/>
											{#if selected}✓{/if}
											{opt}
										</label>
									{/each}
									{@const lrSelected = checklist?.status === 'לא רלוונטי'}
									<label
										class="flex cursor-pointer items-center gap-1 rounded-lg border px-3 lg:px-4 py-1.5 lg:py-2 text-sm lg:text-base transition-all {lrSelected
											? 'border-accent bg-accent-dim text-accent'
											: 'border-border text-gray-400 hover:border-border-light hover:text-gray-300 active:border-border-light active:text-gray-300'}"
									>
										<input
											type="radio"
											name="status-{item.sectionCode}"
											class="sr-only"
											checked={lrSelected}
											onchange={() => store.updateChecklistItem(item.sectionCode, 'לא רלוונטי')}
										/>
										{#if lrSelected}✓{/if}
										לא רלוונטי
									</label>
								{:else}
									{@const okLabel = item.okLabel ?? 'תקין'}
									{@const options = [
										{ label: okLabel, style: 'ok' },
										{ label: 'לא תקין', style: 'danger' },
										{ label: 'לא רלוונטי', style: 'neutral' }
									]}
									{#each options as opt (opt.label)}
										{@const selected = checklist?.status === opt.label}
										<label
											class="flex cursor-pointer items-center gap-1 rounded-lg border px-3 lg:px-4 py-1.5 lg:py-2 text-sm lg:text-base transition-all {selected
												? opt.style === 'ok'
													? 'border-ok bg-ok-dim text-ok'
													: opt.style === 'danger'
														? 'border-danger bg-danger-dim text-danger'
														: 'border-accent bg-accent-dim text-accent'
												: 'border-border text-gray-400 hover:border-border-light hover:text-gray-300 active:border-border-light active:text-gray-300'}"
										>
											<input
												type="radio"
												name="status-{item.sectionCode}"
												class="sr-only"
												checked={selected}
												onchange={() =>
													store.updateChecklistItem(
														item.sectionCode,
														opt.label
													)}
											/>
											{#if selected && opt.style === 'ok'}✓{/if}
											{#if selected && opt.style === 'danger'}✗{/if}
											{opt.label}
										</label>
									{/each}
								{/if}
							</div>
							</div>
							<div class="mt-2 flex items-center rounded-lg bg-surface-700">
								<input
									type="text"
									class="block min-w-0 flex-1 border-none bg-transparent px-2.5 py-1.5 text-sm"
									placeholder="הערות..."
									value={checklist?.notes ?? ''}
									oninput={(e) =>
										store.updateChecklistItem(
											item.sectionCode,
											undefined,
											e.currentTarget.value
										)}
								/>
								{#if !photos.length}
									<PhotoCapture
										compact
										photoIds={photos}
										onadd={(id) => store.addChecklistPhoto(item.sectionCode, id)}
										onremove={(id) => store.removeChecklistPhoto(item.sectionCode, id)}
									/>
								{/if}
							</div>
							{#if photos.length > 0}
								<div class="mt-1">
									<PhotoCapture
										photoIds={photos}
										onadd={(id) => store.addChecklistPhoto(item.sectionCode, id)}
										onremove={(id) => store.removeChecklistPhoto(item.sectionCode, id)}
									/>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>

{#if jumpMenuOpen}
	<div class="fixed inset-0 z-40" role="presentation" onclick={() => (jumpMenuOpen = false)}></div>
{/if}

{#if jumpMenuOpen}
	<div
		class="fixed bottom-40 landscape:bottom-36 lg:bottom-[10.5rem] lg:landscape:bottom-[10.5rem] start-4 lg:start-[max(1rem,calc((100vw-66rem)/2))] z-50 w-64 overflow-hidden rounded-xl border border-border bg-surface-800 shadow-xl shadow-black/40"
		transition:slide={{ duration: 200 }}
	>
		{#each checklistSections as section (section.code)}
			{@const { filled, faults, total } = getStat(section.code)}
			{@const complete = filled === total}
			{@const allOk = complete && faults === 0}
			{@const colors = sectionColors[section.code] ?? defaultColor}
			<button
				type="button"
				class="flex w-full items-center gap-2.5 border-b border-border/50 px-3 py-2.5 text-start last:border-b-0 hover:bg-surface-700"
				onclick={() => scrollToSection(section.code)}
			>
				<span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-base {colors.icon}">
					{sectionIcons[section.code] || '📋'}
				</span>
				<span class="flex-1 text-sm font-medium leading-tight text-white">{section.code}. {section.title}</span>
				<span class="text-xs font-medium {allOk ? 'text-ok' : complete ? 'text-warn' : 'text-gray-500'}">
					{filled}/{total}
				</span>
				{#if faults > 0}
					<span class="rounded bg-danger-dim px-1.5 py-0.5 text-xs text-danger">{faults}</span>
				{/if}
			</button>
		{/each}
	</div>
{/if}

<button
	type="button"
	class="fixed bottom-24 landscape:bottom-20 lg:bottom-[6.5rem] lg:landscape:bottom-[6.5rem] start-4 lg:start-[max(1rem,calc((100vw-66rem)/2))] z-50 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent shadow-lg shadow-black/30 text-white transition-transform active:scale-95"
	onclick={() => {
		haptic('light');
		jumpMenuOpen = !jumpMenuOpen;
	}}
	aria-label="קפוץ לקטגוריה"
>
	<span class="material-symbols-rounded text-[22px]">{jumpMenuOpen ? 'close' : 'menu'}</span>
</button>
