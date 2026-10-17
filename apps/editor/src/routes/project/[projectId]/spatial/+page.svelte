<script lang="ts">
	/**
	 * T1.P01.S02 — the editor **route host**.
	 *
	 * This replaces the foundation-reset notice. It performs a **read-only cloud
	 * boot** (only `loadProject`), admits the source through the one admission path
	 * (canonical validation + canonical compile + runtime Scene resolution), and
	 * mounts the Stage shell on the admitted snapshot. It never writes: no
	 * `saveProject`, no pending-cloud-save helper, no import of a writer is reached
	 * from this route's call sites (see `editor-host-no-write.test.ts`).
	 *
	 * Every explicit state is rendered: loading, new (starter gallery/empty), empty,
	 * ready, diagnostics (blocking compile), refused (invalid/non-current format),
	 * missing, forbidden and error. A minted identity the server does not have offers
	 * the gallery; an explicitly opened absence is `missing`.
	 *
	 * One Stage canvas serves both readings and both lenses. Reading flips are
	 * Camera-evaluated (never a shell tween); pointer input becomes viewing intent;
	 * a click selects through the eligible Plan fragments so a hidden or excluded
	 * target can never intercept input.
	 */
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import {
		createProjectApi,
		ProjectPersistenceError,
		type ProjectApi
	} from '$lib/platform/project-persistence';
	import { serializeProject } from '$lib/project/project-codec';
	import {
		bootEmpty,
		bootFromLoadOutcome,
		bootFromSourceJson,
		bootIntentFromSearch,
		bootStarterGallery,
		initialBootState,
		type BootIntent,
		type BootLoadOutcome,
		type BootState
	} from '$lib/authoring/stage/boot-state';
	import type { AdmissionContext, StageReadSnapshot } from '$lib/authoring/stage/source-admission';
	import { STARTER_TEMPLATES } from '$lib/authoring/stage/starter-gallery';
	import { createStageSession, type StageSession, type StageSelection, type StageTask } from '$lib/authoring/stage/stage-session';	import {
		createStageFacade,
		type StageFacade,
		type StageIntentResult,
		type StageOverlayContribution,
		type StageSourceHit
	} from '$lib/authoring/stage/stage-facade';
	import type { PlanEvaluation, PlanMembershipReason } from '@portfolio/layout-core';
	import type { ViewingIntent, ViewportEvaluation, ViewportRect } from '@portfolio/camera-core';
	import {
		isStageDrag,
		readingIntentClockSeconds,
		stageKeyAction,
		stageKeyFromTextEntry
	} from '$lib/authoring/stage/stage-input';
	import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';
	import EditorIndex from '$lib/authoring/stage/shell/EditorIndex.svelte';
	import EditorCard from '$lib/authoring/stage/shell/EditorCard.svelte';
	import StageInstrumentHost from '$lib/authoring/stage/shell/StageInstrumentHost.svelte';
	import StageCanvas from '$lib/authoring/stage/shell/StageCanvas.svelte';
	import StageOverlay from '$lib/authoring/stage/shell/StageOverlay.svelte';

	const projectId = decodeURIComponent(page.params.projectId ?? '');
	const intent: BootIntent = bootIntentFromSearch(page.url.searchParams);

	const api: ProjectApi | null = createProjectApi({ apiOrigin: env.PUBLIC_API_ORIGIN });
	const session = createStageSession({ sessionEpoch: 'session:route-boot' });

	let boot = $state<BootState>(initialBootState(projectId, intent));
	let facade = $state.raw<StageFacade | null>(null);
	let selection = $state<StageSelection | null>(null);
	let task = $state<StageTask | null>(null);
	let revealed = $state<string[]>([]);
	let lens = $state<'world' | 'experience'>('world');
	let indexOpen = $state(true);
	let query = $state('');
	let reducedMotion = $state(false);
	let evaluation = $state<ViewportEvaluation | null>(null);
	let planView = $state<PlanEvaluation | null>(null);
	let rect = $state<ViewportRect | null>(null);
	let markers = $state<readonly StageOverlayContribution[]>([]);
	let selectionMarker = $state<{ css: readonly [number, number]; label: string } | null>(null);
	let notice = $state('');
	let pendingReplacement = $state<null | 'starter' | 'empty' | 'source'>(null);
	let stageEl: HTMLDivElement | undefined = $state(undefined);
	/**
	 * Whether the contextual Card is shown. Closing the Card never clears the
	 * selection: the Index keeps echoing it, and selecting the subject again (or
	 * another one) brings the Card back, so identity is never lost to a dismissal.
	 */
	let cardOpen = $state(true);

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

	/* --- activation, content change and the replacement epoch --------------- */

	/** Everything a project swap or a content change invalidates in the host's view. */
	function resetViewContext(): void {
		selection = null;
		task = null;
		revealed = [];
		notice = '';
		cardOpen = true;
		drag = null;
		pressOrigin = null;
		planView = null;
		// The key must be dropped with the view it described, or the recompute that
		// follows a swap would be skipped as unchanged.
		planKey = '';
		markers = [];
		selectionMarker = null;
	}

	function activate(snapshot: StageReadSnapshot): void {
		// Replacement: validate first (the snapshot is already admitted), then the
		// session atomically cancels writers, clears selection/task and swaps.
		session.replace(snapshot);
		facade?.dispose();
		facade = createStageFacade({ snapshot, session });
		// The host owns one inspection output; every viewing intent below presents
		// this claim's ticket, so a replaced or rebased output cannot keep writing.
		facade.acquireInspection('exclusive');
		resetViewContext();
	}

	function applyState(next: BootState): void {
		// Every entry on this route is a replacement: a cloud boot, an explicit
		// current-format source open, the starter gallery or the empty baseline each
		// start a new project baseline, so they get a fresh session epoch and a fresh
		// view. The **content-change** transition (same project, new content, view
		// kept) is the seam's own install path, proved in `stage-content-change.test.ts`
		// until S04 adds the first editing command that reaches it.
		if (next.status === 'ready' || next.status === 'empty') activate(next.snapshot);
		boot = next;
	}

	/* --- boot -------------------------------------------------------------- */

	async function load(projectIdToLoad: string, requestedIntent: BootIntent): Promise<void> {
		boot = initialBootState(projectIdToLoad, requestedIntent);
		if (api === null) {
			boot =
				requestedIntent === 'create'
					? { status: 'new', projectId: projectIdToLoad, intent: 'create' }
					: { status: 'error', projectId: projectIdToLoad, message: 'Cloud service is unavailable' };
			return;
		}
		const controller = new AbortController();
		let outcome: BootLoadOutcome;
		try {
			// The host performs only the project GET.
			const loaded = await api.loadProject(projectIdToLoad, controller.signal);
			outcome = { kind: 'loaded', document: loaded.document };
		} catch (error) {
			if (controller.signal.aborted) return;
			outcome = loadOutcomeFromError(error);
		}
		applyState(await bootFromLoadOutcome(boot, outcome, admissionContext()));
	}

	function loadOutcomeFromError(error: unknown): BootLoadOutcome {
		if (error instanceof ProjectPersistenceError) {
			if (error.code === 'not-found') return { kind: 'not-found' };
			if (error.code === 'auth') return { kind: 'forbidden' };
			if (error.code === 'network') return { kind: 'network' };
			return { kind: 'server', message: error.message };
		}
		return { kind: 'network' };
	}

	function activeProject(): boolean {
		return boot.status === 'ready' || boot.status === 'empty';
	}

	function requestReplacement(action: 'starter' | 'empty' | 'source'): void {
		if (activeProject()) {
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
			applyState(await bootStarterGallery(projectId, admissionContext()));
			return;
		}
		if (action === 'empty') {
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
		if (file === null) return;
		applyState(await bootFromSourceJson(await file.text(), projectId, admissionContext()));
	}

	/* --- viewport measurement and evaluation -------------------------------- */

	function measure(): ViewportRect {
		const element = stageEl;
		const width = element?.clientWidth ?? 0;
		const height = element?.clientHeight ?? 0;
		const left = element?.getBoundingClientRect().left ?? 0;
		const top = element?.getBoundingClientRect().top ?? 0;
		return { left, top, width, height, devicePixelRatio: window.devicePixelRatio || 1 };
	}

	function acceptRect(next: ViewportRect): void {
		rect = next;
	}

	function nowSeconds(): number {
		return typeof performance === 'undefined' ? Date.now() / 1000 : performance.now() / 1000;
	}

	let planKey = '';

	function refresh(): void {
		const stage = facade;
		if (stage === null) return;
		const currentRect = rect ?? measure();
		const result = stage.camera.evaluate(currentRect, nowSeconds());
		evaluation = result.kind === 'evaluated' ? result.evaluation : null;
		if (evaluation === null) return;

		// The Plan evaluation is recomputed only when its inputs move: pose target,
		// reveal union or generation. It is pure, but a per-frame compile sweep is
		// waste, not evidence.
		const target = stage.camera.state().pose.target;
		// One value is both what the facade is told and what the cache key names, so a
		// parameter change can never leave a stale Plan behind the live hit path.
		const parameters = { reveal: [...revealed].sort() };
		const key = `${stage.snapshot().compileGeneration}|${target[0]}:${target[2]}|${JSON.stringify(parameters)}`;
		if (key !== planKey) {
			planKey = key;
			// Reveal is host state the facade holds, so the Plan the Stage draws and
			// the Plan its hit path resolves agree about which sources are eligible.
			stage.setPlanParameters(parameters);
			const planResult = stage.plan();
			planView = planResult.kind === 'evaluated' ? planResult.plan : null;
		}

		// Overlays project through the *same* evaluation: adapter contributions and
		// the selection echo are CSS points from `projectWorld`, never a second
		// projection.
		markers = stage.overlays();
		const selected = selection;
		selectionMarker = selected === null ? null : selectionEcho(selected);
	}

	function selectionEcho(selected: StageSelection): { css: readonly [number, number]; label: string } | null {
		const stage = facade;
		if (stage === null) return null;
		const plan = planView;
		const fragment = plan?.fragments.find((candidate) => candidate.ref.sourceId === selected.sourceId);
		if (fragment === undefined) return null;
		const points =
			fragment.geometry.kind === 'span'
				? [fragment.geometry.start, fragment.geometry.end]
				: fragment.geometry.kind === 'polyline'
					? fragment.geometry.polyline
					: fragment.geometry.polygon;
		const center = points.reduce<[number, number]>(
			(accumulator, point) => [accumulator[0] + point[0] / points.length, accumulator[1] + point[1] / points.length],
			[0, 0]
		);
		const projected = stage.projectWorld([center[0], fragment.elevationMeters, center[1]], stage.evaluationId() ?? '');
		if (projected.kind !== 'projected') return null;
		return { css: projected.css, label: selected.sourceId };
	}

	onMount(() => {
		const initial = measure();
		acceptRect(initial);
		let frame = 0;
		const tick = () => {
			const stage = stageEl;
			if (stage !== undefined) {
				const next = measure();
				if (
					rect === null ||
					next.width !== rect.width ||
					next.height !== rect.height ||
					next.left !== rect.left ||
					next.top !== rect.top ||
					next.devicePixelRatio !== rect.devicePixelRatio
				) {
					acceptRect(next);
				}
			}
			refresh();
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);

		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = media.matches;
		const onMedia = (event: MediaQueryListEvent) => {
			reducedMotion = event.matches;
		};
		media.addEventListener('change', onMedia);

		const onKey = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			handleKey(event);
		};
		window.addEventListener('keydown', onKey);

		void load(projectId, intent);

		return () => {
			cancelAnimationFrame(frame);
			media.removeEventListener('change', onMedia);
			window.removeEventListener('keydown', onKey);
			// Session teardown runs every registered disposer exactly once; no
			// project-specific singleton survives the route.
			facade?.dispose();
			session.dispose();
		};
	});

	/* --- Camera intents ----------------------------------------------------- */

	/**
	 * Submit one viewing intent through the seam, presenting the host's own
	 * inspection claim.
	 *
	 * `superseded` is the ownership answer, not a domain rejection: the output was
	 * replaced or ended by a content change and this run no longer holds it. The
	 * host re-acquires its own inspection output once and retries the same intent.
	 */
	function submit(intent: ViewingIntent, clockSeconds: number): StageIntentResult | null {
		const stage = facade;
		if (stage === null) return null;
		const first = stage.requestViewingIntent(intent, stage.inspectionTicket(), clockSeconds);
		if (first.kind !== 'superseded') return first;
		stage.acquireInspection('exclusive');
		return stage.requestViewingIntent(intent, stage.inspectionTicket(), clockSeconds);
	}

	function setReading(reading: '3d' | 'plan'): void {
		// Reduced motion cuts directly to the declared endpoint through the one
		// settling rule — it is not a shortened tween.
		submit({ kind: 'set-reading', reading }, readingIntentClockSeconds(reducedMotion, nowSeconds()));
	}

	function fit(): void {
		const stage = facade;
		if (stage === null) return;
		const bounds = stage.snapshot().domain.geometry.bounds;
		if (bounds === null || rect === null) return;
		submit({ kind: 'fit', bounds: { min: bounds.min, max: bounds.max }, rect }, nowSeconds());
	}

	function bringIntoView(target: readonly [number, number, number]): void {
		submit({ kind: 'bring-into-view', target: [target[0], target[1], target[2]] }, nowSeconds());
	}

	function zoom(scale: number): void {
		submit({ kind: 'zoom', scale }, nowSeconds());
	}

	function pan(dx: number, dy: number): void {
		if (rect === null) return;
		submit({ kind: 'pan', deltaCss: [dx, dy], rect }, nowSeconds());
	}

	function orbit(dAzimuth: number, dElevation: number): void {
		submit({ kind: 'orbit', deltaAzimuthRadians: dAzimuth, deltaElevationRadians: dElevation }, nowSeconds());
	}

	/* --- selection, tasks and Reveal ---------------------------------------- */

	/** A compact, complete reference: the source kind plus its canonical identity. */
	function sourceLabel(sourceId: string, kind: string): string {
		return `${kind === 'room-floor' ? 'floor' : kind} · ${sourceId}`;
	}

	function selectHit(hit: StageSourceHit): void {
		const stage = facade;
		if (stage === null) return;
		const selected: StageSelection = {
			sourceId: hit.sourceId,
			sourceKind: hit.sourceKind,
			generationId: hit.generationId,
			ref: {
				sourceId: hit.sourceId,
				sourceKind: hit.sourceKind,
				generationId: hit.generationId,
				stream: hit.stream,
				subRef: hit.subRef
			}
		};
		stage.select(selected);
		selection = selected;
		cardOpen = true;
	}

	/** The Card is an overlay: hiding it is not a selection change. */
	function closeCard(): void {
		cardOpen = false;
	}

	/** Clearing the selection does reopen the Card for the next subject. */
	function closeSelection(): void {
		facade?.select(null);
		selection = null;
		cardOpen = true;
	}

	function selectSource(sourceId: string): void {
		const stage = facade;
		const plan = planView;
		if (stage === null || plan === null) return;
		cardOpen = true;
		const fragment = plan.fragments.find((candidate) => candidate.ref.sourceId === sourceId);
		if (fragment === undefined) return;
		stage.select({
			sourceId,
			sourceKind: fragment.ref.sourceKind,
			generationId: fragment.ref.generationId,
			ref: fragment.ref
		});
		selection = stage.selection();
	}

	function openTask(): void {
		const stage = facade;
		const selected = selection;
		if (stage === null || selected === null) return;
		const next: StageTask = {
			kind: 'subject-membership',
			label: 'Plan membership',
			targetRef: selected.ref
		};
		if (stage.openTask(next)) task = next;
	}

	function closeTask(): void {
		facade?.closeTask();
		task = null;
	}

	function toggleReveal(sourceId: string): void {
		revealed = revealed.includes(sourceId)
			? revealed.filter((id) => id !== sourceId)
			: [...revealed, sourceId];
	}

	/* --- pointer and keyboard ---------------------------------------------- */

	let drag: { x: number; y: number; mode: 'pan' | 'orbit' } | null = null;
	/** Where the current press started, so a drag is never also a click. */
	let pressOrigin: { x: number; y: number } | null = null;

	function onPointerDown(event: PointerEvent): void {
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		const stage = facade;
		if (stage === null || evaluation === null) return;
		// A gesture is one captured writer with an explicit transition policy; a
		// replacement cancels it exactly once.
		stage.acquireGesture({
			owner: 'stage-pointer',
			evaluationId: stage.evaluationId() ?? '',
			policy: 'continue-after-revalidation'
		});
		pressOrigin = { x: event.clientX, y: event.clientY };
		drag = { x: event.clientX, y: event.clientY, mode: event.button === 0 && !event.shiftKey ? 'pan' : 'orbit' };
	}

	function onPointerMove(event: PointerEvent): void {
		if (drag === null) return;
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		drag = { x: event.clientX, y: event.clientY, mode: drag.mode };
		if (drag.mode === 'orbit') orbit(-dx * 0.01, dy * 0.01);
		else pan(dx, dy);
	}

	function onPointerUp(): void {
		drag = null;
		// The gesture lease is released exactly once, whatever ended it.
		session.gesture()?.release();
	}

	function onClick(event: MouseEvent): void {
		const origin = pressOrigin;
		pressOrigin = null;
		// A pan or orbit drag ends with a click too; it moved the view, so it must not
		// also select (or report that nothing was selectable).
		if (origin !== null && isStageDrag(origin, { x: event.clientX, y: event.clientY })) return;
		const stage = facade;
		const id = stage?.evaluationId() ?? null;
		if (stage === null || id === null || rect === null) return;
		const css: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
		const hit = stage.resolveSourceHit({ evaluationId: id, css });
		if (hit.kind === 'resolved') {
			selectHit(hit.hit);
			notice = '';
			return;
		}
		if (hit.kind === 'none') {
			// The Plan places no fragment for an excluded source, so a miss cannot say
			// which subject the creator meant. Exclusion reasons and Reveal live on the
			// Index, and this notice points there without pretending to localize.
			notice =
				planView !== null && planView.membership.some((row) => !row.eligible)
					? 'Nothing selectable there — some subjects are excluded from this Plan; Reveal one from the Index.'
					: 'Nothing selectable there.';
			return;
		}
		notice = 'That click did not land on the Plan.';
	}

	function onWheel(event: WheelEvent): void {
		event.preventDefault();
		zoom(Math.exp(event.deltaY * 0.001));
	}

	function handleKey(event: KeyboardEvent): void {
		// Typing in the Index's subject search must never move the camera.
		if (stageKeyFromTextEntry(event.target)) return;
		const action = stageKeyAction(event.key);
		switch (action.kind) {
			case 'reading':
				setReading(action.reading);
				break;
			case 'fit':
				fit();
				break;
			case 'pan':
				pan(action.deltaCss[0], action.deltaCss[1]);
				break;
			case 'dismiss':
				// The deepest open context closes first: the task, then the selection.
				session.gesture()?.release();
				if (task !== null) closeTask();
				else if (selection !== null) closeSelection();
				break;
			case 'none':
				break;
		}
	}

	/* --- shell view data ---------------------------------------------------- */

	function downloadSourceJson(): void {
		const snapshot = boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot : null;
		if (snapshot === null) return;
		const canonical = serializeProject(snapshot.domain.project);
		const url = URL.createObjectURL(new Blob([canonical], { type: 'application/json' }));
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `${snapshot.domain.project.name.replace(/[^\w.-]+/g, '-') || 'project'}.json`;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	const indexGroups = $derived.by(() => {
		const plan = planView;
		if (plan === null) return [];
		const byKind = new Map<
			string,
			{ sourceId: string; label: string; kind: string; eligible: boolean; revealed: boolean; membership: string }[]
		>();
		for (const membership of plan.membership) {
			const items = byKind.get(membership.sourceKind) ?? [];
			items.push({
				sourceId: membership.sourceId,
				label: sourceLabel(membership.sourceId, membership.sourceKind),
				kind: membership.sourceKind,
				eligible: membership.eligible,
				revealed: membership.revealed,
				membership: membership.reason
			});
			byKind.set(membership.sourceKind, items);
		}
		const filtered = [...byKind.entries()]
			.filter(([, items]) => items.length > 0)
			.map(([kind, items]) => ({ id: kind, label: kind.replace('-', ' '), items }));
		if (query.trim() === '') return filtered;
		const needle = query.trim().toLowerCase();
		return filtered
			.map((group) => ({ ...group, items: group.items.filter((item) => item.label.toLowerCase().includes(needle)) }))
			.filter((group) => group.items.length > 0);
	});

	const selectedMembership = $derived.by((): PlanMembershipReason | null => {
		const plan = planView;
		const selected = selection;
		if (plan === null || selected === null) return null;
		return plan.membership.find((row) => row.sourceId === selected.sourceId)?.reason ?? null;
	});

	/** The Card's identity: the canonical subject and its declared membership status. */
	const cardIdentity = $derived(
		selection === null
			? null
			: {
					sourceId: selection.sourceId,
					label: selection.sourceId,
					kind: selection.sourceKind,
					status: selectedMembership ?? 'unknown'
				}
	);

	/**
	 * The Card's owner/source/reach facts, read from the same Plan evaluation the
	 * Stage draws: the Card can never disagree with the render about membership.
	 */
	const cardFacts = $derived.by((): { label: string; value: string }[] => {
		const selected = selection;
		if (selected === null) return [];
		const membership = planView?.membership.find((row) => row.sourceId === selected.sourceId);
		return [
			{ label: 'Stream', value: selected.ref.stream },
			{ label: 'Eligible', value: String(membership?.eligible ?? false) },
			{ label: 'Revealed', value: String(revealed.includes(selected.sourceId)) },
			{
				label: 'Datum',
				value: `${boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.datumMeters : 0} m`
			}
		];
	});

	/**
	 * The instrument host's task view. The target is named explicitly and may differ
	 * from the canonical selection — an Opening can stay selected while the task
	 * works on its host Wall.
	 */
	const taskHost = $derived(
		task === null
			? null
			: {
					kind: task.kind,
					label: task.label,
					targetLabel:
						task.targetRef === null
							? null
							: sourceLabel(task.targetRef.sourceId, task.targetRef.sourceKind)
				}
	);

	/** The world point a "Bring into view" request targets, from the selected fragment. */
	function selectedWorldPoint(): [number, number, number] | null {
		const plan = planView;
		const selected = selection;
		if (plan === null || selected === null) return null;
		const fragment = plan.fragments.find((candidate) => candidate.ref.sourceId === selected.sourceId);
		if (fragment === undefined) return null;
		const points =
			fragment.geometry.kind === 'span'
				? [fragment.geometry.start, fragment.geometry.end]
				: fragment.geometry.kind === 'polyline'
					? fragment.geometry.polyline
					: fragment.geometry.polygon;
		if (points.length === 0) return null;
		const center = points.reduce<[number, number]>(
			(accumulator, point) => [accumulator[0] + point[0] / points.length, accumulator[1] + point[1] / points.length],
			[0, 0]
		);
		return [center[0], fragment.elevationMeters, center[1]];
	}
</script>

<div class="editor-host">
	<EditorHead
		{projectId}
		projectName={boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.project.name : 'Loading project'}
		{lens}
		onLens={(next) => (lens = next)}
		canDownloadSource={activeProject()}
		onDownloadSource={downloadSourceJson}
		historyUnavailableReason="Source history arrives with T1.P01.S04 local acceptance."
		saveUnavailableReason="Conditional Save arrives with T3.P01.S02; this host is read-only."
		previewUnavailableReason="Visitor Preview arrives with T3."
		{reducedMotion}
		onToggleReducedMotion={() => (reducedMotion = !reducedMotion)}
	/>

	<div class="editor-body">
		<EditorIndex
			open={indexOpen}
			onToggle={() => (indexOpen = !indexOpen)}
			groups={indexGroups}
			selectionId={selection?.sourceId ?? null}
			{query}
			onQuery={(next) => (query = next)}
			onSelect={selectSource}
			onBringIntoView={(sourceId) => {
				const plan = planView;
				const fragment = plan?.fragments.find((candidate) => candidate.ref.sourceId === sourceId);
				if (fragment === undefined) return;
				const points =
					fragment.geometry.kind === 'span'
						? [fragment.geometry.start, fragment.geometry.end]
						: fragment.geometry.kind === 'polyline'
							? fragment.geometry.polyline
							: fragment.geometry.polygon;
				if (points.length === 0) return;
				const center = points.reduce<[number, number]>(
					(accumulator, point) => [accumulator[0] + point[0] / points.length, accumulator[1] + point[1] / points.length],
					[0, 0]
				);
				bringIntoView([center[0], fragment.elevationMeters, center[1]]);
			}}
			onReveal={toggleReveal}
		/>

		<div class="stage-frame">
			<!--
				The Stage surface is a pointer-driven viewport, not a widget: it handles
				click (selection through eligible Plan fragments) and wheel (zoom), while
				keyboard viewing intents are handled once by the host's own window listener
				(3/p/f/arrows/Escape) so a focused element handler cannot double-apply them.
			-->
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
			<div
				class="stage"
				bind:this={stageEl}
				role="application"
				tabindex="0"
				aria-label="Spatial stage"
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onclick={onClick}
				onwheel={onWheel}
			>
				{#if boot.status === 'ready' || boot.status === 'empty'}
					<StageCanvas
						geometry={boot.snapshot.domain.geometry}
						scene={boot.snapshot.domain.scene}
						rooms={boot.snapshot.domain.rooms}
						{evaluation}
					/>
				{/if}
				<div class="overlay-layer">
					<StageOverlay {markers} {selectionMarker} />
				</div>

				{#if boot.status === 'empty'}
					<p class="stage-note" role="status">Empty baseline — no enclosure drawn yet. Start from the gallery for a compilable room.</p>
				{/if}

				<!--
					The toolbar sits over the pointer-driven Stage surface, so it stops its
					own pointer and click events: pressing Plan/3D/Fit must never also
					hit-test the world underneath the button.
				-->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="stage-actions"
					onclick={(event) => event.stopPropagation()}
					onpointerdown={(event) => event.stopPropagation()}
				>
					<button type="button" onclick={() => setReading('plan')} aria-pressed={evaluation?.settledReading === 'plan'}>Plan</button>
					<button type="button" onclick={() => setReading('3d')} aria-pressed={evaluation?.settledReading === '3d'}>3D</button>
					<button type="button" onclick={fit}>Fit</button>
					<button type="button" onclick={() => requestReplacement('source')}>Open source JSON</button>
				</div>

				{#if lens === 'experience'}
					<!-- The Experience lens has a real unavailable posture until T3 mounts
						its adapter on this Stage: never a mock editable Experience, and never a
						silent no-op that looks like a broken switch. -->
					<div class="lens-unavailable" role="status">
						<h2>Experience is not available yet</h2>
						<p>
							The Experience lens arrives with T3, which mounts its own adapter on this
							Stage. The World view keeps exactly the state you left it in.
						</p>
						<button type="button" onclick={() => (lens = 'world')}>Back to World</button>
					</div>
				{/if}

				{#if notice}<p class="stage-note" role="status">{notice}</p>{/if}
			</div>

			<EditorCard
				identity={cardOpen ? cardIdentity : null}
				facts={cardFacts}
				onClose={closeCard}
				onFocusTask={() => {
					notice = 'Focus deepens the current task; task depth arrives with T1.P01.S04.';
				}}
				onOpenTask={openTask}
				onBringIntoView={() => {
					const target = selectedWorldPoint();
					if (target !== null) bringIntoView(target);
				}}
			/>

			<StageInstrumentHost task={taskHost} onClose={closeTask}>
				{#if selection !== null}
					{@const selectedId = selection.sourceId}
					<div class="instrument-body">
						<p>Declared membership: <strong>{selectedMembership ?? 'unknown'}</strong></p>
						<button type="button" onclick={() => toggleReveal(selectedId)}>
							{revealed.includes(selectedId) ? 'Hide' : 'Reveal'}
						</button>
					</div>
				{/if}
			</StageInstrumentHost>
		</div>
	</div>

	{#if boot.status === 'new'}
		<div class="boot-panel" role="dialog" aria-label="Start a project">
			<h1>Start this project</h1>
			<p>Choose the canonical starter gallery, or begin genuinely empty.</p>
			{#each STARTER_TEMPLATES as template (template.id)}
				<button type="button" class="primary" onclick={() => void runReplacement('starter')}>{template.label}</button>
			{/each}
			<button type="button" onclick={() => void runReplacement('empty')}>Begin empty</button>
		</div>
	{:else if boot.status !== 'ready' && boot.status !== 'empty'}
		<div class="boot-panel" role="status" aria-live="polite">
			{#if boot.status === 'loading'}
				<p>Loading project…</p>
			{:else if boot.status === 'missing'}
				<h1>Project not found</h1>
				<p>This project does not exist for your account.</p>
			{:else if boot.status === 'forbidden'}
				<h1>Sign-in required</h1>
				<p>This project belongs to another session.</p>
			{:else if boot.status === 'refused'}
				<h1>Unsupported project source</h1>
				<p>
					{boot.reason === 'invalid-json'
						? 'The source JSON did not parse.'
						: boot.reason === 'project-mismatch'
							? 'That source belongs to another project.'
							: 'The source is not the current document format.'}
				</p>
				<ul>
					{#each boot.issues.slice(0, 5) as issue (issue.path + issue.code)}
						<li>{issue.path}: {issue.message}</li>
					{/each}
				</ul>
			{:else if boot.status === 'diagnostics'}
				<h1>Canonical compile blocked</h1>
				<p>The source validated, but its canonical compile has blocking issues.</p>
				<ul>
					{#each boot.issues.slice(0, 5) as issue (issue.path + issue.code)}
						<li>{issue.path}: {issue.message}</li>
					{/each}
				</ul>
			{:else if boot.status === 'error'}
				<h1>Project unavailable</h1>
				<p>{boot.message}</p>
			{/if}
		</div>
	{/if}

	{#if pendingReplacement !== null}
		<div class="boot-panel" role="alertdialog" aria-label="Replace project">
			<h1>Replace the current project?</h1>
			<p>This cancels pending work and clears selection and task before swapping to the new baseline.</p>
			<button type="button" class="primary" onclick={() => void runReplacement(pendingReplacement!)}>Replace</button>
			<button type="button" onclick={() => (pendingReplacement = null)}>Cancel</button>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		background: #111117;
		color: #f4f0e9;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	.editor-host {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}
	.editor-body {
		display: flex;
		min-height: 0;
		flex: 1;
	}
	.stage-frame {
		position: relative;
		min-width: 0;
		flex: 1;
	}
	.stage {
		position: absolute;
		inset: 0;
		background: #111117;
		outline: none;
		touch-action: none;
	}
	.stage:focus-visible {
		box-shadow: inset 0 0 0 1px #d4ad45;
	}
	.stage :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.overlay-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.stage-actions {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		display: flex;
		gap: 0.4rem;
	}
	.stage-actions button {
		padding: 0.4rem 0.6rem;
		border: 1px solid #635a6f;
		border-radius: 0.35rem;
		background: rgb(25 24 31 / 85%);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.stage-actions button[aria-pressed='true'] {
		border-color: #d4ad45;
		color: #f4d98a;
	}
	.lens-unavailable {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(26rem, calc(100% - 2rem));
		padding: 1.1rem 1.25rem;
		border: 1px solid #4d4655;
		border-radius: 0.6rem;
		background: rgb(25 24 31 / 96%);
		box-sizing: border-box;
	}
	.lens-unavailable h2 {
		margin: 0 0 0.4rem;
		font-size: 1rem;
	}
	.lens-unavailable p {
		margin: 0 0 0.75rem;
		color: #bcb5c4;
		font-size: 0.86rem;
		line-height: 1.45;
	}
	.lens-unavailable button {
		padding: 0.4rem 0.7rem;
		border: 1px solid #635a6f;
		border-radius: 0.35rem;
		background: #292632;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.stage-note {
		position: absolute;
		left: 1rem;
		bottom: 6rem;
		margin: 0;
		padding: 0.4rem 0.6rem;
		border-radius: 0.35rem;
		background: rgb(25 24 31 / 88%);
		color: #e3c4c4;
	}
	.instrument-body {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.boot-panel {
		position: absolute;
		top: 4rem;
		left: 50%;
		transform: translateX(-50%);
		width: min(32rem, calc(100% - 2rem));
		padding: 1.25rem;
		border: 1px solid #4d4655;
		border-radius: 0.6rem;
		background: rgb(25 24 31 / 96%);
		box-sizing: border-box;
	}
	.boot-panel h1 {
		margin: 0 0 0.5rem;
		font-size: 1.15rem;
	}
	.boot-panel p {
		margin: 0 0 0.75rem;
		color: #bcb5c4;
	}
	.boot-panel button {
		margin-right: 0.5rem;
		padding: 0.5rem 0.8rem;
		border: 1px solid #635a6f;
		border-radius: 0.35rem;
		background: #292632;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.boot-panel button.primary {
		border-color: #b997f2;
		background: #8f69c8;
		color: #fff;
	}
	@media (max-width: 720px) {
		.editor-body {
			flex-direction: column;
		}
	}
</style>
