<script lang="ts">
	/**
	 * P23.13 visual-QA plate — Far / Normal / Near strips.
	 *
	 * Dev-only (no shell, no store): one compiled wall-first document per strip,
	 * painted by the real `PlanSvg` adapter at 8 / 20 / 100 px per meter, so the
	 * band projection, the silhouette aid, the Door type cue and the Window
	 * stroke budget can be compared directly against the ratified grammar and the
	 * atlas plates. Geometry, hit, snap and identity are untouched by design:
	 * this page only paints.
	 *
	 * Rows are laid out at a constant *screen* distance (60 px) at each scale, so
	 * the same seven hosts stay comparable instead of collapsing together at Far
	 * or leaving the frame at Near.
	 */
	// Both shells load tokens.css before plan.css; the band/ink role tokens alias
	// raw tokens defined there, so the plate must load both or every stroke
	// resolves to `none`.
	import '$lib/editor/styles/tokens.css';
	import '$lib/editor/styles/plan.css';
	import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-compat';
	import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
	import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-codec';
	import type { LayoutVec2 } from '$lib/layout/layout-types';
	import { buildPlanRenderModel } from '$lib/layout/plan-render-model';
	import PlanSvg from '$lib/editor/layout/PlanSvg.svelte';

	const VIEW_WIDTH = 420;
	const ROW_SCREEN_GAP = 60;
	const PADDING = 30;
	const WALL_SCREEN_LENGTH = VIEW_WIDTH - PADDING * 2;

	type Row = {
		id: string;
		thickness: number;
		kind: 'door' | 'window';
		width: number;
		note: string;
		partition?: boolean;
	};

	const ROWS: Row[] = [
		{ id: 'thin-door', thickness: 0.2, kind: 'door', width: 0.9, note: 'thin host 0.2 m · 0.9 m Door' },
		{ id: 'thick-door', thickness: 0.5, kind: 'door', width: 0.9, note: 'thick host 0.5 m · 0.9 m Door' },
		{ id: 'thin-window', thickness: 0.2, kind: 'window', width: 1.2, note: 'thin host 0.2 m · 1.2 m Window' },
		{ id: 'thick-window', thickness: 0.5, kind: 'window', width: 1.2, note: 'thick host 0.5 m · 1.2 m Window' },
		{ id: 'hairline-door', thickness: 0.05, kind: 'door', width: 0.9, note: 'hairline host 0.05 m · silhouette aid' },
		{ id: 'tiny-door', thickness: 0.2, kind: 'door', width: 0.15, note: '0.15 m Door · displaced cue' },
		{ id: 'partition-door', thickness: 0.2, kind: 'door', width: 0.9, note: 'partition role body', partition: true }
	];

	/**
	 * One strip's document: the world extent adapts to the scale so every strip
	 * fills the same frame, while the authored thickness, opening width and row
	 * gaps stay in meters. That is the whole point — the *band* is what changes.
	 */
	function documentFor(pixelsPerMeter: number): LayoutDocumentWallFirst {
		const wallLength = WALL_SCREEN_LENGTH / pixelsPerMeter;
		const rowGap = ROW_SCREEN_GAP / pixelsPerMeter;
		return {
			units: 'meters',
			formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
			floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
			junctions: ROWS.flatMap((row, index) => [
				{ id: `j-${row.id}-a`, point: [0, index * rowGap] as [number, number] },
				{ id: `j-${row.id}-b`, point: [wallLength, index * rowGap] as [number, number] }
			]),
			walls: ROWS.map((row) => ({
				id: `wall-${row.id}`,
				startJunctionId: `j-${row.id}-a`,
				endJunctionId: `j-${row.id}-b`,
				role: row.partition ? ('partition' as const) : ('boundary' as const),
				thickness: row.thickness,
				height: 3,
				centerline: { kind: 'line' } as const
			})),
			openings: ROWS.map((row) => ({
				id: `opening-${row.id}`,
				wallId: `wall-${row.id}`,
				kind: row.kind,
				offset: wallLength / 2 - row.width / 2,
				width: row.width,
				height: row.kind === 'door' ? 2.1 : 1.2,
				sillHeight: row.kind === 'door' ? 0 : 1,
				profile: 'rectangular' as const
			})),
			rooms: [],
			objects: []
		};
	}

	function stripFor(pixelsPerMeter: number) {
		const compiled = compileWallFirstLayoutGeometry(documentFor(pixelsPerMeter));
		const height = (ROWS.length - 1) * ROW_SCREEN_GAP + PADDING * 2;
		return {
			pixelsPerMeter,
			label: pixelsPerMeter === 8 ? 'Far · 8 px/m' : pixelsPerMeter === 20 ? 'Normal · 20 px/m' : 'Near · 100 px/m',
			issues: compiled.issues.length,
			width: VIEW_WIDTH,
			height,
			model: buildPlanRenderModel(compiled.geometry),
			view: {
				width: VIEW_WIDTH,
				height,
				center: [
					WALL_SCREEN_LENGTH / 2 / pixelsPerMeter,
					((ROWS.length - 1) * ROW_SCREEN_GAP) / 2 / pixelsPerMeter
				] satisfies LayoutVec2,
				pixelsPerMeter,
				initialized: true,
				gridEnabled: false,
				snapEnabled: false,
				angleSnapEnabled: false,
				showTourOverlay: false
			}
		};
	}

	const STRIPS = [8, 20, 100].map(stripFor);
</script>

<svelte:head><title>P23.13 architecture grammar plate</title></svelte:head>

<main>
	<header>
		<h1>P23.13 S1 — static architectural grammar</h1>
		<p>
			One compiled wall-first document per strip, painted by the real PlanSvg adapter. Rows, top to bottom:
			{ROWS.map((row) => row.note).join(' · ')}.
		</p>
		<p class="issues">
			compile issues: {STRIPS.map((strip) => `${strip.pixelsPerMeter}px/m=${strip.issues}`).join(' ')}
		</p>
	</header>
	<div class="strips">
		{#each STRIPS as strip (strip.pixelsPerMeter)}
			<figure>
				<svg viewBox={`0 0 ${strip.width} ${strip.height}`} aria-label={strip.label}>
					<PlanSvg model={strip.model} planView={strip.view} />
				</svg>
				<figcaption>{strip.label}</figcaption>
			</figure>
		{/each}
	</div>
</main>

<style>
	main { min-height: 100vh; padding: 24px; background: #e5eaee; color: #343c43; font-family: system-ui, sans-serif; }
	h1 { font-size: 18px; margin: 0 0 8px; }
	p { margin: 0 0 6px; font-size: 13px; max-width: 900px; }
	.issues { font-variant-numeric: tabular-nums; color: #596570; }
	.strips { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 18px; }
	figure { margin: 0; background: #f5f3ee; border: 1px solid #ced6dd; border-radius: 6px; overflow: hidden; }
	svg { display: block; width: 100%; height: auto; background: #f5f3ee; }
	figcaption { padding: 8px 10px; font-size: 12px; background: #fff; border-top: 1px solid #e0e5e8; }
</style>
