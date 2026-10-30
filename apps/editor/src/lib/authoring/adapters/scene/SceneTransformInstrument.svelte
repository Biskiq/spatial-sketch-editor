<script lang="ts">
	/**
	 * T2.P01.S03 — the Scene editing instrument.
	 *
	 * It is mounted by `StageInstrumentHost` for this adapter's tasks
	 * (`place-object`, `scene-compose`, `import-model`) and receives only the public
	 * `StageAdapterServices`, so it reads no host internals and edits no shell.
	 *
	 * R217.S08 removes the old Arrange posture: a selected object's exact Position,
	 * Yaw and Size are the Card writer, while this panel keeps Place and the
	 * bounded Compose commands. Presentation is deliberately plain; it shows the
	 * planner's captured candidate and refusal reason, and never commits on blur.
	 * Esc/Close and unmount both run the session's one `cancel()`.
	 */
	import { onDestroy, tick, untrack } from 'svelte';

	import { UNIT_SOURCE_KIND } from '@portfolio/project-model/units';

	import type { StageAdapterServices } from '../../stage/stage-adapter-host';
	import { stageEnvelope } from '../../stage/unit-stage-source';
	import { draftingSnapIncrementMeters } from '../../stage/stage-drafting';
	import { drawnGridMinorMeters } from '../../stage/stage-grid';
	import { choosePrimitive, peekArmedModel } from './import/definitions';
	import MyObjectsSectionLazy from './library/MyObjectsSectionLazy.svelte';
	import {
		NATIVE_PLACEMENT_PRIMITIVES,
		type NativePlacementPrimitive
	} from '../../scene/object-definition-policy';
	import {
		publishSceneSurface,
		retireSceneSurface,
		sceneReadingKey,
		sceneComposeSupport,
		sceneModelContactMinY,
		sceneSessionFromServices,
		sceneSurfaceFor,
		type ArmedFormCopy,
		type SceneCandidate,
		type ScenePlacementSession,
		type SceneSurface,
		type SceneSessionOutcome
	} from './placement';

	let { services }: { services: StageAdapterServices } = $props();

	let x = $state('0');
	let z = $state('0');
	/** S04's uniform Resize entry; blank/non-finite/non-positive never commits. */
	let composeScaleText = $state('');
	let composeActive = $state(false);
	/** The entity the active Resize proposal was opened for, never a live guess. */
	let composeSubjectId = $state<string | null>(null);
	let primitive = $state<NativePlacementPrimitive>('box');
	let candidate = $state<SceneCandidate | null>(null);
	let message = $state('');

	let session: ScenePlacementSession | null = null;
	/** Whether `message` is a refusal or failure reason the creator still needs. */
	let proposalRefused = false;
	/** The reading `session` belongs to; a redraw of it is not a change. */
	let sessionReading: string | null = null;
	let surface: SceneSurface | null = null;
	let surfaceSnapshot: object | null = null;
	/** The scale field a freshly opened Resize proposal hands focus to. */
	let scaleInput: HTMLInputElement | null = $state(null);
	/** True between opening a proposal and its field taking focus. */
	let openingProposal = false;

	const entities = $derived(services.stage.snapshot().domain.scene.entities);
	/** An empty baseline has a datum but no Room floor to seat a placement on. */
	const hasRoomFloor = $derived.by(() => {
		const snapshot = services.stage.snapshot();
		if (snapshot.sourceKind !== UNIT_SOURCE_KIND) return true;
		return stageEnvelope(snapshot).units.layout.data.rooms.length > 0;
	});
	/**
	 * Whether this mount is S04's bounded Compose surface. The adapter contributes
	 * the same instrument for all three tasks, and a new task re-provides services,
	 * so this follows the live task rather than a captured bind-time kind.
	 */
	const composeTask = $derived.by(() => {
		void services;
		return services.stage.session?.task?.()?.kind === 'scene-compose';
	});
	/** The Place task is the only task an approved model can be armed for. */
	const placeTask = $derived.by(() => {
		void services;
		return services.stage.session?.task?.()?.kind === 'place-object';
	});
	/**
	 * Whether this Place session carries an approved creator model.
	 *
	 * A native primitive needs no floor, so the no-floor guidance must not appear
	 * for it. The arm is read from the live session, which is the session the
	 * project's pending approval is applied to whenever Place opens.
	 */
	let armedModelPresent = $state(false);
	/**
	 * The My Objects copy armed for this Place session, mirrored for its panel.
	 * `$state.raw` keeps the session's own handle identity: a deep proxy would
	 * differ from the raw arm on every frame and rewrite the mirror forever.
	 */
	let armedFormCopy = $state.raw<ArmedFormCopy | null>(null);
	/** The ready words written for `armedFormCopy`; replaced, never left stale. */
	let readyMessage: string | null = null;

	function selectionEntityId(): string | null {
		const primary = services.stage.selectionState().primary;
		if (primary === null || primary.domain !== 'scene' || primary.subject.kind !== 'entity') return null;
		return primary.subject.id;
	}

	function composeEntity() {
		const id = selectionEntityId();
		return id === null ? null : entities.find((entity) => entity.id === id) ?? null;
	}

	/**
	 * What Compose may offer for the selected subject, from the same capability
	 * the session enforces. A light or model has no verified contact, so Resize
	 * and Duplicate stay disabled with the reason shown instead of taking a lease
	 * and refusing after the fact.
	 */
	const composeSubject = $derived(composeEntity());
	const composeSupport = $derived.by(() => {
		if (composeSubject === null) return null;
		// A model's contact is approved resource metadata, not a mesh bound. Read
		// it from the accepted envelope so Resize/Duplicate reflect the same
		// capability the session enforces instead of disabling both for every
		// creator model.
		const contact =
			composeSubject.kind === 'model'
				? sceneModelContactMinY(stageEnvelope(services.stage.snapshot()), composeSubject)
				: null;
		return sceneComposeSupport(composeSubject, contact);
	});

	/**
	 * The session for the live reading, created or replaced only when the **reading**
	 * changes.
	 *
	 * The Stage redraws on every frame and its evaluation token advances with each
	 * draw, so an id comparison here would rebuild the session — and cancel the
	 * proposal it is showing — on any redraw the host requests, including the one a
	 * typed candidate asks for itself. A proposal is identified by its reading and
	 * by the lease the host ends when that reading changes; only those replace it.
	 */
	function ensureSession(): ScenePlacementSession | null {
		const evaluation = services.stage.evaluation();
		const evaluationId = services.stage.evaluationId();
		if (evaluation === null || evaluationId === null) {
			message = 'The Stage has not evaluated a reading yet; wait for the reading to settle.';
			return null;
		}
		const reading = sceneReadingKey(evaluation);
		const snapshot = services.stage.snapshot();
		const registered = sceneSurfaceFor(snapshot, evaluation);
		// The registry, not this component's cache, is the authority for a reading:
		// a re-armed task or a binding teardown can publish a different session for
		// the same reading, and a cached one kept past that would be the session
		// nothing names and nothing releases.
		const replaced = session !== null && registered !== null && registered.session !== session;
		if (session === null || sessionReading !== reading || replaced) {
			// The hint below is capability-specific: read the arm from the session
			// that will commit, not from Import's already-consumed pending slot.
			const previous = session;
			const proposalWasOpen = composeActive;
			// A saved copy is armed for one reading's session. Replacing the session
			// must not leave the panel saying it is ready when the next click would
			// place a native primitive instead.
			const previousCopy = previous?.armedFormCopy() ?? null;
			// A reading change replaces the session without rebuilding the adapter
			// binding, so the persistent-Place listener the adapter installed is carried
			// to whichever session carries the creator's next typed commit.
			const persistentPlace = previous?.placementCommittedListener() ?? null;
			// The release is the registry's: publishing a different reading cancels the
			// session that prepared its proposal, and a reading whose surface already
			// exists published it the same way. Cancelling here as well would be a
			// second release of the same lease.
			// The adapter publishes the surface when its task opens; a reading change
			// (which does not rebuild the binding) is refreshed here. The registry is
			// keyed by this accepted snapshot, so only this Stage's surface is read.
			const existing = registered;
			if (previous !== null && previous !== existing?.session) previous.setPointerOutcomeListener?.(null);
			if (existing !== null) {
				session = existing.session;
				surface = existing;
			} else {
				session = sceneSessionFromServices({ services, evaluationId });
				surface = { reading, session };
				publishSceneSurface(snapshot, surface);
			}
			if (session !== null && persistentPlace !== null && session.placementCommittedListener() === null) {
				session.setPlacementCommittedListener(persistentPlace);
			}
			session?.setPointerOutcomeListener?.(applyPointerOutcome);
			// The panel can be remounted while the Place task stays open (a drawing
			// install replaces the accepted source). The approved model belongs to
			// the project's pending arm, not to the session that first carried it, so
			// apply it here as well as at task open.
			if (session !== null && services.stage.session?.task?.()?.kind === 'place-object') {
				if (session.armedModel() === null) {
					const pending = peekArmedModel(snapshot.acceptedRevision.projectId);
					if (pending !== null) session.setArmedModel(pending);
				}
				armedModelPresent = session.armedModel() !== null;
			} else {
				armedModelPresent = false;
			}
			sessionReading = reading;
			surfaceSnapshot = snapshot;
			// The proposal belonged to the reading that just ended; the session it named
			// has been released, so the instrument shows the same cancel the creator
			// would see from Esc rather than an editable form with nothing behind it.
			if (proposalWasOpen) {
				composeActive = false;
				composeSubjectId = null;
				candidate = null;
				message = 'Cancelled; the accepted pose is unchanged.';
			} else if (previousCopy !== null && session?.armedFormCopy() === null) {
				// An accepted insertion consumes the arm in the session that committed
				// it; a replaced session loses it. Only the latter reaches here with an
				// arm the creator still believes is live.
				armedFormCopy = null;
				message = 'The saved copy is no longer armed; choose Insert again.';
			}
		}
		// A redraw reaches here too, and a redraw is where a host that ended the
		// lease underneath the proposal is first seen.
		dropDeadProposal();
		return session;
	}

	/**
	 * A pointer commit is an accepted install too: the host closes the task and
	 * retires this panel before the adapter reports the outcome. Only a
	 * non-accepted outcome has anything for the visible panel to say.
	 */
	function applyPointerOutcome(outcome: SceneSessionOutcome): void {
		if (outcome.kind !== 'committed') applyOutcome(outcome);
	}

	function applyOutcome(outcome: SceneSessionOutcome): void {
		switch (outcome.kind) {
			case 'candidate':
				candidate = outcome.candidate;
				proposalRefused = false;
				if (outcome.candidate.kind === 'resize') {
					// Scale is the proposal; the shown Y is the planner's contact result, so
					// the creator sees exactly the re-seat commit will install.
					message = `Candidate scale ${outcome.candidate.scale} · Y ${outcome.candidate.position[1].toFixed(3)} m.`;
					services.stage.notifySurfaceChange();
				}
				break;
			case 'committed':
				candidate = null;
				proposalRefused = false;
				message = 'Committed.';
				services.stage.notifySurfaceChange();
				break;
			case 'refused':
				// A refused proposal is not a candidate: Commit must not carry a pose the
				// planner rejected. The form stays open because a refused *entry* keeps
				// the lease and the creator can correct the value; a refusal that did end
				// the lease closes it on the next frame, keeping this reason.
				candidate = null;
				proposalRefused = true;
				message = `${outcome.code}: ${outcome.message}`;
				services.stage.notifySurfaceChange();
				break;
			case 'failed':
				// The transport failed, not the proposal's domain validity; the session
				// withdraws the lease, so Commit must not stay armed. The form closes on
				// the next frame and keeps this reason.
				candidate = null;
				proposalRefused = true;
				message = `Acceptance failed: ${outcome.message}`;
				services.stage.notifySurfaceChange();
				break;
			case 'invalid':
				candidate = null;
				message = `Not accepted: ${outcome.message}`;
				break;
			case 'idle':
				break;
		}
	}

	function cancel(): void {
		if (!composeActive) return;
		session?.cancel();
		composeActive = false;
		composeSubjectId = null;
		candidate = null;
		message = 'Cancelled; the accepted pose is unchanged.';
	}

	/** Seed a Resize proposal from the selected entity's accepted scale. */
	function beginResize(): void {
		const current = ensureSession();
		if (current === null) return;
		const entity = composeEntity();
		if (entity === null) {
			message = 'Select one Scene entity first.';
			return;
		}
		const outcome = current.beginResize(entity.id);
		if (outcome.kind === 'refused') {
			message = `${outcome.code}: ${outcome.message}`;
			return;
		}
		composeActive = true;
		composeSubjectId = entity.id;
		candidate = null;
		proposalRefused = false;
		composeScaleText = String(typeof entity.scale === 'number' ? entity.scale : 1);
		message = `Editing scale of ${entity.id}; no document change until Resize.`;
		// Opening removes the focused Resize… control. Hand focus to the field in
		// the same update so the removal's focusout cannot read as leaving the
		// instrument and cancel the proposal it just opened.
		openingProposal = true;
		void tick().then(() => {
			scaleInput?.focus();
			openingProposal = false;
		});
	}

	function updateScale(value: string): void {
		composeScaleText = value;
		if (!composeActive || session === null) return;
		applyOutcome(session.setResizeEntry(value));
	}

	async function commitResize(): Promise<void> {
		if (session === null || !composeActive) return;
		const outcome = await session.commitResize();
		if (outcome.kind === 'committed') {
			// The accepted install retired this panel's task services; there is no
			// surface left to notify from here.
			composeActive = false;
			composeSubjectId = null;
			candidate = null;
			return;
		}
		applyOutcome(outcome);
	}

	/**
	 * Duplicate is one immediate command with a captured id. The adapter's
	 * completion selects the copy at the post-accept revision; the planner refuses
	 * a cluster member instead of silently regrouping it.
	 */
	async function duplicateSelected(): Promise<void> {
		const current = ensureSession();
		if (current === null) return;
		const entity = composeEntity();
		if (entity === null) {
			message = 'Select one Scene entity first.';
			return;
		}
		const outcome = await current.duplicate(entity.id);
		// The accepted install closes this task; the host's adapter completion owns
		// the post-accept notification and selection, not this retired panel.
		if (outcome.kind !== 'committed') applyOutcome(outcome);
	}
	/** Delete removes exactly the selected entity; membership cleanup is atomic. */
	async function deleteSelected(): Promise<void> {
		const current = ensureSession();
		if (current === null) return;
		const entity = composeEntity();
		if (entity === null) {
			message = 'Select one Scene entity first.';
			return;
		}
		const outcome = await current.remove(entity.id);
		if (outcome.kind !== 'committed') applyOutcome(outcome);
	}

	/**
	 * Drop a proposal whose lease the host has already ended.
	 *
	 * A reading change replaces the session, but the host can also end the grant
	 * while the reading stays put (a content install, or a second publisher on the
	 * same reading). The registry then still names this session, so nothing would
	 * replace it, and the form would keep showing a candidate whose only remaining
	 * outcome is Commit's refusal. The proposal is over either way, so it leaves
	 * through the one release path the creator also reaches with Esc.
	 */
	function dropDeadProposal(): void {
		if (!composeActive || session === null || session.proposalLive()) return;
		// A refusal or failure reason outlives the form: it is why the proposal ended,
		// and the creator still needs it.
		const reason = proposalRefused ? message : null;
		proposalRefused = false;
		cancel();
		if (reason !== null) message = reason;
	}

	function onKeydown(event: KeyboardEvent): void {
		if (composeActive) {
			if (event.key === 'Enter') {
				event.preventDefault();
				if (candidate?.kind === 'resize') void commitResize();
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				cancel();
			}
			return;
		}
	}

	/**
	 * Blur out of the active editing subtree is the same cancel path; focus inside
	 * it is not.
	 *
	 * The handler is bound to the editing subtree, not the instrument root. Opening
	 * a proposal removes the focused Resize… control through the Svelte branch
	 * transition, and the browser delivers that removal's `focusout` at the root;
	 * binding here keeps it from cancelling the proposal it just opened.
	 */
	function onFocusOut(event: FocusEvent): void {
		if (!composeActive) return;
		// A control that opens a proposal is removed by that same update. Its
		// focusout names no related target, but the replacement field is focused
		// a tick later; it is a transition, not the creator leaving the form.
		if (openingProposal) return;
		const subtree = event.currentTarget;
		const next = event.relatedTarget;
		if (next instanceof Node && subtree instanceof Node && subtree.contains(next)) return;
		cancel();
	}

	async function place(): Promise<void> {
		const current = ensureSession();
		if (current === null) return;
		if (x.trim() === '' || z.trim() === '') {
			message = 'X and Z are required; a blank field is not zero.';
			return;
		}
		const drafting = services.stage.drafting();
		const evaluation = services.stage.evaluation();
		const currentMinor = drawnGridMinorMeters(
			drafting,
			evaluation?.targetPlaneMetersPerCssPixel ?? null
		);
		const appliedSnap = draftingSnapIncrementMeters(drafting, currentMinor);
		current.setSnapStep(appliedSnap);
		const copyArmed = current.armedFormCopy();
		const modelArmed = copyArmed === null && current.armedModel() !== null;
		const outcome = await current.place(primitive, Number(x), Number(z));
		if (outcome.kind === 'committed') {
			candidate = null;
			if (copyArmed !== null) armedFormCopy = null;
			// Snap is never silent: a Place that applied a step says so. The adapter's
			// completion selects the new entity and keeps the tool armed; the instrument
			// does not select through its task-scoped services, which the accepted
			// install has already retired.
			const snapNote = appliedSnap === null ? '' : ` · snap ${appliedSnap} m applied`;
			if (copyArmed !== null) {
				message = `Placed an editable copy of “${copyArmed.item.name}”${snapNote}.`;
			} else if (modelArmed) {
				armedModelPresent = false;
				message = `Placed the approved model${snapNote}.`;
			} else {
				message = `Placed one ${primitive}${snapNote}.`;
			}
			return;
		}
		applyOutcome(outcome);
	}

	/**
	 * Arm one saved My Objects copy for this Place session.
	 *
	 * The copy is a session arm like an approved model: the adapter's pointer claim
	 * previews it and the typed Place commits it. Its captured contact comes from
	 * the item's own evaluated source; the planner re-validates it at accept.
	 */
	function armFormCopy(copy: ArmedFormCopy): boolean {
		const current = ensureSession();
		if (current === null) return false;
		current.setArmedFormCopy(copy);
		armedFormCopy = copy;
		armedModelPresent = false;
		candidate = null;
		readyMessage = `${copy.item.name} is ready: click its floor position, or enter X/Z and Place.`;
		message = readyMessage;
		return true;
	}

	/** Disarm the copy without closing Place or the panel. */
	function clearFormCopy(): void {
		session?.setArmedFormCopy(null);
		armedFormCopy = null;
		readyMessage = null;
		message = 'The saved copy is no longer armed.';
	}

	// The task's instrument mounts with a live session so the adapter's pointer
	// claim, the overlay and typed entry read the same candidate.
	$effect(() => {
		// The host re-providing services is the one reason to re-read the session.
		// The check itself reads this instrument's own state (`composeActive`) and writes
		// `message`; tracking that made the effect re-run on
		// every keystroke, tearing down the session — and the proposal — it was showing.
		void services;
		untrack(() => ensureSession());
	});

	/**
	 * Watch the reading itself, not the props.
	 *
	 * A reading change does not rebuild the adapter binding, and the host is not
	 * obliged to re-render this panel when the creator switches Plan↔3D: the
	 * gesture lease ends, but without this the form would keep showing a candidate
	 * the host has already invalidated. The comparison is one string per frame — the
	 * same frame loop the Stage already runs — and only a real change does work.
	 */
	$effect(() => {
		let frame = 0;
		let seen: string | null = null;
		const watch = () => {
			frame = requestAnimationFrame(watch);
			const evaluation = services.stage.evaluation();
			const reading = evaluation === null ? null : sceneReadingKey(evaluation);
			if (reading !== null && reading !== seen) {
				seen = reading;
				untrack(() => ensureSession());
				return;
			}
			// A Resize proposal is bound to the subject it was opened for. The panel's
			// label and the eventual install must never name different entities, so a
			// canonical selection change ends the proposal before it can commit the
			// previous subject. This loop is the one observer that runs even when the
			// panel is not re-rendered by the selection change.
			if (composeActive && composeSubjectId !== null && selectionEntityId() !== composeSubjectId) {
				untrack(() => {
					cancel();
					message = 'Resize cancelled; the selection changed.';
				});
			}
			// A redraw keeps the lease; a host that ends it while the reading stays
			// put has ended the proposal all the same, and this frame loop is the one
			// observer that runs even when the panel is not re-rendered.
			dropDeadProposal();
			// An accepted insertion consumes the armed copy inside the session; the
			// panel reads the same arm, so it clears its marker from that authority
			// rather than from a second completion path.
			const liveCopy = session?.armedFormCopy() ?? null;
			if (liveCopy !== armedFormCopy) {
				// A pointer commit consumes the arm without passing through this panel.
				// Its ready line is no longer true, so replace it at the same authority
				// the panel reads.
				if (liveCopy === null && armedFormCopy !== null && message === readyMessage) {
					message = 'The saved copy is no longer armed; choose Insert again.';
					readyMessage = null;
				}
				armedFormCopy = liveCopy;
			}
		};
		frame = requestAnimationFrame(watch);
		return () => cancelAnimationFrame(frame);
	});

	// Unmount is the one cancel this instrument owns outright. It runs on destroy
	// only: a re-render re-provides services and must keep the proposal, so the
	// release cannot live in an effect cleanup. The identity-checked retirement
	// cannot delete a replacement published for a newer reading.
	onDestroy(() => {
		session?.setPointerOutcomeListener?.(null);
		session?.cancel();
		if (surface !== null && surfaceSnapshot !== null) {
			retireSceneSurface(surfaceSnapshot, surface);
		}
		surface = null;
		surfaceSnapshot = null;
	});
