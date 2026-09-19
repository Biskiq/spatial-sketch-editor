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
		// P23.13 S7 — the exact-entry direction memory and its typed-length
		// resolver. Both were written for §7's Length form in P23.9 and had no
		// production caller until S7's numeric editor arrived; typed length now
		// goes through the same resolver the plan always named.
		wallChainPendingDirection,
		resolveWallChainEndpointAtLength,
		resolveArrangeScenePick,
		isLayoutPresetTool,
		wallChainRoleForTool,
		clearPlanFocus,
		setPlanFocus,
		shouldBeginWallBend,
		architectureEditMovedOnRelease,
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
		wallFirstJunctionDissolveRefusal,
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
		updateWallFirstOpening,
		updateWallFirstJunction,
		updateWallFirstWallAngle,
		updateWallFirstWallLength,
		updateWallFirstWallBend,
		updateWallFirstWallCurveKnot,
		updateWallFirstWallMove,
		createWallFirstOpening,
		type LayoutPreviewSnapshot,
		type LayoutRoomEditResult
	} from './layout-preview-state.svelte';
	import { LAYOUT_PLAN_HIT_RADIUS_PX, type LayoutOpeningKind } from './layout-opening-editing';
	import {
		compiledPhysicalWallLength,
		findPlanHitRoom,
		projectPointToPhysicalWall,
		resolvePlanHit,
		type PlanHitResult
	} from './plan-hit';
	import {
		constrainToAngle,
		framePlanViewport,
		panPlanViewport,
		planScreenToWorld,
		setPlanViewportSize,
		zoomPlanViewport
	} from './layout-plan-transform';
	import {
		createPlanSalienceMemory,
		resolvePlanSalience,
		type PlanSalience
	} from './plan-salience';
	import { createPlanDimensionMemory } from './plan-dimensions';
	// P23.13 S8 — the instrument zone (§1.12), the canonical closure evidence for
	// the Wall draw's cue (§7), and the bounded lifetime of a refused attempt (§6).
	import {
		PLAN_ATTENTION_RESTORE_MS,
		planAttentionLabelTierDrop,
		planAttentionZoneAt,
		resolvePlanAttentionZone,
		withPlanAttentionSceneInk,
		type PlanAttentionZone
	} from './plan-attention';
	import { wallChainClosureEvidence, wallChainClosureProbeKey } from './layout-wall-chain-closure';
	import {
		PLAN_REFUSAL_PERSISTENCE_MS,
		beginPlanRefusal,
		planRefusalAt,
		withPlanRefusalAnnotation,
		type PlanRefusal,
		type PlanRefusalKind
	} from './plan-refusal';
	// P23.13 S7 — the ratified type-to-enter lifecycle (§7, A5). Every decision the
	// input element depends on lives in that module; this component owns only the
	// element, the plumbing and the canonical commit.
	import {
		planNumericAngleDegrees,
		planNumericAngleDirection,
		planNumericEntryBlur,
		planNumericEntryEscape,
		planNumericEntryField,
		planNumericFieldAxis,
		planNumericEntryHoldsExplicitValue,
		planNumericControlEntryTarget,
		planNumericEntryInput,
		planNumericEntryOpen,
		planNumericEntrySubmit,
		planNumericEntryTab,
		planNumericEntryTrigger,
		planNumericHostReadout,
		planNumericInvalidMessage,
		planNumericPointerUp,
		planNumericRestingEntryTarget,
		type PlanNumericCandidates,
		type PlanNumericEntryState,
		type PlanNumericEntryTarget,
		type PlanNumericSubmitOutcome
	} from './plan-numeric-entry';
	import {
		planTraversalAnnouncement,
		planTraversalEnteredFor,
		planTraversalGroup,
		planTraversalStep,
		type PlanTraversalControl,
		type PlanTraversalLayout,
		type PlanTraversalSelection
	} from './plan-keyboard-traversal';
	import type { LayoutRoom, LayoutVec2 } from '$lib/layout/layout-types';
	import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
	import { p2311Measure } from '$lib/layout/layout-wall-first-precision';
