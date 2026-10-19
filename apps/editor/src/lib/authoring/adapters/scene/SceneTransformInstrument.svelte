<script lang="ts">
	/**
	 * T2.P01.S03 — the Scene editing instrument.
	 *
	 * It is mounted by `StageInstrumentHost` for the two tasks this adapter
	 * contributes (`place-object`, `scene-arrange`) and receives only the public
	 * `StageAdapterServices`, so it reads no host internals and edits no shell.
	 *
	 * Presentation is deliberately plain: P1 is a functional foundation, so the
	 * instrument's job is to expose the same writer for pointer-free exact values,
	 * show the planner's captured candidate and refusal reason, and never commit on
	 * blur. Esc/Close and unmount both run the session's one `cancel()`.
	 */
	import { onDestroy, untrack } from 'svelte';

	import type { StageAdapterServices } from '../../stage/stage-adapter-host';
	import {
		NATIVE_PLACEMENT_PRIMITIVES,
		type NativePlacementPrimitive
	} from '../../scene/object-definition-policy';
	import {
		publishSceneSurface,
		retireSceneSurface,
		sceneReadingKey,
		sceneSessionFromServices,
		sceneSurfaceFor,
		type SceneCandidate,
		type ScenePlacementSession,
		type SceneSurface,
		type SceneSessionOutcome
	} from './placement';

	let { services }: { services: StageAdapterServices } = $props();

	let entityId = $state('');
	let x = $state('0');
	let z = $state('0');
	let yaw = $state('0');
	let snapText = $state('');
	let primitive = $state<NativePlacementPrimitive>('box');
	let candidate = $state<SceneCandidate | null>(null);
	let message = $state('');
	let editing = $state(false);

	let session: ScenePlacementSession | null = null;
	/** Whether `message` is a refusal or failure reason the creator still needs. */
	let proposalRefused = false;
	/** The reading `session` belongs to; a redraw of it is not a change. */
	let sessionReading: string | null = null;
	let surface: SceneSurface | null = null;
	let surfaceSnapshot: object | null = null;

	const entities = $derived(services.stage.snapshot().domain.scene.entities);

	function selectionEntityId(): string | null {
		const primary = services.stage.selectionState().primary;
		if (primary === null || primary.domain !== 'scene' || primary.subject.kind !== 'entity') return null;
		return primary.subject.id;
	}

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
			const previous = session;
			const proposalWasOpen = editing;
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
			session?.setPointerOutcomeListener?.(applyOutcome);
			sessionReading = reading;
			surfaceSnapshot = snapshot;
			// The proposal belonged to the reading that just ended; the session it named
			// has been released, so the instrument shows the same cancel the creator
			// would see from Esc rather than an editable form with nothing behind it.
			if (proposalWasOpen) {
				editing = false;
				candidate = null;
				message = 'Cancelled; the accepted pose is unchanged.';
			}
			applySnap();
		}
		// A redraw reaches here too, and a redraw is where a host that ended the
		// lease underneath the proposal is first seen.
		dropDeadProposal();
		return session;
	}

	function applySnap(): void {
		const parsed = Number(snapText.trim());
		session?.setSnapStep(snapText.trim() === '' || !Number.isFinite(parsed) || parsed <= 0 ? null : parsed);
	}

	function candidateMessage(next: SceneCandidate): string {
		const pose = `${next.worldXZ[0].toFixed(3)}, ${next.worldXZ[1].toFixed(3)} m · ${next.yaw.toFixed(3)} rad`;
		return next.snappedStep === null
			? `Candidate ${pose}.`
			: `Candidate ${pose} · snap ${next.snappedStep} m applied.`;
	}

	function applyOutcome(outcome: SceneSessionOutcome): void {
		switch (outcome.kind) {
			case 'candidate':
				candidate = outcome.candidate;
				proposalRefused = false;
				// The fields show the pose the planner captured, not text it replaced.
				// A proposal is one exact group: a yaw proposal is the accepted X/Z plus
				// the new angle, and a move proposal keeps the accepted yaw. Rewriting
				// only the group this entry did not touch leaves the field being typed
				// alone, so incremental typing (`3.` on the way to `3.5`) is never
				// retyped from under the creator.
				if (outcome.candidate.kind === 'yaw') {
					x = String(outcome.candidate.position[0]);
					z = String(outcome.candidate.position[2]);
				} else if (outcome.candidate.kind === 'move') {
					yaw = String(outcome.candidate.yaw);
				}
				message = candidateMessage(outcome.candidate);
				// Both readings show the pose; the overlay reads the session's candidate.
				services.stage.notifySurfaceChange();
				break;
			case 'committed':
				candidate = null;
				editing = false;
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

	function useSelection(): void {
		const selected = selectionEntityId();
		if (selected === null) {
			message = 'Select one Scene entity first.';
			return;
		}
		entityId = selected;
	}

	function begin(): void {
		const current = ensureSession();
		if (current === null) return;
		if (entityId.trim() === '') {
			message = 'Choose a Scene entity to edit.';
			return;
		}
		const outcome = current.begin(entityId);
		if (outcome.kind === 'refused') {
			message = `${outcome.code}: ${outcome.message}`;
			return;
		}
		const entity = entities.find((entry) => entry.id === entityId);
		if (entity !== undefined) {
			x = String(entity.position[0]);
			z = String(entity.position[2]);
			yaw = String(entity.rotation[1]);
		}
		editing = true;
		candidate = null;
		proposalRefused = false;
		message = `Editing ${entityId}; no document change until Commit.`;
	}

	function updateEntry(kind: 'x' | 'z' | 'yaw', value: string): void {
		if (kind === 'x') x = value;
		else if (kind === 'z') z = value;
		else yaw = value;
		if (!editing || session === null) return;
		applyOutcome(session.setEntry(kind, value));
	}

	async function commit(): Promise<void> {
		if (session === null) return;
		applyOutcome(await session.commit());
	}

	function cancel(): void {
		if (!editing) return;
		session?.cancel();
		editing = false;
		candidate = null;
		message = 'Cancelled; the accepted pose is unchanged.';
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
		if (!editing || session === null || session.proposalLive()) return;
		// A refusal or failure reason outlives the form: it is why the proposal ended,
		// and the creator still needs it.
		const reason = proposalRefused ? message : null;
		proposalRefused = false;
		cancel();
		if (reason !== null) message = reason;
	}

	function onKeydown(event: KeyboardEvent): void {
		if (!editing) return;
		if (event.key === 'Enter') {
			event.preventDefault();
			if (candidate !== null) void commit();
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			cancel();
		}
	}

	/**
	 * Blur out of the active editing subtree is the same cancel path; focus inside
	 * it is not.
	 *
	 * The handler is bound to the editing subtree, not the instrument root. Opening
	 * a proposal removes the focused Begin control through the Svelte branch
	 * transition, and the browser delivers that removal's `focusout` at the root;
	 * binding here keeps it from cancelling the proposal it just opened.
	 */
	function onFocusOut(event: FocusEvent): void {
		if (!editing) return;
		const next = event.relatedTarget;
		if (next instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(next)) return;
		cancel();
	}

	async function place(): Promise<void> {
		const current = ensureSession();
		if (current === null) return;
		if (x.trim() === '' || z.trim() === '') {
			message = 'X and Z are required; a blank field is not zero.';
			return;
		}
		const appliedSnap = current.snapStep();
		const outcome = await current.place(primitive, Number(x), Number(z));
		if (outcome.kind === 'committed') {
			candidate = null;
			// Snap is never silent: a Place that applied a step says so. The adapter's
			// completion selects the new entity and keeps the tool armed; the instrument
			// does not select through its task-scoped services, which the accepted
			// install has already retired.
			const snapNote = appliedSnap === null ? '' : ` · snap ${appliedSnap} m applied`;
			message = `Placed one ${primitive}${snapNote}.`;
			return;
		}
		applyOutcome(outcome);
	}

	// The task's instrument mounts with a live session so the adapter's pointer
	// claim, the overlay and typed entry read the same candidate.
	$effect(() => {
		// The host re-providing services is the one reason to re-read the session.
		// The check itself reads this instrument's own state (`editing`, `snapText`)
		// and writes `message`; tracking that made the effect re-run on every
		// keystroke, tearing down the session — and the proposal — it was showing.
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
			// A redraw keeps the lease; a host that ends it while the reading stays
			// put has ended the proposal all the same, and this frame loop is the one
			// observer that runs even when the panel is not re-rendered.
			dropDeadProposal();
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

{#snippet snapRow()}
	<div class="row">
		<label>
			<span>Snap (m, optional)</span>
			<input
				type="text"
				inputmode="decimal"
				value={snapText}
				oninput={(event) => {
					snapText = event.currentTarget.value;
					applySnap();
				}}
			/>
		</label>
		<span class="hint">Snap is explicit and off by default.</span>
	</div>
{/snippet}

<section class="scene-instrument" aria-label="Scene transform">
	{#if editing}
		<div class="editing" onfocusout={onFocusOut}>
			<div class="row">
				<span class="subject">Editing <code>{entityId}</code></span>
				<button type="button" class="quiet" onclick={cancel}>Cancel</button>
			</div>
			<div class="fields">
				<label>
					<span>X (m)</span>
					<input
						type="text"
						inputmode="decimal"
						value={x}
						onkeydown={onKeydown}
						oninput={(event) => updateEntry('x', event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Z (m)</span>
					<input
						type="text"
						inputmode="decimal"
						value={z}
						onkeydown={onKeydown}
						oninput={(event) => updateEntry('z', event.currentTarget.value)}
					/>
				</label>
				<label>
					<span>Yaw (rad)</span>
					<input
						type="text"
						inputmode="decimal"
						value={yaw}
						onkeydown={onKeydown}
						oninput={(event) => updateEntry('yaw', event.currentTarget.value)}
					/>
				</label>
			</div>
			<div class="row">
				<button type="button" onclick={commit} disabled={candidate === null}>Commit</button>
				<span class="hint">Enter commits exact values; Esc or leaving the instrument cancels.</span>
			</div>
			{@render snapRow()}
		</div>
	{:else}
		<div class="row">
			<label class="grow">
				<span>Entity</span>
				<select bind:value={entityId}>
					<option value="">Choose…</option>
					{#each entities as entity (entity.id)}
						<option value={entity.id}>{entity.name} · {entity.kind}</option>
					{/each}
				</select>
			</label>
			<button type="button" class="quiet" onclick={useSelection}>Use selection</button>
			<button type="button" onclick={begin}>Begin</button>
		</div>
		<div class="row place">
			<label>
				<span>Place</span>
				<select
					value={primitive}
					onchange={(event) => {
						primitive = event.currentTarget.value as NativePlacementPrimitive;
						session?.setPlacePrimitive(primitive);
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
		{@render snapRow()}
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
