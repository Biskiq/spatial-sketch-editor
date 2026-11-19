/**
 * Scene-owned application of runtime-only Layout surface lineage.
 *
 * Finish assignments stay shared by identity. Layout describes which stable
 * surface refs survive a topology edit; this module copies assignment records
 * from the accepted Scene snapshot, validates the correspondence, and prunes
 * refs whose Layout identity retired.
 */
import {
	normalizeLayoutSurfaceLineage,
	resolveLayoutSurface,
	surfaceKey,
	type LayoutDocumentWallFirst,
	type LayoutSurfaceLineage,
	type LayoutSurfaceRef
} from '@portfolio/layout-core';
import type { CameraFreeSceneDocument } from '../units/types';
import type { SceneSurfaceFinish, SceneSurfaceRef } from '../scene';

export type SurfaceLineageReport = {
	readonly replaced: readonly {
		readonly target: LayoutSurfaceRef;
		readonly winner: LayoutSurfaceRef;
		readonly losing: LayoutSurfaceRef;
	}[];
	readonly dropped: readonly SceneSurfaceRef[];
	readonly pruned: readonly SceneSurfaceRef[];
};

function surfaceLabel(surface: LayoutSurfaceRef): string {
	switch (surface.kind) {
		case 'wall-side': return `Wall ${surface.wallId} ${surface.side}`;
		case 'room-floor': return `Space ${surface.roomId} floor`;
		case 'room-lid': return `Space ${surface.roomId} lid`;
		case 'region-face': return `Region ${surface.regionId} ${surface.face}`;
	}
}

/** One deterministic preview line derived from the report the commit uses. */
export function surfaceLineageConsequence(report: SurfaceLineageReport): string {
	if (report.replaced.length === 0) return 'No competing surface Finishes.';
	return report.replaced.map(({ target, winner, losing }) =>
		`On ${surfaceLabel(target)}, keep the Finish from ${surfaceLabel(winner)}; replace the Finish from ${surfaceLabel(losing)}.`
	).join(' ');
}

export type SurfaceLineageResult =
	| { readonly kind: 'ready'; readonly scene: CameraFreeSceneDocument; readonly report: SurfaceLineageReport }
	| {
			readonly kind: 'rejected';
			readonly code: 'surface_lineage_invalid' | 'surface_reference_orphaned';
			readonly message: string;
		  };

/**
 * Apply one Layout topology operation's correspondence to the baseline Scene.
 * All sources are read from `beforeScene`; a transfer never observes another
 * transfer's output.
 */
