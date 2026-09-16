<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import type { SceneDocument, SceneEntity } from '$lib/content/scene';
	import type { LayoutRoomRegistry } from '$lib/project/project-layout-semantics';
	import type { Vec3 } from '$lib/types/scene';
	import type { LayoutPreviewModel } from './layout-mesh-factory';
	import {
		resolveEditorCommandIntent,
		resolveEditorPlatform,
		type EditorCommandId,
		type EditorModifierSnapshot
	} from '../editor-command-intent';
	import {
		addPolygonPoint,
		advanceWallChainContinuation,
		architectureEditAllowedKinds,
		architectureEditExcludePoints,
		architectureEditExclusionOwners,
		architectureEditRawTarget,
		beginLayoutArchitectureEdit,
		beginLayoutObjectDrag,
		beginLayoutObjectRotateDrag,
		beginLayoutRoomUnitDrag,
		beginLayoutPrimitiveDraft,
		beginLayoutPresetDraft,
		beginRectangle,
		beginRoomEdit,
		beginWallChain,
		cancelLayoutArchitectureEdit,
		cancelLayoutObjectDrag,
		cancelLayoutRoomUnitDrag,
		cancelLayoutPrimitiveDraft,
		cancelLayoutPresetDraft,
		cancelRoomEdit,
		cancelWallChainRun,
		captureWallChainRun,
		clearLayoutDraft,
		clearLayoutSelection,
		hasWallChainRun,
		restoreWallChainRun,
		beginLayoutWallOpeningDrag,
		cancelLayoutWallOpeningDrag,
		selectLayoutInteriorAnchor,
		selectLayoutJunction,
		selectLayoutObject,
		selectLayoutOpening,
		selectLayoutPhysicalWall,
		selectLayoutRoom,
		selectLayoutWall,
		selectLayoutWallOpening,
		updateLayoutWallOpeningDrag,
		updateLayoutArchitectureEdit,
		markLayoutArchitectureEditValidity,
		setArrangeOwner,
		setLayoutDraftTool,
		type LayoutDraftTool,
		removeLastPolygonPoint,
		updateWallChainCursor,
		resolveArrangeScenePick,
		isLayoutPresetTool,
		wallChainRoleForTool,
		shouldBeginWallBend,
		updateRectangle,
		updateLayoutObjectDrag,
		updateLayoutRoomUnitDrag,
		updateLayoutPrimitiveDraft,
		updateRoomEdit,
		deriveArrangeTarget,
		primitiveDraftCenter,
		rectanglePoints,
		type LayoutArchitectureEditGesture,
		type LayoutInteractionState,
		type LayoutWallOpeningDrag,
		type LayoutWallOpeningDragMode
	} from './layout-interaction';
	import type { LayoutPreviewState } from './layout-preview-state.svelte';
	import {
		captureLayoutPreviewSnapshot,
		commitLayoutPrimitive,
		commitLayoutObjectPreset,
		commitLayoutRoomEdit,
		previewLayoutRoomUnit,
		previewWallFirstRoomMove,
		wallFirstRoomMoveEligibility,
		deleteLayoutObject,
		deleteLayoutWallInteriorAnchor,
		deleteWallFirstOpening,
		insertLayoutWallInteriorAnchor,
		restoreLayoutPreviewSnapshot,
		updateLayoutObjectFields,
		updateLayoutRoomFields,
		updateLayoutWallInteriorAnchor,
		updateLayoutOpeningFields,
		updateWallFirstOpening,
		updateWallFirstJunction,
		updateWallFirstWallBend,
		updateWallFirstWallCurveKnot,
		updateWallFirstWallMove,
		createWallFirstOpening,
		type LayoutPreviewSnapshot,
		type LayoutRoomEditResult
	} from './layout-preview-state.svelte';
	import {
		snapSegmentOffset,
		LAYOUT_PLAN_HIT_RADIUS_PX,
		type LayoutOpeningKind
	} from './layout-opening-editing';
	import {
		compiledPhysicalWallLength,
		compiledWallLength,
		findPlanHitRoom,
		projectPointToPhysicalWall,
		projectPointToWall,
		resolvePlanHit
	} from './plan-hit';
	import {
		constrainToAngle,
		framePlanViewport,
		panPlanViewport,
		planScreenToWorld,
		setPlanViewportSize,
		zoomPlanViewport
	} from './layout-plan-transform';
	import type { LayoutRoom, LayoutVec2 } from '$lib/layout/layout-types';
	import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
	import { p2311Measure } from '$lib/layout/layout-wall-first-precision';
