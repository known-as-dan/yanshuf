<script lang="ts">
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { createInspectionStore } from '$lib/stores/inspection.svelte.js';
	import { loadReport, setStorageErrorHandler } from '$lib/stores/reports.js';
	import { estimateAvailableStorage } from '$lib/stores/photos.js';
	import {
		STEP_SLUGS,
		STEP_LABELS,
		STEP_ICONS,
		slugToIndex,
		type StepSlug
	} from '$lib/config/steps.js';
	import { haptic } from '$lib/utils/haptics.js';
	import Toast from '$lib/components/Toast.svelte';
	import Dashboard from '$lib/components/Dashboard.svelte';
	import StepMeta from '$lib/components/StepMeta.svelte';
	import StepConfig from '$lib/components/StepConfig.svelte';
	import StepChecklist from '$lib/components/StepChecklist.svelte';
	import StepDc from '$lib/components/StepDc.svelte';
	import StepAc from '$lib/components/StepAc.svelte';
	import StepDefects from '$lib/components/StepDefects.svelte';
	import StepSummary from '$lib/components/StepSummary.svelte';

	let activeReportId = $state<string | null>(null);
	let store = $state.raw<ReturnType<typeof createInspectionStore> | undefined>(undefined);
	let currentSlug: StepSlug = $state('meta');
	let currentStepIndex = $derived(slugToIndex(currentSlug));
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive, just a cache
	let scrollPositions = new Map<StepSlug, number>();
	let storageWarning = $state(false);
	let errorToast = $state<string | null>(null);

	$effect(() => {
		if (!activeReportId) return;
		estimateAvailableStorage().then((est) => {
			if (est) storageWarning = est.percentUsed > 80;
		});
	});

	function showError(msg: string) {
		errorToast = msg;
		setTimeout(() => (errorToast = null), 3500);
	}

	setStorageErrorHandler(showError);

	function openReport(id: string) {
		const report = loadReport(id);
		if (!report) {
			console.error('Failed to load report', id);
			showError('לא ניתן לטעון את הדוח');
			return;
		}
		try {
			store = createInspectionStore(report);
			activeReportId = id;
			scrollPositions = new Map();
			currentSlug = 'meta';
		} catch (err) {
			console.error('Failed to open report', err);
			showError('שגיאה בפתיחת הדוח');
		}
	}

	function backToDashboard() {
		haptic('light');
		activeReportId = null;
		store = undefined;
	}

	async function goToStep(slug: StepSlug) {
		haptic('selection');
		scrollPositions.set(currentSlug, window.scrollY);
		currentSlug = slug;
		await tick();
		window.scrollTo(0, scrollPositions.get(slug) ?? 0);
	}
</script>

{#if activeReportId && store}
	<div class="mx-auto w-full max-w-lg px-4 pt-6 lg:max-w-3xl lg:px-8">
		<!-- Header with back button -->
		<header class="relative mb-4 flex items-center">
			<button
				type="button"
				class="absolute start-0 rounded-xl p-3 text-2xl text-gray-400 transition-colors hover:bg-surface-700 hover:text-white active:bg-surface-700 active:text-white lg:p-3.5"
				aria-label="חזרה לרשימת דוחות"
				onclick={backToDashboard}
			>
				→
			</button>
			<div class="min-w-0 flex-1 text-center">
				<h1 class="truncate text-lg font-bold text-white lg:text-xl">
					{store.report.name}
				</h1>
				{#if storageWarning}
					<p class="text-xs text-warn">שטח אחסון עומד להיגמר</p>
				{/if}
			</div>
		</header>

		<!-- Step content -->
		<main class="mb-32 min-h-[60vh]">
			{#key currentSlug}
				<div in:fade={{ duration: 250 }}>
					{#if currentStepIndex === 0}
						<StepMeta {store} />
					{:else if currentStepIndex === 1}
						<StepConfig {store} />
					{:else if currentStepIndex === 2}
						<StepChecklist {store} />
					{:else if currentStepIndex === 3}
						<StepDc {store} />
					{:else if currentStepIndex === 4}
						<StepAc {store} />
					{:else if currentStepIndex === 5}
						<StepDefects {store} />
					{:else if currentStepIndex === 6}
						<StepSummary {store} ondashboard={backToDashboard} />
					{/if}
				</div>
			{/key}
		</main>

		<!-- Step navigation (bottom bar) -->
		<nav
			class="fixed inset-x-0 bottom-6 z-20 flex justify-center bg-gradient-to-t from-surface-900 from-40% to-transparent px-3 pt-8 lg:px-6 landscape:bottom-4"
		>
			<div
				class="overflow-x-auto rounded-2xl border border-border-light/50 bg-surface-800/90 px-3 py-2.5 shadow-lg shadow-black/30 backdrop-blur-md md:max-w-fit lg:overflow-x-visible lg:px-4 lg:py-3"
			>
				<div class="flex gap-2 lg:gap-3">
					{#each STEP_SLUGS as slug (slug)}
						<button
							type="button"
							class="flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all lg:px-4 lg:py-2.5 lg:text-base {slug ===
							currentSlug
								? 'bg-accent text-white shadow-md shadow-accent/20'
								: 'bg-surface-700 text-gray-400 hover:bg-surface-600 hover:text-gray-200 active:bg-surface-600 active:text-gray-200'}"
							onclick={() => goToStep(slug)}
						>
							<span class="text-base lg:text-lg">{STEP_ICONS[slug]}</span>
							<span>{STEP_LABELS[slug]}</span>
						</button>
					{/each}
				</div>
			</div>
		</nav>
	</div>
{:else}
	<Dashboard onopen={openReport} />
{/if}

<Toast message={errorToast} type="error" />
