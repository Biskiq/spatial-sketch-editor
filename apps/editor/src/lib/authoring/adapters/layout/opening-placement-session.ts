/**
 * X5 — Opening placement: the Opening reading's one-operation controller.
 *
 * It owns the host preference, the one host-relative candidate (pointer or typed),
 * the edge-positioned planner preview, defaults acceptance and the re-arm
 * lifecycle for creating an Opening on a Wall face. It plans through the existing
 * Opening planners (`opening-planners`) and accepts through the one coordinator
 * port; it writes no source of its own and owns no geometry algorithm.
 *
 * Two lifetimes, kept apart:
 *
 * - **Adapter-lifetime defaults** — the next Opening's kind, profile and size —
 *   live in the shared `InkMemory` the binding is handed, so an accepted write's
 *   rebind does not forget them.
 * - **Captured gesture state** — the identity capture, the candidate, its preview,
 *   the notice, the press lease, the in-flight guard and the remembered host —
 *   is created here per binding and released by `clear()`, the binding's task
 *   close and its disposal. A press lease is released on every exit path (up,
 *   cancel, reading flip, task close, dispose).
 *
 * Preview and acceptance share one minted capture, so the id the ghost implies is
 * the id acceptance writes; a refused acceptance keeps it for the retry and a
 * settled placement never reuses it.
 */
