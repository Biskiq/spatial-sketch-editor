<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import {
		ARTWORK_FRAME_COLORS, ARTWORK_FRAME_OPTIONS, ARTWORK_MAT_METERS,
		artworkFrameColorLabel, artworkFrameLayout, artworkFrameStyleLabel,
		artworkHeight, type ArtworkFrame, type ArtworkFrameStyle, type SceneArtworkEntity
	} from '@portfolio/project-model';
	import { ARTWORK_TRANSFORM } from '@portfolio/project-model/scene-planning';
	import { stageScene, type StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { artworkCommand } from './artwork-command';
	let { services, footer, secondary, more }: {
		services: StageAdapterServices; detailOpen?: boolean;
		footer?: Snippet; secondary?: Snippet<[Snippet?]>; more?: Snippet<[Snippet?]>;
	} = $props();
	let entity = $state.raw<SceneArtworkEntity | null>(null);
	let error = $state<{ field: string; message: string } | null>(null);
	let busy = $state(false);
	const fields = [
		{ id: 'width', label: 'Width', unit: 'cm' }, { id: 'height', label: 'Height', unit: 'cm' },
		{ id: 'x', label: 'X', unit: 'm', axis: 0 }, { id: 'y', label: 'Y', unit: 'm', axis: 1 },
		{ id: 'z', label: 'Z', unit: 'm', axis: 2 }, { id: 'pitch', label: 'Pitch', unit: '°', axis: 0 },
		{ id: 'yaw', label: 'Yaw', unit: '°', axis: 1 }, { id: 'roll', label: 'Roll', unit: '°', axis: 2 }
	] as const;
	type Field = typeof fields[number];
	const frameStyle = $derived<ArtworkFrameStyle>(entity?.frame?.style ?? 'none');
	const mat = $derived(entity?.frame?.mat ?? false);
	const frameColor = $derived(entity?.frame?.color ?? 'black');
	function reconcile() {
		const id = services.stage.selectionState().primary?.subject.id;
		const current = stageScene(services.stage.snapshot()).entities.find((candidate) => candidate.id === id);
		if (current?.id !== entity?.id) error = null;
		entity = current?.kind === 'artwork' ? current : null;
	}
	onMount(() => {
		reconcile();
		return services.stage.onAdaptersChanged(reconcile);
	});
	function reading(field: Field, item: SceneArtworkEntity): string {
		const value = field.id === 'width' ? item.widthMeters * 100
			: field.id === 'height' ? artworkHeight(item.widthMeters, item.source) * 100
			: field.unit === 'm' ? item.position[field.axis] : item.rotation[field.axis] * 180 / Math.PI;
		return String(Number(value.toFixed(4)));
	}
	function frameReading(item: SceneArtworkEntity): string {
		const generated = artworkFrameLayout(item.widthMeters, artworkHeight(item.widthMeters, item.source), item.frame);
		const size = `${(generated.outerWidth * 100).toFixed(1)} × ${(generated.outerHeight * 100).toFixed(1)} cm`;
		const frame = item.frame;
		if (frame === undefined) return `No frame · ${size}`;
		const parts = [artworkFrameStyleLabel(frame.style)];
		if (generated.faceMeters > 0) parts.push(`${(generated.faceMeters * 100).toFixed(1)} cm face`);
		if (frame.mat) parts.push(`Mat ${(ARTWORK_MAT_METERS * 100).toFixed(1)} cm`);
		if (frame.style !== 'none') parts.push(artworkFrameColorLabel(frame.color));
		parts.push(`overall ${size}${generated.depth > 0 ? ` × ${(generated.depth * 100).toFixed(1)} cm deep` : ''}`);
		return parts.join(' · ');
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
	async function commit(event: KeyboardEvent, field: Field) {
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
			error = { field: field.id, message: 'Enter a finite measurement.' };
			return;
		}
		let payload: Parameters<typeof artworkCommand>[2];
		if (field.id === 'width') payload = { widthMeters: value / 100 };
		else if (field.id === 'height') payload = { widthMeters: value / 100 * current.source.pixelWidth / current.source.pixelHeight };
		else {
			const key = field.unit === 'm' ? 'position' : 'rotation';
			const vector = [...current[key]];
			vector[field.axis] = key === 'position' ? value : value * Math.PI / 180;
			payload = { [key]: vector };
		}
		busy = true;
		try {
			const result = await artworkCommand(services, ARTWORK_TRANSFORM, payload, { target: current.id });
			if (entity?.id === current.id) error = result.kind === 'refused' ? { field: field.id, message: result.message } : null;
		} finally { busy = false; }
	}
</script>

{#if entity !== null}
	<div class="artwork-frame">
		<div class="frame-head">
			<span>Frame</span>
			<button type="button" class="mat" class:selected={mat} aria-pressed={mat}
				disabled={busy} onclick={() => void setMat(!mat)}>Mat</button>
		</div>
		<div class="frame-row" role="group" aria-label="Frame style">
			{#each ARTWORK_FRAME_OPTIONS as option (option.style)}
				<button type="button" class:selected={frameStyle === option.style}
					aria-pressed={frameStyle === option.style} disabled={busy}
					onclick={() => void setStyle(option.style)}>{option.label}</button>
			{/each}
		</div>
		{#if frameStyle !== 'none'}
			<div class="frame-row colours" role="group" aria-label="Frame colour">
				{#each ARTWORK_FRAME_COLORS as colour (colour.id)}
					<button type="button" class="swatch" class:selected={frameColor === colour.id}
						style:background={colour.hex} aria-label={colour.label} title={colour.label}
						aria-pressed={frameColor === colour.id} disabled={busy}
						onclick={() => void setColor(colour.id)}></button>
				{/each}
			</div>
		{/if}
		<p class="frame-reading">{frameReading(entity)}</p>
		{#if error?.field === 'frame'}<span class="frame-error" role="alert">{error.message}</span>{/if}
	</div>
	{#key entity}
		<div class="artwork-fields">
			{#each fields as field (field.id)}
				<label>
					{field.label} ({field.unit})
					<input type="text" inputmode="decimal" value={reading(field, entity)}
						onkeydown={(event) => void commit(event, field)} aria-invalid={error?.field === field.id} />
				</label>
				{#if error?.field === field.id}<span role="alert">{error.message}</span>{/if}
			{/each}
		</div>
	{/key}
{/if}
{@render footer?.()}
{@render secondary?.()}
{@render more?.()}
<style>
	.artwork-frame { display: grid; gap: 0.35rem; margin-bottom: 0.55rem; }
	.frame-head { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; color: var(--shell-ink-2); font-size: 10.5px; }
	.frame-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
	.frame-row button, .mat {
		height: 24px; padding: 0 7px; border: 1px solid var(--shell-field-line);
		border-radius: 6px; background: var(--shell-field); color: var(--shell-ink);
		font: 11px var(--shell-mono); cursor: pointer;
	}
	.frame-row button.selected, .mat.selected {
		border-color: var(--shell-ink); box-shadow: inset 0 0 0 1px var(--shell-ink);
	}
	.frame-row button:disabled, .mat:disabled { opacity: 0.45; cursor: default; }
	.frame-row .swatch { width: 18px; height: 18px; padding: 0; border-radius: 50%; }
	.frame-row .swatch.selected { outline: 2px solid var(--shell-ink); outline-offset: 1px; }
	.frame-reading { margin: 0; color: var(--shell-ink-2); font: 10px var(--shell-mono); }
	.frame-error { color: var(--shell-caution); font-size: 10px; }
	.artwork-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; }
	label { display: grid; gap: 0.15rem; min-width: 0; color: var(--shell-ink-2); font-size: 10.5px; }
	input {
		width: 100%; min-width: 0; box-sizing: border-box; height: 26px; padding: 0 6px;
		border: 1px solid var(--shell-field-line); border-radius: 6px;
		background: var(--shell-field); color: var(--shell-ink); font: 12px var(--shell-mono);
	}
	input:focus { border-color: var(--shell-leaf); background: var(--shell-field-focus); }
	.artwork-fields span { grid-column: 1 / -1; }
</style>
