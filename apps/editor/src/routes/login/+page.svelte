<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';

	type Mode = 'login' | 'register' | 'enroll';

	const apiOrigin = env.PUBLIC_API_ORIGIN?.replace(/\/+$/, '') ?? '';
	const intentValues = page.url.searchParams.getAll('intent');
	const intent = intentValues.length === 1 && intentValues[0] === 'save' ? 'save' : 'projects';
	const usernamePattern = /^[A-Za-z0-9_.-]{3,32}$/;
	let mode = $state<Mode>('login');
	let username = $state('');
	let password = $state('');
	let busy = $state(false);
	let notice = $state('');
	let currentSession = $state(false);

	function endpoint(path: string): string {
		return `${apiOrigin}${path}`;
	}

	function messageFrom(body: unknown): string | null {
		if (typeof body !== 'object' || body === null || !('error' in body)) return null;
		const error = (body as { error?: unknown }).error;
		if (typeof error !== 'object' || error === null || !('message' in error)) return null;
		const message = (error as { message?: unknown }).message;
		return typeof message === 'string' && message ? message : null;
	}

	onMount(() => {
		if (!apiOrigin) return;
		void fetch(endpoint('/auth/me'), { credentials: 'include' })
			.then(async (response) => {
				if (!response.ok) return;
				const value: unknown = await response.json();
				if (typeof value !== 'object' || value === null || !('authenticated' in value) || value.authenticated !== true) return;
				currentSession = true;
				const credentials = await fetch(endpoint('/auth/credentials'), { credentials: 'include' });
				const enrollment: unknown = credentials.ok ? await credentials.json() : null;
				if (typeof enrollment === 'object' && enrollment !== null && 'enrolled' in enrollment && enrollment.enrolled === false) {
					mode = 'enroll';
				} else {
					void goto(intent === 'save' ? '/?auth=success&intent=save' : '/projects', { replaceState: true });
				}
			})
			.catch(() => undefined);
	});

	function setMode(next: 'login' | 'register'): void {
		mode = next;
		notice = '';
		password = '';
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!apiOrigin) {
			notice = 'Sign-in is unavailable because the Cloud service is not configured.';
			return;
		}
		if (!usernamePattern.test(username)) {
			notice = 'Username must be 3–32 characters using letters, numbers, dot, underscore or hyphen.';
			return;
		}
		if (password.length < 12 || password.length > 128) {
			notice = 'Password must be between 12 and 128 characters.';
			return;
		}

		busy = true;
		notice = '';
		try {
			const path = mode === 'enroll' ? '/auth/credentials' : mode === 'register' ? '/auth/register' : '/auth/login';
			const response = await fetch(endpoint(path), {
				method: 'POST',
				credentials: 'include',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ username, password })
			});
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok) throw new Error(messageFrom(body) ?? 'Sign-in was rejected. Check your details and try again.');
			if (typeof body !== 'object' || body === null || !('authenticated' in body) || body.authenticated !== true) {
				throw new Error('The server did not confirm the sign-in session.');
			}
			await goto(intent === 'save' ? '/?auth=success&intent=save' : '/?auth=success&intent=projects', { replaceState: true });
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Sign-in failed. Try again.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in · Museum Editor</title>
</svelte:head>

<main class="login-page">
	<section class="login-card" aria-labelledby="login-title">
		<p class="eyebrow">Museum Editor</p>
		<h1 id="login-title">{mode === 'enroll' ? 'Set up your password' : mode === 'register' ? 'Create an account' : 'Sign in'}</h1>
		<p class="lede">
			{mode === 'enroll'
				? 'Choose a username and password for this existing account. Your projects stay with it.'
				: mode === 'register'
					? 'Create an account to save and open your cloud projects.'
					: 'Sign in to save and open your cloud projects.'}
		</p>
		{#if currentSession && mode !== 'enroll'}
			<p class="status">You are already signed in.</p>
			<a class="button primary" href={intent === 'save' ? '/?auth=success&intent=save' : '/projects'}>Continue</a>
		{:else if !apiOrigin}
			<p class="status" role="alert">Sign-in needs the Cloud API. You can still edit locally.</p>
		{:else}
			<form onsubmit={submit}>
				<label for="username">Username</label>
				<input id="username" name="username" bind:value={username} autocomplete="username" minlength="3" maxlength="32" required />
				<label for="password">{mode === 'login' ? 'Password' : 'New password'}</label>
				<input
					id="password"
					name="password"
					type="password"
					bind:value={password}
					autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
					minlength="12"
					maxlength="128"
					required
				/>
				<p class="hint">Use 12–128 characters for the password.</p>
				{#if notice}<p class="status" role="alert">{notice}</p>{/if}
				<button class="primary" type="submit" disabled={busy}>
					{busy ? 'Please wait…' : mode === 'enroll' ? 'Save password' : mode === 'register' ? 'Create account' : 'Sign in'}
				</button>
			</form>
			{#if mode !== 'enroll'}
				<p class="switch">
					{mode === 'login' ? 'New here?' : 'Already have an account?'}
					<button type="button" class="text-button" disabled={busy} onclick={() => setMode(mode === 'login' ? 'register' : 'login')}>
						{mode === 'login' ? 'Create an account' : 'Sign in'}
					</button>
				</p>
			{/if}
		{/if}
		<a class="back-link" href="/">Back to editing</a>
	</section>
</main>

<style>
	:global(body) { margin: 0; background: #111117; color: #f4f0e9; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
	.login-page { display: grid; min-height: 100dvh; place-items: center; padding: 1.5rem; box-sizing: border-box; background: radial-gradient(circle at 50% 0%, #302b38, #111117 58%); }
	.login-card { width: min(30rem, 100%); padding: 2rem; border: 1px solid #4d4655; border-radius: 0.8rem; background: rgb(25 24 31 / 92%); box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 28%); box-sizing: border-box; }
	.eyebrow { margin: 0 0 0.8rem; color: #c9a9ff; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
	h1 { margin: 0; font-size: clamp(1.8rem, 5vw, 2.8rem); line-height: 1.05; }
	.lede { margin: 1rem 0 1.5rem; color: #bcb5c4; line-height: 1.5; }
	form { display: grid; gap: 0.55rem; }
	label { margin-top: 0.6rem; font-size: 0.88rem; font-weight: 650; }
	input { width: 100%; padding: 0.7rem 0.75rem; border: 1px solid #635a6f; border-radius: 0.4rem; background: #111117; color: inherit; font: inherit; box-sizing: border-box; }
	input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid #c9a9ff; outline-offset: 2px; }
	.hint { margin: 0.1rem 0 0.5rem; color: #bcb5c4; font-size: 0.8rem; }
	button, .button { display: inline-block; width: fit-content; padding: 0.65rem 0.85rem; border: 1px solid #635a6f; border-radius: 0.4rem; background: #292632; color: inherit; font: inherit; cursor: pointer; text-decoration: none; }
	button:hover:not(:disabled), .button:hover { border-color: #c9a9ff; }
	button:disabled { cursor: default; opacity: 0.55; }
	.primary { border-color: #b997f2; background: #8f69c8; color: #fff; }
	.status { color: #e3c4c4; line-height: 1.4; }
	.switch { display: flex; align-items: center; gap: 0.4rem; color: #bcb5c4; font-size: 0.9rem; }
	.text-button { padding: 0; border: 0; background: transparent; color: #d4baff; text-decoration: underline; }
	.back-link { display: inline-block; margin-top: 1.3rem; color: #d4baff; }
</style>
