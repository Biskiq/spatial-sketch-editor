<script lang="ts">
	import { page } from '$app/state';
	import { goto, replaceState } from '$app/navigation';
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import {
		createProjectAuth,
		createProjectId,
		type ProjectLoginIntent,
		ProjectPersistenceError
	} from '$lib/platform/project-identity';

	const apiOrigin = env.PUBLIC_API_ORIGIN;
	const auth = apiOrigin ? createProjectAuth(apiOrigin) : null;
	let authStatus = $state(page.url.searchParams.get('auth'));
	let authIntent = $state(page.url.searchParams.get('intent'));

	let notice = $state('');
	let pendingDraft = $state(false);
	let redirecting = $state(false);

	/**
	 * The spatial route for one project.
	 *
	 * `create` is the boot intent the route reads (`?create=1`): a freshly minted
	 * identity must say so, or the host cannot tell a mistyped address from a project
	 * it just started and answers "not found" instead of offering the starter gallery.
	 */
	function projectUrl(projectId: string, flags: { create?: boolean } = {}): string {
		const query = flags.create === true ? '?create=1' : '';
		return `/project/${encodeURIComponent(projectId)}/spatial${query}`;
	}

	async function startCreating(): Promise<void> {
		await goto(projectUrl(createProjectId(), { create: true }));
	}

	async function signIn(intent: ProjectLoginIntent = 'projects'): Promise<void> {
		if (!auth) {
			notice = 'Sign-in is unavailable';
			return;
		}
		try {
			notice = '';
			await auth.signIn(intent);
		} catch (error) {
			notice = error instanceof ProjectPersistenceError ? error.message : 'Sign-in failed';
		}
	}

	/** The pending Save is validated only on an auth-return path, so its chunk stays lazy. */
	async function readPendingDraft() {
		try {
			const { readPendingCapture } = await import('$lib/authoring/save/pending-capture');
			return readPendingCapture();
		} catch {
			return null;
		}
	}

	async function discardDraft(): Promise<void> {
		try {
			const { discardPendingCapture } = await import('$lib/authoring/save/pending-capture');
			discardPendingCapture();
		} catch {
			// The draft is already unusable; clearing the notice must still work.
		}
		pendingDraft = false;
		notice = 'Draft discarded';
		authStatus = null;
		authIntent = null;
		replaceState('/', {});
	}

	onMount(() => {
		void (async () => {
			redirecting = authStatus === 'success';
			if (authStatus === 'success' && authIntent === 'projects') {
				void goto('/projects', { replaceState: true });
				return;
			}
			if (authStatus !== 'success' || authIntent !== 'save') {
				if (authIntent === 'save' && (authStatus === 'cancelled' || authStatus === 'failed')) {
					const pending = await readPendingDraft();
					pendingDraft = pending?.status === 'ready';
					notice = authStatus === 'cancelled' ? 'Sign-in was cancelled' : 'Sign-in failed';
				}
				redirecting = false;
				return;
			}

			const pending = await readPendingDraft();
			if (pending === null || pending.status !== 'ready') {
				redirecting = false;
				notice = pending?.status === 'expired' ? 'The saved draft expired' : 'The saved draft is unavailable';
				return;
			}
			void goto(`${projectUrl(pending.project.id)}?resume-save=1`, { replaceState: true });
		})();
	});

</script>

<svelte:head>
	<title>Biskiq Editor</title>
</svelte:head>

<main class="entry-page">
	<svg class="entry-sketch" viewBox="0 0 640 430" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
		<g fill="none" stroke="#f3f0e4" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
			<path d="M320 120 L520 230 L320 340 L120 230 Z" />
			<path d="M120 230 L120 80 L320 -30 L320 120" />
			<path d="M320 120 L320 -30 L520 80 L520 230" />
			<path d="M170 100 L230 67 L230 127 L170 160 Z" />
			<path d="M370 -2 L430 31 L430 91 L370 58 Z" />
			<path d="M230 205 L300 240 L260 260 L190 225 Z" />
		</g>
	</svg>
	<section class="entry-card" aria-labelledby="entry-title">
		<p class="eyebrow">Biskiq Editor</p>
		<h1 id="entry-title">Start a project</h1>
		<p class="lede">Create in Spatial. Sign in when you want cloud projects.</p>
		{#if redirecting}
			<p class="status" role="status">Returning to your project…</p>
		{:else if authStatus === 'cancelled' || authStatus === 'failed'}
			<p class="status" role="alert">{notice}</p>
			<div class="actions">
				{#if pendingDraft}
					<button type="button" class="primary" onclick={() => void signIn('save')}>Retry sign-in</button>
					<button type="button" onclick={() => void discardDraft()}>Discard draft</button>
				{:else}
					<button type="button" class="primary" onclick={() => void signIn('projects')}>Retry sign-in</button>
				{/if}
			</div>
		{:else}
			<div class="actions">
				<button type="button" class="primary" onclick={() => void startCreating()}>Start creating</button>
				<button type="button" disabled={!auth} onclick={() => void signIn('projects')}>Sign in</button>
			</div>
		{/if}
		{#if notice && authStatus !== 'cancelled' && authStatus !== 'failed'}
			<p class="status" role="alert">{notice}</p>
		{/if}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: var(--shell-forest);
		color: var(--shell-ivory);
		font-family: var(--shell-sans);
	}
	.entry-page {
		position: relative;
		display: grid;
		min-height: 100dvh;
		place-items: center;
		padding: 16px;
		box-sizing: border-box;
		overflow: hidden;
		background: var(--shell-forest);
		color: var(--shell-ivory);
	}
	.entry-sketch {
		position: absolute;
		left: 50%;
		top: 50%;
		width: min(720px, 140%);
		transform: translate(-50%, -50%);
		opacity: 0.12;
		pointer-events: none;
	}
	.entry-card {
		position: relative;
		width: min(30rem, 100%);
		box-sizing: border-box;
		padding: 2rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.05);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
	}
	.eyebrow {
		margin: 0 0 0.8rem;
		color: var(--shell-gold);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-family: var(--shell-serif);
		font-weight: 500;
		font-size: clamp(1.8rem, 6vw, 2.2rem);
		line-height: 1.1;
		color: var(--shell-ivory);
	}
	.lede {
		margin: 0.9rem 0 0;
		color: #cdd8d1;
		line-height: 1.5;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 1.5rem;
	}
	button {
		padding: 0.65rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.28);
		border-radius: 8px;
		background: transparent;
		color: var(--shell-ivory);
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.08);
	}
	button:disabled {
		cursor: default;
		opacity: 0.45;
	}
	button.primary {
		border-color: var(--shell-gold);
		background: var(--shell-gold);
		color: var(--shell-forest);
		font-weight: 600;
	}
	button.primary:hover:not(:disabled) {
		background: #e0bb58;
		border-color: #e0bb58;
	}
	button:focus-visible {
		outline: 2px solid var(--shell-gold);
		outline-offset: 2px;
	}
	.status {
		margin: 1rem 0 0;
		color: #f2c6bd;
		line-height: 1.4;
	}
	@media (max-width: 480px) {
		.entry-card {
			padding: 1.5rem;
		}
	}
</style>
