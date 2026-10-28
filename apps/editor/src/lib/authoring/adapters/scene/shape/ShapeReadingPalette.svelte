<script lang="ts">
	/**
	 * T5.P01.S02 — the Scene Shape reading's controls inside the one Ink palette.
	 *
	 * The contributing Scene binding publishes this reading's surface; this panel
	 * reads it and calls its controller like every other Ink reader. It owns no
	 * outline, depth or source: those live in the session, and the session's one
	 * planner is what previews and creates.
	 */
	import {
		DEFAULT_SHAPE_DEPTH_METERS,
		SHAPE_KINDS,
		shapeReadingSurface,
		shapeReadingSurfaceRevision,
		type ShapeKind,
		type ShapeReadingSnapshot
	} from './reading';

	const emptySnapshot: ShapeReadingSnapshot = {
		kind: 'line',
		plane: 'plan',
		sheet: { x: 0, z: 0, yaw: 0 },
		phase: 'outline',
		points: 0,
		canFinish: false,
		canCreate: false,
		depthText: String(DEFAULT_SHAPE_DEPTH_METERS),
		depth: DEFAULT_SHAPE_DEPTH_METERS,
		flip: false,
		refusal: null,
		outlineSize: null,
		facts: []
	};

	let snapshot = $state<ShapeReadingSnapshot>(emptySnapshot);
	let sheetX = $state('0');
	let sheetZ = $state('0');
	let sheetYaw = $state('0');
	let depthText = $state(String(DEFAULT_SHAPE_DEPTH_METERS));
	let sheetError = $state<string | null>(null);
	let depthError = $state<string | null>(null);

	$effect(() => {
		let frame = 0;
		let seenRevision = -1;
		const watch = () => {
			frame = requestAnimationFrame(watch);
			const surface = shapeReadingSurface();
			const revision = shapeReadingSurfaceRevision();
			if (surface === null) return;
			if (revision === seenRevision) return;
			seenRevision = revision;
			const next = surface.snapshot();
			snapshot = next;
			sheetX = String(Number(next.sheet.x.toFixed(3)));
			sheetZ = String(Number(next.sheet.z.toFixed(3)));
			sheetYaw = String(Number(((next.sheet.yaw * 180) / Math.PI).toFixed(1)));
			depthText = next.depthText;
		};
		frame = requestAnimationFrame(watch);
		return () => cancelAnimationFrame(frame);
	});

	const surface = () => shapeReadingSurface();
	const readingSummary = $derived(
		SHAPE_KINDS.find((entry) => entry.id === snapshot.kind)?.summary ?? ''
	);
	const activeSummary = $derived(
		snapshot.phase === 'outline'
			? 'Click points on the sheet; the panel validates the closed outline as you draw.'
			: 'Pull the depth handle or type a depth, then Create.'
	);

	function commitSheet(): void {
		const x = Number(sheetX);
		const z = Number(sheetZ);
		const yawDegrees = Number(sheetYaw);
		if (![x, z, yawDegrees].every(Number.isFinite)) {
			sheetError = 'Enter finite metres and degrees.';
			return;
		}
		sheetError = null;
		surface()?.controller.setSheet({ x, z, yaw: (yawDegrees * Math.PI) / 180 });
	}

	function commitDepth(): void {
		const value = Number(depthText);
		if (!Number.isFinite(value)) {
			depthError = 'Enter a finite depth in metres.';
			return;
		}
		depthError = null;
		surface()?.controller.setDepth(depthText);
	}

	function setKind(kind: ShapeKind): void {
		surface()?.controller.setKind(kind);
	}
</script>

