import { eyeOfInspectionPose, type ViewportEvaluation } from '@portfolio/camera-core';
import type { SceneArtworkEntity } from '@portfolio/project-model';
import { artworkBackWallHit } from '../../artwork/artwork-wall-move';
import { isArtworkWallFace } from '../../artwork/artwork-placement';
import { wallUnfold } from '../../layout/wall-unfold-store.svelte';
import type { ScenePickSource } from '../../scene/scene-pick-source';
import { contribution } from '../../workspace/region-ownership';
import type { StageReadSnapshot } from '../accepted-read';
import type { StageSelectionEntry } from '../semantic-selection';
import type { StageFacade } from '../stage-facade';
import type { StageLens } from '../stage-session';
import { nearWallCutaway } from '../cutaway/near-wall-cutaway.svelte';
import { setResolvedCutaway } from '../cutaway/cutaway-resolved';
import type { AlignCutawayRequest } from './layout-readings-view';

export function createCutawayHost(input: {
	readonly selection: () => StageSelectionEntry | null;
	readonly selectedArtwork: () => SceneArtworkEntity | null;
	readonly snapshot: () => StageReadSnapshot | null;
	readonly facade: () => StageFacade | null;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly lens: () => StageLens;
	readonly scenePick: Pick<ScenePickSource, 'pickVisibleFace'>;
	readonly pressing: () => boolean;
	readonly previewing: () => boolean;
	readonly alignCutaway: () => AlignCutawayRequest | null;
}) {
	/** X2's two-way switch, under Lift in the reading control's ▾ (never a pill). */
	const nearWallsControl = $derived({
		mode: nearWallCutaway.mode,
		set: (mode: 'cut' | 'whole') => nearWallCutaway.setMode(mode)
	});

	// Preview is an isolated visitor run: a held `W` never leaks into it.
	function attachPreviewHold(): void {
		$effect(() => {
			if (input.previewing()) nearWallCutaway.setHeld(false);
		});
	}

	/**
	 * X2 — the selection's host Walls (D9).
	 *
	 * A selected Wall, a selected Opening's host Wall, and a selected hung
	 * Artwork's **derived** host (O-1 keeps Scene objects as built; the derived host
	 * is what the as-built back-wall ray finds within 1 cm). These Walls are exempt
	 * from the cutaway so the thing the creator selected keeps its whole body.
	 */
	const cutawaySelectionHosts = $derived.by((): ReadonlySet<string> => {
		const hosts = new Set<string>();
		const entry = input.selection();
		const geometry = input.snapshot()?.domain.geometry ?? null;
		if (entry === null || geometry === null) return hosts;
		if (entry.reference.domain === 'layout') {
			const subject = entry.reference.subject;
			if (subject.kind === 'wall') hosts.add(subject.id);
			else if (subject.kind === 'opening') {
				for (const wall of geometry.walls) {
					if (wall.openings.some((opening) => opening.openingId === subject.id)) hosts.add(wall.wallId);
				}
			}
		}
		const artwork = input.selectedArtwork();
		const stage = input.facade();
		if (artwork !== null && stage !== null && input.lens() === 'world') {
			const snapshot = stage.snapshot();
			// An as-built query, never the display predicate: a host is a document fact
			// (plan §3.6 step 8).
			const hit = artworkBackWallHit(artwork.position, artwork.rotation[1], (ray) =>
				input.scenePick.pickVisibleFace(ray, snapshot.domain.scene, (candidate) =>
					isArtworkWallFace(candidate, snapshot.domain.geometry)
				)
			);
			if (hit !== null && hit.wallId !== undefined && hit.distanceMeters <= 0.01) hosts.add(hit.wallId);
		}
		return hosts;
	});

	/** D12: Walls whose cap component failed close to whole until the next decision. */
	let cutawayFailedIds = $state<ReadonlySet<string>>(new Set());

	const cutawayEffective = $derived.by((): ReadonlySet<string> => {
		// Read the decision so the mask re-evaluates when classification changes.
		nearWallCutaway.classified;
		const effective = nearWallCutaway.effective(cutawaySelectionHosts);
		if (cutawayFailedIds.size === 0) return effective;
		const next = new Set<string>();
		for (const wallId of effective) if (!cutawayFailedIds.has(wallId)) next.add(wallId);
		return next;
	});
	/**
	 * Wall Align (T2.S8 U6) — a view-only mask while a wall side is faced: every
	 * other Wall in front of the faced plane is cut to the floor (picks pass
	 * through) and hidden, so nothing covers the surface being aligned. Hiding is
	 * what draws it: a cutaway twin of a plain material can reuse the uncut program
	 * (reported on the PR), so the cut alone is not relied on for display. Whole,
	 * the hold key and the classifier are ignored for the session, as Paper is
	 * during floor Align; no preference changes.
	 */
	const alignCutaway = $derived.by((): { readonly ids: readonly string[]; readonly top: number } | null => {
		const aligned = input.alignCutaway();
		if (aligned === null) return null;
		const ids = aligned.ids.filter((wallId) => !cutawayFailedIds.has(wallId));
		return { ids, top: aligned.top };
	});
	const cutawayWallIds = $derived.by(() => {
		if (alignCutaway !== null) return alignCutaway.ids;
		const unfolded = wallUnfold.state?.wallId ?? null;
		return [...cutawayEffective].filter((wallId) => wallId !== unfolded).sort();
	});
	const cutawayStubTopY = $derived(alignCutaway !== null && alignCutaway.ids.length > 0 ? alignCutaway.top : nearWallCutaway.stubTopY);

	function attachClassification(): void {
		/**
		 * The one classification write (§3.3). Pose, geometry revision, reading and press
		 * state are the only inputs; selection, mode and hold are presentation masks.
		 */
		$effect(() => {
			const stage = input.facade();
			const current = input.evaluation();
			const snapshot = input.snapshot();
			if (stage === null || snapshot === null || current === null) {
				if (nearWallCutaway.decision !== null) nearWallCutaway.reset();
				return;
			}
			const geometry = snapshot.domain.geometry;
			const reading =
				input.lens() === 'world' && current.renderedReading === '3d'
					? '3d'
					: input.lens() === 'world' && current.renderedReading === 'plan'
						? 'plan'
						: 'transition';
			const changed = nearWallCutaway.evaluate({
				eye: eyeOfInspectionPose(current.pose),
				target: current.pose.target,
				rooms: geometry.rooms,
				walls: geometry.walls,
				floors: geometry.floors,
				renderedReading: reading,
				geometryRevision: snapshot.domain.unitRevisions.layout,
				pressing: input.pressing()
			});
			// A new decision is the moment a D12 failure is retried.
			if (changed && cutawayFailedIds.size > 0) cutawayFailedIds = new Set();
		});

		$effect(() => {
			nearWallCutaway.setSelectionHosts(cutawaySelectionHosts);
		});

		/** Publish the effective set to the plain pick providers (the Slice mirror's shape). */
		$effect(() => {
			const ids = cutawayWallIds;
			const top = cutawayStubTopY;
			setResolvedCutaway(
				ids.length > 0 && top !== null ? { wallIds: new Set(ids), stubTopY: top } : null
			);
		});
	}

	function clearMirror(): void {
		setResolvedCutaway(null);
	}

	function reset(): void {
		nearWallCutaway.reset();
		clearMirror();
	}

	const canvas = contribution<'layout-readings', 'canvas'>()({
		get cutawayWallIds() { return cutawayWallIds; },
		get cutawayStubTopY() { return cutawayStubTopY; },
		onCutawayFailure: (wallIds: readonly string[]) => {
			cutawayFailedIds = new Set([...cutawayFailedIds, ...wallIds]);
		}
	});

	return {
		canvas, attachPreviewHold, attachClassification, reset, clearMirror,
		get control() { return nearWallsControl; },
		get alignHiddenWallIds() { return alignCutaway?.ids ?? []; },
		setHeld: (held: boolean) => nearWallCutaway.setHeld(held),
		releaseHold: () => nearWallCutaway.setHeld(false),
		clearFailures: () => { cutawayFailedIds = new Set(); }
	};
}
