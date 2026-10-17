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
	import type { StageAdapterServices } from '../../stage/stage-adapter-host';
	import {
		NATIVE_PLACEMENT_PRIMITIVES,
		type NativePlacementPrimitive
	} from '../../scene/object-definition-policy';
	import {
		publishSceneSurface,
		sceneEntityReference,
		sceneSessionFromServices,
		type SceneCandidate,
		type ScenePlacementSession,
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
	let sessionEvaluationId: string | null = null;

	const entities = $derived(services.stage.snapshot().domain.scene.entities);

	function selectionEntityId(): string | null {
		const primary = services.stage.selectionState().primary;
		if (primary === null || primary.domain !== 'scene' || primary.subject.kind !== 'entity') return null;
		return primary.subject.id;
	}

	function ensureSession(): ScenePlacementSession | null {
		const evaluationId = services.stage.evaluationId();
		if (evaluationId === null) {
			message = 'The Stage has not evaluated a reading yet; wait for the reading to settle.';
			return null;
		}
		if (session === null || sessionEvaluationId !== evaluationId) {
			session?.cancel();
			session = sceneSessionFromServices({ services, evaluationId });
			sessionEvaluationId = evaluationId;
			// The adapter's pointer claim and overlay read this same session.
			publishSceneSurface({ evaluationId, session });
			applySnap();
		}
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
				message = candidateMessage(outcome.candidate);
				// Both readings show the pose; the overlay reads the session's candidate.
				services.stage.notifySurfaceChange();
				break;
			case 'committed':
				candidate = null;
				editing = false;
				message = 'Committed.';
				services.stage.notifySurfaceChange();
				break;
			case 'refused':
				// A refused or invalid proposal is not a candidate: Commit must not
				// carry a pose the planner has already rejected.
				candidate = null;
				message = `${outcome.code}: ${outcome.message}`;
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

	/** Blur out of the instrument is the same cancel path; focus inside it is not. */
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
			// Snap is never silent: a Place that applied a step says so.
			const snapNote = appliedSnap === null ? '' : ` · snap ${appliedSnap} m applied`;
			// The newly accepted entity becomes the selection through canonical
			// selection (no Plan fragment is required) at the post-accept revision.
			const placedId = current.placedEntityId();
			let selectionNote = '';
			if (placedId !== null) {
				const reference = sceneEntityReference(placedId, services.stage.snapshot().sourceContentId);
				const selected = services.stage.setSelection({ ordered: [{ reference }], primary: reference });
				selectionNote =
					selected.kind === 'selected' ? ' Selected.' : ` Selection refused: ${selected.message}`;
			}
			message = `Placed one ${primitive}${snapNote}.${selectionNote}`;
			return;
		}
		applyOutcome(outcome);
	}

	// One cancel path: unmount releases the lease and restores the accepted baseline.
	$effect(() => {
		return () => {
			session?.cancel();
			publishSceneSurface(null);
		};
	});
</script>

<section class="scene-instrument" aria-label="Scene transform" onfocusout={onFocusOut}>
	{#if editing}
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
					onchange={(event) => (primitive = event.currentTarget.value as NativePlacementPrimitive)}
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
	{/if}

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
