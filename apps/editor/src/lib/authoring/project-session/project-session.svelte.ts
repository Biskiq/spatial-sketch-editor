/** Project loading, replacement, lifecycle actions and the epoch's Head Save. */
import { beforeNavigate, goto, replaceState } from '$app/navigation';
import { ProjectPersistenceError, type ProjectApi, type ProjectAuth, type PreparedProjectLifecycle, type ProjectLifecycleActionResult, type ProjectLifecyclePrepareResult } from '$lib/platform/project-persistence';
import { perfMark, perfMeasureSync } from '$lib/platform/perf-marks';
import { discardPendingCapture, persistPendingCapture, readPendingCapture } from '$lib/authoring/save/pending-capture';
import { isSavedBaseToken, type SaveRequest } from '@portfolio/project-model/save';
import { serializeProjectEnvelope, validateProjectEnvelope, type ProjectEnvelope } from '@portfolio/project-model/units';
import { verifyArtworkLibrary } from '$lib/authoring/artwork/project-artwork';
import { LAYOUT_DIMENSION_LIMIT_MESSAGE } from '@portfolio/layout-core';
import { bootEmpty, bootFromLoadOutcome, bootFromSourceJson, bootStarterGallery, initialBootState, type BootIntent, type BootLoadOutcome, type BootState } from '$lib/authoring/stage/boot-state';
import type { AdmissionContext, StageReadSnapshot } from '$lib/authoring/stage/source-admission';
import { runBoundLoad, type ReplacementEpochToken, type StageSession } from '$lib/authoring/stage/stage-session';
import type { StageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import { createApiSaveTransport, createHeadSave, createSaveState, type HeadSave, type ReloadOffer } from '$lib/authoring/save';

export function createProjectSession(host: {
	readonly projectId: string;
	readonly intent: BootIntent;
	readonly api: ProjectApi | null;
	readonly auth: ProjectAuth | null;
	readonly session: StageSession;
	url(): URL;
	acceptance(): StageAcceptanceHost | null;
	tornDown(): boolean;
	activate(snapshot: StageReadSnapshot): void;
	notice: string;
}) {
	const { projectId, intent, api, auth, session } = host;
	let boot = $state<BootState>(initialBootState(projectId, intent));
	let pendingSavedBase = $state.raw<{ readonly token: string | null; readonly revision: { readonly projectId: string; readonly revisionId: string } | null; readonly contentId: string | null } | null>(null);
	let headSave = $state.raw<HeadSave | null>(null);
	let resumeOffer = $state.raw<{ readonly save: SaveRequest; readonly project: ProjectEnvelope } | null>(null);
	let resumeSource: SaveRequest | null = null;
	let remoteSavedCanonicalJson: string | null = null;
	let headSaveVersion = $state(0);
	let unsubscribeHeadSave: (() => void) | null = null;
	let projectActionBusy = $state(false);
	let deleteNavigationAuthorized = false;
	let preparedLifecycleEpoch: ReplacementEpochToken | null = null;
	let pendingReplacement = $state<null | 'starter' | 'empty' | 'source'>(null);
	let epochCounter = 0;
	let revisionCounter = 0;

	function admissionContext(): AdmissionContext {
		epochCounter += 1;
		revisionCounter += 1;
		return {
			sessionEpoch: `session-${epochCounter}-${projectId}`,
			acceptedRevision: { projectId, revisionId: `revision-${revisionCounter}` }
		};
	}

	/** Build one conditional-Save controller against the loaded or minted baseline. */
	function buildHeadSave(mounted: StageAcceptanceHost, snapshot: StageReadSnapshot): HeadSave | null {
		if (api === null) return null;
		const saved = pendingSavedBase;
		const closure = snapshot.domain.closure;
		const state = createSaveState({
			coordinator: mounted.coordinator(),
			save: createApiSaveTransport(api),
			resume: resumeSource,
			onAuthRequired: async (request) => {
				// Capture the exact unit Save before the platform redirect. The draft
				// carries the precondition and operation ID, so the return visit can
				// resume it rather than mint a new write from a moved base. A redirect
				// without that draft would lose the operation, so storage failure keeps
				// the creator here with a visible reason instead of signing in.
				if (!persistPendingCapture(request)) {
					host.notice =
						'The pending Save could not be stored in this browser; sign-in was not started. Retry when browser storage is available.';
					return;
				}
				await auth?.signIn('save');
			},
			baseline: {
				savedBaseToken: saved?.token ?? null,
				// Only the cloud row knows the saved revision; a minted baseline and a
				// legacy row both report none rather than a locally invented one.
				savedRevision: saved?.revision ?? null,
				savedCanonicalJson: remoteSavedCanonicalJson ?? snapshot.canonicalJson,
				savedSourceContentId: saved?.contentId ?? snapshot.sourceContentId
			},
			loadRemote: async (id) => {
				const loaded = await api!.loadProject(id);
				return {
					projectId: id,
					document: loaded.document,
					savedBaseToken: loaded.savedBaseToken,
					savedRevision: loaded.savedRevision,
					savedSourceContentId: loaded.savedSourceContentId
				};
			}
		});
		return createHeadSave(state, {
			unavailableReason:
				closure.length === 0
					? null
					: `This source cannot execute (${closure[0]!.code}): ${closure[0]!.message} Save is unavailable until the resource requirement is satisfied.`
		});
	}

	function applyState(next: BootState): void {
		// Every entry on this route is a replacement: a cloud boot, an explicit
		// current-format source open, the starter gallery or the empty baseline each
		// start a new project baseline, so they get a fresh session epoch and a fresh
		// view. The **content-change** transition (same project, new content, view
		// kept) is the seam's own install path, proved in `stage-content-change.test.ts`
		// and reached by accepted editing commands through the Stage acceptance host.
		if (next.status === 'ready' || next.status === 'empty') host.activate(next.snapshot);
		boot = next;
	}

	/**
	 * A refused **local** source action keeps the mounted project.
	 *
	 * An explicit Open or a conflict *Reload remote* is an attempt to replace the
	 * source on screen, not a fresh boot. The session, facade, acceptance history,
	 * selection and saved base all still describe the mounted project, so a
	 * refused parse, format or compile must be reported as a typed notice rather
	 * than assigned to `boot`: the template unmounts the Stage for a non-mounted
	 * state and offers no way back. Only an admitted replacement may reach
	 * `applyState`.
	 */
	function reportSourceRefusal(next: BootState, action: 'open' | 'reload'): void {
		const outcome = action === 'open' ? 'The source was not opened' : 'The remote copy was not installed';
		if (next.status === 'refused') {
			if (next.reason === 'dimension-limit') {
				host.notice = `${outcome}: ${LAYOUT_DIMENSION_LIMIT_MESSAGE} The current project is unchanged.`;
				return;
			}
			const reason =
				next.reason === 'invalid-json'
					? 'the JSON did not parse'
					: next.reason === 'project-mismatch'
						? 'it belongs to another project'
						: 'it is not the current document format';
			const issue = next.issues[0];
			host.notice = `${outcome}: ${reason}. The current project is unchanged.${
				issue === undefined ? '' : ` (${issue.path}: ${issue.message})`
			}`;
			return;
		}
		if (next.status === 'diagnostics') {
			const issue = next.issues[0];
			host.notice = `${outcome}: its canonical compile is blocked. The current project is unchanged.${
				issue === undefined ? '' : ` (${issue.path}: ${issue.message})`
			}`;
			return;
		}
		host.notice = `${outcome}: ${
			next.status === 'error' ? next.message : 'the source is unavailable'
		}. The current project is unchanged.`;
	}

	/* --- boot -------------------------------------------------------------- */

	async function load(projectIdToLoad: string, requestedIntent: BootIntent): Promise<void> {
		// A read is a new epoch's source: no previous saved base, saved bytes or
		// previous epoch's Save controller may survive into it.
		pendingSavedBase = null;
		remoteSavedCanonicalJson = null;
		headSave = null;
		boot = initialBootState(projectIdToLoad, requestedIntent);
		// A minted identity is a local editing intent, not a request to discover
		// whether the cloud happens to be reachable. Admit the empty baseline through
		// the same source path as every other mounted Stage and leave Save create-only.
		// Explicit opens still perform a cloud read so missing/forbidden/network
		// outcomes remain distinct.
		if (requestedIntent === 'create') {
			const token = session.token();
			const next = await bootEmpty(projectIdToLoad, admissionContext());
			if (!session.isCurrent(token)) return;
			applyState(next);
			perfMark(next.status === 'empty' ? 'f2:create-empty' : `f2:create-${next.status}`);
			if (next.status === 'empty') offerResumeSave({ createOnly: true });
			return;
		}
		if (api === null) {
			boot = { status: 'error', projectId: projectIdToLoad, message: 'Cloud service is unavailable' };
			return;
		}
		const token = session.token();
		// The cloud row's saved base is held per attempt, never in route state: a load
		// that a replacement or a local open supersedes must not leave its token behind.
		const captured: { base: typeof pendingSavedBase } = { base: null };
		let outcome: BootLoadOutcome | null;
		try {
			// The host performs only the project GET, as a load bound to this session
			// epoch: a replacement or teardown aborts it exactly once, and a completion
			// that lands after either is dropped instead of installing itself over the
			// newer source.
			outcome = await runBoundLoad(session, (signal) => fetchOutcome(projectIdToLoad, signal, captured, requestedIntent));
		} catch {
			// The GET was cancelled: the replacement that cancelled it owns the stage now.
			return;
		}
		if (outcome === null) return;
		const next = await bootFromLoadOutcome(boot, outcome, admissionContext());
		// Admission is asynchronous too, so the same question is asked again with its
		// answer: a replacement or teardown that happened during it still wins.
		if (!session.isCurrent(token)) return;
		// Only now, with the currency check passed, does this load's base become the
		// epoch's base: the save state built by `activate` reads it once, and only a
		// source that actually admitted gets a base to pair with.
		if (next.status === 'ready' || next.status === 'empty') {
			pendingSavedBase = captured.base;
			// The cloud row's canonical bytes are the saved side of a resumed capture's
			// dirty comparison; the captured bytes are the local work.
			remoteSavedCanonicalJson = next.snapshot.canonicalJson;
		}
		applyState(next);
		perfMark(next.status === 'ready' || next.status === 'empty' ? 'f2:cloud-admitted' : `f2:cloud-${next.status}`);
		// A loaded source is offered with whatever precondition its capture states.
		// An absent row is different: only a create-only capture can describe a Save
		// the server could still accept, so the offer is deliberately narrowed there.
		// The boot state itself is unchanged — `new` stays `new`, `missing` stays
		// `missing`; the offer is a separate, explicit creator action.
		if (next.status === 'ready' || next.status === 'empty') offerResumeSave({ createOnly: false });
		else if (next.status === 'new' || next.status === 'missing') offerResumeSave({ createOnly: true });
	}

	/**
	 * TD-9 — offer, never auto-run, a Save captured before the sign-in redirect.
	 *
	 * The `/` auth return path lands here with `resume-save=1`. A create-only
	 * capture is offered even when the cloud row is still absent: the Save never
	 * reached the server, so the return visit's 404 is exactly why the pending work
	 * must remain resumable. The draft's exact operation identity and precondition
	 * are preserved; mounting and retrying it are both explicit creator actions.
	 */
	function offerResumeSave(options: { readonly createOnly: boolean }): void {
		const url = new URL(host.url());
		if (url.searchParams.get('resume-save') !== '1') return;
		const pending = readPendingCapture();
		if (pending.status !== 'ready' || pending.project.id !== projectId) {
			// Consume the flag only once a draft was actually considered, so a direct
			// visit cannot leave a stale flag that re-offers a later draft by accident.
			url.searchParams.delete('resume-save');
			replaceState(`${url.pathname}${url.search}`, {});
			host.notice =
				pending.status === 'expired'
					? 'The pending Save expired; the cloud copy is unchanged.'
					: 'The pending Save is unavailable; the cloud copy is unchanged.';
			return;
		}
		if (options.createOnly && pending.save.capture.precondition.kind !== 'create-only') {
			// A row that does not exist cannot satisfy an expected saved base. Keep
			// the normal boot state and leave the flag for the next real load retry.
			return;
		}
		// Consume the flag so a refresh cannot re-offer a draft this visit resolved.
		url.searchParams.delete('resume-save');
		replaceState(`${url.pathname}${url.search}`, {});
		resumeOffer = pending;
		host.notice = 'A Save captured before sign-in is available. Resume it to save exactly that work.';
	}

	/**
	 * Mount the captured local source and replay its exact Save.
	 *
	 * Resuming is a **source replacement**, so it asks the same unsaved-work
	 * question as every other replacement: cancelling preserves the mounted
	 * content, selection, history and saved base. Admission is asynchronous, so the
	 * session token captured before it must still be current afterwards; a newer
	 * replacement wins and the captured source is never installed over it.
	 *
	 * The captured precondition is the base that Save states, so the server — not
	 * this host — decides whether that base still matches. A moved base answers a
	 * typed conflict and preserves the local work.
	 */
	async function resumePendingSave(): Promise<void> {
		const offer = resumeOffer;
		if (offer === null) return;
		// The Head disables Save for a source with executable closure. Resuming is
		// the same Save command, so it must respect the same visible refusal rather
		// than bypass the control and rely on the server to reject it.
		const control = headSave?.control();
		if (control?.unavailable === true) {
			host.notice = control.reason ?? 'Save is unavailable for this source.';
			return;
		}
		if (activeProject()) {
			const unsaved = headSave?.unsavedWork();
			if (
				unsaved?.kind === 'confirm' &&
				typeof window !== 'undefined' &&
				!window.confirm(unsaved.message)
			) {
				return;
			}
		}
		const token = session.token();
		// The captured Save states the local acceptance revision its operation was
		// minted under. Re-admitting the same bytes under a fresh revision would
		// make the retained capture un-replayable (the state compares revisions),
		// so the epoch is new but the acceptance identity is the capture's own.
		const context = admissionContext();
		const next = await bootFromSourceJson(offer.save.capture.canonicalJson, projectId, {
			sessionEpoch: context.sessionEpoch,
			acceptedRevision: offer.save.capture.acceptedRevision
		});
		// The admission is asynchronous: a replacement or teardown that happened
		// while it ran owns the Stage now, and this older capture must not overwrite
		// it. The offer remains available for an explicit retry.
		if (!session.isCurrent(token)) return;
		if (next.status !== 'ready' && next.status !== 'empty') {
			reportSourceRefusal(next, 'reload');
			return;
		}
		if (next.snapshot.domain.scene.entities.some((entity) => entity.kind === 'artwork') ||
			offer.project.units.scene.data.artworkLibrary?.length) {
			try {
				await runBoundLoad(session, (signal) => verifyOpenedArtwork(offer.project, signal));
			} catch (error) {
				if (session.isCurrent(token)) host.notice = error instanceof Error ? error.message : 'Artwork could not be verified.';
				return;
			}
			if (!session.isCurrent(token)) return;
		}
		const precondition = offer.save.capture.precondition;
		pendingSavedBase = {
			token: precondition.kind === 'expected-saved-base' ? precondition.token : null,
			revision: pendingSavedBase?.revision ?? null,
			contentId: pendingSavedBase?.contentId ?? null
		};
		resumeSource = offer.save;
		resumeOffer = null;
		applyState(next);
		const outcome = await headSave?.retry();
		switch (outcome?.kind) {
			case 'saved':
				discardPendingCapture();
				host.notice = 'The pending Save completed.';
				break;
			case 'dirty':
				discardPendingCapture();
				host.notice = 'The pending Save completed; newer edits remain local.';
				break;
			case 'conflict':
				discardPendingCapture();
				host.notice = 'The cloud copy changed; the pending Save was not applied. Resolve the conflict explicitly.';
				break;
			case 'refused':
				host.notice = outcome.message;
				// A refused capture cannot become a successful replay under the same
				// operation ID; the state machine has already dropped it. Keep it only
				// for the resumable auth-required case.
				if (headSave?.snapshot().pending !== true) discardPendingCapture();
				break;
			case 'error':
				host.notice = outcome.message;
				break;
			default:
				break;
		}
	}

	function dismissResumeOffer(): void {
		resumeOffer = null;
		discardPendingCapture();
		host.notice = 'The pending Save was discarded; the cloud copy is unchanged.';
	}

	async function verifyOpenedArtwork(document: unknown, signal: AbortSignal): Promise<void> {
		const validated = validateProjectEnvelope(document);
		if (!validated.success || api === null) return;
		await verifyArtworkLibrary(api, projectId, validated.envelope.units.scene.data, signal);
	}

	async function fetchOutcome(
		projectIdToLoad: string,
		signal: AbortSignal,
		captured: { base: typeof pendingSavedBase },
		requestedIntent: BootIntent
	): Promise<BootLoadOutcome> {
		try {
			const loaded = await api!.loadProject(projectIdToLoad, signal);
			await verifyOpenedArtwork(loaded.document, signal);
			// Capture the cloud row's saved base with the document it describes: the
			// save state is built from this pair, never from the admitted snapshot
			// alone (which cannot know the server's version token).
			captured.base = {
				token: loaded.savedBaseToken,
				revision: loaded.savedRevision,
				contentId: loaded.savedSourceContentId
			};
			return { kind: 'loaded', document: loaded.document };
		} catch (error) {
			// An abort is not a cloud answer, so it must not become one: rethrow so the
			// bound load drops the whole attempt.
			if (signal.aborted) throw error;
			// A minted guest identity starts local work before authentication. An
			// unrelated Open still reports forbidden, and Save remains create-only: no
			// project row is created until the creator explicitly saves.
			if (requestedIntent === 'create' && error instanceof ProjectPersistenceError && error.code === 'auth') {
				return { kind: 'not-found' };
			}
			return loadOutcomeFromError(error);
		}
	}

	function loadOutcomeFromError(error: unknown): BootLoadOutcome {
		if (error instanceof ProjectPersistenceError) {
			if (error.code === 'not-found') return { kind: 'not-found' };
			if (error.code === 'auth') return { kind: 'forbidden' };
			if (error.code === 'network') return { kind: 'network' };
			return { kind: 'server', message: error.message };
		}
		return { kind: 'server', message: error instanceof Error ? error.message : 'Project could not be loaded.' };
	}

	function activeProject(): boolean {
		return boot.status === 'ready' || boot.status === 'empty';
	}

	function confirmUnsavedWork(): boolean {
		const unsaved = headSave?.unsavedWork();
		if (unsaved?.kind !== 'confirm') return true;
		return typeof window === 'undefined' || window.confirm(unsaved.message);
	}

	type LifecycleRead = {
		loaded: Awaited<ReturnType<ProjectApi['loadProject']>>;
		envelope: ProjectEnvelope;
		canonicalJson: string;
		publication: Awaited<ReturnType<ProjectApi['getPublicationStatus']>> | null;
	};

	function parseLifecycleEnvelope(loaded: Awaited<ReturnType<ProjectApi['loadProject']>>):
		| { kind: 'ready'; envelope: ProjectEnvelope; canonicalJson: string }
		| { kind: 'error'; message: string } {
		const validation = validateProjectEnvelope(loaded.document);
		if (
			!validation.success ||
			loaded.projectId !== projectId ||
			validation.envelope.id !== projectId ||
			loaded.name !== validation.envelope.name
		) {
			return { kind: 'error', message: 'Cloud returned an invalid or mismatched project document.' };
		}
		if (
			loaded.savedRevision !== null &&
			(loaded.savedRevision.projectId !== validation.envelope.acceptedRevision.projectId ||
				loaded.savedRevision.revisionId !== validation.envelope.acceptedRevision.revisionId)
		) {
			return { kind: 'error', message: 'Cloud project metadata does not match its saved document.' };
		}
		return {
			kind: 'ready',
			envelope: validation.envelope,
			canonicalJson: serializeProjectEnvelope(validation.envelope)
		};
	}

	function isMetadataOnlyRemoteChange(next: ProjectEnvelope): boolean {
		if (remoteSavedCanonicalJson === null) return false;
		let previous: ProjectEnvelope;
		try {
			const validation = validateProjectEnvelope(JSON.parse(remoteSavedCanonicalJson) as unknown);
			if (!validation.success || validation.envelope.id !== projectId) return false;
			previous = validation.envelope;
		} catch {
			return false;
		}
		return (
			serializeProjectEnvelope({
			...next,
			name: previous.name,
			acceptedRevision: previous.acceptedRevision
		}) === remoteSavedCanonicalJson
		);
	}

	function sameLifecycleEpoch(token: ReplacementEpochToken): boolean {
		return (
			session.isCurrent(token) && !host.tornDown() && activeProject() && host.acceptance() !== null
		);
	}

	async function readLifecycleProject(
		includePublication: boolean,
		token: ReplacementEpochToken
	): Promise<
		| { kind: 'ready'; value: LifecycleRead } | { kind: 'stale' } | { kind: 'error'; message: string }> {
		if (api === null) return { kind: 'error', message: 'Cloud project actions are unavailable.' };
		try {
			const value = await runBoundLoad(session, async (signal) => {
				const loaded = await api!.loadProject(projectId, signal);
				if (signal.aborted || !session.isCurrent(token)) return null;
				const publication = includePublication
					? await api!.getPublicationStatus(projectId, signal)
					: null;
				if (signal.aborted || !session.isCurrent(token)) return null;
				return { loaded, publication };
			});
			if (value === null || !session.isCurrent(token)) return { kind: 'stale' };
			const parsed = parseLifecycleEnvelope(value.loaded);
			if (parsed.kind !== 'ready') return parsed;
			return {
				kind: 'ready',
				value: { ...value, envelope: parsed.envelope, canonicalJson: parsed.canonicalJson }
			};
		} catch (error) {
			if (!session.isCurrent(token)) return { kind: 'stale' };
			return {
				kind: 'error',
				message: error instanceof ProjectPersistenceError
					? error.message
					: 'Cloud project metadata could not be loaded.'
			};
		}
	}

	function lifecyclePrepared(value: LifecycleRead): PreparedProjectLifecycle | null {
		if (!isSavedBaseToken(value.loaded.savedBaseToken)) return null;
		return {
			projectId,
			name: value.loaded.name,
			version: value.loaded.version,
			precondition: { kind: 'expected-saved-base', token: value.loaded.savedBaseToken },
			...(value.publication === null ? {} : { publication: value.publication })
		};
	}

	async function adoptRemoteLifecycleMetadata(
		value: LifecycleRead,
		token: ReplacementEpochToken,
		existingLock?: { release(): void }
	): Promise<{ kind: 'adopted' } | { kind: 'stale' } | { kind: 'error'; message: string }> {
		const mounted = host.acceptance();
		const save = headSave;
		const savedRevision = value.loaded.savedRevision ?? value.envelope.acceptedRevision;
		if (mounted === null || save === null || !sameLifecycleEpoch(token)) return { kind: 'stale' };
		const acquired = existingLock === undefined ? mounted.beginProjectAction() : null;
		if (acquired?.kind === 'refused') return { kind: 'error', message: acquired.message };
		try {
			const adopted = await mounted.adoptProjectName({ name: value.loaded.name, savedRevision });
			if (!sameLifecycleEpoch(token)) return { kind: 'stale' };
			if (adopted.kind === 'refused') return { kind: 'error', message: adopted.message };
			const baseline = {
				savedBaseToken: value.loaded.savedBaseToken,
				savedRevision,
				savedCanonicalJson: value.canonicalJson,
				savedSourceContentId: value.loaded.savedSourceContentId
			};
			if (!save.adoptSavedBase(baseline)) {
				return { kind: 'error', message: 'The current Save must finish before Cloud project metadata can be refreshed.' };
			}
			pendingSavedBase = {
				token: value.loaded.savedBaseToken,
				revision: savedRevision,
				contentId: value.loaded.savedSourceContentId
			};
			remoteSavedCanonicalJson = value.canonicalJson;
			return { kind: 'adopted' };
		} finally {
			if (existingLock === undefined && acquired?.kind === 'locked') acquired.release();
		}
	}

	async function prepareProjectLifecycle(includePublication: boolean): Promise<ProjectLifecyclePrepareResult> {
		if (api === null) return { kind: 'blocked', message: 'Cloud project actions are unavailable because the Cloud service is not configured.' };
		if (!activeProject() || pendingSavedBase?.token === null || pendingSavedBase?.token === undefined) {
			return { kind: 'blocked', message: 'Save this project to Cloud before renaming or deleting it.' };
		}
		const saveSnapshot = headSave?.snapshot();
		if (saveSnapshot === undefined || saveSnapshot.busy || saveSnapshot.pending) {
			return { kind: 'blocked', message: 'Finish or retry the current Save before using project actions.' };
		}
		const token = session.token();
		preparedLifecycleEpoch = token;
		const read = await readLifecycleProject(includePublication, token);
		if (read.kind === 'stale') return { kind: 'stale' };
		if (!sameLifecycleEpoch(token)) return { kind: 'stale' };
		if (read.kind === 'error') return { kind: 'error', message: read.message };
		const prepared = lifecyclePrepared(read.value);
		if (prepared === null) return { kind: 'blocked', message: 'This project has no current Cloud saved base. Reload it before renaming or deleting.' };
		if (includePublication && (read.value.publication === null || read.value.publication.activeVersion !== null)) {
			return { kind: 'blocked', message: 'Unpublish this project before deleting it.' };
		}
		if (!isMetadataOnlyRemoteChange(read.value.envelope)) {
			return { kind: 'blocked', message: 'Cloud project content changed. Resolve the Save conflict and reload remote before using project actions.' };
		}
		const savedRevision = read.value.loaded.savedRevision ?? read.value.envelope.acceptedRevision;
		if (
			pendingSavedBase?.token !== read.value.loaded.savedBaseToken ||
			read.value.canonicalJson !== remoteSavedCanonicalJson ||
			savedRevision.revisionId !== pendingSavedBase.revision?.revisionId ||
			read.value.loaded.name !== (boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.name : '')
		) {
			const adopted = await adoptRemoteLifecycleMetadata(read.value, token);
			if (adopted.kind === 'stale') return { kind: 'stale' };
			if (adopted.kind === 'error') return { kind: 'blocked', message: adopted.message };
		}
		if (!sameLifecycleEpoch(token)) return { kind: 'stale' };
		preparedLifecycleEpoch = token;
		return { kind: 'ready', prepared };
	}

	function retryableLifecycleError(error: unknown): boolean {
		return (
			error instanceof ProjectPersistenceError && ['network', 'server', 'project-busy'].includes(error.code)
		);
	}

	async function runBoundProjectAction<T>(
		token: ReplacementEpochToken,
		start: (signal: AbortSignal) => Promise<T>
	): Promise<{ kind: 'value'; value: T } | { kind: 'stale' }> {
		const controller = new AbortController();
		const unregister = session.writers().register('project-action', token, () => controller.abort());
		try {
			const value = await start(controller.signal);
			if (controller.signal.aborted || !sameLifecycleEpoch(token)) return { kind: 'stale' };
			return { kind: 'value', value };
		} catch (error) {
			if (controller.signal.aborted || !sameLifecycleEpoch(token)) return { kind: 'stale' };
			throw error;
		} finally {
			unregister();
		}
	}

	async function refreshLifecycleConflict(
		projectIdToRefresh: string,
		includePublication: boolean
	): Promise<ProjectLifecycleActionResult> {
		const token = session.token();
		preparedLifecycleEpoch = token;
		const read = await readLifecycleProject(includePublication, token);
		if (read.kind === 'stale' || !sameLifecycleEpoch(token)) return { kind: 'stale' };
		if (read.kind === 'error') return { kind: 'error', message: read.message, retryable: false };
		if (projectIdToRefresh !== projectId || !isSavedBaseToken(read.value.loaded.savedBaseToken)) {
			return { kind: 'error', message: 'Cloud returned invalid project metadata.', retryable: false };
		}
		if (includePublication && (read.value.publication === null || read.value.publication.activeVersion !== null)) {
			return { kind: 'refused', message: 'Unpublish this project before deleting it.' };
		}
		const safeToRetry = isMetadataOnlyRemoteChange(read.value.envelope);
		return {
			kind: 'conflict',
			message: safeToRetry
				? 'The Cloud saved base changed. Review the remote name, then explicitly refresh and retry.'
				: 'The Cloud project content changed. Reload remote to replace this session before retrying.',
			remoteName: read.value.loaded.name,
			retryPrepared: safeToRetry
				? { ...lifecyclePrepared(read.value)!, requiresExplicitRefresh: true }
				: null
		};
	}

	async function reconcileExplicitRenameRetry(
		prepared: PreparedProjectLifecycle,
		token: ReplacementEpochToken,
		lock: { release(): void }
	): Promise<
		| { kind: 'ready'; prepared: PreparedProjectLifecycle } | ProjectLifecycleActionResult> {
		if (!prepared.requiresExplicitRefresh) return { kind: 'ready', prepared };
		const read = await readLifecycleProject(false, token);
		if (read.kind === 'stale' || !sameLifecycleEpoch(token)) return { kind: 'stale' };
		if (read.kind === 'error') return { kind: 'error', message: read.message, retryable: false };
		if (!isSavedBaseToken(read.value.loaded.savedBaseToken) || !isMetadataOnlyRemoteChange(read.value.envelope)) {
			return { kind: 'refused', message: 'Cloud project content changed again. Reload remote before retrying.' };
		}
		const nextPrepared = lifecyclePrepared(read.value);
		if (nextPrepared === null) return { kind: 'refused', message: 'Cloud returned no current saved base.' };
		const adopted = await adoptRemoteLifecycleMetadata(read.value, token, lock);
		if (adopted.kind === 'stale') return { kind: 'stale' };
		if (adopted.kind === 'error') return { kind: 'refused', message: adopted.message };
		preparedLifecycleEpoch = token;
		return { kind: 'ready', prepared: nextPrepared };
	}

	async function renameCurrentProject(
		prepared: PreparedProjectLifecycle,
		name: string
	): Promise<ProjectLifecycleActionResult> {
		const token = preparedLifecycleEpoch;
		if (token === null || !sameLifecycleEpoch(token) || prepared.projectId !== projectId) return { kind: 'stale' };
		const mounted = host.acceptance();
		if (mounted === null) return { kind: 'stale' };
		const lock = mounted.beginProjectAction();
		if (lock.kind !== 'locked') return { kind: 'refused', message: lock.message };
		try {
			const reconciled = await reconcileExplicitRenameRetry(prepared, token, lock);
			if (reconciled.kind !== 'ready') return reconciled;
			const operation = reconciled.prepared;
			if (!sameLifecycleEpoch(token)) return { kind: 'stale' };
			if (name === operation.name && prepared.requiresExplicitRefresh) return { kind: 'unchanged' };
			const response = await runBoundProjectAction(token, (signal) =>
				api!.renameProject(projectId, { name, precondition: operation.precondition }, signal)
			);
			if (response.kind === 'stale') return { kind: 'stale' };
			const acknowledgement = response.value;
			const adopted = await mounted.adoptProjectName({ name: acknowledgement.name, savedRevision: acknowledgement.savedRevision });
			if (!sameLifecycleEpoch(token)) return { kind: 'stale' };
			if (adopted.kind === 'refused') return { kind: 'error', message: adopted.message, retryable: false };
			let baselineEnvelope: ProjectEnvelope;
			try {
				const validation = validateProjectEnvelope(JSON.parse(remoteSavedCanonicalJson ?? '') as unknown);
				if (!validation.success || validation.envelope.id !== projectId) throw new Error('Saved project baseline is unavailable.');
				baselineEnvelope = validation.envelope;
			} catch {
				return { kind: 'error', message: 'The saved project baseline could not be updated after rename.', retryable: false };
			}
			const canonicalJson = serializeProjectEnvelope({
				...baselineEnvelope,
				name: acknowledgement.name,
				acceptedRevision: acknowledgement.savedRevision
			});
			const nextBase = {
				savedBaseToken: acknowledgement.savedBaseToken,
				savedRevision: acknowledgement.savedRevision,
				savedCanonicalJson: canonicalJson,
				savedSourceContentId: acknowledgement.sourceContentId
			};
			if (!headSave?.adoptSavedBase(nextBase)) {
				return { kind: 'error', message: 'Rename completed, but the current Save baseline could not be refreshed.', retryable: false };
			}
			pendingSavedBase = {
				token: acknowledgement.savedBaseToken,
				revision: acknowledgement.savedRevision,
				contentId: acknowledgement.sourceContentId
			};
			remoteSavedCanonicalJson = canonicalJson;
			return { kind: 'renamed', name: acknowledgement.name, version: acknowledgement.version };
		} catch (error) {
			if (error instanceof ProjectPersistenceError && error.code === 'conflict') {
				return await refreshLifecycleConflict(projectId, false);
			}
			return {
				kind: error instanceof ProjectPersistenceError && ['invalid', 'auth', 'not-found'].includes(error.code) ? 'refused' : 'error',
				message: error instanceof ProjectPersistenceError ? error.message : 'Cloud rename failed.',
				retryable: retryableLifecycleError(error)
			};
		} finally {
			lock.release();
		}
	}

	async function deleteCurrentProject(prepared: PreparedProjectLifecycle): Promise<ProjectLifecycleActionResult> {
		const token = preparedLifecycleEpoch;
		if (token === null || !sameLifecycleEpoch(token) || prepared.projectId !== projectId) return { kind: 'stale' };
		if (!confirmUnsavedWork()) return { kind: 'refused', message: 'Delete canceled. Your local work is unchanged.' };
		const mounted = host.acceptance();
		if (mounted === null) return { kind: 'stale' };
		const lock = mounted.beginProjectAction();
		if (lock.kind !== 'locked') return { kind: 'refused', message: lock.message };
		try {
			const response = await runBoundProjectAction(token, (signal) =>
				api!.deleteProject(projectId, { precondition: prepared.precondition }, signal)
			);
			if (response.kind === 'stale') return { kind: 'stale' };
			return { kind: 'deleted', cleanup: response.value.cleanup };
		} catch (error) {
			if (error instanceof ProjectPersistenceError && error.code === 'conflict') {
				return await refreshLifecycleConflict(projectId, true);
			}
			if (error instanceof ProjectPersistenceError && error.code === 'unpublish-first') {
				return { kind: 'refused', message: error.message };
			}
			return {
				kind: error instanceof ProjectPersistenceError && ['invalid', 'auth', 'not-found'].includes(error.code) ? 'refused' : 'error',
				message: error instanceof ProjectPersistenceError ? error.message : 'Cloud deletion failed.',
				retryable: retryableLifecycleError(error)
			};
		} finally {
			lock.release();
		}
	}

	async function finishCurrentProjectAction(
		result: Extract<ProjectLifecycleActionResult, { kind: 'renamed' | 'deleted' | 'unchanged' }>
	): Promise<void> {
		if (result.kind !== 'deleted') return;
		const token = preparedLifecycleEpoch;
		if (token === null || !sameLifecycleEpoch(token)) return;
		deleteNavigationAuthorized = true;
		// A server acknowledgement is the only path that retires this session.
		// Route teardown then releases its normal Stage, history and asset owners.
		session.dispose();
		const query = new URLSearchParams({ deleted: result.cleanup });
		if (boot.status === 'ready' || boot.status === 'empty') query.set('name', boot.snapshot.domain.name);
		await goto(`/projects?${query.toString()}`);
	}

	async function reloadLifecycleRemote(): Promise<boolean> {
		if (api === null || !activeProject()) return false;
		const token = session.token();
		const loaded = await runBoundLoad(session, (signal) => api!.loadProject(projectId, signal));
		if (loaded === null || !session.isCurrent(token)) return false;
		return applyReloadOffer({
			kind: 'reload',
			projectId,
			document: loaded.document,
			savedBaseToken: loaded.savedBaseToken,
			savedRevision: loaded.savedRevision,
			savedSourceContentId: loaded.savedSourceContentId
		});
	}

	/**
	 * A conflict's explicit *Reload remote*: the offer is data, and this host's
	 * replacement path is the only thing that installs it.
	 */
	async function applyReloadOffer(offer: ReloadOffer): Promise<boolean> {
		if (offer.kind === 'unavailable') {
			host.notice = 'The remote copy could not be loaded; your local work is unchanged.';
			return false;
		}
		if (!confirmUnsavedWork()) return false;
		// TD-10: the accepted offer is this epoch's, not whichever epoch is mounted
		// when its admission resolves. Capture the token before admitting, so a
		// `Reload remote` that a newer replacement (or teardown) superseded is
		// abandoned instead of installing over the project the creator now has.
		const token = session.token();
		try {
			await runBoundLoad(session, (signal) => verifyOpenedArtwork(offer.document, signal));
		} catch (error) {
			if (session.isCurrent(token)) host.notice = error instanceof Error ? error.message : 'Artwork could not be verified.';
			return false;
		}
		if (!session.isCurrent(token)) return false;
		const next = await bootFromSourceJson(JSON.stringify(offer.document), projectId, admissionContext());
		// Admission itself is asynchronous: a stale offer installs nothing, adopts no
		// saved base and reports no refusal over the newer session.
		if (!session.isCurrent(token)) return false;
		// Only a source that actually admitted replaces the mounted project and
		// becomes this epoch's saved base. A failed reload keeps the local source,
		// its history/selection and the saved base the Head is still saving against.
		if (next.status !== 'ready' && next.status !== 'empty') {
			reportSourceRefusal(next, 'reload');
			return false;
		}
		pendingSavedBase = {
			token: offer.savedBaseToken,
			revision: offer.savedRevision,
			contentId: offer.savedSourceContentId
		};
		remoteSavedCanonicalJson = next.snapshot.canonicalJson;
		applyState(next);
		return true;
	}

	function requestReplacement(action: 'starter' | 'empty' | 'source'): void {
		if (projectActionBusy) return;
		if (activeProject()) {
			// Unsaved work is signalled explicitly and confirmed before the guard even
			// opens: a replacement would discard the local source, so no path may skip
			// this question.
			if (!confirmUnsavedWork()) return;
			// Explicit project-replacement guard: nothing is swapped until the creator
			// confirms, and the guard is the same host path for every entry.
			pendingReplacement = action;
			return;
		}
		void runReplacement(action);
	}

	async function runReplacement(action: 'starter' | 'empty' | 'source'): Promise<void> {
		pendingReplacement = null;
		if (action === 'starter') {
			// A minted baseline has no cloud saved base: its first Save is a create.
			pendingSavedBase = null;
			remoteSavedCanonicalJson = null;
			applyState(await bootStarterGallery(projectId, admissionContext()));
			return;
		}
		if (action === 'empty') {
			pendingSavedBase = null;
			remoteSavedCanonicalJson = null;
			applyState(await bootEmpty(projectId, admissionContext()));
			return;
		}
		if (action === 'source') {
			await openSourceJson();
		}
	}

	async function openSourceJson(): Promise<void> {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json,.json';
		const file = await new Promise<File | null>((resolve) => {
			input.onchange = () => resolve(input.files?.[0] ?? null);
			input.click();
		});
		// A cancelled dialog changes nothing — including the saved base the current
		// Head is still saving against.
		if (file === null) return;
		// F2 starts when the file actually exists: the dialog itself is not the flow.
		perfMark('f2:open-requested', { bytes: file.size });
		// TD-10: reading and admitting the chosen file is asynchronous, and the epoch
		// this Open belongs to is the one captured here — not whichever project is
		// mounted when the admission resolves. A superseded Open is abandoned rather
		// than installed over the newer project, its history and its saved base.
		const token = session.token();
		const source = await file.text();
		const next = await bootFromSourceJson(source, projectId, admissionContext());
		// A stale result reports nothing: neither a success nor a refusal may appear
		// for an action the creator has already replaced.
		if (!session.isCurrent(token)) return;
		if (next.status !== 'ready' && next.status !== 'empty') {
			reportSourceRefusal(next, 'open');
			return;
		}
		// Standalone JSON does not transfer project-owned P20 byte identity.
		const validated = validateProjectEnvelope(JSON.parse(source));
		if (validated.success && validated.envelope.units.scene.data.artworkLibrary?.length) {
			host.notice = 'This source uses project Artwork images. Open its saved cloud project to recover those images.';
			return;
		}

		// A successfully opened source is a locally minted baseline with no cloud
		// row behind it, so its first Save is a create. Set this only once the
		// source has actually admitted; a refused open must not clear it.
		pendingSavedBase = null;
		remoteSavedCanonicalJson = null;
		applyState(next);
		perfMark('f2:open-admitted', { sourceContentId: next.snapshot.sourceContentId });
	}

	function unmountSave(): void {
		unsubscribeHeadSave?.();
		unsubscribeHeadSave = null;
	}

	function mountSave(mounted: StageAcceptanceHost, snapshot: StageReadSnapshot): void {
		unmountSave();
		headSave = buildHeadSave(mounted, snapshot);
		const mountedHeadSave = headSave;
		if (mountedHeadSave !== null) {
			unsubscribeHeadSave = mountedHeadSave.subscribe(() => {
				if (headSave !== mountedHeadSave) return;
				perfMeasureSync('save.page-state-signal', () => (headSaveVersion += 1));
				// `create=1` means "this identity was just minted", so a refresh must
				// stay on the empty local baseline. Once the first Save has been
				// acknowledged the row exists and the same address is an explicit open;
				// consuming the marker here is what makes Save followed by reload read the
				// saved project instead of minting another empty one.
				if (mountedHeadSave.snapshot().status !== 'saved') return;
				const url = new URL(host.url());
				if (url.searchParams.get('create') !== '1') return;
				url.searchParams.delete('create');
				replaceState(`${url.pathname}${url.search}`, {});
			});
		}
		resumeSource = null;
	}

	function bindNavigation(): void {
		beforeNavigate(({ cancel }) => {
			if (!deleteNavigationAuthorized && !confirmUnsavedWork()) cancel();
		});
	}

	function projectActionsUnavailableReason(): string | null {
		void headSaveVersion;
		if (api === null) return 'Cloud project actions are unavailable because the Cloud service is not configured.';
		if (!activeProject()) return 'Open a saved Cloud project to rename or delete it.';
		if (!pendingSavedBase?.token) return 'Save this project to Cloud before renaming or deleting it.';
		const save = headSave?.snapshot();
		if (save?.busy || save?.pending) return 'Finish or retry the current Save before using project actions.';
		return null;
	}

	return {
		get boot() { return boot; },
		get headSave() { return headSave; },
		get resumeOffer() { return resumeOffer; },
		get pendingReplacement() { return pendingReplacement; },
		get projectActionBusy() { return projectActionBusy; },
		setProjectActionBusy(value: boolean) { projectActionBusy = value; },
		cancelReplacement() { pendingReplacement = null; },
		updateSnapshot(snapshot: StageReadSnapshot) {
			if (boot.status === 'ready' || boot.status === 'empty') boot = { ...boot, snapshot };
		},
		/** Callers must inspect the Save outcome before switching projects. */
		saveBeforeSwitch() { return headSave?.save() ?? Promise.resolve({ kind: 'unavailable' as const }); },
		dispose: unmountSave,
		bindNavigation, mountSave, unmountSave, projectActionsUnavailableReason, activeProject, load,
		requestReplacement, runReplacement, resumePendingSave, dismissResumeOffer,
		prepareProjectLifecycle, renameCurrentProject, deleteCurrentProject,
		finishCurrentProjectAction, reloadLifecycleRemote, applyReloadOffer
	};
}
