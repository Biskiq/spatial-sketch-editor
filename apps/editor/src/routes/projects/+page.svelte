<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';
	import { env } from '$env/dynamic/public';
	import ProjectLifecycleActions from '$lib/platform/ProjectLifecycleActions.svelte';
	import { isSavedBaseToken } from '@portfolio/project-model/save';
	import {
		createProjectApi,
		createProjectAuth,
		createProjectId,
		ProjectPersistenceError,
		type PreparedProjectLifecycle,
		type ProjectLifecycleActionResult,
		type ProjectLifecyclePrepareResult,
		type ProjectSession,
		type ProjectSummary
	} from '$lib/platform/project-persistence';

	const apiOrigin = env.PUBLIC_API_ORIGIN;
	const auth = apiOrigin ? createProjectAuth(apiOrigin) : null;
	const api = createProjectApi({ apiOrigin });

	let sessionStatus = $state<'checking' | 'authenticated' | 'unauthenticated' | 'error'>('checking');
	let projects = $state<ProjectSummary[]>([]);
	let notice = $state('');
	let busy = $state(false);
	let lifecycleBusyIds = $state<Set<string>>(new Set());
	let noticeElement = $state<HTMLElement | null>(null);

	/**
	 * The spatial route for one project, with its explicit entry flags.
	 *
	 * `create` is the boot intent the route reads (`?create=1`): only a freshly minted
	 * identity carries it, so an absent row answers with the starter gallery instead
	 * of "not found". `load` asks the host to read the owned cloud project.
	 */
	function projectUrl(projectId: string, flags: { load?: boolean; create?: boolean } = {}): string {
		const query = [
			flags.create === true ? 'create=1' : '',
			flags.load === true ? 'load=1' : ''
		].filter((part) => part !== '');
		return `/project/${encodeURIComponent(projectId)}/spatial${query.length > 0 ? `?${query.join('&')}` : ''}`;
	}

	async function startCreating(): Promise<void> {
		await goto(projectUrl(createProjectId(), { create: true }));
	}

	async function signIn(): Promise<void> {
		if (!auth) {
			notice = 'Sign-in is unavailable';
			return;
		}
		try {
			notice = '';
			await auth.signIn('projects');
		} catch (error) {
			notice = error instanceof ProjectPersistenceError ? error.message : 'Sign-in failed';
		}
	}

	async function signOut(): Promise<void> {
		if (!auth || busy || lifecycleBusyIds.size > 0) return;
		busy = true;
		try {
			await auth.signOut();
			projects = [];
			sessionStatus = 'unauthenticated';
			notice = 'Signed out';
		} catch (error) {
			notice = error instanceof ProjectPersistenceError ? error.message : 'Sign-out failed';
		} finally {
			busy = false;
		}
	}

	async function prepareProjectAction(projectId: string, includePublication: boolean): Promise<ProjectLifecyclePrepareResult> {
		if (!api) return { kind: 'blocked', message: 'Cloud project actions are unavailable because the Cloud service is not configured.' };
		try {
			const [loaded, publication] = await Promise.all([
				api.loadProject(projectId),
				includePublication ? api.getPublicationStatus(projectId) : Promise.resolve(null)
			]);
			if (loaded.projectId !== projectId) return { kind: 'error', message: 'Cloud returned metadata for another project.' };
			if (!isSavedBaseToken(loaded.savedBaseToken)) {
				return { kind: 'blocked', message: 'This project has no current Cloud saved base. Reload it before renaming or deleting.' };
			}
			const prepared: PreparedProjectLifecycle = {
				projectId,
				name: loaded.name,
				version: loaded.version,
				precondition: { kind: 'expected-saved-base', token: loaded.savedBaseToken },
				...(publication === null ? {} : { publication })
			};
			return { kind: 'ready', prepared };
		} catch (error) {
			return { kind: 'error', message: error instanceof ProjectPersistenceError ? error.message : 'Cloud project metadata could not be loaded.' };
		}
	}

	function updateLifecycleBusy(projectId: string, active: boolean): void {
		const next = new Set(lifecycleBusyIds);
		if (active) next.add(projectId);
		else next.delete(projectId);
		lifecycleBusyIds = next;
	}

	async function resolveLifecycleConflict(projectId: string, includePublication: boolean): Promise<ProjectLifecycleActionResult> {
		const fresh = await prepareProjectAction(projectId, includePublication);
		if (fresh.kind === 'stale') return { kind: 'stale' };
		if (fresh.kind !== 'ready') return { kind: 'refused', message: fresh.message };
		if (includePublication && (fresh.prepared.publication === undefined || fresh.prepared.publication.activeVersion !== null)) {
			return { kind: 'refused', message: 'Unpublish this project before deleting it.' };
		}
		return {
			kind: 'conflict',
			message: 'The Cloud saved base changed.',
			remoteName: fresh.prepared.name,
			retryPrepared: fresh.prepared
		};
	}

	async function renameProject(prepared: PreparedProjectLifecycle, name: string): Promise<ProjectLifecycleActionResult> {
		if (!api) return { kind: 'refused', message: 'Cloud project actions are unavailable.' };
		try {
			const saved = await api.renameProject(prepared.projectId, { name, precondition: prepared.precondition });
			return { kind: 'renamed', name: saved.name, version: saved.version };
		} catch (error) {
			if (error instanceof ProjectPersistenceError && error.code === 'conflict') {
				return resolveLifecycleConflict(prepared.projectId, false);
			}
			return {
				kind: error instanceof ProjectPersistenceError && ['invalid', 'auth', 'not-found'].includes(error.code) ? 'refused' : 'error',
				message: error instanceof ProjectPersistenceError ? error.message : 'Cloud rename failed.',
				retryable: error instanceof ProjectPersistenceError && ['project-busy', 'network', 'server'].includes(error.code)
			};
		}
	}

	async function deleteProject(prepared: PreparedProjectLifecycle): Promise<ProjectLifecycleActionResult> {
		if (!api) return { kind: 'refused', message: 'Cloud project actions are unavailable.' };
		try {
			const deleted = await api.deleteProject(prepared.projectId, { precondition: prepared.precondition });
			return { kind: 'deleted', cleanup: deleted.cleanup };
		} catch (error) {
			if (error instanceof ProjectPersistenceError && error.code === 'conflict') {
				return resolveLifecycleConflict(prepared.projectId, true);
			}
			if (error instanceof ProjectPersistenceError && error.code === 'unpublish-first') {
				return { kind: 'refused', message: error.message };
			}
			return {
				kind: error instanceof ProjectPersistenceError && ['invalid', 'auth', 'not-found'].includes(error.code) ? 'refused' : 'error',
				message: error instanceof ProjectPersistenceError ? error.message : 'Cloud deletion failed.',
				retryable: error instanceof ProjectPersistenceError && ['project-busy', 'network', 'server'].includes(error.code)
			};
		}
	}

	async function lifecycleCompleted(
		projectId: string,
		result: Extract<ProjectLifecycleActionResult, { kind: 'renamed' | 'deleted' | 'unchanged' }>
	): Promise<void> {
		if (result.kind === 'deleted') projects = projects.filter((project) => project.id !== projectId);
		if (result.kind === 'renamed') {
			projects = projects.map((project) => project.id === projectId ? { ...project, name: result.name, version: result.version } : project);
		}
		notice = result.kind === 'deleted'
			? result.cleanup === 'pending'
				? 'Project access ended; byte cleanup is pending.'
				: 'Project deleted.'
			: result.kind === 'renamed'
				? `Renamed to ${result.name}.`
				: 'Project name unchanged.';
			try {
				if (api) {
					const listed = await api.listProjects();
					projects = [...listed].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
				}
			} catch {
				notice += ' The project list could not be refreshed.';
			}
		await tick();
		noticeElement?.focus();
	}

	async function bootstrap(signal: AbortSignal): Promise<void> {
		if (!auth || !api) {
			sessionStatus = 'unauthenticated';
			return;
		}
		try {
			const session: ProjectSession = await auth.getSession(signal);
			if (!session.authenticated) {
				sessionStatus = 'unauthenticated';
				return;
			}
			sessionStatus = 'authenticated';
			const listed = await api.listProjects(signal);
			// Strict Hub: owned cloud projects by last modification descending.
			projects = [...listed].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
		} catch (error) {
			if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
			if (error instanceof ProjectPersistenceError && error.code === 'auth') {
				sessionStatus = 'unauthenticated';
				projects = [];
			} else {
				sessionStatus = 'error';
				notice = error instanceof ProjectPersistenceError ? error.message : 'Could not load projects';
			}
		}
	}

	onMount(() => {
		const controller = new AbortController();
		const deleted = page.url.searchParams.get('deleted');
		if (deleted === 'complete' || deleted === 'pending') {
			const projectName = page.url.searchParams.get('name');
			notice = deleted === 'pending'
				? `${projectName ? `${projectName}: ` : ''}Project access ended; byte cleanup is pending.`
				: `${projectName ? `${projectName}: ` : ''}Project deleted.`;
		}
		void bootstrap(controller.signal);
		return () => controller.abort();
	});
