<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import {
		ARTWORK_FRAME_COLORS, ARTWORK_FRAME_OPTIONS, ARTWORK_MAT_METERS,
		artworkFrameColorLabel, artworkFrameLayout, artworkFrameStyleLabel,
		artworkHeight, type ArtworkFrame, type ArtworkFrameStyle, type SceneArtworkEntity
	} from '@portfolio/project-model';
	import { ARTWORK_TRANSFORM } from '@portfolio/project-model/scene-planning';
	import { stageScene, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import type { StageCardActionRecord } from '$lib/authoring/stage/stage-facade';
	import { artworkCommand } from './artwork-command';

	let { services, secondary, actions = [], onAction }: {
		services: StageAdapterServices;
		secondary?: Snippet<[Snippet?]>;
		/** The subject's scoped actions, so Light it and Replace image sit in the foot. */
		actions?: readonly StageCardActionRecord[];
		onAction?: (action: StageCardActionRecord) => void;
	} = $props();
	let entity = $state.raw<SceneArtworkEntity | null>(null);
	let error = $state<{ field: string; message: string } | null>(null);
	let busy = $state(false);
	let advancedOpen = $state(false);
	let openGroup = $state<'position' | 'rotation' | null>('position');

	type FieldId =
		| 'width' | 'height' | 'hang'
		| 'x' | 'elevation' | 'z'
		| 'tilt' | 'turn' | 'roll';
	const POSITION_FIELDS = [
		{ id: 'x', label: 'X', unit: 'm' },
		{ id: 'elevation', label: 'Height', unit: 'm' },
		{ id: 'z', label: 'Z', unit: 'm' }
	] as const;
	const ROTATION_FIELDS = [
		{ id: 'tilt', label: 'Tilt', unit: '°' },
		{ id: 'turn', label: 'Turn', unit: '°' },
		{ id: 'roll', label: 'Roll', unit: '°' }
	] as const;

	const frameStyle = $derived<ArtworkFrameStyle>(entity?.frame?.style ?? 'none');
	const mat = $derived(entity?.frame?.mat ?? false);
	const frameColor = $derived(entity?.frame?.color ?? 'black');
	const lightIt = $derived(actions.find((action) => action.id === 'light-it') ?? null);
	const replaceAction = $derived(actions.find((action) => action.id === 'artwork-replace') ?? null);
	const duplicateAction = $derived(actions.find((action) => action.id === 'artwork-duplicate') ?? null);
	const deleteAction = $derived(actions.find((action) => action.id === 'artwork-delete') ?? null);
	const datum = $derived(services.stage.snapshot().domain.datumMeters);
	const framed = $derived.by(() => {
		if (entity === null) return null;
		return artworkFrameLayout(
			entity.widthMeters,
			artworkHeight(entity.widthMeters, entity.source),
			entity.frame
		);
	});
	function reconcile() {
		const id = services.stage.selectionState().primary?.subject.id;
		const current = stageScene(services.stage.snapshot()).entities.find((candidate) => candidate.id === id);
		if (current?.id !== entity?.id) {
			error = null;
			advancedOpen = false;
			openGroup = 'position';
		}
		entity = current?.kind === 'artwork' ? current : null;
	}
	onMount(() => {
		reconcile();
		return services.stage.onAdaptersChanged(reconcile);
	});
	function reading(field: FieldId, item: SceneArtworkEntity): string {
		const value = field === 'width' ? item.widthMeters * 100
			: field === 'height' ? artworkHeight(item.widthMeters, item.source) * 100
			: field === 'hang' ? (item.position[1] - datum) * 100
			: field === 'elevation' ? item.position[1] - datum
			: field === 'x' ? item.position[0]
			: field === 'z' ? item.position[2]
			: field === 'tilt' ? item.rotation[0] * 180 / Math.PI
			: field === 'turn' ? item.rotation[1] * 180 / Math.PI
			: item.rotation[2] * 180 / Math.PI;
		return String(Number(value.toFixed(4)));
	}
	function framedReading(item: SceneArtworkEntity): string {
		const layout = artworkFrameLayout(
			item.widthMeters,
			artworkHeight(item.widthMeters, item.source),
			item.frame
		);
		const size = `${(layout.outerWidth * 100).toFixed(1)} × ${(layout.outerHeight * 100).toFixed(1)} cm`;
		return layout.depth > 0 ? `${size} · ${(layout.depth * 100).toFixed(1)} cm deep` : size;
	}
	function frameSummary(item: SceneArtworkEntity): string {
		const style = item.frame?.style ?? 'none';
		const hasMat = item.frame?.mat ?? false;
		if (style === 'none') return hasMat ? 'No frame · Mat 6 cm' : 'No frame';
		return `${artworkFrameStyleLabel(style)} · ${artworkFrameColorLabel(item.frame?.color ?? 'black')}${hasMat ? ' · Mat 6 cm' : ''}`;
	}
	async function commitFrame(next: ArtworkFrame | null) {
		const current = entity;
		if (current === null || busy) return;
		busy = true;
		error = null;
		try {
			const result = await artworkCommand(services, ARTWORK_TRANSFORM, { frame: next }, { target: current.id });
			if (entity?.id === current.id && result.kind === 'refused') {
				error = { field: 'frame', message: result.message };
			}
		} finally { busy = false; }
	}
	function setStyle(style: ArtworkFrameStyle) {
		const current = entity;
		if (current === null) return;
		const nextMat = current.frame?.mat ?? false;
		const color = current.frame?.color ?? 'black';
		if (style === 'none' && !nextMat) void commitFrame(null);
		else void commitFrame({ style, mat: nextMat, color });
	}
	function setMat(nextMat: boolean) {
		const current = entity;
		if (current === null) return;
		const style = current.frame?.style ?? 'none';
		const color = current.frame?.color ?? 'black';
		if (style === 'none' && !nextMat) void commitFrame(null);
		else void commitFrame({ style, mat: nextMat, color });
	}
	function setColor(color: ArtworkFrame['color']) {
		const current = entity;
		if (current === null || current.frame === undefined || current.frame.style === 'none') return;
		void commitFrame({ style: current.frame.style, mat: current.frame.mat, color });
	}
	function payloadFor(field: FieldId, value: number, current: SceneArtworkEntity): Parameters<typeof artworkCommand>[2] {
		if (field === 'width') return { widthMeters: value / 100 };
		if (field === 'height') {
			return { widthMeters: value / 100 * current.source.pixelWidth / current.source.pixelHeight };
		}
		if (field === 'hang' || field === 'x' || field === 'elevation' || field === 'z') {
			const position: [number, number, number] = [...current.position];
			if (field === 'hang' || field === 'elevation') {
				position[1] = datum + value / (field === 'hang' ? 100 : 1);
			} else {
				position[field === 'x' ? 0 : 2] = value;
			}
			return { position };
		}
		const rotation: [number, number, number] = [...current.rotation];
		rotation[field === 'tilt' ? 0 : field === 'turn' ? 1 : 2] = value * Math.PI / 180;
		return { rotation };
	}
	async function commit(event: KeyboardEvent, field: FieldId) {
		const input = event.currentTarget as HTMLInputElement;
		const current = entity;
		if (current === null) return;
		if (event.key === 'Escape' && input.value !== reading(field, current)) {
			event.stopPropagation();
			input.value = reading(field, current);
			error = null;
			return;
		}
		if (event.key !== 'Enter' || busy) return;
		event.preventDefault();
		event.stopPropagation();
		if (input.value === reading(field, current)) return;
		const value = Number(input.value);
		if (!input.value.trim() || !Number.isFinite(value)) {
			error = { field, message: 'Enter a finite measurement.' };
			return;
		}
		busy = true;
		try {
			const result = await artworkCommand(services, ARTWORK_TRANSFORM,
				payloadFor(field, value, current), { target: current.id });
			if (entity?.id === current.id) error = result.kind === 'refused' ? { field, message: result.message } : null;
		} finally { busy = false; }
	}
	function run(action: StageCardActionRecord | null) {
		if (action !== null) onAction?.(action);
	}
</script>

{#if entity !== null}
	<div class="artwork-card">
		<section class="group" aria-labelledby="artwork-size">
			<h3 id="artwork-size">Size</h3>
			<div class="size-row">
				<label>Width
					<span class="field"><input type="text" inputmode="decimal" data-field="width" value={reading('width', entity)}
						onkeydown={(event) => void commit(event, 'width')} aria-invalid={error?.field === 'width'} /><em>cm</em></span>
				</label>
				<span class="lock" title="Aspect locked" aria-label="Aspect locked">🔒</span>
				<label>Height
					<span class="field"><input type="text" inputmode="decimal" data-field="height" value={reading('height', entity)}
						onkeydown={(event) => void commit(event, 'height')} aria-invalid={error?.field === 'height'} /><em>cm</em></span>
				</label>
			</div>
			{#if error?.field === 'width' || error?.field === 'height'}<span class="error" role="alert">{error.message}</span>{/if}
			<p class="reading" data-artwork-framed>Framed {framedReading(entity)}</p>
		</section>

		<section class="group" aria-labelledby="artwork-hang">
			<h3 id="artwork-hang">Hang</h3>
			<label class="inline">Centre
				<span class="field"><input type="text" inputmode="decimal" data-field="hang" value={reading('hang', entity)}
					onkeydown={(event) => void commit(event, 'hang')} aria-invalid={error?.field === 'hang'} /><em>cm above floor</em></span>
			</label>
			{#if error?.field === 'hang'}<span class="error" role="alert">{error.message}</span>{/if}
		</section>

		<section class="group frame" aria-labelledby="artwork-frame">
			<h3 id="artwork-frame">Frame</h3>
			<div class="tiles" role="group" aria-label="Frame style">
				{#each ARTWORK_FRAME_OPTIONS as option (option.style)}
					<button type="button" class="tile" class:selected={frameStyle === option.style}
						aria-pressed={frameStyle === option.style} disabled={busy}
						data-frame-style={option.style} onclick={() => void setStyle(option.style)}>
						<span class="thumb {option.style}" aria-hidden="true"></span>
						{option.label}
					</button>
				{/each}
			</div>
			<div class="colours" role="group" aria-label="Frame colour">
				{#each ARTWORK_FRAME_COLORS as colour (colour.id)}
					<button type="button" class="chip" class:selected={frameColor === colour.id}
						style:--swatch={colour.hex} aria-label={colour.label} title={colour.label}
						aria-pressed={frameColor === colour.id} disabled={busy || frameStyle === 'none'}
						data-frame-color={colour.id} onclick={() => void setColor(colour.id)}>
						<i aria-hidden="true"></i>{colour.label}
					</button>
				{/each}
			</div>
			<label class="mat"><input type="checkbox" checked={mat} disabled={busy}
				onchange={(event) => void setMat(event.currentTarget.checked)} /> Mat, {(ARTWORK_MAT_METERS * 100).toFixed(0)} cm</label>
			<p class="reading" data-artwork-frame-summary>{frameSummary(entity)}</p>
			{#if error?.field === 'frame'}<span class="error" role="alert">{error.message}</span>{/if}
		</section>

		<div class="foot">
			{#if lightIt !== null}<button type="button" class="primary" data-card-foot="light-it" onclick={() => run(lightIt)}>Light it</button>{/if}
			{#if replaceAction !== null}<button type="button" data-card-foot="replace" onclick={() => run(replaceAction)}>Replace image</button>{/if}
			<button type="button" class="advanced" aria-expanded={advancedOpen} data-card-foot="advanced"
				onclick={() => (advancedOpen = !advancedOpen)}>Advanced <span class="chev" class:open={advancedOpen} aria-hidden="true">⌄</span></button>
		</div>

		{#if advancedOpen}
			<section class="advanced" data-artwork-advanced>
				<button type="button" class="group-head" aria-expanded={openGroup === 'position'} 						data-artwork-group="position"
					onclick={() => (openGroup = openGroup === 'position' ? null : 'position')}>Position</button>
				{#if openGroup === 'position'}
					<div class="grid">
						{#each POSITION_FIELDS as field (field.id)}
							<label>{field.label} ({field.unit})
								<input type="text" inputmode="decimal" data-field={field.id} value={reading(field.id, entity)}
									onkeydown={(event) => void commit(event, field.id)} aria-invalid={error?.field === field.id} />
							</label>
							{#if error?.field === field.id}<span class="error" role="alert">{error.message}</span>{/if}
						{/each}
					</div>
				{/if}
				<button type="button" class="group-head" aria-expanded={openGroup === 'rotation'} 						data-artwork-group="rotation"
					onclick={() => (openGroup = openGroup === 'rotation' ? null : 'rotation')}>Rotation</button>
				{#if openGroup === 'rotation'}
					<div class="grid">
						{#each ROTATION_FIELDS as field (field.id)}
							<label>{field.label} ({field.unit})
								<input type="text" inputmode="decimal" data-field={field.id} value={reading(field.id, entity)}
									onkeydown={(event) => void commit(event, field.id)} aria-invalid={error?.field === field.id} />
							</label>
							{#if error?.field === field.id}<span class="error" role="alert">{error.message}</span>{/if}
						{/each}
					</div>
				{/if}
				<div class="advanced-actions">
					{#if duplicateAction !== null}<button type="button" data-card-action="artwork-duplicate" onclick={() => run(duplicateAction)}>Duplicate</button>{/if}
					{#if deleteAction !== null}<button type="button" class="danger" data-card-action="artwork-delete" onclick={() => run(deleteAction)}>Delete</button>{/if}
				</div>
			</section>
		{/if}
	</div>
{/if}
{@render secondary?.()}
<style>
	.artwork-card { display: grid; gap: 0.65rem; padding: 0 12px 10px; }
	.group { display: grid; gap: 0.35rem; }
	h3 {
		margin: 0; color: var(--shell-ink-2);
		font: 600 10px/1.2 var(--shell-sans); letter-spacing: 0.06em; text-transform: uppercase;
	}
	.size-row { display: flex; align-items: end; gap: 8px; }
	label { display: grid; gap: 3px; min-width: 0; color: var(--shell-ink-2); font-size: 10.5px; }
	.field { display: flex; align-items: center; gap: 4px; min-width: 0; }
	input[type='text'] {
		width: 100%; min-width: 0; box-sizing: border-box; height: 27px; padding: 0 6px;
		border: 1px solid var(--shell-field-line); border-radius: 6px;
		background: var(--shell-field); color: var(--shell-ink); font: 12px var(--shell-mono);
	}
	input[type='text']:focus { border-color: var(--shell-leaf); background: var(--shell-field-focus); }
	input[aria-invalid='true'] { border-color: var(--shell-refuse); }
	em { flex: none; color: var(--shell-ink-2); font: 10px var(--shell-mono); font-style: normal; }
	.lock { flex: none; padding-bottom: 6px; font-size: 12px; opacity: 0.75; }
	.inline { display: flex; align-items: center; gap: 6px; }
	.inline .field { flex: 1; }
	.reading { margin: 0; color: var(--shell-ink-2); font: 10px var(--shell-mono); }
	.error { color: var(--shell-caution); font-size: 10px; }
	.tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
	.tile {
		display: grid; justify-items: center; gap: 3px; padding: 4px 2px;
		border: 1px solid var(--shell-field-line); border-radius: 7px;
		background: var(--shell-field); color: var(--shell-ink); font: 10px var(--shell-sans); cursor: pointer;
	}
	.tile.selected, .chip.selected { border-color: var(--shell-ink); box-shadow: inset 0 0 0 1px var(--shell-ink); }
	.tile:disabled, .chip:disabled { opacity: 0.4; cursor: default; }
	.thumb { width: 34px; height: 24px; box-sizing: border-box; border: 1px solid #29241433; background: #17382d; }
	.thumb.thin { box-shadow: inset 0 0 0 2px #1b1b1b; }
	.thumb.gallery { box-shadow: inset 0 0 0 4px #1b1b1b; }
	.thumb.float { box-shadow: inset 0 0 0 1.5px #1b1b1b; background: #2a2420; }
	.colours { display: flex; flex-wrap: wrap; gap: 4px; }
	.chip {
		display: inline-flex; align-items: center; gap: 5px; min-height: 24px; padding: 0 7px;
		border: 1px solid var(--shell-field-line); border-radius: 999px;
		background: var(--shell-field); color: var(--shell-ink); font: 11px var(--shell-sans); cursor: pointer;
	}
	.chip i { width: 12px; height: 12px; border-radius: 50%; background: var(--swatch); outline: 1px solid #29241433; }
	.mat { display: flex; align-items: center; gap: 6px; color: var(--shell-ink); font-size: 11px; }
	.mat input { accent-color: var(--shell-leaf); }
	.foot {
		display: flex; align-items: center; justify-content: space-between; gap: 4px;
		padding-top: 6px; border-top: 1px solid var(--shell-hairline);
	}
	.foot button {
		min-height: 25px; padding: 0 7px; border: 0; border-radius: 6px;
		background: transparent; color: var(--shell-ink); font: 11px var(--shell-sans); cursor: pointer;
	}
	.foot button:hover { background: var(--shell-hover); }
	.foot .primary { color: var(--shell-ink); font-weight: 650; }
	.foot .advanced { color: var(--shell-ink-2); }
	.chev { display: inline-block; transition: transform 120ms; }
	.chev.open { transform: rotate(180deg); }
	.advanced { display: grid; gap: 5px; padding-top: 4px; border-top: 1px solid var(--shell-hairline); }
	.group-head {
		justify-self: stretch; min-height: 24px; padding: 0 4px; border: 0; border-radius: 5px;
		background: transparent; color: var(--shell-ink-2); text-align: left;
		font: 600 10px var(--shell-sans); letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer;
	}
	.group-head:hover { background: var(--shell-hover); }
	.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
	.advanced-actions { display: flex; gap: 6px; padding-top: 4px; border-top: 1px solid var(--shell-hairline); }
	.advanced-actions button {
		min-height: 24px; padding: 0 8px; border: 1px solid var(--shell-field-line); border-radius: 6px;
		background: var(--shell-field); color: var(--shell-ink); font: 11px var(--shell-sans); cursor: pointer;
	}
	.advanced-actions .danger { color: var(--shell-refuse); }
</style>
