import { selectedRegion, selectedRoomLabel } from './layout-subjects';
import { layoutMarkDescriptors, type ActiveKnot, type LayoutMarkState } from './layout-marks';
import { layoutDeletionPreview } from './layout-deletion-preview';
import { layoutCardActions } from './layout-card-actions';
import { previewCoordinates, type SettledLayoutRefusal } from './manipulation-support';
import { regionWallRelations } from '@portfolio/layout-core/room';
import { candidatePreviewOf } from './candidate-preview';
import { restingObjectsOnFloorRegion } from './region-resting';
import type { StageCandidatePreview } from '$lib/authoring/stage/stage-adapter-host';
import { resolveLayoutSurface, spacePaintReading, wallSideAt, type LayoutSurfaceRef } from '@portfolio/layout-core/plan';
import { isClosedWall, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';

import {
	type StageAdapterBinding,
	type StageAdapterContext,
	type StageCardActionOutcome,
	type StageCardSubject,
	type StageGuideContribution,
	type StagePaintAnswer,
	type StagePaintSpaceScope
} from '$lib/authoring/stage/stage-adapter-host';
import type { StageHeightTick } from '$lib/authoring/stage/stage-adapter-host';

import LayoutInkPalette from './LayoutInkPalette.svelte';
import LayoutPlacementInstrument from './LayoutPlacementInstrument.svelte';
import LayoutCardFields from './LayoutCardFields.svelte';
import LayoutRegionCard from './LayoutRegionCard.svelte';
import LayoutRoomCard from './LayoutRoomCard.svelte';
import { independentWallOverlapGuides } from './room-overlap-cue';
import {
	type WallDeletionPreview
} from './drawing-planners';
import { LAYOUT_ROOM_DUPLICATE_KIND } from './room-duplicate-planners';
import {
	layoutRegionNameTarget,
} from './region-planners';
import type { RegionEdgePick } from './session-ports';
import { LAYOUT_INK_ENTRY, LAYOUT_INK_TASK } from './ink';
import type { StageHandleDescriptor } from '$lib/authoring/stage/stage-adapter-host';
import { curvedWallFrame, } from './precision-frames';
import { layoutFacts, layoutRoomFacts, layoutCardFieldIds } from './precision-facts';
import { LAYOUT_PLINTH_PLACE_KIND, layoutSubjectOf, } from './precision';
import { layoutNameTarget, layoutRoomNameTarget } from './adapter-support';
import type { LayoutSessionPorts } from './session-ports';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import {
	selectedWall,
	selectedOpening,
} from './layout-subjects';

const LAYOUT_PLINTH_ENTRY = 'layout-place-plinth';

function _roomDuplicateCount(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

type ContributionPorts = {
	readonly services: StageAdapterServices;
	readonly context: StageAdapterContext;
	readonly document: LayoutDocumentWallFirst;
	readonly levelId: string;
	readonly deletionDisclosures: Map<string, WallDeletionPreview>;
	readonly selectLayoutSubject: LayoutSessionPorts['select'];
	readonly readActiveKnot: () => ActiveKnot | null;
	readonly requestRoomDuplicate: (roomId: string) => StageCardActionOutcome;
	readonly removeSelectedKnot: (
		wallId: string
	) => Promise<StageCardActionOutcome> | StageCardActionOutcome;
	readonly regionEdgePick: RegionEdgePick;
};

export function createLayoutContributions({
	services,
	context,
	document,
	levelId,
	deletionDisclosures,
	selectLayoutSubject,
	readActiveKnot,
	requestRoomDuplicate,
	removeSelectedKnot,
	regionEdgePick
}: ContributionPorts) {
	/**
	 * A5 — the derived **overlaps, not joined** cue. One query over this
	 * binding's accepted document, computed once and projected by the host with
	 * every other guide. Presentation only: it is never authored, planned,
	 * serialized or written to history, and it cannot be pressed.
	 */
	let overlapGuides: readonly StageGuideContribution[] | null = null;
	function guides(): readonly StageGuideContribution[] {
		if (overlapGuides === null) {
			overlapGuides = independentWallOverlapGuides(
				document,
				context.snapshot.domain.datumMeters
			);
		}
		return overlapGuides;
	}

	/**
	 * The marks a selected Wall or Opening publishes.
	 *
	 * Every descriptor names a real fact and the exact planner the Card field
	 * submits; the host admits it, owns disclosure and draws it. Values are the
	 * live candidate while a gesture is held, otherwise the accepted value.
	 */
	/* --- Delete with consequences ------------------------------------- */

	/**
	 * The deletion disclosure for one Wall, from the canonical planner.
	 *
	 * The same call the acceptance makes, so the words the creator reads and
	 * the change that lands cannot disagree; it is a planning pass, so the
	 * answer is remembered for this (content, Wall) pair.
	 */
	function inkInstrument(
		contributed: { readonly label: string; readonly summary: string } | null,
		reading: string
	): NonNullable<ReturnType<NonNullable<StageAdapterBinding['instrument']>>> {
		return {
			presentation: 'palette',
			summary:
				contributed !== null
					? `Ink · ${contributed.label}`
					: reading === 'room'
						? 'Ink · Room'
						: reading === 'opening'
							? 'Ink · Opening'
							: 'Ink',
			facts:
				contributed !== null
					? [
							{ label: 'Reading', value: contributed.label },
							{ label: 'Meaning', value: contributed.summary }
						]
					: reading === 'room'
						? [{ label: 'Reading', value: 'Open Space from partial Walls' }]
						: reading === 'opening'
							? [
									{ label: 'Reading', value: 'Opening on a Wall face' },
									{
										label: 'Host',
										value: 'Aim at a Wall; a selected host wins a tie'
									}
								]
							: [
									{ label: 'Reading', value: 'Straight Wall' },
									{
										label: 'Finish',
										value: 'Enter · Close ring from the start point · Esc cancels the chain'
									}
								],
			view: { component: LayoutInkPalette, services }
		};
	}

	function plinthInstrument() {
		return {
			summary: 'Place plinth',
			facts: [
				{ label: 'Floor datum', value: `${document.floor.elevation} m` },
				{ label: 'Creates', value: 'One ordinary Layout box' }
			],
			view: { component: LayoutPlacementInstrument, services }
		};
	}

	const markDescriptors = (
		adapterContext: StageAdapterContext,
		state: LayoutMarkState,
		taskOpen: boolean
	): readonly StageHandleDescriptor[] =>
		layoutMarkDescriptors({ services, document, adapterContext, state, taskOpen });
	const deletionPreview = (wallId: string): WallDeletionPreview =>
		layoutDeletionPreview({ context, document, levelId, deletionDisclosures, wallId });

	const contributions = {
		hostTools: ['erase', 'measure', 'paint'],
		/**
		 * Face Paint names the surface identity from the exact 3D triangle, the
		 * Region face it carries, or Layout's signed lateral reading of a Plan Wall
		 * hit. Space membership is also Layout-owned and expands to every member
		 * surface: Wall sides, floor, a present lid and wholly-contained Regions.
		 */
		paintAnswer(hit, reading): StagePaintAnswer {
			let surface: LayoutSurfaceRef | null = null;
			if (hit.sourceKind === 'wall') {
				const componentId = hit.subRef?.kind === 'component' ? hit.subRef.componentId : null;
				const taggedSide = componentId?.match(/^side:(left|right)$/)?.[1];
				const side = taggedSide === 'left' || taggedSide === 'right'
					? taggedSide
					: reading === 'plan'
						? wallSideAt(context.snapshot.domain.geometry, hit.sourceId, [hit.worldPoint[0], hit.worldPoint[2]])
						: null;
				if (side === null) return { kind: 'refused', message: 'This part of a wall can’t be painted.' };
				surface = { kind: 'wall-side', wallId: hit.sourceId, side };
			} else if (hit.sourceKind === 'room-floor') {
				surface = { kind: 'room-floor', roomId: hit.sourceId };
			} else if (hit.sourceKind === 'room-lid') {
				surface = { kind: 'room-lid', roomId: hit.sourceId };
			} else if (hit.sourceKind === 'region') {
				const face = hit.subRef?.kind === 'component' ? hit.subRef.componentId : null;
				if (face !== 'top' && face !== 'underside') {
					return { kind: 'refused', message: 'This part of a region can’t be painted.' };
				}
				surface = { kind: 'region-face', regionId: hit.sourceId, face };
			} else {
				return { kind: 'refused', message: 'That surface can’t be painted.' };
			}
			if (resolveLayoutSurface(document, surface) !== 'present') {
				return { kind: 'refused', message: 'That surface changed. Try again.' };
			}
			// One compiled reading answers both questions: this surface's Space and
			// that Space's whole Paint scope.
			const { membership, scope } = spacePaintReading(document, surface);
			const space: StagePaintSpaceScope =
				membership.kind === 'unique'
					? {
							kind: 'unique', roomId: membership.roomId,
							surfaces: scope.surfaces, excluded: scope.excluded
						}
					: membership;
			return { kind: 'paintable-surface', surface, space };
		},
		guides,
		/**
		 * The Eraser reuses the Card's own delete for a Wall or an Opening — the
		 * same planner-derived disclosure and the same one F4 entry. Every other
		 * Layout subject was already refused, in Layout's words, by the pick.
		 */
		eraseAction(hit): ReturnType<NonNullable<StageAdapterBinding['eraseAction']>> {
			if (hit.sourceKind !== 'wall' && hit.sourceKind !== 'opening' && hit.sourceKind !== 'region') {
				return { kind: 'refused', message: 'That Layout subject cannot be erased.' };
			}
			const action = contributions
				.cardActions({ sourceId: hit.sourceId, sourceKind: hit.sourceKind, ref: null })
				.find((candidate) => candidate.destructive === true);
			if (action === undefined)
				return { kind: 'refused', message: 'That Layout subject cannot be erased.' };
			// A Wall that hosts Openings or changes Rooms has consequences beyond
			// itself; its existing disclosure is read before the second click runs it.
			const preview = hit.sourceKind === 'wall' ? deletionPreview(hit.sourceId) : null;
			// A floor region's derived resting-object count is disclosed before the
			// second click; it is a read, never a Scene write.
			const regionResting =
				hit.sourceKind === 'region'
					? restingObjectsOnFloorRegion(context.snapshot, hit.sourceId)
					: 0;
			const confirm =
				regionResting > 0 ||
				(preview?.kind === 'planned' &&
					(preview.hostedOpeningIds.length > 0 ||
						preview.retiredRoomIds.length > 0 ||
						preview.createdRoomIds.length > 0 ||
						preview.openedRoomIds.length > 0 ||
						preview.keptOpenRoomIds.length > 0));
			return { kind: 'action', action, confirm };
		},
		tasks: [
			{
				id: LAYOUT_INK_TASK,
				taskKind: LAYOUT_INK_TASK,
				label: 'Ink',
				order: 0
			},
			{
				id: 'layout-place-plinth',
				taskKind: LAYOUT_PLINTH_PLACE_KIND,
				label: 'Place plinth',
				order: 10
			},
			// A4 — a procedure invoked by the Room Card, never a dock tool and
			// never an Index entry: no armable mode is added to the tool strip.
			{
				id: LAYOUT_ROOM_DUPLICATE_KIND,
				taskKind: LAYOUT_ROOM_DUPLICATE_KIND,
				label: 'Duplicate room',
				order: 20
			}
		],
		findEntries: [
			{
				id: LAYOUT_INK_ENTRY,
				taskKind: LAYOUT_INK_TASK,
				label: 'Ink · Wall',
				railFamily: 'draw',
				capability: 'layout',
				// Ink is an armable **dock** tool: it is armed from the bottom dock
				// (and found by name in the Head), not listed as an Index task.
				home: 'dock',
				slot: 'ink',
				order: 0
			},
			{
				id: LAYOUT_PLINTH_ENTRY,
				taskKind: LAYOUT_PLINTH_PLACE_KIND,
				label: 'Place plinth',
				railFamily: 'place',
				capability: 'layout',
				order: 10
			}
		],
		cardFacts(cardSubject: StageCardSubject) {
			if (cardSubject.sourceKind === 'room' || cardSubject.sourceKind === 'room-floor') {
				return layoutRoomFacts(document, context.snapshot.domain.geometry, cardSubject.sourceId);
			}
			const subject = layoutSubjectOf({
				sourceKind: cardSubject.sourceKind,
				sourceId: cardSubject.sourceId
			});
			if (subject === null) return [];
			const facts = [...layoutFacts(document, subject)];
			const activeKnot = readActiveKnot();
			// The approved Card reads a curved Wall's arc length and bend-point
			// count, and names the active bend point when one is selected. Straight
			// Walls keep exactly their existing facts.
			const source =
				subject.kind === 'wall' ? document.walls.find((wall) => wall.id === subject.id) : undefined;
			if (source?.centerline.kind === 'cubic-chain' && !isClosedWall(source)) {
				const frame = curvedWallFrame(document, source.id);
				if (frame !== null) {
					facts.push({
						label: 'Length (arc)',
						value: `${frame.length.toFixed(3)} m`,
						fieldId: 'arcLength'
					});
				}
				facts.push({
					label: 'Bend points',
					value: String(source.centerline.knots.length),
					fieldId: 'bendPoints'
				});
				const activeIndex =
					activeKnot?.wallId === source.id
						? source.centerline.knots.findIndex((knot) => knot.id === activeKnot!.knotId)
						: -1;
				if (activeIndex >= 0) {
					facts.push({
						label: 'Active bend point',
						value: `${activeIndex + 1} of ${source.centerline.knots.length}`,
						fieldId: 'activeBendPoint'
					});
				}
			}
			return facts;
		},
		cardName(cardSubject: StageCardSubject) {
			if (cardSubject.sourceKind === 'room' || cardSubject.sourceKind === 'room-floor') {
				return layoutRoomNameTarget(services, cardSubject.sourceId);
			}
			if (cardSubject.sourceKind === 'region') {
				return layoutRegionNameTarget(services, cardSubject.sourceId);
			}
			const subject = layoutSubjectOf({
				sourceKind: cardSubject.sourceKind,
				sourceId: cardSubject.sourceId
			});
			// A Layout object's name is its identity, so it owns no writer.
			if (subject === null || subject.kind === 'object') return null;
			return layoutNameTarget(services, subject);
		},
		/**
		 * The Card's ordinary-field writer: the migrated Dimensions fields, in the
		 * one place Round 2 names. It is the only writer for those facts — the
		 * Dimensions task and its Find/keyboard route are retired in this cutover.
		 */
		cardWriter(cardSubject: StageCardSubject) {
			if (cardSubject.sourceKind === 'room' || cardSubject.sourceKind === 'room-floor') {
				// U4: a Room's Floor and Ceiling Finishes. It writes no Layout field,
				// so every Room fact stays a Card fact.
				return {
					summary: 'Room surfaces',
					fieldIds: [],
					view: { component: LayoutRoomCard, services }
				};
			}
			if (cardSubject.sourceKind === 'region') {
				return {
					summary: 'Region fields',
					fieldIds: ['elevation', 'thickness', 'width', 'depth'],
					view: { component: LayoutRegionCard, services }
				};
			}
			const subject = layoutSubjectOf({
				sourceKind: cardSubject.sourceKind,
				sourceId: cardSubject.sourceId
			});
			if (subject === null) return null;
			// The writer edits every writable field except the name, which the Card
			// header's rename writer owns. Those fields are not repeated as facts.
			return {
				summary: subject.kind === 'wall' ? 'Wall fields' : 'Opening fields',
				fieldIds: layoutCardFieldIds(document, subject),
				view: { component: LayoutCardFields, services }
			};
		},
		/**
		 * Scoped deletes. The Wall action discloses hosted Openings and Room
		 * consequences; the Opening action removes exactly that Opening and
		 * returns the host Wall to the selection.
		 */
		cardActions: (cardSubject: StageCardSubject) =>
			layoutCardActions(
				{ services, context, document, levelId, requestRoomDuplicate, removeSelectedKnot, regionEdgePick, deletionPreview, selectLayoutSubject, readActiveKnot },
				cardSubject
			),
		heightTicks(): readonly StageHeightTick[] {
			const datum = context.snapshot.domain.datumMeters;
			const ticks: StageHeightTick[] = [{ kind: 'datum', heightMeters: 0, label: 'Floor' }];
			// Authored regions are drawn surfaces: a Terrace's top and a Flat Roof's
			// underside are real heights a later region or a Wall can snap to.
			for (const region of context.snapshot.domain.geometry.regions) {
				const authored = document.regions.find((candidate) => candidate.id === region.regionId);
				const heightMeters = (region.role === 'floor' ? region.topY : region.bottomY) - datum;
				if (!Number.isFinite(heightMeters) || heightMeters <= 0) continue;
				ticks.push({
					kind: 'found',
					heightMeters,
					label: `${region.role === 'floor' ? 'Terrace' : 'Flat Roof'} ${authored?.name ?? region.regionId}`
				});
			}
			for (const object of document.objects) {
				if (object.kind !== 'box' && object.kind !== 'cylinder') continue;
				// A top tilted away from horizontal is not a surface the Plan cut can
				// snap to; the owner publishes only its real horizontal tops.
				if (Math.abs(object.rotation[0]) > 1e-6 || Math.abs(object.rotation[2]) > 1e-6) continue;
				const top = object.position[1] + object.dimensions[1] / 2;
				const heightMeters = top - datum;
				if (!Number.isFinite(heightMeters) || heightMeters <= 0) continue;
				ticks.push({
					kind: 'found',
					heightMeters,
					label: `${object.kind === 'box' ? 'Box' : 'Cylinder'} ${object.id}`
				});
			}
			return ticks;
		}
	} satisfies Partial<StageAdapterBinding>;
	/**
	 * The selected Region's measured gaps.
	 *
	 * Relations are the derived authority and already carry the measure; this
	 * function only places the ink. A gap is a dimension between the footprint's
	 * nearest corner and the related Wall's nearest compiled sample, at the slab's
	 * own elevation (horizontal) or across the vertical clearance. An unselected
	 * Region draws no cue, which is why this reads the selection first.
	 */
	function regionGapPreviews(
		adapterContext: StageAdapterContext
	): readonly StageCandidatePreview[] | null {
		const selected = selectedRegion(document, adapterContext);
		if (selected === null) return null;
		const geometry = adapterContext.snapshot.domain.geometry;
		const relations = regionWallRelations(geometry, selected.region);
		if (relations.kind !== 'relations') return null;
		const gaps = relations.relations.filter(
			(relation) => relation.reading === 'gap' && relation.measureMeters !== null
		);
		if (gaps.length === 0) return null;
		const previews: StageCandidatePreview[] = [];
		for (const relation of gaps) {
			// The relation owns the pair its measure is read from: a corner-to-centerline
			// chord would be longer than the labelled Wall-body gap, and a vertical
			// segment from the slab top would be longer than the underside measure.
			const segment = relation.measureSegment;
			if (segment === null) continue;
			const text = `Gap ${relation.measureMeters!.toFixed(2)} m${relation.intended ? ' · intended' : ''}`;
			previews.push(
				candidatePreviewOf({
					id: `layout-region-gap:${relation.wallId}`,
					role: 'affected',
					geometry: {
					polygons: [],
					segments: [
						[
							[segment.from[0], segment.from[1], segment.from[2]],
							[segment.to[0], segment.to[1], segment.to[2]]
						]
					]
				},
					labels: [
						{
							world: [
								(segment.from[0] + segment.to[0]) / 2,
								(segment.from[1] + segment.to[1]) / 2,
								(segment.from[2] + segment.to[2]) / 2
							],
							text
						}
					]
				})
			);
		}
		return previews.length === 0 ? null : previews;
	}

	function settledPreviews(
		adapterContext: StageAdapterContext,
		y: number,
		settledRefusal: SettledLayoutRefusal | null
	): readonly StageCandidatePreview[] | null {
		const { world } = previewCoordinates(y);
		// The reason a refused release did not write outlives the gesture; the
		// tag stays until the next press, with no geometry and no history.
		if (
			settledRefusal !== null &&
			settledRefusal.contentRevision === adapterContext.snapshot.domain.unitRevisions.layout &&
			(settledRefusal.subject.kind === 'junction' ||
				(settledRefusal.subject.kind === 'wall'
					? selectedWall(adapterContext)?.frame.wallId === settledRefusal.subject.wallId
					: settledRefusal.subject.kind === 'room'
						? selectedRoomLabel(adapterContext)?.roomId === settledRefusal.subject.roomId
						: settledRefusal.subject.kind === 'region'
							? selectedRegion(document, adapterContext)?.region.id === settledRefusal.subject.regionId
							: selectedOpening(document, adapterContext)?.openingId === settledRefusal.subject.openingId))
		) {
			return [
				candidatePreviewOf({
					id: 'layout-candidate-refused-settled',
					role: 'refused',
					geometry: settledRefusal.geometry ?? { polygons: [], segments: [] },
					labels: [{ world: world(settledRefusal.point), text: settledRefusal.text }]
				})
			];
		}

		const gaps = regionGapPreviews(adapterContext);
		if (gaps !== null) return gaps;
		return null;
	}

	return { ...contributions, markDescriptors, inkInstrument, plinthInstrument, settledPreviews };
}
