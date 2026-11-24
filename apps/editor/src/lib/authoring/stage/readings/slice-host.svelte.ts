import type { ViewportEvaluation } from '@portfolio/camera-core';
import { contribution } from '../../workspace/region-ownership';
import type { StageReadSnapshot } from '../accepted-read';
import type { StageLens } from '../stage-session';
import type { StageShellState } from '../route/stage-shell-state.svelte';
import { resolveSlice, sliceDepthItems, type ResolvedSlice } from '../slice/slice-cut';
import { createSliceDraw } from '../slice/slice-draw.svelte';
import { sliceReading } from '../slice/slice-reading.svelte';
import { setResolvedSlice } from '../slice/slice-resolved';

export function createSliceHost(input: {
	readonly draw: Parameters<typeof createSliceDraw>[0];
	readonly shell: Pick<StageShellState, 'heightMeters' | 'heightTicks' | 'activeWorldTool' | 'setActiveWorldTool'>;
	readonly snapshot: () => StageReadSnapshot | null;
	readonly lens: () => StageLens;
	readonly evaluation: () => ViewportEvaluation | null;
}) {
	const { shell } = input;
	const sliceDraw = createSliceDraw(input.draw);
	/**
	 * The live Slice, resolved against the Sheet. World only: Preview is the visitor's
	 * as-built world and never receives a cut.
	 */
	const resolvedSlice = $derived.by((): ResolvedSlice | null => {
		const reading = sliceReading.reading;
		if (reading === null) return null;
		if (input.lens() !== 'world') return null;
		const snapshot = input.snapshot();
		if (snapshot === null) return null;
		return resolveSlice(reading, {
			sheetHeight: shell.heightMeters,
			datumMeters: snapshot.domain.datumMeters
		});
	});

	/**
	 * Publish the resolved reading to the plain-module pick providers.
	 *
	 * `layout.adapter.ts` is created by an adapter factory, not by a component, so it
	 * reads the same value through this mirror (the shape `liftedSourcesNow` already
	 * uses). Written here — the one place the value is derived — so no consumer can
	 * hold a cut the Canvas is not drawing.
	 */
	function attachMirror(): void {
		$effect(() => {
			setResolvedSlice(resolvedSlice);
		});
	}

	/**
	 * The Slice pill: **Cut at {h} m · depth ▾ · Put back**. Its depth rows are the
	 * Sheet's own ticks strictly below the cut, labelled as the Sheet labels them,
	 * and there are no disabled rows: an item that could not be below the cut is not
	 * offered at all.
	 */
	const slicePill = $derived.by(() => {
		const reading = sliceReading.reading;
		if (reading === null) return null;
		if (reading.kind === 'drawn') {
			return {
				mode: 'drawn' as const,
				cutLabel: 'Drawn cut',
				depthLabel: `${reading.depthMeters.toFixed(2)} m`,
				items: [],
				onDepth: () => {},
				onFlip: () => sliceDraw.flip(),
				onPutBack: () => putBackSlice()
			};
		}
		const items = sliceDepthItems({
			reading,
			sheetHeightMeters: shell.heightMeters,
			ticks: shell.heightTicks
		});
		const depth = reading.depth;
		const current =
			depth.kind === 'below'
				? items.find(
						(item) =>
							item.kind === 'below' &&
							Math.abs(item.meters - depth.meters) <= 1e-3
					)
				: undefined;
		const depthLabel =
			depth.kind === 'below'
				? (current?.label ?? `${depth.meters.toFixed(2)} m below`)
				: 'To the floor';
		return {
			cutLabel: shell.heightMeters.toFixed(2),
			depthLabel,
			items: items.map((item) =>
				item.kind === 'below'
					? { kind: item.kind, label: item.label, checked: item.checked, meters: item.meters }
					: { kind: item.kind, label: item.label, checked: item.checked }
			),
			onDepth: (item: { readonly kind: 'to-floor' | 'below'; readonly meters?: number }) => {
				sliceReading.setDepth(
					item.kind === 'below' && item.meters !== undefined
						? { kind: 'below', meters: item.meters }
						: { kind: 'to-floor' }
				);
			},
			onPutBack: () => putBackSlice()
		};
	});

	function putBackSlice(): void {
		sliceDraw.disarm();
		sliceReading.putBack();
		shell.setActiveWorldTool('select');
	}

	const sliceDraftWorld = $derived.by(() => {
		const draft = sliceDraw.view().draft;
		return draft === null ? null : { start: draft.start, end: draft.end };
	});
	const sliceDraftOverlay = $derived.by(() => {
		const draft = sliceDraw.view().draft;
		const stage = input.draw.facade();
		const id = stage?.evaluationId() ?? null;
		const rect = input.evaluation()?.rect ?? null;
		if (draft === null || stage === null || id === null || rect === null) return null;
		const project = (point: readonly [number, number, number]): readonly [number, number] | null => {
			const projected = stage.projectWorld(point, id);
			return projected.kind === 'projected'
				? [projected.css[0] - rect.left, projected.css[1] - rect.top]
				: null;
		};
		const from = project(draft.start);
		const to = project(draft.end);
		return from === null || to === null ? null : { from, to, label: draft.label };
	});

	function clear(): void {
		sliceDraw.disarm();
		sliceReading.clear();
		setResolvedSlice(null);
	}

	function level(): void {
		sliceDraw.disarm();
		sliceReading.level();
	}

	function draw(): void {
		sliceDraw.arm();
		shell.setActiveWorldTool('slice');
	}

	function attachTeardown(): void {
		$effect(() => {
			if (input.lens() === 'world') return;
			// The Slice reads the world Stage: leaving the lens ends it exactly as a replaced
			// project does, or the pill would offer a cut over an uncut Stage.
			if (!sliceReading.isActive()) return;
			clear();
		});
		$effect(() => {
			// Changing the World row away from Slice ends the drawn gesture; the cut
			// itself stays and is edited after Put back or under Select as usual.
			if (shell.activeWorldTool !== 'slice' && sliceDraw.armed) sliceDraw.disarm();
		});
	}

	const canvas = contribution<'layout-readings', 'canvas'>()({
		get resolvedSlice() { return resolvedSlice; },
		get sliceDraft() { return sliceDraftWorld; }
	});
	const viewport = contribution<'layout-readings', 'viewport'>()({
		get slice() { return slicePill; }
	});
	const overlay = contribution<'layout-readings', 'overlay'>()({
		get sliceDraft() { return sliceDraftOverlay; }
	});

	return {
		canvas, viewport, overlay, attachMirror, attachTeardown,
		clear, level, draw, controller: sliceDraw,
		resolved: () => resolvedSlice,
		active: () => sliceReading.isActive(),
		get mode() { return sliceReading.reading?.kind ?? null; },
		putBack: putBackSlice
	};
}
