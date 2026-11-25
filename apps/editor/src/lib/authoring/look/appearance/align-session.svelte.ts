import { untrack } from 'svelte';
import { ALIGN_CARD_COVER_PX, ALIGN_INDEX_LANE_PX, regionFraming } from '../align-chart';
import { finishCardTargetKey } from '../finish-card.svelte';
import type { StageFacade } from '../../stage/facade/view-contract';
import type { AlignCutawayRequest } from '../../stage/cutaway/align-cutaway-request';
import type { StageReadSnapshot } from '../../stage/accepted-read';
import type { StageShellState } from '../../stage/route/stage-shell-state.svelte';
import type { StageLens } from '../../stage/stage-session';
import type { AlignProps } from '../appearance-view';
import type { FinishAuthoring } from '../finish-authoring.svelte';

type Projection = NonNullable<AlignProps['project']>;
type Framing = {
	readonly center: readonly [number, number, number];
	readonly surfaceMeters: readonly [number, number];
};
type Axes = {
	readonly right: readonly [number, number, number];
	readonly up: readonly [number, number, number];
};
type ViewportSize = { readonly width: number; readonly height: number };
type Evaluation = { readonly rect: { readonly left: number; readonly top: number } };

/**
 * Align on wall / floor: the one owner of its region, its camera framing and
 * its lifetime. The Wall Face executor reads `framing`; the cutaway mask reads
 * `cutaway`. Neither reaches this module: the host wires both ports.
 */
export function createAlignSession(input: {
	readonly shell: StageShellState;
	readonly finishes: () => FinishAuthoring;
	readonly previewing: () => boolean;
	readonly lens: () => StageLens;
	readonly available: () => boolean;
	readonly rect: () => ViewportSize | null;
	readonly facade: () => StageFacade | null;
	readonly evaluation: () => Evaluation | null;
	readonly snapshot: () => StageReadSnapshot | null;
	readonly alignHiddenWallIds: () => readonly string[];
}) {
	const { shell } = input;

	/**
	 * The Align surface region in canvas-local CSS px, from JS-known shell values
	 * only (no DOM measurement). It mirrors the overlay CSS: the Stage inset
	 * (10 px; 14 px above the lower column), the Index lane above 860 px, the
	 * Card lane, then the bar (41 px, or 107 px wrapped in a narrow region), the
	 * note (46 px) and the ruler padding (l 44, r 24, t 20, b 40).
	 */
	function region(viewport: ViewportSize): { x: number; y: number; width: number; height: number } | null {
		const windowWidth = typeof window === 'undefined' ? viewport.width : window.innerWidth;
		const indexCover = !input.previewing() && shell.indexOpen && windowWidth > 860 ? ALIGN_INDEX_LANE_PX : 0;
		const left = indexCover + 10;
		const right = viewport.width - ALIGN_CARD_COVER_PX - 10;
		const bar = right - left < 640 ? 107 : 41;
		const top = 10 + bar;
		const bottom = viewport.height - shell.lowerColumnHeight - 14 - 46;
		const aligned = { x: left + 44, y: top + 20, width: right - left - 44 - 24, height: bottom - top - 20 - 40 };
		return aligned.width > 40 && aligned.height > 40 ? aligned : null;
	}

	function framing(fit: Framing, axes: Axes, viewport: ViewportSize) {
		const aligned = region(viewport);
		if (aligned === null) return null;
		return regionFraming({ center: fit.center, right: axes.right, up: axes.up, surfaceMeters: fit.surfaceMeters, canvas: viewport, region: aligned });
	}

	function cutaway(): AlignCutawayRequest | null {
		const active = input.finishes().align.active;
		return active === null || active.surface !== 'wall'
			? null
			: { ids: active.occluders, top: (active.corners[0]?.[1] ?? 0) + 0.005 };
	}

	function dismiss(): boolean {
		if (!input.finishes().align.active) return false;
		input.finishes().align.putBack();
		return true;
	}

	/** World → canvas-local CSS px through the live Camera evaluation, for the Align overlay. */
	const project = $derived.by((): Projection | null => {
		const stage = input.facade();
		const current = input.evaluation();
		const active = input.finishes().align.active;
		if (active === null || stage === null || current === null) return null;
		const id = stage.evaluationId();
		if (id === null) return null;
		const left = current.rect.left;
		const top = current.rect.top;
		return (point: readonly [number, number, number]): readonly [number, number] | null => {
			const projected = stage.projectWorld(point, id);
			return projected.kind === 'projected' ? [projected.css[0] - left, projected.css[1] - top] : null;
		};
	});

	/** The Align target's Finish, re-read whenever an adapter commit lands (the Card's own signal). */
	const inspected = $derived.by(() => {
		void shell.contributionsVersion;
		const active = input.finishes().align.active;
		return active === null ? null : input.finishes().card.inspectedOf(active.target);
	});

	/**
	 * Today's creation points, in body order: the Card-user ownership effect, then
	 * the region reframe effect.
	 */
	function attach(): void {
		// Align belongs to the Card's open user: deselect, delete, another surface or
		// Back ends it exactly as Put back does (U6 lifecycle).
		$effect(() => {
			const active = input.finishes().align.active;
			if (active === null) return;
			if (input.finishes().card.focusedKey === finishCardTargetKey(active.target)) return;
			untrack(() => input.finishes().align.putBack(false));
		});

		// Re-frame Align when its chrome-free region changes (resize, Index toggled,
		// lower column resized). The first run per Align only records the region.
		let regionKey: string | null = null;
		let regionFor: object | null = null;
		$effect(() => {
			const active = input.finishes().align.active;
			const viewport = input.rect();
			if (active === null || viewport === null) {
				regionFor = null;
				return;
			}
			const key = JSON.stringify(region(viewport));
			if (regionFor !== active) {
				regionFor = active;
				regionKey = key;
				return;
			}
			if (key === regionKey) return;
			regionKey = key;
			untrack(() => input.finishes().align.reframe());
		});
	}

	/** Appearance's Align canvas keys; the entry composes the one contribution. */
	const canvasKeys = {
		get alignHiddenWallIds() { return input.alignHiddenWallIds(); }
	};

	const props = $derived.by((): AlignProps | null => {
		const active = input.finishes().align.active;
		if (active === null || input.previewing() || input.lens() !== 'world' || !input.available()) return null;
		const inspectedNow = inspected;
		const scene = input.snapshot()?.domain.scene;
		if (inspectedNow === null || scene === undefined) return null;
		const viewport = input.rect();
		return {
			align: active,
			refusal: input.finishes().align.refusal,
			project: project,
			viewportWidth: viewport?.width ?? 856,
			viewportHeight: viewport?.height ?? 608,
			source: { base: inspectedNow.instance.base, overrides: inspectedNow.instance.overrides },
			recipes: scene.materialIndex?.definitions ?? new Map(),
			onMaterialPreview: (edits) => input.finishes().card.previewEdits(active.target, () => edits),
			onCancelPreview: () => input.finishes().card.cancel(),
			onCommit: (edits) => input.finishes().card.edit(active.target, () => edits),
			onPutBack: () => input.finishes().align.putBack(true)
		};
	});

	attach();
	return {
		framing,
		cutaway,
		dismiss,
		attach,
		canvasKeys,
		get props() { return props; },
		/** Floor Align shades the Plan; nothing else changes its appearance. */
		get planAppearance() { return input.finishes().align.active?.surface === 'floor' ? 'shaded' : shell.preferences.planAppearance; }
	};
}
