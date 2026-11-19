<script lang="ts">
	/**
	 * V1c — the **Region** Card writer.
	 *
	 * Kind, both elevation readouts, thickness, exact plan size and area, plus the
	 * derived **Relations** list. Every edit is one captured intent through the
	 * region planners; every relation row is a reading, never a stored link, and a
	 * gap row offers its one-shot fit and Mark intended.
	 */
	import { type Snippet } from 'svelte';
	import {
		mintLayoutIdCapture,
		regionWallRelations,
		type LayoutRegion,
		type LayoutVec2
	} from '@portfolio/layout-core';
	import { restingObjectsOnFloorRegion } from './region-resting';
	import {
		compactMeasure,
		indexLabels,
		stageLayout,
		type StageAdapterServices
	} from '$lib/authoring/stage/stage-adapter-host';
	import {
		LAYOUT_REGION_ELEVATION_KIND,
		LAYOUT_REGION_FIT_EDGE_KIND,
		LAYOUT_REGION_FIT_ROOF_KIND,
		LAYOUT_REGION_FIT_SPACE_KIND,
		LAYOUT_REGION_FIT_WALLS_KIND,
		LAYOUT_REGION_FOOTPRINT_KIND,
		LAYOUT_REGION_INTENDED_GAP_KIND,
		LAYOUT_REGION_THICKNESS_KIND,
		regionDuplicateIntent,
		regionEditIntent,
		regionIdFromCapture
	} from './region-planners';

	let {
		services,
		footer,
		secondary,
		more
	}: {
		services: StageAdapterServices;
		detailOpen?: boolean;
		footer?: Snippet;
		secondary?: Snippet<[Snippet?]>;
		more?: Snippet<[Snippet?]>;
	} = $props();

	let error = $state<string | null>(null);
	let busy = $state(false);
	const selectionKey = $derived.by(() => {
		const selection = services.stage.selection();
		return selection === null ? null : `${selection.sourceKind}:${selection.sourceId}`;
	});
	const regionId = $derived.by(() => {
		const selection = services.stage.selection();
		return selection?.sourceKind === 'region' ? selection.sourceId : null;
	});
	const snapshot = $derived.by(() => {
		void selectionKey;
		return services.stage.snapshot();
	});
	const layout = $derived(stageLayout(snapshot));
	const geometry = $derived(snapshot.domain.geometry);
	const region = $derived<LayoutRegion | null>(
		regionId === null ? null : (layout.regions.find((candidate) => candidate.id === regionId) ?? null)
	);
	const compiled = $derived(
		regionId === null
			? undefined
			: geometry.regions.find((candidate) => candidate.regionId === regionId)
	);
	const relations = $derived.by(() => {
		if (region === null) return null;
		const result = regionWallRelations(geometry, region);
		return result.kind === 'relations' ? result : null;
	});
	const wallLabels = $derived(
		indexLabels(
			layout.walls.map((wall) => ({ identity: wall.id, kind: 'Wall', name: wall.name ?? null }))
		)
	);
	const datum = $derived(snapshot.domain.datumMeters);
	const restingObjects = $derived(
		region === null ? 0 : restingObjectsOnFloorRegion(snapshot, region.id)
	);
	const bounds = $derived.by(() => {
		const points = region?.footprint.points ?? [];
		if (points.length === 0) return null;
		const xs = points.map(([x]) => x);
		const zs = points.map(([, z]) => z);
		return {
			minX: Math.min(...xs),
			maxX: Math.max(...xs),
			minZ: Math.min(...zs),
			maxZ: Math.max(...zs)
		};
	});
	const width = $derived(bounds === null ? 0 : bounds.maxX - bounds.minX);
	const depth = $derived(bounds === null ? 0 : bounds.maxZ - bounds.minZ);
	const area = $derived.by(() => {
		const points = region?.footprint.points ?? [];
		let twice = 0;
		for (let index = 0; index < points.length; index++) {
			const [x, z] = points[index]!;
			const [nx, nz] = points[(index + 1) % points.length]!;
			twice += x * nz - nx * z;
		}
		return Math.abs(twice) / 2;
	});
	const roleWords = $derived(region?.role === 'overhead' ? 'Flat Roof' : 'Terrace');
	const elevationWorld = $derived(
		region === null
			? ''
			: `${((region.role === 'overhead' ? compiled?.bottomY ?? datum + region.elevation : compiled?.topY ?? datum + region.elevation)).toFixed(3)} m`
	);

	/** One exact scalar edit: parse, then accept through the region planner. */
	async function commitNumber(field: 'elevation' | 'thickness', text: string): Promise<void> {
		if (region === null || busy) return;
		const trimmed = text.trim();
		const value = Number(trimmed);
		if (trimmed.length === 0 || !Number.isFinite(value)) {
			error = 'Enter a decimal number of meters.';
			return;
		}
		if (field === 'thickness' && !(value > 0)) {
			error = 'Thickness must be greater than zero.';
			return;
		}
		if (field === 'elevation') {
			if (region.role === 'floor' ? value < 0 : !(value > 0)) {
				error =
					region.role === 'floor'
						? 'A Terrace elevation cannot be negative.'
						: 'A Flat Roof underside must be above the floor datum.';
				return;
			}
			if (Math.abs(value - region.elevation) <= 1e-9) {
				error = 'The region already has that elevation.';
				return;
			}
		}
		if (field === 'thickness' && Math.abs(value - region.thickness) <= 1e-9) {
			error = 'The region already has that thickness.';
			return;
		}
		error = null;
		await accept(
			field === 'elevation' ? LAYOUT_REGION_ELEVATION_KIND : LAYOUT_REGION_THICKNESS_KIND,
			field === 'elevation' ? { elevation: value } : { thickness: value }
		);
	}

	/** Exact plan size scales the footprint about its bounding-box centre. */
	async function commitSize(axis: 'width' | 'depth', text: string): Promise<void> {
		if (region === null || bounds === null || busy) return;
		const trimmed = text.trim();
		const value = Number(trimmed);
		if (trimmed.length === 0 || !Number.isFinite(value) || !(value > 0)) {
			error = 'Enter a size greater than zero.';
			return;
		}
		const current = axis === 'width' ? width : depth;
		if (!(current > 0)) {
			error = 'This footprint has no extent on that axis.';
			return;
		}
		if (Math.abs(value - current) <= 1e-9) {
			error = 'The region already has that size.';
			return;
		}
		const centre: LayoutVec2 = [(bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2];
		const factor = value / current;
		const scaled: LayoutVec2[] = region.footprint.points.map(([x, z]) =>
			axis === 'width'
				? [centre[0] + (x - centre[0]) * factor, z]
				: [x, centre[1] + (z - centre[1]) * factor]
		);
		error = null;
		await accept(LAYOUT_REGION_FOOTPRINT_KIND, { points: scaled });
	}

	async function accept(
		kind: string,
		payload: Parameters<typeof regionEditIntent>[0]['payload']
	): Promise<void> {
		if (region === null || busy) return;
		busy = true;
		try {
			const fresh = services.stage.snapshot();
			const outcome = await services.authoring.accept(
				regionEditIntent({
					kind,
					regionId: region.id,
					payload,
					operationId: globalThis.crypto.randomUUID(),
					projectId: fresh.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision: fresh.domain.unitRevisions.layout,
					levelId: fresh.domain.layoutLevelId
				})
			);
			if (outcome.kind === 'refused') error = outcome.message;
			else error = null;
			services.stage.notifySurfaceChange();
		} finally {
			busy = false;
		}
	}

	const relatedWalls = $derived(
		relations?.relations.filter((relation) => relation.planClass === 'through' || relation.planClass === 'edge') ?? []
	);
	const roomUnderRegion = $derived.by(() => {
		if (region === null || bounds === null) return null;
		const centre: LayoutVec2 = [(bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2];
		const inside = geometry.rooms.find((room) =>
			room.floorPolygon.length >= 3 &&
			((): boolean => {
				let hit = false;
				for (let index = 0, previous = room.floorPolygon.length - 1; index < room.floorPolygon.length; previous = index++) {
					const [xi, zi] = room.floorPolygon[index]!;
					const [xp, zp] = room.floorPolygon[previous]!;
					if ((zi > centre[1]) !== (zp > centre[1]) &&
						centre[0] < ((xp - xi) * (centre[1] - zi)) / (zp - zi) + xi) {
						hit = !hit;
					}
				}
				return hit;
			})()
		);
		return inside?.roomId ?? null;
	});

	async function fitSpace(): Promise<void> {
		if (region === null) return;
		if (roomUnderRegion === null) {
			error = 'This region is not over a Room, so there is no Space outline to fit.';
			return;
		}
		await accept(LAYOUT_REGION_FIT_SPACE_KIND, { regionId: region.id, roomId: roomUnderRegion });
	}

	async function fitRoof(): Promise<void> {
		if (region === null) return;
		await accept(LAYOUT_REGION_FIT_ROOF_KIND, {
			regionId: region.id,
			wallIds: relatedWalls.map((relation) => relation.wallId)
		});
	}

	async function fitWalls(): Promise<void> {
		if (region === null) return;
		await accept(LAYOUT_REGION_FIT_WALLS_KIND, {
			regionId: region.id,
			wallIds: relatedWalls.map((relation) => relation.wallId)
		});
	}

	async function meetWall(wallId: string): Promise<void> {
		if (region === null) return;
		await accept(LAYOUT_REGION_FIT_EDGE_KIND, { regionId: region.id, wallId });
	}

	async function markIntended(wallId: string, intended: boolean): Promise<void> {
		if (region === null) return;
		await accept(LAYOUT_REGION_INTENDED_GAP_KIND, { regionId: region.id, wallId, intended });
	}

	async function duplicate(): Promise<void> {
		if (region === null || busy) return;
		busy = true;
		try {
			const capture = mintLayoutIdCapture();
			const fresh = services.stage.snapshot();
			const document = stageLayout(fresh);
			const newId = regionIdFromCapture(document, capture);
			const outcome = await services.authoring.accept(
				regionDuplicateIntent({
					regionId: newId,
					sourceRegionId: region.id,
					delta: [Number((width + 1).toFixed(3)), 0],
					capture,
					operationId: globalThis.crypto.randomUUID(),
					projectId: fresh.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision: fresh.domain.unitRevisions.layout,
					levelId: fresh.domain.layoutLevelId
				})
			);
			if (outcome.kind === 'refused') {
				error = outcome.message;
				return;
			}
			services.stage.select({
				sourceId: newId,
				sourceKind: 'region',
				generationId: services.stage.snapshot().compileGeneration,
				ref: {
					sourceId: newId,
					sourceKind: 'region',
					generationId: services.stage.snapshot().compileGeneration,
					stream: 'projected',
					subRef: null
				}
			});
			services.stage.notifySurfaceChange();
		} finally {
			busy = false;
		}
	}

	/** Resting-object words: the derived count, never a Scene write. */
	const restingWords = $derived(
		region?.role === 'floor'
			? restingObjects === 1
				? '1 object rests on this platform'
				: `${restingObjects} objects rest on this platform`
			: 'A Flat Roof carries no resting objects'
	);
</script>

{#if region !== null && compiled !== undefined}
	<div class="region-card" data-layout-region-card>
		<p class="kind" data-region-kind>
			{roleWords}
			{#if region.name === undefined}<span class="muted"> · unnamed</span>{/if}
		</p>
		<div class="fields">
			<label class="field">
				<span>Elevation</span>
				<input
					type="text"
					inputmode="decimal"
					data-region-elevation
					value={compactMeasure(region.elevation.toFixed(3))}
					disabled={busy}
					onchange={(event) =>
						void commitNumber('elevation', (event.currentTarget as HTMLInputElement).value)}
				/>
				<span class="unit">m</span>
			</label>
			<label class="field">
				<span>Thickness</span>
				<input
					type="text"
					inputmode="decimal"
					data-region-thickness
					value={compactMeasure(region.thickness.toFixed(3))}
					disabled={busy}
					onchange={(event) =>
						void commitNumber('thickness', (event.currentTarget as HTMLInputElement).value)}
				/>
				<span class="unit">m</span>
			</label>
			<label class="field">
				<span>Width</span>
				<input
					type="text"
					inputmode="decimal"
					data-region-width
					value={compactMeasure(width.toFixed(3))}
					disabled={busy}
					onchange={(event) =>
						void commitSize('width', (event.currentTarget as HTMLInputElement).value)}
				/>
				<span class="unit">m</span>
			</label>
			<label class="field">
				<span>Depth</span>
				<input
					type="text"
					inputmode="decimal"
					data-region-depth
					value={compactMeasure(depth.toFixed(3))}
					disabled={busy}
					onchange={(event) =>
						void commitSize('depth', (event.currentTarget as HTMLInputElement).value)}
				/>
				<span class="unit">m</span>
			</label>
		</div>
		<dl class="facts">
			<div><dt>Elevation (world)</dt><dd>{elevationWorld}</dd></div>
			<div><dt>Area</dt><dd>{area.toFixed(2)} m²</dd></div>
			<div><dt>Objects</dt><dd data-region-resting>{restingWords}</dd></div>
		</dl>

		<div class="relations" data-region-relations>
			<h3>Relations</h3>
			{#if relations === null || relations.relations.length === 0}
				<p class="muted">No Wall reads against this region yet.</p>
			{:else}
				{#each relations.relations as relation (relation.wallId)}
					<div class="relation" data-region-relation={relation.wallId}>
						<div class="reading">
							<span class="wall">{wallLabels.get(relation.wallId)?.label ?? relation.wallId}</span>
							<span class="value" data-region-reading>
								{relation.reading === 'gap'
									? `Gap ${relation.measureMeters?.toFixed(2)} m${relation.measureAxis === 'horizontal' ? ' horizontal' : ''}${relation.intended ? ' · intended' : ''}`
									: relation.reading === 'crosses'
										? 'Crosses'
										: 'Meets'}
							</span>
						</div>
						<div class="relation-actions">
							{#if relation.fit === 'meet-wall'}
								<button type="button" disabled={busy} onclick={() => void meetWall(relation.wallId)}>
									Meet wall
								</button>
							{:else if relation.fit === 'fit-roof-to-walls'}
								<button type="button" disabled={busy} onclick={() => void fitRoof()}>
									Fit roof to walls
								</button>
							{/if}
							{#if relation.reading === 'gap' && !relation.intended}
								<button
									type="button"
									data-region-mark-intended={relation.wallId}
									disabled={busy}
									onclick={() => void markIntended(relation.wallId, true)}
								>
									Mark intended
								</button>
							{:else if relation.intended}
								<button type="button" disabled={busy} onclick={() => void markIntended(relation.wallId, false)}>
									Clear intended
								</button>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<div class="procedures">
			<button type="button" data-region-fit-space disabled={busy || roomUnderRegion === null} onclick={() => void fitSpace()}>
				Fit to space
			</button>
			{#if region.role === 'overhead'}
				<button type="button" data-region-fit-roof-to-walls disabled={busy || relatedWalls.length === 0} onclick={() => void fitRoof()}>
					Fit roof to walls
				</button>
				<button type="button" data-region-fit-walls-to-roof disabled={busy || relatedWalls.length === 0} onclick={() => void fitWalls()}>
					Fit walls to roof
				</button>
			{/if}
			<button type="button" data-region-duplicate disabled={busy} onclick={() => void duplicate()}>
				Duplicate
			</button>
		</div>

		{#if error !== null}<p class="error" role="alert">{error}</p>{/if}
		{#if footer}{@render footer()}{/if}
		{#if secondary}{@render secondary()}{/if}
		{#if more}{@render more()}{/if}
	</div>
{/if}

<style>
	.region-card {
		display: grid;
		gap: 8px;
		padding: 0 12px 10px;
	}
	.kind {
		margin: 0;
		color: var(--shell-ink);
		font-size: 12px;
		font-weight: 600;
	}
	.muted {
		color: var(--shell-ink-quiet);
		font-weight: 400;
	}
	.fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
	}
	.field {
		position: relative;
		display: grid;
		gap: 2px;
		min-width: 0;
		color: var(--shell-ink-2);
		font-size: 10.5px;
	}
	.field input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		height: 26px;
		padding: 0 18px 0 6px;
		border: 1px solid var(--shell-field-line);
		border-radius: 6px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: 12px var(--shell-mono);
		font-variant-numeric: tabular-nums;
	}
	.unit {
		position: absolute;
		right: 6px;
		bottom: 6px;
		font-size: 10px;
		pointer-events: none;
	}
	.facts {
		display: grid;
		gap: 2px;
		margin: 0;
		font-size: 11px;
	}
	.facts div {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}
	.facts dt {
		color: var(--shell-ink-quiet);
	}
	.facts dd {
		margin: 0;
		color: var(--shell-ink);
		text-align: right;
	}
	.relations {
		display: grid;
		gap: 4px;
		border-top: 1px solid var(--shell-field-line);
		padding-top: 6px;
	}
	.relations h3 {
		margin: 0;
		font: 10px var(--shell-mono);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--shell-ink-quiet);
	}
	.relations p {
		margin: 0;
		font-size: 11px;
	}
	.relation {
		display: grid;
		gap: 2px;
		padding: 4px 0;
		border-bottom: 1px dashed var(--shell-field-line);
	}
	.reading {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 11px;
	}
	.wall {
		color: var(--shell-ink-2);
	}
	.value {
		color: var(--shell-ink);
		font-family: var(--shell-mono);
	}
	.relation-actions,
	.procedures {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	button {
		min-height: 24px;
		padding: 2px 8px;
		border: 1px solid var(--shell-field-line);
		border-radius: 6px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font-size: 11px;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		border-color: var(--shell-field-line-strong);
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.error {
		margin: 0;
		color: var(--shell-refuse);
		font-size: 11px;
	}
	@media (pointer: coarse) {
		button,
		.field input {
			min-height: 44px;
			min-width: 44px;
		}
	}
</style>