// P23.12 D5 — the Plan's selection feedback asks the shared display-identity
// layer how an entity reads; it never queries the ledger itself.
import {
	identityLabelPair,
	identityPrimaryLabel,
	layoutSelectionLabel,
	openingIdentity,
	roomIdentity
} from '../identity/layout-identity-view';
import { formatPlacementLabel } from '../editor-outliner';
import {
	roomFloorAreaM2,
	ROOM_LABEL_SETTLE_DELAY_MS,
	type RoomLabelMemory,
	type RoomLabelReconsiderReason
} from './plan-room-labels';
import { createBrowserTextMeasure } from './plan-text-measure';	import {
		PLAN_CONTROL_MARKS,
		planControlTargetRadiusPx,
	planFocusGeometry,
	resolvePlanAcquisition,
	type PlanControlAuthority,
	type PlanControlCandidate,
	type PlanControlKind
} from './plan-acquisition';
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
		buildPlanLayoutContextMenuItems,
		type PlanLayoutTarget
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
		architectureEditIntentLocus,
		buildPlanInteractionProjection,
		physicalWallSpan,
		planHandleScreenPoints,
		planNumericEntryAnchorPx,
		pointAtWallOffset,
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
		LAYOUT_PLAN_SNAP_RADIUS_CSS_PX,
		layoutArchitecturalPreset,
		resolveLayoutSnap,
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
		onJunctionDissolve,
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
		/** P23 Junction dissolve — delete the selected degree-2 Junction by joining its two incident Walls. */
		onJunctionDissolve?: (junctionId: string) => void;
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
	let dragSnapshot = $state<LayoutPreviewSnapshot | null>(null);
	let suppressNextClick = $state(false);
	/**
	 * P23.13 S7 — whether a pointer button is currently down. Chain tools never take
	 * pointer capture (they commit on *click*), so `pointerId` cannot answer this,
	 * and a typed commit that lands mid-press has to know whether the release about
	 * to arrive belongs to the press that predates it.
	 */
	let planPointerButtonDown = false;
	let framedReplacementVersion = $state<number | null>(null);
	let roomUnitSnapshot = $state<LayoutPreviewSnapshot | null>(null);
	let rotationHoverScreen = $state<LayoutVec2 | null>(null);
	let sceneBridgeHover = $state<{ entityId: string; screen: LayoutVec2 } | null>(null);
	// P23.2 — transient snap resolution (session-only). The resolution was
	// computed at the raw pointer world position; null clears feedback.
	let snapFeedback = $state<SnapResolution | null>(null);
	/**
	 * P23.13 S7 — the one open numeric field, or `null`. The state object is the
	 * ratified lifecycle (field set, text, refusal reason, whether a drag's
	 * pointer-up is still owed); this component only mirrors it into an input.
	 */
	let numericEntry = $state<PlanNumericEntryState | null>(null);
	/**
	 * What the open field is editing, in canonical terms. A gesture entry (the Wall
	 * draw) accepts the segment the live run would commit; an explicit focus (A5's
	 * second reach) names a canonical owner instead, so one lifecycle can edit an
	 * existing Wall, an Opening or a Junction through that owner's own command —
	 * never through a second solver.
	 */
	let numericEntrySubject = $state<PlanNumericSubject | null>(null);
	let numericEntryElement = $state<HTMLInputElement | null>(null);
	/** Plain (non-reactive) tool memory for §7's "tool change cancels". */
	let numericEntryTool: LayoutDraftTool = 'select';
	type PlanNumericSubject =
		| { kind: 'wall-chain' }
		| { kind: 'rectangle' }
		| { kind: 'wall'; wallId: string }
		| { kind: 'opening'; openingId: string }
		| { kind: 'junction'; junctionId: string };

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
			anchor?: LayoutVec2 | null;
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
		const anchor = options.anchor ?? null;
		const resolution = p2311Measure('snap-resolution', () => resolveLayoutSnap(
			preview.geometry,
			point,
			{
				pixelsPerMeter: interaction.planView.pixelsPerMeter,
				gridStep: LAYOUT_PLAN_GRID_STEP,
				...(anchor ? { anchor } : {})
			},
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
			anchor?: LayoutVec2 | null;
		} = {}
	): LayoutVec2 {
		return resolveLayoutSnapCandidate(point, options).point;
	}

	/**
	 * P23.13 S8 / §7 — the anchor the draft's axis family is relative to: the Wall
	 * run's own start, and nothing else.
	 *
	 * One function for both paths that matter, because the guide is only honest if
	 * the *preview* and the *commit* agree on the anchor. The commit re-resolves at
	 * the click point (never a remembered candidate), so passing the same anchor
	 * from the same source is what makes the released Wall exactly the one the
	 * guide promised. A Rect Room deliberately does not call this: its corner is
	 * axis-aligned by construction, and an axis lock there would only outrank the
	 * geometry snaps a rectangle corner actually wants.
	 */
	function wallChainSnapAnchor(): LayoutVec2 | null {
		if (!hasWallChainRun(interaction)) return null;
		return interaction.wallChainStart ?? null;
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
	 * P23.13 S2 — the resolved salience vocabulary held for the gesture. Freezing
	 * the snapshot (not the scale) keeps the control set, lane and gate decisions
	 * stable while the pointer moves, and restores live resolution at gesture end.
	 */
	let salienceFreeze: PlanSalience | null = $state.raw<PlanSalience | null>(null);
	/**
	 * P23.11 transient pass — the render-only attempt for the gesture's current
	 * candidate. It is gesture-local (`null` outside a live drag) and replaced
	 * wholesale on every move, never mutated, so `$state.raw` gives the render
	 * surfaces a plain object instead of a deep proxy over the proposal's
	 * sampled coordinates: the proposal is derived data, not canonical state.
	 */
	let architectureEditTransient = $state.raw<LayoutTransientArchitectureEdit | null>(null);
	/**
	 * P23.13 S8 / §6 — the persisted refusal: a refused release's own mark, kept on
	 * the drawing for the bounded-feedback lifetime instead of vanishing with the
	 * drag that produced it. Bounded feedback is its own lifetime (§2), so it is
	 * state with a timer rather than a derived value, and `planRefusalAt` is the
	 * one expiry rule — the timer only tells the view to re-render once it passes.
	 */
	let planRefusal = $state.raw<PlanRefusal | null>(null);
	let planRefusalTimer: ReturnType<typeof setTimeout> | null = null;
	const activePlanRefusal = $derived(planRefusalAt(planRefusal, Date.now()));
	/**
	 * P23.13 S8 / §1.12 — the live instrument zone (gesture-lifetime): derived from
	 * the active handle's own locus and cleared one settle window after the last
	 * frame that touched it, so the suppression restores itself without any page-scale
	 * dimming ever existing.
	 */
	let attentionZone = $state.raw<PlanAttentionZone | null>(null);
	let attentionTimer: ReturnType<typeof setTimeout> | null = null;
	const activeAttentionZone = $derived(planAttentionZoneAt(attentionZone, Date.now()));
	/**
	 * P23.13 S8 / §7 — the closure-probe memo. Deliberately non-reactive: it caches
	 * a *plan*, not a rendering decision. Keyed on the run's canonical junction
	 * identities (`wallChainClosureProbeKey`), so the closing leg is planned once
	 * per closure rather than once per pointermove while the pointer sits on the
	 * run's own start junction.
	 */
	let closureProbeKey: string | null = null;
	let closureProbeFaces: readonly (readonly LayoutVec2[])[] = [];
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

	function clearPlanRefusal(): void {
		if (planRefusalTimer !== null) {
			clearTimeout(planRefusalTimer);
			planRefusalTimer = null;
		}
		planRefusal = null;
	}

	/**
	 * P23.13 S8 / §6 — record a refused release. Silent refusals (`no_op`) are
	 * dropped by `beginPlanRefusal` itself: a mark that answers nothing is worse
	 * than no mark, which is the same rule the status line already follows.
	 */
	function armPlanRefusal(input: {
		kind: PlanRefusalKind;
		locus: LayoutVec2 | null;
		reason: string | null;
		ownerKey: string;
	}): void {
		clearPlanRefusal();
		const refusal = beginPlanRefusal({ ...input, atMs: Date.now() });
		if (!refusal) return;
		planRefusal = refusal;
		planRefusalTimer = setTimeout(() => {
			planRefusalTimer = null;
			planRefusal = null;
		}, PLAN_REFUSAL_PERSISTENCE_MS);
	}

	/** The canonical owner of the live direct edit (the refusal's identity). */
	function architectureEditOwnerKey(): string {
		const gesture = interaction.architectureEdit;
		if (!gesture) return 'architecture-edit';
		return gesture.kind === 'junction-move' ? gesture.junctionId : gesture.wallId;
	}

	/**
	 * P23.13 S8 / §1.12 — one frame of instrument attention. The zone is the active
	 * handle's own locus: §1.12's "annotation bounds" are deliberately not
	 * supplied here because the annotation a drag carries (its dimension set) is
	 * already inside the same locus radius, and widening the zone to a whole
	 * readout would make it a spotlight rather than an instrument.
	 */
	function touchPlanAttention(locus: LayoutVec2 | null): void {
		if (!locus) return;
		attentionZone = resolvePlanAttentionZone({
			view: interaction.planView,
			locus,
			atMs: Date.now()
		});
		if (attentionTimer !== null) clearTimeout(attentionTimer);
		attentionTimer = setTimeout(() => {
			attentionTimer = null;
			attentionZone = null;
		}, PLAN_ATTENTION_RESTORE_MS);
	}

	/** The attempted Opening center of the live drag (its own locus, not the pointer). */
	function wallOpeningDragLocus(): LayoutVec2 | null {
		const drag = interaction.wallOpeningDrag;
		if (!drag) return null;
		const span = physicalWallSpan(model, drag.wallId);
		if (!span) return null;
		return pointAtWallOffset(span, drag.candidateOffset + drag.candidateWidth / 2);
	}

	/**
	 * P23.13 S8 / §7 — canonical face evidence for the live run's closure.
	 *
	 * The probe gate is deliberately *wider* than the cue's own condition (a 4×
	 * snap radius around the run start): it decides only whether it is worth
	 * planning, never whether the cue is drawn — that stays one rule, in the
	 * overlay — so a generous gate can never show a cue the closing rule refuses,
	 * and the memo key keeps the plan a single call per closure.
	 */
	function wallChainClosureFaces(): readonly (readonly LayoutVec2[])[] {
		const layout = wallFirstLayoutDocument();
		const start = interaction.wallChainStart;
		const cursor = interaction.wallChainCursor;
		const runStartJunctionId = interaction.wallChainRunStartJunctionId;
		const runStart = runStartJunctionId ? resolveJunctionPoint(runStartJunctionId) : null;
		if (!layout || !start || !cursor || !runStart) {
			// No live run: drop the memo, so the next run re-plans rather than
			// inheriting a face computed against a document that may have changed
			// since (a memo is only valid inside the run it was computed for).
			closureProbeKey = null;
			closureProbeFaces = [];
			return [];
		}
		const scale = Math.max(interaction.planView.pixelsPerMeter, 1e-6);
		const gate = (LAYOUT_PLAN_SNAP_RADIUS_CSS_PX * 4) / scale;
		if (Math.hypot(cursor[0] - runStart[0], cursor[1] - runStart[1]) > gate) {
			closureProbeKey = null;
			closureProbeFaces = [];
			return [];
		}
		const role = wallChainRoleForTool(interaction.tool);
		if (!role) return [];
		const key = wallChainClosureProbeKey({
			startJunctionId: interaction.wallChainStartJunctionId,
			start,
			runStartJunctionId,
			end: runStart,
			role,
			height: interaction.wallChainRunHeight
		});
		if (key !== closureProbeKey) {
			closureProbeKey = key;
			closureProbeFaces = wallChainClosureEvidence({
				baseline: layout,
				start,
				end: runStart,
				role,
				...(interaction.wallChainRunHeight !== null
					? { height: interaction.wallChainRunHeight }
					: {})
			}).faces;
		}
		return closureProbeFaces;
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
		// P23.13 S2 — hold the acquisition/control vocabulary for this gesture.
		salienceFreeze = planSalience;
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
		// P23.13 S8 / §1.12 — the dragged control is the instrument: its own locus
		// (the attempt's, read through the same helper the refusal mark uses, so a
		// whole-Wall drag zones its own Wall rather than needing a point it has not
		// got) is the zone, re-stamped every frame and restored one settle window
		// after the pointer stops.
		touchPlanAttention(
			architectureEditTransient ? architectureEditIntentLocus(architectureEditTransient.intent) : null
		);
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
		salienceFreeze = null;
		architectureEditSnapshot = null;
		architectureEditStartScreen = null;
		architectureEditMoved = false;
		architectureEditTransient = null;
		clearLayoutSnapFeedback();
		pointerId = null;
		if (pointerIdToRelease !== null && svgElement?.hasPointerCapture(pointerIdToRelease)) {
			svgElement.releasePointerCapture(pointerIdToRelease);
		}
	}		/**
	 * P23.10 — cancel/commit the direct edit at release. The candidate is
	 * re-derived once from the ACTUAL release coordinate against the immutable
	 * baseline (never a remembered last-valid intermediate), then committed once
	 * or cancelled with the baseline restored. A no-op release stays silent.
	 */
	function commitArchitectureEditGesture(event: PointerEvent): void {
		const movedOnRelease = architectureEditMovedOnRelease(
			architectureEditMoved,
			architectureEditStartScreen,
			screenPoint(event)
		);
		// P23.13 S8 / §6 — the refused release's own mark, kept past the gesture.
		// The locus is read from the live attempt (the same helper the invalid
		// proposal marks) *before* the gesture is finished, so the persisted mark
		// and the live one can never land on two different points.
		const refusedLocus = architectureEditTransient?.intent
			? architectureEditIntentLocus(architectureEditTransient.intent)
			: null;
		const ownerKey = architectureEditOwnerKey();
		const outcome = releaseArchitectureEdit({
			gesture: interaction.architectureEdit,
			moved: movedOnRelease,
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
		if (outcome.kind === 'rejected') {
			armPlanRefusal({
				kind: 'architecture-edit',
				locus: refusedLocus,
				reason: outcome.statusMessage,
				ownerKey
			});
		}
		if (outcome.suppressNextClick) suppressNextClick = true;
		finishArchitectureEditGesture(event.pointerId);
	}

	/** Escape / pointer-cancel / mode change: restore the baseline, cancel once. */
	function cancelArchitectureEditGesture(): void {
		// Escape clears the persisted refusal (§2's bounded-feedback lifetime): the
		// user has answered the mark by dismissing it, so it does not outlive the
		// keypress by even the rest of its 1.2 s.
		clearPlanRefusal();
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
	// P21.2 — ghost blueprint session dismissal (not serialized): the neutral
	// open-corner sketch unmounts once the project is non-empty, or for the
	// remainder of the session upon first tool use.
	let ghostDismissed = $state(false);
	// P23.13 S10 / §9 — keyboard focus announcements. Written only by keyboard
	// traversal moves (never by pointer, never per pointermove). The last
	// announcement is kept as data and the region's *text* is derived from it
	// against the live focus, so the region cannot describe a control the user is
	// no longer on — including when focus is released by code this component does
	// not own (`clearLayoutSelection` drops the instrument with a deleted owner).
	let planAnnouncedFocus = $state<{ controlId: string; text: string } | null>(null);
	const planFocusAnnouncement = $derived(
		planAnnouncedFocus && interaction.planFocus?.id === planAnnouncedFocus.controlId
			? planAnnouncedFocus.text
			: null
	);
	// …and the stored announcement is released with the focus, so a *later* focus
	// on the same control (a pointer press, or a P23.12-recycled canonical id)
	// cannot resurrect text the keyboard has already finished with.
	$effect(() => {
		const focusId = interaction.planFocus?.id ?? null;
		if (planAnnouncedFocus && planAnnouncedFocus.controlId !== focusId) planAnnouncedFocus = null;
	});
	// P23.13 S10 / A5 — **Enter entering the group is state, not focus.** The
	// pointer focuses a control by pressing it (`planAcquiredControl` →
	// `setPlanFocus`), so "the ring is on a member of the selected owner's group"
	// is true without Enter ever being pressed; inferring the entry from
	// `planFocus` therefore let a pointer press unlock arrow traversal. This holds
	// *which selection* the keyboard entered, and `planTraversalEnteredFor`
	// requires the selection to still be that one.
	let planKeyboardGroupKey = $state<string | null>(null);

	const viewBox = $derived(`0 0 ${interaction.planView.width} ${interaction.planView.height}`);
	const draftPolygon = $derived(
		interaction.tool === 'rectangle'
			? rectanglePoints(interaction)
			: interaction.polygonPoints
	);
	const rooms = $derived('floors' in preview.project.layout ? preview.project.layout.floors.flatMap((floor) => floor.rooms) : []);
	/**
	 * P23.13 S3 — per compiled Room: the resolved display-identity pair (authored
	 * name → compact reference → raw-ID label, duplicate-collapse included) and
	 * the derived floor area. Identity comes from the P23.12 resolver and area from
	 * the canonical compiled floor polygon — the label path invents neither.
	 */
	const roomLabelFacts = $derived.by(() => {
		const layout = preview.project.layout;
		const facts = new Map<
			string,
			{ name: string | null; reference: string | null; areaM2: number | null }
		>();
		for (const room of model.rooms) {
			const pair = identityLabelPair(
				roomIdentity(layout, room.roomId),
				formatPlacementLabel(room.roomId)
			);
			facts.set(room.roomId, {
				name: pair.label,
				reference: pair.reference,
				areaM2: roomFloorAreaM2(room.floorPolygon)
			});
		}
		return facts;
	});
	/**
	 * P23.13 S3 — the browser text-measure seam for Room label placement, plus the
	 * sticky placement memo and the settle generation. All three are presentation
	 * machinery: the memo is never document state, history or a persisted value.
	 */
	const roomLabelText = createBrowserTextMeasure();
	const roomLabelMemory: RoomLabelMemory = new Map();
	/**
	 * Advanced 150 ms after zoom/gesture activity stops. The placer's reappearance
	 * gate reads it, so hysteresis is expressed as a deterministic generation
	 * rather than a wall-clock read inside the projection.
	 */
	let roomLabelSettleGeneration = $state(0);
	let roomLabelSettleTimer: ReturnType<typeof setTimeout> | null = null;
	// The projection reads the previous geometry identity to decide whether a
	// resolution may relocate freely (`geometry`) or must stay sticky (`lod`). It
	// has to be `$state`: the reason is computed inside a derived, so a plain
	// write would never invalidate that derived and the reason would latch on
	// `geometry` — relocating freely on every later zoom, which is exactly the
	// stickiness the slice promises. The post-effect same-value write is a no-op,
	// so the extra pass converges.
	let roomLabelGeometryKey = $state<string | null>(null);
	/**
	 * P23.13 S4 / §6 — control targets grow to 44×44 on a coarse pointer. Read
	 * once per pointer-type change (never per pointermove) and kept as state so
	 * the acquisition verdict stays reactive to a hybrid device switching input.
	 */
	let planCoarsePointer = $state(false);
	$effect(() => {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
		const query = window.matchMedia('(pointer: coarse)');
		const update = () => {
			planCoarsePointer = query.matches;
		};
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	});
	const planGestureActive = $derived(
		interaction.editing !== null ||
			interaction.objectDrag !== null ||
			interaction.roomUnitDrag !== null ||
			interaction.wallOpeningDrag !== null ||
			interaction.architectureEdit !== null
	);
	/**
	 * Why the label placer is being consulted: a live gesture freezes the accepted
	 * candidates, a geometry change may relocate freely, and any other re-resolve
	 * (zoom, pan, resize) must stay sticky. Recorded from the previous frame's
	 * geometry identity, never persisted.
	 */
	const roomLabelReconsiderReason: RoomLabelReconsiderReason = $derived(
		planGestureActive
			? 'frozen'
			: roomLabelGeometryKey !== null && roomLabelGeometryKey === `${preview.previewVersion}`
				? 'lod'
				: 'geometry'
	);
	$effect(() => {
		void interaction.planView.pixelsPerMeter;
		void interaction.planView.center[0];
		void interaction.planView.center[1];
		void interaction.planView.width;
		void interaction.planView.height;
		void planGestureActive;
		if (roomLabelSettleTimer !== null) clearTimeout(roomLabelSettleTimer);
		roomLabelSettleTimer = setTimeout(() => {
			roomLabelSettleTimer = null;
			roomLabelSettleGeneration += 1;
		}, ROOM_LABEL_SETTLE_DELAY_MS);
		return () => {
			if (roomLabelSettleTimer !== null) {
				clearTimeout(roomLabelSettleTimer);
				roomLabelSettleTimer = null;
			}
		};
	});
	onMount(() => {
		// Label extents depend on the real font, so both the cache and the memoized
		// placements must be dropped when the font actually loads.
		const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
		const dropMetrics = () => {
			roomLabelText.invalidate();
			// Memoized placements were fitted against the old metrics: both the cache
			// and the accepted candidates it produced are invalid.
			roomLabelMemory.clear();
		};
		void fonts?.ready.then(dropMetrics);
		fonts?.addEventListener?.('loadingdone', dropMetrics);
		return () => fonts?.removeEventListener?.('loadingdone', dropMetrics);
	});
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
			// P23.13 S3 — resolved display identity (name → reference → raw-ID label)
			// and derived area per compiled Room, the real text metrics, the sticky
			// placement memo and the reconsideration/settle signals.
			roomLabels: {
				facts: roomLabelFacts,
				measure: roomLabelText.measure,
				memory: roomLabelMemory,
				reason: roomLabelReconsiderReason,
				settleGeneration: roomLabelSettleGeneration,
				// P23.13 S8 / §1.12 — the live instrument zone's tier ceiling. Absent
				// (no instrument being worked) means every label keeps its own tier.
				tierDropZone: planAttentionLabelTierDrop(activeAttentionZone) ?? undefined
			},
			// P23.13 S6 / §7 — the dimension lane freeze. One memory per viewport,
			// like the salience hysteresis: §7 freezes the side at gesture start, so
			// the decision has to outlive a frame without ever entering the document.
			dimensions: { memory: planDimensionMemory },
			// P23.13 S4 — the focused control's ring and its owner's control net +
			// true reference centerline. Geometry comes from canonical compiled
			// samples, so a curve keeps its curve; a missing owner draws nothing.
			focus: planFocusOverlay(),
			runStartPoint: interaction.wallChainRunStartJunctionId
				? resolveJunctionPoint(interaction.wallChainRunStartJunctionId)
				: null,
			// P23.13 S8 / §7 — canonical face evidence for the live run's closure:
			// the closing leg's own plan already produced these polygons, so the
			// overlay may show a face without ever claiming one. Empty outside a
			// closing run (and outside a run altogether).
			closureFaces: wallChainClosureFaces(),
			issues: preview.issues
		};
	});
	// Recorded after `wallFirstContext` is read (a memo, not state): the next
	// resolution compares against it to tell a geometry change from a pure
	// scale/pan re-resolve. Pan alone never invalidates an accepted candidate —
	// its world anchor moves with the Room.
	$effect(() => {
		void wallFirstContext;
		roomLabelGeometryKey = `${preview.previewVersion}`;
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
	/**
	 * P23.13 S7 / §7 — where the numeric field sits: on the value it replaces.
	 *
	 * It is read back from the very primitive that draws that value (the placed
	 * dimension text's world anchor plus the screen offset the paint layer applies),
	 * so the field cannot drift from the instrument it edits — the same round trip
	 * every other label uses, and no second placement to keep in sync. A field whose
	 * host has no live measure (or whose measure had to move to the readout) falls
	 * back to the pending leg's start on the §7 lane offset rather than guessing a
	 * location: an editor with no value to sit on still has to appear somewhere.
	 */
	const numericEntryAnchorPx = $derived.by(() => {
		const state = numericEntry;
		if (!state) return null;
		return planNumericEntryAnchorPx(interaction.planView, baseInteractionProjection.labels, {
			measureKey: numericEntryMeasureKey(state),
			fallbackWorld: numericEntryFallbackWorld()
		});
	});

	/**
	 * §7: "Tool change cancels the whole proposal." The tool change cancels the run
	 * itself; the field has to go with it, or the next keystroke would be editing a
	 * gesture that no longer exists.
	 */
	$effect(() => {
		const tool = interaction.tool;
		if (tool !== numericEntryTool) {
			numericEntryTool = tool;
			numericEntry = null;
		}
	});

	/**
	 * The field takes the keyboard as it appears, with its text selected, so the
	 * first keystroke *replaces* the displayed value (§7) instead of appending to
	 * it — and Tab re-selects, because the newly focused field is a different
	 * number, not more of the same one.
	 */
	let numericEntryFocusKey: string | null = null;
	$effect(() => {
		const state = numericEntry;
		if (!state || !numericEntryElement) {
			numericEntryFocusKey = null;
			return;
		}
		const key = `${state.host}:${state.fieldIndex}`;
		if (numericEntryFocusKey === key && document.activeElement === numericEntryElement) return;
		numericEntryFocusKey = key;
		numericEntryElement.focus();
		numericEntryElement.select();
	});
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
	/**
	 * P23.13 S5 / §7 — an explicit numeric value outranks a conflicting snap.
	 *
	 * S7 owns the numeric editor that sets this: it is the only producer, and
	 * until it exists nothing suppresses a snap, so the value is the identity
	 * `false` rather than a fabricated flag. The wiring lives here (not in S7)
	 * because it is a statement about *presentation precedence*, which is exactly
	 * what this slice owns: when a value is explicit, the winner marker is
	 * removed and the relation reports `Exact value` instead.
	 */
	/**
	 * P23.13 S7 / §7 — "Explicit values outrank a conflicting snap: remove its
	 * winner marker and report `Exact value`." S5 shipped that presentation and
	 * left the flag for S7; an open field holding a *valid* value is what sets it.
	 */
	const snapSuppressedByExplicitValue = $derived(planNumericEntryHoldsExplicitValue(numericEntry));
	const architectureEditProjection = $derived(
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
			snapFeedback,
			// The view is passed so the relation word can pick the side that has
			// room: the winner is anchored to the pointer, and a word clipped by the
			// canvas edge reports a relation nobody can read.
			{ explicitValue: snapSuppressedByExplicitValue, view: interaction.planView }
		),
			architectureEditIntent
		)
	);
	/**
	 * P23.13 S8 / §6 — the persisted refusal composes **over** the live proposal
	 * and never replaces it: the original geometry keeps its committed
	 * position/ink/opacity (nothing was installed), the refused attempt is gone
	 * with its gesture, and what stays is the mark and the planner's own reason.
	 */
	const interactionProjection = $derived(
		withPlanRefusalAnnotation(architectureEditProjection, activePlanRefusal)
	);
	const planModel = $derived(
		p2311Measure('plan-render-model', () => buildPlanRenderModel(preview.geometry, cameraProjection, interactionProjection, sceneProjection))
	);
	/**
	 * P23.13 S2 — semantic zoom, resolved once per frame. The hysteresis memory
	 * lives outside the derived value so regime and per-Opening gates keep their
	 * history across frames, and a live gesture reads its frozen snapshot instead.
	 */
	const salienceMemory = createPlanSalienceMemory();
	/**
	 * P23.13 S6 — spec §7's dimension lane freeze. Session state only, never
	 * persisted and never part of history; cleared with the component.
	 */
	const planDimensionMemory = createPlanDimensionMemory();
	const planSalience = $derived(
		salienceFreeze ??
			resolvePlanSalience({ model: planModel, view: interaction.planView }, salienceMemory)
	);
	/**
	 * P23.13 S8 / §1.12 — the resolved presentation the paint layer reads. The
	 * instrument zone adds its region-scoped Scene dim here and nowhere else: S2's
	 * snapshot is wrapped, never rewritten, so the regime value is still the one
	 * source for every footprint outside the zone.
	 */
	const planPresentation = $derived(
		withPlanAttentionSceneInk(planSalience, interaction.planView, activeAttentionZone)
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
	// P23.12 — the selection label's identity tier, resolved by the shared
	// display-identity layer (same vocabulary as the Navigator and Inspector).
	const selectedOpeningIdentity = $derived.by(() =>
		selectedOpeningSelection
			? openingIdentity(preview.project.layout, selectedOpeningSelection.openingId)
			: null
	);
	/**
	 * The D2 tier order for the canvas selection label: authored name first, else
	 * the compact reference, else the kind. A named Opening used to be labelled by
	 * its reference or kind alone, which dropped the authored name entirely.
	 */
	const selectedOpeningLabel = $derived(
		selectedOpening && selectedOpeningIdentity
			? identityPrimaryLabel(selectedOpeningIdentity, selectedOpening.kind)
			: (selectedOpening?.kind ?? null)
	);
	/**
	 * P23.12 D5/S7 — `.plan-meta` selection feedback, composed by the shared
	 * display-identity layer. It never prints the internal `selection.kind` token
	 * (`physicalWall`, `wallOpening`, `interiorAnchor`), which no other product
	 * surface exposes.
	 */
	const planSelectionLabel = $derived(
		layoutSelectionLabel(preview.project.layout, interaction.selection)
	);
	/**
	 * P23.13 S3 — the fixed canvas readout, resolved by the same placer that laid
	 * the resting labels out, so it can never disagree with what is on the paper.
	 */
	const roomLabelReadout = $derived(baseInteractionProjection.roomLabelReadout ?? null);
	/**
	 * P23.13 S6 — §7's last resort for a working dimension: a measure that could
	 * not be drawn where it was taken (a span too short to hold its own text, or
	 * text that would leave the canvas) reports here instead of shrinking. It
	 * shares the one fixed readout surface, so the viewport still has exactly one
	 * place that can hold text which has nowhere else to go.
	 */
	const measureReadout = $derived(baseInteractionProjection.measureReadout ?? null);
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

	// P23.14 §13 (carried row) — an EXTERNAL history transaction invalidates an
	// open numeric field. Import/reset/undo/redo bump `reframeVersion`, and the
	// field's anchor follows the new geometry while its text stays the value the
	// user opened: the number would then describe a shape that no longer exists,
	// and committing it would be a surprising edit. The entry is cancelled through
	// its own lifecycle function, never by a second field-state rule here. A
	// field's own commit bumps only `previewVersion`, so a successful entry can
	// never cancel itself.
	let numericEntryReplacementVersion = $state<number | null>(null);
	$effect(() => {
		const version = preview.reframeVersion;
		if (numericEntryReplacementVersion === null) {
			numericEntryReplacementVersion = version;
			return;
		}
		if (version === numericEntryReplacementVersion) return;
		numericEntryReplacementVersion = version;
		if (numericEntry) closeNumericEntry();
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
		dragSnapshot = null;
		roomUnitSnapshot = null;
		architectureEditSnapshot = null;
		architectureEditStartScreen = null;
		architectureEditMoved = false;
		// P23.13 S2 — clearing the snapshot here bypasses the tool-change effect
		// below (it early-returns on a null snapshot) and therefore
		// `finishArchitectureEditGesture`, so the frozen salience snapshot has to
		// be released with the baseline it was captured against.
		salienceFreeze = null;
		cancelLayoutArchitectureEdit(interaction);
		// P23.13 S4 / §6 — "mode changes cancel capture and clear the prior owner's
		// instrument". Releasing focus with the gesture is part of that: a cancel
		// removes the whole instrument rather than leaving a ring on a control no
		// longer under edit.
		clearPlanKeyboardFocus();
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
			target.kind !== 'physicalWall' &&
			// P23.14 §13 — a canonical endpoint hit carries `{wallId, endpoint}`;
			// the Junction is resolved from the document below (the same lookup the
			// click-select path uses). No second hit resolver is introduced.
			target.kind !== 'wallEndpoint'
		) {
			return; // vertex/opening-endpoint/anchor targets have no approved v1 items
		}
		// P23.14 §13 — the Junction behind an endpoint hit, or `null` when the
		// document no longer resolves one (a stale hit gets no menu at all).
		const hitJunctionId =
			target.kind === 'wallEndpoint'
				? wallEndpointJunctionId(target.wallId, target.endpoint)
				: null;
		if (target.kind === 'wallEndpoint' && !hitJunctionId) return;
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
		} else if (
			target.kind === 'wallEndpoint' &&
			hitJunctionId &&
			(interaction.selection.kind !== 'junction' ||
				interaction.selection.junctionId !== hitJunctionId)
		) {
			// The menu acts on the Junction the user pointed at, selected through
			// the canonical writer (never a raw slot write).
			selectLayoutJunction(interaction, hitJunctionId);
		}
		// P23.14 §13 — one explicit target mapping, resolved by kind. A Junction
		// target exists only when the endpoint resolved one above.
		let menuTarget: PlanLayoutTarget;
		switch (target.kind) {
			case 'wallEndpoint':
				if (!hitJunctionId) return;
				menuTarget = { kind: 'junction', junctionId: hitJunctionId };
				break;
			case 'room':
				menuTarget = { kind: 'room', roomId: target.roomId };
				break;
			case 'opening':
				menuTarget = { kind: 'opening', roomId: target.roomId, openingId: target.openingId };
				break;
			case 'physicalWall':
				menuTarget = {
					kind: 'wall',
					wallId: target.wallId,
					// Canonical-start meters straight from the hit projection.
					splitDistance: target.projection.offset
				};
				break;
			case 'object':
				menuTarget = { kind: 'object', objectId: target.objectId };
				break;
			default:
				return;
		}
		event.preventDefault();
		contextMenu.open({
			surfaceId: 'scene-plan-layout',
			x: event.clientX,
			y: event.clientY,
			items: buildPlanLayoutContextMenuItems({
				target: menuTarget,
				mutationBlockedReason:
					store.isDocumentMutationBlocked ? 'Preview is active' : null,
				// P23.14 §13 — the refusal reason is the core planner's, never a
				// second eligibility check in this surface.
				dissolveBlockedReason: hitJunctionId
					? wallFirstJunctionDissolveRefusal(preview, hitJunctionId)
					: null,
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
							...(onWallDelete ? { deleteWall: (wallId: string) => onWallDelete?.(wallId) } : {}),
							// P23.14 §13 — the Junction-dissolve command reuses the existing
							// authority. Omitted (never stubbed) when the mount cannot dissolve.
							...(onJunctionDissolve && hitJunctionId
								? {
										dissolveJunction: (junctionId: string) => onJunctionDissolve?.(junctionId)
									}
								: {})
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
		// P23.13 S4 / §6 — width edges are controls, so they are acquired at the
		// ratified 24 px target (44 px coarse), not at the entity radius. Before
		// this, the drawn 7 px square had to be hit almost exactly even though the
		// acquisition target was supposed to be larger than the mark.
		const radius = planControlTargetRadiusPx(planCoarsePointer);
		if (distance(handles.start, screen) <= radius) return 'start-edge';
		if (distance(handles.end, screen) <= radius) return 'end-edge';
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
	 * P23.13 S8 — one mechanism for where a canonical Opening drag lands at one
	 * world point: project onto the host Wall, then resolve that offset through the
	 * P23.2 raw/snap use-mode. Returns `false` when the point has no honest
	 * projection onto the host — nothing is invented to replace it.
	 *
	 * The **hover and the release both run this**, which is what makes release truth
	 * true: the commit re-derives at the pointer-up's own point instead of writing
	 * whatever the last preview frame happened to leave in the drag. The two paths
	 * cannot drift because there is only one of them.
	 */
	function applyWallOpeningDragPoint(drag: LayoutWallOpeningDrag, point: LayoutVec2): boolean {
		const projection = projectPointToPhysicalWall(model.queries, drag.wallId, point);
		if (!projection) return false;
		const wallLength =
			wallFirstWallLengthFor(drag.wallId) ??
			compiledPhysicalWallLength(model.queries, drag.wallId);
		resolveWallOpeningDragUpdate(drag, projection.offset, wallLength);
		return true;
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
		// P23.13 S8 / §6 — "until the next deliberate action": any new press clears
		// the persisted refusal, so a mark can never sit under a gesture the user
		// has already moved on to.
		clearPlanRefusal();
		planPointerButtonDown = true;
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
		// P23.13 S7 / §7 — while a numeric field is open the canvas belongs to it:
		// the press starts no gesture and does not blur the input (preventing the
		// pointerdown default keeps focus), so a click can never discard a typed
		// value and commit the pointer-positioned segment in its place. Enter
		// submits, Escape restores.
		if (numericEntry) {
			event.preventDefault();
			return;
		}
		// A press that actually reaches the canvas takes the keyboard instrument
		// back (see `releasePlanKeyboardInstrument`). A press swallowed by an open
		// field above deliberately does not: it changes nothing, so it must not end
		// the keyboard's claim on the group.
		releasePlanKeyboardInstrument();
		svgElement?.focus();
		const point = worldPoint(event);
		const screen = screenPoint(event);
		if (!point || !screen) return;
		dismissSceneBridge();
		// P23.13 S4 / §6 — focus follows the control the pointer actually took:
		// acquiring a control focuses it (which is what reveals its owner's
		// control polygon and reference centerline), and a press that acquires no
		// control moves the instrument away and drops the ring. Focus is never
		// selection and never history — moving it changes nothing else.
		if (interaction.planViewMode === 'layout') {
			const authority = planAcquiredControl(point);
			setPlanFocus(
				interaction,
				authority ? { kind: authority.kind, id: authority.id, ownerId: authority.ownerId } : null
			);
		}

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
			// S4 — the acquisition radius when a control has claimed the pointer,
			// otherwise the unchanged entity radius.
			planHitTolerance(point),
			planHitOptions(point)
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
			// P23.13 S8 / D2 — a legacy room-owned Opening span is **select-only**.
			// The room-owned drag was a second mechanism for a question the
			// wall-first gesture already answers (where an Opening sits on its host),
			// with no canonical command behind it and no release-truth contract, and
			// its document format is read-only-in-practice. Gating the whole legacy
			// document at load was the alternative and is not cheap — the legacy
			// room/opening surfaces are deliberately still editable — so the drag
			// branch is removed instead of half-specified. Values are edited in the
			// Inspector, which is where every other legacy number already lives.
			selectLayoutOpening(interaction, target.roomId, target.segmentId, target.openingId);
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
		// P23.13 S7 / §7 — an open numeric field freezes the proposal: the pending
		// leg must not follow the pointer while its length is being typed, or the
		// value being edited would move out from under the caret.
		if (
			!numericEntry &&
			wallChainRoleForTool(interaction.tool) !== null &&
			interaction.planViewMode === 'layout'
		) {
			if (hasWallChainRun(interaction)) {
				const point = worldPoint(event);
				updateWallChainCursor(
					interaction,
					point ? applyLayoutSnap(point, { anchor: wallChainSnapAnchor() }) : null
				);
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
			!pendingWallBend
		) {
			const hoverPoint = worldPoint(event);
			const hoverHit =
				hoverPoint === null
					? null
					: resolvePlanHit(
							model.queries,
							hoverPoint,
							// S4 — owner intent above entity class, on hover too, so the
							// affordance the pointer is actually on is the one that lights up.
							planHitTolerance(hoverPoint),
							planHitOptions(hoverPoint)
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
			if (point) applyWallOpeningDragPoint(interaction.wallOpeningDrag, point);
			// P23.13 S8 / §1.12 — the dragged Opening is the instrument.
			touchPlanAttention(wallOpeningDragLocus());
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
		planPointerButtonDown = false;
		// P23.2 clear rule — a released pointer ends feedback; commits consume
		// the already-resolved candidate positions captured during the drag.
		clearLayoutSnapFeedback();
		// P23.13 S7 / §7 — typing during an active pointer drag freezes the proposal
		// and consumes that drag's pointer-up without committing, so the release can
		// never place the pointer-positioned candidate the user just replaced with a
		// number. The chain tools commit on *click*, so that click is suppressed with
		// it — one interaction, one consumption.
		const numericPointerUp = planNumericPointerUp(numericEntry);
		if (numericPointerUp.consumed) {
			numericEntry = numericPointerUp.state;
			suppressNextClick = true;
			pointerId = null;
			svgElement?.releasePointerCapture(event.pointerId);
			return;
		}
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
			// P23.13 S8 release truth — re-derive at the pointer-up's own point through
			// the same instrument the hover used, so the Opening that commits is the one
			// the release promised rather than the last preview frame's. A release with
			// no honest projection (off-canvas, off the host Wall) leaves the live
			// candidate standing, exactly as the hover left it.
			const release = worldPoint(event);
			if (release) applyWallOpeningDragPoint(drag, release);
			if (!drag.valid) {
				preview.statusMessage = 'Opening does not fit on this wall';
				// P23.13 S8 / §6 — the refused Opening keeps its mark on the drawing,
				// at the candidate's own attempted center (the position it was refused),
				// while the committed Opening stays exactly where it was.
				armPlanRefusal({
					kind: 'opening-drag',
					locus: wallOpeningDragLocus(),
					reason: 'Opening does not fit on this wall',
					ownerKey: drag.openingId
				});
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
					armPlanRefusal({
						kind: 'opening-drag',
						locus: wallOpeningDragLocus(),
						reason: result.message ?? null,
						ownerKey: drag.openingId
					});
				}
			}
			cancelLayoutWallOpeningDrag(interaction);
			dragSnapshot = null;
			pointerId = null;
			svgElement?.releasePointerCapture(event.pointerId);
			return;
		}
		pointerId = null;
		dragSnapshot = null;
		svgElement?.releasePointerCapture(event.pointerId);
		if (interaction.tool === 'rectangle') {
			commitRectangleDraft();
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
		planPointerButtonDown = false;
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
		// P23.13 S7 — a field owns the gesture: a click while one is open never
		// commits a pointer-positioned segment behind the typed value.
		if (numericEntry) return;
		// P23.13 S8 / D1 — the pointer alternative to A5's second reach is **retired**:
		// nothing on the drawing opens an editor, so no click is ever consumed here.
		// The keyboard door stands — Enter on the selection's own primary measure
		// (`beginNumericEntryFromFocus`), Enter on a focused control, and typing
		// during a gesture — and exact values are otherwise the Inspector's.
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
		// Release truth (S8): the click re-resolves against the live anchor rather
		// than trusting the hover's remembered candidate, so what the guide showed
		// is exactly what commits — and a click with no run yet has no anchor, so
		// the first leg of a chain is never axis-locked to a start that does not
		// exist.
		const snapped = resolveLayoutSnapCandidate(rawPoint, { anchor: wallChainSnapAnchor() });
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
		finishWallChainSegment(result, snapped.point);
	}

	/**
	 * P23.13 S7 — the continuation half of a segment commit, shared by the pointed
	 * and the typed path so a typed segment advances the run exactly like a clicked
	 * one (a second rule here would be a second run semantics).
	 *
	 * The guard for a success that reports no canonical junction ids lives *here*,
	 * for both callers: `success` and "has junctions" are separately checked, so two
	 * callers each checking the same result is precisely how they drift. Without ids
	 * there is no canonical end to continue from, and inventing one from the
	 * fallback point would seed the next segment on a coordinate the document never
	 * accepted — the run is cancelled instead, exactly as the pointed path always
	 * did.
	 */
	function finishWallChainSegment(
		result: { startJunctionId?: string; endJunctionId?: string; closedRun?: boolean; wallHeight?: number },
		fallbackPoint: LayoutVec2
	) {
		if (result.startJunctionId === undefined || result.endJunctionId === undefined) {
			cancelWallChainRun(interaction);
			return;
		}
		const endPoint = resolveJunctionPoint(result.endJunctionId) ?? [...fallbackPoint];
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

	// -----------------------------------------------------------------------
	// P23.13 S7 — exact numeric entry (§7 "Adopt optional type-to-enter", A5)
	// -----------------------------------------------------------------------

	/**
	 * The live values the field is seeded from, read from the same gesture state the
	 * dimension instrument measures — the pending leg's length and angle. Both are
	 * canonical numbers, never the *formatted* strings §7 warns about: the field
	 * seeds from what the planner would see, and only ever displays two decimals.
	 */
	function pendingWallChainCandidates(): PlanNumericCandidates {
		const start = interaction.wallChainStart;
		if (!start) return { length: null, angle: null };
		const cursor = interaction.wallChainCursor;
		const length = cursor ? distance(start, cursor) : null;
		// `wallChainPendingDirection` is the plan's own direction memory (live cursor,
		// else last hover, else last committed segment, else +X); the typed length
		// uses it too, so the field and the commit agree on "which way".
		const direction = wallChainPendingDirection(interaction);
		return {
			length: length !== null && length > 1e-6 ? length : null,
			angle: planNumericAngleDegrees(direction[0], direction[1])
		};
	}

	/** The pending leg's length, or `null` when the run has no direction yet. */
	function pendingWallChainLength(): number | null {
		const start = interaction.wallChainStart;
		const cursor = interaction.wallChainCursor;
		if (!start || !cursor) return null;
		const length = distance(start, cursor);
		return length > 1e-6 ? length : null;
	}

	/**
	 * §7's measure key for the field being edited, i.e. the value the field sits on.
	 * A field whose host has no live instrument returns `null` here and lands on its
	 * fallback instead (see `numericEntryFallbackWorld`) — a Junction's coordinate
	 * entry sits on a handle, not on a number the drawing carries.
	 */
	function numericEntryMeasureKey(state: PlanNumericEntryState): string | null {
		const field = planNumericEntryField(state);
		if (state.host === 'wall-chain') {
			if (field.id === 'length') return 'leg:length';
			if (field.id === 'angle') return 'leg:angle';
			return null;
		}
		const subject = numericEntrySubject;
		if (!subject) return null;
		// The measures §6/S6 already draw, so the field lands on the number the user
		// clicked rather than near it. Every key here is one the derivation produces;
		// a subject with no ink of its own (a Junction's coordinates) answers `null`
		// and lands on its anchor instead (see `numericEntryFallbackWorld`).
		if (subject.kind === 'rectangle') {
			return field.id === 'depth' ? 'rect:depth' : 'rect:width';
		}
		if (subject.kind === 'wall' && state.host === 'wall-edit') {
			return `selected-wall:${subject.wallId}`;
		}
		if (subject.kind === 'opening' && field.id === 'offset') {
			return `selected-opening-offset:${subject.openingId}`;
		}
		if (subject.kind === 'opening') {
			return `selected-opening:${subject.openingId}`;
		}
		return null;
	}

	/**
	 * Where a field with no measure of its own appears. §7's anchor rule is "the
	 * value it replaces", and a host whose value is not drawn as a measurement (a
	 * Junction's coordinates, a measure whose text moved to the readout) still has
	 * an *owner* whose locus the user is looking at — so the field lands there, on
	 * the lane offset the placement module owns, rather than at the container
	 * origin where it would look like a stray input floating over the drawing.
	 */
	function numericEntryFallbackWorld(): LayoutVec2 | null {
		const subject = numericEntrySubject;
		if (!subject || subject.kind === 'wall-chain') {
			return interaction.wallChainStart ?? interaction.wallChainCursor;
		}
		if (subject.kind === 'rectangle') {
			return interaction.rectangleCurrent ?? interaction.rectangleStart;
		}
		if (subject.kind === 'junction') return resolveJunctionPoint(subject.junctionId);
		if (subject.kind === 'wall') {
			const span = physicalWallSpan(model, subject.wallId);
			return span ? [(span.start[0] + span.end[0]) / 2, (span.start[1] + span.end[1]) / 2] : null;
		}
		const edges = wallOpeningEdgeWorldPoints(model, subject.openingId);
		return edges
			? [(edges.start[0] + edges.end[0]) / 2, (edges.start[1] + edges.end[1]) / 2]
			: null;
	}

	/**
	 * A5's second reach: the resting measures the selection offers an editor for,
	 * in §7's order — the single rule Enter on the selection reads
	 * (`beginNumericEntryFromFocus`) and the one the target table answers.
	 *
	 * P23.13 S8 / D1: this used to be shared with the paint layer, which underlined
	 * the same measures and hit-tested their ink; both of those are retired with the
	 * pointer door, so there is no affordance to keep in step any more — only the
	 * keyboard door reads it. It deliberately contains only §7's *selected, idle*
	 * measures: the angle, the deltas and the coordinates §7 gives to a gesture or a
	 * focused control are not in it.
	 */
	const numericRestingMeasures = $derived.by(() => {
		const selection = interaction.selection as {
			kind: string;
			wallId?: string;
			openingId?: string;
		};
		const measures: { key: string; arc: boolean }[] = [];
		if (selection.kind === 'physicalWall' && selection.wallId) {
			const wall = wallFirstLayoutDocument()?.walls.find((entry) => entry.id === selection.wallId);
			if (wall) {
				measures.push({ key: `selected-wall:${wall.id}`, arc: wall.centerline.kind !== 'line' });
			}
		}
		if (selection.kind === 'wallOpening' && selection.openingId) {
			measures.push({ key: `selected-opening:${selection.openingId}`, arc: false });
			// §7 grants the offset to focus: a focused width edge is what asks the
			// Opening about its position, and the derivation draws the offset only then.
			if (interaction.planFocus?.kind === 'opening-edge') {
				measures.push({ key: `selected-opening-offset:${selection.openingId}`, arc: false });
			}
		}
		return measures.filter((measure) => planNumericRestingEntryTarget(measure) !== null);
	});

	/** The live Rect Room candidate's extents, or `null`s when there is no draft yet. */
	function rectangleDraftCandidates(): PlanNumericCandidates {
		const start = interaction.rectangleStart;
		const current = interaction.rectangleCurrent;
		if (!start || !current) return { width: null, depth: null };
		return {
			width: Math.abs(current[0] - start[0]) || null,
			depth: Math.abs(current[1] - start[1]) || null
		};
	}

	/**
	 * The live candidates for **whatever the open field edits**. §7's Tab refreshes a
	 * newly focused field from the gesture as it stands, so the seed has to follow
	 * the subject and not the host the editor happened to be built for: a Depth field
	 * that came up blank beside a drawn rectangle would be reporting that nothing is
	 * being drawn.
	 */
	function numericEntryCandidates(): PlanNumericCandidates {
		const subject = numericEntrySubject;
		if (!subject) return {};
		if (subject.kind === 'wall-chain') return pendingWallChainCandidates();
		if (subject.kind === 'rectangle') return rectangleDraftCandidates();
		if (subject.kind === 'wall') {
			return restingMeasureCandidates({ host: 'wall-edit', fieldId: 'length', ownerId: subject.wallId });
		}
		if (subject.kind === 'junction') {
			return restingMeasureCandidates({ host: 'junction', fieldId: 'x', ownerId: subject.junctionId });
		}
		const drag = interaction.wallOpeningDrag;
		if (drag && drag.openingId === subject.openingId) {
			return { width: drag.candidateWidth, offset: drag.candidateOffset };
		}
		return restingMeasureCandidates({ host: 'opening-resize', fieldId: 'width', ownerId: subject.openingId });
	}

	/** The canonical numbers a resting measure is seeded from, read from the document. */
	function restingMeasureCandidates(target: PlanNumericEntryTarget): PlanNumericCandidates {
		if (target.host === 'wall-edit') {
			const wall = wallFirstLayoutDocument()?.walls.find((entry) => entry.id === target.ownerId);
			const start = wall ? resolveJunctionPoint(wall.startJunctionId) : null;
			const end = wall ? resolveJunctionPoint(wall.endJunctionId) : null;
			return {
				length: wallFirstWallLengthFor(target.ownerId),
				angle: start && end ? planNumericAngleDegrees(end[0] - start[0], end[1] - start[1]) : null
			};
		}
		if (target.host === 'opening-resize' || target.host === 'opening-slide') {
			const opening = wallFirstOpeningById(target.ownerId);
			return {
				width: opening?.width ?? null,
				offset: opening?.offset ?? null
			};
		}
		if (target.host === 'junction') {
			const point = resolveJunctionPoint(target.ownerId);
			return { x: point?.[0] ?? null, z: point?.[1] ?? null };
		}
		return {};
	}

	/**
	 * The subject an entry target edits, so submission knows which command it owes.
	 * `null` for a host this component has no command for — unreachable through the
	 * mapping tables (they only ever name hosts wired below), and deliberately not
	 * defaulted to one of them: a future host falling through to *some* command would
	 * edit the wrong thing rather than decline to open.
	 */
	function entrySubjectFor(target: PlanNumericEntryTarget): PlanNumericSubject | null {
		switch (target.host) {
			case 'wall-edit':
				return { kind: 'wall', wallId: target.ownerId };
			case 'junction':
				return { kind: 'junction', junctionId: target.ownerId };
			case 'opening-resize':
			case 'opening-slide':
				return { kind: 'opening', openingId: target.ownerId };
			default:
				return null;
		}
	}

	/**
	 * Open the field on a value the user explicitly focused, with no keystroke to
	 * start it (§7: "Entry replaces the displayed value with a small input at the
	 * same location"). It shows the canonical value, selected, so the first
	 * keystroke replaces it; a measure with no canonical value opens blank and
	 * refused rather than pretending to hold a zero.
	 */
	function openNumericEntryAt(target: PlanNumericEntryTarget): boolean {
		const subject = entrySubjectFor(target);
		if (!subject) return false;
		preview.statusMessage = null;
		numericEntrySubject = subject;
		numericEntry = planNumericEntryOpen(target, restingMeasureCandidates(target));
		return true;
	}

	/**
	 * §7's keyboard alternative to clicking a value: "keyboard-focused control +
	 * Enter". A focused control wins over the selection's own measure, because the
	 * user put the focus there on purpose.
	 */
	function beginNumericEntryFromFocus(): boolean {
		if (numericEntry) return false;
		const focus = interaction.planFocus;
		if (focus) {
			const target = planNumericControlEntryTarget(focus.kind, focus.ownerId);
			if (target) return openNumericEntryAt(target);
		}
		const measure = numericRestingMeasures[0];
		const resting = measure ? planNumericRestingEntryTarget(measure) : null;
		return resting ? openNumericEntryAt(resting) : false;
	}

	/**
	 * P23.13 S10 / §9 — the selected owner's keyboard control group. Same LOD
	 * gate the overlay draws controls with: below it the affordances are not
	 * visible, so the keyboard must not focus what the eye cannot see. `null`
	 * is a real answer (no group for this selection), and the caller falls
	 * through to S7's resting-measure door instead.
	 */
	function planKeyboardTraversalFacts(): PlanTraversalLayout | null {
		const layout = wallFirstLayoutDocument();
		if (!layout) return null;
		const walls = new Map<string, { startJunctionId: string; endJunctionId: string; knotIds: readonly string[] }>();
		for (const wall of layout.walls) {
			walls.set(wall.id, {
				startJunctionId: wall.startJunctionId,
				endJunctionId: wall.endJunctionId,
				knotIds:
					wall.centerline.kind === 'cubic-chain'
						? wall.centerline.knots.map((knot) => knot.id)
						: []
			});
		}
		return { walls, junctions: new Set(layout.junctions.map((junction) => junction.id)) };
	}

	function planKeyboardGroup(): readonly PlanTraversalControl[] | null {
		if (interaction.planView.pixelsPerMeter < JUNCTION_HANDLES_MIN_PX_PER_M) return null;
		const facts = planKeyboardTraversalFacts();
		if (!facts) return null;
		const selection = interaction.selection;
		let traversal: PlanTraversalSelection;
		if (selection.kind === 'physicalWall') traversal = { kind: 'physicalWall', wallId: selection.wallId };
		else if (selection.kind === 'wallOpening') traversal = { kind: 'wallOpening', openingId: selection.openingId };
		else if (selection.kind === 'junction') traversal = { kind: 'junction', junctionId: selection.junctionId };
		else return null;
		return planTraversalGroup(traversal, facts);
	}

	/**
	 * P23.13 S10 / §9 — traversal runs only on a quiet canvas: no open field,
	 * no live gesture or draft that owns the keyboard. A traversal move is
	 * never an edit, so it must never interleave one.
	 */
	function planTraversalGestureQuiet(): boolean {
		return (
			!numericEntry &&
			!interaction.architectureEdit &&
			!architectureEditSnapshot &&
			!interaction.roomUnitDrag &&
			!interaction.objectDrag &&
			!interaction.wallOpeningDrag &&
			!dragSnapshot &&
			!draggedInteriorAnchor &&
			!pendingWallBend &&
			!interaction.primitiveDraft &&
			!interaction.presetDraft
		);
	}

	/**
	 * P23.13 S10 / §9 — the focused control's own current value and units, read
	 * from the canonical facts its numeric door already seeds from: a Junction or
	 * curve point is its document coordinate, an Opening width edge its width and
	 * the slide grip its offset. `null` where the document holds no value (a legacy
	 * draft has no canonical Junction; a control with no measure of its own has
	 * none), which announces role and owner without a number rather than a
	 * fabricated zero.
	 */
	function planKeyboardControlReadout(control: PlanTraversalControl): string | null {
		if (control.kind === 'junction') {
			const point = resolveJunctionPoint(control.id);
			return point ? planNumericHostReadout('junction', { x: point[0], z: point[1] }) : null;
		}
		if (control.kind === 'curve-control') {
			const knot = wallFirstKnotPoint(control.id);
			return knot ? planNumericHostReadout('curve-point', { x: knot[0], z: knot[1] }) : null;
		}
		if (control.kind === 'opening-edge' || control.kind === 'opening-slide') {
			const opening = wallFirstOpeningById(control.ownerId);
			if (!opening) return null;
			// One field each: the width edge is the width's handle and the paired grip
			// the offset's (§7), so an edge never reports the grip's number too.
			return control.kind === 'opening-edge'
				? planNumericHostReadout('opening-resize', { width: opening.width })
				: planNumericHostReadout('opening-slide', { offset: opening.offset });
		}
		return null;
	}

	/** The authored bend knot's canonical coordinate, or `null` when no Wall owns it. */
	function wallFirstKnotPoint(knotId: string): LayoutVec2 | null {
		const layout = wallFirstLayoutDocument();
		if (!layout) return null;
		for (const wall of layout.walls) {
			if (wall.centerline.kind !== 'cubic-chain') continue;
			const knot = wall.centerline.knots.find((candidate) => candidate.id === knotId);
			if (knot) return [knot.point[0], knot.point[1]] as LayoutVec2;
		}
		return null;
	}

	/**
	 * The selection identity the keyboard's control group belongs to, or `null`
	 * when the selection owns no group. Mirrors `planKeyboardGroup`'s mapping.
	 */
	function planKeyboardSelectionKey(): string | null {
		const selection = interaction.selection;
		if (selection.kind === 'physicalWall') return `physicalWall:${selection.wallId}`;
		if (selection.kind === 'wallOpening') return `wallOpening:${selection.openingId}`;
		if (selection.kind === 'junction') return `junction:${selection.junctionId}`;
		return null;
	}

	/**
	 * P23.13 S10 / §9 — release the keyboard instrument. The ring, the entry and
	 * the readout are one thing: nothing may drop one without the others.
	 */
	function clearPlanKeyboardFocus(): void {
		clearPlanFocus(interaction);
		planKeyboardGroupKey = null;
		planAnnouncedFocus = null;
	}

	/**
	 * P23.13 S10 / §9 — a primary press takes the instrument back. It is not a
	 * traversal: the keyboard's claim on the group ends (so merely clicking a
	 * control can never unlock the arrows — that is what Enter is for) and the
	 * spoken readout is retired, which is how "pointer focus stays silent" holds for
	 * the region too, including when the pointer edits the *same* control the
	 * keyboard had announced (same id, different value). Focus itself is the
	 * pointer's to set a few lines later, so this deliberately does not touch it.
	 */
	function releasePlanKeyboardInstrument(): void {
		planKeyboardGroupKey = null;
		planAnnouncedFocus = null;
	}

	/**
	 * P23.13 S10 / §9 — focus one control by keyboard. Focus is never
	 * selection and never history; the announcement names role + position +
	 * owner + the control's current value and units once for this move, and
	 * pointer focus stays silent.
	 */
	function focusPlanControlByKeyboard(control: PlanTraversalControl, index: number, groupSize: number): void {
		setPlanFocus(interaction, { kind: control.kind, id: control.id, ownerId: control.ownerId });
		planAnnouncedFocus = {
			controlId: control.id,
			text: planTraversalAnnouncement(
				control,
				index,
				groupSize,
				planSelectionLabel ?? 'Selection',
				planKeyboardControlReadout(control)
			)
		};
	}

	/**
	 * Close the field. `focusCanvas` returns the keyboard to the drafting surface,
	 * which is what Escape and a successful Enter mean (A5: "Escape exits edit, then
	 * group" — the user is back in the drawing, and the next digit must start the
	 * next exact value rather than land on `body`). Blur deliberately does not: focus
	 * went somewhere the user chose, and stealing it back would fight them.
	 */
	function closeNumericEntry(options: { focusCanvas?: boolean } = {}) {
		numericEntry = null;
		numericEntrySubject = null;
		if (options.focusCanvas) svgElement?.focus();
	}

	/**
	 * Commit the live Rect Room candidate through the path a release uses: the four
	 * corners come from `rectanglePoints`, so a typed rectangle and a dragged one are
	 * the same canonical graph. P23.9 — on a wall-first document Rectangle is the
	 * bounded four-Wall chain frontend; the legacy Room-polygon commit stays for
	 * legacy documents.
	 *
	 * The two formats differ on **refusal**, and that difference is pre-existing
	 * rather than something this helper chose: the wall-first branch clears the draft
	 * either way, while the legacy branch keeps a refused sketch so it can be
	 * corrected. Reproduced exactly, because quietly unifying them would change the
	 * only commit path a legacy document has, and that is not a numeric-entry
	 * decision.
	 */
	function commitRectangleDraft(): void {
		const points = rectanglePoints(interaction);
		if ('formatVersion' in preview.project.layout) {
			if (points && onCommit(points)) clearLayoutDraft(interaction);
			else clearLayoutDraft(interaction);
			return;
		}
		if (points && onCommit(points)) clearLayoutDraft(interaction);
		else if (!points) clearLayoutDraft(interaction);
	}

	/**
	 * §7's trigger, applied to the live gesture. Returns true when the keystroke
	 * became a field (so the canvas handler must not also read it).
	 */
	function beginNumericEntryFromKey(event: KeyboardEvent): boolean {
		if (numericEntry) return false;
		// §7's Opening rows first: an active slide/resize drag is the surface the
		// pointer is already on, and typing there means the width/offset the drag is
		// proposing — §7's "in an active pointer drag, typing freezes the proposal,
		// transfers to numeric editing, and consumes the eventual pointer-up".
		const drag = interaction.wallOpeningDrag;
		if (drag) {
			const started = planNumericEntryTrigger(event, {
				host: drag.mode === 'body' ? 'opening-slide' : 'opening-resize',
				candidates: { width: drag.candidateWidth, offset: drag.candidateOffset },
				dragActive: pointerId !== null
			});
			if (started) {
				preview.statusMessage = null;
				numericEntrySubject = { kind: 'opening', openingId: drag.openingId };
				numericEntry = started;
				return true;
			}
			return false;
		}
		// §7's Rect Room row: a live candidate offers "Width + depth", seeded from the
		// rectangle the pointer has already sketched.
		const rectangleStart = interaction.rectangleStart;
		const rectangleCurrent = interaction.rectangleCurrent;
		if (interaction.tool === 'rectangle' && rectangleStart && rectangleCurrent) {
			const started = planNumericEntryTrigger(event, {
				host: 'rectangle',
				candidates: rectangleDraftCandidates(),
				dragActive: pointerId !== null
			});
			if (!started) return false;
			preview.statusMessage = null;
			numericEntrySubject = { kind: 'rectangle' };
			numericEntry = started;
			return true;
		}
		if (wallChainRoleForTool(interaction.tool) === null || !hasWallChainRun(interaction)) return false;
		const started = planNumericEntryTrigger(event, {
			host: 'wall-chain',
			candidates: pendingWallChainCandidates(),
			// A chain commit is a *click*, not a release, and chain tools never take
			// pointer capture — so a drag is only in flight when the platform says a
			// button is still down.
			dragActive: pointerId !== null
		});
		if (!started) return false;
		preview.statusMessage = null;
		numericEntrySubject = { kind: 'wall-chain' };
		numericEntry = started;
		return true;
	}

	/**
	 * The field's own keyboard. The module decides what each key means; this only
	 * routes. Tab/Shift+Tab wrap inside the field set, Enter submits once, Escape
	 * restores the pre-entry candidate. Composition events are the IME's and are
	 * passed straight through, and Backspace/Delete belong to the caret rather than
	 * to the document while a field is open (§7's delete paths are for a *selected*
	 * entity, and the input is the only focused thing that is editable).
	 */
	function onNumericEntryKeyDown(event: KeyboardEvent) {
		const state = numericEntry;
		if (!state || event.isComposing) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			if (planNumericEntryEscape(state) === 'restore') {
				// Restoring needs no arithmetic: the proposal was frozen while the field
				// was open, so the canonical candidate was never mutated.
				closeNumericEntry({ focusCanvas: true });
				preview.statusMessage = null;
			}
			return;
		}
		if (event.key === 'Tab') {
			event.preventDefault();
			event.stopPropagation();
			numericEntry = planNumericEntryTab(
				state,
				event.shiftKey ? 'backward' : 'forward',
				numericEntryCandidates()
			);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			event.stopPropagation();
			submitNumericEntry();
			return;
		}
		if (event.key === 'Backspace' || event.key === 'Delete') event.stopPropagation();
	}

	function onNumericEntryInput(event: Event) {
		if (!numericEntry) return;
		const target = event.currentTarget as HTMLInputElement;
		numericEntry = planNumericEntryInput(numericEntry, target.value);
	}

	/** §7: "Blur never silently commits." The field closes; nothing is written. */
	function onNumericEntryBlur() {
		if (!numericEntry) return;
		if (planNumericEntryBlur(numericEntry) === 'discard') closeNumericEntry();
	}

	/**
	 * Enter. A valid value goes to the canonical command its subject owes, and a
	 * refusal keeps the field open with the planner's own reason and writes no
	 * history — §7's "invalid values stay editable with a reason; no history or
	 * allocation" extended to the release validator it also demands.
	 *
	 * One submit, one command: the subject decides *which*, so the lifecycle never
	 * learns geometry and the component never grows a second solver.
	 */
	function submitNumericEntry() {
		const state = numericEntry;
		if (!state) return;
		const outcome = planNumericEntrySubmit(state);
		if (outcome.kind === 'ignored') return;
		if (outcome.kind === 'refuse') {
			numericEntry = outcome.state;
			preview.statusMessage = planNumericInvalidMessage(outcome.reason, outcome.field);
			return;
		}
		const subject = numericEntrySubject;
		if (!subject) {
			closeNumericEntry();
			return;
		}
		if (subject.kind === 'wall-chain') return submitWallChainEntry(outcome);
		if (subject.kind === 'wall') return submitWallEditEntry(outcome, subject.wallId);
		if (subject.kind === 'opening') return submitOpeningEditEntry(outcome, subject.openingId);
		if (subject.kind === 'junction') return submitJunctionEntry(outcome, subject.junctionId);
		if (subject.kind === 'rectangle') return submitRectangleEntry(outcome);
	}

	/**
	 * A field opened on a value shows the value it replaces, so Enter without
	 * editing submits the number the document already holds. That is not an edit:
	 * the planner's own `no_op` says the same thing, and closing quietly means the
	 * user does not get a refusal message for a keystroke that changed nothing.
	 * Only fields the user actually typed into are compared — an untouched field
	 * rides the live value, which is always in agreement with itself.
	 */
	function numericEntryUnchanged(
		typed: number | undefined,
		live: number | null | undefined
	): boolean {
		if (typed === undefined) return true;
		return typeof live === 'number' && Math.abs(typed - live) < 1e-9;
	}

	/**
	 * Run one exact edit as exactly one history entry, or leave the document alone.
	 * The transaction is opened here so a rejection cancels rather than leaving half
	 * an edit installed; both the Wall length/angle pair and the Opening's
	 * width/offset patch land in the *same* entry, because §7 says Enter submits one
	 * canonical operation and one edit should not cost the user two undos.
	 *
	 * A successful edit also retires the keyboard's cached readout. The control's
	 * value has just changed, the ring is still on it (focus is deliberately
	 * untouched) and the entry is deliberately kept — so without this the region
	 * would go on holding the number the document no longer has, e.g. `Width 0.90 m`
	 * after the user typed `1.20`. It is **cleared, not recomputed**: re-deriving it
	 * here would read the value at whatever moment this happens to run, and a
	 * readout that refreshes itself on every change is exactly the chatter §9 forbids
	 * ("once per meaningful change, not each pointermove"). The user just typed the
	 * number, so nothing is owed to them; the next arrow re-announces fresh.
	 */
	function applyNumericEdit(
		apply: () => { success: boolean; message?: string }
	): { success: boolean; message?: string } {
		if (!onLayoutTransactionBegin()) {
			return { success: false, message: 'Finish the current layout interaction first' };
		}
		const result = apply();
		if (result.success) {
			onLayoutTransactionCommit();
			planAnnouncedFocus = null;
		} else onLayoutTransactionCancel();
		return result;
	}

	/** A rejected exact edit: the field stays open with the planner's own reason. */
	function holdNumericEntryOpen(
		outcome: Extract<PlanNumericSubmitOutcome, { kind: 'commit' }>,
		result: { success: boolean; message?: string }
	) {
		numericEntry = { ...outcome.state, submitted: false };
		preview.statusMessage = result.message ?? 'That value was refused';
	}

	/**
	 * §7's "Selected, idle" reach for a straight Wall: a typed Length and/or Angle
	 * applied to the Wall the user focused, in one history entry, with the Wall's
	 * start held — the endpoint the author never moved is the one that stays put.
	 * A curve has no exact-length command and its measure is not offered one, so
	 * this path is straight Walls only.
	 */
	function submitWallEditEntry(
		outcome: Extract<PlanNumericSubmitOutcome, { kind: 'commit' }>,
		wallId: string
	): void {
		const values = outcome.values;
		const live = restingMeasureCandidates({ host: 'wall-edit', fieldId: 'length', ownerId: wallId });
		if (numericEntryUnchanged(values.length, live.length) && numericEntryUnchanged(values.angle, live.angle)) {
			closeNumericEntry({ focusCanvas: true });
			return;
		}
		const result = applyNumericEdit(() => {
			let last: { success: boolean; message?: string } = { success: true };
			if (values.length !== undefined) {
				last = updateWallFirstWallLength(preview, wallId, values.length, 'start');
				if (!last.success) return last;
			}
			if (values.angle !== undefined) {
				// The canonical planner takes radians and the field is degrees (§7).
				last = updateWallFirstWallAngle(preview, wallId, (values.angle * Math.PI) / 180, 'start');
			}
			return last;
		});
		if (!result.success) {
			holdNumericEntryOpen(outcome, result);
			return;
		}
		closeNumericEntry({ focusCanvas: true });
	}

	/**
	 * §7's Opening rows: "Width; offset on focus" — one patch through the canonical
	 * Opening command, which validates the whole hosting-Wall set and rejects rather
	 * than clamping.
	 */
	function submitOpeningEditEntry(
		outcome: Extract<PlanNumericSubmitOutcome, { kind: 'commit' }>,
		openingId: string
	): void {
		const values = outcome.values;
		const drag = interaction.wallOpeningDrag;
		if (drag && drag.openingId === openingId) {
			// §7's transfer: typing during a drag freezes the proposal and hands it to
			// the field, so the typed numbers replace the candidate and the *drag's own*
			// commit path finishes the gesture — the same code a release runs, which is
			// what makes the transfer a transfer rather than a second commit route. The
			// drag already owns the open transaction (the pointer-down began it) and the
			// pointer-up that follows was consumed without committing.
			const patch: Parameters<typeof updateWallFirstOpening>[2] = {
				offset: values.offset ?? drag.candidateOffset
			};
			if (drag.mode !== 'body' || values.width !== undefined) {
				patch.width = values.width ?? drag.candidateWidth;
			}
			const result = updateWallFirstOpening(preview, openingId, patch);
			if (result.success) {
				onLayoutTransactionCommit();
				preview.statusMessage = drag.mode === 'body' ? 'Moved opening' : 'Resized opening';
			} else {
				onLayoutTransactionCancel();
				preview.statusMessage = result.message;
			}
			cancelLayoutWallOpeningDrag(interaction);
			dragSnapshot = null;
			pointerId = null;
			closeNumericEntry({ focusCanvas: true });
			return;
		}
		const live = restingMeasureCandidates({ host: 'opening-resize', fieldId: 'width', ownerId: openingId });
		if (numericEntryUnchanged(values.width, live.width) && numericEntryUnchanged(values.offset, live.offset)) {
			closeNumericEntry({ focusCanvas: true });
			return;
		}
		const patch: Parameters<typeof updateWallFirstOpening>[2] = {};
		if (values.width !== undefined) patch.width = values.width;
		if (values.offset !== undefined) patch.offset = values.offset;
		const result = applyNumericEdit(() => updateWallFirstOpening(preview, openingId, patch));
		if (!result.success) {
			holdNumericEntryOpen(outcome, result);
			return;
		}
		closeNumericEntry({ focusCanvas: true });
	}

	/** §7's "Coordinates on focused handle": one absolute X/Z move of the Junction. */
	function submitJunctionEntry(
		outcome: Extract<PlanNumericSubmitOutcome, { kind: 'commit' }>,
		junctionId: string
	): void {
		const current = resolveJunctionPoint(junctionId);
		if (!current) {
			closeNumericEntry();
			return;
		}
		const values = outcome.values;
		const point: LayoutVec2 = [values.x ?? current[0], values.z ?? current[1]];
		if (numericEntryUnchanged(values.x, current[0]) && numericEntryUnchanged(values.z, current[1])) {
			closeNumericEntry({ focusCanvas: true });
			return;
		}
		const result = applyNumericEdit(() => updateWallFirstJunction(preview, junctionId, point));
		if (!result.success) {
			holdNumericEntryOpen(outcome, result);
			return;
		}
		closeNumericEntry({ focusCanvas: true });
	}

	/**
	 * §7's Rect Room row: a typed Width/Depth sets the live candidate and then
	 * commits it exactly as releasing the pointer there would, through the same
	 * `rectanglePoints` → `onCommit` path. The drawn direction is kept, so typing the
	 * width of a rectangle sketched up-left does not flip it across its start corner.
	 */
	function submitRectangleEntry(outcome: Extract<PlanNumericSubmitOutcome, { kind: 'commit' }>): void {
		const start = interaction.rectangleStart;
		const current = interaction.rectangleCurrent;
		if (!start || !current) {
			closeNumericEntry();
			return;
		}
		const width = outcome.values.width ?? Math.abs(current[0] - start[0]);
		const depth = outcome.values.depth ?? Math.abs(current[1] - start[1]);
		const signX = current[0] < start[0] ? -1 : 1;
		const signZ = current[1] < start[1] ? -1 : 1;
		updateRectangle(interaction, [start[0] + signX * width, start[1] + signZ * depth]);
		closeNumericEntry({ focusCanvas: true });
		commitRectangleDraft();
	}

	/**
	 * The Wall-chain subject: a typed Length goes to `resolveWallChainEndpointAtLength`
	 * — the resolver P23.9 wrote for §7's Length form and never wired — and the same
	 * resolver with the typed *direction* for an angle.
	 */
	function submitWallChainEntry(outcome: Extract<PlanNumericSubmitOutcome, { kind: 'commit' }>) {
		const start = interaction.wallChainStart;
		if (!start) {
			closeNumericEntry();
			return;
		}
		// §7's explicit values resolve *together*: a typed Length pins the distance, a
		// typed Angle pins the direction, and every field the user left alone rides the
		// live leg — so typing a length, Tab, then an angle is one segment in one
		// commit rather than a segment plus a discarded number.
		const length = outcome.values.length ?? pendingWallChainLength();
		if (length === null) {
			// A direction with no distance is not a segment, and §7 forbids inventing
			// one: the field stays editable and says what is missing.
			numericEntry = { ...outcome.state, submitted: false };
			preview.statusMessage = 'Type a length, then the angle';
			return;
		}
		const typedAngle = outcome.values.angle;
		const endpoint = resolveWallChainEndpointAtLength(
			interaction,
			length,
			typedAngle !== undefined ? planNumericAngleDirection(typedAngle) : undefined
		);
		if (!endpoint) {
			numericEntry = { ...outcome.state, submitted: false };
			preview.statusMessage = `${planNumericEntryField(outcome.state).label} was refused`;
			return;
		}
		const savedRun = captureWallChainRun(interaction);
		const result = onWallSegmentCommit([...start], [...endpoint]);
		if (!result.success) {
			// A rejection rolls its history transaction back through snapshot restore,
			// which clears transient state; re-install the saved run so the run is still
			// there to correct. The planner refused the *candidate*, not the typing, so
			// the field stays open and unsubmitted for a corrected Enter.
			if (savedRun) restoreWallChainRun(interaction, savedRun);
			draftedVersion = preview.previewVersion;
			numericEntry = { ...outcome.state, submitted: false };
			return;
		}
		// A typed commit can land mid-press (typing one-handed with the button
		// held): the release that follows belongs to the press that predates this
		// Enter, so its click must not also draw a pointer-positioned segment —
		// one press, one segment.
		if (planPointerButtonDown) suppressNextClick = true;
		closeNumericEntry({ focusCanvas: true });
		finishWallChainSegment(result, endpoint);
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
	 * P23.13 S4 / §6 — the controls the pointer may acquire right now, built from
	 * the SAME gating the overlay draws them with, so an affordance that is not
	 * visible can never outrank one that is. Ownership is what decides the tier:
	 * a control of the selected owner (or the focused one, or a captured
	 * gesture's) beats the canonical entity fallback.
	 */
	function planAcquisitionCandidates(): PlanControlCandidate[] {
		const candidates: PlanControlCandidate[] = [];
		// Below the control LOD nothing is drawn, so nothing is acquirable.
		if (interaction.planView.pixelsPerMeter < JUNCTION_HANDLES_MIN_PX_PER_M) return candidates;
		const layout = wallFirstLayoutDocument();
		if (!layout) return candidates;
		const selection = interaction.selection;
		const focus = interaction.planFocus;

		// P23.11 — curve controls exist only while the selected Wall is curved, and
		// they outrank an unrelated co-located Opening or Junction (§6).
		for (const control of selectedCurveControls(layout.walls)) {
			candidates.push({
				id: control.anchorId,
				ownerId: control.wallId,
				kind: 'curve-control',
				point: control.point,
				ownerSelected: selection.kind === 'physicalWall' && selection.wallId === control.wallId,
				focused: focus?.kind === 'curve-control' && focus.id === control.anchorId
			});
		}

		// Junction handles: an edit context only (the same gate the overlay draws
		// with). An ordinary hover reveals no new controls, so a hovered Junction
		// that is not revealed is not acquirable either.
		const chainArmed = wallChainRoleForTool(interaction.tool) !== null;
		const junctionSelection = selection.kind === 'junction' ? selection : null;
		const editContext =
			chainArmed ||
			selection.kind === 'physicalWall' ||
			selection.kind === 'wallOpening' ||
			junctionSelection !== null;
		if (editContext) {
			const focusedJunctions = junctionFocusIds();
			for (const junction of layout.junctions) {
				if (focusedJunctions && !focusedJunctions.has(junction.id)) continue;
				candidates.push({
					id: junction.id,
					ownerId: junction.id,
					kind: 'junction',
					point: [junction.point[0], junction.point[1]] as LayoutVec2,
					// §6 — a Junction is a *selected-owner* control only when it is the
					// selection (or one of the selected Wall's endpoints); a tool-armed
					// chain is a tool-eligible target, not owner intent.
					ownerSelected:
						junctionSelection?.junctionId === junction.id ||
						selection.kind === 'physicalWall' ||
						selection.kind === 'wallOpening',
					toolEligible: chainArmed,
					focused: focus?.kind === 'junction' && focus.id === junction.id
				});
			}
		}

		// §6 — the selected Opening's width edges and slide grip. They are owner
		// controls of the selection, which is what lets "an active Opening width
		// square beat its host Wall" hold when a Junction sits on the same jamb.
		if (selection.kind === 'wallOpening') {
			const edges = wallOpeningEdgeWorldPoints(model, selection.openingId);
			if (edges) {
				candidates.push(
					{
						id: `${selection.openingId}:start`,
						ownerId: selection.openingId,
						kind: 'opening-edge',
						point: edges.start,
						ownerSelected: true,
						focused: focus?.kind === 'opening-edge' && focus.id === `${selection.openingId}:start`
					},
					{
						id: `${selection.openingId}:end`,
						ownerId: selection.openingId,
						kind: 'opening-edge',
						point: edges.end,
						ownerSelected: true,
						focused: focus?.kind === 'opening-edge' && focus.id === `${selection.openingId}:end`
					}
				);
				// The grip sits at the symbol center and is deliberately a *lower*
				// priority than the two edges: an edge must never be stolen by the
				// body mark between them. Equal tier, larger distance loses.
				candidates.push({
					id: `${selection.openingId}:slide`,
					ownerId: selection.openingId,
					kind: 'opening-slide',
					point: [(edges.start[0] + edges.end[0]) / 2, (edges.start[1] + edges.end[1]) / 2],
					ownerSelected: true
				});
			}
		}
		return candidates;
	}

	/**
	 * P23.13 S4 / §6 — the focus overlay payload for the current `planFocus`:
	 * the mark center, its radius and the owner geometry focus/drag reveals.
	 * Returns `null` when there is no focus, so nothing is drawn at rest.
	 */
	function planFocusOverlay() {
		const focus = interaction.planFocus;
		if (!focus) return null;
		const candidates = planAcquisitionCandidates();
		const match = candidates.find(
			(candidate) => candidate.kind === focus.kind && candidate.id === focus.id
		);
		if (!match) return null;
		return {
			point: match.point,
			radiusPx: planFocusMarkRadiusPx(match.kind),
			geometry: planFocusGeometry(
				{
					ownerId: match.ownerId,
					point: match.point,
					controlNet: planFocusControlNet(match.ownerId)
				},
				preview.geometry.walls
			)
		};
	}

	/**
	 * P23.13 S4 — the owner Wall's authored control net, read from the document:
	 * its two junctions for a straight Wall, its authored bend knots for a cubic
	 * chain. This is the one thing the compiled centerline cannot supply — a
	 * flattened curve knows nothing about where its bends were — so the caller
	 * that owns the document resolves it and the helper refuses to guess.
	 */
	function planFocusControlNet(wallId: string): LayoutVec2[] {
		const layout = wallFirstLayoutDocument();
		const wall = layout?.walls.find((candidate) => candidate.id === wallId);
		if (!wall) return [];
		if (wall.centerline.kind === 'cubic-chain') {
			return wall.centerline.knots.map((knot) => [knot.point[0], knot.point[1]] as LayoutVec2);
		}
		// A straight Wall's net IS the endpoints of its canonical centerline.
		const span = preview.geometry.walls.find((candidate) => candidate.wallId === wallId);
		const first = span?.solidCenterlinePolylines[0]?.[0];
		const lastSpans = span?.solidCenterlinePolylines.at(-1);
		const last = lastSpans?.[lastSpans.length - 1];
		return first && last ? [[first[0], first[1]], [last[0], last[1]]] : [];
	}

	/** The visible mark radius of a control kind (spec §6 control table). */
	function planFocusMarkRadiusPx(kind: PlanControlKind): number {
		switch (kind) {
			case 'junction':
				return PLAN_CONTROL_MARKS.junction.radiusPx;
			case 'curve-control':
				return PLAN_CONTROL_MARKS['curve-control'].radiusPx;
			case 'opening-edge':
				return PLAN_CONTROL_MARKS['opening-edge'].radiusPx;
			default:
				return 4;
		}
	}

	/** The Junction IDs an edit context focuses (`null` = every Junction). */
	function junctionFocusIds(): ReadonlySet<string> | null {
		const selection = interaction.selection;
		if (selection.kind !== 'physicalWall' && selection.kind !== 'wallOpening') return null;
		const layout = wallFirstLayoutDocument();
		if (!layout) return null;
		const wall = layout.walls.find((candidate) => candidate.id === selection.wallId);
		return new Set(wall ? [wall.startJunctionId, wall.endJunctionId] : []);
	}

	/**
	 * P23.13 S4 / §6 — the owner-aware acquisition verdict for one pointer
	 * position, or `null` when no tier claims it and the canonical entity
	 * resolver decides alone. A coarse pointer gets the 44 px target.
	 */
	function planAcquiredControl(point: LayoutVec2): PlanControlAuthority | null {
		return resolvePlanAcquisition({
			candidates: planAcquisitionCandidates(),
			point,
			planView: interaction.planView,
			coarsePointer: planCoarsePointer
		});
	}

	/**
	 * P23.13 S4 / §6 — the hit tolerance for one pointer position. A control the
	 * engine claimed is acquired at the ratified 24/44 px target, not at the
	 * entity radius: the whole point of a bigger target is that the pointer need
	 * not land on the visible mark. Uncontested pointers keep the entity radius,
	 * so ordinary selection is unchanged.
	 */
	function planHitTolerance(point: LayoutVec2): number {
		const authority = planAcquiredControl(point);
		const radiusPx = authority
			? planControlTargetRadiusPx(planCoarsePointer)
			: LAYOUT_PLAN_HIT_RADIUS_PX;
		return radiusPx / interaction.planView.pixelsPerMeter;
	}

	/**
	 * P23.11/S4 — the shared hit options for the SELECT and hover paths: the
	 * endpoint gate, the selected Wall's controls, and — when a pointer position
	 * is supplied — the owner-aware acquisition verdict. The context menu, the
	 * door/window tool and every non-select path keep `planHitEndpointGate()`:
	 * a control outranking the Wall body would otherwise remove the Wall's own
	 * context menu and block Opening placement next to a control.
	 */
	function planHitOptions(point?: LayoutVec2): {
		includeEndpoints: boolean;
		curveControls?: readonly PlanCurveControlCandidate[];
		controlAuthority?: PlanControlAuthority | null;
	} {
		const layout = wallFirstLayoutDocument();
		const controls = layout ? selectedCurveControls(layout.walls) : [];
		const authority = point ? planAcquiredControl(point) : null;
		return {
			...planHitEndpointGate(),
			...(controls.length > 0 ? { curveControls: controls } : {}),
			...(authority ? { controlAuthority: authority } : {})
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
			if (dragSnapshot || draggedInteriorAnchor) {
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
			// P23.13 S10 / §9 — Esc unwinds keyboard focus before anything
			// coarser: the ring drops, selection and history stand. Reaching
			// here means no gesture or draft is live (every one returned
			// above), so this branch can never swallow a gesture cancel.
			if (interaction.planFocus) {
				clearPlanKeyboardFocus();
				return;
			}
			onLayoutTransactionCancel();
			clearLayoutDraft(interaction);
			cancelRoomEdit(interaction);
			return;
		}
		// P23.13 S7 / §7 — during an active creation gesture a digit or decimal
		// separator starts exact entry (and `-` where the field's canonical domain
		// allows it). No other binding claims those keys, so this cannot steal one;
		// Escape above still exits the gesture, and every key the open field owns is
		// routed by its own input element below.
		if (
			event.key.length === 1 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			beginNumericEntryFromKey(event)
		) {
			event.preventDefault();
			return;
		}
		// P23.13 S10 / §9 — arrows walk the selected owner's control group in
		// canonical endpoint/arc order with wrap. No group, a live gesture, another
		// mode/tool, or a group the user has not entered with Enter all leave the
		// key alone, so page scroll and every other surface keep their arrows.
		if (
			(event.key === 'ArrowRight' ||
				event.key === 'ArrowLeft' ||
				event.key === 'ArrowDown' ||
				event.key === 'ArrowUp') &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			interaction.planViewMode === 'layout' &&
			interaction.tool === 'select' &&
			// A5 — arrows traverse a group the keyboard has *entered*: a pointer press
			// focuses controls without entering anything, so membership alone would let
			// a click unlock the arrows.
			planTraversalEnteredFor(planKeyboardGroupKey, planKeyboardSelectionKey()) &&
			planTraversalGestureQuiet()
		) {
			const group = planKeyboardGroup();
			if (group && group.length > 0) {
				const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
				// A5 — arrows traverse the group the user entered; they never enter it.
				// `planTraversalStep` answers `null` for a focus outside this group, so
				// an unentered selection leaves the arrow to the page rather than
				// swallowing a key the user has not asked this instrument to use.
				const next = planTraversalStep(
					group,
					interaction.planFocus?.id ?? null,
					direction as 1 | -1
				);
				if (next) {
					event.preventDefault();
					focusPlanControlByKeyboard(next, group.indexOf(next), group.length);
					return;
				}
			}
		}
		// P23.13 S7 step 2 / S10 / A5 — Enter first enters the selected owner's
		// control group (the ring lands on its first control, announced once),
		// and a focused control's Enter reaches S7's numeric door as before. A
		// selection with no group keeps the resting-measure door directly. A
		// field that is already open owns Enter through its own input, so this
		// can never steal a submit.
		if (
			event.key === 'Enter' &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			!numericEntry &&
			interaction.planViewMode === 'layout' &&
			interaction.tool === 'select'
		) {
			const group = planTraversalGestureQuiet() ? planKeyboardGroup() : null;
			const entered = planTraversalEnteredFor(planKeyboardGroupKey, planKeyboardSelectionKey());
			const focus = interaction.planFocus;
			const focusInGroup =
				!!group && !!focus && group.some((control) => control.id === focus.id);
			// Enter enters the group, and only a second Enter (with the entry held and
			// the ring already on a member) reaches the numeric door — so the chain is
			// the same whether the ring got there by keyboard or by a pointer press,
			// and a pointer-focused control cannot skip the entry.
			if (group && group.length > 0 && (!entered || !focusInGroup)) {
				const first = group[0];
				if (first) {
					event.preventDefault();
					planKeyboardGroupKey = planKeyboardSelectionKey();
					focusPlanControlByKeyboard(first, 0, group.length);
					return;
				}
			}
			if (beginNumericEntryFromFocus()) {
				event.preventDefault();
				return;
			}
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
		// P23 Junction dissolve: Delete/Backspace on a selected Junction joins
		// its two incident Walls (degree-2 only — anything else rejects through
		// the planner with a status message). Same Layout-authority gate as the
		// Wall branch above: in Arrange, Delete routes to the active owner
		// only, never to a remembered Layout selection.
		if (
			(event.key === 'Delete' || event.key === 'Backspace') &&
			interaction.tool === 'select' &&
			interaction.selection.kind === 'junction' &&
			interaction.planViewMode === 'layout'
		) {
			event.preventDefault();
			onJunctionDissolve?.(interaction.selection.junctionId);
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
	{#if planFocusAnnouncement}
		<!-- P23.13 S10 / §9 — keyboard focus announcements: role + position +
		     owner + current value and units, once per keyboard move, and only while
		     the ring is still on the announced control. Pointer focus stays silent,
		     and the region is empty the rest of the time, so nothing speaks per
		     pointermove. Visually hidden; never a second status channel. -->
		<div class="plan-focus-announcement" role="status">{planFocusAnnouncement}</div>
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
		<!-- P23.13 S9 / §8 — empty-state copy agreement: exact toolbar labels
		     (Wall, Rect Room, Poly Room), zoom/pan hint, no dimension promise.
		     Card remains for the dismissed-but-still-empty session tail and
		     non-Layout empty states; one committed wall removes it. -->
		<div class="plan-empty-state" role="status">
			<strong>Start your plan</strong>
			<span>Draw connected walls with Wall, or start with Rect Room or Poly Room.</span>
			<span>Scroll to zoom · Middle-drag to pan.</span>
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
			// P23.13 S7 — a press released off-canvas fires neither pointerup nor
			// pointercancel here (chain tools take no capture, so nothing retargets
			// it). Leaving is the "pointer is gone" signal: without this the flag
			// stays down forever and every later typed commit eats its next click.
			planPointerButtonDown = false;
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
		<PlanSvg model={planModel} planView={interaction.planView} presentation={planPresentation} />
		<PlanCanvasChrome layer="overlay" planView={interaction.planView} />
		{#if selectedOpening}
			<!-- P23.12 — selected-target feedback consumes the identity contract:
				name/reference when the ledger has one, kind + metrics always. -->
			<text class="selection-label" x="16" y="24">{selectedOpeningLabel} · {selectedOpening.width.toFixed(2)} m × {selectedOpening.height.toFixed(2)} m</text>
		{/if}

	</svg>
	<!--
		P23.13 S3 / §4 A4 — the fixed canvas identity readout. It appears only when
		the selected Room's resting label cannot carry its complete identity (a tiny
		or obstructed face, or a name the two-line 160 px budget cannot hold).
		Read-only, non-mutating and temporary: never a second Inspector, never a
		rename field, and never a reason to force an overlap into the drawing.
	-->
	<!--
		P23.13 S7 / §7 — the transient numeric field, on the value it replaces. It is
		never a second Inspector: one field at a time, seeded from the canonical
		candidate, and gone the moment it is submitted, restored or blurred. A coarse
		pointer gets the fallback layout (a bar across the canvas) because a 66 px
		field under a finger is not an editor.
	-->
	{#if numericEntry}
		{@const entryField = planNumericEntryField(numericEntry)}
		{@const entryAxis = planNumericFieldAxis(entryField)}
		<div
			class="plan-numeric-entry"
			class:plan-numeric-entry-coarse={planCoarsePointer}
			class:plan-numeric-entry-invalid={numericEntry.invalidReason !== null}
			style={!planCoarsePointer && numericEntryAnchorPx
				? `left: ${Math.round(numericEntryAnchorPx[0])}px; top: ${Math.round(numericEntryAnchorPx[1])}px;`
				: undefined}
			data-host={numericEntry.host}
			data-field={entryField.id}
			data-axis={entryAxis ?? undefined}
		>
			<span class="plan-numeric-entry-label">{entryField.label}</span>
			<input
				bind:this={numericEntryElement}
				class="plan-numeric-entry-input"
				type="text"
				inputmode="decimal"
				autocomplete="off"
				spellcheck="false"
				aria-label={`${entryField.label} exact value`}
				aria-invalid={numericEntry.invalidReason !== null}
				value={numericEntry.text}
				oninput={onNumericEntryInput}
				onkeydown={onNumericEntryKeyDown}
				onblur={onNumericEntryBlur}
			/>
			{#if numericEntry.invalidReason}
				<span class="plan-numeric-entry-reason" role="status">
					{planNumericInvalidMessage(numericEntry.invalidReason, entryField)}
				</span>
			{:else}
				<span class="plan-numeric-entry-unit">{entryField.unit === 'angle' ? '°' : 'm'}</span>
			{/if}
		</div>
	{/if}
	{#if roomLabelReadout || measureReadout}
		<div
			class="plan-readout"
			role="note"
			aria-label={measureReadout && !roomLabelReadout ? 'Working measurements' : 'Selected room identity'}
		>
			{#if roomLabelReadout}
				<span class="plan-readout-primary">{roomLabelReadout.primary}</span>
				{#if roomLabelReadout.reference}
					<span class="plan-readout-reference">{roomLabelReadout.reference}</span>
				{/if}
				{#if roomLabelReadout.area}
					<span class="plan-readout-area">{roomLabelReadout.area}</span>
				{/if}
			{/if}
			{#if measureReadout}
				{#each measureReadout as entry (entry.key)}
					<span class="plan-readout-measure">
						<span class="plan-readout-measure-name">{entry.measure}</span>
						{entry.value}
					</span>
				{/each}
			{/if}
		</div>
	{/if}
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
		{#if interaction.planViewMode === 'staging' && selectedPlacementIds.length > 0 && interaction.arrangeOwner !== 'layout-object'}<span>Selected: {selectedPlacementIds.length} scene item{selectedPlacementIds.length === 1 ? '' : 's'}</span>{:else if planSelectionLabel}<span>Selected: {planSelectionLabel}</span>{/if}
		{#if preview.lastMutationMessage}<span class="warning">{preview.lastMutationMessage}</span>{/if}
	</div>
</div>

<style>
	.plan-viewport { position: absolute; inset: 0; z-index: 3; background: var(--editor-bg-app); container-type: inline-size; }
	/* P3.2 §9 — the plan is a bright drafting surface against the dark shell. */
	.plan-canvas { display: block; position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: crosshair; outline: none; background: var(--editor-plan-canvas-bg); user-select: none; -webkit-user-select: none; }
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
	/* P23.13 S10 / §9 — keyboard focus live region. Visually hidden (clip
	   pattern, so 200% text zoom cannot clip or overlap it into view); the
	   announcement is speech only, never layout. */
	.plan-focus-announcement { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
	.plan-status { position: absolute; left: 0.8rem; bottom: 0.8rem; z-index: 10; max-width: 60%; margin: 0; padding: 0.34rem 0.5rem; border: 1px solid var(--editor-border-normal); border-radius: 0.3rem; background: var(--editor-bg-panel-raised); color: var(--editor-text-secondary); font: 500 0.7rem/1.25 var(--editor-font); pointer-events: none; }
	.plan-actions { position: absolute; right: 0.8rem; bottom: 0.8rem; z-index: 10; display: flex; gap: 0.4rem; pointer-events: auto; }
	.plan-actions button { padding: 0.44rem 0.6rem; border: 1px solid var(--editor-accent-border); border-radius: 0.32rem; background: var(--editor-bg-selected); color: var(--editor-text-primary); font: 600 0.7rem/1 var(--editor-font); cursor: pointer; }
	.plan-actions button.secondary { border-color: var(--editor-border-normal); background: var(--editor-bg-panel-raised); color: var(--editor-text-secondary); }
	.plan-meta { position: absolute; left: 0.8rem; bottom: 0.8rem; z-index: 2; display: flex; gap: 0.7rem; color: var(--editor-plan-muted); font: 0.68rem/1 var(--editor-font); pointer-events: none; }
	/* P23.13 S3 — bounded readout: inset 12px from the viewport safe corner,
	   ≤280px (or the available width), wrapping rather than truncating, with a
	   bounded scroll so a pathological name cannot cover the drawing. */
	.plan-readout { position: absolute; top: 12px; right: 12px; z-index: 11; box-sizing: border-box; display: grid; gap: 0.15rem; max-width: min(280px, calc(100% - 24px)); max-height: min(40%, 9rem); overflow-y: auto; padding: 0.4rem 0.55rem; border: 1px solid var(--editor-plan-grid-major); border-radius: 0.35rem; background: rgb(255 255 255 / 92%); color: var(--editor-plan-label); font: 500 0.72rem/1.25 var(--editor-font); text-align: left; box-shadow: var(--editor-shadow-popover); }
	/* P23.13 S7 / §7 — the numeric field sits on the value it edits. Monospace
	   tabular digits at the readout's own scale, so the number the user types and
	   the number they were reading are the same shape. */
	/* Opaque on purpose: §7 says the field *replaces* the value it sits on, and the
	   value's own dimension text is what it is anchored to — a translucent field
	   would show two numbers for one measurement. */
	.plan-numeric-entry { position: absolute; z-index: 12; display: inline-flex; gap: 0.3rem; align-items: center; transform: translate(-50%, -50%); padding: 0.16rem 0.34rem; border: 1px solid var(--editor-accent-border); border-radius: 0.3rem; background: var(--editor-plan-canvas-bg); color: var(--editor-plan-label); font: 600 0.68rem/1.2 var(--editor-font); box-shadow: var(--editor-shadow-popover); }
	.plan-numeric-entry-invalid { border-color: var(--editor-danger-border); }
	.plan-numeric-entry-label { color: var(--editor-plan-muted); font-weight: 500; }
	/* #35 (§7) — an axis-valued field names its axis in the canonical axis ink
	   (ΔX red / ΔZ blue, DS §8), which is the same ink the canvas corner
	   widget and the 3D gizmo use for that axis: the field and the axis it
	   moves are visibly one thing. Magnitudes and angles keep neutral ink. */
	.plan-numeric-entry[data-axis='x'] .plan-numeric-entry-label { color: var(--editor-axis-x); }
	.plan-numeric-entry[data-axis='z'] .plan-numeric-entry-label { color: var(--editor-axis-z); }
	/* §7 two type voices: a measure is set in mono + tabular figures, so the
	   digits never reflow the field the placer already measured. */
	.plan-numeric-entry-input { width: 5.4rem; padding: 0.1rem 0.2rem; border: 0; border-bottom: 1px solid var(--editor-plan-label); background: transparent; color: var(--editor-plan-label); font: 600 0.74rem/1.2 var(--editor-font-mono, ui-monospace, monospace); font-variant-numeric: tabular-nums; text-align: right; outline: none; }
	.plan-numeric-entry-input:focus { border-bottom-color: var(--editor-accent); }
	.plan-numeric-entry-unit { color: var(--editor-plan-muted); font-weight: 500; }
	.plan-numeric-entry-reason { color: var(--editor-danger-fg); font-weight: 500; }
	/* Coarse pointers get the fallback layout: a full-width bar above the action
	   row, where a finger can actually reach the field it is editing. */
	.plan-numeric-entry-coarse { left: 12px; right: 12px; top: auto; bottom: 3.4rem; transform: none; }
	.plan-numeric-entry-coarse .plan-numeric-entry-input { flex: 1; width: auto; }
	.plan-readout-primary { font-weight: 650; overflow-wrap: anywhere; }
	.plan-readout-reference,
	.plan-readout-area { color: var(--editor-plan-muted); font-size: 0.68rem; font-variant-numeric: tabular-nums; }
	/* P23.13 S6 — a detached measure still has to name itself (§7: the number is
	   working information, not a value the geometry makes obvious any more). */
	.plan-readout-measure { display: flex; gap: 0.35rem; align-items: baseline; color: var(--editor-plan-label); font-size: 0.68rem; font-variant-numeric: tabular-nums; }
	.plan-readout-measure-name { color: var(--editor-plan-muted); }
	/* Narrow drawings reflow the readout above the plan instead of over it. */
	@container (max-width: 720px) { .plan-readout { left: 12px; right: 12px; max-width: none; } }
	.plan-meta .warning { color: var(--editor-danger-fg); }
	@media (max-width: 44rem) {
		.staging-selection-warning { top: 8rem; }
		.arrange-empty { top: 8rem; }
	}
</style>
