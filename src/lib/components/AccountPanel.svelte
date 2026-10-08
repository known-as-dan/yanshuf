<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { setReportAccount, safeSetItem } from '$lib/stores/reports.js';
	import { setPhotoAccount } from '$lib/stores/photos.js';
	import { createCloudSync } from '$lib/services/cloud.js';
	let { onaccountchange }: { onaccountchange: (id: string | null) => void } = $props();
	type User = { id: string; email: string };
	let user = $state<User | null>(null);
	let loading = $state(true);
	let showLogin = $state(false);
	let email = $state('');
	let otp = $state('');
	let sent = $state(false);
	let pending = $state(false);
	let message = $state('');
	let syncStatus = $state('');
	let sync: ReturnType<typeof createCloudSync> | null = null;
	let sessionCheck = 0;
	const integrated = base === '/yanshuf';
	function activate(next: User | null) {
		if (next?.id === user?.id) return;
		sync?.stop();
		sync = null;
		user = next;
		setReportAccount(next?.id ?? null);
		setPhotoAccount(next?.id ?? null);
		onaccountchange(next?.id ?? null);
		if (next) {
			safeSetItem('yanshuf_last_account', JSON.stringify(next));
			sync = createCloudSync(next.id, (status) => (syncStatus = status));
		} else localStorage.removeItem('yanshuf_last_account');
	}
	async function checkSession() {
		if (!integrated) {
			loading = false;
			return;
		}
		const check = ++sessionCheck;
		try {
			const response = await fetch('/api/auth/get-session', {
				credentials: 'same-origin',
				cache: 'no-store'
			});
			if (!response.ok) {
				loading = false;
				return;
			}
			const session = await response.json();
			if (check === sessionCheck) activate(session?.user ?? null);
		} catch {
			// A known account's local workspace remains usable offline; server checks
			// still gate every cloud read/write after reconnection.
			if (!user && check === sessionCheck) {
				try {
					const last = JSON.parse(localStorage.getItem('yanshuf_last_account') ?? 'null');
					if (last?.id && last?.email) activate(last);
				} catch {
					/* guest remains usable */
				}
			}
			syncStatus = 'ללא חיבור לשרת — עבודה מקומית';
		} finally {
			if (check === sessionCheck) loading = false;
		}
	}
	async function authRequest(path: string, body: unknown) {
		const response = await fetch(`/api/auth/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify(body)
		});
		if (!response.ok)
			throw new Error(
				response.status === 404
					? 'כניסה לחשבון זמינה דרך מיקומית'
					: response.status === 429
						? 'נשלחו יותר מדי בקשות. נסו שוב בעוד כמה דקות'
						: 'לא ניתן להתחבר. בדקו את הכתובת או הקוד ואת ההזמנה למיקומית'
			);
	}
	async function submit() {
		pending = true;
		message = '';
		try {
			if (!sent) {
				await authRequest('email-otp/send-verification-otp', {
					email: email.trim(),
					type: 'sign-in'
				});
				sent = true;
			} else {
				await authRequest('sign-in/email-otp', { email: email.trim(), otp: otp.trim() });
				await checkSession();
				if (user) {
					showLogin = false;
					otp = '';
					sent = false;
				}
			}
		} catch (failure) {
			message = failure instanceof Error ? failure.message : 'אין חיבור לשרת';
		} finally {
			pending = false;
		}
	}
	async function signOut() {
		pending = true;
		message = '';
		try {
			await authRequest('sign-out', {});
			++sessionCheck;
			activate(null);
		} catch {
			message = 'לא ניתן להתנתק כרגע. נסו שוב כשיש חיבור';
		} finally {
			pending = false;
		}
	}
	async function importDevice() {
		pending = true;
		try {
			const count = await sync?.importGuestReports();
			message = count ? `${count} דוחות מקומיים הועתקו לחשבון` : 'אין דוחות חדשים להעביר';
		} catch {
			message = 'ההעתקה לא הושלמה. הדוחות המקוריים נשמרו במכשיר';
		} finally {
			pending = false;
		}
	}
	onMount(() => {
		checkSession();
		window.addEventListener('online', checkSession);
		window.addEventListener('focus', checkSession);
		return () => {
			++sessionCheck;
			sync?.stop();
			window.removeEventListener('online', checkSession);
			window.removeEventListener('focus', checkSession);
		};
	});
</script>

<div class="mx-auto w-full max-w-lg px-4 pt-4 lg:max-w-6xl lg:px-8">
	<section
		class="rounded-xl border border-border bg-surface-800 p-3 text-sm"
		aria-label="חשבון וסנכרון"
	>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="min-w-0">
				<a
					rel="external"
					data-sveltekit-reload
					href={integrated ? '/map' : 'https://mikumit.com/yanshuf'}
					class="text-xs text-accent">ינשוף · מיקומית</a
				>
				{#if loading}<p class="text-gray-400">בודק חיבור לחשבון…</p>
				{:else if user}<p dir="ltr" class="truncate text-gray-200">{user.email}</p>
					<p role="status" class="text-xs text-gray-400">{syncStatus}</p>
				{:else}<p class="text-gray-300">מצב אורח · הדוחות נשמרים במכשיר הזה</p>{/if}
			</div>
			<div class="flex flex-wrap gap-2">
				{#if user}
					<button
						type="button"
						class="rounded-lg bg-surface-700 px-3 py-2 text-xs"
						onclick={() => sync?.sync()}
						disabled={pending}>סנכרן עכשיו</button
					>
					<button
						type="button"
						class="rounded-lg bg-surface-700 px-3 py-2 text-xs"
						onclick={importDevice}
						disabled={pending}>העתק דוחות אורח לחשבון</button
					>
					<button
						type="button"
						class="rounded-lg px-3 py-2 text-xs text-gray-400"
						onclick={signOut}
						disabled={pending}>התנתק</button
					>
				{:else if integrated}<button
						type="button"
						class="rounded-lg bg-accent px-3 py-2 text-xs text-white"
						onclick={() => (showLogin = !showLogin)}
						aria-expanded={showLogin}>כניסה עם חשבון מיקומית</button
					>
				{:else}<a
						href="https://mikumit.com/yanshuf"
						class="rounded-lg bg-accent px-3 py-2 text-xs text-white">פתיחה במיקומית</a
					>{/if}
			</div>
		</div>
		{#if showLogin && !user}
			<form
				class="mt-3 space-y-3 border-t border-border pt-3"
				onsubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<p class="text-xs text-gray-400">
					אותו חשבון ואותו קוד במייל. אפשר להמשיך לעבוד כאורח בלי להתחבר.
				</p>
				<label class="block"
					><span class="mb-1 block text-xs text-gray-300">כתובת המייל במיקומית</span><input
						type="email"
						autocomplete="email"
						dir="ltr"
						class="w-full px-3 py-2"
						bind:value={email}
						required
						disabled={sent || pending}
					/></label
				>
				{#if sent}<label class="block"
						><span class="mb-1 block text-xs text-gray-300">קוד האימות</span><input
							type="text"
							inputmode="numeric"
							autocomplete="one-time-code"
							pattern={'[0-9]{6}'}
							maxlength="6"
							dir="ltr"
							class="w-full px-3 py-2"
							bind:value={otp}
							required
						/></label
					>{/if}
				<div class="flex gap-2">
					<button type="submit" class="rounded-lg bg-accent px-4 py-2 text-white" disabled={pending}
						>{pending ? 'רגע…' : sent ? 'התחבר' : 'שלח קוד במייל'}</button
					><button
						type="button"
						class="px-3 py-2 text-gray-400"
						onclick={() => {
							showLogin = false;
							sent = false;
							otp = '';
						}}>המשך כאורח</button
					>{#if sent}<button
							type="button"
							class="px-3 py-2 text-xs text-gray-400"
							onclick={() => {
								sent = false;
								otp = '';
							}}>שנה כתובת / שלח שוב</button
						>{/if}
				</div>
			</form>
		{/if}
		{#if message}<p role="status" class="mt-2 text-xs text-amber-300">{message}</p>{/if}
	</section>
</div>