</script>

<section class="scene-instrument" aria-label="Scene transform">
	{#if composeTask}
		<div class="editing" onfocusout={onFocusOut}>
			<div class="row">
				<span class="subject"
					>Compose <code>{composeActive ? composeSubjectId ?? 'no entity' : composeSubject?.id ?? 'no entity'}</code></span
				>
				{#if composeActive}<button type="button" class="quiet" onclick={cancel}>Cancel</button>{/if}
			</div>
			{#if composeActive}
				<div class="fields">
					<label>
						<span>Scale (uniform)</span>
						<input
							bind:this={scaleInput}
							type="text"
							inputmode="decimal"
							value={composeScaleText}
							onkeydown={onKeydown}
							oninput={(event) => updateScale(event.currentTarget.value)}
						/>
					</label>
					<button type="button" onclick={commitResize} disabled={candidate?.kind !== 'resize'}>Resize</button>
				</div>
			{:else}
				<div class="row">
					<button
						type="button"
						onmousedown={(event) => event.preventDefault()}
						onclick={beginResize}
						disabled={composeSupport === null || !composeSupport.resize}
					>
						Resize…
					</button>
				</div>
			{/if}
			<div class="row">
				<button type="button" onclick={duplicateSelected} disabled={composeSupport === null || !composeSupport.duplicate}>Duplicate</button>
				<button type="button" onclick={deleteSelected} disabled={composeSubject === null}>Delete</button>
			</div>
			<p class="hint">Uniform scale only; X, Z and yaw are preserved. Duplicate adds one copy at +0.5 m X/Z. Delete removes exactly one entity. Each is one history entry.</p>
			{#if composeSupport?.reason}
				<p class="hint">{composeSupport.reason}</p>
			{/if}
		</div>
	{:else}
		<div class="row place">
			<label>
				<span>Place</span>
				<select
					value={primitive}
					onchange={(event) => {
						primitive = event.currentTarget.value as NativePlacementPrimitive;
						choosePrimitive(
							services.stage.snapshot().acceptedRevision.projectId,
							session,
							primitive
						);
						// Choosing a primitive is the explicit replacement of an armed copy.
						const liveCopy = session?.armedFormCopy() ?? null;
						if (liveCopy === null && armedFormCopy !== null && message === readyMessage) {
							message = 'The saved copy is no longer armed; the primitive replaces it.';
							readyMessage = null;
						}
						armedFormCopy = liveCopy;
					}}
				>
					{#each NATIVE_PLACEMENT_PRIMITIVES as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>X (m)</span>
				<input type="text" inputmode="decimal" value={x} oninput={(event) => (x = event.currentTarget.value)} />
			</label>
			<label>
				<span>Z (m)</span>
				<input type="text" inputmode="decimal" value={z} oninput={(event) => (z = event.currentTarget.value)} />
			</label>
			<button type="button" onclick={place}>Place</button>
		</div>
		{#if placeTask && !hasRoomFloor}
			<p class="hint refusal" role="status">
				{armedFormCopy !== null
					? 'No Room floor yet. This saved copy stays ready: draw an enclosure with Ink, then click its floor position.'
					: armedModelPresent
						? 'No Room floor yet. This model stays ready: draw an enclosure with Ink, then reopen Place object.'
						: 'No Room floor yet. Draw an enclosure with Ink before placing an object.'}
			</p>
		{/if}
		<p class="hint">
			{armedFormCopy !== null
				? 'The saved copy is placed by clicking its floor position; Place installs it at X/Z, and choosing a primitive replaces it.'
				: armedModelPresent
					? 'The approved model is placed by clicking its floor position; Place installs it at X/Z, and choosing a primitive replaces it.'
					: 'An imported model is placed by clicking its floor position; these typed fields place a native primitive.'}
		</p>
		{#if placeTask}
			<MyObjectsSectionLazy
				armedCopy={armedFormCopy}
				{hasRoomFloor}
				onArm={armFormCopy}
				onClear={clearFormCopy}
			/>
		{/if}
	{/if}

	<p class="feedback" aria-live="polite">{message}</p>
</section>

<style>
	.scene-instrument {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.78rem;
	}

	.row {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.fields {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.editing {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	label > span {
		color: #8f8a99;
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	input,
	select,
	button {
		font: inherit;
		padding: 0.2rem 0.4rem;
		border: 1px solid #635a6f;
		border-radius: 0.3rem;
		background: #292632;
		color: inherit;
	}

	input {
		width: 6.5rem;
	}

	button {
		cursor: pointer;
	}

	button:disabled {
		cursor: default;
		opacity: 0.5;
	}

	button.quiet {
		background: transparent;
	}

	.subject code {
		color: #c9a9ff;
	}

	.hint {
		color: #8f8a99;
	}

	.feedback {
		margin: 0;
		min-height: 1.1rem;
		color: #e7e4dd;
	}
</style>
