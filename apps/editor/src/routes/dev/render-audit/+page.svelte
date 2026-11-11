<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AUDIT_SIZE,
		buildGateAResult,
		capturePipeline,
		createAuditRenderer,
		createReferenceCanvas,
		runFidelity,
		runLightUnits,
		type FidelityFrame,
		type GateAResult
	} from './audit';

	type Tile = { readonly key: string; readonly label: string; readonly canvas: HTMLCanvasElement };
	type AuditWindow = Window & {
		__GATE_A__?: GateAResult;
		__GATE_A_READY__?: Promise<GateAResult>;
	};

	let canvas: HTMLCanvasElement;
	let sourcePreview: HTMLCanvasElement;
	let outputPreview: HTMLCanvasElement;
	let sheet: HTMLCanvasElement;
	let result = $state<GateAResult | null>(null);
	let status = $state('Starting the audit…');
	let error = $state<string | null>(null);
	let sheetReady = $state(false);

	function drawSourcePreview(source: HTMLCanvasElement): void {
		sourcePreview.width = source.width;
		sourcePreview.height = source.height;
		sourcePreview.getContext('2d')?.drawImage(source, 0, 0);
	}

	function drawTile(
		context: CanvasRenderingContext2D,
		image: CanvasImageSource,
		index: number,
		label: string
	): void {
		const columns = 4;
		const tile = 256;
		const header = 92;
		const column = index % columns;
		const row = Math.floor(index / columns);
		const x = column * tile;
		const y = header + row * tile;
		context.fillStyle = '#18181f';
		context.fillRect(x, y, tile, tile);
		context.drawImage(image, x, y + 22, tile, tile - 22);
		context.fillStyle = '#f4efe4';
		context.font = '600 11px ui-sans-serif, system-ui, sans-serif';
		context.fillText(label, x + 7, y + 15);
		context.strokeStyle = 'rgb(255 255 255 / 18%)';
		context.strokeRect(x + 0.5, y + 0.5, tile - 1, tile - 1);
	}

	function drawContactSheet(source: HTMLCanvasElement, tiles: readonly Tile[]): void {
		const columns = 4;
		const tile = 256;
		const header = 92;
		const rows = Math.ceil((tiles.length + 1) / columns);
		sheet.width = columns * tile;
		sheet.height = header + rows * tile;
		const context = sheet.getContext('2d');
		if (context === null) return;
		context.fillStyle = '#101014';
		context.fillRect(0, 0, sheet.width, sheet.height);
		context.drawImage(source, 8, 8, 72, 72);
		context.fillStyle = '#f4efe4';
		context.font = '700 17px ui-sans-serif, system-ui, sans-serif';
		context.fillText('S0 Gate A — tone mapping and artwork fidelity', 92, 30);
		context.fillStyle = 'rgb(244 239 228 / 70%)';
		context.font = '500 12px ui-sans-serif, system-ui, sans-serif';
		context.fillText('Source sRGB chart at left · each tile is a default-framebuffer readback', 92, 50);
		drawTile(context, source, 0, 'Source sRGB chart');
		tiles.forEach((entry, index) => drawTile(context, entry.canvas, index + 1, entry.label));
		sheetReady = true;
	}

	function download(name: string, blob: Blob): void {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = name;
		link.click();
		URL.revokeObjectURL(url);
	}

	function downloadJson(): void {
		if (result === null) return;
		download('s0-gate-a.json', new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
	}

	function downloadSheet(): void {
		sheet.toBlob((blob) => {
			if (blob !== null) download('s0-gate-a-contact-sheet.png', blob);
		}, 'image/png');
	}

	async function run(): Promise<GateAResult> {
		status = 'Rendering E1 pipeline capture…';
		const renderer = createAuditRenderer(canvas);
		try {
			const source = createReferenceCanvas();
			drawSourcePreview(source);
			const pipeline = capturePipeline(renderer);

			status = 'Rendering E2 tone-mapping variants…';
			const tiles: Tile[] = [];
			const fidelity = runFidelity(renderer, source, (frame: FidelityFrame) => {
				const tile = document.createElement('canvas');
				tile.width = 256;
				tile.height = 256;
				tile.getContext('2d')?.drawImage(frame.canvas, 0, 0, 256, 256);
				tiles.push({ key: frame.key, label: frame.label, canvas: tile });
			});
			const chosenTile = tiles.find((tile) => tile.key === fidelity.chosen.key);
			if (chosenTile !== undefined) {
				outputPreview.width = 512;
				outputPreview.height = 512;
				outputPreview.getContext('2d')?.drawImage(chosenTile.canvas, 0, 0, 512, 512);
			}

			status = 'Rendering E3 light units…';
			const lightUnits = runLightUnits(renderer, fidelity.chosen.toneMapping);
			status = 'Composing the contact sheet…';
			drawContactSheet(source, tiles);
			const next = buildGateAResult(pipeline, fidelity, lightUnits);
			(window as AuditWindow).__GATE_A__ = next;
			result = next;
			status = fidelity.calibration.passed
				? 'Complete. Readback calibration passed.'
				: 'Complete, but readback calibration FAILED.';
			return next;
		} finally {
			renderer.dispose();
		}
	}

	onMount(() => {
		const promise = run();
		(window as AuditWindow).__GATE_A_READY__ = promise;
		promise.catch((cause: unknown) => {
			error = cause instanceof Error ? cause.message : String(cause);
			status = 'Failed.';
		});
	});
</script>

<svelte:head>
	<title>S0 Gate A — Render audit</title>
</svelte:head>

<main class="page">
	<header>
		<p class="eyebrow">/dev/render-audit · T2 S0 Gate A</p>
		<h1>Pipeline truth, artwork fidelity and light units</h1>
		<p class="lede">
			Dev-only bench. It reads the <strong>default framebuffer</strong> immediately after
			<code>render()</code>, so the bytes are the displayed sRGB output. It never uses the snapshot
			target as evidence.
		</p>
		<p class="status" class:bad={error !== null}>{status}</p>
		{#if error !== null}<p class="error">{error}</p>{/if}
	</header>

	<section class="bench">
		<div>
			<h2>Source chart</h2>
			<canvas bind:this={sourcePreview} class="source"></canvas>
		</div>
		<div>
			<h2>Measured output</h2>
			<canvas bind:this={outputPreview} width={AUDIT_SIZE} height={AUDIT_SIZE} class="source"></canvas>
			<canvas bind:this={canvas} width={AUDIT_SIZE} height={AUDIT_SIZE} class="webgl"></canvas>
		</div>
	</section>
	<canvas bind:this={sheet} class="sheet" class:hidden={!sheetReady}></canvas>

	{#if result !== null}
		<section class="summary">
			<h2>E1 — pipeline capture</h2>
			<table>
				<tbody>
					<tr><th>Three</th><td>r{result.pipeline.threeRevision}</td></tr>
					<tr><th>Colour management</th><td>{result.pipeline.colorManagement.enabled ? 'enabled' : 'disabled'} · working {result.pipeline.colorManagement.workingColorSpace}</td></tr>
					<tr><th>Output colour space</th><td>{result.pipeline.renderer.outputColorSpace} · drawing buffer {result.pipeline.renderer.drawingBufferColorSpace}</td></tr>
					<tr><th>Tone mapping</th><td>{result.pipeline.renderer.toneMappingLabel} · exposure {result.pipeline.renderer.toneMappingExposure}</td></tr>
					<tr><th>Shadow map</th><td>{result.pipeline.renderer.shadowMapLabel}</td></tr>
					<tr><th>Stage snapshot target</th><td>{result.pipeline.target.width}×{result.pipeline.target.height} · texture colour space "{result.pipeline.target.textureColorSpace || 'NoColorSpace'}" · UnsignedByte</td></tr>
					<tr><th>Readback</th><td>{result.readback.method} · {result.readback.width}×{result.readback.height} · max channel error {result.readback.calibrationMaxChannelError}</td></tr>
				</tbody>
			</table>
			<p class="note">
				Calibration: <strong class:bad={!result.readback.calibrationPassed}>{result.readback.calibrationPassed ? 'passed' : 'FAILED'}</strong>.
				The snapshot target is recorded but not used: r187 renders non-XR targets in the linear working space.
			</p>

			<h2>E2 — tone mapping and artwork fidelity</h2>
			<table>
				<thead><tr><th>Variant</th><th>mean ΔE00</th><th>mid-tone mean</th><th>max ΔE00</th><th>clipping</th><th>ramp</th></tr></thead>
				<tbody>
					{#each result.fidelity.variants as variant (variant.key)}
						<tr class:chosen={variant.key === result.fidelity.chosen.key}>
							<td>{variant.label}</td>
							<td>{variant.summary.meanDeltaE00.toFixed(2)}</td>
							<td>{variant.summary.midToneMeanDeltaE00.toFixed(2)}</td>
							<td>{variant.summary.maxDeltaE00.toFixed(2)}</td>
							<td>{variant.summary.maxClippedPct.toFixed(2)}%</td>
							<td>{variant.greyRampMonotonic ? 'monotonic' : 'non-monotonic'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="note">Chosen by lowest mid-tone mean: <strong>{result.fidelity.chosen.label}</strong> (exposure {result.fidelity.chosen.exposure}).</p>

			<h2>E3 — light units</h2>
			<table>
				<thead><tr><th>Kind</th><th>Stop</th><th>Factor</th><th>Intensity</th><th>Linear luminance</th><th>Ratio</th></tr></thead>
				<tbody>
					{#each result.lightUnits.rows as row (`${row.kind}-${row.stop}`)}
						<tr><td>{row.kind}</td><td>{row.stop}</td><td>{row.factor}</td><td>{row.intensity.toFixed(3)}</td><td>{row.luminance.toFixed(5)}</td><td>{row.ratio.toFixed(3)}</td></tr>
					{/each}
				</tbody>
			</table>
			<p class="note">
				Spot {result.lightUnits.spot.angleDegrees.toFixed(0)}° at {result.lightUnits.spot.distance} m:
				expected radius {result.lightUnits.spot.expectedRadiusMeters.toFixed(3)} m,
				measured {result.lightUnits.spot.measuredRadiusMeters.toFixed(3)} m
				(error {result.lightUnits.spot.errorMeters.toFixed(3)} m).
				Range at 1 m: limited {result.lightUnits.range.limited.toFixed(4)}, unlimited {result.lightUnits.range.unlimited.toFixed(4)}.
			</p>
			{#if result.lightUnits.postToneMap !== null}
				<table>
					<thead><tr><th>{result.lightUnits.postToneMap.label} · stop</th><th>Factor</th><th>Ratio</th></tr></thead>
					<tbody>
						{#each result.lightUnits.postToneMap.rows as row (`post-${row.stop}`)}
							<tr><td>{row.stop}</td><td>{row.factor}</td><td>{row.ratio.toFixed(3)}</td></tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<h2>Contact sheet</h2>
			{#if sheetReady}
				<div class="actions">
					<button type="button" onclick={downloadJson}>Download JSON</button>
					<button type="button" onclick={downloadSheet}>Download contact sheet</button>
				</div>
			{/if}

			<details>
				<summary>Full machine-readable result</summary>
				<pre>{JSON.stringify(result, null, 2)}</pre>
			</details>
		</section>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
	}
	.page {
		min-height: 100vh;
		padding: 1.2rem 1.4rem 3rem;
		background: #0b0b10;
		color: #f4efe4;
		font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
	}
	.eyebrow {
		margin: 0;
		color: #d6b35f;
		font: 700 0.72rem/1.2 ui-sans-serif, system-ui, sans-serif;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0.35rem 0 0.5rem;
		font-size: 1.65rem;
	}
	h2 {
		margin: 1.2rem 0 0.55rem;
		font-size: 1rem;
		color: #d6b35f;
	}
	.lede,
	.note,
	p {
		max-width: 78ch;
		color: rgb(244 239 228 / 0.76);
		font-size: 0.88rem;
		line-height: 1.5;
	}
	code {
		color: #f4efe4;
	}
	.status {
		margin: 0.7rem 0 0;
		color: #9ed3bf;
		font-weight: 600;
	}
	.status.bad,
	.error,
	.bad {
		color: #e3a17a;
	}
	.bench {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 512px));
		gap: 1rem;
		margin-top: 1rem;
	}
	.source {
		display: block;
		width: 100%;
		max-width: 512px;
		border: 1px solid rgb(255 255 255 / 0.14);
		border-radius: 0.6rem;
		background: #101010;
	}
	.webgl {
		display: none;
	}
	.summary {
		max-width: 1120px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin: 0.4rem 0 0.6rem;
		font-size: 0.8rem;
	}
	th,
	td {
		padding: 0.35rem 0.45rem;
		border-bottom: 1px solid rgb(255 255 255 / 0.09);
		text-align: left;
		vertical-align: top;
	}
	th {
		color: rgb(244 239 228 / 0.62);
		font-weight: 500;
	}
	tr.chosen td {
		background: rgb(214 179 95 / 0.12);
		color: #f4efe4;
	}
	.note {
		margin: 0.3rem 0 0.8rem;
	}
	.sheet {
		display: block;
		width: 100%;
		max-width: 1024px;
		border: 1px solid rgb(255 255 255 / 0.14);
		border-radius: 0.6rem;
	}
	.sheet.hidden {
		display: none;
	}
	.actions {
		display: flex;
		gap: 0.6rem;
		margin: 0.7rem 0;
	}
	button {
		min-height: 2.4rem;
		padding: 0.5rem 0.85rem;
		border: 1px solid rgb(255 255 255 / 0.18);
		border-radius: 0.55rem;
		background: #202027;
		color: #f4efe4;
		cursor: pointer;
	}
	details {
		margin-top: 0.8rem;
	}
	summary {
		cursor: pointer;
		color: #d6b35f;
	}
	pre {
		max-height: 32rem;
		overflow: auto;
		padding: 0.8rem;
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 0.5rem;
		background: #14141a;
		font-size: 0.72rem;
	}
	@media (max-width: 900px) {
		.bench {
			grid-template-columns: 1fr;
		}
	}
</style>
