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
	} from '$lib/platform/project-persistence';
	import {
		discardPendingCapture,
		readPendingCapture
	} from '$lib/authoring/save/pending-capture';

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

	function discardDraft(): void {
		discardPendingCapture();
		pendingDraft = false;
		notice = 'Draft discarded';
		authStatus = null;
		authIntent = null;
		replaceState('/', {});
	}

	onMount(() => {
		redirecting = authStatus === 'success';
		if (authStatus === 'success' && authIntent === 'projects') {
			void goto('/projects', { replaceState: true });
			return;
		}
		if (authStatus !== 'success' || authIntent !== 'save') {
			if (authIntent === 'save' && (authStatus === 'cancelled' || authStatus === 'failed')) {
				pendingDraft = readPendingCapture().status === 'ready';
				notice = authStatus === 'cancelled' ? 'Sign-in was cancelled' : 'Sign-in failed';
			}
			redirecting = false;
			return;
		}

		const pending = readPendingCapture();
		if (pending.status !== 'ready') {
			redirecting = false;
			notice = pending.status === 'expired' ? 'The saved draft expired' : 'The saved draft is unavailable';
			return;
		}
		void goto(`${projectUrl(pending.project.id)}?resume-save=1`, { replaceState: true });
	});
</script>

<svelte:head>
	<title>Museum Editor</title>
</svelte:head>

<main class="entry-page">
	<section class="entry-card" aria-labelledby="entry-title">
		<p class="eyebrow">Museum Editor</p>
		<h1 id="entry-title">Start a project</h1>
		<p class="lede">Create in Spatial. Sign in when you want cloud projects.</p>
		{#if redirecting}
			<p class="status" role="status">Returning to your project…</p>
		{:else if authStatus === 'cancelled' || authStatus === 'failed'}
			<p class="status" role="alert">{notice}</p>
			<div class="actions">
				{#if pendingDraft}
					<button type="button" class="primary" onclick={() => void signIn('save')}>Retry sign-in</button>
					<button type="button" onclick={discardDraft}>Discard draft</button>
				{:else}
					<button type="button" class="primary" onclick={() => void signIn('projects')}>Retry sign-in</button>
				{/if}
			</div>
		{:else}
			<div class="actions">
				<button type="button" class="primary" onclick={() => void startCreating()}>Start creating</button>
				<button type="button" disabled={!auth} onclick={() => void signIn('projects')}>Continue with Google</button>
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
		background: #111117;
		color: #f4f0e9;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	.entry-page { display: grid; min-height: 100dvh; place-items: center; padding: 1.5rem; box-sizing: border-box; background: radial-gradient(circle at 50% 0%, #302b38, #111117 58%); }
	.entry-card { width: min(30rem, 100%); padding: 2rem; border: 1px solid #4d4655; border-radius: 0.8rem; background: rgb(25 24 31 / 92%); box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 28%); }
	.eyebrow { margin: 0 0 0.8rem; color: #c9a9ff; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
	h1 { margin: 0; font-size: clamp(1.8rem, 5vw, 2.8rem); line-height: 1.05; }
	.lede { margin: 1rem 0 0; color: #bcb5c4; line-height: 1.5; }
	.actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1.5rem; }
	button { padding: 0.65rem 0.85rem; border: 1px solid #635a6f; border-radius: 0.4rem; background: #292632; color: inherit; font: inherit; cursor: pointer; }
	button:hover:not(:disabled) { border-color: #c9a9ff; }
	button:disabled { cursor: default; opacity: 0.45; }
	button.primary { border-color: #b997f2; background: #8f69c8; color: #fff; }
	.status { margin: 1rem 0 0; color: #e3c4c4; line-height: 1.4; }
</style>