</script>

<svelte:head>
	<title>Projects — Museum Editor</title>
</svelte:head>

<main class="hub-page">
	<header class="hub-header">
		<a href="/">Museum Editor</a>
		{#if sessionStatus === 'authenticated'}
			<button type="button" disabled={busy || lifecycleBusyIds.size > 0} onclick={() => void signOut()}>Sign out</button>
		{/if}
	</header>
	<section class="hub-card" aria-labelledby="projects-title">
		<p class="eyebrow">Project Hub</p>
		<h1 id="projects-title">Projects</h1>
		<button type="button" class="primary new-project" onclick={() => void startCreating()}>New Project</button>

		{#if sessionStatus === 'checking'}
			<p class="status" role="status">Checking sign-in…</p>
		{:else if sessionStatus === 'authenticated'}
			<h2>My Projects</h2>
			{#if projects.length === 0}
				<p class="muted">No saved projects.</p>
			{:else}
				<ul>
					{#each projects as project (project.id)}
						{@const modified = (() => {
							try {
								return new Date(project.updatedAt).toLocaleString();
							} catch {
								return project.updatedAt;
							}
						})()}
						<li>
							<span><strong>{project.name}</strong><small>v{project.version} · {modified} · Cloud</small></span>
							<div class="row-actions">
								<a href={projectUrl(project.id, { load: true })}>Open</a>
								<ProjectLifecycleActions
									projectId={project.id}
									projectName={project.name}
									variant="hub"
									onPrepareRename={() => prepareProjectAction(project.id, false)}
									onRename={renameProject}
									onPrepareDelete={() => prepareProjectAction(project.id, true)}
									onDelete={deleteProject}
									onBusyChange={(active) => updateLifecycleBusy(project.id, active)}
									onComplete={(result) => lifecycleCompleted(project.id, result)}
									onRefreshRemote={async () => { await bootstrap(new AbortController().signal); }}
								/>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		{:else if sessionStatus === 'error'}
			<p class="status" role="alert">{notice || 'Could not load projects.'}</p>
			<button type="button" class="primary new-project" onclick={() => void startCreating()}>New Project</button>
		{:else}
			<p class="muted">Your work stays in a temporary session until you sign in. No drafts are kept here.</p>
			<button type="button" disabled={!auth} onclick={() => void signIn()}>Sign in</button>
		{/if}
		{#if notice && sessionStatus !== 'error'}<p bind:this={noticeElement} class="status" role="status" tabindex="-1">{notice}</p>{/if}
	</section>
</main>

<style>
	:global(body) { margin: 0; background: #111117; color: #f4f0e9; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
	.hub-page { min-height: 100dvh; background: #111117; }
	.hub-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid #383340; }
	.hub-header a { color: #f4f0e9; font-weight: 700; text-decoration: none; }
	.hub-card { width: min(36rem, calc(100% - 3rem)); margin: 4rem auto; padding: 1.5rem; border: 1px solid #4d4655; border-radius: 0.8rem; background: #19181f; box-sizing: border-box; }
	.eyebrow { margin: 0 0 0.75rem; color: #c9a9ff; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
	h1 { margin: 0; font-size: 2rem; }
	h2 { margin: 2rem 0 0.65rem; font-size: 0.95rem; }
	button, li a { padding: 0.55rem 0.75rem; border: 1px solid #635a6f; border-radius: 0.4rem; background: #292632; color: inherit; font: inherit; cursor: pointer; text-decoration: none; }
	button:hover:not(:disabled), li a:hover { border-color: #c9a9ff; }
	button:disabled { cursor: default; opacity: 0.45; }
	.primary { border-color: #b997f2; background: #8f69c8; color: #fff; }
	.new-project { margin-top: 1.25rem; }
	.muted, .status { color: #bcb5c4; line-height: 1.45; }
	.status { color: #e3c4c4; }
	ul { display: flex; flex-direction: column; gap: 0.45rem; margin: 0; padding: 0; list-style: none; }
	li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.65rem 0.75rem; border: 1px solid #383340; border-radius: 0.4rem; }
	.row-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; }
	li span { display: flex; min-width: 0; flex-direction: column; gap: 0.15rem; }
	li strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	small { color: #bcb5c4; }
	@media (max-width: 38rem) {
		li { align-items: flex-start; flex-direction: column; }
		.row-actions { width: 100%; }
	}
</style>