<div class="shape-palette" data-shape-palette>
	<fieldset class="kinds">
		<legend>Shape</legend>
		{#each SHAPE_KINDS as option (option.id)}
			<label class="kind-option">
				<input
					type="radio"
					name="shape-kind"
					data-shape-kind={option.id}
					checked={snapshot.kind === option.id}
					onchange={() => setKind(option.id)}
				/>{option.label}
			</label>
		{/each}
		<span class="quiet">{readingSummary}</span>
	</fieldset>

	<fieldset class="plane">
		<legend>Sheet</legend>
		<label class="plane-option">
			<input
				type="radio"
				name="shape-plane"
				data-shape-plane-plan
				checked={snapshot.plane === 'plan'}
				onchange={() => surface()?.controller.setPlane('plan')}
			/>On the floor
		</label>
		<label class="plane-option">
			<input
				type="radio"
				name="shape-plane"
				data-shape-plane-elevation
				checked={snapshot.plane === 'elevation'}
				onchange={() => surface()?.controller.setPlane('elevation')}
			/>On an upright sheet
		</label>
		{#if snapshot.plane === 'elevation'}
			<div class="sheet-fields">
				<label>
					<span>X (m)</span>
					<input type="text" inputmode="decimal" data-shape-x bind:value={sheetX} />
				</label>
				<label>
					<span>Z (m)</span>
					<input type="text" inputmode="decimal" data-shape-z bind:value={sheetZ} />
				</label>
				<label>
					<span>Yaw (°)</span>
					<input type="text" inputmode="decimal" data-shape-yaw bind:value={sheetYaw} />
				</label>
				<button type="button" data-shape-sheet-apply onclick={commitSheet}>Align sheet</button>
			</div>
			{#if sheetError !== null}<p class="error" role="alert">{sheetError}</p>{/if}
		{/if}
	</fieldset>

	<dl class="live">
		<div><dt>Points</dt><dd>{snapshot.points}</dd></div>
		<div><dt>Outline</dt><dd>{snapshot.outlineSize ?? '—'}</dd></div>
		<div><dt>Phase</dt><dd>{snapshot.phase === 'outline' ? 'Outline' : 'Depth'}</dd></div>
	</dl>

	{#if snapshot.phase === 'outline'}
		<div class="actions">
			<button
				type="button"
				data-shape-finish
				disabled={!snapshot.canFinish}
				onclick={() => surface()?.controller.finish()}
			>
				Close outline (Enter)
			</button>
			<button
				type="button"
				data-shape-backtrack
				disabled={snapshot.points === 0}
				onclick={() => surface()?.controller.backtrack()}
			>
				Backtrack (Backspace)
			</button>
			<button type="button" data-shape-clear onclick={() => surface()?.controller.clear()}>
				Clear
			</button>
		</div>
		<p class="quiet">{activeSummary}</p>
	{:else}
		<div class="depth-row">
			<label>
				<span>Depth (m)</span>
				<input
					type="text"
					inputmode="decimal"
					data-shape-depth
					bind:value={depthText}
					onchange={commitDepth}
				/>
			</label>
			{#if snapshot.plane === 'elevation'}
				<button
					type="button"
					data-shape-flip
					aria-pressed={snapshot.flip}
					onclick={() => surface()?.controller.flip()}
				>
					Flip side
				</button>
			{/if}
			<button
				type="button"
				data-shape-back
				onclick={() => surface()?.controller.backtrack()}
			>
				Back to outline
			</button>
		</div>
		{#if depthError !== null}<p class="error" role="alert">{depthError}</p>{/if}
		<div class="actions">
			<button
				type="button"
				class="create"
				data-shape-create
				disabled={!snapshot.canCreate}
				onclick={() => surface()?.controller.create()}
			>
				Create (Enter)
			</button>
		</div>
		<p class="quiet">{activeSummary}</p>
	{/if}

	{#if snapshot.refusal !== null}
		<p class="refusal" role="alert" data-shape-refusal>{snapshot.refusal}</p>
	{/if}
</div>

<style>
	.shape-palette {
		display: grid;
		gap: 0.45rem;
		min-width: min(26rem, 80vw);
		font-size: 0.78rem;
	}
	fieldset {
		display: grid;
		gap: 0.2rem;
		margin: 0;
		padding: 0.2rem 0.45rem 0.35rem;
		border: 1px solid #4d4655;
		border-radius: 0.35rem;
	}
	legend {
		padding: 0 0.25rem;
		color: #c9a9ff;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.kind-option,
	.plane-option {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.sheet-fields {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 0.5rem;
	}
	.sheet-fields label {
		display: grid;
		gap: 0.15rem;
	}
	label span {
		color: #8f8a99;
		font-size: 0.68rem;
	}
	input {
		min-height: 1.9rem;
		width: 5.5rem;
		padding: 0.1rem 0.35rem;
		border: 1px solid #635a6f;
		border-radius: 0.3rem;
		background: #241f2b;
		color: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.live {
		display: grid;
		gap: 0.15rem;
		margin: 0;
	}
	.live div {
		display: flex;
		justify-content: space-between;
		gap: 0.6rem;
	}
	.live dt {
		color: #8f8a99;
	}
	.live dd {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.depth-row,
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.depth-row label {
		display: grid;
		gap: 0.15rem;
	}
	button {
		min-height: 2.25rem;
		padding: 0.15rem 0.55rem;
		border: 1px solid #635a6f;
		border-radius: 0.35rem;
		background: #292632;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	button.create {
		border-color: #7f6ab0;
		background: #3b3150;
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid #2f8cff;
		outline-offset: 1px;
	}
	.quiet {
		color: #8f8a99;
		font-size: 0.68rem;
	}
	.refusal {
		margin: 0;
		padding: 0.3rem 0.4rem;
		border: 1px solid #a4583c;
		border-radius: 0.3rem;
		background: #3a2018;
		color: #f3d9cd;
	}
	.error {
		margin: 0;
		color: #f0a98c;
	}
</style>
