<script lang="ts">
	import type { createInspectionStore } from '$lib/stores/inspection.svelte.js';
	import { DC_FIELDS, parseMeasurement, dcGroupLabel } from '$lib/models/dc.js';
	import ConfirmDialog from './ConfirmDialog.svelte';
	let { store }: { store: ReturnType<typeof createInspectionStore> } = $props();
	let mobileTab = $state<'electrical' | 'isolation'>('electrical');
	let removing = $state<string | null>(null);
	let actions = $state<string | null>(null);
	let faultPoint = $state<string | null>(null);
	let faultText = $state('');
	let feedback = $state('');
	const groups = $derived(store.inspection.dcGroups ?? []);
	function nextInput(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		const inputs = Array.from(
			event.currentTarget
				.closest('table')
				?.querySelectorAll<HTMLInputElement>(
					`input[data-col="${event.currentTarget.dataset.col}"]`
				) ?? []
		);
		inputs[inputs.indexOf(event.currentTarget) + 1]?.focus();
	}
</script>

<div class="space-y-5">
	<div>
		<h2 class="text-lg font-bold text-white">מדידות DC</h2>
		<p class="mt-1 text-sm leading-relaxed text-gray-400">
			בודקים לפי מה שפוגשים בשטח. אפשר לקבץ לפי ארון, אזור או נקודת בדיקה — אין צורך לזהות ממיר
			מראש.
		</p>
	</div>
	<div class="flex gap-2 lg:hidden" aria-label="עמודות מדידה">
		<button
			type="button"
			class="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
			class:active-tab={mobileTab === 'electrical'}
			aria-pressed={mobileTab === 'electrical'}
			onclick={() => (mobileTab = 'electrical')}>קולטים, מתח וזרם</button
		>
		<button
			type="button"
			class="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
			class:active-tab={mobileTab === 'isolation'}
			aria-pressed={mobileTab === 'isolation'}
			onclick={() => (mobileTab = 'isolation')}>בידוד</button
		>
	</div>
	{#each groups as group, groupIndex (group.id)}
		{@const rows = store.getDcGroupRows(group.id)}
		<section
			class="overflow-hidden rounded-xl border border-border bg-surface-800"
			aria-label={dcGroupLabel(group, groupIndex)}
		>
			<div class="flex items-center gap-3 border-b border-border p-3">
				<label class="min-w-0 flex-1">
					<span class="mb-1 block text-xs text-gray-400">קבוצה / מיקום בשטח</span>
					<input
						class="w-full rounded-lg border-border bg-surface-700 px-3 py-2 text-sm"
						aria-label="שם קבוצה {groupIndex + 1}"
						placeholder="לדוגמה: ארון צפוני, גג מערבי"
						value={group.label}
						oninput={(event) => store.updateDcGroup(group.id, event.currentTarget.value)}
					/>
				</label>
				<span class="shrink-0 text-xs text-gray-400">{rows.length} נקודות</span>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full table-fixed border-collapse text-sm lg:min-w-[760px]">
					<thead class="bg-surface-700 text-xs text-gray-300">
						<tr>
							<th class="w-24 px-2 py-3 font-medium lg:w-28">נקודה / סימון</th>
							{#each DC_FIELDS as field, index (field.key)}
								<th
									class="px-1 py-3 font-medium"
									class:mobile-hidden={(mobileTab === 'electrical') !== index < 3}
									>{field.label}<span dir="ltr" class="block text-gray-500"
										>{field.unit || 'כמות'}</span
									></th
								>
							{/each}
							<th class="w-10"><span class="sr-only">פעולות</span></th>
						</tr>
					</thead>
					<tbody>
						{#each rows as { measurement, depth } (measurement.id)}
							<tr class="border-t border-border/60">
								<td class="px-1 py-2" style="padding-inline-start: {4 + depth * 8}px">
									<input
										class="w-full min-w-0 rounded-lg border-border bg-surface-700 px-2 py-2 text-center"
										aria-label="סימון נקודה {measurement.stringLabel}"
										value={measurement.stringLabel}
										oninput={(event) =>
											store.updateDcMeasurement(measurement.id, {
												stringLabel: event.currentTarget.value
											})}
									/>
								</td>
								{#each DC_FIELDS as field, index (field.key)}
									<td
										class="px-1 py-2"
										class:mobile-hidden={(mobileTab === 'electrical') !== index < 3}
									>
										<input
											type="number"
											inputmode="decimal"
											step={field.step}
											dir="ltr"
											data-col={field.key}
											aria-label="{field.label} — {dcGroupLabel(
												group,
												groupIndex
											)} — {measurement.stringLabel}"
											class="w-full min-w-0 bg-surface-700 px-1 py-2 text-center tabular-nums"
											value={measurement[field.key] ?? ''}
											oninput={(event) =>
												store.updateDcMeasurement(measurement.id, {
													[field.key]: parseMeasurement(event.currentTarget.value)
												})}
											onkeydown={nextInput}
										/>
									</td>
								{/each}
								<td class="px-1 py-2">
									<button
										type="button"
										class="w-full rounded px-2 py-3 text-center text-gray-400"
										aria-label="פעולות נקודה {measurement.stringLabel}"
										aria-expanded={actions === measurement.id}
										onclick={() => (actions = actions === measurement.id ? null : measurement.id)}
										>⋮</button
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if actions && rows.some((item) => item.measurement.id === actions)}
				{@const selected = rows.find((item) => item.measurement.id === actions)!}
				<div
					class="flex flex-wrap items-center gap-2 border-t border-border bg-surface-700 p-3 text-xs"
				>
					<span class="text-gray-300">נקודה {selected.measurement.stringLabel}</span>
					{#if selected.depth < 2}<button
							type="button"
							class="rounded-lg bg-surface-600 px-3 py-2"
							onclick={() => {
								store.addDcSubstring(selected.measurement.id);
								actions = null;
							}}>הוסף נקודת משנה</button
						>{/if}
					<button
						type="button"
						class="rounded-lg px-3 py-2 text-amber-300"
						onclick={() => {
							faultPoint = selected.measurement.id;
							faultText = '';
							actions = null;
						}}>תעד ליקוי בנקודה</button
					>
					<button
						type="button"
						class="rounded-lg px-3 py-2 text-red-300"
						onclick={() => {
							removing = selected.measurement.id;
							actions = null;
						}}>מחק נקודה</button
					>
					<button
						type="button"
						class="ms-auto rounded-lg px-3 py-2 text-gray-400"
						onclick={() => (actions = null)}>סגור</button
					>
				</div>
			{/if}
			{#if faultPoint && rows.some((item) => item.measurement.id === faultPoint)}
				{@const point = rows.find((item) => item.measurement.id === faultPoint)!.measurement}
				<form
					class="space-y-2 border-t border-border p-3"
					onsubmit={(event) => {
						event.preventDefault();
						if (!faultText.trim()) return;
						store.addDefect({
							fault: faultText.trim(),
							location: `${dcGroupLabel(group, groupIndex)} · נקודה ${point.stringLabel}`
						});
						feedback = 'הליקוי נוסף לשלב ליקויים עם מיקום הנקודה';
						faultPoint = null;
						faultText = '';
					}}
				>
					<label class="block"
						><span class="mb-1 block text-xs text-gray-300">ליקוי בנקודה {point.stringLabel}</span
						><input
							type="text"
							class="w-full rounded-lg border-border bg-surface-700 px-3 py-2 text-sm"
							placeholder="הבעיה שנמצאה / מה צריך לסמן או לאתר"
							bind:value={faultText}
							required
						/></label
					>
					<div class="flex gap-2">
						<button type="submit" class="rounded-lg bg-accent px-3 py-2 text-xs text-white"
							>שמור ליקוי</button
						><button
							type="button"
							class="rounded-lg px-3 py-2 text-xs text-gray-400"
							onclick={() => (faultPoint = null)}>ביטול</button
						>
					</div>
				</form>
			{/if}
			<button
				type="button"
				class="w-full border-t border-border px-3 py-3 text-sm text-accent hover:bg-surface-700"
				onclick={() => store.addDcPoint(group.id)}>+ נקודת בדיקה</button
			>
		</section>
	{/each}
	{#if groups.length === 0}<p
			class="rounded-xl border border-dashed border-border p-6 text-center text-sm text-gray-400"
		>
			הוסיפו קבוצת מדידה והתחילו לתעד. שמות וסימונים אפשר להשלים גם בהמשך.
		</p>{/if}
	<button
		type="button"
		class="w-full rounded-xl border border-dashed border-accent/60 px-4 py-3 text-sm text-accent hover:bg-surface-800"
		onclick={() => store.addDcGroup()}>+ קבוצת מדידה חדשה</button
	>
	{#if feedback}<p role="status" class="text-xs text-amber-300">{feedback}</p>{/if}
	<p class="text-xs leading-relaxed text-gray-500">
		שדה ריק נשאר ריק. הזנת מדידה אינה אישור תקינות. ליקויים ופעולות מתועדים בשלב הבדיקה או הליקויים.
	</p>
</div>

<ConfirmDialog
	open={removing !== null}
	message="למחוק את הנקודה ואת נקודות המשנה שלה? המדידות שלהן יימחקו."
	danger={true}
	confirmLabel="מחק נקודה"
	oncancel={() => (removing = null)}
	onconfirm={() => {
		if (removing) store.removeDcMeasurement(removing);
		removing = null;
	}}
/>

<style>
	.active-tab {
		background: var(--color-accent);
		color: white;
		border-color: var(--color-accent);
	}
	@media (max-width: 1023px) {
		.mobile-hidden {
			display: none;
		}
	}
</style>
