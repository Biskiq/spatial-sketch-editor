<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { artworkHeight, type SceneArtworkEntity } from '@portfolio/project-model';
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
	.artwork-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; }
	label { display: grid; gap: 0.15rem; min-width: 0; color: var(--shell-ink-2); font-size: 10.5px; }
	input {
		width: 100%; min-width: 0; box-sizing: border-box; height: 26px; padding: 0 6px;
		border: 1px solid var(--shell-field-line); border-radius: 6px;
		background: var(--shell-field); color: var(--shell-ink); font: 12px var(--shell-mono);
	}
	input:focus { border-color: var(--shell-leaf); background: var(--shell-field-focus); }
	span { grid-column: 1 / -1; }
</style>