import { referenceFor } from '$lib/layout/layout-identity';
	import { layoutRoomUnitPivot } from './layout-room-transform';
	import { buildPlanRenderModel } from '$lib/layout/plan-render-model';
	import type { PlanCurveControlCandidate } from './plan-hit';
	import type { PlanHitIdentity } from '$lib/layout/plan-render-model';
	import { buildPlanSceneFootprintProjection } from './plan-scene-footprint';
	import { resolvePlanSceneHitAtZoom, PLAN_SCENE_HIT_HALO_PX } from './plan-scene-hit';
	import { resolveArrangeHit } from './arrange-hit';
	import type { EditorStore } from '../editor-store.svelte';
	import type { EditorContextMenuStore } from '../context-menu/context-menu-state.svelte';
	import { isEditableTarget } from '../context-menu/editable-target';
	import {
		buildArrangeContextMenuItems,
		buildPlanLayoutContextMenuItems
	} from '../context-menu/plan-menu-items';
	import {
		capturePlanSceneTransformMembers,
		planSceneWorldPivot,
		rotatePlanSceneMembers,
		translatePlanSceneMembers,
		type PlanSceneTransformMember,
		type PlanSceneTransformPatch
	} from './plan-scene-transform';
	import type { PlanViewMode } from './layout-interaction';
	import {
		JUNCTION_HANDLES_MIN_PX_PER_M,
		buildPlanInteractionProjection,
		physicalWallSpan,
		planHandleScreenPoints,
		presetIdForTool,
		rotationHandleScreenPoint,
		wallOpeningEdgeWorldPoints,
		withArchitectureEditIntent,
		withArrangeHoverOutline,
		withLayoutSnapFeedback,
		withPlanObjectRotationHandle,
		withPlanSceneRotationHandle,
		yawFeedbackText
	} from './plan-overlays';
	import {
		LAYOUT_PLAN_GRID_STEP,
		layoutArchitecturalPreset,
		resolveLayoutSnap,
		resolveOpeningDragSnap,
		resolveOpeningDragSnapUseMode,
		snapOwnerKey,
		wallOwnerKey,
		type LayoutArchitecturalPresetId,
		type OpeningDragAnchor,
		type SnapFeatureKind,
		type SnapInputContext,
		type SnapResolution
	} from '@portfolio/layout-core';
	import {
		releaseArchitectureEdit,
		restoreTransientArchitectureBaseline,
		transientArchitectureEdit,
		type LayoutTransientArchitectureEdit
	} from './layout-transient-edit';
	import { wallFirstWallLength } from '$lib/layout/layout-wall-openings';
	import { planCameraProjectionForProject } from './plan-camera-projection';
	import PlanSvg from './PlanSvg.svelte';
	import PlanCanvasChrome from './PlanCanvasChrome.svelte';
	import PlanEmptyGhost from './PlanEmptyGhost.svelte';

	let {
		model,
		preview,
		interaction,
		scene,
		rooms: sceneRooms,
		getEffectiveSceneScale,
		selectedPlacementIds = [],
		selectedClusterId = null,
		active = true,
		onPlanModeChange,
		onEnterStaging,
		onSceneSelect,
		onSceneGestureBegin,
		onSceneGesturePreview,
		onSceneGestureCommit,
		onSceneGestureCancel,
		onSceneDelete,
		onCommit,
		onWallSegmentCommit,
		onOpeningCreate,
		onOpeningDelete,
		onWallOpeningCreate,
		onWallOpeningDelete,
		onWallDelete,
		onWallJunctionAdd,
		onWallBendPointAdd,
		onRoomDelete,
		onRoomRemove,
		onLayoutTransactionBegin,
		onLayoutTransactionCommit,
		onLayoutTransactionCancel,
		onDeselect,
		store,
		contextMenu = null,
		hierarchyEmphasis = null,
		hierarchySceneEmphasis = null
	}: {
		model: LayoutPreviewModel;
		preview: LayoutPreviewState;
		interaction: LayoutInteractionState;
		scene?: SceneDocument;
		rooms?: LayoutRoomRegistry;
		getEffectiveSceneScale?: (entity: SceneEntity) => number | Vec3 | undefined;
		selectedPlacementIds?: readonly string[];
		selectedClusterId?: string | null;
		active?: boolean;
		onPlanModeChange?: (mode: 'layout' | 'staging') => void;
		onEnterStaging?: (entityId: string) => void;
		onSceneSelect?: (
			entityId: string,
			modifiers: { additive: boolean; toggle: boolean }
		) => boolean;
		onSceneGestureBegin?: () => boolean;
		onSceneGesturePreview?: (patches: readonly PlanSceneTransformPatch[]) => boolean;
		onSceneGestureCommit?: () => boolean;
		onSceneGestureCancel?: () => boolean;
		onSceneDelete?: () => boolean;
		onCommit: (points: LayoutVec2[]) => boolean;
	/** P23.9 segment-first — commit one Wall/Partition segment (one history entry). Returns the canonical Junctions for continuation. */
	onWallSegmentCommit: (start: LayoutVec2, end: LayoutVec2, endpointHostWallId?: string) => {
		success: boolean;
		startJunctionId?: string;
		endJunctionId?: string;
		closedRun?: boolean;
		/** P23.6I — height the committed segment authored (run continuation state). */
		wallHeight?: number;
	};
		onOpeningCreate: (roomId: string, segmentId: string, kind: LayoutOpeningKind, clickOffset: number) => void;
		onOpeningDelete: (roomId: string, openingId: string) => void;
		/** P23.3 — canonical create on a document-global `wallId` (no `roomId`). */
		onWallOpeningCreate?: (wallId: string, kind: LayoutOpeningKind, clickOffset: number) => void;
		/** P23.3 — delete the selected canonical Opening by `openingId`. */
		onWallOpeningDelete?: (openingId: string) => void;
		/** P23.6c — delete the selected canonical Wall by document-global `wallId`. */
		onWallDelete?: (wallId: string) => void;
		/**
		 * P23.10 — canonical Wall subdivision from a resolved physical-Wall hit.
		 * `splitDistance` is the hit projection's physical meters from the canonical
		 * start Junction, so the viewport never invents a coordinate. Omitted by
		 * mounts that cannot subdivide; then no Add-junction item is offered.
		 */
		onWallJunctionAdd?: (wallId: string, splitDistance: number) => void;
		/**
		 * P23.11 — canonical bend-point insertion from a resolved physical-Wall hit
		 * (the context-menu **Add bend point here** command). `bendDistance` is the
		 * same hit projection's canonical-start meters the junction command uses,
		 * so the menu action and the Bend gesture share one insertion authority.
		 * Omitted by mounts that cannot insert; then no item is offered.
		 */
		onWallBendPointAdd?: (wallId: string, bendDistance: number) => void;
		onRoomDelete: (roomId: string) => boolean;
		/**
		 * P23.6d — canonical wall-first Room removal (guard-railed `planRemoveRoom`).
		 * The viewport routes a wall-first Room's context-menu/Delete-key removal
		 * here instead of the legacy `onRoomDelete` (which rejects wall-first).
		 * Optional only for the frozen relic mount; a wall-first document with no
		 * handler exposes no Room removal command.
		 */
		onRoomRemove?: (roomId: string) => boolean;
		onLayoutTransactionBegin: () => boolean;
		onLayoutTransactionCommit: () => boolean;
		onLayoutTransactionCancel: () => boolean;
		/** a Plan empty-click deselects the *active* domain (default: clear the layout selection). */
		onDeselect?: () => void;
		/** Editor facade; optional only for the frozen relic mount. */
		store?: EditorStore;
		/** P3.4 — shared context-menu slot; absent keeps the surface frozen. */
		contextMenu?: EditorContextMenuStore | null;
		/**
		 * P23.6e — optional external hover emphasis from the Scene Navigator. It is
		 * plain presentation data (never a selection): the viewport's own pointer
		 * hover always wins, and only the Scene Plan mount passes it, so Camera Plan
		 * receives nothing.
		 */
		hierarchyEmphasis?: PlanHitIdentity | null;
		/** Scene entity emphasis uses the existing passive footprint renderer. */
		hierarchySceneEmphasis?: string | null;
	} = $props();

	let svgElement = $state<SVGSVGElement>();
	let pointerId = $state<number | null>(null);
	let panPointerId = $state<number | null>(null);
	let lastPanScreen = $state<LayoutVec2 | null>(null);
	let interiorAnchorPointerId = $state<number | null>(null);
	let draggedInteriorAnchor = $state<{ roomId: string; segmentId: string; anchorId: string } | null>(null);
	/**
	 * P23.2 legacy interior-anchor drag — the frozen pointer-down origin and the
	 * shared drag threshold, read exactly the way the direct architecture edits
	 * read them. An interior-anchor *hit* has a radius, and the release resolver
	 * snaps (grid included), so without this gate a plain click beside an anchor
	 * would move it by the hit radius and write history.
	 */
	let interiorAnchorStartScreen = $state<LayoutVec2 | null>(null);
	let interiorAnchorMoved = $state(false);
	let pendingWallBend = $state<{
		pointerId: number;
		roomId: string;
		segmentId: string;
		projectionPoint: LayoutVec2;
		originScreen: LayoutVec2;
	} | null>(null);
	let openingDrag = $state<{ roomId: string; segmentId: string; openingId: string; width: number } | null>(null);
	let dragSnapshot = $state<LayoutPreviewSnapshot | null>(null);
	let suppressNextClick = $state(false);
	let framedReplacementVersion = $state<number | null>(null);
	let roomUnitSnapshot = $state<LayoutPreviewSnapshot | null>(null);
	let rotationHoverScreen = $state<LayoutVec2 | null>(null);
	let sceneBridgeHover = $state<{ entityId: string; screen: LayoutVec2 } | null>(null);
	// P23.2 — transient snap resolution (session-only). The resolution was
	// computed at the raw pointer world position; null clears feedback.
	let snapFeedback = $state<SnapResolution | null>(null);

	/**
	 * P23.11 — the Bend modifier is a **named command**, not a key.
	 *
	 * The platform is detected once here (the only impure step, and the only
	 * place a raw modifier flag is read) and the pointer-down path asks the pure
	 * resolver which commands are live. Nothing downstream inspects
	 * `event.metaKey` / `event.altKey`, so remapping the command later is a
	 * binding-table change with no consumer edit.
	 */
	const editorPlatform = resolveEditorPlatform(
		typeof navigator === 'undefined'
			? null
			: { platform: navigator.platform, userAgent: navigator.userAgent }
	);

	function commandIntentFor(event: PointerEvent): ReadonlySet<EditorCommandId> {
		const snapshot: EditorModifierSnapshot = {
			meta: event.metaKey,
			ctrl: event.ctrlKey,
			alt: event.altKey,
			shift: event.shiftKey
		};
		return resolveEditorCommandIntent(snapshot, editorPlatform);
	}

	function clearLayoutSnapFeedback(): void {
		snapFeedback = null;
	}

	/**
	 * P23.2 — resolve one deterministic snap for a raw pointer world point.
	 * Pure over the compiled geometry; exclusion is explicit and tool-specific
	 * (moving targets never self-snap). Falls back to the shared grid step
	 * exactly like the legacy `snapToGrid` call it replaces. Snap-off returns
	 * the raw point and clears any live feedback (toggle clear rule).
	 */
	function resolveLayoutSnapCandidate(
		point: LayoutVec2,
		options: {
			allowedKinds?: SnapFeatureKind[];
			excludeOwners?: ReadonlySet<string>;
			excludePoints?: readonly LayoutVec2[];
		} = {}
	): { point: LayoutVec2; resolution: SnapResolution } {
		if (!interaction.planView.snapEnabled) {
			clearLayoutSnapFeedback();
			return { point, resolution: { kind: 'none' } };
		}
		const input: SnapInputContext = {};
		if (options.allowedKinds) input.allowedKinds = options.allowedKinds;
		if (options.excludeOwners) input.excludeOwners = options.excludeOwners;
		if (options.excludePoints) input.excludePoints = options.excludePoints;
		const resolution = p2311Measure('snap-resolution', () => resolveLayoutSnap(
			preview.geometry,
			point,
			{ pixelsPerMeter: interaction.planView.pixelsPerMeter, gridStep: LAYOUT_PLAN_GRID_STEP },
			input
		));
		snapFeedback = resolution;
		return {
			point: resolution.kind === 'snap' ? ([...resolution.candidate.point] as LayoutVec2) : point,
			resolution
		};
	}

	function applyLayoutSnap(
		point: LayoutVec2,
		options: {
			allowedKinds?: SnapFeatureKind[];
			excludeOwners?: ReadonlySet<string>;
			excludePoints?: readonly LayoutVec2[];
		} = {}
	): LayoutVec2 {
		return resolveLayoutSnapCandidate(point, options).point;
	}
	// ── P23.10 direct architecture editing ──────────────────────────────────
	// One immutable baseline snapshot and one Layout transaction per gesture.
	// Snapping always resolves against the CAPTURED baseline geometry (never the
	// live preview, which may already hold a candidate) with the moving owners
	// frozen at pointer-down. `architectureEditMoved` is the shared editor drag
	// threshold: below it the press is still a plain click and no candidate is
	// planned, so a click never writes history.
	let architectureEditSnapshot = $state<LayoutPreviewSnapshot | null>(null);
	let architectureEditStartScreen = $state<LayoutVec2 | null>(null);
	let architectureEditMoved = $state(false);
	/**
	 * P23.11 transient pass — the render-only attempt for the gesture's current
	 * candidate. It is gesture-local (`null` outside a live drag) and replaced
	 * wholesale on every move, never mutated, so `$state.raw` gives the render
	 * surfaces a plain object instead of a deep proxy over the proposal's
	 * sampled coordinates: the proposal is derived data, not canonical state.
	 */
	let architectureEditTransient = $state.raw<LayoutTransientArchitectureEdit | null>(null);
	let lastBendPointerTime: number | null = null;
	let architectureEditReplacementVersion = $state<number | null>(null);

	/** Every Wall the edit deforms, in document order (frozen at pointer-down). */
	function architectureEditAffectedWallIds(junctionIds: readonly string[]): string[] {
		const layout = wallFirstLayoutDocument();
		if (!layout) return [];
		const owned = new Set(junctionIds);
		return layout.walls
			.filter((wall) => owned.has(wall.startJunctionId) || owned.has(wall.endJunctionId))
			.map((wall) => wall.id);
	}

	/**
	 * P23.10 — every baseline Junction coordinate for a Junction move's point
	 * exclusion. Read at pointer-down, when the live document is still the
	 * baseline: Junction merging is out of scope, so a candidate landing exactly
	 * on an existing Junction must not win — by any snap family, since
	 * `'wall-span'`/`'wall-intersection'` are projective and resolve onto
	 * Junction coordinates that sit on another Wall's span.
	 */
	function architectureEditJunctionExcludePoints(): LayoutVec2[] {
		const layout = wallFirstLayoutDocument();
		if (!layout) return [];
		return layout.junctions.map((junction) => [junction.point[0], junction.point[1]] as LayoutVec2);
	}

	/** Openings hosted by any affected Wall (frozen at pointer-down). */
	function architectureEditHostedOpeningIds(wallIds: readonly string[]): string[] {
		const layout = wallFirstLayoutDocument();
		if (!layout) return [];
		const owned = new Set(wallIds);
		return layout.openings
			.filter((opening) => owned.has(opening.wallId))
			.map((opening) => opening.id);
	}

	/**
	 * P23.10 — resolve one direct-edit snap against the captured baseline
	 * geometry with the frozen moving-owner exclusions. A Junction move removes
	 * the `'junction'` family before winner selection (Junction merging is out
	 * of scope); a rigid Wall move keeps the full P23.2 ranking because one
	 * delta over two existing endpoint IDs merges nothing.
	 */
	function resolveArchitectureEditSnapTarget(
		gesture: LayoutArchitectureEditGesture,
		rawTarget: LayoutVec2
	): LayoutVec2 {
		const snapshot = architectureEditSnapshot;
		if (!interaction.planView.snapEnabled || !snapshot) {
			if (import.meta.env.DEV && (globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__) {
				performance.mark(`p2311:snap-bypass:enabled-${interaction.planView.snapEnabled}:snapshot-${Boolean(snapshot)}`);
			}
			clearLayoutSnapFeedback();
			return rawTarget;
		}
		const input: SnapInputContext = {
			excludeOwners: architectureEditExclusionOwners(
				gesture,
				architectureEditHostedOpeningIds(gesture.affectedWallIds)
			)
		};

		const allowedKinds = architectureEditAllowedKinds(gesture);
		if (allowedKinds) input.allowedKinds = [...allowedKinds];
		const excludePoints = architectureEditExcludePoints(gesture);
		if (excludePoints.length > 0) input.excludePoints = excludePoints;
		const resolution = p2311Measure('architecture-snap-resolution', () => resolveLayoutSnap(
			snapshot.geometry,
			rawTarget,
			{ pixelsPerMeter: interaction.planView.pixelsPerMeter, gridStep: LAYOUT_PLAN_GRID_STEP },
			input
		));
		snapFeedback = resolution;
		return resolution.kind === 'snap' ? ([...resolution.candidate.point] as LayoutVec2) : rawTarget;
	}

	/**
	 * P23.11 transient pass — reinstate the frozen baseline, unless the live
	 * preview already **is** that baseline (see
	 * `restoreTransientArchitectureBaseline`). A transient drag installs nothing,
	 * so the ordinary restore would be a full reactive write of a document that
	 * never changed.
	 */
	function restoreArchitectureEditBaseline(): void {
		const snapshot = architectureEditSnapshot;
		if (!snapshot) return;
		restoreTransientArchitectureBaseline(preview, snapshot);
	}

	/**
	 * P23.11 transient pass — the frozen pointer-down baseline as a canonical
	 * wall-first document. The proposal is always derived from this snapshot
	 * (raw, immutable, never the reactive preview) so a move cannot propose from
	 * a candidate it has itself already written.
	 */
	function architectureEditBaselineDocument(): LayoutDocumentWallFirst | null {
		const layout = architectureEditSnapshot?.project.layout;
		if (!layout || !('formatVersion' in layout)) return null;
		return layout as unknown as LayoutDocumentWallFirst;
	}

	/**
	 * Plan one candidate from the immutable baseline. The baseline is restored
	 * before planning, so a rejected candidate can never leave the previous
	 * preview installed, and the canonical planner (never the viewport) decides
	 * whether the snapped target is valid.
	 *
	 * Under the transient contract this runs once per gesture, at release.
	 */
	function planArchitectureEditTarget(
		gesture: LayoutArchitectureEditGesture,
		target: LayoutVec2
	): { success: boolean; message?: string; code?: string } {
		const snapshot = architectureEditSnapshot;
		if (!snapshot) return { success: false, message: 'No baseline snapshot for the architecture edit' };
		const input = updateLayoutArchitectureEdit(interaction, target);
		if (!input) return { success: false, message: 'Architecture edit gesture was lost' };
		restoreArchitectureEditBaseline();
		const result = p2311Measure('adapter-plan-apply', () =>
			gesture.kind === 'junction-move'
				? updateWallFirstJunction(preview, gesture.junctionId, input)
				: gesture.kind === 'wall-move'
					? updateWallFirstWallMove(preview, gesture.wallId, input)
					: gesture.kind === 'wall-bend'
						? // One canonical call for one history entry: the composite
							// planner inserts the grabbed arc position AND places it, with
							// no surface between the pointer and acceptance.
							updateWallFirstWallBend(preview, gesture.wallId, {
								distance: gesture.bendDistance,
								point: input
							})
						: updateWallFirstWallCurveKnot(preview, gesture.wallId, gesture.anchorId, input));
		if (result.success) {
			markLayoutArchitectureEditValidity(interaction, true);
			return { success: true };
		}
		markLayoutArchitectureEditValidity(interaction, false, result.code, result.message);
		return { success: false, message: result.message, code: result.code };
	}

	/**
	 * Begin one direct edit: capture the baseline, open the transaction, capture
	 * the pointer. Only a primary contact may start one — a secondary button
	 * never captures the pointer, opens a transaction or moves geometry.
	 */
	function beginArchitectureEditGesture(
		event: PointerEvent,
		baseline:
			| {				kind: 'junction-move';
				junctionId: string;
				baselinePoint: LayoutVec2;
				junctionExcludePoints: readonly LayoutVec2[];
				affectedWallIds: readonly string[];
			  }
			| {
					kind: 'wall-move';
					wallId: string;
					grabPoint: LayoutVec2;
					startJunctionId: string;
					endJunctionId: string;
					baselineStart: LayoutVec2;						baselineEnd: LayoutVec2;
					affectedWallIds: readonly string[];
			  }
			| {
					kind: 'curve-control-move';
					wallId: string;
					anchorId: string;
					baselineAnchorPoint: LayoutVec2;
					curveExcludePoints: readonly LayoutVec2[];
			  }
			| {
					/**
					 * The Bend command, already resolved from the intent at pointer-down.
					 * `bendDistance` is the grabbed physical arc distance; the insert is
					 * deferred to the threshold crossing. `command` is stored on the
					 * gesture so nothing can re-read modifiers mid-drag.
					 */
					kind: 'wall-bend';
					command: EditorCommandId;
					wallId: string;
					grabPoint: LayoutVec2;
					bendDistance: number;
					bendExcludePoints: readonly LayoutVec2[];
			  }
	): boolean {
		if (!event.isPrimary || !svgElement) return false;
		const point = worldPoint(event);
		const screen = screenPoint(event);
		if (!point || !screen) return false;
		if (!onLayoutTransactionBegin()) return false;
		architectureEditSnapshot = captureLayoutPreviewSnapshot(preview);
		architectureEditStartScreen = screen;
		architectureEditMoved = false;
		const gesture: LayoutArchitectureEditGesture =
			baseline.kind === 'wall-bend'
				? {
						kind: 'wall-bend',
						command: baseline.command,
						pointerId: event.pointerId,
						wallId: baseline.wallId,
						startPointer: [...point] as LayoutVec2,
						baselineGrabPoint: [...baseline.grabPoint] as LayoutVec2,
						bendDistance: baseline.bendDistance,
						bendExcludePoints: baseline.bendExcludePoints.map(
							(exclude) => [...exclude] as LayoutVec2
						),
						// The bent Wall alone: inserting one bend point leaves both
						// endpoint Junctions in place, so no neighbour reshapes.
						affectedWallIds: [baseline.wallId],
						candidatePoint: [...baseline.grabPoint] as LayoutVec2,
						valid: false
				  }
				: baseline.kind === 'curve-control-move'
				? {
						kind: 'curve-control-move',
						pointerId: event.pointerId,
						wallId: baseline.wallId,
						anchorId: baseline.anchorId,
						startPointer: [...point] as LayoutVec2,
						baselineAnchorPoint: [...baseline.baselineAnchorPoint] as LayoutVec2,
						curveExcludePoints: baseline.curveExcludePoints.map(
							(exclude) => [...exclude] as LayoutVec2
						),
						// The edited Wall alone: a control move leaves both endpoint
						// Junctions in place, so no neighbouring Wall reshapes.
						affectedWallIds: [baseline.wallId],
						candidatePoint: [...baseline.baselineAnchorPoint] as LayoutVec2,
						valid: false
				  }
				: baseline.kind === 'junction-move'
				? {
						kind: 'junction-move',
						pointerId: event.pointerId,
						junctionId: baseline.junctionId,
						startPointer: [...point] as LayoutVec2,
						baselinePoint: [...baseline.baselinePoint] as LayoutVec2,
						junctionExcludePoints: baseline.junctionExcludePoints.map(
							(point) => [...point] as LayoutVec2
						),
						affectedWallIds: [...baseline.affectedWallIds],
						candidatePoint: [...baseline.baselinePoint] as LayoutVec2,
						valid: false
				  }
				: {
						kind: 'wall-move',
						pointerId: event.pointerId,
						wallId: baseline.wallId,
						startPointer: [...point] as LayoutVec2,
						baselineGrabPoint: [...baseline.grabPoint] as LayoutVec2,
						startJunctionId: baseline.startJunctionId,
						endJunctionId: baseline.endJunctionId,
						baselineStart: [...baseline.baselineStart] as LayoutVec2,
						baselineEnd: [...baseline.baselineEnd] as LayoutVec2,
						affectedWallIds: [...baseline.affectedWallIds],
						candidateDelta: [0, 0],
						valid: false
				  };
		beginLayoutArchitectureEdit(interaction, gesture);
		pointerId = event.pointerId;
		svgElement.setPointerCapture(event.pointerId);
		return true;
	}

	/**
	 * One pointermove: total-delta candidate, baseline snap, transient attempt.
	 *
	 * The canonical document, its compiled geometry, the Room/Opening/portal
	 * validation and the Layout history are **not touched here**: the candidate
	 * is written on the gesture and turned into render-only proposal geometry,
	 * so a move costs one snap, one proposal and one Plan update. Acceptance —
	 * the canonical planner, the full validation suite and the compile — runs
	 * exactly once, on release.
	 */
	function previewArchitectureEdit(event: PointerEvent): void {
		const gesture = interaction.architectureEdit;
		if (!gesture || !architectureEditSnapshot) return;
		const point = worldPoint(event);
		const screen = screenPoint(event);
		if (!point || !screen) return;
		// Below the shared drag threshold the operation is still a click: the
		// canonical baseline stays installed and nothing is proposed or written.
		if (!architectureEditMoved) {
			if (!shouldBeginWallBend(architectureEditStartScreen ?? screen, screen)) return;
			architectureEditMoved = true;
		}
		const target = resolveArchitectureEditSnapTarget(gesture, architectureEditRawTarget(gesture, point));
		const input = updateLayoutArchitectureEdit(interaction, target);
		if (!input) return;
		architectureEditTransient = transientArchitectureEdit({
			gesture: interaction.architectureEdit,
			baseline: architectureEditBaselineDocument(),
			moved: true
		});
	}

	/**
	 * Clear the transient gesture state, drop the captured pointer and clear the
	 * snap feedback — the one cleanup path every exit (commit, cancel, Escape,
	 * lost capture, tool change) goes through, so none can leak a capture or a
	 * stale marker. `pointerIdToRelease` is `null` only when no pointer was ever
	 * captured.
	 */
	function finishArchitectureEditGesture(pointerIdToRelease: number | null): void {
		lastBendPointerTime = null;
		cancelLayoutArchitectureEdit(interaction);
		architectureEditSnapshot = null;
		architectureEditStartScreen = null;
		architectureEditMoved = false;
		architectureEditTransient = null;
		clearLayoutSnapFeedback();
		pointerId = null;
		if (pointerIdToRelease !== null && svgElement?.hasPointerCapture(pointerIdToRelease)) {
			svgElement.releasePointerCapture(pointerIdToRelease);
		}
	}

	/**
	 * P23.10 — cancel/commit the direct edit at release. The candidate is
	 * re-derived once from the ACTUAL release coordinate against the immutable
	 * baseline (never a remembered last-valid intermediate), then committed once
	 * or cancelled with the baseline restored. A no-op release stays silent.
	 */
	function commitArchitectureEditGesture(event: PointerEvent): void {
		const outcome = releaseArchitectureEdit({
			gesture: interaction.architectureEdit,
			moved: architectureEditMoved,
			// The one canonical planner call for this gesture: the release
			// coordinate is re-resolved against the frozen baseline, never a
			// remembered intermediate proposal.
			plan: () => {
				const gesture = interaction.architectureEdit;
				if (!gesture) return { success: false, message: 'Architecture edit gesture was lost' };
				const point = worldPoint(event);
				if (!point) {
					return { success: false, message: 'Could not resolve the release position' };
				}
				const target = resolveArchitectureEditSnapTarget(
					gesture,
					architectureEditRawTarget(gesture, point)
				);
				return planArchitectureEditTarget(gesture, target);
			},
			commit: () => onLayoutTransactionCommit(),
			cancel: () => onLayoutTransactionCancel(),
			restoreBaseline: restoreArchitectureEditBaseline
		});
		if (outcome.statusMessage) preview.statusMessage = outcome.statusMessage;
		if (outcome.suppressNextClick) suppressNextClick = true;
		finishArchitectureEditGesture(event.pointerId);
	}

	/** Escape / pointer-cancel / mode change: restore the baseline, cancel once. */
	function cancelArchitectureEditGesture(): void {
		const gesture = interaction.architectureEdit;
		const snapshot = architectureEditSnapshot;
		if (!gesture) {
			if (!snapshot) return;
			// A tool/mode/document change clears the interaction gesture before
			// the viewport effect runs, but the captured pointer, the open
			// transaction and the snap feedback are still ours: finish through the
			// same cleanup instead of leaving a capture (and a transaction) open.
			restoreArchitectureEditBaseline();
			onLayoutTransactionCancel();
			suppressNextClick = architectureEditMoved;
			finishArchitectureEditGesture(pointerId);
			return;
		}
		restoreArchitectureEditBaseline();
		onLayoutTransactionCancel();
		suppressNextClick = architectureEditMoved;
		finishArchitectureEditGesture(gesture.pointerId);
	}

	/**
	 * P23.10 — a capture lost to the browser (context menu, window blur, element
	 * removal, OS gesture) still ends the gesture: restore the canonical baseline
	 * and cancel the open Layout transaction exactly once. Our own releases
	 * (`finishArchitectureEditGesture`, and the legacy interior-anchor
	 * `onPointerUp` branch) run with the gesture state already cleared, so this is
	 * a no-op on every normal exit.
	 */
	function onLostPointerCapture(event: PointerEvent): void {
		if (interaction.architectureEdit?.pointerId === event.pointerId) {
			cancelArchitectureEditGesture();
			return;
		}
		// The legacy interior-anchor drag owns its pointer the same way: a capture
		// lost to the browser ends the gesture on the exact pointer-down baseline
		// with no history. `onPointerUp` clears the drag state before it releases
		// the capture, so this is a no-op on every normal exit.
		if (interiorAnchorPointerId === event.pointerId) cancelActiveLayoutDrag();
	}

	/** A window blur is not required to synthesize pointercancel in every browser. */
	function onWindowBlur(): void {
		if (interaction.architectureEdit || architectureEditSnapshot) cancelArchitectureEditGesture();
		// The legacy interior-anchor drag owns an open Layout transaction the same
		// way, so a blur closes it through the same baseline-restore/cancel path
		// instead of leaving the gesture live with the transaction open.
		const interiorAnchorPointerIdToRelease = interiorAnchorPointerId;
		if (interiorAnchorPointerIdToRelease !== null) {
			cancelActiveLayoutDrag();
			if (
				svgElement?.hasPointerCapture(interiorAnchorPointerIdToRelease)
			) {
				svgElement.releasePointerCapture(interiorAnchorPointerIdToRelease);
			}
		}
	}

	let previousPlanViewMode = $state<PlanViewMode | null>(null);
	let stagingGesture = $state<{
		pointerId: number;
		mode: 'translate' | 'rotate';
		primaryId: string;
		members: PlanSceneTransformMember[];
		startWorld: LayoutVec2;
		startScreen: LayoutVec2;
		moved: boolean;
		plainClickEntityId: string | null;
	} | null>(null);
	let stagingRotationHoverScreen = $state<LayoutVec2 | null>(null);
	let arrangeLayoutRotationHoverScreen = $state<LayoutVec2 | null>(null);
	// P23.6 — transient canonical hover (presentation only, never a selection
	// slot): the same owner-aware hit the click path uses, resolved on
	// pointermove and cleared on leave/click/drag. Hover never looks selected.
	let layoutHover = $state<PlanHitIdentity | null>(null);
	// P3.3 — presentation-only Arrange hover (which footprint/object the
	// pointer is over). Derived from the same resolveArrangeHit call the click
	// path uses; it never writes selection or document state.
	let arrangeHover = $state<{ owner: 'layout-object' | 'scene'; id: string } | null>(null);
	// A local Plan hover owns Scene footprint presentation while it exists. The
	// Navigator emphasis is only the fallback, so a layout-object Arrange hit
	// also clears any stale Scene emphasis instead of highlighting two targets.
	const effectiveSceneHover = $derived.by(() => {
		if (sceneBridgeHover !== null) return sceneBridgeHover.entityId;
		if (arrangeHover !== null) return arrangeHover.owner === 'scene' ? arrangeHover.id : null;
		if (layoutHover !== null) return null;
		return hierarchySceneEmphasis;
	});
	// P3.3 — live yaw readout while a Scene rotate gesture is in progress
	// (same feedback language as room rotation).
	let stagingYawFeedback = $state<number | null>(null);
	// P21.2 — ghost blueprint session dismissal (not serialized): the 10×8m
	// watermark unmounts once the project is non-empty, or for the remainder
	// of the session upon first tool use.
	let ghostDismissed = $state(false);

	const viewBox = $derived(`0 0 ${interaction.planView.width} ${interaction.planView.height}`);
	const draftPolygon = $derived(
		interaction.tool === 'rectangle'
			? rectanglePoints(interaction)
			: interaction.polygonPoints
	);
	const rooms = $derived('floors' in preview.project.layout ? preview.project.layout.floors.flatMap((floor) => floor.rooms) : []);
	// P23.6 — wall-first presentation context (Junction handles, Room names,
	// run-closure cue, diagnostic markers). Derived from the live document;
	// nothing here is authored truth.
	const wallFirstContext = $derived.by(() => {
		const layout = preview.project.layout;
		if (!('formatVersion' in layout)) return undefined;
		const document = layout as unknown as {
			junctions: { id: string; point: LayoutVec2 }[];
			walls: {
				id: string;
				startJunctionId: string;
				endJunctionId: string;
				centerline:
					| { kind: 'line' }
					| {
							kind: 'cubic-chain';
							knots: { id: string; point: LayoutVec2 }[];
							spans: { handleOut: LayoutVec2; handleIn: LayoutVec2 }[];
					  };
			}[];
			rooms: { id: string; name: string }[];
		};
		const selection = interaction.selection;
		let junctionFocus: Set<string> | null = null;
		if (selection.kind === 'physicalWall' || selection.kind === 'wallOpening') {
			const wall = document.walls.find((candidate) => candidate.id === selection.wallId);
			junctionFocus = new Set(wall ? [wall.startJunctionId, wall.endJunctionId] : []);
		}
		return {
			junctions: document.junctions.map((junction) => ({
				id: junction.id,
				point: [...junction.point] as LayoutVec2
			})),
			junctionFocus,
			// P23.11 — the selected curved Wall's controls, read from the live
			// document. This is the ONE list: it feeds both the rendered handles
			// and the hit query, so the affordance and its hit region cannot drift.
			curveControls: selectedCurveControls(document.walls),
			roomNames: new Map(document.rooms.map((room) => [room.id, room.name] as const)),
			runStartPoint: interaction.wallChainRunStartJunctionId
				? resolveJunctionPoint(interaction.wallChainRunStartJunctionId)
				: null,
			issues: preview.issues
		};
	});
	const baseInteractionProjection = $derived(
		buildPlanInteractionProjection(
			interaction,
			rooms,
			model,
			wallFirstContext,
			// Viewport-local pointer hover wins; Navigator emphasis is the fallback.
			layoutHover ?? hierarchyEmphasis ?? undefined
		)
	);
	const cameraProjection = $derived.by(() => {
		if (interaction.planViewMode !== 'layout' || !interaction.planView.showTourOverlay) return undefined;
		try {
			return planCameraProjectionForProject(preview.project, preview.geometry, preview.issues);
		} catch {
			// Scene/layout divergence (e.g. imported layout missing scene rooms) must not break the plan.
			return undefined;
		}
	});
	const sceneProjection = $derived.by(() => {
		// The room registry is a plain store seam. Preview mutations replace the
		// registry in EditorApp, so key this derived value to the live layout
		// version or a moved room leaves Scene footprints in its old frame.
		void preview.previewVersion;
		if (!scene || !sceneRooms) return undefined;
		void interaction.planViewMode;
		void selectedPlacementIds.length;
		void effectiveSceneHover;
		return buildPlanSceneFootprintProjection(scene, sceneRooms, {
			getEffectiveScale: getEffectiveSceneScale,
			presentationForEntity: (entityId) => {
				if (interaction.planViewMode === 'staging' && selectedPlacementIds.includes(entityId)) return 'selected';
				if (effectiveSceneHover === entityId) {
					return 'bridge-hover';
				}
				return interaction.planViewMode === 'staging' ? 'active' : 'passive';
			}
		});
	});
	const stagingSelectionMessage = $derived.by(() => {
		// Scene-only surface: hidden while the layout-object owner is active.
		if (interaction.planViewMode !== 'staging' || selectedPlacementIds.length === 0) return null;
		if (interaction.arrangeOwner === 'layout-object') return null;
		if (selectedClusterId !== null) return 'Some selected items are not editable in Plan.';
		const eligibleIds = new Set(sceneProjection?.footprints.map((footprint) => footprint.entityId) ?? []);
		const ineligibleCount = selectedPlacementIds.filter((id) => !eligibleIds.has(id)).length;
		if (ineligibleCount === 0) return null;
		return ineligibleCount === selectedPlacementIds.length
			? 'Not editable in Plan. Edit position in 3D.'
			: 'Some selected items are not editable in Plan.';
	});
	const stagingEligibleIds = $derived(
		new Set(sceneProjection?.footprints.map((footprint) => footprint.entityId) ?? [])
	);
	const stagingTransformEnabled = $derived(
		interaction.planViewMode === 'staging' &&
		selectedClusterId === null &&
		selectedPlacementIds.length > 0 &&
		selectedPlacementIds.every((id) => stagingEligibleIds.has(id))
	);
	// P10 — the session's active Arrange target (derived from the remembered
	// owner + the canonical Layout/Scene slots; never a mirrored selection).
	const arrangeEligibleLayoutObjectIds = $derived(
		new Set(model.objects.filter((object) => !object.readonly).map((object) => object.objectId))
	);
	const arrangeActiveTarget = $derived(
		interaction.planViewMode === 'staging'
			? deriveArrangeTarget({
					lastOwner: interaction.arrangeOwner,
					layoutSelection: interaction.selection,
					selectedPlacementIds,
					selectedClusterId,
					eligibleLayoutObjectIds: arrangeEligibleLayoutObjectIds,
					eligibleSceneEntityIds: stagingEligibleIds
				})
			: null
	);
	const arrangeActiveLayoutObject = $derived(
		arrangeActiveTarget?.owner === 'layout-object' ? arrangeActiveTarget.objectId : null
	);
	const arrangeActiveScene = $derived(
		arrangeActiveTarget?.owner === 'scene' ? arrangeActiveTarget : null
	);
	const arrangeEmpty = $derived(
		interaction.planViewMode === 'staging' &&
		arrangeEligibleLayoutObjectIds.size === 0 &&
		stagingEligibleIds.size === 0
	);
	// P3.3 — the canonical empty-plan state: no rooms, no physical walls, no
	// layout objects, and no scene entities anywhere in the document.
	const planEmpty = $derived(
		preview.model.rooms.length === 0 &&
		(preview.geometry.walls ?? []).length === 0 &&
		preview.model.objects.length === 0 &&
		(scene?.entities.length ?? 0) === 0
	);
	// P21.2 — ghost blueprint visibility: Layout-only, empty, session-alive.
	const ghostVisible = $derived(
		planEmpty && interaction.planViewMode === 'layout' && !ghostDismissed
	);
	const arrangeLayoutRotationHandle = $derived.by(() => {
		const objectId = arrangeActiveLayoutObject;
		if (!objectId) return null;
		const object = model.objects.find((candidate) => candidate.objectId === objectId);
		if (!object || object.readonly) return null;
		const pivot: LayoutVec2 = [object.position[0], object.position[2]];
		const footprintRadius = Math.max(
			...object.planFootprint.map((point) => distance(point, pivot)),
			0.2
		);
		const radius = footprintRadius + 28 / interaction.planView.pixelsPerMeter;
		const yaw = object.rotation[1];
		const handle: LayoutVec2 = [
			pivot[0] - Math.sin(yaw) * radius,
			pivot[1] - Math.cos(yaw) * radius
		];
		const screen = planHandleScreenPoints(interaction.planView, pivot, handle);
		return {
			objectId,
			pivot,
			handle,
			pivotScreen: screen.pivot,
			handleScreen: screen.handle
		};
	});
	const arrangeLayoutRotationHovered = $derived.by(() => {
		if (!arrangeLayoutRotationHoverScreen || !arrangeLayoutRotationHandle) return false;
		return distance(arrangeLayoutRotationHoverScreen, arrangeLayoutRotationHandle.handleScreen) <= LAYOUT_PLAN_HIT_RADIUS_PX;
	});
	const stagingRotationHandle = $derived.by(() => {
		if (!stagingTransformEnabled || arrangeActiveScene === null || !scene || !sceneRooms) return null;
		const primaryId = selectedPlacementIds.at(-1);
		if (!primaryId) return null;
		const entity = scene.entities.find((candidate) => candidate.id === primaryId);
		const footprint = sceneProjection?.footprints.find((candidate) => candidate.entityId === primaryId);
		// P23.0b: world-local entities have no room context — only legacy
		// room-owned entities require a resolvable room here.
		const room =
			entity?.roomId !== undefined ? sceneRooms.get(entity.roomId) : undefined;
		if (!entity || !footprint || (entity.roomId !== undefined && !room)) return null;
		const pivot = planSceneWorldPivot(entity, sceneRooms);
		const footprintRadius = Math.max(
			...footprint.points.map((point) => distance(point, pivot)),
			0.2
		);
		const radius = footprintRadius + 28 / interaction.planView.pixelsPerMeter;
		// Absent roomId means the entity is already world-space: its yaw needs
		// no room rotation composed in front of it.
		const worldYaw = (room?.rotation[1] ?? 0) + entity.rotation[1];
		const handle: LayoutVec2 = [
			pivot[0] - Math.sin(worldYaw) * radius,
			pivot[1] - Math.cos(worldYaw) * radius
		];
		const screen = planHandleScreenPoints(interaction.planView, pivot, handle);
		return {
			primaryId,
			pivot,
			handle,
			pivotScreen: screen.pivot,
			handleScreen: screen.handle
		};
	});
	const stagingRotationHovered = $derived.by(() => {
		if (!stagingRotationHoverScreen || !stagingRotationHandle) return false;
		return distance(stagingRotationHoverScreen, stagingRotationHandle.handleScreen) <= LAYOUT_PLAN_HIT_RADIUS_PX;
	});
	// P3.3 — live degree labels during rotate gestures: same `+NN°` language
	// as the room rotation readout, one per owner.
	const objectRotateFeedback = $derived.by(() => {
		const drag = interaction.objectDrag;
		if (!drag || drag.mode !== 'rotate') return null;
		return yawFeedbackText(drag.candidateRotation[1]);
	});
	const sceneRotateFeedback = $derived(
		stagingGesture?.mode === 'rotate' && stagingYawFeedback !== null
			? yawFeedbackText(stagingYawFeedback)
			: null
	);
	// P3.3 — the hovered Arrange target's outline, fed through the projection
	// as a render primitive (hover never looks selected).
	const arrangeHoverOutline = $derived.by(() => {
		if (!arrangeHover) return null;
		if (arrangeHover.owner === 'layout-object') {
			const object = model.objects.find((candidate) => candidate.objectId === arrangeHover!.id);
			if (!object || object.readonly || arrangeActiveLayoutObject === object.objectId) return null;
			return { id: object.objectId, points: object.planFootprint };
		}
		const footprint = sceneProjection?.footprints.find(
			(candidate) => candidate.entityId === arrangeHover!.id
		);
		if (!footprint || selectedPlacementIds.includes(footprint.entityId)) return null;
		return { id: footprint.entityId, points: footprint.points };
	});
	// P23.11 transient pass — the direct-edit drag preview is the gesture's
	// derived-only attempt (see `transientArchitectureEdit`): the attempted
	// Wall/Junction geometry follows the pointer as overlay truth while the
	// canonical baseline stays installed underneath, and the canonical planner
	// decides on release. Nothing here reads or writes the document.
	const architectureEditIntent = $derived(architectureEditTransient?.intent ?? null);
const interactionProjection = $derived(
		withArchitectureEditIntent(
			withLayoutSnapFeedback(
				withArrangeHoverOutline(
					withPlanObjectRotationHandle(
						withPlanSceneRotationHandle(
							baseInteractionProjection,
							stagingRotationHandle
								? {
									entityId: stagingRotationHandle.primaryId,
									pivot: stagingRotationHandle.pivot,
									handle: stagingRotationHandle.handle
								}
								: null,
							sceneRotateFeedback
						),
						arrangeLayoutRotationHandle
							? {
								objectId: arrangeLayoutRotationHandle.objectId,
								pivot: arrangeLayoutRotationHandle.pivot,
								handle: arrangeLayoutRotationHandle.handle
							}
							: null,
						objectRotateFeedback
					),
					arrangeHoverOutline
				),
				snapFeedback
			),
			architectureEditIntent
		)
	);
	const planModel = $derived(
		p2311Measure('plan-render-model', () => buildPlanRenderModel(preview.geometry, cameraProjection, interactionProjection, sceneProjection))
	);
	const selectedOpeningSelection = $derived(
		interaction.selection.kind === 'opening' ? interaction.selection : null
	);
	const selectedOpening = $derived.by(() => {
		if (!selectedOpeningSelection) return undefined;
		return findLayoutRoom(rooms, selectedOpeningSelection.roomId)?.openings.find(
			(opening) => opening.id === selectedOpeningSelection.openingId
		);
	});
	// P23.12 — the selection label's identity tier: the compact reference of
	// the selected Opening (wall-first documents only), if the ledger has one.
	const selectedOpeningReference = $derived.by(() => {
		const layout = preview.project.layout;
		if (!selectedOpeningSelection || !('floor' in layout && 'walls' in layout)) return null;
		return referenceFor(layout as unknown as LayoutDocumentWallFirst, 'openings', selectedOpeningSelection.openingId) ?? null;
	});
	const rotationHandleHovered = $derived.by(() => {
		if (interaction.tool !== 'select' || !rotationHoverScreen) return false;
		const handle = rotationHandleScreenPoint(interaction.planView, interactionProjection);
		return handle ? distance(handle, rotationHoverScreen) <= LAYOUT_PLAN_HIT_RADIUS_PX : false;
	});

	onMount(() => {
		const svg = svgElement;
		if (!svg) return;
		const resize = () => {
			const rect = svg.getBoundingClientRect();
			setPlanViewportSize(interaction.planView, rect.width, rect.height);
			if (!interaction.planView.initialized) frameView();
		};
		const observer = new ResizeObserver(resize);
		observer.observe(svg);
		window.addEventListener('blur', onWindowBlur);
		resize();
		return () => {
			window.removeEventListener('blur', onWindowBlur);
			observer.disconnect();
		};
	});

	onDestroy(() => cancelLocalPlanInteraction());

	$effect(() => {
		void active;
		void interaction.planViewMode;
		void interaction.tool;
		if (!active) {
			if (stagingGesture) cancelStagingGesture();
			// Scene Plan stays mounted while Camera Plan owns the viewport. Losing
			// that authority is a direct-edit mode transition even when the shared
			// Layout/3D mode and tool did not change, so restore the captured
			// baseline and close the Layout transaction through the canonical path.
			if (interaction.architectureEdit || architectureEditSnapshot) {
				cancelArchitectureEditGesture();
			}
		}
		if (!active || interaction.planViewMode !== 'layout' || interaction.tool !== 'select') {
			sceneBridgeHover = null;
		}
		// P23.2 clear rules — tool change and Layout/Arrange authority change
		// drop transient guides (the shared state helpers also cancel gestures,
		// so this runs for every reset path).
		if (interaction.tool !== 'select' || interaction.planViewMode !== 'layout') {
			clearLayoutSnapFeedback();
		}
	});

	$effect(() => {
		const mode = interaction.planViewMode;
		if (previousPlanViewMode === null) {
			previousPlanViewMode = mode;
			return;
		}
		if (mode === previousPlanViewMode) return;
		previousPlanViewMode = mode;
		cancelLocalPlanInteraction();
	});

	$effect(() => {
		// P23.10 — the shared interaction helpers clear a direct architecture
		// edit on every tool/authority change. The viewport still owns the open
		// transaction and the captured baseline, so it restores and cancels
		// exactly once here (a tool change must never leak a transaction).
		if (interaction.architectureEdit) return;
		if (!architectureEditSnapshot) return;
		cancelArchitectureEditGesture();
	});

	$effect(() => {
		// P23.10 — a document/project replacement (import/reset/undo/redo, which
		// bumps `reframeVersion`) must never leave a direct edit planning against
		// a stale baseline. Ordinary commits bump only `previewVersion`.
		const version = preview.reframeVersion;
		if (architectureEditReplacementVersion === null) {
			architectureEditReplacementVersion = version;
			return;
		}
		if (version === architectureEditReplacementVersion) return;
		architectureEditReplacementVersion = version;
		if (interaction.architectureEdit || architectureEditSnapshot) cancelArchitectureEditGesture();
	});

	$effect(() => {
		// P23.2 clear rules — snap toggle off or a Plan↔3D switch drops any
		// live guide/marker.
		if (!interaction.planView.snapEnabled || interaction.viewMode !== 'plan') {
			clearLayoutSnapFeedback();
		}
	});

	// P23.9 segment-first — a sketch run never survives document/history
	// replacement (import/reset/undo/redo). Every replacement bumps
	// `previewVersion`. Our own segment commits also bump it, so the commit
	// path sets `draftedVersion` synchronously after advancing continuation —
	// only external bumps clear the run. Tool changes already cancel via
	// `setLayoutDraftTool`. `pointerleave` clears only cursor/snap, never the run.
	let draftedVersion = $state<number | null>(null);
	$effect(() => {
		const version = preview.previewVersion;
		if (draftedVersion === null) {
			draftedVersion = version;
			return;
		}
		if (version === draftedVersion) return;
		draftedVersion = version;
		if (hasWallChainRun(interaction)) cancelWallChainRun(interaction);
	});

	$effect(() => {
		const replacementVersion = preview.reframeVersion;
		if (framedReplacementVersion === null) {
			framedReplacementVersion = replacementVersion;
			return;
		}
		if (interaction.viewMode !== 'plan' || replacementVersion === framedReplacementVersion) return;
		framedReplacementVersion = replacementVersion;
		frameView();
	});

	// P21.2 — session-scoped ghost dismissal on first tool use (not serialized).
	$effect(() => {
		if (interaction.tool !== 'select' && !ghostDismissed) ghostDismissed = true;
	});

	function frameView() {
		const wallPoints = (preview.geometry.walls ?? []).flatMap((wall) =>
			wall.solidCenterlinePolylines.flat()
		);
		const points = [
			...model.rooms.flatMap((room) => room.floorPolygon),
			...wallPoints,
			...model.objects.flatMap((object) => object.planFootprint),
			...(sceneProjection?.footprints.flatMap((footprint) => footprint.points) ?? [])
		];
		framePlanViewport(interaction.planView, points);
	}

	function screenPoint(event: { clientX: number; clientY: number }): LayoutVec2 | null {
		const svg = svgElement;
		if (!svg) return null;
		const rect = svg.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		return [event.clientX - rect.left, event.clientY - rect.top];
	}

	function worldPoint(event: { clientX: number; clientY: number }): LayoutVec2 | null {
		const screen = screenPoint(event);
		return screen ? planScreenToWorld(interaction.planView, screen) : null;
	}

	function dismissSceneBridge(): void {
		sceneBridgeHover = null;
	}

	function cancelLocalPlanInteraction(): void {
		const scenePointerId = stagingGesture?.pointerId ?? null;
		clearLayoutSnapFeedback();
		if (stagingGesture) onSceneGestureCancel?.();
		const hadLayoutInteraction = Boolean(
			dragSnapshot ||
			roomUnitSnapshot ||
			architectureEditSnapshot ||
			openingDrag ||
			pendingWallBend ||
			draggedInteriorAnchor ||
			pointerId !== null ||
			panPointerId !== null ||
			interiorAnchorPointerId !== null
		);
		if (dragSnapshot) restoreLayoutPreviewSnapshot(preview, dragSnapshot);
		if (roomUnitSnapshot) restoreLayoutPreviewSnapshot(preview, roomUnitSnapshot);
		if (architectureEditSnapshot) restoreArchitectureEditBaseline();
		if (hadLayoutInteraction) onLayoutTransactionCancel();
		for (const captured of [
			pointerId,
			panPointerId,
			interiorAnchorPointerId,
			pendingWallBend?.pointerId,
			scenePointerId
		]) {
			if (captured !== null && captured !== undefined && svgElement?.hasPointerCapture(captured)) {
				svgElement.releasePointerCapture(captured);
			}
		}
		pointerId = null;
		panPointerId = null;
		lastPanScreen = null;
		interiorAnchorPointerId = null;
		draggedInteriorAnchor = null;
		interiorAnchorStartScreen = null;
		interiorAnchorMoved = false;
		pendingWallBend = null;
		openingDrag = null;
		dragSnapshot = null;
		roomUnitSnapshot = null;
		architectureEditSnapshot = null;
		architectureEditStartScreen = null;
		architectureEditMoved = false;
		cancelLayoutArchitectureEdit(interaction);
		rotationHoverScreen = null;
		stagingRotationHoverScreen = null;
		arrangeLayoutRotationHoverScreen = null;
		stagingGesture = null;
		suppressNextClick = hadLayoutInteraction;
		dismissSceneBridge();
	}

	/**
	 * P3.4 — Scene Plan context-menu adapter. Arrange mode resolves through
	 * the P10 owner-aware hit target (`resolveArrangeHit` — no second
	 * resolver) and routes by owner; Layout mode resolves through
	 * `resolvePlanHit`. Selection-before-menu mirrors the left-click path
	 * (same selection functions, same owner routing); empty space keeps the
	 * native menu and never changes selection. One gesture mutates one
	 * document through existing commands only.
	 */
	function onPlanContextMenu(event: MouseEvent): void {
		if (!contextMenu || !store) return;
		if (isEditableTarget(event.target)) return;
		const point = worldPoint(event as unknown as PointerEvent);
		if (!point) return;

		if (interaction.planViewMode === 'staging') {
			if (interaction.tool !== 'select') return;
			const hit = resolveArrangeHit({ point, ...arrangeHitCandidates() });
			if (!hit) return;

			if (hit.owner === 'layout-object') {
				// selection-before-menu through the canonical Layout slot + owner switch
				if (arrangeActiveLayoutObject !== hit.objectId) {
					selectLayoutObject(interaction, hit.objectId);
					setArrangeOwner(interaction, 'layout-object');
				}
				event.preventDefault();
				contextMenu.open({
					surfaceId: 'scene-plan-arrange',
					x: event.clientX,
					y: event.clientY,
					items: buildArrangeContextMenuItems({
						target: { owner: 'layout-object', objectId: hit.objectId },
						mutationBlockedReason:
							store.isDocumentMutationBlocked ? 'Preview is active' : null,
						actions: {
							deleteLayoutObject: deleteLayoutObjectViaTransaction,
							duplicateScene: () => store.duplicateSelection(),
							focusScene: (entityId) => void store.focusPlacement(entityId),
							toggleSceneVisibility: (entityId) => store.toggleEntityVisibility(entityId),
							deleteScene: () => store.deletePlacements([...store.selectedPlacementIds])
						}
					})
				});
				return;
			}

			// Scene owner — same authority rules as the Delete-key / drag paths.
			const targetSelected = selectedPlacementIds.includes(hit.entityId);
			// A plain-click select replaces the whole selection with this entity,
			// so authority is judged against the post-write selection.
			const postWriteIds = targetSelected
				? selectedPlacementIds
				: [hit.entityId];
			const clusterBlocked = targetSelected && selectedClusterId !== null;
			const ineligible = postWriteIds.some((id) => !stagingEligibleIds.has(id));
			// P11.2 §3 — split: Scene *selection* is AA (a playing Director preview
			// may select), while the context-menu *mutation* reasons stay SB on
			// isDocumentMutationBlocked. Cluster/ineligible authority still blocks
			// selection (those are layout-authority, not preview-state).
			const selectionBlocked = clusterBlocked || ineligible;
			if (!selectionBlocked) {
				setArrangeOwner(interaction, 'scene');
				if (!targetSelected) onSceneSelect?.(hit.entityId, { additive: false, toggle: false });
			}
			const sceneAuthorityBlocked = store.isDocumentMutationBlocked
				? 'Preview is active'
				: clusterBlocked
					? 'Cluster selections are read-only in Plan.'
					: ineligible
						? 'Not editable in Plan. Edit position in 3D.'
						: null;
			event.preventDefault();
			contextMenu.open({
				surfaceId: 'scene-plan-arrange',
				x: event.clientX,
				y: event.clientY,
				items: buildArrangeContextMenuItems({
					target: { owner: 'scene', entityId: hit.entityId },
					sceneTargetHidden: store.isEntityHidden(hit.entityId),
					mutationBlockedReason: store.isDocumentMutationBlocked ? 'Preview is active' : null,
					sceneAuthorityBlockedReason: sceneAuthorityBlocked,
					actions: {
						deleteLayoutObject: deleteLayoutObjectViaTransaction,
						duplicateScene: () => store.duplicateSelection(),
						focusScene: (entityId) => void store.focusPlacement(entityId),
						toggleSceneVisibility: (entityId) => store.toggleEntityVisibility(entityId),
						deleteScene: () =>
							store.deletePlacements([...store.selectedPlacementIds])
					}
				})
			});
			return;
		}

		// ── Layout mode ──
		if (interaction.tool !== 'select') return;
		const tolerance = LAYOUT_PLAN_HIT_RADIUS_PX / interaction.planView.pixelsPerMeter;
		const target = resolvePlanHit(model.queries, point, tolerance);
		if (!target) return;
		if (
			target.kind !== 'room' &&
			target.kind !== 'opening' &&
			target.kind !== 'object' &&
			// P23.10 — a canonical physical-Wall body hit carries its already
			// resolved projection, so the Wall target needs no second resolver.
			target.kind !== 'physicalWall'
		) {
			return; // vertex/opening-endpoint/anchor targets have no approved v1 items
		}
		// selection-before-menu mirrors the click path's slot writes
		if (
			target.kind === 'room' &&
			(interaction.selection.kind !== 'room' || interaction.selection.roomId !== target.roomId)
		) {
			selectLayoutRoom(interaction, target.roomId);
		} else if (
			target.kind === 'opening' &&
			(interaction.selection.kind !== 'opening' ||
				interaction.selection.roomId !== target.roomId ||
				interaction.selection.segmentId !== target.segmentId ||
				interaction.selection.openingId !== target.openingId)
		) {
			selectLayoutOpening(interaction, target.roomId, target.segmentId, target.openingId);
		} else if (
			target.kind === 'object' &&
			(interaction.selection.kind !== 'object' || interaction.selection.objectId !== target.objectId)
		) {
			selectLayoutObject(interaction, target.objectId);
		} else if (
			target.kind === 'physicalWall' &&
			(interaction.selection.kind !== 'physicalWall' ||
				interaction.selection.wallId !== target.wallId)
		) {
			// P23.10 — a right-click keeps the clicked Wall selected so the command
			// acts on the same primitive the user pointed at.
			selectLayoutPhysicalWall(interaction, target.wallId);
		}
		event.preventDefault();
		contextMenu.open({
			surfaceId: 'scene-plan-layout',
			x: event.clientX,
			y: event.clientY,
			items: buildPlanLayoutContextMenuItems({
				target:
					target.kind === 'room'
						? { kind: 'room', roomId: target.roomId }
						: target.kind === 'opening'
							? { kind: 'opening', roomId: target.roomId, openingId: target.openingId }
							: target.kind === 'physicalWall'
								? {
										kind: 'wall',
										wallId: target.wallId,
										// Canonical-start meters straight from the hit projection.
										splitDistance: target.projection.offset
									}
								: { kind: 'object', objectId: target.objectId },
				mutationBlockedReason:
					store.isDocumentMutationBlocked ? 'Preview is active' : null,
				// P23.6d — wall-first Rooms expose ONLY the canonical removal. The
				// legacy `renameRoom`/`deleteRoom` commands resolve through
				// `layout.floors`/`deleteLayoutRoom` and REJECT wall-first documents,
				// so exposing them would be a dead menu item (the same
				// omit-don't-dummy policy the hierarchy Room menu follows).
				actions: wallFirstLayoutDocument()
					? {
							removeRoom: (roomId) => void onRoomRemove?.(roomId),
							deleteOpening: (roomId, openingId) => onOpeningDelete(roomId, openingId),
							deleteObject: deleteLayoutObjectViaTransaction,
							// P23.10 — omitted (never stubbed) when the mount cannot subdivide.
							...(onWallJunctionAdd
								? {
										addJunction: (wallId: string, splitDistance: number) =>
											onWallJunctionAdd?.(wallId, splitDistance)
									}
								: {}),
							// P23.11 — the no-keyboard authoring path. **Add bend point here**
							// reaches the same canonical insertion authority the Bend command
							// uses, so discoverability never costs a second implementation.
							...(onWallBendPointAdd
								? {
										addBendPoint: (wallId: string, bendDistance: number) =>
											onWallBendPointAdd?.(wallId, bendDistance)
									}
								: {}),
							...(onWallDelete ? { deleteWall: (wallId: string) => onWallDelete?.(wallId) } : {})
						}
					: {
							renameRoom: renameRoomViaPrompt,
							deleteRoom: (roomId) => void onRoomDelete(roomId),
							deleteOpening: (roomId, openingId) => onOpeningDelete(roomId, openingId),
							deleteObject: deleteLayoutObjectViaTransaction
						}
			})
		});
	}

	/** Existing guarded transaction pattern (same as the Delete-key path). */
	function deleteLayoutObjectViaTransaction(objectId: string): void {
		if (!onLayoutTransactionBegin()) {
			preview.statusMessage = 'Finish the current layout interaction first';
			return;
		}
		const result = deleteLayoutObject(preview, objectId);
		if (result.success) {
			onLayoutTransactionCommit();
			clearLayoutSelection(interaction);
		} else {
			onLayoutTransactionCancel();
		}
		preview.statusMessage = result.success ? 'Deleted layout object' : result.message;
	}

	/** Rename reuses the existing room-fields command via a prompt (v1). */
	function renameRoomViaPrompt(roomId: string): void {
		const room = rooms.find((candidate) => candidate.id === roomId);
		const next = window.prompt('Room name', room?.name ?? '')?.trim();
		if (!next || next === room?.name) return;
		if (!onLayoutTransactionBegin()) {
			preview.statusMessage = 'Finish the current layout interaction first';
			return;
		}
		const result = updateLayoutRoomFields(preview, roomId, { name: next });
		if (result.success) onLayoutTransactionCommit();
		else onLayoutTransactionCancel();
		preview.statusMessage = result.success ? 'Renamed room' : result.message;
	}

	/** P10/P3.3 — the shared Arrange candidate set for hit resolution. */
	function arrangeHitCandidates() {
		return {
			layoutObjects: model.objects
				.filter((object) => !object.readonly)
				.map((object) => ({
					objectId: object.objectId,
					points: object.planFootprint,
					selected: arrangeActiveLayoutObject === object.objectId
				})),
			sceneFootprints: (sceneProjection?.footprints ?? []).map((footprint) => ({
				entityId: footprint.entityId,
				points: footprint.points,
				selected: arrangeActiveScene !== null && selectedPlacementIds.includes(footprint.entityId)
			})),
			edgeHaloMeters: PLAN_SCENE_HIT_HALO_PX / interaction.planView.pixelsPerMeter
		};
	}

	function beginArrangeLayoutObjectRotate(
		event: PointerEvent,
		objectId: string,
		point: LayoutVec2
	): boolean {
		const object = model.objects.find((candidate) => candidate.objectId === objectId);
		if (!object || object.readonly || !svgElement) return false;
		if (!onLayoutTransactionBegin()) return false;
		pointerId = event.pointerId;
		svgElement.setPointerCapture(event.pointerId);
		beginLayoutObjectRotateDrag(
			interaction,
			objectId,
			object.position,
			object.rotation,
			point,
			[object.position[0], object.position[2]]
		);
		return true;
	}

	function beginStagingGesture(
		event: PointerEvent,
		mode: 'translate' | 'rotate',
		ids: readonly string[],
		primaryId: string,
		startWorld: LayoutVec2,
		startScreen: LayoutVec2,
		plainClickEntityId: string | null = null
	): boolean {
		if (!scene || !svgElement || !onSceneGestureBegin?.()) return false;
		const members = capturePlanSceneTransformMembers(scene, ids);
		if (!members) {
			onSceneGestureCancel?.();
			return false;
		}
		stagingGesture = {
			pointerId: event.pointerId,
			mode,
			primaryId,
			members,
			startWorld: [...startWorld],
			startScreen: [...startScreen],
			moved: false,
			plainClickEntityId
		};
		svgElement.setPointerCapture(event.pointerId);
		return true;
	}

	function cancelStagingGesture(): void {
		const gesture = stagingGesture;
		if (!gesture) return;
		onSceneGestureCancel?.();
		if (svgElement?.hasPointerCapture(gesture.pointerId)) {
			svgElement.releasePointerCapture(gesture.pointerId);
		}
		stagingGesture = null;
		stagingRotationHoverScreen = null;
		stagingYawFeedback = null;
	}

	function previewStagingGesture(event: PointerEvent): void {
		const gesture = stagingGesture;
		if (!gesture || gesture.pointerId !== event.pointerId || !sceneRooms) return;
		const point = worldPoint(event);
		const screen = screenPoint(event);
		if (!point || !screen) return;
		if (!gesture.moved && distance(screen, gesture.startScreen) < 2) return;
		gesture.moved = true;
		const patches = gesture.mode === 'translate'
			? translatePlanSceneMembers(
					gesture.members,
					sceneRooms,
					gesture.primaryId,
					gesture.startWorld,
					point,
					{ snapEnabled: interaction.planView.snapEnabled, bypassSnap: event.shiftKey }
				)
			: rotatePlanSceneMembers(
					gesture.members,
					sceneRooms,
					gesture.primaryId,
					gesture.startWorld,
					point,
					event.shiftKey
				);
		if (!patches || !onSceneGesturePreview?.(patches)) cancelStagingGesture();
		// P3.3 — track the primary member's live yaw for the degree label.
		else if (gesture.mode === 'rotate') {
			const patch = patches.find((candidate) => candidate.id === gesture.primaryId);
			stagingYawFeedback = patch ? patch.rotation[1] : null;
		}
	}

	function clearArrangeHover(): void {
		arrangeHover = null;
		stagingYawFeedback = null;
	}

	function canResolveSceneBridge(): boolean {
		return (
			active &&
			interaction.planViewMode === 'layout' &&
			interaction.tool === 'select' &&
			pointerId === null &&
			panPointerId === null &&
			pendingWallBend === null &&
			interiorAnchorPointerId === null &&
			openingDrag === null &&
			interaction.primitiveDraft === null &&
			interaction.objectDrag === null &&
			interaction.roomUnitDrag === null &&
			interaction.architectureEdit === null &&
			interaction.editing === null
		);
	}

	function updateSceneBridge(event: PointerEvent): void {
		if (!canResolveSceneBridge() || !sceneProjection) {
			dismissSceneBridge();
			return;
		}
		const point = worldPoint(event);
		const screen = screenPoint(event);
		if (!point || !screen) {
			dismissSceneBridge();
			return;
		}
		const hit = resolvePlanSceneHitAtZoom(
			sceneProjection.footprints,
			point,
			interaction.planView.pixelsPerMeter,
			PLAN_SCENE_HIT_HALO_PX
		);
		if (!hit) {
			dismissSceneBridge();
			return;
		}
		sceneBridgeHover = { entityId: hit.entityId, screen };
	}

	function activateSceneBridge(): void {
		const entityId = sceneBridgeHover?.entityId;
		if (!entityId) return;
		dismissSceneBridge();
		if (onEnterStaging) onEnterStaging(entityId);
		else onPlanModeChange?.('staging');
	}

	function draftPoint(event: PointerEvent, anchor: LayoutVec2 | null): LayoutVec2 | null {
		const raw = worldPoint(event);
		if (!raw) return null;
		let point = raw;
		if (anchor && event.shiftKey && interaction.planView.angleSnapEnabled) {
			point = constrainToAngle(anchor, point);
		}
		return applyLayoutSnap(point);
	}

	function isPrimitiveTool(tool: LayoutInteractionState['tool']): tool is 'box' | 'cylinder' | 'sphere' {
		return tool === 'box' || tool === 'cylinder' || tool === 'sphere';
	}

	function updatePrimitiveAt(point: LayoutVec2): void {
		if ('formatVersion' in preview.project.layout) return;
		const floor = preview.project.layout.floors[0];
		const draft = interaction.primitiveDraft;
		if (!draft) return;
		const center = primitiveDraftCenter({ ...draft, current: point });
		const allowedRoomIds = new Set((floor?.rooms ?? []).map((room) => room.id));
		const room = findPlanHitRoom(model.queries, center, { allowedRoomIds });
		updateLayoutPrimitiveDraft(interaction, point, room?.roomId);
	}

	/** P23.2 — a moving interior anchor's current world point (self-snap exclusion). */
	function movingInteriorAnchorPoint(drag: {
		roomId: string;
		segmentId: string;
		anchorId: string;
	}): LayoutVec2 | null {
		const room = findLayoutRoom(rooms, drag.roomId);
		const segment = room?.boundary.segments.find((candidate) => candidate.id === drag.segmentId);
		if (!segment || segment.kind !== 'auto-bezier') return null;
		return (
			segment.interiorAnchors.find((candidate) => candidate.id === drag.anchorId)?.point ?? null
		);
	}

	/**
	 * P23.2 — the ONE legacy interior-anchor drag resolver.
	 *
	 * `pointermove` previews through it and `pointerup` re-runs it with the
	 * RELEASE coordinate, so the committed candidate is always the output of the
	 * same snap + `updateLayoutWallInteriorAnchor()` path that produced the
	 * preview — never a second planner and never a re-implementation. The moving
	 * anchor excludes its own room-qualified segment (spans + endpoints) and its
	 * own current point so it cannot self-snap; other walls and junctions stay
	 * valid semantic targets.
	 *
	 * Legacy-only by construction: the target can exist only while the compiler
	 * emits `interior-anchor` query points, which it does solely for an
	 * `auto-bezier` room-boundary segment, and the mutation itself refuses a
	 * wall-first document (`wallFirstLegacyEditMessage()`). Canonical Walls
	 * compile to `line`/`cubic-chain` segments, so no canonical curved Wall can
	 * reach this gesture.
	 */
	function planInteriorAnchorDrag(
		drag: { roomId: string; segmentId: string; anchorId: string },
		point: LayoutVec2
	): LayoutRoomEditResult {
		const anchorPoint = movingInteriorAnchorPoint(drag);
		const next = applyLayoutSnap(point, {
			// Typed, room-qualified wall ownership: moving this room's
			// segment never suppresses another room's same-named wall.
			excludeOwners: new Set([wallOwnerKey(preview.geometry, drag.roomId, drag.segmentId)]),
			...(anchorPoint ? { excludePoints: [anchorPoint] } : {})
		});
		return updateLayoutWallInteriorAnchor(preview, drag.roomId, drag.segmentId, drag.anchorId, next);
	}

	function beginInteriorAnchorDrag(
		event: PointerEvent,
		roomId: string,
		segmentId: string,
		anchorId: string
	) {
		if (!svgElement) return;
		if (!dragSnapshot) dragSnapshot = captureLayoutPreviewSnapshot(preview);
		selectLayoutInteriorAnchor(interaction, roomId, segmentId, anchorId);
		interiorAnchorPointerId = event.pointerId;
		draggedInteriorAnchor = { roomId, segmentId, anchorId };
		// The press only *acquires* the anchor (the hit has a radius): the
		// pointer-down screen origin is frozen here, and below the shared drag
		// threshold nothing is proposed.
		interiorAnchorStartScreen = screenPoint(event);
		interiorAnchorMoved = false;
		svgElement.setPointerCapture(event.pointerId);
	}

	function clearActiveLayoutDrag() {
		interiorAnchorPointerId = null;
		draggedInteriorAnchor = null;
		interiorAnchorStartScreen = null;
		interiorAnchorMoved = false;
		pendingWallBend = null;
		openingDrag = null;
		cancelLayoutWallOpeningDrag(interaction);
		dragSnapshot = null;
		roomUnitSnapshot = null;
		rotationHoverScreen = null;
		pointerId = null;
	}

	function cancelActiveLayoutDrag() {
		clearLayoutSnapFeedback();
		if (dragSnapshot) restoreLayoutPreviewSnapshot(preview, dragSnapshot);
		onLayoutTransactionCancel();
		clearActiveLayoutDrag();
		suppressNextClick = true;
	}

	function beginRoomUnitDrag(
		event: PointerEvent,
		roomId: string,
		mode: 'translate' | 'rotate',
		point: LayoutVec2,
		pivot: LayoutVec2,
		groupRoomIds: readonly string[] = []
	): boolean {
		if (!svgElement || !onLayoutTransactionBegin()) return false;
		roomUnitSnapshot = captureLayoutPreviewSnapshot(preview);
		beginLayoutRoomUnitDrag(interaction, roomId, mode, point, pivot, groupRoomIds);
		pointerId = event.pointerId;
		svgElement.setPointerCapture(event.pointerId);
		return true;
	}

	function rotationHandleHit(screen: LayoutVec2): LayoutRoom | null {
		if (interaction.selection.kind !== 'room') return null;
		const room = findLayoutRoom(rooms, interaction.selection.roomId);
		if (!room) return null;
		const handle = rotationHandleScreenPoint(interaction.planView, interactionProjection);
		return handle && distance(handle, screen) <= LAYOUT_PLAN_HIT_RADIUS_PX ? room : null;
	}

	/** Canonical wall-first Layout document, or null when the preview is legacy. */
	function wallFirstLayoutDocument(): LayoutDocumentWallFirst | null {
		const layout = preview.project.layout;
		return 'formatVersion' in layout ? (layout as unknown as LayoutDocumentWallFirst) : null;
	}

	/** Document-exact canonical Wall length (meters from the Wall start). */
	function wallFirstWallLengthFor(wallId: string): number | null {
		const layout = wallFirstLayoutDocument();
		if (!layout) return null;
		return wallFirstWallLength(layout, wallId) ?? null;
	}

	/** The authored canonical Opening record, or null. */
	function wallFirstOpeningById(openingId: string) {
		return wallFirstLayoutDocument()?.openings.find((opening) => opening.id === openingId) ?? null;
	}

	/**
	 * P23.3 — screen positions of the selected canonical Opening's two width
	 * handles. ONE source (plan-overlays) for the rendered handles and this hit
	 * test, so the affordance and its hit region can never drift apart.
	 */
	function wallOpeningHandleScreenPoints(): { start: LayoutVec2; end: LayoutVec2 } | null {
		const selection = interaction.selection;
		if (selection.kind !== 'wallOpening') return null;
		const edges = wallOpeningEdgeWorldPoints(model, selection.openingId);
		if (!edges) return null;
		const screen = planHandleScreenPoints(interaction.planView, edges.start, edges.end);
		return { start: screen.pivot, end: screen.handle };
	}

	function wallOpeningHandleHit(screen: LayoutVec2): 'start-edge' | 'end-edge' | null {
		const handles = wallOpeningHandleScreenPoints();
		if (!handles) return null;
		if (distance(handles.start, screen) <= LAYOUT_PLAN_HIT_RADIUS_PX) return 'start-edge';
		if (distance(handles.end, screen) <= LAYOUT_PLAN_HIT_RADIUS_PX) return 'end-edge';
		return null;
	}

	/**
	 * P23.3 — resolve one drag update through the P23.2 offset-space candidates
	 * and the raw-validity use-mode. A snap win is honored only when it was
	 * reachable without clamping; otherwise the raw candidate stands.
	 */
	function resolveWallOpeningDragUpdate(drag: LayoutWallOpeningDrag, rawOffset: number, wallLength: number) {
		const span = physicalWallSpan(model, drag.wallId);
		// P23.3 — body drags resolve in opening-center space; a width handle
		// resolves the moving edge directly in edge space (the snap candidate IS
		// the edge coordinate), never through a surrogate width.
		const anchor: OpeningDragAnchor =
			drag.mode === 'body' ? { kind: 'center', width: drag.baselineWidth } : { kind: 'edge' };
		const useMode =
			interaction.planView.snapEnabled && span
				? resolveOpeningDragSnapUseMode(
						preview.geometry,
						{ segmentId: drag.wallId, start: span.start, end: span.end },
						drag.openingId,
						rawOffset,
						{
							anchor,
							context: {
								pixelsPerMeter: interaction.planView.pixelsPerMeter,
								gridStep: LAYOUT_PLAN_GRID_STEP
							}
						}
					)
				: null;
		return updateLayoutWallOpeningDrag(interaction, {
			rawPointerOffset: rawOffset,
			snapOffset: useMode?.snappedOffset ?? null,
			wallLength
		});
	}

	/**
	 * P23.3 — one canonical Opening gesture: begin → (transient previews only)
	 * → validate once → commit once, or cancel with no history. The document is
	 * never written during the gesture.
	 */
	function beginWallOpeningDrag(
		event: PointerEvent,
		opening: { id: string; wallId: string; offset: number; width: number },
		mode: LayoutWallOpeningDragMode,
		wallLength: number
	): boolean {
		if (!svgElement || !onLayoutTransactionBegin()) return false;
		dragSnapshot = captureLayoutPreviewSnapshot(preview);
		selectLayoutWallOpening(interaction, opening.wallId, opening.id);
		beginLayoutWallOpeningDrag(interaction, {
			mode,
			wallId: opening.wallId,
			openingId: opening.id,
			offset: opening.offset,
			width: opening.width,
			wallLength
		});
		pointerId = event.pointerId;
		svgElement.setPointerCapture(event.pointerId);
		return true;
	}

	function beginPendingWallBend(event: PointerEvent) {
		const pending = pendingWallBend;
		if (!pending || pending.pointerId !== event.pointerId) return;
		if (!onLayoutTransactionBegin()) {
			pendingWallBend = null;
			return;
		}
		dragSnapshot = captureLayoutPreviewSnapshot(preview);
		const inserted = insertLayoutWallInteriorAnchor(
			preview,
			pending.roomId,
			pending.segmentId,
			pending.projectionPoint
		);
		pendingWallBend = null;
		if (inserted.success) {
			beginInteriorAnchorDrag(event, pending.roomId, pending.segmentId, inserted.anchorId);
			return;
		}
		dragSnapshot = null;
		onLayoutTransactionCancel();
	}

	function onPointerDown(event: PointerEvent) {
		if (event.button === 1) {
			dismissSceneBridge();
			const screen = screenPoint(event);
			if (!screen || !svgElement) return;
			panPointerId = event.pointerId;
			lastPanScreen = screen;
			svgElement.setPointerCapture(event.pointerId);
			event.preventDefault();
			return;
		}
		if (event.button !== 0) return;
		svgElement?.focus();
		const point = worldPoint(event);
		const screen = screenPoint(event);
		if (!point || !screen) return;
		dismissSceneBridge();

		if (interaction.planViewMode === 'staging') {
			if (interaction.tool !== 'select') return;
			// P10 — the active layout-object yaw handle comes first (Arrange owns
			// one Plan rotate handle per owner; only the active one renders).
			if (
				arrangeLayoutRotationHandle &&
				distance(screen, arrangeLayoutRotationHandle.handleScreen) <= LAYOUT_PLAN_HIT_RADIUS_PX
			) {
				beginArrangeLayoutObjectRotate(event, arrangeLayoutRotationHandle.objectId, point);
				return;
			}
			if (
				stagingRotationHandle &&
				distance(screen, stagingRotationHandle.handleScreen) <= LAYOUT_PLAN_HIT_RADIUS_PX
			) {
				beginStagingGesture(
					event,
					'rotate',
					selectedPlacementIds,
					stagingRotationHandle.primaryId,
					point,
					screen
				);
				return;
			}
			// Owner-aware Arrange hit: containment → selected-under-pointer →
			// visual topmost → stable order (see arrange-hit.ts).
			const arrangeHit = resolveArrangeHit({
				point,
				...arrangeHitCandidates()
			});
			if (arrangeHit?.owner === 'layout-object') {
				const object = model.objects.find((candidate) => candidate.objectId === arrangeHit.objectId);
				// Plain click writes the canonical Layout slot + switches the
				// Arrange owner; the inactive Scene slot stays as memory.
				selectLayoutObject(interaction, arrangeHit.objectId);
				setArrangeOwner(interaction, 'layout-object');
				if (object && !object.readonly && svgElement) {
					if (!onLayoutTransactionBegin()) return;
					pointerId = event.pointerId;
					svgElement.setPointerCapture(event.pointerId);
					beginLayoutObjectDrag(interaction, arrangeHit.objectId, object.position, object.rotation);
				}
				return;
			}
			if (arrangeHit?.owner === 'scene') {
				const sceneHit = arrangeHit;
				// P10 — cross-owner modifier-click replaces the active selection
				// with the clicked target (plan §Selection): when the pre-click
				// active target is a layout object, suppress additive/toggle and
				// treat the clicked entity as unselected so the remembered
				// Scene slot is replaced with a single entity — never dragged or
				// extended as a whole.
				const switchingFromLayout = arrangeActiveLayoutObject !== null;
				setArrangeOwner(interaction, 'scene');
				const { toggle, additive, alreadySelected } = resolveArrangeScenePick({
					switchingFromLayout,
					metaKey: event.metaKey,
					ctrlKey: event.ctrlKey,
					shiftKey: event.shiftKey,
					clickedAlreadySelected: selectedPlacementIds.includes(sceneHit.entityId)
				});
				let gestureIds: string[];
				let deferredPlainClick: string | null = null;
				if (toggle) {
					onSceneSelect?.(sceneHit.entityId, { additive: false, toggle: true });
					return;
				} else if (additive) {
					gestureIds = alreadySelected
						? [...selectedPlacementIds]
						: [...selectedPlacementIds, sceneHit.entityId];
					onSceneSelect?.(sceneHit.entityId, { additive: true, toggle: false });
				} else if (alreadySelected) {
					gestureIds = [...selectedPlacementIds];
					deferredPlainClick = sceneHit.entityId;
				} else {
					gestureIds = [sceneHit.entityId];
					onSceneSelect?.(sceneHit.entityId, { additive: false, toggle: false });
				}
				const eligible = gestureIds.every((id) => stagingEligibleIds.has(id));
				const clusterBlocked = selectedClusterId !== null && alreadySelected;
				if (eligible && !clusterBlocked) {
					beginStagingGesture(
						event,
					'translate',
					gestureIds,
					sceneHit.entityId,
					point,
					screen,
					deferredPlainClick
					);
				} else if (deferredPlainClick) {
					onSceneSelect?.(deferredPlainClick, { additive: false, toggle: false });
				}
				return;
			}
			onDeselect?.();
			return;
		}

		if (interaction.tool === 'select') {
			const rotationRoom = rotationHandleHit(screen);
			if (
				rotationRoom &&
				beginRoomUnitDrag(event, rotationRoom.id, 'rotate', point, layoutRoomUnitPivot(rotationRoom))
			)
				return;
		}

		if (interaction.tool === 'rectangle') {
			// P23.9 — Rectangle sketches a boundary chain on wall-first documents
			// too; only the commit path differs by document format.
			const snapped = draftPoint(event, null);
			if (!snapped || !svgElement) return;
			pointerId = event.pointerId;
			svgElement.setPointerCapture(event.pointerId);
			beginRectangle(interaction, snapped);
			return;
		}

		if (isPrimitiveTool(interaction.tool)) {
			if ('formatVersion' in preview.project.layout) return;
			const snapped = draftPoint(event, null);
			if (!snapped || !svgElement) return;
			if (!onLayoutTransactionBegin()) return;
			pointerId = event.pointerId;
			svgElement.setPointerCapture(event.pointerId);
			const allowedRoomIds = new Set((preview.project.layout.floors[0]?.rooms ?? []).map((room) => room.id));
			const room = findPlanHitRoom(model.queries, snapped, { allowedRoomIds });
			beginLayoutPrimitiveDraft(interaction, interaction.tool, snapped, room?.roomId);
			return;
		}

		if (interaction.tool === 'door' || interaction.tool === 'window') {
			const target = resolvePlanHit(
				model.queries,
				point,
				LAYOUT_PLAN_HIT_RADIUS_PX / interaction.planView.pixelsPerMeter,
				planHitEndpointGate()
			);
			if (wallFirstLayoutDocument()) {
				// P23.3 — canonical authoring resolves the hosting Wall by
				// document-global `wallId` (no `roomId`, no `segmentId`).
				if (target?.kind === 'wallOpening') {
					selectLayoutWallOpening(interaction, target.wallId, target.openingId);
					setLayoutDraftTool(interaction, 'select');
					return;
				}
				if (target?.kind === 'physicalWall') {
					onWallOpeningCreate?.(target.wallId, interaction.tool, target.projection.offset);
					setLayoutDraftTool(interaction, 'select');
				}
				return;
			}
			if (target?.kind === 'opening') {
				selectLayoutOpening(interaction, target.roomId, target.segmentId, target.openingId);
				setLayoutDraftTool(interaction, 'select');
				return;
			}
			if (target?.kind === 'wall') {
				onOpeningCreate(target.roomId, target.segmentId, interaction.tool, target.projection.offset);
				setLayoutDraftTool(interaction, 'select');
			}
			return;
		}

		// P23.5 — one-click architectural preset: the snapped click point is the
		// object's X/Z center; the canonical planner validates once and commits
		// one ordinary document-level object (nothing on reject, no history).
		// The tool stays armed for repeat placement; Escape disarms.
		if (isLayoutPresetTool(interaction.tool)) {
			if (!wallFirstLayoutDocument()) {
				preview.statusMessage = 'Column, Platform and Plinth placement requires a wall-first layout.';
				setLayoutDraftTool(interaction, 'select');
				return;
			}
			const snapped = draftPoint(event, null);
			if (!snapped) return;
			if (!onLayoutTransactionBegin()) {
				preview.statusMessage = 'Finish the current layout interaction first';
				return;
			}
			const presetId: LayoutArchitecturalPresetId = presetIdForTool(interaction.tool);
			const presetLabel = layoutArchitecturalPreset(presetId)?.label ?? presetId;
			const result = commitLayoutObjectPreset(preview, presetId, snapped);
			if (result.success) {
				selectLayoutObject(interaction, result.objectId);
				preview.statusMessage = `Created ${presetLabel}`;
				onLayoutTransactionCommit();
			} else {
				preview.statusMessage = result.message;
				onLayoutTransactionCancel();
			}
			cancelLayoutPresetDraft(interaction);
			return;
		}

		if (interaction.tool !== 'select') return;
		const target = resolvePlanHit(
			model.queries,
			point,
			LAYOUT_PLAN_HIT_RADIUS_PX / interaction.planView.pixelsPerMeter,
			planHitOptions()
		);
		if (!target) {
			// a Plan empty-click deselects whichever domain is active (a
			// scene/camera pick may have survived into Plan); default keeps the
			// layout-only clear.
			if (onDeselect) onDeselect();
			else clearLayoutSelection(interaction);
			return;
		}
		if (target.kind === 'vertex') {
			const room = findLayoutRoom(rooms, target.roomId);
			if (!room) return;
			selectLayoutRoom(interaction, target.roomId);
			if (svgElement) {
				if (!onLayoutTransactionBegin()) return;
				pointerId = event.pointerId;
				svgElement.setPointerCapture(event.pointerId);
				beginRoomEdit(interaction, 'vertex', target.roomId, point, roomVertices(room), target.vertexIndex);
			}
			return;
		}
		if (target.kind === 'wallEndpoint') {
			// P23.6 — canonical Junction select: endpoint identity resolves
			// through the wall-first document (same selection authority).
			const junctionId = wallEndpointJunctionId(target.wallId, target.endpoint);
			if (!junctionId) return;
			// P23.10 — a non-primary contact never owns a direct edit, and a
			// second contact during a live gesture must not move the selection
			// out from under it. Checked BEFORE the select, because the gesture
			// start itself would refuse the contact.
			if (!event.isPrimary || interaction.architectureEdit) return;
			selectLayoutJunction(interaction, junctionId);
			// P23.10 — a Wall endpoint handle IS that canonical Junction, so a
			// primary drag reshapes every incident Wall through one Junction move.
			// Below the drag threshold the press stays a plain select.
			const baselinePoint = resolveJunctionPoint(junctionId);
			if (!baselinePoint) return;
			beginArchitectureEditGesture(event, {
				kind: 'junction-move',
				junctionId,
				baselinePoint,
				junctionExcludePoints: architectureEditJunctionExcludePoints(),
				affectedWallIds: architectureEditAffectedWallIds([junctionId])
			});
			return;
		}
		if (target.kind === 'interiorAnchor') {
			if (!onLayoutTransactionBegin()) return;
			beginInteriorAnchorDrag(event, target.roomId, target.segmentId, target.anchorId);
			return;
		}
		if (target.kind === 'wallOpening') {
			// P23.3 — canonical opening select/drag: body drag centers on the
			// pointer, width handles move one edge with the opposite edge fixed.
			const opening = wallFirstOpeningById(target.openingId);
			const wallLength = wallFirstWallLengthFor(target.wallId);
			if (!opening || wallLength === null) return;
			const handleEdge =
				interaction.selection.kind === 'wallOpening' &&
				interaction.selection.openingId === target.openingId
					? wallOpeningHandleHit(screen)
					: null;
			if (beginWallOpeningDrag(event, opening, handleEdge ?? 'body', wallLength)) return;
			selectLayoutWallOpening(interaction, target.wallId, target.openingId);
			return;
		}
		if (target.kind === 'opening') {
			const room = findLayoutRoom(rooms, target.roomId);
			const opening = room?.openings.find((candidate) => candidate.id === target.openingId);
			selectLayoutOpening(interaction, target.roomId, target.segmentId, target.openingId);
			if (svgElement) {
				if (!onLayoutTransactionBegin()) return;
				dragSnapshot = captureLayoutPreviewSnapshot(preview);
				openingDrag = {
					roomId: target.roomId,
					segmentId: target.segmentId,
					openingId: target.openingId,
					width: opening?.width ?? 0
				};
				pointerId = event.pointerId;
				svgElement.setPointerCapture(event.pointerId);
			}
			return;
		}
		if (target.kind === 'object') {
			const object = model.objects.find((candidate) => candidate.objectId === target.objectId);
			selectLayoutObject(interaction, target.objectId);
			if (object && !object.readonly && svgElement) {
				if (!onLayoutTransactionBegin()) return;
				pointerId = event.pointerId;
				svgElement.setPointerCapture(event.pointerId);
				beginLayoutObjectDrag(interaction, target.objectId, object.position);
			}
			return;
		}
		if (target.kind === 'wall') {
			selectLayoutWall(interaction, target.roomId, target.segmentId);
			// P23.11 — the legacy Room-owned Wall no longer bends on a plain body
			// drag: the same `layout.wall.bend` intent that bends a canonical Wall
			// owns this gesture too, so the two representations stop contradicting
			// each other. The legacy writer below is unchanged — only its ownership
			// moved behind the intent — and legacy Room-owned curves are neither
			// revived nor promoted to authority. A plain press selects and stops.
			if (!commandIntentFor(event).has('layout.wall.bend')) return;
			if (!svgElement) return;
			const projected = applyLayoutSnap(target.projection.point, {
				excludeOwners: new Set([
					wallOwnerKey(preview.geometry, target.roomId, target.segmentId)
				])
			});
			pendingWallBend = {
				pointerId: event.pointerId,
				roomId: target.roomId,
				segmentId: target.segmentId,
				projectionPoint: projected,
				originScreen: screen
			};
			svgElement.setPointerCapture(event.pointerId);
			return;
		}

		// P23.11 — an interior curve control of the selected curved Wall. The
		// Wall STAYS the selection for the whole gesture: a control is transient
		// editing state, so no second selection slot is written and no hierarchy
		// row is invented. A non-primary contact and a second contact during a
		// live gesture are refused, exactly like the other direct edits.
		if (target.kind === 'wallCurveControl') {
			if (!event.isPrimary || interaction.architectureEdit) return;
			const anchor = wallFirstLayoutDocument()
				?.walls.find((candidate) => candidate.id === target.wallId)
				?.centerline;
			const baselineAnchorPoint =
				anchor?.kind === 'cubic-chain'
					? anchor.knots.find((candidate) => candidate.id === target.anchorId)?.point
					: undefined;
			if (!baselineAnchorPoint) return;
			selectLayoutPhysicalWall(interaction, target.wallId);
			beginArchitectureEditGesture(event, {
				kind: 'curve-control-move',
				wallId: target.wallId,
				anchorId: target.anchorId,
				baselineAnchorPoint: [...baselineAnchorPoint] as LayoutVec2,
				// A control may not land on a Junction coordinate: the resulting
				// degenerate segment can only be rejected, so honoring that snap
				// family would install a guaranteed rejection as the winner.
				curveExcludePoints: architectureEditJunctionExcludePoints()
			});
			return;
		}

		// P23.6 — a canonical physical-Wall hit selects the Wall on the one
		// selection authority (no Room-unit target, no wall bend gesture yet).
		if (target.kind === 'physicalWall') {
			if (!event.isPrimary || interaction.architectureEdit) return;
			selectLayoutPhysicalWall(interaction, target.wallId);
			// P23.11 — the Bend command owns this press when its intent is live:
			// the grabbed physical arc position becomes a bend point and the drag
			// continues as that knot. The intent is resolved at THIS instant and
			// frozen into the gesture, so releasing the modifier mid-drag keeps the
			// bend and pressing it mid-drag never steals a rigid move.
			if (commandIntentFor(event).has('layout.wall.bend')) {
				beginArchitectureEditGesture(event, {
					kind: 'wall-bend',
					command: 'layout.wall.bend',
					wallId: target.wallId,
					grabPoint: [...target.projection.point] as LayoutVec2,
					// Canonical-start metres straight from the hit projection, so the
					// viewport never re-measures the Wall or guesses a position.
					bendDistance: target.projection.offset,
					bendExcludePoints: architectureEditJunctionExcludePoints()
				});
				return;
			}
			// P23.10 — a body drag translates the Wall rigidly: both endpoint
			// Junctions move by ONE delta, so the Wall keeps ID, role, thickness,
			// height, endpoint order, length and angle. An Opening body/handle hit
			// already won the priority above, so a door/window drag never reaches
			// this branch.
			const wall = wallFirstLayoutDocument()?.walls.find(
				(candidate) => candidate.id === target.wallId
			);
			if (!wall) return;
			const baselineStart = resolveJunctionPoint(wall.startJunctionId);
			const baselineEnd = resolveJunctionPoint(wall.endJunctionId);
			if (!baselineStart || !baselineEnd) return;
			beginArchitectureEditGesture(event, {
				kind: 'wall-move',
				wallId: wall.id,
				grabPoint: [...target.projection.point] as LayoutVec2,
				startJunctionId: wall.startJunctionId,
				endJunctionId: wall.endJunctionId,
				baselineStart,
				baselineEnd,
				affectedWallIds: architectureEditAffectedWallIds([
					wall.startJunctionId,
					wall.endJunctionId
				])
			});
			return;
		}

		if (target.kind !== 'room') return;
		const legacyRoom = findLayoutRoom(rooms, target.roomId);
		if (legacyRoom) {
			selectLayoutRoom(interaction, target.roomId);
			beginRoomUnitDrag(
				event,
				legacyRoom.id,
				'translate',
				point,
				layoutRoomUnitPivot(legacyRoom)
			);
			return;
		}
		// P23.6a — wall-first Room: select on the one selection authority, then
		// start a rigid whole-unit move **only** when the shared isolation policy
		// proves the boundary graph can translate without detaching stationary
		// architecture. An ineligible Room selects without opening a transaction.
		if (wallFirstLayoutDocument()?.rooms.some((room) => room.id === target.roomId)) {
			selectLayoutRoom(interaction, target.roomId);
			const eligibility = wallFirstRoomMoveEligibility(preview, target.roomId);
			if (!eligibility.movable) {
				// The adapter owns the phrasing; the viewport never re-derives policy.
				preview.statusMessage = eligibility.hint;
				return;
			}
			// Translation mode reads only `startWorld`, so the pointer-down world
			// point is the pivot: no Room centroid is derived and no canonical
			// Room-position field is invented (rotation stays deferred). The
			// eligible unit is the connected Room group, so every member travels.
			beginRoomUnitDrag(
				event,
				target.roomId,
				'translate',
				point,
				point,
				eligibility.subgraph.roomIds
			);
		}
	}

	function onPointerMove(event: PointerEvent) {
		// P23.9 segment-first — pending segment preview follows the snapped
		// cursor once a run has started. `pointerleave` clears only the
		// cursor/snap preview, never the run (click-click needs SVG exit).
		if (wallChainRoleForTool(interaction.tool) !== null && interaction.planViewMode === 'layout') {
			if (hasWallChainRun(interaction)) {
				const point = worldPoint(event);
				updateWallChainCursor(interaction, point ? applyLayoutSnap(point) : null);
			} else if (interaction.wallChainCursor) {
				updateWallChainCursor(interaction, null);
			}
		}
		// P23.5 — an armed preset tool previews its footprint at the snapped
		// cursor (presentation only; the click commits). Hover never opens a
		// history transaction and never blocks other mutations.
		if (
			isLayoutPresetTool(interaction.tool) &&
			interaction.planViewMode === 'layout' &&
			pointerId === null &&
			panPointerId === null
		) {
			const hover = draftPoint(event, null);
			if (hover) beginLayoutPresetDraft(interaction, interaction.tool, hover);
			else cancelLayoutPresetDraft(interaction);
		}
		if (stagingGesture?.pointerId === event.pointerId) {
			previewStagingGesture(event);
			return;
		}
		if (interaction.planViewMode === 'staging') {
			stagingRotationHoverScreen = screenPoint(event);
			arrangeLayoutRotationHoverScreen = screenPoint(event);
			// P3.3 — presentation-only hover: resolve the same owner-aware hit
			// the click path uses, but only to highlight the footprint. No
			// selection or document writes; hover never looks selected.
			const hoverPoint = worldPoint(event);
			if (interaction.tool === 'select' && !stagingGesture && !interaction.objectDrag && hoverPoint) {
				const hoverHit = resolveArrangeHit({ point: hoverPoint, ...arrangeHitCandidates() });
				const next = hoverHit
					? { owner: hoverHit.owner, id: hoverHit.owner === 'scene' ? hoverHit.entityId : hoverHit.objectId }
					: null;
				if (
					(arrangeHover?.owner ?? null) !== (next?.owner ?? null) ||
					(arrangeHover?.id ?? null) !== (next?.id ?? null)
				) {
					arrangeHover = next;
				}
			} else if (arrangeHover) {
				arrangeHover = null;
			}
		} else if (arrangeHover) {
			arrangeHover = null;
		}
		// P23.6 — canonical Wall/Junction/Opening hover in layout mode: same
		// hit priority as click, presentation only. Quiescent select tool
		// only; any drag, transaction gesture, or armed tool clears it.
		if (
			interaction.tool === 'select' &&
			interaction.planViewMode === 'layout' &&
			pointerId === null &&
			panPointerId === null &&
			!stagingGesture &&
			!interaction.objectDrag &&
			!interaction.roomUnitDrag &&
			!interaction.architectureEdit &&
			!interaction.editing &&
			!interaction.wallOpeningDrag &&
			!openingDrag &&
			!pendingWallBend
		) {
			const hoverPoint = worldPoint(event);
			const hoverHit =
				hoverPoint === null
					? null
					: resolvePlanHit(
							model.queries,
							hoverPoint,
							LAYOUT_PLAN_HIT_RADIUS_PX / interaction.planView.pixelsPerMeter,
							planHitOptions()
						);
			layoutHover = toLayoutHover(hoverHit);
		} else if (layoutHover) {
			layoutHover = null;
		}
		if (interaction.tool === 'select' && !interaction.roomUnitDrag) {
			rotationHoverScreen = screenPoint(event);
		}
		if (canResolveSceneBridge()) updateSceneBridge(event);
		else dismissSceneBridge();
		if (interaction.primitiveDraft && pointerId === event.pointerId) {
			const point = draftPoint(event, null);
			if (point) updatePrimitiveAt(point);
			return;
		}
		if (panPointerId === event.pointerId && lastPanScreen) {
			const screen = screenPoint(event);
			if (!screen) return;
			panPlanViewport(interaction.planView, [screen[0] - lastPanScreen[0], screen[1] - lastPanScreen[1]]);
			lastPanScreen = screen;
			return;
		}
		if (pendingWallBend && pendingWallBend.pointerId === event.pointerId) {
			const screen = screenPoint(event);
			if (!screen) return;
			if (shouldBeginWallBend(pendingWallBend.originScreen, screen)) {
				beginPendingWallBend(event);
			}
			return;
		}
		if (interiorAnchorPointerId === event.pointerId && draggedInteriorAnchor) {
			const point = worldPoint(event);
			const screen = screenPoint(event);
			if (!point || !screen) return;
			// Below the shared drag threshold the press is still a plain click: the
			// anchor must not drift by its own hit radius, so nothing is proposed.
			if (!interiorAnchorMoved) {
				if (!shouldBeginWallBend(interiorAnchorStartScreen ?? screen, screen)) return;
				interiorAnchorMoved = true;
			}
			// P23.2 — preview and release share one resolver.
			planInteriorAnchorDrag(draggedInteriorAnchor, point);
			return;
		}
		if (interaction.architectureEdit && interaction.architectureEdit.pointerId === event.pointerId) {
			const isBend = interaction.architectureEdit.kind === 'wall-bend';
			const enabled = import.meta.env.DEV && (globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__;
			let start = '';
			if (isBend && enabled) {
				if (lastBendPointerTime !== null) {
					performance.measure('p2311:pointer-cadence', { start: lastBendPointerTime, end: event.timeStamp });
				}
				lastBendPointerTime = event.timeStamp;
				start = `p2311:pointer-start:${event.timeStamp}`;
				performance.mark(start);
			}
			p2311Measure(isBend ? 'pointermove-bend' : 'pointermove-rigid', () => previewArchitectureEdit(event));
			if (start) {
				void tick().then(() => {
					performance.measure('p2311:svg-flush-latency', start);
					requestAnimationFrame(() => {
						performance.measure('p2311:next-frame-latency', start);
						performance.clearMarks(start);
					});
				});
			}
			return;
		}
		if (pointerId !== event.pointerId) return;
		if (interaction.roomUnitDrag && roomUnitSnapshot) {
			const point = worldPoint(event);
			if (!point) return;
			updateLayoutRoomUnitDrag(
				interaction,
				point,
				interaction.planView.snapEnabled,
				interaction.planView.angleSnapEnabled,
				event.shiftKey
			);
			const drag = interaction.roomUnitDrag;
			// Every candidate is derived from the immutable gesture baseline, and
			// its validity is recorded on the session (never inferred at release).
			restoreLayoutPreviewSnapshot(preview, roomUnitSnapshot);
			if (wallFirstLayoutDocument()) {
				const result = previewWallFirstRoomMove(preview, drag.roomId, drag.translation);
				drag.candidateValid = result.success;
				if (!result.success) preview.statusMessage = result.message;
				return;
			}
			const result = previewLayoutRoomUnit(preview, drag.roomId, {
				translation: drag.translation,
				yaw: drag.yaw
			});
			drag.candidateValid = result.success;
			if (!result.success) preview.statusMessage = result.message;
			return;
		}
		if (interaction.objectDrag) {
			const point = worldPoint(event);
			if (!point) {
				clearLayoutSnapFeedback();
				return;
			}
			if (interaction.objectDrag.mode === 'rotate') {
				// P23.2 — rotation gestures keep the raw pointer: yaw derives
				// from the pointer angle around the pivot and steps only via
				// Shift angle-snap. Snapping the pointer itself would make the
				// handle jump on grid/junction proximity.
				updateLayoutObjectDrag(
					interaction,
					point,
					false,
					event.shiftKey,
					interaction.planView.angleSnapEnabled
				);
				return;
			}
			const snapped = applyLayoutSnap(point, {
				excludeOwners: new Set([
					snapOwnerKey({ kind: 'object', id: interaction.objectDrag.objectId })
				])
			});
			// The point is already snap-resolved (semantic or grid fallback);
			// `false` stops the drag helper from re-rounding it to the grid.
			updateLayoutObjectDrag(
				interaction,
				snapped,
				false,
				event.shiftKey,
				interaction.planView.angleSnapEnabled
			);
			return;
		}
		if (interaction.wallOpeningDrag) {
			// P23.3 — transient only: the pointer resolves a raw candidate (plus an
			// optional honest snap win); nothing is written to the document here.
			const point = worldPoint(event);
			if (!point) return;
			const drag = interaction.wallOpeningDrag;
			const projection = projectPointToPhysicalWall(model.queries, drag.wallId, point);
			if (!projection) return;
			const wallLength =
				wallFirstWallLengthFor(drag.wallId) ??
				compiledPhysicalWallLength(model.queries, drag.wallId);
			resolveWallOpeningDragUpdate(drag, projection.offset, wallLength);
			return;
		}
		if (openingDrag) {
			const point = worldPoint(event);
			if (!point) return;
			const room = findLayoutRoom(rooms, openingDrag.roomId);
			const segment = room?.boundary.segments.find((candidate) => candidate.id === openingDrag!.segmentId);
			const projection = room && segment
				? projectPointToWall(model.queries, room.id, segment.id, point)
				: null;
			if (!room || !segment || !projection) return;
			const length = compiledWallLength(model.queries, room.id, segment.id);
			const width = openingDrag.width;
			const maxOffset = Math.max(0, length - width);
			const centered = projection.offset - width / 2;
			let offset: number;
			if (!interaction.planView.snapEnabled) {
				offset = Math.min(Math.max(0, centered), maxOffset);
			} else if (segment.kind === 'line') {
				// P23.2 — straight-wall opening drag resolves through the
				// offset-space semantic resolver (host-wall junctions,
				// midpoint, other openings' edges, grid fallback). The dragged
				// opening's own spans are skipped so its own edges can never
				// act as external snap targets; grid candidates snap the
				// opening center like opening creation. Curved (auto-bezier)
				// segments keep the legacy linear grid snap.
				const resolution = resolveOpeningDragSnap(
					preview.geometry,
					{ segmentId: segment.id, roomId: openingDrag.roomId, start: segment.start, end: segment.end },
					openingDrag.openingId,
					projection.offset,
					width,
					{ pixelsPerMeter: interaction.planView.pixelsPerMeter, gridStep: LAYOUT_PLAN_GRID_STEP }
				);
				offset = resolution?.kind === 'snap'
					? resolution.candidate.offset
					: Math.min(Math.max(0, centered), maxOffset);
			} else {
				offset = snapSegmentOffset(centered, maxOffset);
			}
			updateLayoutOpeningFields(preview, openingDrag.roomId, openingDrag.openingId, { offset });
			return;
		}
		if (interaction.tool === 'rectangle') {
			// P23.9/P23.3 — the rectangle drag updates the opposite corner on BOTH
			// document formats; only the commit path differs (canonical four-Wall
			// chain vs the legacy Room polygon). Skipping the update on a
			// wall-first document left `rectanglePoints` degenerate, so the drag
			// never drew anything and pointer-up committed nothing.
			const point = draftPoint(event, interaction.rectangleStart);
			if (point) updateRectangle(interaction, point);
			return;
		}
		if (interaction.tool === 'select' && interaction.editing) {
			const point = worldPoint(event);
			if (!point) {
				clearLayoutSnapFeedback();
				return;
			}
			const edit = interaction.editing;
			// P23.2 — a moving vertex excludes its own current point so it
			// cannot snap to itself; rigid room translates share one resolved
			// target exactly like the legacy grid behavior.
			const excludePoints = edit.vertexIndex !== null
				? [edit.currentPoints[edit.vertexIndex]].filter((candidate): candidate is LayoutVec2 => Boolean(candidate))
				: undefined;
			updateRoomEdit(interaction, applyLayoutSnap(point, { excludePoints }), false);
		}
	}

	function onPointerUp(event: PointerEvent) {
		// P23.2 clear rule — a released pointer ends feedback; commits consume
		// the already-resolved candidate positions captured during the drag.
		clearLayoutSnapFeedback();
		if (stagingGesture?.pointerId === event.pointerId) {
			const gesture = stagingGesture;
			previewStagingGesture(event);
			if (!stagingGesture) return;
			onSceneGestureCommit?.();
			if (!gesture.moved && gesture.plainClickEntityId) {
				onSceneSelect?.(gesture.plainClickEntityId, { additive: false, toggle: false });
			}
			stagingGesture = null;
			stagingRotationHoverScreen = null;
			stagingYawFeedback = null;
			svgElement?.releasePointerCapture(event.pointerId);
			return;
		}
		if (panPointerId === event.pointerId) {
			panPointerId = null;
			lastPanScreen = null;
			svgElement?.releasePointerCapture(event.pointerId);
			return;
		}
		if (pendingWallBend && pendingWallBend.pointerId === event.pointerId) {
			pendingWallBend = null;
			suppressNextClick = true;
			svgElement?.releasePointerCapture(event.pointerId);
			return;
		}
		if (interiorAnchorPointerId === event.pointerId) {
			const drag = draggedInteriorAnchor;
			const snapshot = dragSnapshot;
			const startScreen = interiorAnchorStartScreen;
			const releaseScreen = screenPoint(event);
			// The one click-vs-drag gate for this gesture, on the same shared drag
			// threshold the direct architecture edits use: a gesture counts as a
			// drag when a `pointermove` already crossed the threshold, or when the
			// release displacement from the pointer-down origin does. Without it
			// every release was a drag, so a click 3 px beside an anchor committed
			// a move of 3 px (or snapped an off-grid anchor onto the grid fallback).
			const moved =
				interiorAnchorMoved ||
				(startScreen !== null &&
					releaseScreen !== null &&
					shouldBeginWallBend(startScreen, releaseScreen));
			// The gesture is cleared BEFORE the capture is released, so the
			// `lostpointercapture` that follows our own release cannot re-enter
			// the cancel path (the rule the direct architecture edits use too).
			interiorAnchorPointerId = null;
			draggedInteriorAnchor = null;
			interiorAnchorStartScreen = null;
			interiorAnchorMoved = false;
			dragSnapshot = null;
			suppressNextClick = true;
			svgElement?.releasePointerCapture(event.pointerId);
			// A click is not a drag: the pointer-down baseline is restored and the
			// open transaction cancelled with zero history, exactly like a no-op
			// architecture-edit release. The selection made on press stays.
			if (!moved) {
				onLayoutTransactionCancel();
				if (snapshot) restoreLayoutPreviewSnapshot(preview, snapshot);
				return;
			}
			// The RELEASE coordinate is authoritative: re-run the drag resolver
			// one final time, so a gesture whose last `pointermove` landed
			// somewhere else can never commit that stale candidate, and a release
			// the legacy planner rejects restores the pointer-down baseline
			// instead of committing it. `updateLayoutWallInteriorAnchor()` is the
			// only writer either way.
			const point = drag ? worldPoint(event) : null;
			const applied = drag && point ? planInteriorAnchorDrag(drag, point) : null;
			clearLayoutSnapFeedback();
			if (applied?.success) {
				const changed = onLayoutTransactionCommit();
				if (!changed && snapshot) restoreLayoutPreviewSnapshot(preview, snapshot);
				return;
			}
			// Rejected (or unresolvable) release: the exact baseline is restored
			// and zero history is written. Cancel and the snapshot restore both
			// replace `statusMessage`, so the reason is re-applied after them.
			onLayoutTransactionCancel();
			if (snapshot) restoreLayoutPreviewSnapshot(preview, snapshot);
			if (applied && !applied.success) preview.statusMessage = applied.message;
			else if (drag) preview.statusMessage = 'Could not resolve the release position';
			return;
		}
		if (interaction.architectureEdit?.pointerId === event.pointerId) {
			// Only the pointer that opened the gesture may commit it: another
			// contact's release must never finalize someone else's candidate.
			commitArchitectureEditGesture(event);
			return;
		}
		if (pointerId !== event.pointerId) return;
		if (interaction.primitiveDraft) {
			const point = draftPoint(event, null);
			if (point) updatePrimitiveAt(point);
			const draft = interaction.primitiveDraft;
			if (!draft?.valid || !draft.roomId) {
				preview.statusMessage = 'Choose a non-zero gesture inside a first-floor room';
				onLayoutTransactionCancel();
			} else {
				// draft.current is already snap-resolved via draftPoint; commit
				// must not re-round a semantic snap back to the grid.
				const result = commitLayoutPrimitive(
					preview,
					draft.kind,
					draft.start,
					draft.current,
					draft.roomId,
					false
				);
				if (result.success) {
					selectLayoutObject(interaction, result.objectId);
					preview.statusMessage = `Created ${draft.kind} object`;
					onLayoutTransactionCommit();
				} else {
					preview.statusMessage = result.message;
					onLayoutTransactionCancel();
				}
			}
			cancelLayoutPrimitiveDraft(interaction);
			pointerId = null;
			svgElement?.releasePointerCapture(event.pointerId);
			return;
		}
		if (interaction.roomUnitDrag) {
			const drag = interaction.roomUnitDrag;
			if (wallFirstLayoutDocument() && roomUnitSnapshot) {
				// P23.6a — re-derive the candidate once from the RELEASE point: the
				// final pointer position is authoritative, so an invalid final
				// release can never commit the previously previewed candidate, and a
				// no-op release writes zero history.
				const point = worldPoint(event);
				let valid = false;
				let movedRoomIds: readonly string[] | null = null;
				// Cancel + snapshot restore both replace `statusMessage`, so a real
				// rejection is remembered here and re-applied *after* the restore —
				// otherwise the Room snaps back with no reason shown. A `no_op`
				// release (a press/release that never moved the pointer) is not a
				// rejection: it is the same select-only click an ineligible Room gets,
				// so it stays silent.
				let rejectionMessage: string | null = null;
				if (point) {
					updateLayoutRoomUnitDrag(
						interaction,
						point,
						interaction.planView.snapEnabled,
						interaction.planView.angleSnapEnabled,
						event.shiftKey
					);
					restoreLayoutPreviewSnapshot(preview, roomUnitSnapshot);
					const finalResult = previewWallFirstRoomMove(preview, drag.roomId, drag.translation);
					valid = finalResult.success;
					drag.candidateValid = valid;
					if (finalResult.success) movedRoomIds = finalResult.movedRoomIds;
					else if (finalResult.code !== 'no_op') rejectionMessage = finalResult.message;
				} else {
					rejectionMessage = 'Could not resolve the release position';
				}
				if (valid) {
					const changed = onLayoutTransactionCommit();
					if (changed) {
						const movedCount = movedRoomIds?.length ?? 1;
						preview.statusMessage =
							movedCount > 1 ? `Moved ${movedCount} rooms` : 'Moved room';
					}
				} else {
					onLayoutTransactionCancel();
					restoreLayoutPreviewSnapshot(preview, roomUnitSnapshot);
					if (rejectionMessage) preview.statusMessage = rejectionMessage;
				}
			} else {
				const changed = onLayoutTransactionCommit();
				if (!changed && roomUnitSnapshot) restoreLayoutPreviewSnapshot(preview, roomUnitSnapshot);
				preview.statusMessage = changed ? 'Moved room unit' : preview.statusMessage;
			}
			cancelLayoutRoomUnitDrag(interaction);
			roomUnitSnapshot = null;
			rotationHoverScreen = null;
			pointerId = null;
			svgElement?.releasePointerCapture(event.pointerId);
			return;
		}
		if (interaction.objectDrag) {
			const drag = interaction.objectDrag;
			const result =
				drag.mode === 'rotate'
					? updateLayoutObjectFields(preview, drag.objectId, {
							position: drag.candidatePosition,
							rotation: drag.candidateRotation
						})
					: updateLayoutObjectFields(preview, drag.objectId, {
							position: drag.candidatePosition
						});
			if (result.success) onLayoutTransactionCommit();
			else onLayoutTransactionCancel();
			cancelLayoutObjectDrag(interaction);
			pointerId = null;
			preview.statusMessage = result.success
				? drag.mode === 'rotate'
					? 'Rotated layout object'
					: 'Moved layout object'
				: result.message;
			svgElement?.releasePointerCapture(event.pointerId);
			return;
		}
		if (interaction.wallOpeningDrag) {
			// Validate once → commit once. An invalid raw candidate (e.g. a drag
			// past the Wall end) rejects with no history — it never becomes an
			// end-flush placement, because clamping is not validity.
			const drag = interaction.wallOpeningDrag;
			if (!drag.valid) {
				preview.statusMessage = 'Opening does not fit on this wall';
				onLayoutTransactionCancel();
			} else {
				const result = updateWallFirstOpening(
					preview,
					drag.openingId,
					drag.mode === 'body'
						? { offset: drag.candidateOffset }
						: { offset: drag.candidateOffset, width: drag.candidateWidth }
				);
				if (result.success) {
					onLayoutTransactionCommit();
					preview.statusMessage =
						drag.mode === 'body' ? 'Moved opening' : 'Resized opening';
				} else {
					onLayoutTransactionCancel();
					preview.statusMessage = result.message;
				}
			}
			cancelLayoutWallOpeningDrag(interaction);
			dragSnapshot = null;
			pointerId = null;
			svgElement?.releasePointerCapture(event.pointerId);
			return;
		}
		if (openingDrag) {
			onLayoutTransactionCommit();
			openingDrag = null;
			dragSnapshot = null;
			pointerId = null;
			svgElement?.releasePointerCapture(event.pointerId);
			return;
		}
		pointerId = null;
		openingDrag = null;
		dragSnapshot = null;
		svgElement?.releasePointerCapture(event.pointerId);
		if (interaction.tool === 'rectangle') {
			// P23.9 — on a wall-first document Rectangle is the bounded four-Wall
			// chain frontend: same canonical graph as an equivalent chain. The
			// legacy Room-polygon commit stays for legacy documents.
			if ('formatVersion' in preview.project.layout) {
				const points = rectanglePoints(interaction);
				if (points && onCommit(points)) clearLayoutDraft(interaction);
				else clearLayoutDraft(interaction);
				return;
			}
			const points = rectanglePoints(interaction);
			if (points && onCommit(points)) clearLayoutDraft(interaction);
			else if (!points) clearLayoutDraft(interaction);
			return;
		}
		if (interaction.tool === 'select' && interaction.editing) {
			const edit = interaction.editing;
			const result = commitLayoutRoomEdit(preview, edit.roomId, edit.currentPoints);
			if (result.success) onLayoutTransactionCommit();
			else onLayoutTransactionCancel();
			cancelRoomEdit(interaction);
		}
	}

	function onPointerCancel(event: PointerEvent) {
		if (stagingGesture?.pointerId === event.pointerId) cancelStagingGesture();
		arrangeLayoutRotationHoverScreen = null;
		clearLayoutSnapFeedback();
		if (interaction.primitiveDraft && pointerId === event.pointerId) {
			onLayoutTransactionCancel();
			cancelLayoutPrimitiveDraft(interaction);
			pointerId = null;
		}
		// P23.5 — hover preview never opens a transaction, so cancel only
		// clears the footprint (no commit/cancel callbacks to drive).
		if (interaction.presetDraft) {
			cancelLayoutPresetDraft(interaction);
		}
		if (interaction.roomUnitDrag && pointerId === event.pointerId) {
			if (roomUnitSnapshot) restoreLayoutPreviewSnapshot(preview, roomUnitSnapshot);
			onLayoutTransactionCancel();
			cancelLayoutRoomUnitDrag(interaction);
			roomUnitSnapshot = null;
			rotationHoverScreen = null;
			pointerId = null;
		}
		// P23.10 — an OS pointer cancel on a direct architecture edit restores
		// the canonical baseline and writes no history.
		if (interaction.architectureEdit && pointerId === event.pointerId) {
			cancelArchitectureEditGesture();
		}
		if (interaction.objectDrag && pointerId === event.pointerId) {
			onLayoutTransactionCancel();
			cancelLayoutObjectDrag(interaction);
			pointerId = null;
		}
		if (
			interiorAnchorPointerId === event.pointerId ||
			(openingDrag && pointerId === event.pointerId) ||
			(interaction.wallOpeningDrag && pointerId === event.pointerId)
		) {
			cancelActiveLayoutDrag();
		}
		if (interaction.editing && pointerId === event.pointerId) {
			onLayoutTransactionCancel();
			cancelRoomEdit(interaction);
			pointerId = null;
		}
		if (svgElement?.hasPointerCapture(event.pointerId)) svgElement.releasePointerCapture(event.pointerId);
	}

	function onClick(event: MouseEvent) {
		if (suppressNextClick) {
			suppressNextClick = false;
			return;
		}
		if (interaction.tool !== 'polygon' && wallChainRoleForTool(interaction.tool) === null) return;
		const point = worldPoint(event);
		if (!point) return;
		if (wallChainRoleForTool(interaction.tool) !== null) {
			commitWallChainClick(point);
			return;
		}
		const anchor = interaction.polygonPoints.at(-1) ?? null;
		let nextPoint = point;
		if (anchor && event.shiftKey && interaction.planView.angleSnapEnabled) nextPoint = constrainToAngle(anchor, nextPoint);
		nextPoint = applyLayoutSnap(nextPoint);
		const first = interaction.polygonPoints[0];
		const closeDistance = 14 / interaction.planView.pixelsPerMeter;
		if (first && interaction.polygonPoints.length >= 3 && distance(first, nextPoint) <= closeDistance) {
			if (onCommit([...interaction.polygonPoints])) clearLayoutDraft(interaction);
			return;
		}
		addPolygonPoint(interaction, nextPoint);
	}

	/**
	 * P23.9 segment-first — one click either starts a run (first click =
	 * transient start) or completes one Wall (validate + commit immediately,
	 * then seed the next start from the canonical end Junction). Closure is
	 * explicit Junction identity (`endJunctionId === runStartJunctionId`),
	 * never coordinate proximity and never "a Room appeared".
	 */
	function commitWallChainClick(rawPoint: LayoutVec2) {
		const snapped = resolveLayoutSnapCandidate(rawPoint);
		if (!hasWallChainRun(interaction)) {
			preview.statusMessage = null;
			beginWallChain(interaction, snapped.point);
			return;
		}
		const start = interaction.wallChainStart!;
		// A rejection rolls its history transaction back through snapshot
		// restore (clearing transient state as a side effect and bumping the
		// version), so re-install the saved run + version to keep the current
		// start available for correction.
		const savedRun = captureWallChainRun(interaction);
		const endpointHostWallId =
			snapped.resolution.kind === 'snap' && snapped.resolution.candidate.kind === 'wall-span'
				? snapped.resolution.candidate.wallId
				: undefined;
		const result = onWallSegmentCommit([...start], [...snapped.point], endpointHostWallId);
		if (!result.success) {
			if (savedRun) restoreWallChainRun(interaction, savedRun);
			draftedVersion = preview.previewVersion;
			return;
		}
		if (result.startJunctionId === undefined || result.endJunctionId === undefined) {
			cancelWallChainRun(interaction);
			return;
		}
		const endPoint = resolveJunctionPoint(result.endJunctionId) ?? [...snapped.point];
		if (result.closedRun) {
			cancelWallChainRun(interaction);
		} else {
			advanceWallChainContinuation(interaction, {
				endPoint,
				endJunctionId: result.endJunctionId,
				startJunctionId: result.startJunctionId,
				...(result.wallHeight !== undefined ? { wallHeight: result.wallHeight } : {})
			});
		}
		draftedVersion = preview.previewVersion;
	}

	/** Resolve a canonical Junction point from the live wall-first document. */
	function resolveJunctionPoint(junctionId: string): LayoutVec2 | null {
		const layout = preview.project.layout;
		if (!('formatVersion' in layout)) return null;
		const wallFirst = layout as unknown as { junctions: { id: string; point: LayoutVec2 }[] };
		const junction = wallFirst.junctions.find((candidate) => candidate.id === junctionId);
		return junction ? ([...junction.point] as LayoutVec2) : null;
	}

	/** P23.6 — canonical endpoints lose hit authority below the Junction-handle
	 * LOD, so an invisible endpoint never outranks its visible Wall. */
	function planHitEndpointGate(): { includeEndpoints: boolean } {
		return {
			includeEndpoints: interaction.planView.pixelsPerMeter >= JUNCTION_HANDLES_MIN_PX_PER_M
		};
	}

	type WallFirstCenterlineWall = {
		id: string;
		centerline:
			| { kind: 'line' }
			| {
					kind: 'cubic-chain';
					knots: { id: string; point: LayoutVec2 }[];
					spans: { handleOut: LayoutVec2; handleIn: LayoutVec2 }[];
			  };
	};

	/**
	 * P23.11 — the transient curve controls of the SELECTED curved Wall, in
	 * persisted anchor order. Empty for any other selection, for a straight Wall
	 * and for a legacy document: only the Wall being edited exposes draggable
	 * controls, so the control affordance never becomes global clutter.
	 *
	 * Below the Junction-handle scale floor the controls are not drawn, and they
	 * must not be hittable either — an invisible affordance outranking the Wall
	 * body would swallow the click that selects the Wall.
	 */
	function selectedCurveControls(
		walls: readonly WallFirstCenterlineWall[]
	): PlanCurveControlCandidate[] {
		const selection = interaction.selection;
		if (selection.kind !== 'physicalWall') return [];
		if (interaction.planView.pixelsPerMeter < JUNCTION_HANDLES_MIN_PX_PER_M) return [];
		const wall = walls.find((candidate) => candidate.id === selection.wallId);
		if (!wall || wall.centerline.kind !== 'cubic-chain') return [];
		return wall.centerline.knots.map((knot) => ({
			wallId: wall.id,
			anchorId: knot.id,
			point: [knot.point[0], knot.point[1]] as LayoutVec2
		}));
	}

	/**
	 * P23.11 — the shared hit options for the SELECT and hover paths: the
	 * endpoint gate plus the selected Wall's controls. The context menu, the
	 * door/window tool and every non-select path keep `planHitEndpointGate()`:
	 * a control outranking the Wall body would otherwise remove the Wall's own
	 * context menu and block Opening placement next to a control.
	 */
	function planHitOptions(): {
		includeEndpoints: boolean;
		curveControls?: readonly PlanCurveControlCandidate[];
	} {
		const layout = wallFirstLayoutDocument();
		const controls = layout ? selectedCurveControls(layout.walls) : [];
		return {
			...planHitEndpointGate(),
			...(controls.length > 0 ? { curveControls: controls } : {})
		};
	}

	/** P23.6 — map a canonical Wall endpoint to its Junction ID (click-select). */
	function wallEndpointJunctionId(wallId: string, endpoint: 0 | 1): string | null {
		const layout = preview.project.layout;
		if (!('formatVersion' in layout)) return null;
		const wallFirst = layout as unknown as {
			walls: { id: string; startJunctionId: string; endJunctionId: string }[];
		};
		const wall = wallFirst.walls.find((candidate) => candidate.id === wallId);
		if (!wall) return null;
		return endpoint === 0 ? wall.startJunctionId : wall.endJunctionId;
	}

	/**
	 * P23.6 — reduce a Plan hit to its hover identity. Only Walls, Junctions
	 * and Openings carry hover affordances; every other hit (rooms, objects,
	 * vertices, anchors) hovers nothing. Never writes selection or document.
	 */
	function toLayoutHover(
		hit: ReturnType<typeof resolvePlanHit>
	): PlanHitIdentity | null {
		if (!hit) return null;
		switch (hit.kind) {
			case 'physicalWall':
				return { kind: 'physicalWall', wallId: hit.wallId };
			// P23.11 — the hover language is the control's only affordance, so a
			// control hit must not fall through to the Wall behind it.
			case 'wallCurveControl':
				return { kind: 'wallCurveControl', wallId: hit.wallId, anchorId: hit.anchorId };
			case 'wall':
				return { kind: 'wall', roomId: hit.roomId, segmentId: hit.segmentId };
			case 'wallOpening':
				return { kind: 'wallOpening', wallId: hit.wallId, openingId: hit.openingId };
			case 'opening':
				return {
					kind: 'opening',
					roomId: hit.roomId,
					segmentId: hit.segmentId,
					openingId: hit.openingId
				};
			case 'wallEndpoint': {
				const junctionId = wallEndpointJunctionId(hit.wallId, hit.endpoint);
				return junctionId ? { kind: 'junction', junctionId } : null;
			}
			default:
				return null;
		}
	}

	function finishPolygon() {
		if (interaction.polygonPoints.length < 3) return;
		if (onCommit([...interaction.polygonPoints])) clearLayoutDraft(interaction);
	}

	function onWheel(event: WheelEvent) {
		const screen = screenPoint(event);
		if (!screen) return;
		event.preventDefault();
		zoomPlanViewport(interaction.planView, event.deltaY < 0 ? 1.12 : 1 / 1.12, screen);
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			dismissSceneBridge();
			clearLayoutSnapFeedback();
			if (stagingGesture) {
				cancelStagingGesture();
				return;
			}
			if (pendingWallBend) {
				const pendingPointerId = pendingWallBend.pointerId;
				pendingWallBend = null;
				suppressNextClick = true;
				svgElement?.releasePointerCapture(pendingPointerId);
				return;
			}
			// P23.10 — Escape abandons a direct architecture edit: the canonical
			// baseline is restored and the open transaction is cancelled once.
			if (interaction.architectureEdit || architectureEditSnapshot) {
				cancelArchitectureEditGesture();
				return;
			}
			if (interaction.roomUnitDrag) {
				// `cancel()` restores the pre-transaction preview snapshot
				// (`HistoryController.cancel()` → `layoutHost.replace(before)`), which
				// is exactly `roomUnitSnapshot`. The snapshot is also restored here
				// explicitly so the gesture baseline never depends on that invariant
				// alone; either way zero history is written.
				if (roomUnitSnapshot) restoreLayoutPreviewSnapshot(preview, roomUnitSnapshot);
				onLayoutTransactionCancel();
				cancelLayoutRoomUnitDrag(interaction);
				roomUnitSnapshot = null;
				rotationHoverScreen = null;
				pointerId = null;
				return;
			}
			if (dragSnapshot || draggedInteriorAnchor || openingDrag) {
				cancelActiveLayoutDrag();
				return;
			}
			if (interaction.objectDrag) {
				onLayoutTransactionCancel();
				cancelLayoutObjectDrag(interaction);
				pointerId = null;
				return;
			}
			if (interaction.primitiveDraft) {
				onLayoutTransactionCancel();
				cancelLayoutPrimitiveDraft(interaction);
				pointerId = null;
				return;
			}
			// P23.5 — Escape clears the preset footprint preview and disarms
			// the tool (the document was never written, so no history).
			if (isLayoutPresetTool(interaction.tool)) {
				cancelLayoutPresetDraft(interaction);
				setLayoutDraftTool(interaction, 'select');
				return;
			}
			// P23.3 — Escape during a canonical Opening gesture restores the
			// baseline with no history (the document was never written).
			if (interaction.wallOpeningDrag) {
				onLayoutTransactionCancel();
				cancelLayoutWallOpeningDrag(interaction);
				dragSnapshot = null;
				pointerId = null;
				return;
			}
			if (interaction.tool === 'door' || interaction.tool === 'window') {
				setLayoutDraftTool(interaction, 'select');
				return;
			}
			// P23.9 segment-first — Escape cancels only the active continuation
			// preview/run (committed Walls remain; no history entry; tool stays
			// selected). It must never remove committed Walls.
			if (hasWallChainRun(interaction)) {
				cancelWallChainRun(interaction);
				return;
			}
			onLayoutTransactionCancel();
			clearLayoutDraft(interaction);
			cancelRoomEdit(interaction);
			return;
		}
		if (
			interaction.planViewMode === 'staging' &&
			(event.key === 'Delete' || event.key === 'Backspace') &&
			!event.metaKey && !event.ctrlKey && !event.altKey &&
			stagingTransformEnabled &&
			arrangeActiveScene !== null
		) {
			event.preventDefault();
			event.stopPropagation();
			onSceneDelete?.();
			return;
		}
		if (
			(event.key === 'Delete' || event.key === 'Backspace') &&
			interaction.tool === 'select' &&
			interaction.selection.kind === 'interiorAnchor'
		) {
			event.preventDefault();
			const selection = interaction.selection;
			if (!onLayoutTransactionBegin()) {
				preview.statusMessage = 'Finish the current layout interaction first';
				return;
			}
			const result = deleteLayoutWallInteriorAnchor(
				preview,
				selection.roomId,
				selection.segmentId,
				selection.anchorId
			);
			if (result.success) {
				onLayoutTransactionCommit();
				selectLayoutWall(interaction, selection.roomId, selection.segmentId);
			} else {
				onLayoutTransactionCancel();
				preview.statusMessage = result.message;
			}
			return;
		}
		if ((event.key === 'Delete' || event.key === 'Backspace') && interaction.tool === 'select' && interaction.selection.kind === 'opening') {
			event.preventDefault();
			onOpeningDelete(interaction.selection.roomId, interaction.selection.openingId);
			return;
		}
		if ((event.key === 'Delete' || event.key === 'Backspace') && interaction.tool === 'select' && interaction.selection.kind === 'wallOpening') {
			event.preventDefault();
			onWallOpeningDelete?.(interaction.selection.openingId);
			return;
		}
		// P23.6c — canonical Wall delete: Delete/Backspace and the Inspector/
		// hierarchy Delete actions call the same planner-backed adapter.
		// P23.6c review fix — Layout authority only: `setPlanViewMode()`
		// deliberately keeps a committed Layout selection as memory when
		// switching to Arrange, and the structural selection stays memory
		// there. Without this gate the branch caught the remembered
		// `physicalWall` after the Arrange owner-delete branch fell through
		// (no active Scene target), deleting a Wall from an authority-inert
		// mode — the same class of bypass as the hierarchy context menu. In
		// Arrange, Delete routes to the active owner only (the Scene and
		// Layout-object branches above).
		if (
			(event.key === 'Delete' || event.key === 'Backspace') &&
			interaction.tool === 'select' &&
			interaction.selection.kind === 'physicalWall' &&
			interaction.planViewMode === 'layout'
		) {
			event.preventDefault();
			onWallDelete?.(interaction.selection.wallId);
			return;
		}
		if (
			(event.key === 'Delete' || event.key === 'Backspace') &&
			interaction.tool === 'select' &&
			interaction.selection.kind === 'object' &&
			// P10 — in Arrange, Delete routes to the active owner only: a Scene
			// memory selection must never be deleted while a Layout object is
			// the active target, and vice versa. Gate on the derived active
			// target (not the raw remembered owner) so the first-entry
			// null-owner fallback still deletes its active layout object.
			(interaction.planViewMode !== 'staging' || arrangeActiveLayoutObject !== null)
		) {
			event.preventDefault();
			if (!onLayoutTransactionBegin()) {
				preview.statusMessage = 'Finish the current layout interaction first';
				return;
			}
			const result = deleteLayoutObject(preview, interaction.selection.objectId);
			if (result.success) {
				onLayoutTransactionCommit();
				clearLayoutSelection(interaction);
			} else {
				onLayoutTransactionCancel();
			}
			preview.statusMessage = result.success ? 'Deleted layout object' : result.message;
			return;
		}
		// room deletion is a guarded layout transaction (the caller
		// owns begin/commit/cancel + the scene-reference reject policy).
		if ((event.key === 'Delete' || event.key === 'Backspace') && interaction.tool === 'select' && interaction.selection.kind === 'room') {
			event.preventDefault();
			// P23.6d — a wall-first Room removes through the canonical Room
			// lifecycle (remove the Room's exclusive enclosure Walls, so the Room
			// and its enclosure go together while Walls shared with adjacent
			// Rooms stay); the legacy `deleteLayoutRoom` rejects wall-first
			// documents, which is why this keystroke previously did nothing.
			// Legacy rooms keep the existing guarded legacy delete.
			if (wallFirstLayoutDocument()) {
				// P23.6d review fix — Layout authority only (same class of fix as
				// P23.6c's `physicalWall` branch): `setPlanViewMode()` deliberately
				// keeps a committed Layout selection as memory when switching to
				// Arrange, so the remembered Room selection would otherwise become
				// an active Delete target there after the Arrange owner-delete
				// branch falls through (no active Scene target). A remembered
				// structural selection must never execute canonical removal from an
				// authority-inert mode; never solved by clearing the memory.
				if (interaction.planViewMode === 'layout') {
					onRoomRemove?.(interaction.selection.roomId);
				}
				return;
			}
			onRoomDelete(interaction.selection.roomId);
			return;
		}
		if (event.key === 'Backspace' && interaction.tool === 'polygon' && interaction.polygonPoints.length > 0) {
			event.preventDefault();
			removeLastPolygonPoint(interaction);
		}
		// P23.9 segment-first — Backspace must not act as undo for committed
		// Walls (they use normal Undo/Redo). Kept only for genuinely transient
		// compound tools (uncommitted Polygon vertices above).
	}

	function distance(a: LayoutVec2, b: LayoutVec2): number {
		return Math.hypot(a[0] - b[0], a[1] - b[1]);
	}

	function findLayoutRoom(roomList: readonly LayoutRoom[], roomId: string): LayoutRoom | undefined {
		return roomList.find((room) => room.id === roomId);
	}

	function roomVertices(room: LayoutRoom): LayoutVec2[] {
		return room.boundary.segments.map((segment) => [...segment.start] as LayoutVec2);
	}

</script>

<div class="plan-viewport" role="presentation" aria-label="Layout Plan drafting viewport" onpointerleave={dismissSceneBridge}>
	<!-- P21.5 §2.1 — no floating .plan-help pill; hints live in the status bar. -->
	{#if stagingSelectionMessage}
		<div class="staging-selection-warning" role="status">{stagingSelectionMessage}</div>
	{/if}
	{#if sceneBridgeHover}
		<button
			type="button"
			class="scene-bridge-chip"
			style={`left: ${sceneBridgeHover.screen[0] + 10}px; top: ${sceneBridgeHover.screen[1] - 12}px`}
			onpointerdown={(event) => event.stopPropagation()}
			onclick={(event) => { event.stopPropagation(); activateSceneBridge(); }}
		>Edit in Arrange</button>
	{/if}
	{#if arrangeEmpty && !stagingSelectionMessage}
		<div class="arrange-empty" role="status">No movable objects here yet — create them in Layout or place them in Scene 3D.</div>
	{/if}
	{#if planEmpty && !ghostVisible}
		<!-- P3.3 — canonical empty-plan onboarding treatment (scene-empty-plan.png).
		     P21.2 ghost takes precedence in Layout; the card remains for the
		     dismissed-but-still-empty session tail and non-Layout empty states. -->
		<div class="plan-empty-state" role="status">
			<strong>Empty floor plan</strong>
			<span>Pick the Room tool to draft your first room, or place an asset from the sidebar.</span>
		</div>
	{/if}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (plan surface owns keyboard focus) -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions (plan surface owns pointer and keyboard drafting events) -->
	<svg
		bind:this={svgElement}
		class="plan-canvas"
		class:rotation-handle-hover={rotationHandleHovered}
		class:rotation-dragging={Boolean(interaction.roomUnitDrag)}
		class:staging-rotation-handle-hover={stagingRotationHovered}
		class:object-rotation-handle-hover={arrangeLayoutRotationHovered}
		viewBox={viewBox}
		preserveAspectRatio="none"
		role="application"
		tabindex="0"
		aria-label="2D layout plan"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerCancel}
		onlostpointercapture={onLostPointerCapture}
		onclick={onClick}
		onwheel={onWheel}
		onkeydown={onKeyDown}
		oncontextmenu={onPlanContextMenu}
		onpointerleave={() => {
			rotationHoverScreen = null;
			arrangeLayoutRotationHoverScreen = null;
			arrangeHover = null;
			layoutHover = null;
			// P23.9 — the pending segment preview follows the pointer, so leaving
			// the surface drops it rather than freezing a stale leg.
			updateWallChainCursor(interaction, null);
			// P23.5 — same for the preset footprint preview.
			cancelLayoutPresetDraft(interaction);
			clearLayoutSnapFeedback();
		}}
	>
		<PlanCanvasChrome layer="grid" planView={interaction.planView} />
		{#if ghostVisible}
			<PlanEmptyGhost planView={interaction.planView} />
		{/if}
		<PlanSvg model={planModel} planView={interaction.planView} />
		<PlanCanvasChrome layer="overlay" planView={interaction.planView} />
		{#if selectedOpening}
			<!-- P23.12 — selected-target feedback consumes the identity contract:
				name/reference when the ledger has one, kind + metrics always. -->
			<text class="selection-label" x="16" y="24">{selectedOpeningReference ?? selectedOpening.kind} · {selectedOpening.width.toFixed(2)} m × {selectedOpening.height.toFixed(2)} m</text>
		{/if}

	</svg>
	{#if preview.statusMessage}
		<p class="plan-status" role="status">{preview.statusMessage}</p>
	{/if}
	<div class="plan-actions">
		{#if interaction.tool === 'polygon' && interaction.polygonPoints.length >= 3}
			<button type="button" onclick={finishPolygon}>Finish polygon</button>
		{/if}
		{#if (draftPolygon && draftPolygon.length > 0) || (wallChainRoleForTool(interaction.tool) !== null && hasWallChainRun(interaction))}
			<button type="button" class="secondary" onclick={() => clearLayoutDraft(interaction)}>Cancel draft</button>
		{/if}
	</div>
	<div class="plan-meta">
		<span>{preview.model.rooms.length} rooms</span>
		<span>{preview.model.objects.length} objects</span>
		<span>{preview.issues.length} geometry warnings</span>
		{#if interaction.planViewMode === 'staging' && selectedPlacementIds.length > 0 && interaction.arrangeOwner !== 'layout-object'}<span>Selected: {selectedPlacementIds.length} scene item{selectedPlacementIds.length === 1 ? '' : 's'}</span>{:else if interaction.selection.kind !== 'none'}<span>Selected: {interaction.selection.kind}</span>{/if}
		{#if preview.lastMutationMessage}<span class="warning">{preview.lastMutationMessage}</span>{/if}
	</div>
</div>

<style>
	.plan-viewport { position: absolute; inset: 0; z-index: 3; background: var(--editor-bg-app); }
	/* P3.2 §9 — the plan is a bright drafting surface against the dark shell. */
	.plan-canvas { display: block; position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: crosshair; outline: none; background: var(--editor-plan-canvas-bg); }
	/* P23.6 — keyboard focus stays visible on the drafting surface. */
	.plan-canvas:focus-visible { outline: 2px solid var(--editor-plan-selection); outline-offset: -2px; }
	.plan-canvas.rotation-handle-hover { cursor: grab; }
	.plan-canvas.staging-rotation-handle-hover { cursor: grab; }
	.plan-canvas.object-rotation-handle-hover { cursor: grab; }
	.plan-canvas.rotation-dragging { cursor: grabbing; }
	.selection-label { fill: var(--editor-plan-label); font: 700 12px var(--editor-font); paint-order: stroke; stroke: var(--editor-plan-canvas-bg); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; }
	.scene-bridge-chip { position: absolute; z-index: 8; padding: 0.32rem 0.48rem; border: 1px solid var(--editor-accent); border-radius: 999px; background: var(--editor-bg-selected); color: var(--editor-text-primary); font: 700 0.66rem/1 var(--editor-font); cursor: pointer; box-shadow: var(--editor-shadow-popover); }
	.scene-bridge-chip:hover { background: var(--editor-accent-pressed); }
	.staging-selection-warning { position: absolute; top: 7rem; left: 50%; z-index: 5; max-width: min(34rem, calc(100% - 2rem)); transform: translateX(-50%); padding: 0.42rem 0.65rem; border: 1px solid var(--editor-danger-border); border-radius: 0.35rem; background: var(--editor-bg-panel-raised); color: var(--editor-danger-fg); font: 600 0.7rem/1.25 var(--editor-font); pointer-events: none; text-align: center; }
	.arrange-empty { position: absolute; top: 7rem; left: 50%; z-index: 5; max-width: min(36rem, calc(100% - 2rem)); transform: translateX(-50%); padding: 0.42rem 0.65rem; border: 1px solid var(--editor-border-normal); border-radius: 0.35rem; background: var(--editor-bg-panel-raised); color: var(--editor-text-secondary); font: 600 0.7rem/1.25 var(--editor-font); pointer-events: none; text-align: center; }
	/* P3.3 — canonical empty-plan onboarding card (scene-empty-plan.png). */
	.plan-empty-state { position: absolute; top: 50%; left: 50%; z-index: 5; transform: translate(-50%, -50%); display: grid; gap: 0.45rem; max-width: min(24rem, calc(100% - 4rem)); padding: var(--editor-space-4) var(--editor-space-5); border: 1px solid var(--editor-plan-grid-major); border-radius: var(--editor-radius-lg); background: rgb(255 255 255 / 72%); color: var(--editor-plan-label); text-align: center; pointer-events: none; box-shadow: var(--editor-shadow-popover); }
	.plan-empty-state strong { font-size: 0.86rem; font-weight: 650; }
	.plan-empty-state span { font-size: 0.74rem; line-height: 1.45; color: var(--editor-plan-muted); }
	.plan-status { position: absolute; left: 0.8rem; bottom: 0.8rem; z-index: 10; max-width: 60%; margin: 0; padding: 0.34rem 0.5rem; border: 1px solid var(--editor-border-normal); border-radius: 0.3rem; background: var(--editor-bg-panel-raised); color: var(--editor-text-secondary); font: 500 0.7rem/1.25 var(--editor-font); pointer-events: none; }
	.plan-actions { position: absolute; right: 0.8rem; bottom: 0.8rem; z-index: 10; display: flex; gap: 0.4rem; pointer-events: auto; }
	.plan-actions button { padding: 0.44rem 0.6rem; border: 1px solid var(--editor-accent-border); border-radius: 0.32rem; background: var(--editor-bg-selected); color: var(--editor-text-primary); font: 600 0.7rem/1 var(--editor-font); cursor: pointer; }
	.plan-actions button.secondary { border-color: var(--editor-border-normal); background: var(--editor-bg-panel-raised); color: var(--editor-text-secondary); }
	.plan-meta { position: absolute; left: 0.8rem; bottom: 0.8rem; z-index: 2; display: flex; gap: 0.7rem; color: var(--editor-plan-muted); font: 0.68rem/1 var(--editor-font); pointer-events: none; }
	.plan-meta .warning { color: var(--editor-danger-fg); }
	@media (max-width: 44rem) {
		.staging-selection-warning { top: 8rem; }
		.arrange-empty { top: 8rem; }
	}
</style>