export function applySurfaceLineage(input: {
	readonly beforeScene: CameraFreeSceneDocument;
	readonly beforeLayout: LayoutDocumentWallFirst;
	readonly afterLayout: LayoutDocumentWallFirst;
	readonly lineage: LayoutSurfaceLineage;
}): SurfaceLineageResult {
	const before = input.beforeScene.surfaceFinishes ?? [];
	const beforeByKey = new Map(before.map((assignment) => [surfaceKey(assignment.surface), assignment]));
	for (const entry of input.lineage) {
		for (const source of entry.from) {
			if (
				beforeByKey.has(surfaceKey(source)) &&
				resolveLayoutSurface(input.beforeLayout, source) === 'retired'
			) {
				return {
					kind: 'rejected',
					code: 'surface_lineage_invalid',
					message: `Surface lineage source "${surfaceKey(source)}" is retired in the accepted Layout.`
				};
			}
		}
	}
	const normalized = normalizeLayoutSurfaceLineage({
		beforeLayout: input.beforeLayout,
		afterLayout: input.afterLayout,
		lineage: input.lineage
	});
	if (normalized.kind === 'rejected') {
		return { kind: 'rejected', code: 'surface_lineage_invalid', message: normalized.message };
	}
	const seenTargets = new Set<string>();
	for (const entry of normalized.lineage) {
		const targetKey = surfaceKey(entry.to);
		if (seenTargets.has(targetKey)) {
			return { kind: 'rejected', code: 'surface_lineage_invalid', message: `Surface lineage has duplicate target "${targetKey}".` };
		}
		seenTargets.add(targetKey);
		if (resolveLayoutSurface(input.afterLayout, entry.to) === 'retired') {
			return { kind: 'rejected', code: 'surface_lineage_invalid', message: `Surface lineage target "${targetKey}" is retired in the candidate Layout.` };
		}
		for (const source of entry.from) {
			if (resolveLayoutSurface(input.beforeLayout, source) === 'retired') {
				return { kind: 'rejected', code: 'surface_lineage_invalid', message: `Surface lineage source "${surfaceKey(source)}" is retired in the accepted Layout.` };
			}
		}
	}

	const assignments = new Map(beforeByKey);
	const replaced: SurfaceLineageReport['replaced'][number][] = [];
	const movedFrom = new Set<string>();

	for (const entry of normalized.lineage) {
		const targetKey = surfaceKey(entry.to);
		let winner: SceneSurfaceFinish | undefined;
		let winnerRef: LayoutSurfaceRef | undefined;
		for (const source of entry.from) {
			const key = surfaceKey(source);
			const assignment = beforeByKey.get(key);
			if (assignment === undefined) continue;
			if (winner === undefined) {
				winner = assignment;
				winnerRef = source;
			} else if (JSON.stringify(assignment.finish) !== JSON.stringify(winner.finish)) {
				replaced.push({ target: entry.to, winner: winnerRef!, losing: source });
			}
		}
		assignments.delete(targetKey);
		if (winner !== undefined) {
			if (entry.to.kind === 'region-face') {
				return { kind: 'rejected', code: 'surface_lineage_invalid', message: 'Scene 10 does not admit region-face Finish assignments.' };
			}
			assignments.set(targetKey, { surface: entry.to, finish: winner.finish });
			for (const source of entry.from) {
				if (beforeByKey.has(surfaceKey(source))) movedFrom.add(surfaceKey(source));
			}
		}
	}

	const pruned: SceneSurfaceRef[] = [];
	for (const [key, assignment] of assignments) {
		if (resolveLayoutSurface(input.afterLayout, assignment.surface) === 'retired') {
			assignments.delete(key);
			pruned.push(assignment.surface);
		}
	}

	const dropped = before
		.filter((assignment) =>
			resolveLayoutSurface(input.afterLayout, assignment.surface) === 'retired' &&
			!movedFrom.has(surfaceKey(assignment.surface))
		)
		.map((assignment) => assignment.surface);
	const surfaceFinishes = [...assignments.values()].sort((a, b) => {
		const left = surfaceKey(a.surface);
		const right = surfaceKey(b.surface);
		return left < right ? -1 : left > right ? 1 : 0;
	});
	const scene: CameraFreeSceneDocument = { ...input.beforeScene };
	if (surfaceFinishes.length === 0) delete (scene as { surfaceFinishes?: readonly SceneSurfaceFinish[] }).surfaceFinishes;
	else scene.surfaceFinishes = surfaceFinishes;
	return { kind: 'ready', scene, report: { replaced, dropped, pruned } };
}

/** Identity set of assignments that are already retired in the given Layout. */
export function retiredSurfaceReferenceKeys(
	scene: Pick<CameraFreeSceneDocument, 'surfaceFinishes'>,
	layout: LayoutDocumentWallFirst
): ReadonlySet<string> {
	return new Set((scene.surfaceFinishes ?? [])
		.filter((assignment) => resolveLayoutSurface(layout, assignment.surface) === 'retired')
		.map((assignment) => surfaceKey(assignment.surface)));
}

/** Find retired refs introduced by a candidate, by stable identity set. */
export function newlyRetiredSurfaceReferenceKeys(input: {
	readonly beforeScene: Pick<CameraFreeSceneDocument, 'surfaceFinishes'>;
	readonly beforeLayout: LayoutDocumentWallFirst;
	readonly afterScene: Pick<CameraFreeSceneDocument, 'surfaceFinishes'>;
	readonly afterLayout: LayoutDocumentWallFirst;
}): readonly string[] {
	const previous = retiredSurfaceReferenceKeys(input.beforeScene, input.beforeLayout);
	return [...retiredSurfaceReferenceKeys(input.afterScene, input.afterLayout)]
		.filter((key) => !previous.has(key))
		.sort();
}