import {
	mintLayoutIdCapture,
	planCreateWallFirstOpening,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import {
	stageUnitRevision,
	type GestureAcquisition,
	type StageAdapterBinding,
	type StageAdapterContext,
	type StageCandidatePreview,
	type StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';

import { candidatePreviewOf } from './candidate-preview';
import {
	LAYOUT_INK_ENTRY,
	LAYOUT_INK_TASK,
	classifyOpeningHost,
	offsetAlongWall,
	type InkOpeningOptions,
	type InkPaletteSnapshot,
	type ProjectedWall
} from './ink';
import {
	openingCreateIntent,
	openingRefusalWords,
	type OpeningCreatePayload
} from './opening-planners';
import {
	parseMeasureInput,
	wallFrame,
	wallStationFrame,
	wallStationNearPoint,
	type WallFrame,
	type WallStationFrame
} from './precision';
import type { LayoutSessionPorts } from './session-ports';
import { pointerDatumPoint, projectedScene } from './stage-pointer';

/**
 * One host-relative Opening candidate.
 *
 * `offset` is the exact near-edge distance from the canonical Wall start; the
 * ghost edges are world points for the overlay. A candidate that does not fit is
 * still shown (with planner words), never moved to make it fit.
 */
export type OpeningCandidate = {
	readonly wallId: string;
	readonly offset: number;
};

export type OpeningPreview =
	| {
			readonly kind: 'planned';
			readonly openingId: string;
			/** The planner candidate preview compiles; release submits the same request. */
			readonly document: LayoutDocumentWallFirst;
			readonly changedWallIds: readonly string[];
	  }
	| { readonly kind: 'refused'; readonly message: string };

/** The Wall a selected subject should prefer as host, or `null`. */
function preferredHostOf(
	document: LayoutDocumentWallFirst,
	sourceKind: string,
	sourceId: string
): string | null {
	if (sourceKind === 'wall') return sourceId;
	if (sourceKind !== 'opening') return null;
	return document.openings.find((opening) => opening.id === sourceId)?.wallId ?? null;
}

/** The host Wall's frame and resolved length, when it has one. */
export function openingSpanOf(
	document: LayoutDocumentWallFirst,
	wallId: string
): { frame: WallFrame; length: number; station: WallStationFrame } | null {
	// Surface 3: one station frame per host. An Opening mark, ghost or
	// handle reads `station.pointAt`, which is exact arc length on a
	// curved centerline and linear on a straight one, so only curved
	// hosts move and straight-host output stays byte-identical.
	const station = wallStationFrame(document, wallId);
	if (station === null) return null;
	const frame = wallFrame(document, wallId) ?? {
		wallId,
		startJunctionId: '',
		endJunctionId: '',
		start: station.start,
		end: station.end,
		direction: station.direction,
		length: station.length,
		angleRadians: Math.atan2(station.direction[1], station.direction[0])
	};
	return station.length > 0 ? { frame, length: station.length, station } : null;
}

/** The Opening reading as the binding drives it. */
export type OpeningPlacementSession = {
	/** The Opening half of the pointer contract (press, move, cancel, release). */
	pointer(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/** Preview the candidate under an unpressed hover; never claims the move. */
	hover(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/** The planner's live candidate or its refusal, in world coordinates. */
	previews(adapterContext: StageAdapterContext, datumMeters: number): readonly StageCandidatePreview[];
	/** The host-relative ghost edges and the refusal words. */
	overlay(adapterContext: StageAdapterContext): ReturnType<NonNullable<StageAdapterBinding['overlay']>>;
	/** The palette's Opening view. */
	paletteView(): NonNullable<InkPaletteSnapshot['opening']>;
	/** The palette's fields changed (`null` is invalid); defaults are adapter memory. */
	setOptions(options: InkOpeningOptions | null): void;
	/** Place by typed offset on the preferred host (empty centres exactly). */
	placeAtOffset(offsetText: string): void;
	/** Remember the host the Opening reading was entered from. */
	captureHost(): void;
	/** Drop every Opening-reading transient and the press lease; no document write. */
	clear(): void;
	/** Cancel a pending re-arm frame (task close, disposal). */
	invalidateRearm(): void;
};

export function createOpeningPlacementSession(ports: LayoutSessionPorts): OpeningPlacementSession {
	const { services, document, levelId, presenter, memory, publish } = ports;
	const openingSpan = (wallId: string) => openingSpanOf(document, wallId);

	/** Re-arm bookkeeping: a newer arm, or a task close, voids the pending frame. */
	let rearmEpoch = 0;
	/**
	 * The Opening reading's own one-operation state: one capture for preview
	 * and commit, one in-flight acceptance, and a press lease that is released
	 * on every exit path (up, cancel, reading switch, task close, dispose).
	 */
	let openingCapture: ReturnType<typeof mintLayoutIdCapture> | null = null;
	let openingCandidate: OpeningCandidate | null = null;
	let openingPreview: OpeningPreview | null = null;
	let openingNotice: string | null = null;
	let openingCommitInFlight = false;
	let openingPress: {
		readonly evaluationId: string;
		readonly lease: GestureAcquisition | null;
		readonly css: readonly [number, number];
	} | null = null;
	/**
	 * The host the Opening reading was entered from. Opening the Ink task
	 * clears the Stage selection, so Place by offset must remember the Wall
	 * (or the selected Opening's Wall) instead of re-reading a vanished one.
	 */
	let openingHostId: string | null = null;

	/** The selected host, or the captured Opening-reading host if selection is gone. */
	function currentOpeningHostId(): string | null {
		const selection = services.stage.selection();
		const selected = selection === null ? null : preferredHostOf(document, selection.sourceKind, selection.sourceId);
		const hostId = selected ?? openingHostId;
		return hostId !== null && document.walls.some((wall) => wall.id === hostId) ? hostId : null;
	}

	/**
	 * The two ghost edge points in world space for one host-relative offset.
	 * They are drawn even when the candidate overruns the Wall, so the refusal
	 * points at the same geometry the planner rejected instead of hiding it.
	 */
	function openingGhost(
		wallId: string,
		offset: number
	): readonly [LayoutVec2, LayoutVec2] | null {
		const span = openingSpan(wallId);
		if (span === null) return null;
		const { frame, length, station } = span;
		const at = (distance: number): LayoutVec2 => {
			const local = station.curved ? station.pointAt(distance) : null;
			if (local !== null) return [local.point[0], local.point[1]];
			return [
				frame.start[0] + ((frame.end[0] - frame.start[0]) / length) * distance,
				frame.start[1] + ((frame.end[1] - frame.start[1]) / length) * distance
			];
		};
		return [at(offset), at(offset + memory.openingOptions.width)];
	}

	/**
	 * Plan the exact candidate with the canonical create planner. Preview and
	 * acceptance share the minted capture, so the id the ghost implies is the id
	 * acceptance writes.
	 */
	function planOpeningCandidate(candidate: OpeningCandidate): OpeningPreview {
		const capture = openingCapture ?? mintLayoutIdCapture();
		openingCapture = capture;
		const payload: OpeningCreatePayload = {
			wallId: candidate.wallId,
			kind: memory.openingOptions.kind,
			profile: memory.openingOptions.profile,
			offset: candidate.offset,
			width: memory.openingOptions.width,
			height: memory.openingOptions.height,
			sillHeight: memory.openingOptions.sillHeight
		};
		const plan = planCreateWallFirstOpening(document, payload, capture, levelId);
		return plan.kind === 'rejected'
			? { kind: 'refused', message: openingRefusalWords(document, plan.rejection, payload) }
			: {
					kind: 'planned',
					openingId: plan.changedOpeningIds[0]!,
					document: plan.document,
					changedWallIds: plan.changedWallIds
				};
	}

	/** Re-plan the current candidate (pointer or typed) after any change. */
	function refreshOpeningPreview(): void {
		openingPreview =
			openingCandidate === null
				? null
				: !memory.openingOptionsValid
					? {
							kind: 'refused',
							message: 'Check the Opening Width, Height and Sill before placing.'
						}
					: planOpeningCandidate(openingCandidate);
	}

	/**
	 * Set the candidate and publish its planner answer. New-Opening placement
	 * is edge-positioned and deliberately unsnapped, so there is no placement
	 * snap winner to carry here.
	 */
	function setOpeningCandidate(next: OpeningCandidate | null): void {
		openingCandidate = next;
		if (next === null) {
			openingPreview = null;
			return;
		}
		openingNotice = null;
		refreshOpeningPreview();
	}

	/** Drop every Opening-reading transient; no document write. */
	function clearOpeningState(): void {
		openingCandidate = null;
		openingPreview = null;
		openingNotice = null;
		openingCapture = null;
		endOpeningPress();
	}

	function endOpeningPress(): void {
		const current = openingPress;
		openingPress = null;
		if (current?.lease?.kind === 'granted' && current.lease.lease.active) current.lease.lease.release();
	}

	/**
	 * The visible Wall face under the pointer, not just its datum line.
	 * A 3D face is a vertical quad; intersecting its span plane and keeping the
	 * hit only inside the authored height makes a click anywhere on the face
	 * name the same host and signed offset as a click at the base.
	 */
	function openingFaceAt(
		adapterContext: StageAdapterContext,
		css: readonly [number, number],
		walls: readonly ProjectedWall[]
	): OpeningCandidate | null {
		// `css` is Stage-local; the viewport ray expects viewport coordinates.
		const ray = adapterContext.ray([
			css[0] + adapterContext.evaluation.rect.left,
			css[1] + adapterContext.evaluation.rect.top
		]);
		if (ray === null) return null;
		const datum = adapterContext.snapshot.domain.datumMeters;
		const preferredWallId = adapterContext.selectionState().primary;
		const preferred =
			preferredWallId === null
				? null
				: preferredHostOf(document, preferredWallId.subject.kind, preferredWallId.subject.id);
		let best: { readonly candidate: OpeningCandidate; readonly distance: number;
		} | null = null;
		let preferredBest: { readonly candidate: OpeningCandidate; readonly distance: number;
		} | null = null;
		for (const wall of walls) {
			const data = document.walls.find((candidate) => candidate.id === wall.id);
			if (data === undefined) continue;
			const dx = wall.end[0] - wall.start[0];
			const dz = wall.end[1] - wall.start[1];
			const length = Math.hypot(dx, dz);
			if (!(length > 0)) continue;
			const hit = adapterContext.intersect(ray, {
				originMeters: [wall.start[0], datum, wall.start[1]],
				normal: [-dz / length, 0, dx / length],
				yawRadians: Math.atan2(dx, dz),
				datumMeters: datum,
				supportedLocalExtent: null
			});
			if (hit.kind !== 'intersected') continue;
			const offset =
				((hit.worldPoint[0] - wall.start[0]) * dx +
					(hit.worldPoint[2] - wall.start[1]) * dz) /
				length;
			const y = hit.worldPoint[1];
			if (offset < 0 || offset > length || y < datum || y > datum + data.height) continue;
			const candidate = { wallId: wall.id, offset };
			if (best === null || hit.distanceMeters < best.distance) {
				best = { candidate, distance: hit.distanceMeters };
			}
			if (wall.id === preferred && (preferredBest === null || hit.distanceMeters < preferredBest.distance)) {
				preferredBest = { candidate, distance: hit.distanceMeters };
			}
		}
		// Surface 3: a curved host has no chord plane to intersect. Resolve
		// the pointer's datum point to its nearest arc-length station and
		// offer that station, so placement lands on the curve rather than on
		// the chord. Straight Walls keep the ray path above unchanged.
		const datumPoint = pointerDatumPoint(adapterContext, css);
		for (const data of document.walls) {
			if (data.centerline.kind === 'line' || datumPoint === null) continue;
			const station = wallStationFrame(document, data.id);
			if (station === null) continue;
			const distance = wallStationNearPoint(document, data.id, datumPoint, 2);
			if (distance === null || distance < 0 || distance > station.length) continue;
			const local = station.pointAt(distance);
			if (local === null) continue;
			const candidate = { wallId: data.id, offset: distance };
			const proximity = Math.hypot(datumPoint[0] - local.point[0], datumPoint[1] - local.point[1]);
			if (data.id === preferred) return candidate;
			if (best === null || proximity < best.distance) best = { candidate, distance: proximity };
		}
		return (preferredBest ?? best)?.candidate ?? null;
	}
	/** The candidate one Stage-local pointer position names, or `null`. */
	function openingCandidateAt(
		adapterContext: StageAdapterContext,
		css: readonly [number, number]
	): OpeningCandidate | null {
		const projected = projectedScene(document, adapterContext);
		// The flat face solve is chord-based; a curved host's face comes from
		// the compiled Opening face path below, never from an endpoint chord.
		const face = openingFaceAt(
			adapterContext,
			css,
			projected.walls.filter((wall) => wall.path === undefined)
		);
		if (face !== null) return face;
		const primary = adapterContext.selectionState().primary;
		const hit = classifyOpeningHost({
			css,
			walls: projected.walls,
			preferredWallId:
				primary === null ? null : preferredHostOf(document, primary.subject.kind, primary.subject.id)
		});
		if (hit === null) return null;
		const wall = projected.walls.find((candidate) => candidate.id === hit.wallId);
		if (wall === undefined) return null;
		const point = pointerDatumPoint(adapterContext, css);
		if (point === null) return null;
		const offset = offsetAlongWall(wall, [point[0], point[1]]);
		return { wallId: wall.id, offset };
	}

	// New-Opening placement is **edge-positioned**: the pointer names the
	// start edge, so a slide resolver would snap a centre the creator did not
	// name (and at a non-integer width shift the edge off the pointer). Snap
	// belongs to the existing Opening slide and width marks, where the
	// resolver's centre/edge anchors are the authored gesture.

	/**
	 * A typed placement on the preferred host: empty offset centers exactly;
	 * a typed offset is used verbatim, never clamped. The planner still owns fit.
	 */
	function openingCandidateForHost(wallId: string, offsetText: string): OpeningCandidate | null {
		const span = openingSpan(wallId);
		if (span === null) {
			openingNotice = 'That Wall has no resolvable span. Repair it or select another Wall.';
			return null;
		}
		const { length } = span;
		let offset: number;
		if (offsetText.trim() === '') {
			if (memory.openingOptions.width > length) {
				openingNotice = `A ${memory.openingOptions.width.toFixed(2)} m ${memory.openingOptions.kind} is wider than the ${length.toFixed(2)} m Wall. Narrow the Opening or choose another host.`;
				return null;
			}
			offset = (length - memory.openingOptions.width) / 2;
		} else {
			const parsed = parseMeasureInput(offsetText);
			if (!parsed.ok) {
				openingNotice = `Offset: ${parsed.reason}`;
				return null;
			}
			if (parsed.value < 0) {
				openingNotice = 'Offset must be zero or greater.';
				return null;
			}
			offset = parsed.value;
		}
		return { wallId, offset };
	}

	/**
	 * Re-arm Ink after an install, on the next live evaluation.
	 *
	 * An install disposes the binding synchronously; its replacement is built on
	 * the next evaluation, so opening the task in the acceptance continuation
	 * would find no contributed task. One frame later the rebuilt task exists.
	 * The session writer generation also guards choices made on the replacement
	 * binding, including a task opened and closed before the frame runs.
	 */
	function rearmInkAfterInstall(): void {
		if (typeof window === 'undefined') return;
		const epoch = ++rearmEpoch;
		const generation = services.stage.session.writerGeneration();
		let attempts = 0;
		const open = () => {
			if (epoch !== rearmEpoch || services.stage.session.writerGeneration() !== generation ||
				services.stage.session.task() !== null) return;
			const result = services.stage.openContributedTask(LAYOUT_INK_ENTRY, 'layout');
			if (result.kind === 'refused' && result.code === 'unknown-task' && attempts < 3) {
				attempts += 1;
				window.requestAnimationFrame(open);
				return;
			}
			if (epoch !== rearmEpoch) return;
			services.stage.notifySurfaceChange();
		};
		window.requestAnimationFrame(open);
	}
	/**
	 * Accept one Opening placement exactly once.
	 *
	 * The preview's capture is the accepted intent's capture; a refusal leaves
	 * the candidate editable and writes no source.
	 */
	async function commitOpening(target: OpeningCandidate | null = openingCandidate): Promise<void> {
		if (openingCommitInFlight || target === null || memory.reading !== 'opening') return;
		if (!memory.openingOptionsValid) {
			openingNotice = 'Check the Opening Width, Height and Sill before placing.';
			services.stage.notifySurfaceChange();
			publish();
			return;
		}
		const preview = planOpeningCandidate(target);
		openingPreview = preview;
		if (preview.kind === 'refused') {
			openingNotice = preview.message;
			services.stage.notifySurfaceChange();
			publish();
			return;
		}
		openingCommitInFlight = true;
		const taskChoice = services.stage.session.taskChoiceGeneration();
		try {
			const capture = openingCapture ?? mintLayoutIdCapture();
			openingCapture = capture;
			const snapshot = services.stage.snapshot();
			const payload: OpeningCreatePayload = {
				wallId: target.wallId,
				kind: memory.openingOptions.kind,
				profile: memory.openingOptions.profile,
				offset: target.offset,
				width: memory.openingOptions.width,
				height: memory.openingOptions.height,
				sillHeight: memory.openingOptions.sillHeight
			};
			const outcome = await services.authoring.accept(
				openingCreateIntent({
					payload,
					capture,
					operationId: globalThis.crypto.randomUUID(),
					projectId: snapshot.acceptedRevision.projectId,
					revisionId: services.authoring.acceptedRevision().revisionId,
					contentRevision: stageUnitRevision(snapshot, 'layout'),
					levelId: snapshot.domain.layoutLevelId
				})
			);
			if (outcome.kind === 'refused') {
				openingNotice = outcome.message;
				services.stage.notifySurfaceChange();
				publish();
				return;
			}
			const shouldRearm = services.stage.session.taskChoiceGeneration() === taskChoice &&
				services.stage.session.task() === null;
			const openingId = preview.openingId;
			clearOpeningState();
			ports.select('opening', openingId);
			// The install replaced the binding; re-arm Ink on the next evaluation
			// against the installed source, on the remembered Opening reading.
			if (shouldRearm) rearmInkAfterInstall();
			services.stage.notifySurfaceChange();
		} finally {
			openingCommitInFlight = false;
		}
	}

	/** The Opening half of the pointer contract. */
	function openingPointer(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext
	): boolean {
		if (intent.phase === 'down') {
			if (!memory.openingOptionsValid) {
				openingNotice = 'Check the Opening Width, Height and Sill before placing.';
				setOpeningCandidate(null);
				services.stage.notifySurfaceChange();
				publish();
				return true;
			}
			const candidate = openingCandidateAt(adapterContext, intent.css);
			if (candidate === null) {
				openingNotice = 'Aim at a Wall face to place an Opening; the Stage is not a free host.';
				setOpeningCandidate(null);
				services.stage.notifySurfaceChange();
				publish();
				return true;
			}
			const acquisition = services.stage.acquireGesture({
				owner: LAYOUT_INK_TASK,
				evaluationId: intent.evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (acquisition.kind !== 'granted') {
				openingNotice = `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`;
				publish();
				return false;
			}
			openingPress = {
				evaluationId: intent.evaluationId,
				lease: acquisition,
				css: intent.css
			};
			setOpeningCandidate(candidate);
			services.stage.notifySurfaceChange();
			publish();
			return true;
		}
		const current = openingPress;
		if (current === null) return false;
		if (intent.phase === 'cancel' || intent.evaluationId !== current.evaluationId) {
			endOpeningPress();
			setOpeningCandidate(null);
			openingNotice =
				intent.phase === 'cancel' ? null : 'The reading changed; aim again on the Wall.';
			services.stage.notifySurfaceChange();
			publish();
			return true;
		}
		if (intent.phase === 'move') {
			const candidate = openingCandidateAt(adapterContext, intent.css);
			if (candidate === null) {
				openingNotice = 'Aim at a Wall face to place an Opening.';
				setOpeningCandidate(null);
			} else {
				setOpeningCandidate(candidate);
			}
			services.stage.notifySurfaceChange();
			publish();
			return true;
		}
		// Release: one click commits the candidate under the pointer, once.
		const rawRelease = openingCandidateAt(adapterContext, intent.css);
		endOpeningPress();
		if (rawRelease === null) {
			openingNotice = 'Aim at a Wall face to place an Opening.';
			setOpeningCandidate(null);
		} else {
			setOpeningCandidate(rawRelease);
			void commitOpening(rawRelease);
		}
		services.stage.notifySurfaceChange();
		publish();
		return true;
	}

	/** Preview the candidate under an unpressed hover; never claims the move. */
	function openingHover(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext
	): boolean {
		if (!ports.inkTaskOpen() || memory.reading !== 'opening' || intent.phase !== 'move') {
			return false;
		}
		const candidate = openingCandidateAt(adapterContext, intent.css);
		if (candidate?.wallId === openingCandidate?.wallId && candidate?.offset === openingCandidate?.offset) {
			return true;
		}
		setOpeningCandidate(candidate);
		services.stage.notifySurfaceChange();
		publish();
		return true;
	}

	/**
	 * The Opening reading's live candidate: the planner's own candidate document
	 * through the existing compile + Paper path, or the refused attempt at its raw
	 * values with the planner's words. Nothing is persisted.
	 */
	function previews(adapterContext: StageAdapterContext, y: number): readonly StageCandidatePreview[] {
		const world = (point: readonly [number, number], elevation = y): [number, number, number] => [point[0], elevation, point[1]];
		if (memory.reading === 'opening') {
			if (openingPreview?.kind === 'planned') {
				const subjectIds = new Set([openingPreview.openingId, ...openingPreview.changedWallIds]);
				const geometry = adapterContext.evaluation.settledReading === 'plan'
					? ports.candidatePaper(openingPreview.document, y, subjectIds, new Set())?.paper.subject ?? null
					: ports.openingFace(openingPreview.document, new Set([openingPreview.openingId]), y);
				if (geometry !== null) {
					const ghost = openingCandidate === null ? null : openingGhost(openingCandidate.wallId, openingCandidate.offset);
					return [candidatePreviewOf({
						id: 'layout-candidate-opening',
						role: 'subject',
						geometry,
						labels: ghost === null ? [] : [{ world: world(ghost[1]), text: `Width ${memory.openingOptions.width.toFixed(3)} m` }]
					})];
				}
			}
			const refusedWords =
				openingNotice ?? (openingPreview?.kind === 'refused' ? openingPreview.message : null);
			if (openingCandidate !== null && refusedWords !== null) {
				const ghost = openingGhost(openingCandidate.wallId, openingCandidate.offset);
				const values = {
					kind: memory.openingOptions.kind,
					profile: memory.openingOptions.profile,
					offset: openingCandidate.offset,
					width: memory.openingOptions.width,
					height: memory.openingOptions.height,
					sillHeight: memory.openingOptions.sillHeight
				};
				const geometry = presenter.attempt(
					adapterContext.evaluation.settledReading === 'plan' ? 'plan' : 'face',
					document,
					openingCandidate.wallId,
					values,
					y
				);
				return [candidatePreviewOf({
					id: 'layout-candidate-opening-refused',
					role: 'refused',
					geometry,
					...(ghost === null ? {} : { labels: [{ world: world(ghost[0]), text: refusedWords }] })
				})];
			}
			return [];
		}
		return [];
	}

	/**
	 * The host-relative Opening ghost: two edges, the live offset/width and the
	 * planner's refusal words. The edges are drawn even when the candidate
	 * overruns the Wall, so refusal points at what the planner rejected.
	 */
	function openingOverlay(
		adapterContext: StageAdapterContext
	): ReturnType<NonNullable<StageAdapterBinding['overlay']>> {
		const markers: { id: string; css: readonly [number, number]; label: string;
		}[] = [];
		const y = adapterContext.snapshot.domain.datumMeters;
		const project = (point: readonly [number, number]) =>
			adapterContext.project([point[0], y, point[1]]);
		const candidate = openingCandidate;
		const ghost = candidate === null ? null : openingGhost(candidate.wallId, candidate.offset);
		const start = ghost === null ? null : project(ghost[0]);
		const mark = (id: string, css: readonly [number, number] | null, label: string) => {
			if (css !== null) markers.push({ id, css, label });
		};
		if (candidate !== null) {
			mark(
				'layout-opening-start',
				start,
				`Opening start — offset ${candidate.offset.toFixed(3)} m on Wall ${candidate.wallId}`
			);
			mark('layout-opening-end', ghost === null ? null : project(ghost[1]), `Opening end — ${memory.openingOptions.width.toFixed(3)} m wide`);
		}
		const refusal =
			openingNotice ?? (openingPreview?.kind === 'refused' ? openingPreview.message : null);
		if (refusal !== null) {
			// Overlay contributions are viewport CSS; only the no-ghost fallback
			// carries a raw Stage-local pointer point, so translate that one here.
			const press = openingPress;
			const fallback =
				press === null
					? null
					: ([press.css[0] + adapterContext.evaluation.rect.left, press.css[1] + adapterContext.evaluation.rect.top] as const);
			mark('layout-opening-refusal', start ?? fallback, refusal);
		}
		return markers;
	}
	function paletteView(): NonNullable<InkPaletteSnapshot['opening']> {
		const selectedHostId = currentOpeningHostId();
		const hostId = openingCandidate?.wallId ?? selectedHostId;
		return {
			hostId,
			selectedHostId,
			offset: openingCandidate?.offset ?? null,
			width: memory.openingOptions.width,
			height: memory.openingOptions.height,
			sillHeight: memory.openingOptions.sillHeight,
			kind: memory.openingOptions.kind,
			profile: memory.openingOptions.profile,
			canPlace: openingPreview?.kind === 'planned',
			refusal:
				openingNotice ??
				(openingPreview?.kind === 'refused' ? openingPreview.message : null)
		};
	}

	return {
		pointer: openingPointer,
		hover: openingHover,
		previews,
		overlay: openingOverlay,
		paletteView,
		setOptions(options) {
			memory.openingOptionsValid = options !== null;
			if (options !== null) memory.openingOptions = { ...options, profile: options.profile ?? 'rectangular' };
			if (openingCandidate !== null) refreshOpeningPreview();
			services.stage.notifySurfaceChange();
			publish();
		},
		placeAtOffset(offsetText) {
			const hostId = currentOpeningHostId();
			if (hostId === null) {
				openingNotice = 'Select a Wall — or one of its Openings — before placing by offset.';
				publish();
				return;
			}
			const candidate = openingCandidateForHost(hostId, offsetText);
			if (candidate === null) {
				publish();
				return;
			}
			setOpeningCandidate(candidate);
			void commitOpening(candidate);
		},
		captureHost() {
			openingHostId = currentOpeningHostId() ?? openingHostId;
		},
		clear: clearOpeningState,
		invalidateRearm() {
			rearmEpoch += 1;
		}
	};
}
